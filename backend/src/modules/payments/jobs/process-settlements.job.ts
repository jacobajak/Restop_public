import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { TenantPaymentAccount } from '../entities/tenant-payment-account.entity';
import { PayoutService } from '../services/payout.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * SettlementProcessingJob
 *
 * Processes pending payouts to verified merchant accounts
 * Runs daily at 8 AM
 *
 * Process:
 * 1. Query all PENDING payouts
 * 2. Verify merchant has verified payment account
 * 3. Initiate transfer via Paypack API
 * 4. Update payout with transaction reference and status
 * 5. Notify merchant of settlement initiation
 * 6. Log audit trail
 */
@Injectable()
export class SettlementProcessingJob {
  private readonly logger = new Logger(SettlementProcessingJob.name);

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(TenantPaymentAccount)
    private readonly paymentAccountRepository: Repository<TenantPaymentAccount>,
    private readonly payoutService: PayoutService,
    private readonly auditService: AuditService,
  ) {}

  @Cron('0 8 * * *')
  async execute(): Promise<void> {
    try {
      this.logger.log('[SettlementProcessingJob] ⏰ Starting settlement processing...');

      // Find all PENDING payouts
      const pendingPayouts = await this.payoutRepository.find({
        where: { status: PayoutStatusEnum.PENDING },
        relations: ['order', 'tenant', 'tenant_payment_account'],
      });

      this.logger.debug(
        `[SettlementProcessingJob] Found ${pendingPayouts.length} pending payouts to process`,
      );

      // Track statistics
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      const processedMerchants: { [tenantId: string]: { amount: number; count: number } } = {};

      // Process each payout
      for (const payout of pendingPayouts) {
        try {
          // Verify merchant has verified payment account
          const verifiedAccount = await this.paymentAccountRepository.findOne({
            where: {
              tenant_id: payout.tenant_id,
              is_verified: true,
              is_default: true,
            },
          });

          if (!verifiedAccount) {
            this.logger.warn(
              `[SettlementProcessingJob] Payout ${payout.id}: No verified payment account for merchant ${payout.tenant_id}, skipping`,
            );
            skipCount++;

            // Log notification about verification requirement
            this.logger.log(
              `[SettlementProcessingJob] Merchant ${payout.tenant_id.substring(0, 8)} needs to verify payment account`,
            );

            continue;
          }

          // Call payout service to initiate the payout
          const result = await this.payoutService.retryPayout(payout.id);

          if (result.status === PayoutStatusEnum.SUCCESSFUL) {
            successCount++;
            this.logger.log(
              `[SettlementProcessingJob] ✅ Payout ${payout.id} successful: ${payout.amount} RWF to ${verifiedAccount.momo_number}`,
            );
          } else if (result.status === PayoutStatusEnum.FAILED) {
            errorCount++;
            this.logger.error(
              `[SettlementProcessingJob] ❌ Payout ${payout.id} failed: ${result.status}`,
            );
          }

          // Aggregate for summary
          if (!processedMerchants[payout.tenant_id]) {
            processedMerchants[payout.tenant_id] = { amount: 0, count: 0 };
          }
          processedMerchants[payout.tenant_id].amount += payout.amount;
          processedMerchants[payout.tenant_id].count += 1;
        } catch (payoutError) {
          errorCount++;
          this.logger.error(
            `[SettlementProcessingJob] Failed to process payout ${payout.id}: ${payoutError.message}`,
          );
        }
      }

      // Log audit trail
      await this.auditService.log({
        admin_user_id: 'system',
        action_type: AuditActionEnum.SETTLEMENT_RETRIED,
        reference_type: 'batch_payout_processing',
        reference_id: `settlements_processed_${new Date().toISOString()}`,
        metadata_json: {
          total_processed: pendingPayouts.length,
          successful: successCount,
          skipped: skipCount,
          errors: errorCount,
          merchant_summary: processedMerchants,
        },
      });

      // Log summary
      this.logger.log(
        `[SettlementProcessingJob] ✅ Completed: ${successCount} processed, ${skipCount} skipped (no verified account), ${errorCount} errors`,
      );

      for (const [tenantId, data] of Object.entries(processedMerchants)) {
        this.logger.log(
          `[SettlementProcessingJob] 💸 Merchant ${tenantId.substring(0, 8)}: ${data.count} payouts = ${data.amount} RWF processed`,
        );
      }
    } catch (error) {
      this.logger.error('[SettlementProcessingJob] ❌ Critical error', error);

      // Log failure for alerting
      try {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_REVERSED,
          reference_type: 'settlement_processing_job_failure',
          reference_id: `error_${new Date().getTime()}`,
          metadata_json: {
            error: error.message,
            stack: error.stack,
          },
        });
      } catch (auditError) {
        this.logger.error('[SettlementProcessingJob] Failed to log error to audit', auditError);
      }
    }
  }
}
