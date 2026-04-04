import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * MerchantPayablesJob
 *
 * Generates daily merchant payables from successful orders
 * Runs daily at midnight (00:00)
 *
 * Process:
 * 1. Query orders from previous day where payment_status = PAID
 * 2. For each paid order, create a Payout record (settlement record)
 * 3. Set status to PENDING (waiting for settlement processor job)
 * 4. Send merchant notifications
 * 5. Log audit trail
 */
@Injectable()
export class MerchantPayablesJob {
  private readonly logger = new Logger(MerchantPayablesJob.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly auditService: AuditService,
  ) {}

  @Cron('0 0 * * *')
  async execute(): Promise<void> {
    try {
      this.logger.log('[MerchantPayablesJob] ⏰ Starting daily payables generation...');

      // Calculate yesterday's date range
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all paid orders from yesterday
      const paidOrders = await this.orderRepository.find({
        where: {
          payment_status: PaymentStatusEnum.PAID,
          created_at: MoreThanOrEqual(yesterday),
          updated_at: LessThan(today),
        },
        relations: ['tenant'],
      });

      this.logger.debug(
        `[MerchantPayablesJob] Found ${paidOrders.length} paid orders from ${yesterday.toISOString()}`,
      );

      // Track statistics
      let successCount = 0;
      let errorCount = 0;
      const merchantPayables: { [tenantId: string]: { amount: number; count: number } } = {};

      // Process each order
      for (const order of paidOrders) {
        try {
          // Create settlement/payout record for this order
          const payout = await this.payoutRepository.findOne({
            where: { order_id: order.id },
          });

          // Skip if payout already created for this order
          if (payout) {
            this.logger.debug(`[MerchantPayablesJob] Payout already exists for order ${order.id}, skipping`);
            continue;
          }

          // Calculate amount to transfer (gross - platform fee)
          const platformFeeRate = 0.03; // 3% platform fee
          const platformFee = Math.round(order.total_amount * platformFeeRate);
          const payoutAmount = order.total_amount - platformFee;

          // Create payout record (settlement pending)
          const newPayout = this.payoutRepository.create({
            order_id: order.id,
            tenant_id: order.tenant_id,
            tenant_payment_account_id: null, // Will be populated when settlement processor runs
            amount: payoutAmount,
            status: PayoutStatusEnum.PENDING,
            created_at: new Date(),
          });

          await this.payoutRepository.save(newPayout);

          successCount++;

          // Aggregate for summary
          if (!merchantPayables[order.tenant_id]) {
            merchantPayables[order.tenant_id] = { amount: 0, count: 0 };
          }
          merchantPayables[order.tenant_id].amount += payoutAmount;
          merchantPayables[order.tenant_id].count += 1;

          this.logger.debug(
            `[MerchantPayablesJob] Created payout for order ${order.order_code}: ${payoutAmount} RWF`,
          );
        } catch (orderError) {
          errorCount++;
          this.logger.error(
            `[MerchantPayablesJob] Failed to create payable for order ${order.id}: ${orderError.message}`,
          );
        }
      }

      // Log audit trail for successful completion
      if (successCount > 0) {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_RETRIED, // Reuse for now
          reference_type: 'batch_settlement_creation',
          reference_id: `merchant_payables_${new Date().toISOString()}`,
          metadata_json: {
            orders_processed: paidOrders.length,
            payables_created: successCount,
            errors: errorCount,
            merchant_summary: merchantPayables,
          },
        });
      }

      this.logger.log(
        `[MerchantPayablesJob] ✅ Completed: ${successCount} payables created, ${errorCount} errors`,
      );

      // Log summary for each merchant
      for (const [tenantId, data] of Object.entries(merchantPayables)) {
        this.logger.log(
          `[MerchantPayablesJob] 💰 Merchant ${tenantId.substring(0, 8)}: ${data.count} orders = ${data.amount} RWF total payout pending`,
        );
      }
    } catch (error) {
      this.logger.error('[MerchantPayablesJob] ❌ Critical error', error);
      
      // Log failure for alerting
      try {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_REVERSED, // Reuse for job failure
          reference_type: 'merchant_payables_job_failure',
          reference_id: `error_${new Date().getTime()}`,
          metadata_json: {
            error: error.message,
            stack: error.stack,
          },
        });
      } catch (auditError) {
        this.logger.error('[MerchantPayablesJob] Failed to log error to audit', auditError);
      }
    }
  }
}
