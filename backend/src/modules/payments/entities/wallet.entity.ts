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

export enum LedgerEntryTypeEnum {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum LedgerSourceEnum {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  PAYOUT = 'PAYOUT',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL',
}

export enum LedgerStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

/**
 * TenantWallet
 * 
 * Real-time balance for tenant.
 * Source of truth for earnings.
 * 
 * available_balance = confirmed earnings (ready to payout)
 * pending_balance = awaiting confirmation/reversal
 */
@Entity('tenant_wallets')
export class TenantWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  tenant_id: string;

  @Column({ type: 'bigint', default: 0, comment: 'Confirmed balance ready for payout' })
  available_balance: number;

  @Column({ type: 'bigint', default: 0, comment: 'Pending balance awaiting confirmation' })
  pending_balance: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}

/**
 * LedgerEntry
 * 
 * Immutable audit log of all financial transactions.
 * 
 * Every credit/debit is recorded:
 * - PAYMENT successful → CREDIT
 * - REFUND issued → DEBIT
 * - PAYOUT sent → DEBIT
 * - ERROR correction → REVERSAL + new entry
 * 
 * Used for:
 * - Accounting
 * - Audit trails
 * - Reconciliation
 * - Commission calculations
 */
@Entity('ledger_entries')
@Index(['tenant_id'])
@Index(['created_at'])
@Index(['status'])
@Index(['reference'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryTypeEnum,
    comment: 'CREDIT = money in, DEBIT = money out',
  })
  type: LedgerEntryTypeEnum;

  @Column({
    type: 'int',
    comment: 'Amount in base currency units (RWF)',
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: LedgerSourceEnum,
    comment: 'Source of transaction',
  })
  source: LedgerSourceEnum;

  @Column({
    comment: 'Reference ID (payment_id, refund_id, payout_id, etc)',
  })
  reference: string;

  @Column({
    type: 'enum',
    enum: LedgerStatusEnum,
    default: LedgerStatusEnum.PENDING,
  })
  status: LedgerStatusEnum;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Description of transaction',
  })
  description: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'If this is a reversal, reference to original entry',
  })
  reversed_entry_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
