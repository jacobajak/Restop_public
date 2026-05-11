import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Order } from '../../orders/entities/order.entity';
import { Table } from '../../tables/entities/table.entity';
import { StaffMember } from '../../users/entities/staff-member.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  location: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ default: 'RWF' })
  currency: string;

  @Column({ nullable: true, comment: 'African country code (e.g., RW, KE, TZ, UG, GH)' })
  country_code: string;

  @Column({ nullable: true, comment: 'Full country name (e.g., Rwanda, Kenya, Tanzania)' })
  country_name: string;

  @Column({ nullable: true })
  qr_code_url: string;

  @Column({ nullable: true })
  qr_code_data: string;

  @Column({ default: 'ACTIVE', nullable: true, comment: 'Restaurant status: ACTIVE, SUSPENDED, or ARCHIVED' })
  status: string;

  @Column({ nullable: true, comment: 'Reason for suspension (if status = SUSPENDED)' })
  suspended_reason: string;

  @Column({ nullable: true, comment: 'Timestamp when restaurant was suspended' })
  suspended_at: Date;

  @Column({ nullable: true, comment: 'Admin user ID who suspended this restaurant' })
  suspended_by_admin_id: string;

  @Column({ nullable: true, comment: 'Timestamp when restaurant was archived (soft delete)' })
  archived_at: Date;

  @Column({ nullable: true, comment: 'Admin user ID who archived this restaurant' })
  archived_by_admin_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => StaffMember, (staff) => staff.tenant)
  staff_members: StaffMember[];

  @OneToMany(() => MenuItem, (item) => item.tenant)
  menu_items: MenuItem[];

  @OneToMany(() => Order, (order) => order.tenant)
  orders: Order[];

  @OneToMany(() => Table, (table) => table.tenant)
  tables: Table[];
}
