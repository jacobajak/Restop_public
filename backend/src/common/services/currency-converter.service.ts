import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ExchangeRateService, ExchangeRate } from './exchange-rate.service';
import { CurrencyService } from './currency.service';
import { roundCurrency, toMinorUnits, fromMinorUnits } from '../constants/currencies';

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
  source: string;
  timestamp: Date;
}

export interface ConversionWithFee extends CurrencyConversion {
  feePercentage: number;
  feeAmount: number;
  totalAmount: number;
}

/**
 * Service for converting amounts between currencies
 * Handles precision, rounding, and fees
 */
@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);

  constructor(
    private exchangeRateService: ExchangeRateService,
    private currencyService: CurrencyService,
  ) {}

  /**
   * Convert amount from one currency to another
   * @param amount Amount to convert
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @returns Conversion result with all details
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<CurrencyConversion> {
    if (amount < 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (!this.currencyService.isValidCurrency(fromCurrency)) {
      throw new BadRequestException(`Unsupported source currency: ${fromCurrency}`);
    }

    if (!this.currencyService.isValidCurrency(toCurrency)) {
      throw new BadRequestException(`Unsupported target currency: ${toCurrency}`);
    }

    // Get exchange rate
    const exchangeRate = await this.exchangeRateService.getExchangeRate(
      fromCurrency,
      toCurrency,
    );

    // Convert amount
    let convertedAmount = amount * exchangeRate.rate;

    // Round according to target currency decimal places
    convertedAmount = roundCurrency(convertedAmount, toCurrency, 'round');

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount,
      convertedCurrency: toCurrency,
      exchangeRate: exchangeRate.rate,
      source: exchangeRate.source,
      timestamp: exchangeRate.timestamp,
    };
  }

  /**
   * Convert amount with fee (e.g., for processing fees)
   * @param amount Amount to convert
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @param feePercentage Fee percentage (e.g., 2.5 for 2.5%)
   * @returns Conversion with fee breakdown
   */
  async convertWithFee(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    feePercentage: number = 0,
  ): Promise<ConversionWithFee> {
    if (feePercentage < 0 || feePercentage > 100) {
      throw new BadRequestException('Fee percentage must be between 0 and 100');
    }

    const conversion = await this.convert(amount, fromCurrency, toCurrency);

    const feeAmount = roundCurrency(
      (conversion.convertedAmount * feePercentage) / 100,
      toCurrency,
      'round',
    );

    const totalAmount = roundCurrency(
      conversion.convertedAmount + feeAmount,
      toCurrency,
      'round',
    );

    return {
      ...conversion,
      feePercentage,
      feeAmount,
      totalAmount,
    };
  }

  /**
   * Batch convert amount to multiple currencies
   * @param amount Amount to convert
   * @param fromCurrency Source currency code
   * @param toCurrencies Array of target currency codes
   * @returns Array of conversions
   */
  async convertToMultiple(
    amount: number,
    fromCurrency: string,
    toCurrencies: string[],
  ): Promise<CurrencyConversion[]> {
    return Promise.all(
      toCurrencies.map(toCurrency => this.convert(amount, fromCurrency, toCurrency)),
    );
  }

  /**
   * Convert amount from payment processing units (minor units) to currency
   * Useful when converting payment gateway responses
   */
  async convertFromMinorUnits(
    minorAmount: number,
    currency: string,
  ): Promise<number> {
    if (!this.currencyService.isValidCurrency(currency)) {
      throw new BadRequestException(`Unsupported currency: ${currency}`);
    }

    return fromMinorUnits(minorAmount, currency);
  }

  /**
   * Convert amount to payment processing units (minor units)
   * Useful when sending to payment gateway
   */
  async convertToMinorUnits(
    amount: number,
    currency: string,
  ): Promise<number> {
    if (!this.currencyService.isValidCurrency(currency)) {
      throw new BadRequestException(`Unsupported currency: ${currency}`);
    }

    return toMinorUnits(amount, currency);
  }

  /**
   * Normalize amount for a specific currency
   * Rounds to appropriate decimal places and validates format
   */
  normalizeAmount(
    amount: number,
    currency: string,
    roundingMode: 'round' | 'floor' | 'ceil' = 'round',
  ): number {
    if (!this.currencyService.isValidCurrency(currency)) {
      throw new BadRequestException(`Unsupported currency: ${currency}`);
    }

    if (amount < 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return roundCurrency(amount, currency, roundingMode);
  }

  /**
   * Get conversion chain for multiple conversions
   * Useful for finding best conversion path or calculating multi-hop conversions
   */
  async getConversionChain(
    amount: number,
    currencies: string[],
  ): Promise<CurrencyConversion[]> {
    if (currencies.length < 2) {
      throw new BadRequestException('At least 2 currencies required');
    }

    const chain: CurrencyConversion[] = [];
    let currentAmount = amount;
    let currentCurrency = currencies[0];

    for (let i = 1; i < currencies.length; i++) {
      const nextCurrency = currencies[i];
      const conversion = await this.convert(currentAmount, currentCurrency, nextCurrency);
      chain.push(conversion);

      currentAmount = conversion.convertedAmount;
      currentCurrency = nextCurrency;
    }

    return chain;
  }

  /**
   * Calculate equivalent amounts in multiple currencies
   * Useful for displaying prices in different currencies
   */
  async getEquivalentAmounts(
    amount: number,
    fromCurrency: string,
  ): Promise<Map<string, number>> {
    const allCurrencies = this.currencyService.getAllCurrencyCodes();
    const conversions = await this.convertToMultiple(amount, fromCurrency, allCurrencies);

    const equivalents = new Map<string, number>();
    conversions.forEach(conversion => {
      equivalents.set(conversion.convertedCurrency, conversion.convertedAmount);
    });

    return equivalents;
  }

  /**
   * Calculate payment split in multiple currencies
   * Useful for splitting payments across vendor settlements
   */
  async calculatePaymentSplit(
    totalAmount: number,
    fromCurrency: string,
    splits: Array<{ toCurrency: string; percentage: number }>,
  ): Promise<Array<{ currency: string; amount: number }>> {
    // Validate percentages sum to 100
    const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException(`Split percentages must total 100% (got ${totalPercentage}%)`);
    }

    const results: Array<{ currency: string; amount: number }> = [];

    for (const split of splits) {
      const splitAmount = roundCurrency(
        (totalAmount * split.percentage) / 100,
        fromCurrency,
        'round',
      );

      const conversion = await this.convert(splitAmount, fromCurrency, split.toCurrency);
      results.push({
        currency: split.toCurrency,
        amount: conversion.convertedAmount,
      });
    }

    return results;
  }

  /**
   * Get conversion rate history (stub for future implementation)
   */
  async getConversionHistory(
    fromCurrency: string,
    toCurrency: string,
    limit: number = 100,
  ): Promise<ExchangeRate[]> {
    // This would be expanded to return historical rates from a database
    // For now, just return the current rate
    const currentRate = await this.exchangeRateService.getExchangeRate(
      fromCurrency,
      toCurrency,
    );
    return [currentRate];
  }

  /**
   * Validate conversion is possible between currencies
   */
  canConvert(fromCurrency: string, toCurrency: string): boolean {
    return (
      this.currencyService.isValidCurrency(fromCurrency) &&
      this.currencyService.isValidCurrency(toCurrency)
    );
  }

  /**
   * Get detailed conversion information
   */
  async getConversionInfo(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{
    original: { amount: number; currency: string };
    converted: { amount: number; currency: string };
    rate: number;
    inverse: number;
    fromMetadata: any;
    toMetadata: any;
    timestamp: Date;
  }> {
    const conversion = await this.convert(amount, fromCurrency, toCurrency);
    const fromMetadata = this.currencyService.getCurrencyMetadata(fromCurrency);
    const toMetadata = this.currencyService.getCurrencyMetadata(toCurrency);

    return {
      original: { amount: conversion.originalAmount, currency: fromCurrency },
      converted: { amount: conversion.convertedAmount, currency: toCurrency },
      rate: conversion.exchangeRate,
      inverse: 1 / conversion.exchangeRate,
      fromMetadata,
      toMetadata,
      timestamp: conversion.timestamp,
    };
  }
}
