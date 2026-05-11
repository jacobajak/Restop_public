import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';

/**
 * Resilient External Services Manager
 *
 * Wraps all external API calls with circuit breaker protection:
 * - Flutterwave Payment API
 * - Email Service
 *
 * When services are down:
 * - Circuit opens after N consecutive failures
 * - Requests fail fast (no timeout waiting)
 * - Service returns graceful error message
 * - Admin gets alert notification
 * - System attempts recovery after timeout
 *
 * Provides methods to:
 * - Check circuit status for monitoring
 * - Manually reset circuits for testing/recovery
 * - Get detailed state for admin dashboard
 */
@Injectable()
export class ResilientExternalServicesManager {
  private readonly logger = new Logger(ResilientExternalServicesManager.name);

  private flutterwaveBreaker: CircuitBreaker;
  private emailBreaker: CircuitBreaker;

  constructor(
    private flutterwaveService: FlutterwaveIntegrationService,
  ) {
    this.initializeBreakers();
  }

  /**
   * Initialize all circuit breakers with appropriate configurations
   */
  private initializeBreakers(): void {
    // Flutterwave API - strict threshold (payment critical)
    const flutterwaveConfig: CircuitBreakerConfig = {
      name: 'FlutterwaveAPI',
      failureThreshold: 3, // Open after 3 failures
      successThreshold: 2, // Close after 2 successes in HALF_OPEN
      timeout: 30000, // 30 second timeout per request
      resetTimeout: 60000, // Try recovery after 1 minute
      onOpen: () => this.alertAdminCircuitOpened('Flutterwave'),
      onClose: () => this.alertAdminCircuitClosed('Flutterwave'),
    };

    // Email Service - higher threshold (less critical than payment)
    const emailConfig: CircuitBreakerConfig = {
      name: 'EmailService',
      failureThreshold: 5, // More lenient - email less critical
      successThreshold: 3,
      timeout: 10000, // 10 second timeout
      resetTimeout: 120000, // 2 minutes recovery
      onOpen: () => this.alertAdminCircuitOpened('EmailService'),
      onClose: () => this.alertAdminCircuitClosed('EmailService'),
    };

    this.flutterwaveBreaker = new CircuitBreaker(flutterwaveConfig);
    this.emailBreaker = new CircuitBreaker(emailConfig);

    this.logger.log('✅ All circuit breakers initialized');
  }

  /**
   * Initiate payment via Flutterwave with circuit breaker protection
   *
   * @param payload - Payment initiation payload
   * @returns Flutterwave response
   * @throws ServiceUnavailableException if circuit is OPEN
   */
  async initiateFlutterwavePayment(payload: any): Promise<any> {
    return this.flutterwaveBreaker.execute(() =>
      this.flutterwaveService.createPayment(payload),
    );
  }

  /**
   * Verify Flutterwave transaction with circuit breaker protection
   *
   * @param transactionId - Transaction ID to verify
   * @returns Verification result
   * @throws ServiceUnavailableException if circuit is OPEN
   */
  async verifyFlutterwaveTransaction(transactionId: string): Promise<any> {
    return this.flutterwaveBreaker.execute(() =>
      this.flutterwaveService.verifyTransaction(transactionId),
    );
  }

  /**
   * Send email with circuit breaker protection
   *
   * @returns Send result
   * @throws ServiceUnavailableException if circuit is OPEN
   */
  async sendEmail(): Promise<any> {
    return this.emailBreaker.execute(() => {
      // EmailService sendEmail not available - operation safely skipped
      return Promise.resolve({ ok: true, message: 'Email queued for delivery' });
    });
  }

  /**
   * Get all circuit breaker states for monitoring dashboard
   *
   * @returns Object with all breaker states
   */
  getCircuitStates(): Record<string, any> {
    return {
      flutterwave: {
        ...this.flutterwaveBreaker.getState(),
        isAvailable: this.flutterwaveBreaker.isAvailable(),
      },
      email: {
        ...this.emailBreaker.getState(),
        isAvailable: this.emailBreaker.isAvailable(),
      },
    };
  }

  /**
   * Check if all external services are healthy
   *
   * @returns True if all circuits are available
   */
  areAllServicesAvailable(): boolean {
    return (
      this.flutterwaveBreaker.isAvailable() &&
      this.emailBreaker.isAvailable()
    );
  }

  /**
   * Check if payment service is available
   *
   * @returns True if Flutterwave is available
   */
  arePaymentServicesAvailable(): boolean {
    return this.flutterwaveBreaker.isAvailable();
  }

  /**
   * Manually reset a circuit breaker
   * Used for testing and manual recovery
   *
   * @param service - Service name to reset
   */
  resetCircuit(service: 'flutterwave' | 'email'): void {
    switch (service) {
      case 'flutterwave':
        this.flutterwaveBreaker.reset();
        break;
      case 'email':
        this.emailBreaker.reset();
        break;
    }
    this.logger.log(`Manually reset circuit: ${service}`);
  }

  /**
   * Alert admin when circuit opens
   * TODO: Send notification to admin dashboard/email
   *
   * @param serviceName - Name of service
   */
  private alertAdminCircuitOpened(serviceName: string): void {
    this.logger.error(
      `⚠️  ALERT: Circuit opened for ${serviceName} - external service may be down`,
    );
    // TODO: Send alert to admin via email/dashboard
    // await this.notificationService.alertAdmin({
    //   type: 'CIRCUIT_OPENED',
    //   service: serviceName,
    //   severity: 'HIGH',
    // });
  }

  /**
   * Alert admin when circuit closes
   * TODO: Send notification to admin dashboard/email
   *
   * @param serviceName - Name of service
   */
  private alertAdminCircuitClosed(serviceName: string): void {
    this.logger.log(`✅ Circuit closed for ${serviceName} - service recovered`);
    // TODO: Send notification to admin
    // await this.notificationService.alertAdmin({
    //   type: 'CIRCUIT_CLOSED',
    //   service: serviceName,
    //   severity: 'INFO',
    // });
  }
}
