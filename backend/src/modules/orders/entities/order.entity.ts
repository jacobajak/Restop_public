import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Table } from '../../tables/entities/table.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatusEnum {
  CREATED = 'CREATED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export type OrderStatus = keyof typeof OrderStatusEnum;

export enum PaymentMethodEnum {
  CASH = 'CASH',
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
}

export type PaymentMethod = keyof typeof PaymentMethodEnum;

export enum PaymentStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export type PaymentStatus = keyof typeof PaymentStatusEnum;

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ unique: true })
  order_number: string;

  @Column({ nullable: true })
  order_code: string; // Short code for customer (e.g., "ORD-1234")

  @Column({
    type: 'enum',
    enum: OrderStatusEnum,
    default: OrderStatusEnum.CREATED,
  })
  status: OrderStatus;

  @Column({ type: 'int', comment: 'Subtotal in cents/base units' })
  subtotal: number;

  @Column({ type: 'int', comment: '3% platform commission' })
  platform_fee: number;

  @Column({ type: 'int', comment: 'Total amount = subtotal + platform_fee' })
  total_amount: number;

  @Column({ type: 'enum', enum: PaymentMethodEnum, default: PaymentMethodEnum.CASH })
  payment_method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatusEnum, default: PaymentStatusEnum.PENDING })
  payment_status: PaymentStatus;

  @Column({ nullable: true, comment: 'Customer phone number for Mobile Money payment' })
  phone_number: string;

  @Column({ nullable: true, comment: 'Payment transaction reference from provider' })
  transaction_ref: string;

  @Column({ unique: true, nullable: true, comment: 'Unique transaction reference for idempotency' })
  tx_ref: string;

  @Column({ nullable: true, comment: 'Paypack cashin reference ID' })
  paypack_cashin_ref: string;

  @Column({ nullable: true, comment: 'Flutterwave transaction ID' })
  flutterwave_id: string;

  @Column({ default: false, comment: 'Prevent concurrent payment attempts' })
  payment_locked: boolean;

  @Column({ nullable: true, comment: 'Customer name for receipt/tracking' })
  customer_name: string;

  @Column({ nullable: true })
  rejection_reason: string;

  @Column({ type: 'timestamp', nullable: true, comment: 'When order was cancelled' })
  cancelled_at: Date;

  @Column({ type: 'uuid', nullable: true, comment: 'Admin/system that cancelled' })
  cancelled_by: string;

  @Column({ nullable: true, comment: 'Reason for cancellation' })
  cancellation_reason: string;

  @Column({ type: 'uuid', nullable: true })
  table_id: string; // Reference to specific table (null for general orders)

  @Column({ type: 'int', nullable: true, comment: 'Table number for dine-in orders' })
  table_number: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant, (tenant) => tenant.orders)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Table, { nullable: true, eager: true })
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];
}
