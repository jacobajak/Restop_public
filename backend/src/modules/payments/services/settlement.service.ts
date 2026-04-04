import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { TenantWallet, LedgerEntry, LedgerSourceEnum, LedgerEntryTypeEnum, LedgerStatusEnum } from '../entities/wallet.entity';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { Commission } from '../entities/commission.entity';
import { WalletService } from './wallet.service';
import { CommissionService } from './commission.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationEmailService } from '../../notifications/services/notification-email.service';

/**
 * SettlementService
 * 
 * Orchestrates settlement records and tracks what tenants are owed.
 * 
 * Responsibilities:
 * 1. Create merchant payables when payment is confirmed
 * 2. Calculate net payable (gross - platform fee - provider fee)
 * 3. Track settlement status transitions
 * 4. Generate settlement records for payouts
 * 5. Provide settlement reporting for dashboard
 * 
 * Per DineFlow Brief Section 1.3 & 1.4:
 * - Merchant payables: Track what restaurant is owed
 * - Merchant settlements: Track actual payout attempts
 * - Payment ledger: Immutable audit trail
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(TenantWallet)
    private readonly walletRepository: Repository<TenantWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    private readonly walletService: WalletService,
    private readonly commissionService: CommissionService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: NotificationEmailService,
  ) {}

  /**
   * Create a payable record when payment is confirmed
   * 
   * Called after payment webhook confirmed or cash confirmation.
   * Calculates: gross_amount, platform_fee (3%), provider_fee, net_payable
   * 
   * @param orderId Order ID
   * @param tenantId Tenant ID
   * @param method Payment method (CASH, MOBILE_MONEY)
   * @returns Payable tracking record
   */
  async createMerchantPayable(
    orderId: string,
    tenantId: string,
    method: 'CASH' | 'MOBILE_MONEY',
  ): Promise<any> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment_status !== PaymentStatusEnum.PAID) {
      throw new BadRequestException('Order payment is not confirmed');
    }

    // Calculate fees
    const grossAmount = order.total_amount;
    const platformFeeRate = 0.03; // 3% platform fee per spec
    const platformFee = Math.round(grossAmount * platformFeeRate);
    const providerFee = method === 'MOBILE_MONEY' ? Math.round(grossAmount * 0.01) : 0; // 1% provider fee for mobile money
    const netPayable = grossAmount - platformFee - providerFee;

    // Credit wallet with net payable
    const { wallet } = await this.walletService.credit(
      tenantId,
      netPayable,
      LedgerSourceEnum.PAYMENT,
      orderId,
      `Payment for order ${order.order_code}: gross=${grossAmount}, platform_fee=${platformFee}, provider_fee=${providerFee}`,
    );

    // Log platform fee as debit from merchant
    if (platformFee > 0) {
      await this.ledgerRepository.save(
        this.ledgerRepository.create({
          tenant_id: tenantId,
          type: LedgerEntryTypeEnum.DEBIT,
          reference: `platform_fee_${orderId}`,
          amount: platformFee,
          description: `Platform fee for order ${order.order_code}`,
          source: LedgerSourceEnum.PAYMENT,
          status: LedgerStatusEnum.COMPLETED,
        } as any),
      );
    }

    // Log provider fee if applicable
    if (providerFee > 0) {
      await this.ledgerRepository.save(
        this.ledgerRepository.create({
          tenant_id: tenantId,
          type: LedgerEntryTypeEnum.DEBIT,
          reference: `provider_fee_${orderId}`,
          amount: providerFee,
          description: `Provider fee (mobile money) for order ${order.order_code}`,
          source: LedgerSourceEnum.PAYMENT,
          status: LedgerStatusEnum.COMPLETED,
        } as any),
      );
    }

    // Record commission
    try {
      await this.commissionService.recordCommission(orderId, tenantId);
    } catch (error) {
      this.logger.warn(`Failed to record commission for order ${orderId}: ${error.message}`);
      // Don't fail the payable creation if commission fails
    }

    this.logger.log(
      `💰 Payable created for order ${order.order_code}: gross=${grossAmount}, net=${netPayable}`,
    );

    // Emit settlement initiated event
    try {
      this.notificationsService.notifySettlementInitiated(tenantId, {
        id: `payable_${orderId}`,
        amount: netPayable,
        payment_method: method,
        created_at: new Date(),
      });
    } catch (notifyError) {
      this.logger.warn(`Failed to emit settlement notification: ${notifyError.message}`);
    }

    return {
      orderId,
      tenantId,
      grossAmount,
      platformFee,
      providerFee,
      netPayable,
      walletBalance: wallet.available_balance,
      status: 'pending_settlement',
    };
  }

  /**
   * Get settlement summary for tenant
   * 
   * Returns:
   * - Total pending settlement
   * - Settled amounts
   * - Failed settlement attempts
   * - Last settlement date
   * 
   * @param tenantId Tenant ID
   * @returns Settlement summary
   */
  async getSettlementSummary(tenantId: string): Promise<any> {
    // Get wallet
    const wallet = await this.walletRepository.findOne({
      where: { tenant_id: tenantId },
    });

    // Get pending payouts
    const pendingPayouts = await this.payoutRepository.find({
      where: { tenant_id: tenantId, status: PayoutStatusEnum.PENDING },
    });

    // Get successful payouts
    const successfulPayouts = await this.payoutRepository.find({
      where: { tenant_id: tenantId, status: PayoutStatusEnum.SUCCESSFUL },
    });

    // Get failed payouts
    const failedPayouts = await this.payoutRepository.find({
      where: { tenant_id: tenantId, status: PayoutStatusEnum.FAILED },
    });

    // Calculate totals
    const pendingTotal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const settledTotal = successfulPayouts.reduce((sum, p) => sum + p.amount, 0);
    const failedTotal = failedPayouts.reduce((sum, p) => sum + p.amount, 0);

    // Get last successful settlement
    const lastSettled = successfulPayouts.length > 0
      ? new Date(Math.max(...successfulPayouts.map(p => new Date(p.created_at).getTime())))
      : null;

    return {
      wallet: {
        available_balance: wallet?.available_balance || 0,
        pending_balance: wallet?.pending_balance || 0,
      },
      settlement: {
        pending_amount: pendingTotal,
        settled_amount: settledTotal,
        failed_amount: failedTotal,
        pending_count: pendingPayouts.length,
        successful_count: successfulPayouts.length,
        failed_count: failedPayouts.length,
        last_settled_at: lastSettled,
      },
    };
  }

  /**
   * Get transaction history for payment dashboard
   * 
   * Returns paginated list of orders with payment status
   * Filter by date range, payment method, status
   * 
   * @param tenantId Tenant ID
   * @param filters Query filters
   * @returns Paginated transaction list
   */
  async getTransactionHistory(
    tenantId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      method?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    data: any[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { startDate, endDate, method, limit = 20, offset = 0 } = filters;

    let query = this.orderRepository
      .createQueryBuilder('order')
      .where('order.tenant_id = :tenantId', { tenantId })
      .andWhere('order.payment_status = :paidStatus', { paidStatus: PaymentStatusEnum.PAID });

    // Filter by date range
    if (startDate) {
      query = query.andWhere('order.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query = query.andWhere('order.created_at <= :endDate', { endDate });
    }

    // Filter by payment method
    if (method) {
      query = query.andWhere('order.payment_method = :method', { method });
    }

    // Total count for pagination
    const total = await query.getCount();

    // Fetch paginated results
    const orders = await query
      .orderBy('order.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    // Enrich with commission and ledger data
    const data = await Promise.all(
      orders.map(async (order) => {
        const commission = await this.commissionRepository.findOne({
          where: { order_id: order.id },
        });

        return {
          id: order.id,
          order_code: order.order_code,
          created_at: order.created_at,
          total_amount: order.total_amount,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          commission: commission?.amount || 0,
          net_amount: order.total_amount - (commission?.amount || 0),
          table_number: order.table_number,
          table_id: order.table_id,
        };
      }),
    );

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get settlement records (past payouts)
   * 
   * @param tenantId Tenant ID
   * @param limit Limit results
   * @param offset Offset for pagination
   * @returns List of settlement records
   */
  async getSettlementRecords(
    tenantId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{
    data: any[];
    total: number;
  }> {
    const [payouts, total] = await this.payoutRepository.findAndCount({
      where: { tenant_id: tenantId },
      relations: ['tenant_payment_account'],
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data = payouts.map(p => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      destination: p.tenant_payment_account?.network,
      destination_number: p.tenant_payment_account?.momo_number,
      provider_ref: p.provider_ref,
      created_at: p.created_at,
    }));

    return { data, total };
  }

  /**
   * Get daily summary for revenue dashboard
   * 
   * Returns aggregated data by date
   * 
   * @param tenantId Tenant ID
   * @param days Number of days to look back
   * @returns Daily summaries
   */
  async getDailySummary(tenantId: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.orderRepository.find({
      where: {
        tenant_id: tenantId,
        payment_status: PaymentStatusEnum.PAID,
        created_at: MoreThanOrEqual(startDate),
      },
    });

    // Group by date
    const grouped: { [key: string]: any } = {};

    for (const order of orders) {
      const dateKey = new Date(order.created_at).toISOString().split('T')[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          total_orders: 0,
          cash_orders: 0,
          momo_orders: 0,
          total_revenue: 0,
          cash_revenue: 0,
          momo_revenue: 0,
          total_fees: 0,
        };
      }

      grouped[dateKey].total_orders += 1;
      grouped[dateKey].total_revenue += order.total_amount;

      if (order.payment_method === 'CASH') {
        grouped[dateKey].cash_orders += 1;
        grouped[dateKey].cash_revenue += order.total_amount;
      } else {
        grouped[dateKey].momo_orders += 1;
        grouped[dateKey].momo_revenue += order.total_amount;
      }

      // Add commission as fee
      const commission = await this.commissionRepository.findOne({
        where: { order_id: order.id },
      });
      if (commission) {
        grouped[dateKey].total_fees += commission.amount;
      }
    }

    return Object.values(grouped).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Notify settlement completion
   * 
   * Called when payout is confirmed to merchant account
   * 
   * @param tenantId Tenant ID
   * @param payout Payout details
   */
  async notifySettlementCompleted(
    tenantId: string,
    payout: {
      id: string;
      amount: number;
      reference: string;
      destination: string;
    },
  ): Promise<void> {
    try {
      this.notificationsService.notifySettlementCompleted(tenantId, {
        id: payout.id,
        amount: payout.amount,
        reference: payout.reference,
        destination: payout.destination,
        completed_at: new Date(),
      });
      this.logger.log(`Settlement completed notification sent for payout ${payout.id}`);

      // Send settlement completed email to merchant (fire-and-forget)
      // NOTE: Email sent with tenant owner information
      // This provides a durable fallback notification for settlement completion
      const tenant = await this.walletRepository.manager.getRepository('Tenant').findOne({
        where: { id: tenantId },
      });

      if (tenant?.owner_email) {
        this.emailService.sendSettlementCompletedEmail(
          tenant.owner_email,
          tenant.owner_id,
          tenantId,
          payout.id,
          {
            settlementAmount: (payout.amount / 100).toFixed(2),
            settlementDate: new Date().toLocaleDateString(),
            reference: payout.reference,
            destination: payout.destination,
            restaurantName: tenant.name,
          },
        ).catch(err => this.logger.error('Failed to send settlement email:', err));
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send settlement completed notification: ${error.message}`,
      );
    }
  }

  /**
   * Get all settlements across all restaurants (platform-wide, admin only)
   */
  async getAllSettlementsPlatformWide(
    filters?: {
      tenantId?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    },
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ settlements: Payout[]; total: number }> {
    let query = this.payoutRepository.createQueryBuilder('payout');

    if (filters?.tenantId) {
      query = query.andWhere('payout.tenant_id = :tenantId', {
        tenantId: filters.tenantId,
      });
    }

    if (filters?.status) {
      query = query.andWhere('payout.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.fromDate) {
      query = query.andWhere('payout.created_at >= :fromDate', {
        fromDate: filters.fromDate,
      });
    }

    if (filters?.toDate) {
      query = query.andWhere('payout.created_at <= :toDate', {
        toDate: filters.toDate,
      });
    }

    const total = await query.getCount();

    const settlements = await query
      .orderBy('payout.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    return { settlements, total };
  }

  /**
   * Get settlement details
   */
  async getSettlementDetail(id: string): Promise<Payout> {
    const settlement = await this.payoutRepository
      .createQueryBuilder('payout')
      .where('payout.id = :id', { id })
      .getOne();

    if (!settlement) {
      throw new NotFoundException(`Settlement ${id} not found`);
    }

    return settlement;
  }

  /**
   * Get settlement statistics
   */
  async getSettlementStats(
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    pending: number;
    successful: number;
    failed: number;
    totalAmount: number;
  }> {
    const baseQuery = this.payoutRepository
      .createQueryBuilder('payout')
      .where('payout.created_at >= :fromDate', { fromDate })
      .andWhere('payout.created_at <= :toDate', { toDate });

    const pending = await baseQuery
      .clone()
      .andWhere('payout.status = :status', { status: PayoutStatusEnum.PENDING })
      .getCount();

    const successful = await baseQuery
      .clone()
      .andWhere('payout.status = :status', { status: PayoutStatusEnum.SUCCESSFUL })
      .getCount();

    const failed = await baseQuery
      .clone()
      .andWhere('payout.status = :status', { status: PayoutStatusEnum.FAILED })
      .getCount();

    const amountResult = await baseQuery
      .clone()
      .select('SUM(payout.amount)', 'totalAmount')
      .getRawOne();

    const totalAmount = parseInt(amountResult?.totalAmount || 0, 10);

    return {
      pending,
      successful,
      failed,
      totalAmount,
    };
  }

  /**
   * Get pending settlement count
   */
  async getPendingSettlementCount(): Promise<number> {
    return this.payoutRepository.count({
      where: { status: PayoutStatusEnum.PENDING },
    });
  }

  /**
   * Get successful settlement count
   */
  async getSuccessfulSettlementCount(): Promise<number> {
    return this.payoutRepository.count({
      where: { status: PayoutStatusEnum.SUCCESSFUL },
    });
  }

  /**
   * Get failed settlement count
   */
  async getFailedSettlementCount(): Promise<number> {
    return this.payoutRepository.count({
      where: { status: PayoutStatusEnum.FAILED },
    });
  }

  /**
   * Retry a failed settlement
   *
   * Allows admin to retry settlement/payout that previously failed.
   * Only failed settlements within the last 24 hours and below max retry limit can be retried.
   *
   * @async
   * @param {string} id - Settlement/payout ID
   * @param {string} reason - Optional reason for retry
   * @param {string} adminUserId - Admin user ID initiating the retry
   * @returns {Promise<Payout>} Updated payout record with status back to PENDING
   * @throws {NotFoundException} If settlement not found
   * @throws {BadRequestException} If settlement is not in FAILED status or outside retry window
   */
  async retryFailedSettlement(
    id: string,
    reason?: string,
    adminUserId?: string,
  ): Promise<Payout> {
    // Get the settlement
    const settlement = await this.payoutRepository.findOne({
      where: { id },
      relations: ['tenant', 'tenant_payment_account'],
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement ${id} not found`);
    }

    // Validate settlement is FAILED
    if (settlement.status !== PayoutStatusEnum.FAILED) {
      throw new BadRequestException(
        `Can only retry failed settlements. Current status: ${settlement.status}`,
      );
    }

    // Check 24h window from creation
    const createdTime = new Date(settlement.created_at).getTime();
    const nowTime = new Date().getTime();
    const hoursSinceCreation = (nowTime - createdTime) / (1000 * 60 * 60);

    if (hoursSinceCreation > 24) {
      throw new BadRequestException(
        'Settlement can only be retried within 24 hours of creation. ' +
        'Contact finance team for manual handling.',
      );
    }

    // Reset status to PENDING for reprocessing
    settlement.status = PayoutStatusEnum.PENDING;

    // Save updated settlement
    const updatedSettlement = await this.payoutRepository.save(settlement);

    // Log the retry action (audit logging happens in controller)
    this.logger.log(
      `[SettlementService] Settlement ${id} retried by admin ${adminUserId}. Reason: ${reason || 'No reason provided'}`,
    );

    // Emit event for background jobs to pick up
    // Note: If you have an EventEmitter service, emit event here
    // Example: this.eventEmitter.emit('settlement.retry', {id, updatedSettlement});

    return updatedSettlement;
  }
}
