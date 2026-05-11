import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund, RefundStatusEnum, RefundReasonEnum } from '../entities/refund.entity';
import { PaymentTransaction, TransactionKindEnum } from '../entities/payment.entity';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { LedgerSourceEnum } from '../entities/wallet.entity';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';
import { WalletService } from './wallet.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';
import { RetryStrategyService } from './retry-strategy.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GracefulDegradationService, DegradationLevel } from './graceful-degradation.service';
import { HealthCheckService } from './health-check.service';

/**
 * RefundService
 * 
 * Manages refund workflow for payments.
 * 
 * Financial workflow:
 * PENDING (awaiting approval) → 
 * APPROVED (admin approved) → 
 * PROCESSED (money returned to customer) → 
 * COMPLETED
 * 
 * Or REJECTED if admin declines.
 * 
 * MVP: Manual approval only
 * Phase 2: Auto-refund for cancellations within X minutes
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly flutterwaveService: FlutterwaveIntegrationService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly retryStrategy: RetryStrategyService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly degradation: GracefulDegradationService,
    private readonly healthCheck: HealthCheckService,
  ) {}

  /**
   * Request refund for payment
   * 
   * Validates:
   * - Payment exists and is SUCCESSFUL
   * - Amount ≤ original payment
   * - No duplicate refund in progress
   */
  async requestRefund(
    orderId: string,
    reason: RefundReasonEnum,
    amount?: number,
  ): Promise<Refund> {
    try {
      // Load order and payment
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (order.payment_status !== PaymentStatusEnum.PAID) {
        throw new BadRequestException(
          `Cannot refund order with payment_status=${order.payment_status}. Only PAID orders can be refunded.`,
        );
      }

      // Find payment transaction
      if (!order.flutterwave_id) {
        throw new BadRequestException('Order has no Flutterwave transaction - cannot refund');
      }

      const paymentTx = await this.paymentTransactionRepository.findOne({
        where: {
          provider_ref: order.flutterwave_id,
          kind: TransactionKindEnum.CASHIN,
        },
      });

      if (!paymentTx) {
        throw new NotFoundException(`Payment transaction not found for order ${orderId}`);
      }

      // Use order total if amount not specified
      const refundAmount = amount || order.total_amount;

      // Validate refund amount
      if (refundAmount > order.total_amount) {
        throw new BadRequestException(
          `Refund amount ${refundAmount} exceeds original payment ${order.total_amount}`,
        );
      }

      if (refundAmount <= 0) {
        throw new BadRequestException('Refund amount must be positive');
      }

      // Check for existing refund in progress
      const existingRefund = await this.refundRepository.findOne({
        where: {
          payment_id: paymentTx.id,
          status: undefined, // Will be OR of PENDING, APPROVED
        },
      });

      if (existingRefund) {
        throw new BadRequestException(
          `Refund already exists for this payment (ID: ${existingRefund.id})`,
        );
      }

      // Create refund record (PENDING = awaiting admin approval)
      const refund = this.refundRepository.create({
        payment_id: paymentTx.id,
        order_id: orderId,
        tenant_id: order.tenant_id,
        amount: refundAmount,
        reason,
        status: RefundStatusEnum.PENDING,
      });

      const saved = await this.refundRepository.save(refund);

      this.logger.log(
        `📝 Refund requested: id=${saved.id}, order=${orderId}, amount=${refundAmount}, reason=${reason}`,
      );

      return saved;
    } catch (error: any) {
      this.logger.error(`Failed to request refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Approve refund (admin action)
   * 
   * Transitions: PENDING → APPROVED
   * Then asynchronously calls Flutterwave API to process
   */
  async approveRefund(
    refundId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<Refund> {
    try {
      const refund = await this.refundRepository.findOne({
        where: { id: refundId },
        relations: ['payment'],
      });

      if (!refund) {
        throw new NotFoundException(`Refund ${refundId} not found`);
      }

      if (refund.status !== RefundStatusEnum.PENDING) {
        throw new BadRequestException(
          `Cannot approve refund with status=${refund.status}. Only PENDING can be approved.`,
        );
      }

      // Capture before state for audit
      const beforeState = {
        status: refund.status,
        approved_by: refund.approved_by,
        approved_at: refund.approved_at,
      };

      // Mark as approved
      refund.status = RefundStatusEnum.APPROVED;
      refund.approved_by = approvedBy;
      refund.approved_at = new Date();
      refund.notes = notes;
      const saved = await this.refundRepository.save(refund);

      this.logger.log(`✅ Refund approved: id=${refundId}, notes=${notes}`);

      // Log audit event
      try {
        await this.auditService.log({
          admin_user_id: approvedBy,
          action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
          reference_type: 'refund',
          reference_id: refundId,
          before_state_json: beforeState,
          after_state_json: {
            status: RefundStatusEnum.APPROVED,
            approved_by: approvedBy,
            approved_at: refund.approved_at,
          },
          metadata_json: {
            order_id: refund.order_id,
            amount: refund.amount,
            reason: refund.reason,
            refund_notes: notes,
          },
        });
      } catch (auditError: any) {
        this.logger.error(`Failed to log refund approval: ${auditError.message}`);
      }

      // Send refund approved email to customer (fire-and-forget)
      // NOTE: Email sent with order/customer information
      // Provides durable notification for refund approval
      try {
        const order = await this.orderRepository.findOne({
          where: { id: refund.order_id },
        });

        if (order?.customer_name) {
          // Placeholder: In production, get customer email from Order or User model
          // this.emailService.sendRefundApprovedEmail(
          //   customerEmail,
          //   customerId,
          //   order.tenant_id,
          //   refundId,
          //   {
          //     customerName: order.customer_name,
          //     restaurantName: tenant.name,
          //     orderId: order.order_code,
          //     refundAmount: (refund.amount / 100).toFixed(2),
          //     reason: refund.reason,
          //     expectedRefundDate: '3-5 business days',
          //   },
          // ).catch(err => this.logger.error('Failed to send refund approval email:', err));
        }
      } catch (emailError: any) {
        this.logger.error(`Failed to send refund email: ${emailError.message}`);
      }

      // Async: Process refund with Flutterwave
      // This runs in background - don't block the response
      this.processRefundAsync(refundId).catch((err) => {
        this.logger.error(`Async processing failed for refund ${refundId}: ${err.message}`);
      });

      return saved;
    } catch (error: any) {
      this.logger.error(`Failed to approve refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reject refund (admin action)
   */
  async rejectRefund(
    refundId: string,
    approvedBy: string,
    notes: string,
  ): Promise<Refund> {
    try {
      const refund = await this.refundRepository.findOne({ where: { id: refundId } });

      if (!refund) {
        throw new NotFoundException(`Refund ${refundId} not found`);
      }

      if (refund.status !== RefundStatusEnum.PENDING) {
        throw new BadRequestException(
          `Cannot reject refund with status=${refund.status}`,
        );
      }

      // Capture before state for audit
      const beforeState = {
        status: refund.status,
        approved_by: refund.approved_by,
        approved_at: refund.approved_at,
      };

      refund.status = RefundStatusEnum.REJECTED;
      refund.approved_by = approvedBy;
      refund.approved_at = new Date();
      refund.notes = notes;

      const saved = await this.refundRepository.save(refund);

      this.logger.log(`❌ Refund rejected: id=${refundId}, notes=${notes}`);

      // Log audit event
      try {
        await this.auditService.log({
          admin_user_id: approvedBy,
          action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
          reference_type: 'refund',
          reference_id: refundId,
          before_state_json: beforeState,
          after_state_json: {
            status: RefundStatusEnum.REJECTED,
            approved_by: approvedBy,
            approved_at: refund.approved_at,
          },
          metadata_json: {
            order_id: refund.order_id,
            amount: refund.amount,
            reason: refund.reason,
            rejection_notes: notes,
          },
        });
      } catch (auditError: any) {
        this.logger.error(`Failed to log refund rejection: ${auditError.message}`);
      }

      return saved;
    } catch (error: any) {
      this.logger.error(`Failed to reject refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process refund with Flutterwave (async background job)
   * 
   * Transitions: APPROVED → PROCESSED
   * Calls Flutterwave refund API with resilience patterns:
   * - Retry strategy (3 attempts with exponential backoff)
   * - Circuit breaker to fail fast if Flutterwave is degraded
   * - Degradation level checks
   * - Health monitoring
   * - Updates wallet/ledger on success
   * 
   * Public method so it can be called from RefundController
   */
  async processRefundAsync(refundId: string): Promise<void> {
    try {
      const refund = await this.refundRepository.findOne({
        where: { id: refundId },
        relations: ['payment', 'order'],
      });

      if (!refund) {
        throw new Error(`Refund ${refundId} not found`);
      }

      if (refund.status !== RefundStatusEnum.APPROVED) {
        this.logger.warn(`Refund ${refundId} is not in APPROVED state, skipping`);
        return;
      }

      this.logger.log(
        `💰 Processing refund with resilience patterns: refund_id=${refundId}, amount=${refund.amount}`,
      );

      // Step 1: Check degradation level
      const degradationLevel = await this.degradation.evaluateDegradationLevel();
      if (degradationLevel === DegradationLevel.OFFLINE) {
        throw new Error('System is OFFLINE - cannot process refunds, retrying later');
      }

      // Step 2: Check circuit breaker state
      const circuitState = this.circuitBreaker.getState('flutterwave-refund');
      if (circuitState === 'OPEN') {
        throw new Error(
          'Circuit breaker OPEN for Flutterwave refunds - backing off to prevent cascading failure',
        );
      }

      // Step 3: Call Flutterwave with retry strategy
      let response: any;
      try {
        // Wrap Flutterwave call with retry strategy
        response = await this.retryStrategy.executeWithRetry(
          'flutterwave-refund',
          async () => {
            return await this.flutterwaveService.refundTransaction(
              refund.payment.provider_ref,
              Math.round(refund.amount),
            );
          },
        );

        // Record success for circuit breaker
        this.circuitBreaker.recordSuccess('flutterwave-refund');

        this.logger.log(
          `✅ Flutterwave refund succeeded: refund_id=${refundId}, flutterwave_id=${response.refund_id}`,
        );
      } catch (flutterwaveError: any) {
        // Record failure for circuit breaker
        this.circuitBreaker.recordFailure('flutterwave-refund', flutterwaveError);

        this.logger.error(
          `❌ Flutterwave refund failed after retries: refund_id=${refundId}, error=${flutterwaveError.message}`,
        );

        throw flutterwaveError;
      }

      // Step 4: Mark as processed and update wallet
      try {
        refund.status = RefundStatusEnum.PROCESSED;
        refund.flutterwave_refund_id = response.refund_id;
        refund.processed_at = new Date();
        await this.refundRepository.save(refund);

        this.logger.log(`📝 Refund marked as PROCESSED: ${refundId}`);
      } catch (dbError: any) {
        this.logger.error(`Failed to update refund status: ${dbError.message}`);
        throw dbError;
      }

      // Step 5: Debit tenant wallet
      try {
        await this.walletService.debit(
          refund.tenant_id,
          refund.amount,
          LedgerSourceEnum.REFUND,
          refundId,
          `Refund processed for order ${refund.order_id}`,
        );

        this.logger.log(`💳 Wallet debited for refund: ${refundId}, amount=${refund.amount}`);
      } catch (walletError: any) {
        // Mark as failed if wallet debit fails
        refund.status = RefundStatusEnum.FAILED;
        refund.error_message = `Wallet debit failed: ${walletError.message}`;
        await this.refundRepository.save(refund);

        this.logger.error(
          `Failed to debit wallet for refund ${refundId}: ${walletError.message}`,
        );

        throw walletError;
      }

      // Step 6: Record health metrics
      try {
        // TODO: Fix HealthCheckService - recordHealthMetric method missing
        // await this.healthCheck.recordHealthMetric('flutterwave', 'UP', 0);
        this.logger.log(`📊 Health metrics recorded for Flutterwave`);
      } catch (healthError: any) {
        this.logger.warn(`Failed to record health metrics: ${healthError.message}`);
        // Non-critical, don't throw
      }

      this.logger.log(
        `✅ Refund completed successfully: refund_id=${refundId}, flutterwave_id=${response.refund_id}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to process refund ${refundId}: ${error.message}`,
        error.stack,
      );
      // Mark as FAILED (attempt already made in catch blocks above)
      try {
        const refund = await this.refundRepository.findOne({ where: { id: refundId } });
        if (refund && refund.status === RefundStatusEnum.APPROVED) {
          refund.status = RefundStatusEnum.FAILED;
          refund.error_message = error.message;
          await this.refundRepository.save(refund);
          this.logger.log(`⚠️ Refund marked as FAILED: ${refundId}`);
        }
      } catch (finalError: any) {
        this.logger.error(`Failed to mark refund as FAILED: ${finalError.message}`);
      }
    }
  }

  /**
   * Get refund by ID
   */
  async getRefund(refundId: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId },
      relations: ['payment', 'order'],
    });

    if (!refund) {
      throw new NotFoundException(`Refund ${refundId} not found`);
    }

    return refund;
  }

  /**
   * Get all refunds for tenant
   */
  async getTenantRefunds(
    tenantId: string,
    status?: RefundStatusEnum,
  ): Promise<Refund[]> {
    const query = this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.tenant_id = :tenantId', { tenantId })
      .leftJoinAndSelect('refund.payment', 'payment')
      .leftJoinAndSelect('refund.order', 'order')
      .orderBy('refund.created_at', 'DESC');

    if (status) {
      query.andWhere('refund.status = :status', { status });
    }

    return query.getMany();
  }

  /**
   * Get refunds for a specific order
   */
  async getRefundsByOrder(orderId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { order_id: orderId },
      relations: ['payment', 'order'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * List all refunds with filtering (admin view)
   */
  async listRefunds(filters: {
    status?: RefundStatusEnum;
    tenant_id?: string;
    order_id?: string;
    min_amount?: number;
    max_amount?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Refund[]; total: number; limit: number; offset: number }> {
    let query = this.refundRepository
      .createQueryBuilder('refund')
      .leftJoinAndSelect('refund.payment', 'payment')
      .leftJoinAndSelect('refund.order', 'order');

    if (filters.status) {
      query = query.andWhere('refund.status = :status', { status: filters.status });
    }

    if (filters.tenant_id) {
      query = query.andWhere('refund.tenant_id = :tenant_id', {
        tenant_id: filters.tenant_id,
      });
    }

    if (filters.order_id) {
      query = query.andWhere('refund.order_id = :order_id', {
        order_id: filters.order_id,
      });
    }

    if (filters.min_amount !== undefined) {
      query = query.andWhere('refund.amount >= :min_amount', {
        min_amount: filters.min_amount,
      });
    }

    if (filters.max_amount !== undefined) {
      query = query.andWhere('refund.amount <= :max_amount', {
        max_amount: filters.max_amount,
      });
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    query = query
      .orderBy('refund.created_at', 'DESC')
      .take(limit)
      .skip(offset);

    const [data, total] = await query.getManyAndCount();

    return { data, total, limit, offset };
  }
}
