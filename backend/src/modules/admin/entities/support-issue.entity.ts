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
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum SupportIssueSeverityEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SupportIssueTypeEnum {
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  SETTLEMENT_ISSUE = 'SETTLEMENT_ISSUE',
  ORDER_ISSUE = 'ORDER_ISSUE',
  VERIFICATION_ISSUE = 'VERIFICATION_ISSUE',
  SYNC_ISSUE = 'SYNC_ISSUE',
  SYSTEM_ISSUE = 'SYSTEM_ISSUE',
  OTHER = 'OTHER',
}

export enum SupportIssueStatusEnum {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/**
 * SupportIssue - Centralized operational problem tracking
 *
 * Tracks:
 * - Problem type and severity
 * - Affected restaurant
 * - Related order/payment/settlement
 * - Assigned admin
 * - Status and resolution
 *
 * Used for:
 * - Operational exception handling
 * - Customer support investigations
 * - Dispute resolution
 * - Performance metrics
 */
@Entity('support_issues')
@Index(['tenant_id'])
@Index(['status'])
@Index(['severity'])
@Index(['assigned_admin_id'])
@Index(['created_at'])
export class SupportIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({
    type: 'enum',
    enum: SupportIssueTypeEnum,
  })
  issue_type: SupportIssueTypeEnum;

  @Column({
    type: 'enum',
    enum: SupportIssueSeverityEnum,
    default: SupportIssueSeverityEnum.MEDIUM,
  })
  severity: SupportIssueSeverityEnum;

  @Column({
    type: 'enum',
    enum: SupportIssueStatusEnum,
    default: SupportIssueStatusEnum.OPEN,
  })
  status: SupportIssueStatusEnum;

  @Column({
    comment: 'Subject/title of the issue',
  })
  subject: string;

  @Column({
    type: 'text',
    comment: 'Detailed description of the problem',
  })
  description: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Related order ID if applicable',
  })
  related_order_id: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Related payment transaction ID if applicable',
  })
  related_payment_id: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Related settlement ID if applicable',
  })
  related_settlement_id: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'Admin assigned to investigate/resolve this issue',
  })
  assigned_admin_id: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Resolution found and applied',
  })
  resolution_notes: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When the issue was resolved',
  })
  resolved_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_admin_id' })
  assigned_admin: User | null;
}
