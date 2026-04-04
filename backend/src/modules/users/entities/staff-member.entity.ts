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
import { User } from './user.entity';

export enum StaffRole {
  MANAGER = 'MANAGER',
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  CASHIER = 'CASHIER',
}

@Entity('staff_members')
export class StaffMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid', { nullable: true })
  user_id: string | null;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({
    enum: StaffRole,
    type: 'enum',
  })
  role: StaffRole;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  invitation_token: string;

  @Column({ nullable: true })
  invitation_expires_at: Date;

  @Column({ nullable: true })
  invited_by: string; // user_id of who invited

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Tenant, (tenant) => tenant.staff_members, { eager: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
