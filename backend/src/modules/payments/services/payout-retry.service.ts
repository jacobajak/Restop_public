import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';

/**
 * Payout Retry Service (Corrected)
 * 
 * Retries failed payouts with simplified logic matching actual integrations
 */
@Injectable()
export class PayoutRetryService {
  private readonly logger = new Logger(PayoutRetryService.name);
  private retryHistory: Map<string, { attempts: number; lastAttempt: Date }> = new Map();

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    private readonly flutterwaveService: FlutterwaveIntegrationService,
  ) {}

  /**
   * Main retry job - called every 10 minutes
   */
  async retryFailedPayouts(): Promise<{
    retried: number;
    succeeded: number;
    failed: number;
    rateLimited: number;
    permanentlyFailed: number;
  }> {
    const stats = { retried: 0, succeeded: 0, failed: 0, rateLimited: 0, permanentlyFailed: 0 };

    try {
      const failedPayouts = await this.payoutRepository.find({
        where: { status: PayoutStatusEnum.FAILED },
      });

      this.logger.log(`🔄 Found ${failedPayouts.length} failed payouts to retry`);

      for (const payout of failedPayouts) {
        const history = this.retryHistory.get(payout.id);
        
        if (history && history.attempts >= 5) {
          stats.permanentlyFailed++;
          payout.raw_payload = { ...payout.raw_payload, maxRetriesReached: true };
          await this.payoutRepository.save(payout);
          continue;
        }

        if (history && Date.now() - history.lastAttempt.getTime() < 5 * 60 * 1000) {
          continue;
        }

        try {
          const result = await this.attemptPayout(payout);
          
          if (result.success) {
            stats.succeeded++;
            payout.status = PayoutStatusEnum.SUCCESSFUL;
            await this.payoutRepository.save(payout);
            this.retryHistory.delete(payout.id);
            this.logger.log(`✅ Payout ${payout.id} succeeded on retry`);
          } else {
            stats.failed++;
            const attempts = (history?.attempts || 0) + 1;
            this.retryHistory.set(payout.id, { attempts, lastAttempt: new Date() });
            await this.payoutRepository.save(payout);
          }
          
          stats.retried++;
        } catch (error: any) {
          this.logger.error(`❌ Error retrying payout ${payout.id}: ${error.message}`);
          stats.failed++;
        }
      }

      return stats;
    } catch (error: any) {
      this.logger.error(`❌ Error in payout retry job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Attempt a single payout using Flutterwave
   */
  private async attemptPayout(payout: Payout): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await (this.flutterwaveService as any).initiatePayout({
        reference: payout.id,
        amount: payout.amount,
      });
      
      if (result && (result.status === 'success' || result.status === 'completed')) {
        return { success: true };
      }
      
      return { success: false, error: 'Payout not completed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
