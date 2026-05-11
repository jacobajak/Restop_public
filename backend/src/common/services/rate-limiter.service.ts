import { Injectable, Logger } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisClientType } from 'redis';

/**
 * Rate Limiter Service
 * 
 * Provides distributed rate limiting using Redis
 * Supports:
 * - Per-tenant limits
 * - Per-user limits
 * - Per-IP limits
 * - Sliding window rate limiting
 * - Custom key patterns for flexibility
 * 
 * Uses sliding window algorithm for accurate rate limiting:
 * - Stores requests in Redis sorted set with timestamp as score
 * - Automatically cleans up old entries
 * - Maintains state across distributed servers
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private redisClient: RedisClientType;
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.error('Redis rate limiter: max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return retries * 50;
          },
        },
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis rate limiter connection error:', err);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis rate limiter connected');
        this.isConnected = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis rate limiter:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if request is allowed under rate limit
   * Uses sliding window algorithm
   * 
   * @param key Unique identifier (e.g., 'payment:tenant:123')
   * @param limit Maximum requests allowed
   * @param windowSeconds Time window in seconds
   * @returns { allowed: boolean, remaining: number, resetAt: number }
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const redisKey = `ratelimit:${key}`;

    try {
      // Get current count in window
      const count = await this.redisClient.zCount(
        redisKey,
        windowStart,
        now,
      );

      const remaining = Math.max(0, limit - count);
      const resetAt = now + windowSeconds * 1000;

      if (count < limit) {
        // Add current request to sorted set with timestamp as score
        await this.redisClient.zAdd(redisKey, {
          score: now,
          value: `${now}:${Math.random()}`,
        });
        
        // Set expiration on the key (cleanup old entries)
        await this.redisClient.expire(redisKey, windowSeconds + 1);

        return {
          allowed: true,
          remaining,
          resetAt,
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed for key ${key}:`, error);
      // Fail open: allow request if Redis is down
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + windowSeconds * 1000,
      };
    }
  }

  /**
   * Get current count for a rate limit key
   */
  async getCount(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const redisKey = `ratelimit:${key}`;

    try {
      return await this.redisClient.zCount(
        redisKey,
        windowStart,
        now,
      );
    } catch (error) {
      this.logger.error(`Failed to get count for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    const redisKey = `ratelimit:${key}`;
    try {
      await this.redisClient.del(redisKey);
    } catch (error) {
      this.logger.error(`Failed to reset rate limit for key ${key}:`, error);
    }
  }

  /**
   * Payment endpoint rate limiting
   * Default: 100 requests per minute per tenant
   */
  async checkPaymentLimit(tenantId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `payment:tenant:${tenantId}`;
    return this.checkLimit(key, 100, 60); // 100 req/min
  }

  /**
   * Payment initiation rate limiting (fraud prevention)
   * Per-tenant: max 30 payment initiations per hour
   * Prevents spam payment attempts
   */
  async checkPaymentInitiationLimit(tenantId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `payment:initiate:${tenantId}`;
    return this.checkLimit(key, 30, 3600); // 30 attempts/hour
  }

  /**
   * Webhook rate limiting (DOS protection)
   * Per-IP: max 1000 webhooks per hour per IP
   * Per-provider: max 500 webhooks per minute per provider
   */
  async checkWebhookLimitByIP(ip: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `webhook:ip:${ip}`;
    return this.checkLimit(key, 1000, 3600); // 1000 webhooks/hour per IP
  }

  /**
   * Webhook provider rate limiting
   * Prevent one provider from flooding the system
   */
  async checkWebhookLimitByProvider(provider: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `webhook:provider:${provider}`;
    return this.checkLimit(key, 500, 60); // 500 webhooks/min per provider
  }

  /**
   * Admin endpoint rate limiting
   * Per-user: max 200 requests per minute
   */
  async checkAdminLimit(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `admin:user:${userId}`;
    return this.checkLimit(key, 200, 60); // 200 req/min
  }

  /**
   * Refund endpoint rate limiting
   * Per-user: max 5 refund requests per hour
   * Prevents abuse/spam
   */
  async checkRefundLimit(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const key = `refund:user:${userId}`;
    return this.checkLimit(key, 5, 3600); // 5 refunds/hour per user
  }

  /**
   * Generic custom rate limiter
   * For use in specific business logic
   */
  async checkCustomLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `custom:${identifier}`;
    return this.checkLimit(key, limit, windowSeconds);
  }

  /**
   * Burst detection - detect unusual spike in requests
   * Useful for detecting potential attacks
   */
  async detectBurst(
    key: string,
    normalRate: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const redisKey = `ratelimit:${key}`;

    try {
      const count = await this.redisClient.zCount(
        redisKey,
        windowStart,
        now,
      );

      // Burst detected if count is 2x the normal rate
      return count > normalRate * 2;
    } catch (error) {
      this.logger.error(`Failed to detect burst for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get rate limit status for dashboard/monitoring
   */
  async getStatus(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    current: number;
    limit: number;
    percentage: number;
    status: 'healthy' | 'warning' | 'critical';
  }> {
    const count = await this.getCount(key, windowSeconds);
    const percentage = (count / limit) * 100;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (percentage > 80) status = 'critical';
    else if (percentage > 50) status = 'warning';

    return {
      current: count,
      limit,
      percentage,
      status,
    };
  }

  /**
   * Batch check multiple keys
   * Useful for checking multiple rate limits at once
   */
  async checkAll(
    checks: Array<{
      key: string;
      limit: number;
      windowSeconds: number;
    }>,
  ): Promise<{ allowed: boolean; results: any[] }> {
    const results = await Promise.all(
      checks.map((check) => this.checkLimit(check.key, check.limit, check.windowSeconds)),
    );

    const allowed = results.every((result) => result.allowed);

    return {
      allowed,
      results,
    };
  }
}
