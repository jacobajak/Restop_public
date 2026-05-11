import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckService } from './health-check.service';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

/**
 * Degradation Level
 */
export enum DegradationLevel {
  NORMAL = 'NORMAL', // All services available
  DEGRADED = 'DEGRADED', // Some services limited
  CRITICAL = 'CRITICAL', // Only essential services
  OFFLINE = 'OFFLINE', // Service unavailable
}

/**
 * Feature Availability
 */
export interface FeatureAvailability {
  paymentProcessing: boolean;
  emailNotifications: boolean;
  paymentReconciliation: boolean;
  webhookDelivery: boolean;
  analyticsTracking: boolean;
  externalApis: boolean;
}

/**
 * Degradation Strategy
 */
export enum DegradationStrategy {
  // Continue processing but with limitations
  QUEUE_AND_RETRY = 'QUEUE_AND_RETRY',
  // Skip non-critical operations
  SKIP_OPTIONAL = 'SKIP_OPTIONAL',
  // Only process critical requests
  CRITICAL_ONLY = 'CRITICAL_ONLY',
  // Fail fast and notify user
  FAIL_FAST = 'FAIL_FAST',
}

/**
 * Graceful Degradation Service
 *
 * Maintains service quality during failures by:
 * - Monitoring service health
 * - Dynamically disabling non-critical features
 * - Queuing operations for later retry
 * - Providing fallback behaviors
 * - Limiting resource usage
 *
 * Degradation Levels:
 * NORMAL: All services operational
 *   - Process all requests normally
 *   - Send all notifications
 *   - Update analytics in real-time
 *
 * DEGRADED: Some services struggling
 *   - Slow down non-critical operations
 *   - Queue notifications for batch delivery
 *   - Disable analytics
 *   - Prioritize payment processing
 *
 * CRITICAL: Essential services only
 *   - Process only critical payments
 *   - Skip notifications
 *   - Skip analytics
 *   - Skip optional features
 *
 * OFFLINE: Service unavailable
 *   - All operations queued or failed
 *   - Return service unavailable to clients
 *   - Alert operations team
 *
 * Usage:
 * ```
 * if (degradationService.isFeatureAvailable('emailNotifications')) {
 *   await emailService.send(notification);
 * } else {
 *   // Skip or queue email
 *   await queueService.add(notification);
 * }
 *
 * const strategy = degradationService.getCurrentStrategy();
 * if (strategy === DegradationStrategy.CRITICAL_ONLY) {
 *   // Only process high-priority requests
 * }
 * ```
 */
@Injectable()
export class GracefulDegradationService {
  private readonly logger = new Logger(GracefulDegradationService.name);

  private currentLevel: DegradationLevel = DegradationLevel.NORMAL;
  private lastLevelChange: Date = new Date();
  private lastHealthCheck: Date = new Date();

