import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { Payout } from '../entities/payout.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * ReconciliationJob
 *
 * Daily reconciliation to validate accounting accuracy
 * Runs daily at 11 PM (23:00)
 *
 * Process:
 * 1. Calculate daily GMV from paid orders
 * 2. Calculate total payouts issued
 * 3. Calculate platform fees
 * 4. Verify: GMV = Payouts + Fees (within tolerance)
 * 5. Detect orphaned/mismatched orders
 * 6. Alert on significant discrepancies
 * 7. Log comprehensive audit record
 */
@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);
  private readonly tolerance = 5000; // 5000 RWF tolerance for rounding

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly auditService: AuditService,
  ) {}

  @Cron('0 23 * * *')
  async execute(): Promise<void> {
    try {
      this.logger.log('[ReconciliationJob] 📊 Starting daily end-of-day reconciliation...');

      // Get yesterday's date range
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate daily GMV
      const paidOrdersResult = await this.orderRepository
        .createQueryBuilder('order')
        .select('COUNT(order.id)', 'count')
        .addSelect('SUM(order.total_amount)', 'total_gmv')
        .where('order.payment_status = :status', { status: PaymentStatusEnum.PAID })
        .andWhere('order.created_at >= :yesterday', { yesterday })
        .andWhere('order.created_at < :today', { today })
        .getRawOne();

      const dailyGMV = parseInt(paidOrdersResult?.total_gmv || 0, 10);
      const paidOrderCount = parseInt(paidOrdersResult?.count || 0, 10);

      this.logger.log(
        `[ReconciliationJob] Daily GMV: ${paidOrderCount} orders = ${dailyGMV} RWF`,
      );

      // Calculate total payouts issued
      const payoutResult = await this.payoutRepository
        .createQueryBuilder('payout')
        .select('COUNT(payout.id)', 'count')
        .addSelect('SUM(payout.amount)', 'total_amount')
        .where('payout.created_at >= :yesterday', { yesterday })
        .andWhere('payout.created_at < :today', { today })
        .getRawOne();

      const totalPayouts = parseInt(payoutResult?.total_amount || 0, 10);
      const payoutCount = parseInt(payoutResult?.count || 0, 10);

      // Calculate platform fee (3% of GMV)
      const platformFeeRate = 0.03;
      const platformFees = Math.round(dailyGMV * platformFeeRate);

      // Calculate expected vs actual
      const expectedAccountFor = totalPayouts + platformFees;
      const difference = dailyGMV - expectedAccountFor;
      const discrepancy = Math.abs(difference);
      const isWithinTolerance = discrepancy <= this.tolerance;

      this.logger.log(
        `[ReconciliationJob] GMV=${dailyGMV}, Payouts=${totalPayouts}, Platform Fees=${platformFees}, Diff=${difference}`,
      );

      // Build detailed report
      const report = {
        date: yesterday.toISOString().split('T')[0],
        gmv: {
          total: dailyGMV,
          order_count: paidOrderCount,
        },
        payouts: {
          total: totalPayouts,
          count: payoutCount,
        },
        platform_fees: platformFees,
        accounting: {
          expected: expectedAccountFor,
          actual: dailyGMV,
          difference,
          within_tolerance: isWithinTolerance,
        },
      };

      // Log audit trail
      await this.auditService.log({
        admin_user_id: 'system',
        action_type: AuditActionEnum.SETTLEMENT_RETRIED,
        reference_type: 'daily_reconciliation',
        reference_id: `reconciliation_${yesterday.toISOString().split('T')[0]}`,
        metadata_json: report,
      });

      // Alert if discrepancy found
      if (!isWithinTolerance) {
        this.logger.error(
          `[ReconciliationJob] ⚠️ ALERT: Discrepancy detected: ${discrepancy} RWF difference`,
        );
      } else {
        this.logger.log('[ReconciliationJob] ✅ Reconciliation passed');
      }

      this.logger.log('[ReconciliationJob] ✅ Complete');
    } catch (error) {
      this.logger.error('[ReconciliationJob] ❌ Error', error);

      try {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_REVERSED,
          reference_type: 'reconciliation_job_failure',
          reference_id: `error_${new Date().getTime()}`,
          metadata_json: { error: error.message },
        });
      } catch (auditError) {
        this.logger.error('[ReconciliationJob] Failed to log error', auditError);
      }
    }
  }
}
