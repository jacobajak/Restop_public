import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  ProviderWebhookEvent,
  WebhookProviderEnum,
  WebhookEventTypeEnum,
  WebhookProcessingStatusEnum,
} from '../entities/provider-webhook-event.entity';

/**
 * WebhookEventService
 *
 * Manages persistence and retry logic for webhook events from payment providers.
 * Implements dead-letter queue pattern:
 *
 * 1. Webhook received → Store with status=RECEIVED
 * 2. Signature verified → Update to status=PROCESSING
 * 3. Processing succeeds → Update to status=SUCCESS, set processed_at
 * 4. Processing fails → Update to status=FAILED, schedule retry
 * 5. Max retries exceeded → Move to status=DEAD_LETTER for manual review
 *
 * Supports:
 * - Automatic retry scheduling with exponential backoff
 * - Manual webhook replay for admin debugging
 * - Dead-letter queue for failed webhooks
 * - Complete audit trail of all webhook events
 */
@Injectable()
export class WebhookEventService {
  private readonly logger = new Logger(WebhookEventService.name);

  // Retry configuration: retry intervals in minutes
  private readonly RETRY_INTERVALS = [5, 15, 60]; // 5 min, 15 min, 1 hour

  constructor(
    @InjectRepository(ProviderWebhookEvent)
    private webhookEventRepository: Repository<ProviderWebhookEvent>,
  ) {}

