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
import { PaymentTransaction } from './payment.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Order } from '../../orders/entities/order.entity';

export enum RefundStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export enum RefundReasonEnum {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  WRONG_AMOUNT = 'WRONG_AMOUNT',
  MERCHANT_ERROR = 'MERCHANT_ERROR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

/**
 * Refund Entity
 * 
 * Tracks all refund requests for payments.
 * 
 * Financial workflow:
 * PENDING → APPROVED → PROCESSED → [money returned to customer]
 * 
 * Rules:
 * - Refund amount ≤ original payment amount
 * - Only SUCCESSFUL payments can be refunded
 * - Prevent duplicate refunds for same payment
 * - All refunds logged and auditable
 */
@Entity('refunds')
@Index(['payment_id'])
@Index(['order_id'])
@Index(['tenant_id'])
@Index(['status'])
@Index(['created_at'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  payment_id: string;

  @Column('uuid')
  order_id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'int', comment: 'Refund amount in base currency units (RWF)' })
  amount: number;

  @Column({
    type: 'enum',
    enum: RefundReasonEnum,
    comment: 'Why refund is being issued',
  })
  reason: RefundReasonEnum;

  @Column({
    type: 'enum',
    enum: RefundStatusEnum,
    default: RefundStatusEnum.PENDING,
  })
  status: RefundStatusEnum;

  @Column({ nullable: true, comment: 'Flutterwave refund ID from API response' })
  flutterwave_refund_id: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Admin notes for approval/rejection',
  })
  notes: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Error message if refund failed',
  })
  error_message: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Admin who approved the refund',
  })
  approved_by: string;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => PaymentTransaction)
  @JoinColumn({ name: 'payment_id' })
  payment: PaymentTransaction;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
