import { Injectable, BadRequestException } from '@nestjs/common';
import { AFRICAN_COUNTRIES, getCountryByCode } from '../constants/african-countries';
import {
  CurrencyMetadata,
  CURRENCIES,
  getCurrencyMetadata,
  formatCurrency as formatCurrencyUtil,
  isValidCurrency,
  getAllCurrencyCodes,
} from '../constants/currencies';

/**
 * Service for managing multi-currency operations
 * Provides validation, formatting, and currency information
 */
@Injectable()
export class CurrencyService {
  /**
   * Get all supported currencies
   */
  getAllCurrencies(): CurrencyMetadata[] {
    return Object.values(CURRENCIES);
  }

  /**
   * Get all supported currency codes
   */
  getAllCurrencyCodes(): string[] {
    return getAllCurrencyCodes();
  }

  /**
   * Get currency metadata by code
   */
  getCurrencyMetadata(code: string): CurrencyMetadata {
    const currency = getCurrencyMetadata(code);
    if (!currency) {
      throw new BadRequestException(`Unsupported currency: ${code}`);
    }
    return currency;
  }

  /**
   * Get currency by country code
   */
  getCurrencyByCountryCode(countryCode: string): string {
    const country = getCountryByCode(countryCode);
    if (!country) {
      throw new BadRequestException(`Unsupported country: ${countryCode}`);
    }
    return country.currency;
  }

  /**
   * Validate currency code
   */
  isValidCurrency(code: string): boolean {
    return isValidCurrency(code);
  }

  /**
   * Format amount as currency string
   * Example: formatCurrency(1000, 'KES') => 'KSh1,000.00'
   */
  formatCurrency(amount: number, currencyCode: string): string {
    if (!this.isValidCurrency(currencyCode)) {
      throw new BadRequestException(`Unsupported currency: ${currencyCode}`);
    }
    return formatCurrencyUtil(amount, currencyCode);
  }

  /**
   * Get all African countries with their supported currencies
   */
  getAllAfricanCountries(withMetadata = false) {
    return AFRICAN_COUNTRIES.map(country => ({
      code: country.code,
      name: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      currencyName: country.currencyName,
      ...(withMetadata && {
        currencyMetadata: this.getCurrencyMetadata(country.currency),
      }),
    }));
  }

  /**
   * Get supported currencies for a region
   */
  getCurrenciesByRegion(region: 'east' | 'central' | 'west' | 'south' | 'north' | 'island'): any[] {
    const regionMap = {
      east: ['RW', 'KE', 'TZ', 'UG', 'ET', 'DJ', 'SS'],
      central: ['CM', 'CG', 'CD', 'GA'],
      west: ['GH', 'NG', 'SN', 'CI', 'BJ', 'BF', 'ML', 'NE', 'TG', 'LR', 'SL', 'GM'],
      south: ['ZA', 'BW', 'ZM', 'ZW', 'MW', 'MZ', 'SZ', 'LS'],
      north: ['EG', 'DZ', 'MA', 'TN', 'LY', 'SD'],
      island: ['MU', 'SC', 'CV'],
    };

    const codes = regionMap[region] || [];
    return AFRICAN_COUNTRIES.filter(country => codes.includes(country.code)).map(country => ({
      code: country.code,
      name: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      currencyName: country.currencyName,
      metadata: this.getCurrencyMetadata(country.currency),
    }));
  }

  /**
   * Validate currency conversion is possible
   * (All African currencies are supported, so this always returns true)
   */
  canConvert(fromCurrency: string, toCurrency: string): boolean {
    return this.isValidCurrency(fromCurrency) && this.isValidCurrency(toCurrency);
  }

  /**
   * Get decimal places for currency (needed for rounding)
   */
  getDecimalPlaces(currencyCode: string): number {
    const metadata = this.getCurrencyMetadata(currencyCode);
    return metadata.decimalPlaces;
  }

  /**
   * Get default currency for a tenant based on country
   */
  getDefaultCurrencyForCountry(countryCode: string): string {
    const country = getCountryByCode(countryCode);
    if (!country) {
      return 'RWF'; // Fallback default
    }
    return country.currency;
  }

  /**
   * Get all regions
   */
  getAllRegions(): Array<{ region: string; name: string; countries: number }> {
    const regions = {
      east: { name: 'East Africa', count: 7 },
      central: { name: 'Central Africa', count: 4 },
      west: { name: 'West Africa', count: 12 },
      south: { name: 'Southern Africa', count: 8 },
      north: { name: 'North Africa', count: 6 },
      island: { name: 'Island Nations', count: 3 },
    };

    return Object.entries(regions).map(([region, data]) => ({
      region,
      name: data.name,
      countries: data.count,
    }));
  }

  /**
   * Get summary of currency coverage
   */
  getCurrencySummary() {
    const allCurrencies = new Set(AFRICAN_COUNTRIES.map(c => c.currency));
    return {
      totalCountries: AFRICAN_COUNTRIES.length,
      uniqueCurrencies: allCurrencies.size,
      currencies: Array.from(allCurrencies).sort(),
      regions: this.getAllRegions(),
    };
  }
}
