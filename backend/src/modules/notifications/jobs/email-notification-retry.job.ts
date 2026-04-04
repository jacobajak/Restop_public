import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationEmailService } from '../services/notification-email.service';
import { NotificationHistoryService } from '../services/notification-history.service';

/**
 * Email Notification Retry Job
 * 
 * Scheduled job that runs every 15 minutes to retry failed email deliveries.
 * 
 * Handles:
 * - Retrying emails that failed with exponential backoff
 * - Respecting max retry attempts
 * - Logging failures for support
 */
@Injectable()
export class EmailNotificationRetryJob {
  private readonly logger = new Logger(EmailNotificationRetryJob.name);

  constructor(
    private readonly notificationEmailService: NotificationEmailService,
    private readonly historyService: NotificationHistoryService,
  ) {}

  /**
   * Retry failed emails
   * Runs every 15 minutes
   */
  @Cron('*/15 * * * *')
  async handleEmailRetries(): Promise<void> {
    try {
      this.logger.debug('Starting email retry job...');

      const successCount = await this.notificationEmailService.retryFailedEmails();

      if (successCount > 0) {
        this.logger.log(
          `Email retry job completed: ${successCount} emails resent`,
        );
      } else {
        this.logger.debug('No failed emails to retry');
      }
    } catch (error) {
      this.logger.error(`Email retry job failed: ${error.message}`);
    }
  }

  /**
   * Cleanup old notification records
   * Runs daily at 2 AM
   */
  @Cron('0 2 * * *')
  async handleNotificationCleanup(): Promise<void> {
    try {
      this.logger.debug('Starting notification cleanup job...');

      // Clean up sent notifications older than 90 days
      const deletedCount = await this.historyService.cleanupOldNotifications(90);

      if (deletedCount > 0) {
        this.logger.log(
          `Notification cleanup completed: ${deletedCount} old records deleted`,
        );
      } else {
        this.logger.debug('No old notifications to clean up');
      }
    } catch (error) {
      this.logger.error(`Notification cleanup job failed: ${error.message}`);
    }
  }
}
