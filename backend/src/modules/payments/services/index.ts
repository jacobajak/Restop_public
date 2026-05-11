/**
 * Payments Module
 *
 * Comprehensive payment processing system with resilience patterns:
 *
 * Core Features:
 * - Payment processing via Flutterwave
 * - Transaction verification & reconciliation
 * - Webhook handling for payment events
 * - Payment history & reporting
 *
 * Resilience Patterns:
 * 1. Retry Strategy
 *    - Exponential backoff with jitter
 *    - Configurable policies per operation type
 *    - Prevents thundering herd
 *
 * 2. Circuit Breaker
 *    - Prevents cascading failures
 *    - Fast failure (fail fast)
 *    - Automatic recovery testing
 *
 * 3. Health Monitoring
 *    - Periodic health checks
 *    - Per-service status tracking
 *    - Real-time health visibility
 *
 * 4. Payment Recovery
 *    - Identifies incomplete/stuck payments
 *    - Reconciles with Flutterwave
 *    - Automatic retry with exponential backoff
 *
 * 5. Graceful Degradation
 *    - Dynamic feature availability
 *    - Reduced capacity under load
 *    - Prioritizes critical operations
 *    - Maintains service availability
 *
 * Architecture:
 *
 * ```
 * Payment Request
 *       ↓
 *  Circuit Breaker Check
 *       ↓ (if available)
 *  Retry Strategy
 *       ↓
 *  Graceful Degradation (capacity check)
 *       ↓ (if capacity)
 *  Payment Processor
 *       ↓
 *  Success/Failure
 *       ↓
 *  Health Check Update
 *  Recovery Register (if failed)
 *  ```
 *
 * Services:
 * - HealthCheckService: Monitors external service health
 * - RetryStrategyService: Implements retry logic with backoff
 * - CircuitBreakerService: Prevents cascading failures
 * - PaymentRecoveryService: Recovers incomplete payments
 * - GracefulDegradationService: Maintains service quality under load
 * - PaymentProcessorService: (Next) Core payment processing logic
 *
 * Usage Example:
 * ```
 * // In controller or service
 * async processPayment(paymentData: PaymentData) {
 *   // Check circuit breaker
 *   if (!circuitBreaker.canAttempt('PAYMENT_PROCESSING')) {
 *     throw new ServiceUnavailableException();
 *   }
 *
 *   // Check capacity/degradation
 *   if (!degradation.shouldProcessRequest('payment')) {
 *     throw new ServiceUnavailableException();
 *   }
 *
 *   // Process with retry
 *   try {
 *     const result = await retryService.executeWithRetry(
 *       'PAYMENT_PROCESSING',
 *       () => flutterwaveService.charge(paymentData),
 *       {
 *         onRetry: (ctx) => logger.warn(`Retry attempt ${ctx.attempt}`)
 *       }
 *     );
 *
 *     circuitBreaker.recordSuccess('PAYMENT_PROCESSING');
 *     healthCheck.recordSuccess('flutterwave');
 *     return result;
 *   } catch (error) {
 *     circuitBreaker.recordFailure('PAYMENT_PROCESSING', error);
 *     recovery.registerIncompletePayment(paymentData);
 *     throw error;
 *   }
 * }
 * ```
 */

export { HealthCheckService, HealthStatus } from './health-check.service';
export type { ServiceHealth } from './health-check.service';

export { RetryStrategyService, type RetryPolicy, type RetryContext } from './retry-strategy.service';

export {
  CircuitBreakerService,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics,
} from './circuit-breaker.service';

export {
  PaymentRecoveryService,
  type IncompletePayment,
  type ReconciliationResult,
} from './payment-recovery.service';

export {
  GracefulDegradationService,
  DegradationLevel,
  DegradationStrategy,
  type FeatureAvailability,
} from './graceful-degradation.service';
