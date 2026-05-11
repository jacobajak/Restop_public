import { Logger } from '@nestjs/common';
import { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ExponentialBackoff, ExponentialBackoffConfig } from './exponential-backoff';

/**
 * Retry Interceptor Configuration
 */
export interface RetryInterceptorConfig {
  maxRetries: number;
  retryDelay: number; // Initial delay in ms
  exponentialBackoff: Partial<ExponentialBackoffConfig>;
  retryableStatusCodes: number[]; // HTTP codes that should trigger retry
  retryableErrorCodes: string[]; // Error codes that should trigger retry
}

/**
 * HTTP Retry Interceptor
 *
 * Adds automatic retry logic to Axios HTTP client:
 *
 * Retryable scenarios:
 * - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
 * - Temporary server errors (5xx, 429)
 * - Partial failures that might recover
 *
 * Non-retryable scenarios:
 * - Client errors (4xx except 429)
 * - Invalid requests
 * - Authentication failures
 *
 * Usage:
 * ```
 * const retryInterceptor = new RetryInterceptor(axiosClient);
 * retryInterceptor.setup();
 * ```
 */
export class RetryInterceptor {
  private logger: Logger;
  private backoff: ExponentialBackoff;
  private requestRetryCount = new WeakMap<InternalAxiosRequestConfig, number>();

  constructor(
    private httpClient: AxiosInstance,
    private config: RetryInterceptorConfig = {
      maxRetries: 3,
      retryDelay: 500,
      exponentialBackoff: {
        initialDelayMs: 500,
        maxDelayMs: 10000,
        multiplier: 2,
        maxRetries: 3,
      },
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      retryableErrorCodes: [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EHOSTUNREACH',
        'ENETUNREACH',
      ],
    },
  ) {
    this.logger = new Logger('RetryInterceptor');
    this.backoff = new ExponentialBackoff(config.exponentialBackoff);
  }

  /**
   * Setup retry interceptor on Axios client
   */
  setup(): void {
    // Add response interceptor to handle errors and retry
    this.httpClient.interceptors.response.use(
      response => response,
      error => this.handleError(error),
    );

    this.logger.log('✅ Retry interceptor setup complete');
  }

  /**
   * Handle errors and determine if retry is appropriate
   */
  private async handleError(error: AxiosError<any>): Promise<any> {
    const config = error.config as InternalAxiosRequestConfig;

    if (!config) {
      throw error; // Can't retry without config
    }

    // Get or initialize retry count
    const retryCount = this.requestRetryCount.get(config) || 0;

    // Check if we should retry
    if (!this.shouldRetry(error, retryCount)) {
      throw error; // Don't retry
    }

    // Increment retry count
    this.requestRetryCount.set(config, retryCount + 1);

    // Calculate delay
    const delayMs = this.backoff['calculateDelay'](retryCount + 1, {
      initialDelayMs: this.config.exponentialBackoff.initialDelayMs || 500,
      maxDelayMs: this.config.exponentialBackoff.maxDelayMs || 10000,
      multiplier: this.config.exponentialBackoff.multiplier || 2,
      jitterFraction: this.config.exponentialBackoff.jitterFraction || 0.1,
      maxRetries: this.config.maxRetries,
    });

    this.logger.warn(
      `Retrying ${config.method?.toUpperCase()} ${config.url} - ` +
      `attempt ${retryCount + 1}/${this.config.maxRetries}, ` +
      `waiting ${delayMs}ms`,
    );

    // Wait before retry
    await this.sleep(delayMs);

    // Retry the request
    return this.httpClient.request(config);
  }

  /**
   * Determine if a request should be retried
   */
  private shouldRetry(error: AxiosError<any>, retryCount: number): boolean {
    // Don't retry if max attempts exceeded
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    // Check for network errors
    if (error.code && this.config.retryableErrorCodes.includes(error.code)) {
      this.logger.debug(`Retryable network error: ${error.code}`);
      return true;
    }

    // Check for retryable HTTP status codes
    if (
      error.response?.status &&
      this.config.retryableStatusCodes.includes(error.response.status)
    ) {
      this.logger.debug(
        `Retryable HTTP status: ${error.response.status}`,
      );
      return true;
    }

    // Check for timeout
    if (error.code === 'ECONNABORTED') {
      this.logger.debug('Request timeout - will retry');
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
