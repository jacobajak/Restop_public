import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  NotificationHistory,
  NotificationTypeEnum,
  NotificationChannelEnum,
  NotificationStatusEnum,
} from '../entities/notification-history.entity';

/**
 * Notification History Service
 * 
 * Tracks all sent notifications to:
 * - Prevent duplicate emails (same event, same recipient)
 * - Support retry logic for failed emails
 * - Maintain audit trail of all notifications
 * - Respect notification preferences
 * 
 * Key features:
 * - Idempotency (prevent duplicates)
 * - Retry scheduling with exponential backoff
 * - Status tracking (pending, sent, failed, retrying)
 * - Tenant isolation
 */
@Injectable()
export class NotificationHistoryService {
  private readonly logger = new Logger(NotificationHistoryService.name);

  constructor(
    @InjectRepository(NotificationHistory)
    private readonly notificationRepository: Repository<NotificationHistory>,
  ) {}

  /**
   * Create a new notification record
   * Returns existing record if duplicate (idempotency)
   * 
   * @returns notificationId for job reference
   */
  async createNotification(
    tenantId: string,
    userId: string | null,
    recipientEmail: string,
    notificationType: NotificationTypeEnum,
    relatedEntityId: string | null,
    relatedEntityType: string | null,
    idempotencyKey: string,
    subject: string | null = null,
    htmlContent: string | null = null,
    templateVariables: Record<string, any> | null = null,
  ): Promise<{ id: string; isDuplicate: boolean }> {
    try {
      // Check for existing notification with same idempotency key
      const existing = await this.notificationRepository.findOne({
        where: { idempotency_key: idempotencyKey },
      });

      if (existing) {
        this.logger.log(
          `Duplicate notification detected: ${idempotencyKey}, returning existing ID`,
        );
        return { id: existing.id, isDuplicate: true };
      }

      // Create new notification
      const notification = this.notificationRepository.create({
        tenant_id: tenantId,
        user_id: userId,
        recipient_email: recipientEmail,
        notification_type: notificationType,
        channel: NotificationChannelEnum.EMAIL,
        status: NotificationStatusEnum.PENDING,
        related_entity_id: relatedEntityId,
        related_entity_type: relatedEntityType,
        subject,
        html_content: htmlContent,
        attempt_count: 0,
        max_attempts: 3,
        template_variables: templateVariables,
        idempotency_key: idempotencyKey,
      });

      const saved = await this.notificationRepository.save(notification);

      this.logger.log(
        `Created notification: ${saved.id} for ${recipientEmail} (${notificationType})`,
      );

      return { id: saved.id, isDuplicate: false };
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(
    notificationId: string,
    providerResponse?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.notificationRepository.update(notificationId, {
        status: NotificationStatusEnum.SENT,
        sent_at: new Date(),
        provider_response: providerResponse || null,
      });

      this.logger.log(`Marked notification ${notificationId} as sent`);
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as sent: ${error.message}`,
      );
    }
  }

  /**
   * Mark notification as failed and schedule retry
   */
  async markAsFailed(
    notificationId: string,
    errorMessage: string,
  ): Promise<{ shouldRetry: boolean; nextRetryAt: Date | null }> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId },
      });

      if (!notification) {
        this.logger.warn(`Notification not found: ${notificationId}`);
        return { shouldRetry: false, nextRetryAt: null };
      }

      const newAttemptCount = notification.attempt_count + 1;
      const shouldRetry = newAttemptCount < notification.max_attempts;

      // Calculate exponential backoff: 5 min, 15 min, 30 min
      let nextRetryAt: Date | null = null;
      if (shouldRetry) {
        const backoffMinutes = Math.pow(2, newAttemptCount) * 5; // 5, 10, 20...
        nextRetryAt = new Date(Date.now() + backoffMinutes * 60000);
      }

      await this.notificationRepository.update(notificationId, {
        status: shouldRetry ? NotificationStatusEnum.RETRYING : NotificationStatusEnum.FAILED,
        attempt_count: newAttemptCount,
        error_message: errorMessage,
        last_retry_at: new Date(),
        next_retry_at: nextRetryAt,
      });

      this.logger.log(
        `Marked notification ${notificationId} as failed (attempt ${newAttemptCount}/${notification.max_attempts})`,
      );

      return { shouldRetry, nextRetryAt };
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as failed: ${error.message}`,
      );
      return { shouldRetry: false, nextRetryAt: null };
    }
  }

  /**
   * Get pending notifications for retry
   * Returns notifications that:
   * - Status is RETRYING
   * - next_retry_at is in the past
   * - Haven't exceeded max_attempts
   */
  async getPendingRetries(limit: number = 50): Promise<NotificationHistory[]> {
    try {
      const now = new Date();
      const notifications = await this.notificationRepository.find({
        where: [
          {
            status: NotificationStatusEnum.PENDING,
            next_retry_at: LessThan(now),
          },
          {
            status: NotificationStatusEnum.RETRYING,
            next_retry_at: LessThan(now),
          },
        ],
        order: { next_retry_at: 'ASC' },
        take: limit,
      });

      return notifications;
    } catch (error) {
      this.logger.error(`Failed to get pending retries: ${error.message}`);
      return [];
    }
  }

  /**
   * Get notification history for an entity
   * Useful for checking if customer already got notified
   */
  async getHistory(
    tenantId: string,
    relatedEntityId: string,
    notificationType?: NotificationTypeEnum,
  ): Promise<NotificationHistory[]> {
    try {
      const where: any = {
        tenant_id: tenantId,
        related_entity_id: relatedEntityId,
      };

      if (notificationType) {
        where.notification_type = notificationType;
      }

      return await this.notificationRepository.find({
        where,
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get notification history: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get successful notifications sent to a recipient
   */
  async getSentNotifications(
    tenantId: string,
    recipientEmail: string,
    limit: number = 50,
  ): Promise<NotificationHistory[]> {
    try {
      return await this.notificationRepository.find({
        where: {
          tenant_id: tenantId,
          recipient_email: recipientEmail,
          status: NotificationStatusEnum.SENT,
        },
        order: { sent_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get sent notifications: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get failed notifications for audit/support
   */
  async getFailedNotifications(
    tenantId: string,
    limit: number = 100,
  ): Promise<NotificationHistory[]> {
    try {
      return await this.notificationRepository.find({
        where: {
          tenant_id: tenantId,
          status: NotificationStatusEnum.FAILED,
        },
        order: { created_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get failed notifications: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Clean up old notification records
   * Deletes notifications older than specified days
   */
  async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.notificationRepository.delete({
        created_at: LessThan(cutoffDate),
        status: NotificationStatusEnum.SENT, // Only delete successful ones
      });

      this.logger.log(
        `Cleaned up ${result.affected} old notification records`,
      );
      return result.affected || 0;
    } catch (error) {
      this.logger.error(`Failed to cleanup notifications: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    try {
      const total = await this.notificationRepository.count({
        where: { tenant_id: tenantId },
      });

      const sent = await this.notificationRepository.count({
        where: {
          tenant_id: tenantId,
          status: NotificationStatusEnum.SENT,
        },
      });

      const failed = await this.notificationRepository.count({
        where: {
          tenant_id: tenantId,
          status: NotificationStatusEnum.FAILED,
        },
      });

      const pending = await this.notificationRepository.count({
        where: {
          tenant_id: tenantId,
          status: NotificationStatusEnum.PENDING,
        },
      });

      return { total, sent, failed, pending };
    } catch (error) {
      this.logger.error(
        `Failed to get notification statistics: ${error.message}`,
      );
      return { total: 0, sent: 0, failed: 0, pending: 0 };
    }
  }
}
