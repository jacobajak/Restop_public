import { Injectable, Logger } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisClientType } from 'redis';

/**
 * CacheService
 * 
 * Provides Redis-based caching for frequently accessed data
 * Used for:
 * - Settlement summaries (merchant dashboard)
 * - Refund list queries (admin dashboard)
 * - Payment verification stats
 * 
 * TTLs:
 * - Settlement summaries: 5 minutes (real-time enough for dashboards)
 * - Refund queries: 1 minute (critical for admin actions)
 * - Admin metrics: 1 minute (critical admin visibility)
 * 
 * Note: Service gracefully handles Redis connection failures
 * All cache operations have fallback to direct DB queries
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
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
              this.logger.error('Redis max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return retries * 50;
          },
        },
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        this.logger.debug('Redis connected');
        this.isConnected = true;
      });

      await this.redisClient.connect();
      this.isConnected = true;
    } catch (error) {
      this.logger.warn('Failed to initialize Redis, cache operations will be skipped:', error);
      this.isConnected = false;
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redisClient) {
      return null;
    }

    try {
      const value = await this.redisClient.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    if (!this.isConnected || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Clear all cache keys matching a pattern
   * Useful for invalidating related cache entries
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) {
      return;
    }

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } catch (error) {
      this.logger.warn(`Cache deletePattern error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate settlement cache for a tenant
   * Called when payouts are created or updated
   */
  async invalidateSettlementCache(tenantId: string): Promise<void> {
    await this.deletePattern(`settlement:${tenantId}:*`);
  }

  /**
   * Invalidate admin metrics cache
   */
  async invalidateAdminMetricsCache(): Promise<void> {
    await this.deletePattern('admin:metrics:*');
  }
}
