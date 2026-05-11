import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export enum PaymentEventTypeEnum {
  INITIATED = 'INITIATED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  VERIFIED = 'VERIFIED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
  CANCELLED = 'CANCELLED',
  PAYOUT_TRIGGERED = 'PAYOUT_TRIGGERED',
  PAYOUT_SUCCESS = 'PAYOUT_SUCCESS',
  PAYOUT_FAILED = 'PAYOUT_FAILED',
  SUBSCRIPTION_INITIATED = 'SUBSCRIPTION_INITIATED',
  SUBSCRIPTION_ENDED = 'SUBSCRIPTION_ENDED',
}

export type PaymentEventType = keyof typeof PaymentEventTypeEnum;

/**
 * PaymentEvent - Audit log for all payment transactions
 * 
 * Tracks every step of the payment lifecycle:
 * 1. INITIATED - Payment API call made
 * 2. WEBHOOK_RECEIVED - Webhook callback from provider
 * 3. VERIFIED - Transaction verified with provider API
 * 4. CONFIRMED - Order marked PAID
 * 5. FAILED - Payment failed verification
 * 6. RETRY - Verification retry attempted
 * 7. CANCELLED - Payment manually cancelled
 * 8. PAYOUT_TRIGGERED - Instant cashout initiated
 * 9. PAYOUT_SUCCESS - Tenant received funds
 * 10. PAYOUT_FAILED - Payout attempt failed
 * 
 * Useful for:
 * - Debugging payment issues
 * - User support inquiries
 * - Reconciliation with payment provider
 * - Audit trails for compliance
 */
@Entity('payment_events')
@Index(['order_id'])
@Index(['event_type'])
@Index(['created_at'])
export class PaymentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  order_id: string;

  @Column({ type: 'enum', enum: PaymentEventTypeEnum })
  event_type: PaymentEventType;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Full event data (webhook payload, API response, etc)',
  })
  event_payload: Record<string, any>;

  @Column({ type: 'text', nullable: true, comment: 'Human-readable description of the event' })
  description: string;

  @Column({ nullable: true, comment: 'Error message if event type is FAILED or PAYOUT_FAILED' })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  constructor(partial?: Partial<PaymentEvent>) {
    Object.assign(this, partial);
  }
}
