import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationTypeEnum {
  ORDER_CREATED = 'order.created',
  ORDER_READY = 'order.ready',
  ORDER_REJECTED = 'order.rejected',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_APPROVED = 'refund.approved',
  REFUND_REJECTED = 'refund.rejected',
  SETTLEMENT_COMPLETED = 'settlement.completed',
  SETTLEMENT_FAILED = 'settlement.failed',
  SUPPORT_ESCALATED = 'support.escalated',
  SUPPORT_RESOLVED = 'support.resolved',
}

export enum NotificationChannelEnum {
  EMAIL = 'email',
  WEBSOCKET = 'websocket',
  IN_APP = 'in_app',
}

export enum NotificationStatusEnum {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Notification History Entity
 * 
 * Tracks all sent notifications to:
 * - Prevent duplicate emails for same event
 * - Enable retry logic for failed emails
 * - Provide audit trail of notifications
 * - Support notification preference enforcement
 * 
 * @entity notification_history
 */
@Entity('notification_history')
@Index(['recipient_email', 'notification_type', 'created_at']) // Check for duplicates
@Index(['related_entity_id', 'notification_type']) // Find notifications for order/payment
@Index(['status', 'created_at']) // Find failed notifications to retry
@Index(['tenant_id', 'created_at']) // Tenant audit trail
export class NotificationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  /**
   * User ID receiving the notification
   * Null for customers (use email instead)
   */
  @Column('uuid', { nullable: true })
  user_id: string | null;

  /**
   * Recipient email address
   */
  @Column()
  recipient_email: string;

  /**
   * Type of notification (order.created, payment.completed, etc.)
   */
  @Column({
    enum: NotificationTypeEnum,
    type: 'enum',
  })
  notification_type: NotificationTypeEnum;

  /**
   * Channel used (email, WebSocket, in-app)
   */
  @Column({
    enum: NotificationChannelEnum,
    type: 'enum',
    default: NotificationChannelEnum.EMAIL,
  })
  channel: NotificationChannelEnum;

  /**
   * Current status of notification delivery
   */
  @Column({
    enum: NotificationStatusEnum,
    type: 'enum',
    default: NotificationStatusEnum.PENDING,
  })
  status: NotificationStatusEnum;

  /**
   * Related entity ID (order_id, payment_id, settlement_id, etc.)
   * Used to prevent duplicate notifications for same event
   */
  @Column({ nullable: true })
  related_entity_id: string | null;

  /**
   * Related entity type (order, payment, settlement)
   */
  @Column({ nullable: true })
  related_entity_type: string | null;

  /**
   * Email subject line
   */
  @Column({ nullable: true })
  subject: string | null;

  /**
   * Email body (template variables already filled in)
   */
  @Column('text', { nullable: true })
  html_content: string | null;

  /**
   * Number of delivery attempts
   */
  @Column({ default: 0 })
  attempt_count: number;

  /**
   * Maximum retry attempts before giving up
   */
  @Column({ default: 3 })
  max_attempts: number;

  /**
   * Error message if failed
   */
  @Column({ nullable: true })
  error_message: string | null;

  /**
   * When email was actually sent (null if pending or failed)
   */
  @Column({ nullable: true })
  sent_at: Date | null;

  /**
   * Template variables used for rendering (stored as JSON)
   * Used for re-rendering on retry
   */
  @Column('jsonb', { nullable: true })
  template_variables: Record<string, any> | null;

  /**
   * Email provider response (MessageID, etc.)
   */
  @Column('jsonb', { nullable: true })
  provider_response: Record<string, any> | null;

  /**
   * Idempotency key to prevent duplicate sends
   * Format: {tenant_id}:{related_entity_id}:{notification_type}:{recipient_email}
   */
  @Column({ unique: true })
  idempotency_key: string;

  @CreateDateColumn()
  created_at: Date;

  /**
   * When last retry was attempted
   */
  @Column({ nullable: true })
  last_retry_at: Date | null;

  /**
   * Next scheduled retry time
   */
  @Column({ nullable: true })
  next_retry_at: Date | null;
}
