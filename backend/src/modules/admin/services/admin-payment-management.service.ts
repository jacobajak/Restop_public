import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { PaymentTransaction } from '../../payments/entities/payment.entity';
import { Refund, RefundStatusEnum, RefundReasonEnum } from '../../payments/entities/refund.entity';
import { Order } from '../../orders/entities/order.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { FraudReview, FraudReviewStatus, FraudRiskLevel } from '../../payments/entities/fraud-review.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * AdminPaymentManagementService
 * 
 * Handles admin operations for payment management:
 * 1. Manual payment creation for testing
 * 2. Payment status override (for reconciliation, testing)
 * 3. Bulk refund processing
 * 4. Fraud review state management
 * 
 * All operations are audited and tracked.
 */
@Injectable()
export class AdminPaymentManagementService {
  private readonly logger = new Logger(AdminPaymentManagementService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(FraudReview)
    private fraudReviewRepository: Repository<FraudReview>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  /**
   * Create payment manually for testing
   * Simulates a payment without provider interaction
   */
  async createManualPayment(
    data: {
      order_id: string;
      tenant_id: string;
      amount: number;
      currency: string;
      method: 'MTN' | 'AIRTEL' | 'CASH';
      reason?: string;
      phone_number?: string;
    },
    admin_id: string,
  ): Promise<PaymentTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate order exists
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: data.order_id },
      });
      if (!order) {
        throw new NotFoundException(`Order ${data.order_id} not found`);
      }

      // Validate tenant exists
      const tenant = await queryRunner.manager.findOne(Tenant, {
        where: { id: data.tenant_id },
      });
      if (!tenant) {
        throw new NotFoundException(`Tenant ${data.tenant_id} not found`);
      }

      // Validate amount matches order total
      if (data.amount !== parseFloat(order.total_amount.toString())) {
        throw new BadRequestException(
          `Amount ${data.amount} does not match order total ${order.total_amount}`,
        );
      }

      // Generate provider reference for manual payment
      const provider_ref = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create payment transaction
      const payment = queryRunner.manager.create(PaymentTransaction, {
        order_id: data.order_id,
        tenant_id: data.tenant_id,
        provider: 'MANUAL_ADMIN',
        kind: 'CASHIN',
        provider_ref,
        amount: data.amount,
        currency: data.currency,
        flutterwave_status: 'SUCCESSFUL',
        status: 'SUCCESSFUL',
        raw_payload: {
          manual_creation: true,
          created_by_admin: admin_id,
          reason: data.reason || 'Testing',
          timestamp: new Date(),
        },
      });

      await queryRunner.manager.save(payment);

      // Update order payment status
      await queryRunner.manager.update(
        Order,
        { id: data.order_id },
        {
          payment_status: 'PAID',
          transaction_ref: provider_ref,
          flutterwave_id: provider_ref,
        },
      );

      await queryRunner.commitTransaction();

      // Audit log
      await this.auditService.log({
        admin_user_id: admin_id,
        action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
        reference_type: 'manual_payment_creation',
        reference_id: payment.id,
        metadata_json: {
          order_id: data.order_id,
          tenant_id: data.tenant_id,
          amount: data.amount,
          currency: data.currency,
          method: data.method,
          reason: data.reason || 'Testing',
        },
      });

      this.logger.log(
        `Manual payment created: ${payment.id} for order ${data.order_id}`,
      );

      return payment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Override payment status
   * Used for reconciliation, testing, or correction
   */
  async overridePaymentStatus(
    payment_id: string,
    new_status: 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'CANCELLED',
    admin_id: string,
    reason: string,
  ): Promise<PaymentTransaction> {
    const payment = await this.paymentRepository.findOne({
      where: { id: payment_id },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${payment_id} not found`);
    }

    const old_status = payment.status;

    // Update payment status
    payment.status = new_status;
    payment.flutterwave_status = new_status;
    payment.raw_payload = {
      ...(payment.raw_payload || {}),
      status_override: {
        old_status,
        new_status,
        overridden_by_admin: admin_id,
        reason,
        timestamp: new Date(),
      },
    };

    await this.paymentRepository.save(payment);

    // If status changed to SUCCESSFUL, update order payment status
    if (new_status === 'SUCCESSFUL' && old_status !== 'SUCCESSFUL') {
      await this.orderRepository.update(
        { id: payment.order_id },
        { payment_status: 'PAID' },
      );
    }

    // Audit log
    await this.auditService.log({
      admin_user_id: admin_id,
      action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
      reference_type: 'payment_status_override',
      reference_id: payment_id,
      metadata_json: {
        order_id: payment.order_id,
        old_status,
        new_status,
        reason,
      },
    });

    this.logger.warn(
      `Payment ${payment_id} status overridden from ${old_status} to ${new_status} by admin ${admin_id}`,
    );

    return payment;
  }

  /**
   * Bulk refund processing
   * Process multiple refunds in a single transaction
   */
  async bulkProcessRefunds(
    refund_ids: string[],
    admin_id: string,
    notes: string,
  ): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
    summary: { total: number; approved: number; failed: number };
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    try {
      // Fetch all refunds
      const refunds = await queryRunner.manager.find(Refund, {
        where: { id: In(refund_ids), status: RefundStatusEnum.PENDING },
      });

      for (const refund of refunds) {
        try {
          // Validate payment exists
          const payment = await queryRunner.manager.findOne(PaymentTransaction, {
            where: { id: refund.payment_id },
          });

          if (!payment) {
            throw new Error('Associated payment not found');
          }

          // Update refund status
          refund.status = RefundStatusEnum.PROCESSED;
          refund.approved_by = admin_id;
          refund.approved_at = new Date();
          refund.processed_at = new Date();
          refund.notes = notes;

          await queryRunner.manager.save(refund);
          successful.push(refund.id);

          // Audit log for each success
          await this.auditService.log({
            admin_user_id: admin_id,
            action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
            reference_type: 'bulk_refund_processing',
            reference_id: refund.id,
            metadata_json: {
              order_id: refund.order_id,
              amount: refund.amount,
              notes,
            },
          });
        } catch (error) {
          failed.push({
            id: refund.id,
            error: error.message,
          });
        }
      }

      await queryRunner.commitTransaction();

      const summary = {
        total: refund_ids.length,
        approved: successful.length,
        failed: failed.length,
      };

      this.logger.log(
        `Bulk refund processing complete: ${successful.length} approved, ${failed.length} failed`,
      );

      return { successful, failed, summary };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk reject refunds
   */
  async bulkRejectRefunds(
    refund_ids: string[],
    admin_id: string,
    rejection_reason: string,
  ): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
    summary: { total: number; rejected: number; failed: number };
  }> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const refunds = await this.refundRepository.find({
      where: { id: In(refund_ids), status: RefundStatusEnum.PENDING },
    });

    for (const refund of refunds) {
      try {
        refund.status = RefundStatusEnum.REJECTED;
        refund.approved_by = admin_id;
        refund.approved_at = new Date();
        refund.notes = rejection_reason;

        await this.refundRepository.save(refund);
        successful.push(refund.id);

        // Audit log
        await this.auditService.log({
          admin_user_id: admin_id,
          action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
          reference_type: 'bulk_refund_rejection',
          reference_id: refund.id,
          metadata_json: {
            order_id: refund.order_id,
            amount: refund.amount,
            reason: rejection_reason,
          },
        });
      } catch (error) {
        failed.push({
          id: refund.id,
          error: error.message,
        });
      }
    }

    const summary = {
      total: refund_ids.length,
      rejected: successful.length,
      failed: failed.length,
    };

    this.logger.log(
      `Bulk refund rejection complete: ${successful.length} rejected, ${failed.length} failed`,
    );

    return { successful, failed, summary };
  }

  /**
   * Approve fraud review with action
   */
  async approveFraudReview(
    review_id: string,
    admin_id: string,
    action: 'ALLOW' | 'HOLD_24H' | 'BLOCK_CUSTOMER' | 'ESCALATE',
    notes: string,
  ): Promise<FraudReview> {
    const review = await this.fraudReviewRepository.findOne({
      where: { id: review_id },
    });

    if (!review) {
      throw new NotFoundException(`Fraud review ${review_id} not found`);
    }

    let newStatus: FraudReviewStatus;
    switch (action) {
      case 'ALLOW':
        newStatus = FraudReviewStatus.APPROVED;
        break;
      case 'ESCALATE':
        newStatus = FraudReviewStatus.ESCALATED;
        break;
      case 'BLOCK_CUSTOMER':
      case 'HOLD_24H':
        newStatus = FraudReviewStatus.BLOCKED;
        break;
      default:
        newStatus = FraudReviewStatus.APPROVED;
    }

    review.status = newStatus;
    review.assigned_admin_id = admin_id;
    review.notes = notes;
    review.action_taken = action;
    review.reviewed_at = new Date();

    await this.fraudReviewRepository.save(review);

    // Audit log
    await this.auditService.log({
      admin_user_id: admin_id,
      action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
      reference_type: 'fraud_review_approval',
      reference_id: review_id,
      metadata_json: {
        subject_type: review.subject_type,
        subject_id: review.subject_id,
        risk_level: review.risk_level,
        action_taken: action,
        notes,
      },
    });

    this.logger.log(
      `Fraud review ${review_id} approved with action: ${action}`,
    );

    return review;
  }

  /**
   * Reject/dismiss fraud review
   */
  async dismissFraudReview(
    review_id: string,
    admin_id: string,
    reason: string,
  ): Promise<FraudReview> {
    const review = await this.fraudReviewRepository.findOne({
      where: { id: review_id },
    });

    if (!review) {
      throw new NotFoundException(`Fraud review ${review_id} not found`);
    }

    review.status = FraudReviewStatus.DISMISSED;
    review.assigned_admin_id = admin_id;
    review.notes = reason;
    review.reviewed_at = new Date();

    await this.fraudReviewRepository.save(review);

    // Audit log
    await this.auditService.log({
      admin_user_id: admin_id,
      action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
      reference_type: 'fraud_review_dismissal',
      reference_id: review_id,
      metadata_json: {
        subject_type: review.subject_type,
        reason,
      },
    });

    this.logger.log(`Fraud review ${review_id} dismissed`);

    return review;
  }

  /**
   * Bulk fraud review actions
   */
  async bulkFraudReviewAction(
    review_ids: string[],
    admin_id: string,
    action: 'APPROVE' | 'DISMISS' | 'ESCALATE',
    reason: string,
  ): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
    summary: { total: number; processed: number; failed: number };
  }> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const reviews = await this.fraudReviewRepository.find({
      where: { id: In(review_ids), status: FraudReviewStatus.OPEN },
    });

    for (const review of reviews) {
      try {
        let newStatus: FraudReviewStatus;

        if (action === 'APPROVE') {
          newStatus = FraudReviewStatus.APPROVED;
        } else if (action === 'ESCALATE') {
          newStatus = FraudReviewStatus.ESCALATED;
        } else {
          newStatus = FraudReviewStatus.DISMISSED;
        }

        review.status = newStatus;
        review.assigned_admin_id = admin_id;
        review.notes = reason;
        review.action_taken = action;
        review.reviewed_at = new Date();

        await this.fraudReviewRepository.save(review);
        successful.push(review.id);

        await this.auditService.log({
          admin_user_id: admin_id,
          action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
          reference_type: 'bulk_fraud_action',
          reference_id: review.id,
          metadata_json: {
            subject_type: review.subject_type,
            action,
            reason,
          },
        });
      } catch (error) {
        failed.push({
          id: review.id,
          error: error.message,
        });
      }
    }

    const summary = {
      total: review_ids.length,
      processed: successful.length,
      failed: failed.length,
    };

    this.logger.log(
      `Bulk fraud review action complete: ${successful.length} processed, ${failed.length} failed`,
    );

    return { successful, failed, summary };
  }

  /**
   * Get payment audit trail
   */
  async getPaymentAuditTrail(payment_id: string): Promise<any[]> {
    // This would query the audit log table for this payment's history
    // Implementation depends on audit table structure
    return [];
  }

  /**
   * Get refund audit trail
   */
  async getRefundAuditTrail(refund_id: string): Promise<any[]> {
    return [];
  }

  /**
   * Get all payments platform-wide with filtering
   * Admin can view all payments in the system
   */
  async getAllPaymentsPlatformWide(
    filters: {
      method?: string;
      status?: string;
      tenantId?: string;
      fromDate?: Date;
      toDate?: Date;
      search?: string;
    },
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaymentTransaction[]> {
    let query = this.paymentRepository.createQueryBuilder('payment');

    // Apply filters
    if (filters.method) {
      query = query.where('payment.kind = :method', { method: filters.method });
    }

    if (filters.status) {
      if (filters.method) {
        query = query.andWhere('payment.status = :status', { status: filters.status });
      } else {
        query = query.where('payment.status = :status', { status: filters.status });
      }
    }

    if (filters.tenantId) {
      const whereCondition = filters.method || filters.status ? 'andWhere' : 'where';
      query = query[whereCondition]('payment.tenant_id = :tenantId', { tenantId: filters.tenantId });
    }

    if (filters.fromDate) {
      const whereCondition = filters.method || filters.status || filters.tenantId ? 'andWhere' : 'where';
      query = query[whereCondition]('payment.created_at >= :fromDate', { fromDate: filters.fromDate });
    }

    if (filters.toDate) {
      const whereCondition = filters.method || filters.status || filters.tenantId || filters.fromDate ? 'andWhere' : 'where';
      query = query[whereCondition]('payment.created_at <= :toDate', { toDate: filters.toDate });
    }

    if (filters.search) {
      const whereCondition = filters.method || filters.status || filters.tenantId || filters.fromDate || filters.toDate ? 'andWhere' : 'where';
      query = query[whereCondition](
        '(payment.provider_ref ILIKE :search OR payment.tx_ref ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Order by created date descending and apply pagination
    const payments = await query
      .orderBy('payment.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();

    return payments;
  }

  /**
   * Get payment details by ID (platform-wide access)
   * Admin can view any payment in system
   */
  async getPaymentDetailsByIdPlatformWide(id: string): Promise<PaymentTransaction> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return payment;
  }
}
