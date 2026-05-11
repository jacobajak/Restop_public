import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatusEnum } from '../../orders/entities/order.entity';

/**
 * Error Recovery Strategy
 *
 * Defines how to recover from different types of failures
 */
export interface ErrorRecoveryStrategy {
  name: string;
  isRetryable: boolean; // Should we retry?
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; // Admin alert priority
  userMessage: string; // What to show customer
  adminMessage: string; // What to show admin
  suggestedActions: string[]; // Next steps
  fallbackActions?: string[]; // Actions if recovery fails
}

/**
 * Error Recovery Strategies
 *
 * Maps error types to recovery strategies:
 * - What action to take
 * - Whether to retry
 * - How to message user/admin
 * - What fallback options exist
 *
 * Philosophy:
 * - Never lose data (always queue for retry)
 * - Be optimistic (assume temporary failure)
 * - Be informative (tell user what's happening)
 * - Be actionable (suggest next steps)
 */
@Injectable()
export class ErrorRecoveryStrategies {
  private readonly logger = new Logger(ErrorRecoveryStrategies.name);

  private strategies: Record<string, ErrorRecoveryStrategy> = {
    // Network Errors (Always retry)
    NETWORK_TIMEOUT: {
      name: 'Network Timeout',
      isRetryable: true,
      priority: 'MEDIUM',
      userMessage:
        'The request took longer than expected. We are retrying automatically.',
      adminMessage:
        'Network timeout - payment service response time exceeded threshold',
      suggestedActions: [
        'Retry after 5 minutes',
        'Check service status',
        'Check network connectivity',
      ],
    },

    CONNECTION_REFUSED: {
      name: 'Connection Refused',
      isRetryable: true,
      priority: 'HIGH',
      userMessage:
        'Payment service is temporarily unavailable. Retrying automatically.',
      adminMessage:
        'Cannot connect to payment provider - service may be down',
      suggestedActions: [
        'Check payment provider status',
        'Switch to circuit breaker',
        'Use graceful degradation',
      ],
      fallbackActions: [
        'Queue payment for manual retry',
        'Offer alternative payment method',
      ],
    },

    DNS_LOOKUP_FAILED: {
      name: 'DNS Lookup Failed',
      isRetryable: true,
      priority: 'HIGH',
      userMessage:
        'Network connection issue. Retrying with exponential backoff.',
      adminMessage:
        'DNS resolution failed - potential network connectivity issue',
      suggestedActions: [
        'Check DNS configuration',
        'Check network connectivity',
        'Verify payment provider URL',
      ],
    },

    // API Errors (Usually retryable)
    API_RATE_LIMITED: {
      name: 'API Rate Limited',
      isRetryable: true,
      priority: 'MEDIUM',
      userMessage:
        'Too many requests. Retrying with backoff strategy.',
      adminMessage:
        'Hit rate limit on payment provider - implementing backoff',
      suggestedActions: [
        'Retry after longer delay',
        'Spread out payment requests',
        'Contact provider for limit increase',
      ],
    },

    API_SERVICE_UNAVAILABLE: {
      name: 'Service Unavailable',
      isRetryable: true,
      priority: 'HIGH',
      userMessage:
        'Payment service is temporarily down. We will keep trying.',
      adminMessage:
        'Payment provider returned 503 - service temporarily unavailable',
      suggestedActions: [
        'Wait for service to recover',
        'Check provider status page',
        'Switch to backup provider if available',
      ],
      fallbackActions: [
        'Open circuit breaker',
        'Enable graceful degradation',
        'Notify customers to try later',
      ],
    },

    API_BAD_GATEWAY: {
      name: 'Bad Gateway',
      isRetryable: true,
      priority: 'MEDIUM',
      userMessage:
        'Gateway error. Retrying automatically.',
      adminMessage:
        'Payment provider returned 502 - bad gateway',
      suggestedActions: [
        'Retry with exponential backoff',
        'Check provider infrastructure',
      ],
    },

    API_GATEWAY_TIMEOUT: {
      name: 'Gateway Timeout',
      isRetryable: true,
      priority: 'MEDIUM',
      userMessage:
        'Request timeout. Retrying automatically.',
      adminMessage:
        'Payment provider returned 504 - gateway timeout',
      suggestedActions: [
        'Retry after delay',
        'Check provider performance',
      ],
    },

    // Validation Errors (Don't retry - need user action)
    INVALID_PHONE_NUMBER: {
      name: 'Invalid Phone Number',
      isRetryable: false,
      priority: 'MEDIUM',
      userMessage:
        'Invalid phone number format. Please check and try again.',
      adminMessage:
        'Customer provided invalid phone number format',
      suggestedActions: [
        'Ask customer for valid phone number',
        'Validate format before submission',
      ],
    },

    INSUFFICIENT_BALANCE: {
      name: 'Insufficient Balance',
      isRetryable: false,
      priority: 'LOW',
      userMessage:
        'Insufficient mobile money balance. Please top up and retry.',
      adminMessage:
        'Customer account has insufficient balance',
      suggestedActions: [
        'Customer top up account',
        'Retry payment',
      ],
    },

    PAYMENT_ALREADY_PROCESSED: {
      name: 'Payment Already Processed',
      isRetryable: false,
      priority: 'LOW',
      userMessage:
        'This payment has already been processed.',
      adminMessage:
        'Duplicate payment detected - already processed',
      suggestedActions: [
        'Check order status',
        'Verify payment was successful',
      ],
    },

    // Webhook Errors (Usually retry)
    WEBHOOK_SIGNATURE_INVALID: {
      name: 'Invalid Webhook Signature',
      isRetryable: true,
      priority: 'HIGH',
      userMessage:
        'Payment verification pending.',
      adminMessage:
        'Webhook signature verification failed - potential security issue',
      suggestedActions: [
        'Verify webhook signing key',
        'Check webhook payload',
        'Verify provider certificate',
      ],
    },

    WEBHOOK_PROCESSING_FAILED: {
      name: 'Webhook Processing Failed',
      isRetryable: true,
      priority: 'MEDIUM',
      userMessage:
        'Payment confirmed but processing delayed.',
      adminMessage:
        'Webhook processing error - will retry automatically',
      suggestedActions: [
        'Check webhook processing logs',
        'Retry webhook manually',
        'Check database connectivity',
      ],
    },

    // Database Errors (Usually indicate environmental issues)
    DATABASE_CONNECTION_FAILED: {
      name: 'Database Connection Failed',
      isRetryable: true,
      priority: 'CRITICAL',
      userMessage:
        'System error. Please try again shortly.',
      adminMessage:
        'Cannot connect to database - critical failure',
      suggestedActions: [
        'Check database connectivity',
        'Check database credentials',
        'Restart database connection pool',
      ],
      fallbackActions: [
        'Queue operation for retry',
        'Enable read-only mode',
        'Alert on-call engineer',
      ],
    },

    // Unknown Errors
    UNKNOWN_ERROR: {
      name: 'Unknown Error',
      isRetryable: true,
      priority: 'MEDIUM',
      userMessage:
        'Something went wrong. We are retrying your request.',
      adminMessage:
        'Unknown error occurred - check logs for details',
      suggestedActions: [
        'Check application logs',
        'Check error details',
        'Verify system health',
      ],
    },
  };

