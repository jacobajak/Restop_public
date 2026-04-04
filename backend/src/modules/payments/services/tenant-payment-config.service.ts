import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantPaymentConfig } from '../entities/tenant-payment-config.entity';

interface PaymentConfigDTO {
  enable_cash?: boolean;
  enable_mtn?: boolean;
  enable_airtel?: boolean;
  min_order_amount?: number;
  max_order_amount?: number;
  max_payment_retries?: number;
  payment_timeout_minutes?: number;
  auto_refund_on_cancel?: boolean;
}

/**
 * TenantPaymentConfigService
 * 
 * Manages per-tenant payment configuration
 * - Enables/disables payment methods
 * - Sets amount limits
 * - Configures payment behavior
 * 
 * Critical: Never allow invalid configurations (min > max)
 */
@Injectable()
export class TenantPaymentConfigService {
  private readonly logger = new Logger(TenantPaymentConfigService.name);

  constructor(
    @InjectRepository(TenantPaymentConfig)
    private readonly repo: Repository<TenantPaymentConfig>,
  ) {}

  /**
   * Get or create default config for tenant
   */
  async getOrCreateConfig(tenantId: string): Promise<TenantPaymentConfig> {
    try {
      let config = await this.repo.findOne({
        where: { tenant_id: tenantId },
      });

      if (!config) {
        this.logger.log(`Creating default payment config for tenant: ${tenantId}`);
        config = this.repo.create({
          tenant_id: tenantId,
          // defaults set in entity
        });
        await this.repo.save(config);
      }

      return config;
    } catch (error) {
      this.logger.error(`Error getting/creating config for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get tenant's payment configuration
   */
  async getConfig(tenantId: string): Promise<TenantPaymentConfig> {
    try {
      const config = await this.repo.findOne({
        where: { tenant_id: tenantId },
      });

      if (!config) {
        throw new NotFoundException(`Payment config not found for tenant: ${tenantId}`);
      }

      return config;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching config for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update tenant payment configuration
   * Validates: min_amount <= max_amount
   */
  async updateConfig(tenantId: string, updates: PaymentConfigDTO): Promise<TenantPaymentConfig> {
    try {
      const config = await this.getOrCreateConfig(tenantId);

      // Validation: min must be <= max
      const newMin = updates.min_order_amount ?? config.min_order_amount;
      const newMax = updates.max_order_amount ?? config.max_order_amount;
      if (newMin > newMax) {
        throw new BadRequestException(
          `min_order_amount (${newMin}) cannot exceed max_order_amount (${newMax})`,
        );
      }

      // Validation: retries must be positive
      if (updates.max_payment_retries !== undefined && updates.max_payment_retries < 1) {
        throw new BadRequestException('max_payment_retries must be at least 1');
      }

      // Validation: timeout must be positive
      if (updates.payment_timeout_minutes !== undefined && updates.payment_timeout_minutes < 5) {
        throw new BadRequestException('payment_timeout_minutes must be at least 5');
      }

      // Apply updates
      Object.assign(config, updates);
      await this.repo.save(config);

      this.logger.log(`Updated payment config for tenant: ${tenantId}`);
      return config;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error updating config for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if payment method is enabled for tenant
   */
  async isPaymentMethodEnabled(tenantId: string, method: 'cash' | 'mtn' | 'airtel'): Promise<boolean> {
    try {
      const config = await this.getConfig(tenantId);

      const fieldMap = {
        cash: 'enable_cash',
        mtn: 'enable_mtn',
        airtel: 'enable_airtel',
      };

      return config[fieldMap[method]] === true;
    } catch (error) {
      this.logger.error(`Error checking if ${method} enabled for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if order amount is within allowed limits
   */
  async validateOrderAmount(tenantId: string, amount: number): Promise<{ valid: boolean; reason?: string }> {
    try {
      const config = await this.getConfig(tenantId);

      if (amount < config.min_order_amount) {
        return {
          valid: false,
          reason: `Amount (${amount}) below minimum (${config.min_order_amount})`,
        };
      }

      if (amount > config.max_order_amount) {
        return {
          valid: false,
          reason: `Amount (${amount}) exceeds maximum (${config.max_order_amount})`,
        };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error(`Error validating order amount for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get max retry attempts for tenant
   */
  async getMaxRetries(tenantId: string): Promise<number> {
    try {
      const config = await this.getConfig(tenantId);
      return config.max_payment_retries;
    } catch (error) {
      this.logger.error(`Error getting max retries for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get payment timeout setting
   */
  async getPaymentTimeout(tenantId: string): Promise<number> {
    try {
      const config = await this.getConfig(tenantId);
      return config.payment_timeout_minutes;
    } catch (error) {
      this.logger.error(`Error getting payment timeout for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if auto-refund is enabled for cancellations
   */
  async isAutoRefundEnabled(tenantId: string): Promise<boolean> {
    try {
      const config = await this.getConfig(tenantId);
      return config.auto_refund_on_cancel;
    } catch (error) {
      this.logger.error(`Error checking auto-refund for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all enabled payment methods for tenant
   */
  async getEnabledPaymentMethods(tenantId: string): Promise<string[]> {
    try {
      const config = await this.getConfig(tenantId);
      const methods: string[] = [];

      if (config.enable_cash) methods.push('cash');
      if (config.enable_mtn) methods.push('mtn');
      if (config.enable_airtel) methods.push('airtel');

      return methods;
    } catch (error) {
      this.logger.error(`Error getting enabled methods for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }
}
