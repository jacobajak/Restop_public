import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../entities/platform-settings.entity';

export interface PlatformSettingsInput {
  platform_commission_rate?: { percentage: number };
  supported_payment_methods?: { methods: string[] };
  supported_countries?: { countries: string[] };
  settlement_mode?: { mode: 'INSTANT' | 'SCHEDULED' };
  settlement_retry_policy?: { max_retries: number; retry_delay_minutes: number };
  feature_flags?: Record<string, boolean>;
}

/**
 * PlatformSettingsService - Manage core platform configuration
 *
 * Loads settings on startup and caches them in memory for performance.
 * Any setting change triggers an audit log.
 *
 * Settings are keyed and can be extended as needed.
 */
@Injectable()
export class PlatformSettingsService {
  private settingsCache: Map<string, PlatformSettings> = new Map();
  private cacheInitialized = false;

  constructor(
    @InjectRepository(PlatformSettings)
    private settingsRepository: Repository<PlatformSettings>,
  ) {}

  /**
   * Initialize cache on module startup
   */
  async initializeCache() {
    if (this.cacheInitialized) return;

    const settings = await this.settingsRepository.find();
    settings.forEach((setting) => {
      this.settingsCache.set(setting.setting_key, setting);
    });

    this.cacheInitialized = true;
  }

  /**
   * Get a specific setting
   */
  async getSetting(key: string): Promise<any> {
    await this.initializeCache();

    const setting = this.settingsCache.get(key);
    if (!setting) {
      return null;
    }

    return setting.setting_value;
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Record<string, any>> {
    await this.initializeCache();

    const result: Record<string, any> = {};
    this.settingsCache.forEach((setting, key) => {
      result[key] = setting.setting_value;
    });

    return result;
  }

  /**
   * Update a setting
   */
  async updateSetting(
    key: string,
    value: any,
    description?: string,
    value_type: string = 'json',
  ): Promise<PlatformSettings> {
    await this.initializeCache();

    let setting = this.settingsCache.get(key);

    if (!setting) {
      // Create new setting
      setting = this.settingsRepository.create({
        setting_key: key,
        setting_value: value,
        description,
        value_type,
      });
    } else {
      // Update existing
      setting.setting_value = value;
      setting.description = description || setting.description;
      setting.value_type = value_type;
    }

    const saved = await this.settingsRepository.save(setting);
    this.settingsCache.set(key, saved);

    return saved;
  }

  /**
   * Get platform commission rate (default 3%)
   */
  async getPlatformCommissionRate(): Promise<number> {
    const setting = await this.getSetting('platform_commission_rate');
    return setting?.percentage || 3.0;
  }

  /**
   * Get supported payment methods
   */
  async getSupportedPaymentMethods(): Promise<string[]> {
    const setting = await this.getSetting('supported_payment_methods');
    return setting?.methods || ['CASH', 'MTN', 'AIRTEL'];
  }

  /**
   * Get supported countries
   */
  async getSupportedCountries(): Promise<string[]> {
    const setting = await this.getSetting('supported_countries');
    return setting?.countries || ['RW'];
  }

  /**
   * Get settlement mode
   */
  async getSettlementMode(): Promise<'INSTANT' | 'SCHEDULED'> {
    const setting = await this.getSetting('settlement_mode');
    return setting?.mode || 'INSTANT';
  }

  /**
   * Get feature flags
   */
  async getFeatureFlags(): Promise<Record<string, boolean>> {
    const setting = await this.getSetting('feature_flags');
    return setting || {};
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureKey: string): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    return flags[featureKey] === true;
  }

  /**
   * Invalidate cache (call after database changes outside this service)
   */
  invalidateCache() {
    this.settingsCache.clear();
    this.cacheInitialized = false;
  }
}
