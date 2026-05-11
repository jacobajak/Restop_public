import { Injectable, Logger } from '@nestjs/common';

/**
 * Circuit Breaker State
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes in HALF_OPEN to close
  timeoutMs: number; // Time to wait before attempting recovery
  windowMs: number; // Time window for counting failures
}

/**
 * Circuit Breaker Metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalAttempts: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
}

/**
 * Default configurations for different service types
 */
const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  FLUTTERWAVE: {
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 30000, // 30 seconds
    windowMs: 60000, // 1 minute
  },
  DATABASE: {
    failureThreshold: 3,
    successThreshold: 1,
    timeoutMs: 10000, // 10 seconds
    windowMs: 30000, // 30 seconds
  },
  EMAIL: {
    failureThreshold: 4,
    successThreshold: 2,
    timeoutMs: 20000, // 20 seconds
    windowMs: 60000, // 1 minute
  },
  EXTERNAL_API: {
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 30000, // 30 seconds
    windowMs: 60000, // 1 minute
  },
};

/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests to failing services:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, requests rejected immediately (fail fast)
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * State transitions:
 * - CLOSED → OPEN: When failure threshold exceeded
 * - OPEN → HALF_OPEN: After timeout, start testing
 * - HALF_OPEN → CLOSED: When success threshold exceeded
 * - HALF_OPEN → OPEN: If failures continue
 *
 * Benefits:
 * - Fast failure (no hanging requests)
 * - Gives failing service time to recover
 * - Prevents resource exhaustion
 * - Integrates with retry logic for intelligent recovery
 *
 * Usage:
 * ```
 * if (circuitBreaker.canAttempt('FLUTTERWAVE')) {
 *   try {
 *     const result = await executePayment();
 *     circuitBreaker.recordSuccess('FLUTTERWAVE');
 *     return result;
 *   } catch (error) {
 *     circuitBreaker.recordFailure('FLUTTERWAVE');
 *     throw error;
 *   }
 * } else {
 *   throw new ServiceUnavailableException('Payment service temporarily unavailable');
 * }
 * ```
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  private circuitBreakers: Map<string, {
    state: CircuitState;
    metrics: CircuitBreakerMetrics;
    config: CircuitBreakerConfig;
    failureTimestamps: number[];
    lastStateChangeTime: number;
  }> = new Map();

  /**
   * Initialize circuit breaker for service
   */
  initializeCircuitBreaker(serviceId: string, configKey?: string): void {
    if (this.circuitBreakers.has(serviceId)) {
      this.logger.debug(`Circuit breaker already initialized for ${serviceId}`);
      return;
    }

    const config = DEFAULT_CONFIGS[configKey || serviceId] || DEFAULT_CONFIGS.EXTERNAL_API;
    
    this.circuitBreakers.set(serviceId, {
      state: CircuitState.CLOSED,
      metrics: {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        totalAttempts: 0,
      },
      config,
      failureTimestamps: [],
      lastStateChangeTime: Date.now(),
    });

    this.logger.log(`✓ Circuit breaker initialized for ${serviceId}`);
  }

  /**
   * Check if service can be attempted
   */
  canAttempt(serviceId: string): boolean {
    this.ensureInitialized(serviceId);
    const breaker = this.circuitBreakers.get(serviceId)!;

    if (breaker.state === CircuitState.CLOSED) {
      return true;
    }

    if (breaker.state === CircuitState.OPEN) {
      // Check if timeout has elapsed to move to HALF_OPEN
      const timeSinceOpen = Date.now() - breaker.lastStateChangeTime;
      if (timeSinceOpen > breaker.config.timeoutMs) {
        this.transitionState(serviceId, CircuitState.HALF_OPEN);
        return true; // Allow one attempt in HALF_OPEN
      }
      return false; // Circuit is open, reject
    }

    if (breaker.state === CircuitState.HALF_OPEN) {
      // Allow attempts in HALF_OPEN state
      return true;
    }

    return false;
  }

  /**
   * Record successful operation
   */
  recordSuccess(serviceId: string): void {
    this.ensureInitialized(serviceId);
    const breaker = this.circuitBreakers.get(serviceId)!;

    breaker.metrics.successCount++;
    breaker.metrics.totalAttempts++;
    breaker.metrics.lastSuccessTime = new Date();

    this.logger.debug(
      `✓ Success recorded for ${serviceId} (${breaker.metrics.successCount} in HALF_OPEN)`,
    );

    // Clear recent failures
    const now = Date.now();
    breaker.failureTimestamps = breaker.failureTimestamps.filter(
      t => now - t < breaker.config.windowMs,
    );

    // If in HALF_OPEN and success threshold reached, close circuit
    if (
      breaker.state === CircuitState.HALF_OPEN &&
      breaker.metrics.successCount >= breaker.config.successThreshold
    ) {
      this.transitionState(serviceId, CircuitState.CLOSED);
      this.logger.log(`✅ Circuit CLOSED for ${serviceId} - service recovered`);
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(serviceId: string, error?: Error): void {
    this.ensureInitialized(serviceId);
    const breaker = this.circuitBreakers.get(serviceId)!;

    breaker.metrics.failureCount++;
    breaker.metrics.totalAttempts++;
    breaker.metrics.lastFailureTime = new Date();

    if (error) {
      this.logger.warn(
        `✗ Failure recorded for ${serviceId}: ${error.message}`,
      );
    }

    // Add failure timestamp
    const now = Date.now();
    breaker.failureTimestamps.push(now);

    // Remove old failures outside window
    breaker.failureTimestamps = breaker.failureTimestamps.filter(
      t => now - t < breaker.config.windowMs,
    );

    // Check if failure threshold exceeded
    if (
      breaker.failureTimestamps.length >= breaker.config.failureThreshold
    ) {
      if (breaker.state !== CircuitState.OPEN) {
        this.transitionState(serviceId, CircuitState.OPEN);
        this.logger.error(
          `🔴 Circuit OPEN for ${serviceId} - failure threshold exceeded`,
        );
      }
    } else if (
      breaker.state === CircuitState.HALF_OPEN
    ) {
      // Any failure in HALF_OPEN goes back to OPEN
      this.transitionState(serviceId, CircuitState.OPEN);
      this.logger.warn(
        `🔴 Circuit OPEN for ${serviceId} - failed during recovery attempt`,
      );
    }
  }

  /**
   * Manually open circuit (e.g., for maintenance)
   */
  openCircuit(serviceId: string): void {
    this.ensureInitialized(serviceId);
    this.transitionState(serviceId, CircuitState.OPEN);
    this.logger.log(`🔴 Circuit manually OPENED for ${serviceId}`);
  }

  /**
   * Manually close circuit (e.g., after maintenance)
   */
  closeCircuit(serviceId: string): void {
    this.ensureInitialized(serviceId);
    const breaker = this.circuitBreakers.get(serviceId)!;
    breaker.metrics.failureCount = 0;
    breaker.metrics.successCount = 0;
    breaker.failureTimestamps = [];
    this.transitionState(serviceId, CircuitState.CLOSED);
    this.logger.log(`✅ Circuit manually CLOSED for ${serviceId}`);
  }

  /**
   * Get circuit breaker state
   */
  getState(serviceId: string): CircuitState {
    this.ensureInitialized(serviceId);
    const breaker = this.circuitBreakers.get(serviceId)!;
    return breaker.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(serviceId: string): CircuitBreakerMetrics {
    this.ensureInitialized(serviceId);
    const breaker = this.circuitBreakers.get(serviceId)!;
    return { ...breaker.metrics };
  }

  /**
   * Get all circuit breaker states
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const result: Record<string, CircuitBreakerMetrics> = {};
    this.circuitBreakers.forEach((breaker, serviceId) => {
      result[serviceId] = { ...breaker.metrics };
    });
    return result;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.circuitBreakers.forEach((breaker) => {
      breaker.state = CircuitState.CLOSED;
      breaker.metrics = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        totalAttempts: 0,
      };
      breaker.failureTimestamps = [];
      breaker.lastStateChangeTime = Date.now();
    });
    this.logger.log('All circuit breakers reset to CLOSED');
  }

  /**
   * Transition state and log
   */
  private transitionState(serviceId: string, newState: CircuitState): void {
    const breaker = this.circuitBreakers.get(serviceId)!;
    const oldState = breaker.state;

    breaker.state = newState;
    breaker.metrics.state = newState;
    breaker.lastStateChangeTime = Date.now();

    if (breaker.state === CircuitState.HALF_OPEN) {
      breaker.metrics.successCount = 0; // Reset success counter for HALF_OPEN
    }

    this.logger.log(
      `Circuit Breaker transition: ${serviceId} ${oldState} → ${newState}`,
    );
  }

  /**
   * Ensure circuit breaker is initialized
   */
  private ensureInitialized(serviceId: string): void {
    if (!this.circuitBreakers.has(serviceId)) {
      this.initializeCircuitBreaker(serviceId);
    }
  }
}
