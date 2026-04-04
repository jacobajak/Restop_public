import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * PlatformSettings - Core platform configuration
 *
 * Stores:
 * - Platform commission/fee rates
 * - Supported payment methods
 * - Supported countries
 * - Settlement mode and timing
 * - Retry policies
 * - Feature flags
 *
 * Uses singleton pattern - typically one row but entity structure allows future extensibility
 */
@Entity('platform_settings')
@Index(['setting_key'], { unique: true })
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    unique: true,
    comment: 'Configuration key (e.g., platform_commission_rate, settlement_mode)',
  })
  setting_key: string;

  @Column({
    type: 'jsonb',
    comment: 'Configuration value (supports any JSON structure)',
  })
  setting_value: Record<string, any>;

  @Column({
    nullable: true,
    comment: 'Human-readable description of this setting',
  })
  description: string;

  @Column({
    default: 'text',
    comment: 'Type hint for UI rendering (text, number, boolean, json)',
  })
  value_type: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Default platform settings keys:
 *
 * platform_commission_rate: { percentage: 3.0 }
 * - Default 3% commission on all orders
 *
 * supported_payment_methods: { methods: ['CASH', 'MTN', 'AIRTEL'] }
 *
 * supported_countries: { countries: ['RW', 'UG', 'KE'] }
 *
 * settlement_mode: { mode: 'INSTANT' | 'SCHEDULED' }
 * - INSTANT: Payout immediately after payment
 * - SCHEDULED: Batch payouts at set times
 *
 * settlement_retry_policy: { max_retries: 3, retry_delay_minutes: 5 }
 *
 * feature_flags: {
 *   enable_admin_panel: true,
 *   enable_support_issues: true,
 *   enable_2fa: false
 * }
 */
