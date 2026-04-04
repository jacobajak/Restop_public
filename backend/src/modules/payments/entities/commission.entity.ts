import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Order } from '../../orders/entities/order.entity';

export enum CommissionStatusEnum {
  PENDING = 'PENDING',
  SETTLED = 'SETTLED',
}

export type CommissionStatus = keyof typeof CommissionStatusEnum;

/**
 * Commission Ledger
 * 
 * Tracks DineFlow's commission on each order.
 * Commission is recorded when payment is confirmed (webhook successful or cash confirmed).
 * 
 * Example:
 * Order total: 10,000 RWF
 * Commission rate: 3%
 * Commission amount: 300 RWF
 * 
 * During MVP: Only recorded to ledger
 * Future: Can be settled/transferred to DineFlow account
 */
@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  order_id: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, comment: 'Commission rate as decimal (e.g., 0.1000 for 10%)' })
  commission_rate: number;

  @Column({ type: 'int', comment: 'Commission amount in base currency units' })
  amount: number;

  @Column({
    type: 'enum',
    enum: CommissionStatusEnum,
    default: CommissionStatusEnum.PENDING,
  })
  status: CommissionStatus;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
