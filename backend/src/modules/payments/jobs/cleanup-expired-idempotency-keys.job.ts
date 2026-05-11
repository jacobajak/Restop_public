import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from '../services/idempotency.service';

/**
 * CleanupExpiredIdempotencyKeysJob
 * 
 * Scheduled job to clean up expired idempotency keys from the database.
 * 
 * Runs daily at 2:00 AM UTC to minimize impact on production traffic.
 * Deletes idempotency keys that:
 * - Have expired_at < now
 * - Have status = SUCCESS (keeps FAILED for audit trail and PROCESSING as a safety measure)
 * 
 * Prevents table bloat and reduces memory usage over time.
 */
@Injectable()
export class CleanupExpiredIdempotencyKeysJob {
  private readonly logger = new Logger(CleanupExpiredIdempotencyKeysJob.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanup() {
    const startTime = Date.now();
    this.logger.log('🔄 Starting cleanup of expired idempotency keys...');

    try {
      const deletedCount = await this.idempotencyService.cleanupExpiredKeys();
      
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Cleaned up ${deletedCount} expired idempotency keys (${duration}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to cleanup expired idempotency keys: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manual trigger for cleanup (for testing)
   * Can be called via an admin endpoint if needed
   */
  async triggerManualCleanup(): Promise<number> {
    this.logger.log('🔄 Manual cleanup of expired idempotency keys triggered...');
    return this.idempotencyService.cleanupExpiredKeys();
  }
}
