import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

/**
 * Service Health Status
 */
export enum HealthStatus {
  UP = 'UP',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
}

/**
 * Service Health Record
 */
export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  lastChecked: Date;
  responseTimeMs: number;
  errorCount: number;
  errorMessage?: string;
}

/**
 * External Service Health Check
 *
 * Periodically monitors health of external services:
 * - Flutterwave API
 * - Database connectivity
 * - Email service
 * - Other dependencies
 *
 * Used by:
 * - Graceful degradation (skip email when unavailable)
 * - Circuit breaker (pre-emptively open if unhealthy)
 * - Admin dashboard (show service status)
 * - Alerting (notify when service degrades)
 */
@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private serviceHealth: Map<string, ServiceHealth> = new Map();

  constructor() {
    this.initializeServices();
  }

  /**
   * Initialize service health tracking
   */
  private initializeServices(): void {
    this.serviceHealth.set('flutterwave', {
      name: 'Flutterwave API',
      status: HealthStatus.UP,
      lastChecked: new Date(),
      responseTimeMs: 0,
      errorCount: 0,
    });

    this.serviceHealth.set('database', {
      name: 'Database',
      status: HealthStatus.UP,
      lastChecked: new Date(),
      responseTimeMs: 0,
      errorCount: 0,
    });

    this.serviceHealth.set('email', {
      name: 'Email Service',
      status: HealthStatus.UP,
      lastChecked: new Date(),
      responseTimeMs: 0,
      errorCount: 0,
    });
  }

  /**
   * Run health checks periodically (every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthChecks(): Promise<void> {
    this.logger.log('🏥 Performing health checks...');

    try {
      await Promise.all([
        this.checkFlutterwaveHealth(),
        // Database check handled by connection pool
        // Email check handled by service attempt
      ]);

      this.logHealthStatus();
    } catch (error) {
      this.logger.error(`Error during health checks: ${error}`);
    }
  }

  /**
   * Check Flutterwave API health
   */
  private async checkFlutterwaveHealth(): Promise<void> {
    const startTime = Date.now();
    const service = this.serviceHealth.get('flutterwave')!;

    try {
      // Simple health check - just verify API is responding
      const response = await axios.get(
        'https://api.flutterwave.com/v3/health',
        {
          timeout: 5000,
        },
      );

      const responseTimeMs = Date.now() - startTime;
      service.status = response.status === 200 ? HealthStatus.UP : HealthStatus.DEGRADED;
      service.responseTimeMs = responseTimeMs;
      service.errorCount = 0;
      service.errorMessage = undefined;
      service.lastChecked = new Date();

      this.logger.debug(
        `✅ Flutterwave health: ${service.status} (${responseTimeMs}ms)`,
      );
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      service.status = HealthStatus.DOWN;
      service.responseTimeMs = responseTimeMs;
      service.errorCount++;
      service.errorMessage = error.message;
      service.lastChecked = new Date();

      this.logger.warn(
        `❌ Flutterwave health check failed: ${error.message}`,
      );
    }
  }

  /**
   * Check database connectivity
   * Called by database connection handler when connection established/lost
   */
  recordDatabaseHealth(isHealthy: boolean, responseTimeMs: number): void {
    const service = this.serviceHealth.get('database')!;
    service.status = isHealthy ? HealthStatus.UP : HealthStatus.DOWN;
    service.responseTimeMs = responseTimeMs;
    if (isHealthy) {
      service.errorCount = 0;
      service.errorMessage = undefined;
    } else {
      service.errorCount++;
    }
    service.lastChecked = new Date();
  }

  /**
   * Record email service health
   * Called when email delivery succeeds/fails
   */
  recordEmailHealth(isHealthy: boolean, errorMessage?: string): void {
    const service = this.serviceHealth.get('email')!;
    service.status = isHealthy ? HealthStatus.UP : HealthStatus.DEGRADED;
    if (isHealthy) {
      service.errorCount = 0;
      service.errorMessage = undefined;
    } else {
      service.errorCount++;
      service.errorMessage = errorMessage;
    }
    service.lastChecked = new Date();
  }

  /**
   * Get health status of specific service
   */
  getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.serviceHealth.get(serviceName) || null;
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): Record<string, ServiceHealth> {
    const result: Record<string, ServiceHealth> = {};
    this.serviceHealth.forEach((health, name) => {
      result[name] = health;
    });
    return result;
  }

  /**
   * Check if all critical services are healthy
   */
  areCriticalServicesHealthy(): boolean {
    const flutterwave = this.serviceHealth.get('flutterwave')!;
    const database = this.serviceHealth.get('database')!;

    return (
      flutterwave.status === HealthStatus.UP &&
      database.status === HealthStatus.UP
    );
  }

  /**
   * Check if service is degraded (not down, but having issues)
   */
  isServiceDegraded(serviceName: string): boolean {
    const service = this.serviceHealth.get(serviceName);
    return service?.status === HealthStatus.DEGRADED;
  }

  /**
   * Check if service is down
   */
  isServiceDown(serviceName: string): boolean {
    const service = this.serviceHealth.get(serviceName);
    return service?.status === HealthStatus.DOWN;
  }

  /**
   * Get health check summary for monitoring
   */
  getHealthSummary(): {
    timestamp: Date;
    overall: HealthStatus;
    services: Record<string, ServiceHealth>;
    allHealthy: boolean;
  } {
    const services = this.getAllServiceHealth();
    const statuses = Object.values(services).map(s => s.status);
    
    let overall = HealthStatus.UP;
    if (statuses.includes(HealthStatus.DOWN)) {
      overall = HealthStatus.DOWN;
    } else if (statuses.includes(HealthStatus.DEGRADED)) {
      overall = HealthStatus.DEGRADED;
    }

    return {
      timestamp: new Date(),
      overall,
      services,
      allHealthy: overall === HealthStatus.UP,
    };
  }

  /**
   * Log current health status
   */
  private logHealthStatus(): void {
    const summary = this.getHealthSummary();
    const details = Object.entries(summary.services)
      .map(([name, health]) => `${name}=${health.status}(${health.responseTimeMs}ms)`)
      .join(', ');

    this.logger.log(
      `📊 Overall Health: ${summary.overall} | Services: ${details}`,
    );
  }
}
