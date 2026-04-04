import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookProviderEnum {
  FLUTTERWAVE = 'flutterwave',
  PAYPACK = 'paypack',
  STRIPE = 'stripe',
}

export enum WebhookEventTypeEnum {
  CHARGE_COMPLETED = 'charge.completed',
  CHARGE_FAILED = 'charge.failed',
  CHARGE_CANCELLED = 'charge.cancelled',
  TRANSFER_COMPLETED = 'transfer.completed',
  TRANSFER_FAILED = 'transfer.failed',
  REFUND_CREATED = 'refund.created',
  REFUND_FAILED = 'refund.failed',
  USSD_INITIATED = 'ussd.initiated',
  USSD_COMPLETED = 'ussd.completed',
  USSD_FAILED = 'ussd.failed',
}

export enum WebhookProcessingStatusEnum {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRY_PENDING = 'retry_pending',
  DEAD_LETTER = 'dead_letter',
}

/**
 * Provider Webhook Event Entity
 *
 * Persists all incoming webhooks from payment providers.
 * Enables:
 * - Dead-letter queue for failed webhooks
 * - Manual replay of failed webhook processing
 * - Audit trail of all webhook events
 * - Debugging webhook processing issues
 *
 * Workflow:
 * 1. Webhook received from provider → Record with status=RECEIVED
 * 2. Signature verified → Record with status=PROCESSING
 * 3. Event processed → Record with status=SUCCESS
 * 4. Processing fails → Record with status=FAILED + error_message
 * 5. Admin can manually replay failed webhooks
 *
 * @entity provider_webhook_events
 */
@Entity('provider_webhook_events')
@Index(['provider', 'event_type', 'created_at'])
@Index(['event_reference'])
@Index(['processing_status', 'created_at'])
@Index(['retry_count', 'processing_status'])
export class ProviderWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Payment provider sending this webhook
   */
  @Column({
    enum: WebhookProviderEnum,
    type: 'enum',
  })
  provider: WebhookProviderEnum;

  /**
   * Type of webhook event from provider
   * Examples: charge.completed, transfer.failed, ussd.completed
   */
  @Column({
    enum: WebhookEventTypeEnum,
    type: 'enum',
  })
  event_type: WebhookEventTypeEnum;

  /**
   * Reference ID from the provider's event
   * Used to correlate webhook to orders/transactions
   * Examples: flutterwave transaction_id, paypack tx_ref
   */
  @Column({
    type: 'varchar',
    length: 255,
  })
  event_reference: string;

  /**
   * Complete raw webhook payload from provider (JSON)
   * Original event data, used for replaying and debugging
   */
  @Column({
    type: 'jsonb',
  })
  payload_json: Record<string, any>;

  /**
   * Current processing status
   * - RECEIVED: Just arrived, not yet verified
   * - PROCESSING: Signature verified, being processed
   * - SUCCESS: Successfully processed
   * - FAILED: Processing failed (requires manual intervention)
   * - RETRY_PENDING: Scheduled for retry
   * - DEAD_LETTER: Failed all retries, archived
   */
  @Column({
    enum: WebhookProcessingStatusEnum,
    type: 'enum',
    default: WebhookProcessingStatusEnum.RECEIVED,
  })
  processing_status: WebhookProcessingStatusEnum;

  /**
   * How many times we've attempted to process this webhook
   * Incremented on each retry
   * Max retries: 5 (then dead_letter)
   */
  @Column({
    type: 'integer',
    default: 0,
  })
  retry_count: number;

  /**
   * Error message from last processing attempt
   * Helps admin understand why webhook failed
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  last_error: string | null;

  /**
   * Timestamp when webhook was received from provider
   * Used to track webhook latency
   */
  @Column({
    type: 'timestamp',
  })
  received_at: Date;

  /**
   * Timestamp when webhook was successfully processed
   * Null until status=SUCCESS
   */
  @Column({
    type: 'timestamp',
    nullable: true,
  })
  processed_at: Date | null;

  /**
   * Timestamp when next retry should occur
   * Used by retry scheduler to find pending webhooks
   */
  @Column({
    type: 'timestamp',
    nullable: true,
  })
  next_retry_at: Date | null;

  /**
   * HTTP X-Signature header from provider (for verification)
   * Stored for audit and replay verification
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  signature: string | null;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Last update timestamp
   */
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  /**
   * Helpful constructor
   */
  constructor(partial?: Partial<ProviderWebhookEvent>) {
    Object.assign(this, partial);
  }
}
