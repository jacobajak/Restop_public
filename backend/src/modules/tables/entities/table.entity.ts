import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Table Entity
 * 
 * Represents a physical dining table in a restaurant.
 * Each table has a unique number and an associated QR code for customer ordering.
 * 
 * Features:
 * - Unique table numbers per restaurant
 * - Auto-generated QR code identifiers
 * - QR code URL for customer ordering
 * - Tenant isolation (tables scoped to restaurant)
 * - Timestamps for audit trail
 * 
 * @class Table
 * @entity
 */
@Entity('tables')
@Unique('UNIQUE_table_number_per_tenant', ['tenant_id', 'table_number'])
@Index('IDX_qr_code', ['qr_code'])
@Index('IDX_tenant_id', ['tenant_id'])
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ type: 'int', comment: 'Table number displayed to customers' })
  table_number: number;

  @Column({ unique: true, type: 'varchar' })
  qr_code: string; // Unique identifier: QR-TABLE-{id} or similar

  @Column({ nullable: true, type: 'varchar' })
  qr_url: string; // Full URL for QR code: /menu/slug?table=table_number

  @Column({ default: true, type: 'boolean' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant, (tenant) => tenant.tables)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
