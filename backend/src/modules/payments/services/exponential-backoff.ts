import { Logger } from '@nestjs/common';

/**
 * Exponential Backoff Configuration
 */
export interface ExponentialBackoffConfig {
  initialDelayMs: number; // Starting delay (e.g., 500ms)
  maxDelayMs: number; // Maximum delay cap (e.g., 60000ms = 1 minute)
  multiplier: number; // Multiply delay by this each retry (e.g., 2 = double)
  jitterFraction: number; // Add random jitter (e.g., 0.1 = ±10%)
  maxRetries: number; // Max number of retry attempts
}

/**
 * Exponential Backoff Utility
 *
 * Implements exponential backoff retry strategy for resilient API calls:
 *
 * Delays:
 *   Attempt 1: Fail immediately
 *   Attempt 2: Wait ~500ms
 *   Attempt 3: Wait ~1000ms
 *   Attempt 4: Wait ~2000ms
 *   Attempt 5: Wait ~4000ms (capped if max reached)
 *
 * With jitter:
 *   ~500ms ± 50ms (random variation)
 *   Prevents thundering herd during simultaneous retries
 *
 * Usage:
 * ```
 * const backoff = new ExponentialBackoff();
 * const result = await backoff.execute(
 *   () => flutterwaveService.createPayment(payload),
 *   {
 *     initialDelayMs: 500,
 *     maxDelayMs: 10000,
 *     maxRetries: 3,
 *   }
 * );
 * ```
 */
export class ExponentialBackoff {
  private logger: Logger;

  constructor(private defaultConfig?: Partial<ExponentialBackoffConfig>) {
    this.logger = new Logger('ExponentialBackoff');
  }

  /**
   * Execute a function with exponential backoff retry
   *
   * @param fn - Async function to execute
   * @param config - Backoff configuration (overrides defaults)
   * @returns Result from successful execution
   * @throws Error from final attempt if all retries fail
   */
  async execute<T>(
    fn: () => Promise<T>,
    config?: Partial<ExponentialBackoffConfig>,
  ): Promise<T> {
    const finalConfig = this.mergeConfig(config);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delayMs = this.calculateDelay(attempt, finalConfig);
          this.logger.debug(
            `Retry attempt ${attempt}/${finalConfig.maxRetries} - waiting ${delayMs}ms before retry`,
          );
          await this.sleep(delayMs);
        }

        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < finalConfig.maxRetries) {
          this.logger.warn(
            `Attempt ${attempt + 1} failed: ${lastError.message} - will retry`,
          );
        } else {
          this.logger.error(
            `All ${finalConfig.maxRetries + 1} attempts failed: ${lastError.message}`,
          );
        }
      }
    }

    throw lastError || new Error('Unknown error in exponential backoff');
  }

  /**
   * Calculate delay for given attempt with exponential backoff + jitter
   *
   * @param attempt - Attempt number (0-indexed)
   * @param config - Backoff configuration
   * @returns Delay in milliseconds
   */
  private calculateDelay(
    attempt: number,
    config: ExponentialBackoffConfig,
  ): number {
    // Exponential: delay = initialDelay * (multiplier ^ attempt)
    const exponentialDelay = config.initialDelayMs * Math.pow(config.multiplier, attempt);

    // Cap at maximum
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter: randomize by ±jitterFraction
    const jitterRange = cappedDelay * config.jitterFraction;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    const finalDelay = Math.max(0, cappedDelay + jitter);

    return Math.round(finalDelay);
  }

  /**
   * Sleep for given milliseconds (helper utility)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Merge provided config with defaults
   */
  private mergeConfig(
    config?: Partial<ExponentialBackoffConfig>,
  ): ExponentialBackoffConfig {
    return {
      initialDelayMs: 500, // Start with 500ms
      maxDelayMs: 60000, // Cap at 1 minute
      multiplier: 2, // Double delay each time
      jitterFraction: 0.1, // ±10% variation
      maxRetries: 3, // Total 4 attempts (1 initial + 3 retries)
      ...this.defaultConfig,
      ...config,
    };
  }

  /**
   * Get retry configuration info (for logging/monitoring)
   */
  getConfigInfo(config?: Partial<ExponentialBackoffConfig>): string {
    const finalConfig = this.mergeConfig(config);
    const delays: number[] = [];
    
    for (let i = 1; i <= finalConfig.maxRetries; i++) {
      delays.push(this.calculateDelay(i, finalConfig));
    }

    return (
      `Backoff: ${finalConfig.maxRetries + 1} attempts, ` +
      `delays=[${delays.join(', ')}]ms, ` +
      `max=${finalConfig.maxDelayMs}ms`
    );
  }
}
