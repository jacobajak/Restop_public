import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { MenuCategory } from './menu-category.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  category_id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ nullable: true })
  image_url: string;

  @Column({ default: true })
  is_available: boolean;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Tenant, (tenant) => tenant.menu_items)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => MenuCategory, (category) => category.items)
  @JoinColumn({ name: 'category_id' })
  category: MenuCategory;

  @OneToMany(() => OrderItem, (item) => item.menu_item)
  order_items: OrderItem[];
}
