import { Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';

/**
 * CommonModule
 * 
 * Provides shared services and utilities for all modules
 * Exports:
 * - CacheService: Redis-based caching for frequently accessed data
 */
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CommonModule {}
