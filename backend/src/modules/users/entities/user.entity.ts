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

export enum UserRole {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  TENANT_OWNER = 'TENANT_OWNER',
  TENANT_MANAGER = 'TENANT_MANAGER',
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  CASHIER = 'CASHIER',
}

// For backwards compatibility, TENANT_STAFF is deprecated
export type StaffRole = 
  | 'TENANT_MANAGER' 
  | 'KITCHEN_STAFF' 
  | 'CASHIER';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  tenant_id: string | null;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({
    enum: UserRole,
    type: 'enum',
    default: UserRole.KITCHEN_STAFF,
  })
  role: UserRole;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant, (tenant) => tenant.users, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;
}
