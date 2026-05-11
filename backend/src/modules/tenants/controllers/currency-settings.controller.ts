import { Controller, Get, Post, Param, UseGuards, Body, BadRequestException, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrencyService } from '../../../common/services/currency.service';
import { ExchangeRateService } from '../../../common/services/exchange-rate.service';
import { CurrencyConverterService } from '../../../common/services/currency-converter.service';
import { TenantsService } from '../services/tenants.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { AFRICAN_COUNTRIES, getCountryByCode } from '../../../common/constants/african-countries';

/**
 * Currency Settings Controller
 * 
 * Manages multi-currency operations for tenants
 * - View supported currencies and their metadata
 * - Get/set tenant currency
 * - Get exchange rates
 * - Preview currency conversions
 */
@Controller('currencies')
export class CurrencySettingsController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Get all supported currencies (public)
   * Returns list of all African country currencies with metadata
   */
  @Get()
  async getAllCurrencies() {
    const currencies = this.currencyService.getAllCurrencies();
    return {
      success: true,
      data: {
        total: currencies.length,
        currencies,
      },
    };
  }

  /**
   * Get currency summary (public)
   * Returns overview of supported currencies
   */
  @Get('summary')
  async getCurrencySummary() {
    const summary = this.currencyService.getCurrencySummary();
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get all African countries with currencies (public)
   * Used for country/currency selection in UI
   */
  @Get('countries')
  async getCountriesWithCurrencies() {
    const countries = this.currencyService.getAllAfricanCountries(true);
    return {
      success: true,
      data: {
        total: countries.length,
        countries,
      },
    };
  }

  /**
   * Get currencies by region (public)
   * Example: /currencies/region/east
   */
  @Get('region/:region')
  async getCurrenciesByRegion(
    @Param('region') region: 'east' | 'central' | 'west' | 'south' | 'north' | 'island',
  ) {
    const validRegions = ['east', 'central', 'west', 'south', 'north', 'island'];
    if (!validRegions.includes(region)) {
      throw new BadRequestException(
        `Invalid region. Must be one of: ${validRegions.join(', ')}`,
      );
    }

    const currencies = this.currencyService.getCurrenciesByRegion(region);
    return {
      success: true,
      data: {
        region,
        total: currencies.length,
        currencies,
      },
    };
  }

  /**
   * Get currency metadata by code (public)
   * Example: /currencies/metadata/KES
   */
  @Get('metadata/:code')
  async getCurrencyMetadata(@Param('code') code: string) {
    const metadata = this.currencyService.getCurrencyMetadata(code);
    return {
      success: true,
      data: metadata,
    };
  }

  /**
   * Get current tenant's currency settings (authenticated)
   */
  @Get('tenant/settings')
  @UseGuards(JwtAuthGuard)
  async getCurrentTenantCurrencies(@GetUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not have a tenant');
    }

    const tenant = await this.tenantsService.getTenantById(user.tenantId);
    const countryInfo = getCountryByCode(tenant.country_code);

    return {
      success: true,
      data: {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        current_currency: tenant.currency,
        country_code: tenant.country_code,
        country_name: tenant.country_name,
        country_info: countryInfo,
        metadata: this.currencyService.getCurrencyMetadata(tenant.currency),
      },
    };
  }

  /**
   * Update tenant's currency (authenticated, tenant owner only)
   * Validates currency is supported and updates tenant
   */
  @Post('tenant/settings/currency')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async updateTenantCurrency(
    @GetUser() user: JwtPayload,
    @Body() body: { currency: string },
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not have a tenant');
    }

    if (!body.currency) {
      throw new BadRequestException('Currency code is required');
    }

    if (!this.currencyService.isValidCurrency(body.currency)) {
      throw new BadRequestException(`Unsupported currency: ${body.currency}`);
    }

    const updatedTenant = await this.tenantsService.updateTenant(user.tenantId, {
      currency: body.currency,
    });

    return {
      success: true,
      message: `Tenant currency updated to ${body.currency}`,
      data: {
        tenant_id: updatedTenant.id,
        new_currency: updatedTenant.currency,
        metadata: this.currencyService.getCurrencyMetadata(updatedTenant.currency),
      },
    };
  }

  /**
   * Update tenant's country (authenticated, tenant owner only)
   * Automatically updates currency to that country's default currency
   */
  @Post('tenant/settings/country')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async updateTenantCountry(
    @GetUser() user: JwtPayload,
    @Body() body: { country_code: string },
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not have a tenant');
    }

    if (!body.country_code) {
      throw new BadRequestException('Country code is required');
    }

    const country = getCountryByCode(body.country_code);
    if (!country) {
      throw new BadRequestException(`Unsupported country: ${body.country_code}`);
    }

    const updatedTenant = await this.tenantsService.updateTenant(user.tenantId, {
      country_code: body.country_code,
      country_name: country.name,
      currency: country.currency,
    });

    return {
      success: true,
      message: `Tenant country updated to ${country.name}`,
      data: {
        tenant_id: updatedTenant.id,
        country_code: updatedTenant.country_code,
        country_name: updatedTenant.country_name,
        currency: updatedTenant.currency,
        currency_metadata: this.currencyService.getCurrencyMetadata(updatedTenant.currency),
      },
    };
  }

  /**
   * Get list of all regions (public)
   */
  @Get('regions/list')
  async getAllRegions() {
    const regions = this.currencyService.getAllRegions();
    return {
      success: true,
      data: {
        total: regions.length,
        regions,
      },
    };
  }

  /**
   * Get exchange rate between two currencies (public)
   * Example: /currencies/exchange-rate?from=KES&to=RWF
   */
  @Get('exchange-rate')
  async getExchangeRate(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('Both "from" and "to" parameters are required');
    }

    if (!this.currencyService.isValidCurrency(from)) {
      throw new BadRequestException(`Unsupported source currency: ${from}`);
    }

    if (!this.currencyService.isValidCurrency(to)) {
      throw new BadRequestException(`Unsupported target currency: ${to}`);
    }

    const rate = await this.exchangeRateService.getExchangeRate(from, to);

    return {
      success: true,
      data: {
        from: rate.from,
        to: rate.to,
        rate: rate.rate,
        source: rate.source,
        timestamp: rate.timestamp,
      },
    };
  }

  /**
   * Convert amount between currencies (public)
   * Example: POST /currencies/convert { amount: 1000, from: "KES", to: "RWF" }
   */
  @Post('convert')
  async convertCurrency(
    @Body() body: { amount: number; from: string; to: string },
  ) {
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    if (!body.from || !body.to) {
      throw new BadRequestException('Both "from" and "to" currencies are required');
    }

    const conversion = await this.currencyConverterService.convert(
      body.amount,
      body.from,
      body.to,
    );

    return {
      success: true,
      data: {
        original: {
          amount: conversion.originalAmount,
          currency: conversion.originalCurrency,
        },
        converted: {
          amount: conversion.convertedAmount,
          currency: conversion.convertedCurrency,
        },
        exchange_rate: conversion.exchangeRate,
        source: conversion.source,
        timestamp: conversion.timestamp,
      },
    };
  }

  /**
   * Convert with fee (public)
   * Example: POST /currencies/convert-with-fee { amount: 1000, from: "KES", to: "RWF", feePercentage: 2.5 }
   */
  @Post('convert-with-fee')
  async convertWithFee(
    @Body() body: { amount: number; from: string; to: string; feePercentage?: number },
  ) {
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    if (!body.from || !body.to) {
      throw new BadRequestException('Both "from" and "to" currencies are required');
    }

    const feePercentage = body.feePercentage || 0;
    const conversion = await this.currencyConverterService.convertWithFee(
      body.amount,
      body.from,
      body.to,
      feePercentage,
    );

    return {
      success: true,
      data: {
        original: {
          amount: conversion.originalAmount,
          currency: conversion.originalCurrency,
        },
        converted: {
          amount: conversion.convertedAmount,
          currency: conversion.convertedCurrency,
        },
        fee: {
          percentage: conversion.feePercentage,
          amount: conversion.feeAmount,
        },
        total_with_fee: conversion.totalAmount,
        exchange_rate: conversion.exchangeRate,
        source: conversion.source,
        timestamp: conversion.timestamp,
      },
    };
  }

  /**
   * Get exchange rates for multiple target currencies (public)
   * Example: POST /currencies/exchange-rates { from: "KES", to: ["RWF", "UGX", "TZS"] }
   */
  @Post('exchange-rates')
  async getMultipleExchangeRates(
    @Body() body: { from: string; to: string[] },
  ) {
    if (!body.from || !body.to || body.to.length === 0) {
      throw new BadRequestException('Source currency and target currencies array are required');
    }

    if (!this.currencyService.isValidCurrency(body.from)) {
      throw new BadRequestException(`Unsupported source currency: ${body.from}`);
    }

    for (const toCurrency of body.to) {
      if (!this.currencyService.isValidCurrency(toCurrency)) {
        throw new BadRequestException(`Unsupported target currency: ${toCurrency}`);
      }
    }

    const rates = await this.exchangeRateService.getMultipleExchangeRates(
      body.from,
      body.to,
    );

    return {
      success: true,
      data: {
        source: body.from,
        rates: rates.map(r => ({
          to: r.to,
          rate: r.rate,
          timestamp: r.timestamp,
          source: r.source,
        })),
      },
    };
  }

  /**
   * Format amount as currency string (public)
   * Example: GET /currencies/format?amount=1000.50&currency=KES
   */
  @Get('format')
  async formatCurrency(
    @Query('amount') amount: string,
    @Query('currency') currency: string,
  ) {
    if (!amount || !currency) {
      throw new BadRequestException('Both amount and currency are required');
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      throw new BadRequestException('Amount must be a valid number');
    }

    const formatted = this.currencyService.formatCurrency(numAmount, currency);

    return {
      success: true,
      data: {
        amount: numAmount,
        currency,
        formatted,
        metadata: this.currencyService.getCurrencyMetadata(currency),
      },
    };
  }
}