  /**
   * Record a webhook event received from provider
   * Initial status is RECEIVED - will be updated after verification
   *
   * @param provider - Payment provider (flutterwave, paypack, etc)
   * @param eventType - Type of event (charge.completed, transfer.failed, etc)
   * @param eventReference - Provider's reference ID (transaction ID, etc)
   * @param payload - Raw webhook payload
   * @param signature - HTTP signature header for verification
   * @returns Persisted webhook event
   */
  async recordWebhookEvent(
    provider: WebhookProviderEnum,
    eventType: WebhookEventTypeEnum,
    eventReference: string,
    payload: Record<string, any>,
    signature?: string,
  ): Promise<ProviderWebhookEvent> {
    try {
      const event = new ProviderWebhookEvent({
        provider,
        event_type: eventType,
        event_reference: eventReference,
        payload_json: payload,
        signature,
        processing_status: WebhookProcessingStatusEnum.RECEIVED,
        retry_count: 0,
        received_at: new Date(),
      });

      const saved = await this.webhookEventRepository.save(event);
      this.logger.debug(
        `Recorded webhook event: ${provider}/${eventType}/${eventReference}`,
      );
      return saved;
    } catch (error) {
      this.logger.error(
        `Error recording webhook event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark webhook event as successfully processed
   * Sets status to SUCCESS and records completion timestamp
   *
   * @param webhookId - ID of webhook event record
   * @returns Updated webhook event
   */
  async markSuccess(webhookId: string): Promise<ProviderWebhookEvent> {
    try {
      const event = await this.webhookEventRepository.findOne({ where: { id: webhookId } });
      if (!event) throw new Error(`Webhook not found: ${webhookId}`);
      
      event.processing_status = WebhookProcessingStatusEnum.SUCCESS;
      event.processed_at = new Date();
      event.last_error = null;
      event.updated_at = new Date();
      
      const updated = await this.webhookEventRepository.save(event);

      this.logger.debug(`Webhook processed successfully: ${webhookId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error marking webhook success: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark webhook event as failed and schedule retry
   * Updates status to FAILED or RETRY_PENDING based on retry count
   * Calculates next retry time using exponential backoff
   *
   * @param webhookId - ID of webhook event record
   * @param errorMessage - Error that occurred during processing
   * @returns Updated webhook event
   */
  async markFailedAndScheduleRetry(
    webhookId: string,
    errorMessage: string,
  ): Promise<ProviderWebhookEvent> {
    try {
      const existing = await this.webhookEventRepository.findOne({
        where: { id: webhookId },
      });

      if (!existing) {
        this.logger.warn(`Webhook not found: ${webhookId}`);
        return null;
      }

      const newRetryCount = existing.retry_count + 1;
      const nextRetryAt = this.calculateNextRetryTime(newRetryCount);

      let newStatus: WebhookProcessingStatusEnum;
      if (newRetryCount >= this.RETRY_INTERVALS.length) {
        // Max retries exceeded - move to dead letter
        newStatus = WebhookProcessingStatusEnum.DEAD_LETTER;
        this.logger.warn(
          `Webhook max retries exceeded, moving to dead-letter: ${webhookId}`,
        );
      } else {
        // Schedule for retry
        newStatus = WebhookProcessingStatusEnum.RETRY_PENDING;
      }

      const updated = await this.webhookEventRepository.save({
        ...existing,
        processing_status: newStatus,
        retry_count: newRetryCount,
        last_error: errorMessage.substring(0, 1000), // Truncate to 1000 chars
        next_retry_at: newStatus === WebhookProcessingStatusEnum.DEAD_LETTER ? null : nextRetryAt,
        updated_at: new Date(),
      });

      this.logger.debug(
        `Webhook marked as failed (retry ${newRetryCount}): ${webhookId}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(`Error marking webhook failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get webhook event by ID
   *
   * @param id - Webhook record ID
   * @returns Webhook event or null if not found
   */
  async getById(id: string): Promise<ProviderWebhookEvent | null> {
    return this.webhookEventRepository.findOne({
      where: { id },
    });
  }

  /**
   * Get webhook event by provider reference
   * Used to check if webhook already processed
   *
   * @param provider - Payment provider
   * @param eventReference - Provider's reference ID
   * @returns Webhook event or null if not found
   */
  async getByReference(
    provider: WebhookProviderEnum,
    eventReference: string,
  ): Promise<ProviderWebhookEvent | null> {
    return this.webhookEventRepository.findOne({
      where: {
        provider,
        event_reference: eventReference,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get webhooks pending retry
   * Called by scheduled retry job to process failed webhooks
   *
   * @param limit - Max records to return
   * @returns List of webhooks ready for retry
   */
  async getPendingRetries(limit: number = 50): Promise<ProviderWebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: [
        {
          processing_status: WebhookProcessingStatusEnum.RETRY_PENDING,
          next_retry_at: LessThan(new Date()),
        },
      ],
      order: { next_retry_at: 'ASC' },
      take: limit,
    });
  }

  /**
   * Get webhooks in dead-letter queue
   * Used by admin dashboard to show webhooks needing manual intervention
   *
   * @param limit - Max records to return
   * @returns List of dead-lettered webhooks
   */
  async getDeadLetterWebhooks(limit: number = 50): Promise<ProviderWebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: { processing_status: WebhookProcessingStatusEnum.DEAD_LETTER },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get failed webhooks for a specific provider
   * Used for monitoring provider issues
   *
   * @param provider - Payment provider
   * @param limit - Max records to return
   * @returns List of failed webhooks from provider
   */
  async getFailedByProvider(
    provider: WebhookProviderEnum,
    limit: number = 50,
  ): Promise<ProviderWebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: [
        {
          provider,
          processing_status: WebhookProcessingStatusEnum.FAILED,
        },
        {
          provider,
          processing_status: WebhookProcessingStatusEnum.DEAD_LETTER,
        },
      ],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Manually replay a failed webhook
   * Admin can retry processing of dead-lettered webhooks
   * Resets retry count and schedules for immediate processing
   *
   * @param webhookId - ID of webhook to replay
   * @returns Updated webhook event with status=PROCESSING
   */
  async replayWebhook(webhookId: string): Promise<ProviderWebhookEvent> {
    try {
      const existing = await this.webhookEventRepository.findOne({
        where: { id: webhookId },
      });

      if (!existing) {
        this.logger.warn(`Cannot replay - webhook not found: ${webhookId}`);
        return null;
      }

      existing.processing_status = WebhookProcessingStatusEnum.PROCESSING;
      existing.retry_count = 0;
      existing.last_error = null;
      existing.next_retry_at = null;
      existing.updated_at = new Date();
      
      const updated = await this.webhookEventRepository.save(existing);

      this.logger.log(`Webhook replayed by admin: ${webhookId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error replaying webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up old successfully processed webhooks
   * Keeps SUCCESS webhooks for 7 days for audit purposes
   * Deletes older ones to prevent table bloat
   *
   * @returns Count of deleted records
   */
  async cleanupOldSuccessfulWebhooks(): Promise<number> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await this.webhookEventRepository.delete({
        processing_status: WebhookProcessingStatusEnum.SUCCESS,
        processed_at: LessThan(sevenDaysAgo),
      });

      const count = result.affected || 0;
      if (count > 0) {
        this.logger.log(
          `Cleaned up ${count} old webhook records (older than 7 days)`,
        );
      }
      return count;
    } catch (error) {
      this.logger.error(
        `Error cleaning up old webhooks: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get webhook statistics for monitoring
   * Used by admin dashboard to show webhook health
   *
   * @returns Statistics object with counts by status
   */
  async getStatistics(): Promise<Record<string, number>> {
    try {
      const stats = {};

      for (const status of Object.values(WebhookProcessingStatusEnum)) {
        const count = await this.webhookEventRepository.count({
          where: { processing_status: status },
        });
        stats[status] = count;
      }

      return stats;
    } catch (error) {
      this.logger.error(`Error getting webhook statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate next retry timestamp based on retry count
   * Uses exponential backoff: 5min, 15min, 1hour
   *
   * @param retryCount - Number of retries already attempted
   * @returns Date when next retry should occur
   */
  private calculateNextRetryTime(retryCount: number): Date {
    const now = new Date();
    const intervalIndex = Math.min(
      retryCount - 1,
      this.RETRY_INTERVALS.length - 1,
    );
    const minutesToAdd = this.RETRY_INTERVALS[intervalIndex];
    return new Date(now.getTime() + minutesToAdd * 60 * 1000);
  }
}
