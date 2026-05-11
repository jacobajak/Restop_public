import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
  source: string;
}

/**
 * Service for managing exchange rates between African currencies
 * Supports caching and fallback rates
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private rateCache: Map<string, ExchangeRate> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 3600000; // 1 hour

  /**
   * Fallback exchange rates (USD as base)
   * In production, these would be fetched from an external service
   * Format: "CURRENCY/CURRENCY": rate
   */
  private readonly FALLBACK_RATES: Record<string, number> = {
    // USD base rates (approximate, for fallback only)
    'USD/RWF': 1300,
    'USD/KES': 155,
    'USD/TZS': 2700,
    'USD/UGX': 3800,
    'USD/ETB': 60,
    'USD/GHS': 15,
    'USD/NGN': 1500,
    'USD/ZAR': 19,
    'USD/EGP': 50,

    // Regional rates (approximate examples)
    'KES/RWF': 8.4,
    'TZS/RWF': 0.48,
    'UGX/RWF': 0.34,
    'GHS/RWF': 86.7,
    'ZAR/RWF': 68.4,
    'EGP/RWF': 26,

    // Reverse rates (same as forward for now)
    'RWF/USD': 1 / 1300,
    'KES/USD': 1 / 155,
    'TZS/USD': 1 / 2700,
    'UGX/USD': 1 / 3800,
    'ETB/USD': 1 / 60,
    'GHS/USD': 1 / 15,
    'NGN/USD': 1 / 1500,
    'ZAR/USD': 1 / 19,
    'EGP/USD': 1 / 50,

    'RWF/KES': 1 / 8.4,
    'RWF/TZS': 1 / 0.48,
    'RWF/UGX': 1 / 0.34,
    'RWF/GHS': 1 / 86.7,
    'RWF/ZAR': 1 / 68.4,
    'RWF/EGP': 1 / 26,
  };

  constructor(private configService: ConfigService) {
    this.initializeFallbackRates();
  }

  /**
   * Initialize fallback rates in cache
   */
  private initializeFallbackRates(): void {
    const now = Date.now();
    Object.entries(this.FALLBACK_RATES).forEach(([pair, rate]) => {
      const [from, to] = pair.split('/');
      const key = this.getCacheKey(from, to);
      this.rateCache.set(key, {
        from,
        to,
        rate,
        timestamp: new Date(),
        source: 'fallback',
      });
      this.cacheExpiry.set(key, now + this.CACHE_TTL_MS);
    });
  }

  /**
   * Get exchange rate from one currency to another
   * @param fromCurrency Source currency code (e.g., 'KES')
   * @param toCurrency Target currency code (e.g., 'RWF')
   * @returns ExchangeRate object with rate and metadata
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    if (fromCurrency === toCurrency) {
      return {
        from: fromCurrency,
        to: toCurrency,
        rate: 1,
        timestamp: new Date(),
        source: 'identity',
      };
    }

    const cacheKey = this.getCacheKey(fromCurrency, toCurrency);

    // Check if rate is cached and not expired
    if (this.isRateCached(cacheKey)) {
      const cachedRate = this.rateCache.get(cacheKey);
      if (cachedRate) {
        return cachedRate;
      }
    }

    try {
      // In production, fetch from external provider here
      // For now, use fallback rates
      const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);
      
      const exchangeRate: ExchangeRate = {
        from: fromCurrency,
        to: toCurrency,
        rate,
        timestamp: new Date(),
        source: 'provider',
      };

      // Cache the rate
      this.rateCache.set(cacheKey, exchangeRate);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);

      return exchangeRate;
    } catch (error) {
      this.logger.error(`Failed to get exchange rate for ${fromCurrency}/${toCurrency}:`, error);
      
      // Fall back to cached fallback rate
      const fallbackRate = this.rateCache.get(cacheKey);
      if (fallbackRate) {
        return fallbackRate;
      }

      throw new InternalServerErrorException(
        `Unable to fetch exchange rate for ${fromCurrency}/${toCurrency}`,
      );
    }
  }

  /**
   * Get multiple exchange rates at once
   */
  async getMultipleExchangeRates(
    fromCurrency: string,
    toCurrencies: string[],
  ): Promise<ExchangeRate[]> {
    return Promise.all(
      toCurrencies.map(toCurrency => this.getExchangeRate(fromCurrency, toCurrency)),
    );
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ amount: number; rate: number; converted: number; timestamp: Date }> {
    if (amount < 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);

    return {
      amount,
      rate: exchangeRate.rate,
      converted: amount * exchangeRate.rate,
      timestamp: exchangeRate.timestamp,
    };
  }

  /**
   * Update a specific exchange rate (for admin operations)
   */
  updateExchangeRate(fromCurrency: string, toCurrency: string, rate: number): void {
    if (rate <= 0) {
      throw new BadRequestException('Exchange rate must be positive');
    }

    const cacheKey = this.getCacheKey(fromCurrency, toCurrency);
    const exchangeRate: ExchangeRate = {
      from: fromCurrency,
      to: toCurrency,
      rate,
      timestamp: new Date(),
      source: 'manual',
    };

    this.rateCache.set(cacheKey, exchangeRate);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);

    // Update reverse rate
    const reverseCacheKey = this.getCacheKey(toCurrency, fromCurrency);
    const reverseRate: ExchangeRate = {
      from: toCurrency,
      to: fromCurrency,
      rate: 1 / rate,
      timestamp: new Date(),
      source: 'manual',
    };
    this.rateCache.set(reverseCacheKey, reverseRate);
    this.cacheExpiry.set(reverseCacheKey, Date.now() + this.CACHE_TTL_MS);

    this.logger.log(
      `Exchange rate updated: ${fromCurrency}/${toCurrency} = ${rate}`,
    );
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.rateCache.clear();
    this.cacheExpiry.clear();
    this.initializeFallbackRates();
    this.logger.log('Exchange rate cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; expiredCount: number } {
    let expiredCount = 0;
    const now = Date.now();

    this.cacheExpiry.forEach(expiry => {
      if (expiry < now) {
        expiredCount++;
      }
    });

    return {
      size: this.rateCache.size,
      expiredCount,
    };
  }

  /**
   * Get all cached rates
   */
  getAllCachedRates(): ExchangeRate[] {
    return Array.from(this.rateCache.values());
  }

  /**
   * Private helper methods
   */

  private getCacheKey(from: string, to: string): string {
    return `${from}/${to}`;
  }

  private isRateCached(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (!expiry) return false;
    return expiry > Date.now();
  }

  /**
   * Fetch exchange rate from provider
   * TODO: Replace with actual API call to exchange rate provider
   * Possible providers:
   * - OpenExchangeRates (https://openexchangerates.org/)
   * - Fixer (https://fixer.io/)
   * - Europa Bank (https://www.ecb.europa.eu/)
   * - Xe.com API
   */
  private async fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // For now, use fallback rates
    const fallbackKey = `${fromCurrency}/${toCurrency}`;
    const rate = this.FALLBACK_RATES[fallbackKey];

    if (!rate) {
      throw new InternalServerErrorException(
        `No exchange rate available for ${fromCurrency}/${toCurrency}`,
      );
    }

    return rate;
  }

  /**
   * Initialize exchange rate provider (called on module init)
   * In production, this would connect to an external API
   */
  async initializeProvider(): Promise<void> {
    try {
      const apiKey = this.configService.get('EXCHANGE_RATE_API_KEY');
      const provider = this.configService.get('EXCHANGE_RATE_PROVIDER', 'fallback');

      this.logger.log(`Exchange rate provider initialized: ${provider}`);

      // TODO: Connect to provider API
      // if (provider === 'openexchangerates' && apiKey) {
      //   await this.initializeOpenExchangeRates(apiKey);
      // } else if (provider === 'fixer' && apiKey) {
      //   await this.initializeFixer(apiKey);
      // }
    } catch (error) {
      this.logger.warn('Failed to initialize exchange rate provider, using fallback rates');
    }
  }
}
