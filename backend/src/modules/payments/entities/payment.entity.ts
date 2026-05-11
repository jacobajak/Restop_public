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
}

export enum PaymentMethodEnum {
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
  CASH = 'CASH',
}

export type TransactionKind = keyof typeof TransactionKindEnum;

/**
 * PaymentTransaction - Tracks Flutterwave cashin and cashout transactions
 * 
 * Records each transaction attempt from Flutterwave.
 * - CASHIN: Collection from customer (mobile money)
 * - CASHOUT: Payout to tenant (bank transfer/mobile money)
 * 
 * Multi-Currency Support:
 * - `currency`: The currency code for this transaction (e.g., 'KES', 'RWF')
 * - `amount`: Transaction amount in the specified currency
 * - `exchange_rate_used`: Exchange rate used if currency differs from base
 * - `amount_in_usd`: Optional USD equivalent for cross-currency settlement
 */
@Entity('payment_transactions')
@Index(['order_id'])
@Index(['provider_ref'], { unique: true })
@Index(['currency'])
@Index(['tenant_id', 'currency'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  order_id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ default: 'FLUTTERWAVE', comment: 'Payment provider identifier' })
  provider: string;

  @Column({ type: 'enum', enum: TransactionKindEnum })
  kind: TransactionKind;

  @Column({ comment: 'Provider transaction reference (Flutterwave ref)' })
  provider_ref: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, comment: 'Transaction amount in the specified currency' })
  amount: number;

  @Column({
    type: 'varchar',
    length: 3,
    default: 'RWF',
    comment: 'Currency code (ISO 4217) for this transaction (e.g., KES, RWF, TZS)',
  })
  currency: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
    comment: 'Exchange rate used if currency differs from base currency (conversion rate)',
  })
  exchange_rate_used: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    comment: 'Amount converted to USD for cross-currency settlement and reconciliation',
  })
  amount_in_usd: number;

  @Column({ comment: 'Transaction status from provider' })
  status: string;

  @Column({
    type: 'enum',
    enum: ['INITIATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'],
    nullable: true,
    comment: 'Flutterwave transaction status',
  })
  flutterwave_status: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'Raw Flutterwave response payload' })
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

