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
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum MobileNetworkEnum {
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
}

export type MobileNetwork = keyof typeof MobileNetworkEnum;

/**
 * TenantPaymentAccount
 * 
 * Stores tenant's mobile money accounts for instant payout.
 * Each network (MTN/AIRTEL) is a separate record.
 * 
 * When Paypack cashout is triggered, this entity provides the destination momo_number.
 */
@Entity('tenant_payment_accounts')
@Index(['tenant_id', 'network'], { unique: true })
export class TenantPaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'enum', enum: MobileNetworkEnum })
  network: MobileNetwork;

  @Column({ comment: 'Mobile money account number for payout' })
  momo_number: string;

  @Column({ nullable: true, comment: 'Optional account holder name for verification purposes' })
  account_name: string;

  @Column({ default: false, comment: 'Whether this account has been verified' })
  is_verified: boolean;

  @Column({ nullable: true, comment: 'Reason for account rejection (if any)' })
  rejection_reason: string;

  @Column({ nullable: true, comment: 'Timestamp when account was rejected' })
  rejected_at: Date;

  @Column({ default: true, comment: 'Whether this is the default account for payouts' })
  is_default: boolean;

  @Column({ nullable: true, comment: 'Flutterwave subaccount ID for automatic payment split' })
  flutterwave_subaccount_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}

