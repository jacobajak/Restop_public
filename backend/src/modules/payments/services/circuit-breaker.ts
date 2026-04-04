import { Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation - requests pass through
  OPEN = 'OPEN', // Breaker tripped - requests fail immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  name: string; // Name for logging (e.g., 'FlutterwaveAPI', 'EmailService')
  failureThreshold: number; // Number of failures to trigger OPEN state
  successThreshold: number; // Number of successes in HALF_OPEN to reset to CLOSED
  timeout: number; // Milliseconds before opening circuit (after first failure)
  resetTimeout: number; // Milliseconds to wait before attempting HALF_OPEN
  onOpen?: () => void; // Callback when circuit opens
  onClose?: () => void; // Callback when circuit closes
}

/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services (APIs, email, etc) are down.
 *
 * States:
 *   CLOSED: Normal operation - requests pass through
 *   OPEN: Service unavailable - requests fail immediately (fast-fail)
 *   HALF_OPEN: Testing recovery - allow limited requests through
 *
 * Lifecycle:
 *   CLOSED → (failures exceed threshold OR timeout) → OPEN
 *   OPEN → (resetTimeout passes) → HALF_OPEN
 *   HALF_OPEN → (success threshold reached) → CLOSED
 *   HALF_OPEN → (failure) → OPEN
 *
 * Usage:
 * ```
 * const breaker = new CircuitBreaker({
 *   name: 'FlutterwaveAPI',
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 30000,
 *   resetTimeout: 60000,
 * });
 *
 * try {
 *   const result = await breaker.execute(() =>
 *     flutterwaveService.initiatePayment(payload)
 *   );
 * } catch (error) {
 *   // Circuit is OPEN - provide graceful fallback
 *   return 'Payment provider temporarily unavailable. Please try again in 1 minute.';
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;
  private logger: Logger;

  constructor(private config: CircuitBreakerConfig) {
    this.logger = new Logger(`CircuitBreaker[${config.name}]`);
  }

  /**
   * Execute a function with circuit breaker protection
   * If circuit is OPEN and timeout hasn't expired, throws ServiceUnavailableException
   * Otherwise executes the function and updates state based on success/failure
   *
   * @param fn - Async function to execute
   * @returns Promise with function result
   * @throws ServiceUnavailableException if circuit is OPEN
   * @throws Original error if function fails (only updates breaker state)
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit can be transitioned
    this.checkStateTransition();

    // If circuit is OPEN, reject fast without calling function
    if (this.state === CircuitState.OPEN) {
      this.logger.warn(
        `Circuit is OPEN - rejecting request (will retry at ${new Date(this.nextAttemptTime).toISOString()})`,
      );
      throw new ServiceUnavailableException(
        `${this.config.name} is temporarily unavailable. Please try again in a moment.`,
      );
    }

    try {
      // Execute the wrapped function
      const result = await fn();

      // Record success
      this.onSuccess();
      return result;
    } catch (error) {
      // Record failure
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if state should transition
   * OPEN → HALF_OPEN when resetTimeout expires
   */
  private checkStateTransition(): void {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now >= this.nextAttemptTime) {
        this.setState(CircuitState.HALF_OPEN);
        this.logger.log(
          'Transitioning from OPEN to HALF_OPEN - testing recovery',
        );
        this.successCount = 0;
      }
    }
  }

  /**
   * Record successful execution
   * Updates state based on current state:
   * - CLOSED: Keep as-is, reset failure count
   * - HALF_OPEN: Increment success count, close if threshold reached
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.logger.debug(
        `HALF_OPEN: Success ${this.successCount}/${this.config.successThreshold}`,
      );

      if (this.successCount >= this.config.successThreshold) {
        this.setState(CircuitState.CLOSED);
        this.logger.log(
          'Circuit CLOSED - service recovered, resuming normal operation',
        );
        if (this.config.onClose) {
          this.config.onClose();
        }
      }
    }
  }

  /**
   * Record failed execution
   * Updates state based on current state:
   * - CLOSED: Increment failure count, open if threshold reached
   * - HALF_OPEN: Go back to OPEN
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      this.logger.debug(
        `Failure ${this.failureCount}/${this.config.failureThreshold}`,
      );

      if (this.failureCount >= this.config.failureThreshold) {
        this.setState(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in HALF_OPEN goes back to OPEN
      this.setState(CircuitState.OPEN);
      this.logger.warn(
        'HALF_OPEN test failed - service still unhealthy, reopening circuit',
      );
    }
  }

  /**
   * Set new circuit breaker state
   * Handles logging and callbacks
   *
   * @param newState - New state to transition to
   */
  private setState(newState: CircuitState): void {
    if (newState === this.state) {
      return; // No state change
    }

    const oldState = this.state;
    this.state = newState;

    this.logger.log(
      `State transition: ${oldState} → ${newState}`,
    );

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      this.logger.warn(
        `Circuit OPENED - will retry at ${new Date(this.nextAttemptTime).toISOString()}`,
      );
      if (this.config.onOpen) {
        this.config.onOpen();
      }
    }
  }

  /**
   * Get current circuit state (for monitoring/debugging)
   *
   * @returns Circuit state object
   */
  getState(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    nextAttemptTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset circuit to CLOSED state
   * Used for testing or manual recovery
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    this.logger.log('Circuit manually reset to CLOSED');
  }

  /**
   * Check if circuit is available (not OPEN)
   * Non-blocking check for health monitoring
   *
   * @returns True if circuit is CLOSED or HALF_OPEN
   */
  isAvailable(): boolean {
    return this.state !== CircuitState.OPEN;
  }
}
