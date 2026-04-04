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
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum TransactionKindEnum {
  CASHIN = 'CASHIN',
  CASHOUT = 'CASHOUT',
}

export enum PaymentProviderEnum {
  FLUTTERWAVE = 'FLUTTERWAVE',
  PAYPACK = 'PAYPACK',
}

export enum PaymentMethodEnum {
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
  CASH = 'CASH',
}

export type TransactionKind = keyof typeof TransactionKindEnum;

/**
 * PaymentTransaction - Tracks Paypack cashin and cashout transactions
 * 
 * Records each transaction attempt from Paypack.
 * - CASHIN: Collection from customer
 * - CASHOUT: Payout to tenant
 */
@Entity('payment_transactions')
@Index(['order_id'])
@Index(['provider_ref'], { unique: true })
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  order_id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ default: 'PAYPACK', comment: 'Payment provider identifier' })
  provider: string;

  @Column({ type: 'enum', enum: TransactionKindEnum })
  kind: TransactionKind;

  @Column({ comment: 'Provider transaction reference (Paypack ref)' })
  provider_ref: string;

  @Column({ type: 'int', comment: 'Transaction amount in base currency units' })
  amount: number;

  @Column({ comment: 'Transaction status from provider' })
  status: string;

  @Column({
    type: 'enum',
    enum: ['INITIATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'],
    nullable: true,
    comment: 'Flutterwave transaction status',
  })
  flutterwave_status: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'Raw Paypack response payload' })
  raw_payload: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}

// Alias for compatibility with other services
export type Payment = PaymentTransaction;

