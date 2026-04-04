import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

export enum FraudReviewSubjectType {
  ORDER = 'ORDER',
  CUSTOMER = 'CUSTOMER',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  MERCHANT = 'MERCHANT',
}

export enum FraudRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FraudReviewStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  BLOCKED = 'BLOCKED',
  DISMISSED = 'DISMISSED',
  ESCALATED = 'ESCALATED',
}

/**
 * FraudReview - Admin audit and review records for flagged items
 *
 * Tracks:
 * - All items flagged by FraudDetectionService (orders, customers, refunds, payments)
 * - Risk assessment with score and reasons
 * - Admin review decisions (approve, block, dismiss)
 * - Action tracking (hold payment, block customer, escalate)
 * - Audit history (who reviewed, when, decisions)
 *
 * Used by:
 * - Fraud moderation queue (list all open/under_review items)
 * - Admin detail view (see score breakdown, reasons, related history)
 * - Admin action controls (review, dismiss, hold, block, escalate)
 * - Reporting (track fraud incidents and patterns)
 *
 * Example flows:
 * 1. Order flagged (CRITICAL risk) → Entry created (status=OPEN)
 * 2. Admin reviews → Updates notes, assigns to self (status=UNDER_REVIEW)
 * 3. Admin approves → Updates status=APPROVED, reason stored
 * 4. Admin blocks customer → Status=BLOCKED, action tracking, related items updated
 * 5. Escalation for investigation → Status=ESCALATED, forensics queue created
 */
@Entity('fraud_reviews')
@Index(['status'])
@Index(['risk_level'])
@Index(['subject_type', 'subject_id'])
@Index(['created_at', 'status'])
@Index(['assigned_admin_id'])
export class FraudReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // What is being reviewed
  @Column({ type: 'enum', enum: FraudReviewSubjectType })
  subject_type: FraudReviewSubjectType;

  @Column('uuid', { comment: 'ID of the subject (order_id, customer_phone hash, payment_id, etc)' })
  subject_id: string;

  // Risk assessment details
  @Column({ type: 'smallint', default: 0, comment: 'Risk score 0-100' })
  risk_score: number;

  @Column({ type: 'enum', enum: FraudRiskLevel })
  risk_level: FraudRiskLevel;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Array of reasons contributing to high risk (populated by FraudDetectionService)',
  })
  reasons_json: {
    indicators: string[];
    recommended_action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  };

  // Review tracking
  @Column({ type: 'enum', enum: FraudReviewStatus, default: FraudReviewStatus.OPEN })
  status: FraudReviewStatus;

  @Column('uuid', { nullable: true, comment: 'Admin user who is/was reviewing this' })
  assigned_admin_id?: string;

  @Column({ type: 'text', nullable: true, comment: 'Admin notes/decision explanation' })
  notes?: string;

  @Column({ type: 'text', nullable: true, comment: 'Action taken (e.g., "Blocked customer", "Hold payment 24h")' })
  action_taken?: string;

  // Related context (denormalized for performance)
  @Column({ type: 'varchar', nullable: true, comment: 'Customer phone for ORDER subject' })
  customer_phone?: string;

  @Column({ type: 'uuid', nullable: true, comment: 'Order ID for ORDER/REFUND subject' })
  order_id?: string;

  @Column({ type: 'uuid', nullable: true, comment: 'Payment ID for PAYMENT subject' })
  payment_id?: string;

  @Column({ type: 'uuid', nullable: true, comment: 'Restaurant/Merchant ID if available' })
  merchant_id?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, comment: 'Transaction amount' })
  amount?: number;

  // Timestamps
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true, comment: 'When admin reviewed (status changed from OPEN/UNDER_REVIEW)' })
  reviewed_at?: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_admin_id' })
  assigned_admin?: User;

  @ManyToOne(() => Order, { nullable: true, eager: false })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  constructor(partial?: Partial<FraudReview>) {
    Object.assign(this, partial);
  }
}
