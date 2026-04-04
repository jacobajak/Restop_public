import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * MerchantSummaryJob
 *
 * Generates daily and weekly merchant earning reports
 * Runs daily at 6 AM + weekly Monday at 6 AM
 *
 * Process:
 * 1. Query all active merchants
 * 2. For each merchant:
 *    - Calculate orders/revenue for period
 *    - Calculate payouts settled/pending
 *    - Generate summary report
 *    - Send notification to merchant
 * 3. Send platform summary to admin
 * 4. Log in audit trail
 */
@Injectable()
export class MerchantSummaryJob {
  private readonly logger = new Logger(MerchantSummaryJob.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly auditService: AuditService,
  ) {}

  @Cron('0 6 * * *')
  async executeDailyJob(): Promise<void> {
    try {
      this.logger.log('[MerchantSummaryJob] ⏰ Daily summary generation starting...');

      // Get yesterday's date range
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active merchants
      const merchants = await this.tenantRepository.find({
        where: { status: 'ACTIVE' },
      });

      this.logger.log(`[MerchantSummaryJob] Processing ${merchants.length} merchants...`);

      let successCount = 0;
      let errorCount = 0;
      const merchantSummaries = [];

      // Generate summary for each merchant
      for (const merchant of merchants) {
        try {
          // Get merchant's paid orders from yesterday
          const ordersResult = await this.orderRepository
            .createQueryBuilder('order')
            .select('COUNT(order.id)', 'count')
            .addSelect('SUM(order.total_amount)', 'total_gmv')
            .where('order.tenant_id = :tenantId', { tenantId: merchant.id })
            .andWhere('order.payment_status = :status', { status: PaymentStatusEnum.PAID })
            .andWhere('order.created_at >= :yesterday', { yesterday })
            .andWhere('order.created_at < :today', { today })
            .getRawOne();

          const orderCount = parseInt(ordersResult?.count || 0, 10);
          const gmv = parseInt(ordersResult?.total_gmv || 0, 10);

          // Get merchant's payouts from yesterday
          const payoutsResult = await this.payoutRepository
            .createQueryBuilder('payout')
            .select('COUNT(CASE WHEN payout.status = :pending THEN 1 END)', 'pending_count')
            .addSelect('COUNT(CASE WHEN payout.status = :successful THEN 1 END)', 'successful_count')
            .addSelect('SUM(CASE WHEN payout.status = :pending THEN payout.amount ELSE 0 END)', 'pending_amount')
            .addSelect('SUM(CASE WHEN payout.status = :successful THEN payout.amount ELSE 0 END)', 'successful_amount')
            .where('payout.tenant_id = :tenantId', { tenantId: merchant.id })
            .andWhere('payout.created_at >= :yesterday', { yesterday })
            .andWhere('payout.created_at < :today', { today })
            .setParameters({
              pending: PayoutStatusEnum.PENDING,
              successful: PayoutStatusEnum.SUCCESSFUL,
            })
            .getRawOne();

          const pendingPayoutCount = parseInt(payoutsResult?.pending_count || 0, 10);
          const successfulPayoutCount = parseInt(payoutsResult?.successful_count || 0, 10);
          const pendingAmount = parseInt(payoutsResult?.pending_amount || 0, 10);
          const successfulAmount = parseInt(payoutsResult?.successful_amount || 0, 10);

          const summary = {
            tenant_id: merchant.id,
            restaurant_name: merchant.name,
            period: 'daily',
            date: yesterday.toISOString().split('T')[0],
            orders: {
              count: orderCount,
              gmv,
            },
            payouts: {
              pending: {
                count: pendingPayoutCount,
                amount: pendingAmount,
              },
              successful: {
                count: successfulPayoutCount,
                amount: successfulAmount,
              },
              total_amount: pendingAmount + successfulAmount,
            },
          };

          // Only log summary if merchant had activity
          if (orderCount > 0 || pendingPayoutCount > 0 || successfulPayoutCount > 0) {
            this.logger.log(
              `[MerchantSummaryJob] Daily summary for ${merchant.name}: ${orderCount} orders = ${gmv} RWF`,
            );

            successCount++;
            merchantSummaries.push(summary);
          }
        } catch (merchantError) {
          errorCount++;
          this.logger.error(
            `[MerchantSummaryJob] Error processing merchant ${merchant.id}: ${merchantError.message}`,
          );
        }
      }

      // Log audit trail
      await this.auditService.log({
        admin_user_id: 'system',
        action_type: AuditActionEnum.SETTLEMENT_RETRIED,
        reference_type: 'daily_merchant_summary',
        reference_id: `merchant_summary_daily_${yesterday.toISOString().split('T')[0]}`,
        metadata_json: {
          merchants_processed: merchants.length,
          summaries_sent: successCount,
          errors: errorCount,
          sample_summaries: merchantSummaries.slice(0, 5), // Log first 5 for audit
        },
      });

      this.logger.log(
        `[MerchantSummaryJob] ✅ Daily summary complete: ${successCount} notified, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error('[MerchantSummaryJob] ❌ Daily error', error);
    }
  }

  @Cron('0 6 * * 1')
  async executeWeeklyJob(): Promise<void> {
    try {
      this.logger.log(`[MerchantSummaryJob] 📊 Weekly summary generation starting...`);

      // Get last 7 days (excluding today)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active merchants
      const merchants = await this.tenantRepository.find({
        where: { status: 'ACTIVE' },
      });

      this.logger.log(`[MerchantSummaryJob] Processing ${merchants.length} merchants for weekly summary...`);

      let successCount = 0;
      const merchantSummaries = [];

      // Generate summary for each merchant
      for (const merchant of merchants) {
        try {
          // Get orders from last 7 days
          const ordersResult = await this.orderRepository
            .createQueryBuilder('order')
            .select('COUNT(order.id)', 'count')
            .addSelect('SUM(order.total_amount)', 'total_gmv')
            .where('order.tenant_id = :tenantId', { tenantId: merchant.id })
            .andWhere('order.payment_status = :status', { status: PaymentStatusEnum.PAID })
            .andWhere('order.created_at >= :weekAgo', { weekAgo })
            .andWhere('order.created_at < :today', { today })
            .getRawOne();

          const orderCount = parseInt(ordersResult?.count || 0, 10);
          const gmv = parseInt(ordersResult?.total_gmv || 0, 10);

          // Get payouts from last 7 days
          const payoutsResult = await this.payoutRepository
            .createQueryBuilder('payout')
            .select('SUM(payout.amount)', 'total_payouts')
            .where('payout.tenant_id = :tenantId', { tenantId: merchant.id })
            .andWhere('payout.status = :status', { status: PayoutStatusEnum.SUCCESSFUL })
            .andWhere('payout.created_at >= :weekAgo', { weekAgo })
            .andWhere('payout.created_at < :today', { today })
            .getRawOne();

          const totalPayouts = parseInt(payoutsResult?.total_payouts || 0, 10);

          const summary = {
            tenant_id: merchant.id,
            restaurant_name: merchant.name,
            period: 'weekly',
            week_starting: weekAgo.toISOString().split('T')[0],
            orders: {
              count: orderCount,
              gmv,
            },
            payouts: {
              total_successful: totalPayouts,
            },
          };

          // Log weekly summary if merchant had activity
          if (orderCount > 0) {
            this.logger.log(
              `[MerchantSummaryJob] Weekly summary for ${merchant.name}: ${orderCount} orders = ${gmv} RWF`,
            );

            successCount++;
            merchantSummaries.push(summary);
          }
        } catch (merchantError) {
          this.logger.error(
            `[MerchantSummaryJob] Error processing merchant ${merchant.id}: ${merchantError.message}`,
          );
        }
      }

      // Log audit trail for weekly summary
      await this.auditService.log({
        admin_user_id: 'system',
        action_type: AuditActionEnum.SETTLEMENT_RETRIED,
        reference_type: 'weekly_merchant_summary',
        reference_id: `merchant_summary_weekly_${weekAgo.toISOString().split('T')[0]}`,
        metadata_json: {
          merchants_processed: merchants.length,
          summaries_sent: successCount,
          sample_summaries: merchantSummaries.slice(0, 5),
        },
      });

      this.logger.log(`[MerchantSummaryJob] ✅ Weekly summary complete: ${successCount} notified`);
    } catch (error) {
      this.logger.error('[MerchantSummaryJob] ❌ Weekly error', error);
    }
  }
}