  /**
   * Classify error and get recovery strategy
   *
   * @param error - Error to classify
   * @returns Recovery strategy for this error
   */
  classifyError(error: any): ErrorRecoveryStrategy {
    const errorCode = this.extractErrorCode(error);

    if (this.strategies[errorCode]) {
      return this.strategies[errorCode];
    }

    // Try to match by error message patterns
    const message = (error?.message || error?.toString()) || '';

    if (message.includes('timeout') || message.includes('timed out')) {
      return this.strategies['NETWORK_TIMEOUT'];
    }
    if (message.includes('ECONNREFUSED') || message.includes('refused')) {
      return this.strategies['CONNECTION_REFUSED'];
    }
    if (message.includes('ENOTFOUND') || message.includes('DNS')) {
      return this.strategies['DNS_LOOKUP_FAILED'];
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return this.strategies['API_RATE_LIMITED'];
    }
    if (message.includes('503') || message.includes('unavailable')) {
      return this.strategies['API_SERVICE_UNAVAILABLE'];
    }

    this.logger.warn(`Unknown error classification: ${errorCode}`);
    return this.strategies['UNKNOWN_ERROR'];
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): ErrorRecoveryStrategy | null {
    return this.strategies[name] || null;
  }

  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: any): string {
    // HTTP status code
    if (error.response?.status) {
      const status = error.response.status;
      if (status === 429) return 'API_RATE_LIMITED';
      if (status === 503) return 'API_SERVICE_UNAVAILABLE';
      if (status === 502) return 'API_BAD_GATEWAY';
      if (status === 504) return 'API_GATEWAY_TIMEOUT';
    }

    // Network error code
    if (error.code) {
      const codeMap: Record<string, string> = {
        ECONNREFUSED: 'CONNECTION_REFUSED',
        ENOTFOUND: 'DNS_LOOKUP_FAILED',
        ETIMEDOUT: 'NETWORK_TIMEOUT',
        ECONNABORTED: 'NETWORK_TIMEOUT',
      };
      if (codeMap[error.code]) {
        return codeMap[error.code];
      }
    }

    // Check error message
    if (error.message) {
      if (error.message.includes('Invalid phone')) return 'INVALID_PHONE_NUMBER';
      if (error.message.includes('Insufficient balance')) return 'INSUFFICIENT_BALANCE';
      if (error.message.includes('already processed')) return 'PAYMENT_ALREADY_PROCESSED';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): Record<string, ErrorRecoveryStrategy> {
    return this.strategies;
  }
}
