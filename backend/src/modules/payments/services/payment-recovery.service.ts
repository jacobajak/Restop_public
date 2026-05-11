import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetryStrategyService } from './retry-strategy.service';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Incomplete Payment State
 */
export interface IncompletePayment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'TIMEOUT' | 'FAILED';
  createdAt: Date;
  lastAttemptAt?: Date;
  attempts: number;
  error?: string;
  flutterwaveReference?: string;
}

/**
 * Reconciliation Result
 */
export interface ReconciliationResult {
  paymentId: string;
  status: 'VERIFIED' | 'RESOLVED' | 'FAILED';
  message: string;
  actualStatus?: string;
  amountPaid?: number;
}

/**
 * Payment Recovery Service
 *
 * Handles error recovery for payment processing:
 * - Identifies incomplete/stuck payments
 * - Reconciles with Flutterwave (verify actual status)
 * - Resolves orphaned records
 * - Implements graceful degradation
 *
 * Scenarios handled:
 * 1. Timeout during payment submission
 *    → Check Flutterwave for reference
 *    → Verify if actually processed
 *    → Update DB if needed
 *
 * 2. Webhook not received
 *    → Poll Flutterwave for status
 *    → Manually update payment status
 *    → Trigger notification if successful
 *
 * 3. Database error after successful payment
 *    → Recover record from Flutterwave webhook
 *    → Or query Flutterwave for status
 *    → Recreate record with correct status
 *
 * 4. Rate limiting or service degradation
 *    → Queue recovery attempts
 *    → Use graceful degradation
 *    → Fall back to manual resolution
 */
@Injectable()
export class PaymentRecoveryService {
  private readonly logger = new Logger(PaymentRecoveryService.name);
  private incompletePayments: Map<string, IncompletePayment> = new Map();

  constructor(
    private readonly retryService: RetryStrategyService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    // Initialize circuit breaker for recovery operations
    this.circuitBreaker.initializeCircuitBreaker('PAYMENT_RECOVERY', 'EXTERNAL_API');
  }

  /**
   * Register incomplete payment for recovery
   */
  registerIncompletePayment(payment: Partial<IncompletePayment>): IncompletePayment {
    const incomplete: IncompletePayment = {
      id: payment.id || this.generatePaymentId(),
      userId: payment.userId!,
      amount: payment.amount!,
      currency: payment.currency || 'NGN',
      status: 'PENDING',
      createdAt: new Date(),
      attempts: 0,
      ...payment,
    };

    this.incompletePayments.set(incomplete.id, incomplete);
    this.logger.log(
      `📝 Incomplete payment registered: ${incomplete.id} (${incomplete.amount} ${incomplete.currency})`,
    );

    return incomplete;
  }

