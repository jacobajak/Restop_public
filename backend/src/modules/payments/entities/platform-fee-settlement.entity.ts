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
import { User } from '../../users/entities/user.entity';

export enum SettlementStatusEnum {
  PENDING = 'PENDING', // Awaiting admin review/confirmation
  CONFIRMED = 'CONFIRMED', // Admin approved, awaiting processing
  SETTLED = 'SETTLED', // Complete, counter reset
}

/**
 * PlatformFeeSettlement Entity
 *
 * Tracks platform fee settlements per restaurant
 * Enables admin to confirm which restaurants have paid their platform fees
 * Maintains audit trail and transaction references
 *
 * Status Flow: PENDING → CONFIRMED → SETTLED
 */
@Entity('platform_fee_settlements')
@Index(['tenant_id', 'status'])
@Index(['tenant_id', 'settlement_period_start'])
@Index(['confirmed_at'])
export class PlatformFeeSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the restaurant/tenant
   */
  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /**
   * Settlement Period - Dates defining the fee collection window
   */
  @Column('timestamp')
  settlement_period_start: Date;

  @Column('timestamp')
  settlement_period_end: Date;

  /**
   * Financial Information
   */
  @Column('decimal', { precision: 15, scale: 2 })
  total_fees_collected: number;

  /**
   * Settlement amount (may differ from collected in future for fees/discounts)
   * For now, equals total_fees_collected
   */
  @Column('decimal', { precision: 15, scale: 2 })
  settlement_amount: number;

  /**
   * Number of transactions that contributed to this settlement
   * Used for reference and audit trail
   */
  @Column('integer', { default: 0 })
  transaction_count: number;

  /**
   * Status of the settlement
   * PENDING: Awaiting admin review
   * CONFIRMED: Admin has approved payment received
   * SETTLED: Processing complete, counter reset
   */
  @Column('enum', { enum: SettlementStatusEnum, default: SettlementStatusEnum.PENDING })
  status: SettlementStatusEnum;

  /**
   * Audit Trail - Admin Confirmation
   */
  @Column('uuid', { nullable: true })
  confirmed_by_admin_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by_admin_id' })
  confirmed_by_admin: User;

  @Column('timestamp', { nullable: true })
  confirmed_at: Date;

  /**
   * Admin notes during confirmation process
   * E.g., "Bank transfer verified", "Check payment received", etc.
   */
  @Column('text', { nullable: true })
  admin_notes: string;

  /**
   * JSON array of transaction IDs/references for detailed breakdown
   * Example: ["txn-001", "txn-002", "order-ref-001"]
   * Links this settlement to specific payment transactions for audit
   */
  @Column('jsonb', { default: '[]' })
  transaction_references: string[];

  /**
   * Timestamps
   */
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
