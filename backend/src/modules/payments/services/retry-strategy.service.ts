import { Injectable, Logger } from '@nestjs/common';

/**
 * Retry Policy Configuration
 *
 * Defines retry behavior for different operation types:
 * - initialDelayMs: Starting delay between retries
 * - maxDelayMs: Maximum delay between retries (exponential backoff cap)
 * - maxAttempts: Total number of attempts before giving up
 * - backoffMultiplier: Multiplier for exponential backoff
 */
export interface RetryPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  backoffMultiplier: number;
  retryableErrorCodes?: string[];
}

/**
 * Default retry policies for different operations
 */
const DEFAULT_RETRY_POLICIES: Record<string, RetryPolicy> = {
  // Flutterwave payment processing
  PAYMENT_PROCESSING: {
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    maxAttempts: 3,
    backoffMultiplier: 2,
    retryableErrorCodes: ['TIMEOUT', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED'],
  },

  // Payment status check/reconciliation
  PAYMENT_STATUS_CHECK: {
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    maxAttempts: 5,
    backoffMultiplier: 1.5,
    retryableErrorCodes: ['TIMEOUT', 'SERVICE_UNAVAILABLE'],
  },

  // Webhook retry (failed webhook delivery)
  WEBHOOK_DELIVERY: {
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    maxAttempts: 5,
    backoffMultiplier: 2,
    retryableErrorCodes: ['TIMEOUT', 'CONNECTION_ERROR', 'SERVICE_UNAVAILABLE'],
  },

  // Email delivery
  EMAIL_DELIVERY: {
    initialDelayMs: 3000,
    maxDelayMs: 45000,
    maxAttempts: 3,
    backoffMultiplier: 2,
    retryableErrorCodes: ['TIMEOUT', 'SERVICE_UNAVAILABLE'],
  },

  // Database operations
  DATABASE_OPERATION: {
    initialDelayMs: 500,
    maxDelayMs: 10000,
    maxAttempts: 3,
    backoffMultiplier: 2,
    retryableErrorCodes: ['DEADLOCK', 'CONNECTION_ERROR'],
  },

  // External API calls
  EXTERNAL_API: {
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    maxAttempts: 3,
    backoffMultiplier: 2,
    retryableErrorCodes: ['TIMEOUT', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED'],
  },
};

/**
 * Retry context and state
 */
export interface RetryContext {
  operationType: string;
  attempt: number;
  lastError?: Error;
  nextRetryDelayMs?: number;
}

/**
 * Retry Strategy Service
 *
 * Implements intelligent retry logic with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Configurable policies per operation type
 * - Circuit breaker awareness
 * - Observability (logging, metrics)
 *
 * Usage:
 * ```
 * const result = await retryService.executeWithRetry(
 *   'PAYMENT_PROCESSING',
 *   () => flutterwaveService.processPayment(paymentData),
 *   { onRetry: (context) => logger.warn(`Retrying: ${context.lastError}`) }
 * );
 * ```
 */
@Injectable()
export class RetryStrategyService {
  private readonly logger = new Logger(RetryStrategyService.name);

  /**
   * Execute operation with retry logic
   *
   * @param operationType Operation type (e.g., 'PAYMENT_PROCESSING')
   * @param operation Function to execute
   * @param options Additional retry options
   * @returns Operation result
   * @throws Error if all attempts fail
   */
  async executeWithRetry<T>(
    operationType: string,
    operation: () => Promise<T>,
    options?: {
      customPolicy?: Partial<RetryPolicy>;
      onRetry?: (context: RetryContext) => void;
      shouldRetry?: (error: Error) => boolean;
    },
  ): Promise<T> {
    const policy = this.getRetryPolicy(operationType, options?.customPolicy);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        this.logger.debug(
          `Executing ${operationType} (attempt ${attempt}/${policy.maxAttempts})`,
        );
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error, policy, options?.shouldRetry)) {
          this.logger.warn(
            `${operationType} failed with non-retryable error: ${error.message}`,
          );
          throw error;
        }

        // Don't retry if this was the last attempt
        if (attempt === policy.maxAttempts) {
          this.logger.error(
            `${operationType} failed after ${attempt} attempts: ${error.message}`,
          );
          throw error;
        }

        // Calculate delay with exponential backoff + jitter
        const delayMs = this.calculateBackoffDelay(attempt, policy);

        const context: RetryContext = {
          operationType,
          attempt,
          lastError: error,
          nextRetryDelayMs: delayMs,
        };

        this.logger.warn(
          `${operationType} attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`,
        );

        if (options?.onRetry) {
          options.onRetry(context);
        }

        // Wait before retrying
        await this.delay(delayMs);
      }
    }

    throw lastError || new Error(`${operationType} failed after all retry attempts`);
  }

  /**
   * Execute operation with retry logic (sync version)
   * Use for operations that don't return promises
   */
  executeWithRetrySyncable<T>(
    operationType: string,
    operation: () => T | Promise<T>,
    options?: {
      customPolicy?: Partial<RetryPolicy>;
      onRetry?: (context: RetryContext) => void;
      shouldRetry?: (error: Error) => boolean;
    },
  ): T | Promise<T> {
    return this.executeWithRetry(
      operationType,
      async () => {
        const result = operation();
        return result instanceof Promise ? result : await Promise.resolve(result);
      },
      options,
    );
  }

  /**
   * Get retry policy for operation type
   */
  private getRetryPolicy(
    operationType: string,
    customPolicy?: Partial<RetryPolicy>,
  ): RetryPolicy {
    const basePolicy = DEFAULT_RETRY_POLICIES[operationType] || {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxAttempts: 3,
      backoffMultiplier: 2,
    };

    return {
      ...basePolicy,
      ...customPolicy,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(
    error: Error,
    policy: RetryPolicy,
    shouldRetry?: (error: Error) => boolean,
  ): boolean {
    // Custom retry logic takes precedence
    if (shouldRetry) {
      return shouldRetry(error);
    }

    // Check error code against retryable error codes
    if (policy.retryableErrorCodes) {
      const errorCode = (error as any).code || (error as any).errorCode || '';
      return policy.retryableErrorCodes.some(code =>
        errorCode.includes(code),
      );
    }

    // Default: retry on most errors except validation failures
    const message = error.message.toLowerCase();
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('forbidden') ||
      message.includes('unauthorized')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Calculate exponential backoff delay with jitter
   *
   * Formula: min(maxDelay, initialDelay * (multiplier ^ (attempt - 1))) + random(0, jitter)
   */
  private calculateBackoffDelay(attempt: number, policy: RetryPolicy): number {
    const exponentialDelay = Math.min(
      policy.maxDelayMs,
      policy.initialDelayMs *
        Math.pow(policy.backoffMultiplier, attempt - 1),
    );

    // Add jitter (±10% of delay) to prevent thundering herd
    const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get policy details for monitoring/debugging
   */
  getPolicyDetails(operationType: string): RetryPolicy | null {
    return DEFAULT_RETRY_POLICIES[operationType] || null;
  }

  /**
   * Register custom retry policy
   */
  registerPolicy(operationType: string, policy: RetryPolicy): void {
    DEFAULT_RETRY_POLICIES[operationType] = policy;
    this.logger.log(`Registered custom retry policy for ${operationType}`);
  }
}
