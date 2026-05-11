import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditActionEnum {
  // Restaurants
  RESTAURANT_CREATED = 'RESTAURANT_CREATED',
  RESTAURANT_UPDATED = 'RESTAURANT_UPDATED',
  RESTAURANT_SUSPENDED = 'RESTAURANT_SUSPENDED',
  RESTAURANT_ACTIVATED = 'RESTAURANT_ACTIVATED',
  RESTAURANT_VERIFIED = 'RESTAURANT_VERIFIED',

  // Payment Accounts
  PAYMENT_ACCOUNT_VERIFIED = 'PAYMENT_ACCOUNT_VERIFIED',
  PAYMENT_ACCOUNT_REJECTED = 'PAYMENT_ACCOUNT_REJECTED',
  PAYMENT_ACCOUNT_DELETED = 'PAYMENT_ACCOUNT_DELETED',

  // Settlements
  SETTLEMENT_RETRIED = 'SETTLEMENT_RETRIED',
  SETTLEMENT_REVERSED = 'SETTLEMENT_REVERSED',
  SETTLEMENT_ADJUSTED = 'SETTLEMENT_ADJUSTED',

  // Admin Users
  ADMIN_USER_CREATED = 'ADMIN_USER_CREATED',
  ADMIN_USER_ROLE_CHANGED = 'ADMIN_USER_ROLE_CHANGED',
  ADMIN_USER_DEACTIVATED = 'ADMIN_USER_DEACTIVATED',
  ADMIN_USER_ACTIVATED = 'ADMIN_USER_ACTIVATED',

  // Platform Settings
  PLATFORM_SETTING_CHANGED = 'PLATFORM_SETTING_CHANGED',

  // Support
  SUPPORT_ISSUE_CREATED = 'SUPPORT_ISSUE_CREATED',
  SUPPORT_ISSUE_ASSIGNED = 'SUPPORT_ISSUE_ASSIGNED',
  SUPPORT_ISSUE_RESOLVED = 'SUPPORT_ISSUE_RESOLVED',

  // Manual Actions
  MANUAL_FINANCIAL_ADJUSTMENT = 'MANUAL_FINANCIAL_ADJUSTMENT',
  MANUAL_ORDER_CANCELLATION = 'MANUAL_ORDER_CANCELLATION',

  // Payment Verification
  PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
  PAYMENT_VERIFIED = 'PAYMENT_VERIFIED',
}

/**
 * AuditLog - Comprehensive audit trail for sensitive platform actions
 *
 * Tracks:
 * - Who performed the action (admin_user_id)
 * - What action was performed (action_type)
 * - What entity was affected (reference_type, reference_id)
 * - Before/after state (before_state_json, after_state_json)
 * - Additional context (metadata_json)
 * - When it happened (created_at)
 *
 * Used for:
 * - Compliance and regulatory requirements
 * - Debugging operational issues
 * - Detecting unauthorized changes
 * - Investigating disputes
 */
@Entity('audit_logs')
@Index(['admin_user_id'])
@Index(['action_type'])
@Index(['reference_type', 'reference_id'])
@Index(['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  admin_user_id: string;

  @Column({
    type: 'enum',
    enum: AuditActionEnum,
  })
  action_type: AuditActionEnum;

  @Column({
    comment:
      'Type of entity affected (e.g., restaurant, payment_account, settlement, order)',
  })
  reference_type: string;

  @Column({
    comment:
      'ID of the affected entity',
  })
  reference_id: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'State of entity before the action (for comparison)',
  })
  before_state_json: Record<string, any> | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'State of entity after the action',
  })
  after_state_json: Record<string, any> | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Additional context (reason, notes, etc.)',
  })
  metadata_json: Record<string, any> | null;

  @Column({
    nullable: true,
    comment: 'IP address of the admin who performed this action',
  })
  ip_address: string;

  @Column({
    nullable: true,
    comment: 'User agent of the admin client',
  })
  user_agent: string;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'admin_user_id' })
  admin_user: User;
}
