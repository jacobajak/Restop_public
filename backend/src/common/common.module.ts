import { Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { CurrencyService } from './services/currency.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { CurrencyConverterService } from './services/currency-converter.service';
import {
  PaymentRateLimitGuard,
  PaymentInitiationFraudGuard,
  WebhookRateLimitGuard,
  AdminRateLimitGuard,
  RefundRateLimitGuard,
  CustomRateLimitGuard,
} from './guards/rate-limit.guard';

/**
 * CommonModule
 * 
 * Provides shared services, guards, and utilities for all modules
 * Exports:
 * - CacheService: Redis-based caching for frequently accessed data
 * - RateLimiterService: Distributed rate limiting using Redis
 * - CurrencyService: Multi-currency support for all African countries
 * - ExchangeRateService: Exchange rate management and caching
 * - CurrencyConverterService: Currency conversion with fees and precision
 * - Rate Limit Guards: Protection for API endpoints
 *   - PaymentRateLimitGuard: 100 req/min per tenant on payment endpoints
 *   - PaymentInitiationFraudGuard: 30 attempts/hour per tenant (fraud prevention)
 *   - WebhookRateLimitGuard: 1000 req/hour per IP + 500 req/min per provider (DOS protection)
 *   - AdminRateLimitGuard: 200 req/min per admin user
 *   - RefundRateLimitGuard: 5 refund requests/hour per user
 *   - CustomRateLimitGuard: Configurable rate limiter for custom endpoints
 * 
 * Features:
 * - Sliding window rate limiting algorithms
 * - Per-tenant, per-user, per-IP rate limiting
 * - Burst detection for attack identification
 * - Rate limit headers (X-RateLimit-*) on all responses
 * - Graceful degradation if Redis is unavailable
 * - Multi-currency support (39 African countries)
 * - Real-time exchange rate conversion
 * - Currency formatting and validation
 */
@Module({
  providers: [
    CacheService,
    RateLimiterService,
    CurrencyService,
    ExchangeRateService,
    CurrencyConverterService,
    PaymentRateLimitGuard,
    PaymentInitiationFraudGuard,
    WebhookRateLimitGuard,
    AdminRateLimitGuard,
    RefundRateLimitGuard,
    CustomRateLimitGuard,
  ],
  exports: [
    CacheService,
    RateLimiterService,
    CurrencyService,
    ExchangeRateService,
    CurrencyConverterService,
    PaymentRateLimitGuard,
    PaymentInitiationFraudGuard,
    WebhookRateLimitGuard,
    AdminRateLimitGuard,
    RefundRateLimitGuard,
    CustomRateLimitGuard,
  ],
})
export class CommonModule {}
