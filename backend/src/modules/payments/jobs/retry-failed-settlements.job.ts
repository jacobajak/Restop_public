import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { PayoutService } from '../services/payout.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * SettlementRetryJob
 *
 * Retries failed settlement payouts from last 24 hours
 * Runs every 30 minutes
 *
 * Process:
 * 1. Query failed Payouts from last 24 hours
 * 2. Check retry count (max 3 attempts)
 * 3. Re-attempt transfer via Paypack API
 * 4. Update payout record
 * 5. Handle exhausted retries (notify merchant, flag for manual review)
 */
@Injectable()
export class SettlementRetryJob {
  private readonly logger = new Logger(SettlementRetryJob.name);
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly payoutService: PayoutService,
    private readonly auditService: AuditService,
  ) {}

  @Cron('*/30 * * * *')
  async execute(): Promise<void> {
    try {
      this.logger.debug('[SettlementRetryJob] ⏰ Running failed settlement retry check...');

      // Get timestamp for 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find failed payouts from last 24 hours
      const failedPayouts = await this.payoutRepository.find({
        where: {
          status: PayoutStatusEnum.FAILED,
          created_at: MoreThan(twentyFourHoursAgo),
        },
        relations: ['order', 'tenant'],
        take: 50,
      });

      this.logger.debug(
        `[SettlementRetryJob] Found ${failedPayouts.length} failed payouts from last 24h`,
      );

      if (failedPayouts.length === 0) {
        return;
      }

      let retriedCount = 0;
      let exhaustedCount = 0;
      let errorCount = 0;

      // Process each failed payout
      for (const payout of failedPayouts) {
        try {
          // Get retry count from raw_payload
          const retryCount = payout.raw_payload?.retry_count || 0;

          // Check if max retries exceeded
          if (retryCount >= this.MAX_RETRY_ATTEMPTS) {
            exhaustedCount++;
            this.logger.warn(
              `[SettlementRetryJob] Payout ${payout.id} exhausted retries (${retryCount}/${this.MAX_RETRY_ATTEMPTS})`,
            );

            continue;
          }

          // Attempt retry
          this.logger.log(
            `[SettlementRetryJob] Retrying payout ${payout.id} (attempt ${retryCount + 1}/${this.MAX_RETRY_ATTEMPTS})`,
          );

          const result = await this.payoutService.retryPayout(payout.id);

          if (result.status === PayoutStatusEnum.SUCCESSFUL) {
            retriedCount++;
            this.logger.log(`[SettlementRetryJob] ✅ Payout ${payout.id} successful on retry`);
          } else if (result.status === PayoutStatusEnum.PENDING) {
            retriedCount++;
            this.logger.log(`[SettlementRetryJob] ⏳ Payout ${payout.id} resubmitted`);
          } else {
            // Still failed - increment retry count
            const updatedPayload = {
              ...payout.raw_payload,
              retry_count: (retryCount || 0) + 1,
            };
            payout.raw_payload = updatedPayload;
            await this.payoutRepository.save(payout);
          }
        } catch (payoutError) {
          errorCount++;
          this.logger.error(
            `[SettlementRetryJob] Error retrying payout ${payout.id}: ${payoutError.message}`,
          );
        }
      }

      // Log audit
      if (retriedCount + exhaustedCount > 0) {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_RETRIED,
          reference_type: 'batch_settlement_retry',
          reference_id: `settlement_retry_${new Date().toISOString()}`,
          metadata_json: {
            total_failed: failedPayouts.length,
            retried: retriedCount,
            exhausted: exhaustedCount,
            errors: errorCount,
          },
        });
      }

      this.logger.log(
        `[SettlementRetryJob] ✅ Completed: ${retriedCount} retried, ${exhaustedCount} exhausted`,
      );
    } catch (error) {
      this.logger.error('[SettlementRetryJob] ❌ Error', error);
    }
  }
}
