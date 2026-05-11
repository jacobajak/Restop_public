import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AdminWalletTypeEnum {
  PLATFORM_FEES = 'PLATFORM_FEES',
  PROVIDER_FEES = 'PROVIDER_FEES',
  REFUND_INSURANCE = 'REFUND_INSURANCE',
  OPERATIONAL_RESERVE = 'OPERATIONAL_RESERVE',
}

export enum AdminLedgerSourceEnum {
  COLLECTION = 'COLLECTION',
  TRANSFER = 'TRANSFER',
  PAYOUT = 'PAYOUT',
  REVERSAL = 'REVERSAL',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

export enum AdminLedgerStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * AdminWallet
 *
 * Tracks platform revenue and admin account balances.
 *
 * Wallet Types:
 * - PLATFORM_FEES: 3% fee collected from each transaction (main revenue)
 * - PROVIDER_FEES: Payment provider fees (MTN, Airtel, etc) aggregated
 * - REFUND_INSURANCE: Reserve for handling refund chargebacks
 * - OPERATIONAL_RESERVE: Emergency reserve for system operations
 *
 * Used for:
 * - Daily balance settlement and reporting
 * - Admin payouts and transfers
 * - Platform financial analytics
 * - Tax and compliance reporting
 */
@Entity('admin_wallets')
@Index(['wallet_type'])
@Index(['updated_at'])
export class AdminWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AdminWalletTypeEnum,
    unique: true,
    comment: 'Wallet type determines the revenue stream',
  })
  wallet_type: AdminWalletTypeEnum;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Confirmed balance ready for use/transfer',
  })
  available_balance: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Pending balance awaiting confirmation/settlement',
  })
  pending_balance: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Total accumulated amount (all time)',
  })
  total_accumulated: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Total paid out to admin accounts',
  })
  total_paid_out: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * AdminLedger
 *
 * Immutable audit log of all admin wallet transactions.
 *
 * Records:
 * - Fee collections from tenant settlements (COLLECTION)
 * - Transfers between wallet types (TRANSFER)
 * - Admin payouts/withdrawals (PAYOUT)
 * - Reversals and corrections (REVERSAL)
 * - Manual adjustments by finance team (MANUAL_ADJUSTMENT)
 *
 * Used for:
 * - Complete financial audit trail
 * - Reconciliation with banking records
 * - Tax reporting and compliance
 * - Dispute resolution
 */
@Entity('admin_ledgers')
@Index(['wallet_type'])
@Index(['source'])
@Index(['created_at'])
@Index(['reference'])
export class AdminLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AdminWalletTypeEnum,
    comment: 'Which wallet this ledger entry belongs to',
  })
  wallet_type: AdminWalletTypeEnum;

  @Column({
    type: 'enum',
    enum: AdminLedgerSourceEnum,
    comment: 'Source/type of the transaction',
  })
  source: AdminLedgerSourceEnum;

  @Column({
    type: 'bigint',
    comment: 'Amount in base currency units (RWF)',
  })
  amount: number;

  @Column({
    type: 'varchar',
    comment: 'Reference ID (settlement_id, tenant_id, payout_id, etc)',
  })
  reference: string;

  @Column({
    type: 'varchar',
    nullable: true,
    comment: 'Additional reference (e.g., related tenant for fee collections)',
  })
  secondary_reference: string;

  @Column({
    type: 'enum',
    enum: AdminLedgerStatusEnum,
    default: AdminLedgerStatusEnum.PENDING,
    comment: 'Status of the transaction',
  })
  status: AdminLedgerStatusEnum;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Description of the transaction (auto-generated or manual notes)',
  })
  description: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'If this is a reversal, reference to original entry',
  })
  reversed_entry_id: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'ID of admin user who made manual adjustment',
  })
  admin_user_id: string;

  @Column({
    type: 'varchar',
    nullable: true,
    comment: 'Notes on manual adjustments (required for compliance)',
  })
  admin_notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * PlatformFeeCollectionDaily
 *
 * Daily snapshot of platform fees collected.
 * Used for analytics and daily reporting.
 *
 * Aggregates all fees collected on a given day:
 * - Total fees from all transactions
 * - Number of transactions
 * - Average transaction value
 * - Settlement status
 */
@Entity('platform_fee_collection_daily')
@Index(['collection_date'])
@Index(['status'])
export class PlatformFeeCollectionDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'date',
    unique: true,
    comment: 'The date these fees were collected',
  })
  collection_date: Date;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Total platform fees collected this day',
  })
  total_fees: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Total provider fees collected this day',
  })
  total_provider_fees: number;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of transactions processed',
  })
  transaction_count: number;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of unique tenants who made sales',
  })
  unique_tenant_count: number;

  @Column({
    type: 'varchar',
    comment: 'PENDING: awaiting settlement, SETTLED: confirmed to admin',
  })
  status: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Reference to the settlement record when settled',
  })
  settlement_id: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When this daily collection was settled',
  })
  settled_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * TenantFeeBreakdown
 *
 * Details of fees charged to each tenant for reporting/audit.
 * Calculated but not stored (can be queried from transactions).
 * This table stores the calculated breakdown for easy reporting.
 *
 * Used for:
 * - Tenant invoice generation
 * - Fee transparency in tenant dashboard
 * - Audit and dispute resolution
 */
@Entity('tenant_fee_breakdowns')
@Index(['tenant_id', 'period_start'])
export class TenantFeeBreakdown {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    comment: 'Tenant ID',
  })
  tenant_id: string;

  @Column({
    type: 'date',
    comment: 'Start of the billing period',
  })
  period_start: Date;

  @Column({
    type: 'date',
    comment: 'End of the billing period',
  })
  period_end: Date;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Gross sales for the period',
  })
  gross_sales: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Platform fees (3%)',
  })
  platform_fee: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Provider fees (payment gateway)',
  })
  provider_fee: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Net payable to tenant',
  })
  net_payable: number;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of transactions',
  })
  transaction_count: number;

  @Column({
    type: 'varchar',
    default: 'OPEN',
    comment: 'OPEN: invoice generated, SETTLED: paid to tenant',
  })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