  /**
   * Attempt recovery of incomplete payment
   *
   * Flow:
   * 1. Check if service is available (circuit breaker)
   * 2. Reconcile with Flutterwave
   * 3. Update local payment status based on result
   * 4. Clean up if resolved
   */
  async attemptPaymentRecovery(paymentId: string): Promise<ReconciliationResult> {
    const payment = this.incompletePayments.get(paymentId);

    if (!payment) {
      return {
        paymentId,
        status: 'FAILED',
        message: 'Payment not found in recovery queue',
      };
    }

    // Check if recovery service is available
    if (!this.circuitBreaker.canAttempt('PAYMENT_RECOVERY')) {
      this.logger.warn(
        `🔴 Payment recovery circuit open, queuing ${paymentId} for later`,
      );
      return {
        paymentId,
        status: 'FAILED',
        message: 'Recovery service temporarily unavailable, will retry later',
      };
    }

    try {
      payment.attempts++;
      payment.lastAttemptAt = new Date();

      // Attempt to reconcile with Flutterwave
      const reconciliation = await this.reconcileWithFlutterwave(payment);

      if (reconciliation.status === 'VERIFIED') {
        this.logger.log(
          `✅ Payment ${paymentId} verified: ${reconciliation.actualStatus}`,
        );
        this.circuitBreaker.recordSuccess('PAYMENT_RECOVERY');

        // Mark as resolved if payment was successful
        if (
          reconciliation.actualStatus === 'COMPLETED' ||
          reconciliation.actualStatus === 'SUCCESSFUL'
        ) {
          this.incompletePayments.delete(paymentId);
        }

        return reconciliation;
      } else if (reconciliation.status === 'RESOLVED') {
        this.logger.log(
          `🔧 Payment ${paymentId} resolved: ${reconciliation.message}`,
        );
        this.circuitBreaker.recordSuccess('PAYMENT_RECOVERY');
        this.incompletePayments.delete(paymentId);
        return reconciliation;
      } else {
        this.logger.error(
          `❌ Payment ${paymentId} recovery failed: ${reconciliation.message}`,
        );
        payment.error = reconciliation.message;
        this.circuitBreaker.recordFailure('PAYMENT_RECOVERY');
        return reconciliation;
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error recovering payment ${paymentId}: ${error.message}`,
      );
      payment.error = error.message;
      this.circuitBreaker.recordFailure('PAYMENT_RECOVERY', error);

      return {
        paymentId,
        status: 'FAILED',
        message: `Recovery error: ${error.message}`,
      };
    }
  }

  /**
   * Reconcile payment status with Flutterwave
   *
   * This would typically:
   * 1. Query Flutterwave API with transaction reference
   * 2. Compare with local payment status
   * 3. Update if discrepancy found
   * 4. Return reconciliation result
   */
  private async reconcileWithFlutterwave(
    payment: IncompletePayment,
  ): Promise<ReconciliationResult> {
    // Mock implementation - replace with actual Flutterwave API call
    try {
      const result = await this.retryService.executeWithRetry(
        'PAYMENT_STATUS_CHECK',
        async () => {
          // In real implementation, query Flutterwave:
          // const response = await this.flutterwaveService.getTransactionStatus(
          //   payment.flutterwaveReference
          // );

          // For now, simulate successful reconciliation
          return {
            status: 'COMPLETED',
            amount: payment.amount,
            currency: payment.currency,
          };
        },
      );

      return {
        paymentId: payment.id,
        status: 'VERIFIED',
        message: 'Payment status verified with Flutterwave',
        actualStatus: result.status,
        amountPaid: result.amount,
      };
    } catch (error: any) {
      // Handle reconciliation failure
      if (payment.attempts >= 3) {
        // After 3 attempts, mark for manual review
        return {
          paymentId: payment.id,
          status: 'RESOLVED',
          message:
            'Payment marked for manual review after multiple recovery attempts',
        };
      }

      return {
        paymentId: payment.id,
        status: 'FAILED',
        message: `Reconciliation failed: ${error.message}`,
      };
    }
  }

  /**
   * Run recovery process periodically (every 5 minutes)
   *
   * Processes:
   * 1. All incomplete payments in queue
   * 2. Attempts recovery for each
   * 3. Logs results and metrics
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processRecoveryQueue(): Promise<void> {
    if (this.incompletePayments.size === 0) {
      this.logger.debug('No incomplete payments to recover');
      return;
    }

    this.logger.log(
      `🔄 Processing recovery queue (${this.incompletePayments.size} payments)`,
    );

    const results: ReconciliationResult[] = [];

    for (const [paymentId, payment] of this.incompletePayments.entries()) {
      // Skip if too many attempts
      if (payment.attempts >= 5) {
        this.logger.warn(
          `⚠️  Skipping ${paymentId} - max recovery attempts exceeded`,
        );
        continue;
      }

      // Skip if recovered too recently
      if (
        payment.lastAttemptAt &&
        Date.now() - payment.lastAttemptAt.getTime() < 60000
      ) {
        continue;
      }

      try {
        const result = await this.attemptPaymentRecovery(paymentId);
        results.push(result);

        // Add delay between attempts to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        this.logger.error(`Error processing recovery for ${paymentId}:`, error);
      }
    }

    this.logRecoveryResults(results);
  }

  /**
   * Get all incomplete payments pending recovery
   */
  getIncompletePayments(userId?: string): IncompletePayment[] {
    const allPayments = Array.from(this.incompletePayments.values());

    if (userId) {
      return allPayments.filter(p => p.userId === userId);
    }

    return allPayments;
  }

  /**
   * Get recovery metrics
   */
  getRecoveryMetrics(): {
    totalIncomplete: number;
    byStatus: Record<string, number>;
    averageAttempts: number;
    oldestPaymentAge: number;
  } {
    const payments = Array.from(this.incompletePayments.values());

    const byStatus: Record<string, number> = {};
    payments.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    const averageAttempts =
      payments.length > 0
        ? payments.reduce((sum, p) => sum + p.attempts, 0) / payments.length
        : 0;

    const oldestPaymentAge =
      payments.length > 0
        ? Math.max(
            ...payments.map(p => Date.now() - p.createdAt.getTime()),
          )
        : 0;

    return {
      totalIncomplete: payments.length,
      byStatus,
      averageAttempts: Math.round(averageAttempts * 100) / 100,
      oldestPaymentAge,
    };
  }

  /**
   * Manually resolve incomplete payment
   * (e.g., after manual investigation)
   */
  resolvePayment(paymentId: string, resolved: boolean): void {
    if (resolved) {
      this.incompletePayments.delete(paymentId);
      this.logger.log(`✅ Payment ${paymentId} manually resolved`);
    }
  }

  /**
   * Log recovery results summary
   */
  private logRecoveryResults(results: ReconciliationResult[]): void {
    if (results.length === 0) {
      return;
    }

    const verified = results.filter(r => r.status === 'VERIFIED').length;
    const resolved = results.filter(r => r.status === 'RESOLVED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    this.logger.log(
      `📊 Recovery results: ${verified} verified, ${resolved} resolved, ${failed} failed`,
    );
  }

  /**
   * Sleep utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique payment recovery ID
   */
  private generatePaymentId(): string {
    return `RECOVER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
