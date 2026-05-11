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
import { TenantPaymentAccount } from './tenant-payment-account.entity';

export enum PayoutStatusEnum {
  PENDING = 'PENDING',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
}

export type PayoutStatus = keyof typeof PayoutStatusEnum;

/**
 * Payout - Tracks tenant cashout attempts
 * 
 * Records each cashout (Flutterwave bank payout transaction) to a tenant's mobile money account.
 * Triggered immediately after successful cashin confirmation via webhook.
 */
@Entity('payouts')
@Index(['order_id'])
@Index(['tenant_id'])
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  order_id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  tenant_payment_account_id: string;

  @Column({ type: 'int', comment: 'Payout amount in base currency units' })
  amount: number;

  @Column({ type: 'enum', enum: PayoutStatusEnum, default: PayoutStatusEnum.PENDING })
  status: PayoutStatus;

  @Column({ nullable: true, comment: 'Flutterwave payout reference ID' })
  provider_ref: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'Raw Flutterwave payout response' })
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

  @ManyToOne(() => TenantPaymentAccount)
  @JoinColumn({ name: 'tenant_payment_account_id' })
  tenant_payment_account: TenantPaymentAccount;
}