  constructor(
    private readonly healthCheck: HealthCheckService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Evaluate current degradation level based on service health
   * Should be called periodically (via health check)
   */
  async evaluateDegradationLevel(): Promise<DegradationLevel> {
    const health = this.healthCheck.getHealthSummary();
    const allCircuits = this.circuitBreaker.getAllMetrics();

    let newLevel = DegradationLevel.NORMAL;

    // Count critical services that are down
    const criticalDown = [
      health.services.flutterwave?.status,
      health.services.database?.status,
    ].filter(s => s === 'DOWN').length;

    // Count any services that are degraded
    const degradedCount = Object.values(health.services).filter(
      s => s.status === 'DEGRADED',
    ).length;

    // Count open circuits
    const openCircuits = Object.values(allCircuits).filter(
      m => m.state === CircuitState.OPEN,
    ).length;

    // Determine degradation level
    if (criticalDown >= 2) {
      newLevel = DegradationLevel.OFFLINE;
    } else if (criticalDown === 1) {
      newLevel = DegradationLevel.CRITICAL;
    } else if (degradedCount >= 2 || openCircuits >= 2) {
      newLevel = DegradationLevel.DEGRADED;
    } else {
      newLevel = DegradationLevel.NORMAL;
    }

    // Log level change
    if (newLevel !== this.currentLevel) {
      this.logger.warn(
        `📊 Degradation Level: ${this.currentLevel} → ${newLevel}`,
      );
      this.currentLevel = newLevel;
      this.lastLevelChange = new Date();
    }

    this.lastHealthCheck = new Date();
    return newLevel;
  }

  /**
   * Get current degradation level
   */
  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * Get recommended degradation strategy based on current level
   */
  getCurrentStrategy(): DegradationStrategy {
    switch (this.currentLevel) {
      case DegradationLevel.NORMAL:
        return DegradationStrategy.QUEUE_AND_RETRY;
      case DegradationLevel.DEGRADED:
        return DegradationStrategy.SKIP_OPTIONAL;
      case DegradationLevel.CRITICAL:
        return DegradationStrategy.CRITICAL_ONLY;
      case DegradationLevel.OFFLINE:
        return DegradationStrategy.FAIL_FAST;
      default:
        return DegradationStrategy.QUEUE_AND_RETRY;
    }
  }

  /**
   * Get current feature availability
   */
  getFeatureAvailability(): FeatureAvailability {
    const level = this.currentLevel;
    const allCircuits = this.circuitBreaker.getAllMetrics();

    return {
      // Payment processing available unless critical
      paymentProcessing:
        level !== DegradationLevel.OFFLINE &&
        level !== DegradationLevel.CRITICAL,
      // Email available unless degraded
      emailNotifications: level === DegradationLevel.NORMAL,
      // Payment reconciliation available unless critical
      paymentReconciliation: level !== DegradationLevel.CRITICAL,
      // Webhooks available unless degraded
      webhookDelivery: level !== DegradationLevel.DEGRADED,
      // Analytics only in normal operation
      analyticsTracking: level === DegradationLevel.NORMAL,
      // External APIs available unless offline
      externalApis: level !== DegradationLevel.OFFLINE,
    };
  }

  /**
   * Check if specific feature is available
   */
  isFeatureAvailable(feature: keyof FeatureAvailability): boolean {
    const availability = this.getFeatureAvailability();
    return availability[feature];
  }

  /**
   * Should request be processed based on priority and current level
   *
   * Usage:
   * if (degradationService.shouldProcessRequest('analytics')) {
   *   recordAnalytics(event);
   * }
   */
  shouldProcessRequest(
    requestType: 'payment' | 'email' | 'webhook' | 'analytics' | 'reconciliation',
  ): boolean {
    const level = this.currentLevel;
    const strategy = this.getCurrentStrategy();

    // In OFFLINE state, reject all except critical
    if (level === DegradationLevel.OFFLINE) {
      return requestType === 'payment';
    }

    // In CRITICAL state, only process essential
    if (level === DegradationLevel.CRITICAL) {
      return requestType === 'payment' || requestType === 'reconciliation';
    }

    // In DEGRADED state, skip non-essential
    if (level === DegradationLevel.DEGRADED) {
      const skip = ['analytics'];
      if (strategy === DegradationStrategy.SKIP_OPTIONAL) {
        skip.push('email', 'webhook');
      }
      return !skip.includes(requestType);
    }

    // NORMAL: all requests OK
    return true;
  }

  /**
   * Get retry policy based on degradation level
   */
  getRetryPolicy(): {
    maxAttempts: number;
    backoffMultiplier: number;
    timeoutMs: number;
  } {
    switch (this.currentLevel) {
      case DegradationLevel.NORMAL:
        return { maxAttempts: 3, backoffMultiplier: 2, timeoutMs: 5000 };
      case DegradationLevel.DEGRADED:
        return { maxAttempts: 2, backoffMultiplier: 1.5, timeoutMs: 3000 };
      case DegradationLevel.CRITICAL:
        return { maxAttempts: 1, backoffMultiplier: 1, timeoutMs: 2000 };
      case DegradationLevel.OFFLINE:
        return { maxAttempts: 0, backoffMultiplier: 1, timeoutMs: 1000 };
      default:
        return { maxAttempts: 3, backoffMultiplier: 2, timeoutMs: 5000 };
    }
  }

  /**
   * Get rate limits based on degradation level
   * Prevents resource exhaustion during failures
   */
  getRateLimits(): {
    paymentsPerSecond: number;
    emailsPerMinute: number;
    apiCallsPerSecond: number;
  } {
    switch (this.currentLevel) {
      case DegradationLevel.NORMAL:
        return {
          paymentsPerSecond: 100,
          emailsPerMinute: 1000,
          apiCallsPerSecond: 500,
        };
      case DegradationLevel.DEGRADED:
        return {
          paymentsPerSecond: 50,
          emailsPerMinute: 100,
          apiCallsPerSecond: 200,
        };
      case DegradationLevel.CRITICAL:
        return {
          paymentsPerSecond: 10,
          emailsPerMinute: 0,
          apiCallsPerSecond: 50,
        };
      case DegradationLevel.OFFLINE:
        return {
          paymentsPerSecond: 0,
          emailsPerMinute: 0,
          apiCallsPerSecond: 0,
        };
      default:
        return {
          paymentsPerSecond: 100,
          emailsPerMinute: 1000,
          apiCallsPerSecond: 500,
        };
    }
  }

  /**
   * Get status page representation
   */
  getStatusPage(): {
    currentTime: Date;
    degradationLevel: DegradationLevel;
    lastLevelChange: Date;
    features: FeatureAvailability;
    strategy: DegradationStrategy;
    message: string;
  } {
    const message = this.getStatusMessage();

    return {
      currentTime: new Date(),
      degradationLevel: this.currentLevel,
      lastLevelChange: this.lastLevelChange,
      features: this.getFeatureAvailability(),
      strategy: this.getCurrentStrategy(),
      message,
    };
  }

  /**
   * Get user-friendly status message
   */
  private getStatusMessage(): string {
    switch (this.currentLevel) {
      case DegradationLevel.NORMAL:
        return '✅ All systems operational';
      case DegradationLevel.DEGRADED:
        return '⚠️  Some services experiencing issues. Functionality may be limited.';
      case DegradationLevel.CRITICAL:
        return '🔴 Critical issues detected. Only essential services available.';
      case DegradationLevel.OFFLINE:
        return '❌ Service temporarily unavailable. Please try again later.';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Manually set degradation level (for testing/maintenance)
   */
  manuallySetLevel(level: DegradationLevel): void {
    this.logger.log(
      `🔧 Manually setting degradation level to ${level}`,
    );
    this.currentLevel = level;
    this.lastLevelChange = new Date();
  }

  /**
   * Restore to normal operation
   */
  restore(): void {
    this.logger.log('✅ Restoring to NORMAL degradation level');
    this.currentLevel = DegradationLevel.NORMAL;
    this.lastLevelChange = new Date();
  }

  /**
   * Get time since last degradation level change
   */
  getTimeSinceLastChange(): number {
    return Date.now() - this.lastLevelChange.getTime();
  }
}
