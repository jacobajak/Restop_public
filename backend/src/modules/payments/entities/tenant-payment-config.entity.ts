import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * TenantPaymentConfig
 * 
 * Allows tenants to configure payment settings:
 * - Which payment methods are enabled
 * - Minimum/maximum order amounts
 * - Fraud detection limits
 */
@Entity('tenant_payment_configs')
export class TenantPaymentConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  tenant_id: string;

  @Column({ default: true, comment: 'Accept cash payments' })
  enable_cash: boolean;

  @Column({ default: true, comment: 'Accept MTN mobile money' })
  enable_mtn: boolean;

  @Column({ default: true, comment: 'Accept Airtel mobile money' })
  enable_airtel: boolean;

  @Column({ type: 'int', default: 1000, comment: 'Min order amount in RWF' })
  min_order_amount: number;

  @Column({ type: 'int', default: 5000000, comment: 'Max order amount in RWF' })
  max_order_amount: number;

  @Column({ type: 'int', default: 3, comment: 'Max payment retry attempts per order' })
  max_payment_retries: number;

  @Column({ type: 'int', default: 30, comment: 'Payment confirmation timeout (minutes)' })
  payment_timeout_minutes: number;

  @Column({ default: true, comment: 'Enable automatic refund for cancellations' })
  auto_refund_on_cancel: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
