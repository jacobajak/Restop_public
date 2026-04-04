import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEvent, PaymentEventTypeEnum } from '../entities/payment-event.entity';
import { PaymentTransaction } from '../entities/payment.entity';

/**
 * Webhook Verification Service (Corrected)
 * 
 * Validates webhook delivery and processes orphaned transactions
 */
@Injectable()
export class WebhookVerificationService {
  private readonly logger = new Logger(WebhookVerificationService.name);

  constructor(
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepository: Repository<PaymentEvent>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
  ) {}

  /**
   * Main webhook verification job
   */
  async verifyWebhookDelivery(): Promise<{
    verified: number;
    recovered: number;
    failed: number;
    alertThreshold: boolean;
    failureRate: number;
  }> {
    const stats = { verified: 0, recovered: 0, failed: 0, alertThreshold: false, failureRate: 0 };

    try {
      this.logger.log('🔗 Webhook verification job starting...');

      // Find transactions >10 minutes old
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const potentialOrphanedTxns = await this.paymentRepository.find({
        where: { created_at: tenMinutesAgo },
      });

      this.logger.debug(`Found ${potentialOrphanedTxns.length} transactions > 10 min old`);

      // Check each transaction for webhook receipt
      for (const txn of potentialOrphanedTxns) {
        const webhookEvent = await this.paymentEventRepository.findOne({
          where: { order_id: txn.order_id, event_type: PaymentEventTypeEnum.WEBHOOK_RECEIVED },
        });

        if (!webhookEvent) {
          // Webhook never arrived - check with provider
          const providerStatus = await this.verifyTransactionWithProvider(txn);
          
          if (providerStatus && providerStatus.success) {
            await this.manuallyCompleteTransaction(txn);
            stats.recovered++;
            this.logger.log(`✅ Recovered orphaned transaction ${txn.id}`);
          } else {
            stats.failed++;
          }
        } else {
          stats.verified++;
        }
      }

      // Check webhook reliability
      const reliability = await this.getWebhookReliabilityMetrics();
      stats.alertThreshold = reliability.failureRate > 0.1;
      stats.failureRate = reliability.failureRate;

      return stats;
    } catch (error: any) {
      this.logger.error(`❌ Webhook verification error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify transaction status with provider APIs
   */
  private async verifyTransactionWithProvider(_txn: PaymentTransaction): Promise<{
    success: boolean;
  }> {
    try {
      // For now, return generic success (actual implementation would query provider APIs)
      // Real implementation needs proper Paypack/Flutterwave API integration
      return { success: false };
    } catch (error: any) {
      return { success: false };
    }
  }

  /**
   * Manually complete transaction after webhook recovery
   */
  private async manuallyCompleteTransaction(txn: PaymentTransaction): Promise<void> {
    try {
      // Create recovery records
      await this.paymentEventRepository.save({
        order_id: txn.order_id,
        event_type: PaymentEventTypeEnum.WEBHOOK_RECEIVED,
        description: 'Manual webhook recovery via provider API',
        event_payload: { recovered: true, recoveredAt: new Date() },
      });

      await this.paymentEventRepository.save({
        order_id: txn.order_id,
        event_type: PaymentEventTypeEnum.VERIFIED,
        description: 'Transaction verified after webhook recovery',
        event_payload: { verifiedAt: new Date(), method: 'webhook_recovery' },
      });
    } catch (error: any) {
      this.logger.error(`❌ Error completing transaction ${txn.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate webhook reliability metrics
   */
  private async getWebhookReliabilityMetrics(): Promise<{
    failureRate: number;
    consecutiveFailures: number;
    lastSuccessfulWebhookTime: Date | null;
  }> {
    try {
      const recentWindow = new Date(Date.now() - 60 * 60 * 1000);
      const allWebhooks = await this.paymentEventRepository.find({
        where: { event_type: PaymentEventTypeEnum.WEBHOOK_RECEIVED, created_at: recentWindow },
        order: { created_at: 'DESC' },
        take: 100,
      });

      if (allWebhooks.length === 0) {
        return { failureRate: 0, consecutiveFailures: 0, lastSuccessfulWebhookTime: null };
      }

      let failureCount = 0;
      let consecutiveFailures = 0;
      let lastSuccessfulTime: Date | null = null;

      for (const webhook of allWebhooks) {
        const verified = await this.paymentEventRepository.findOne({
          where: { order_id: webhook.order_id, event_type: PaymentEventTypeEnum.VERIFIED },
        });

        if (!verified) {
          failureCount++;
          consecutiveFailures++;
        } else {
          if (!lastSuccessfulTime) lastSuccessfulTime = webhook.created_at;
          consecutiveFailures = 0;
        }
      }

      return {
        failureRate: failureCount / allWebhooks.length,
        consecutiveFailures,
        lastSuccessfulWebhookTime: lastSuccessfulTime,
      };
    } catch (error: any) {
      this.logger.error(`Webhook reliability check failed: ${error.message}`);
      return { failureRate: 0, consecutiveFailures: 0, lastSuccessfulWebhookTime: null };
    }
  }
}
