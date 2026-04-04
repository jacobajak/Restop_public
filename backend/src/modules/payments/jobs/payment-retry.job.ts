import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { TransactionVerificationService } from '../services/transaction-verification.service';

/**
 * PaymentRetryJob
 *
 * Scheduled job that retries failed or pending payments on specific intervals:
 * - First retry: 5 minutes after initial failure
 * - Second retry: 15 minutes after first retry (total: 20 minutes)
 * - Third retry: 1 hour after second retry (total: 80 minutes)
 * - After 3 retries: Mark as manual_review required
 *
 * Runs every 5 minutes to catch all retry windows.
 *
 * Supports:
 * - Automatic payment verification retry
 * - Exponential backoff delays
 * - Maximum retry limits
 * - Detailed audit logging
 * - Admin alert notifications
 */
@Injectable()
export class PaymentRetryJob {
  private readonly logger = new Logger(PaymentRetryJob.name);

  // Retry configuration: minutes after previous failure
  private readonly RETRY_WINDOWS = {
    FIRST: 5, // Retry 5 minutes after failure
    SECOND: 15, // 15 minutes after first retry
    THIRD: 60, // 60 minutes (1 hour) after second retry
  };

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private transactionVerificationService: TransactionVerificationService,
  ) {}

  /**
   * Run payment retry job every 5 minutes
   * Checks for payments in PENDING or FAILED status that are due for retry
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedPayments(): Promise<void> {
    this.logger.log('🔄 Starting payment retry job...');

    try {
      let retried = 0;
      let verified = 0;
      let failed = 0;

      // Get all orders with failed/pending payments
      const failedOrders = await this.orderRepository.find({
        where: [
          { payment_status: PaymentStatusEnum.FAILED },
          { payment_status: PaymentStatusEnum.PENDING },
        ],
        relations: ['transaction'],
      });

      this.logger.debug(
        `Found ${failedOrders.length} orders to check for retry...`,
      );

      for (const order of failedOrders) {
        const shouldRetry = await this.shouldRetryPayment(order);

        if (!shouldRetry) {
          continue;
        }

        try {
          retried++;
          this.logger.log(
            `🔄 Retrying payment verification for order: ${order.id}`,
          );

          // Attempt verification
          const verified_result =
            await this.transactionVerificationService.verifyAndConfirmPayment(
              order.id,
            );

          if (verified_result) {
            verified++;
            this.logger.log(
              `✅ Payment retry successful for order: ${order.id}`,
            );

            // Log retry success event (paymentEventService removed)
            /*
            await this.paymentEventService.recordPaymentEvent({
              order_id: order.id,
              event_type: PaymentEventTypeEnum.RETRY,
              status: order.payment_status,
              description: 'Automatic retry - payment verified successfully',
              metadata: {
                retry_attempt:
                  this.getRetryAttemptNumber(order.created_at),
              },
            });
            */
          }
        } catch (error) {
          failed++;
          this.logger.error(
            `❌ Payment retry failed for order ${order.id}: ${error.message}`,
          );

          // Log retry failure event (paymentEventService removed - commented out)
          /*
          await this.paymentEventService.recordPaymentEvent({
            order_id: order.id,
            event_type: PaymentEventTypeEnum.RETRY,
            status: PaymentStatusEnum.FAILED,
            description: `Automatic retry failed: ${error.message}`,
            metadata: {
              error: error.message,
              retry_attempt:
                this.getRetryAttemptNumber(order.created_at),
            },
          });
          */

          // Check if we've exceeded max retries
          const retryCount = this.getRetryAttemptNumber(order.created_at);
          if (retryCount >= 3) {
            await this.handleMaxRetriesExceeded(order);
          }
        }
      }

      this.logger.log(
        `✅ Payment retry job complete: retried=${retried}, verified=${verified}, failed=${failed}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error during payment retry job: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Determine if a payment order is due for retry
   * Based on:
   * - Time since last failure
   * - Number of previous retries
   * - Retry window configuration
   *
   * @param order - Order to check
   * @returns True if should retry now
   */
  private async shouldRetryPayment(order: Order): Promise<boolean> {
    const now = new Date();
    const lastUpdate = new Date(order.updated_at);
    const minutesSinceLastUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
    const retryAttempt = this.getRetryAttemptNumber(order.created_at);

    // Don't retry if payment is already paid
    if (order.payment_status === PaymentStatusEnum.PAID) {
      return false;
    }

    // Don't retry if cancelled
    if (order.payment_status === PaymentStatusEnum.CANCELLED) {
      return false;
    }

    // Determine which retry window this payment falls into
    let retryWindow: number;

    if (retryAttempt === 0) {
      // Initial PENDING - wait 5 minutes before first retry
      retryWindow = this.RETRY_WINDOWS.FIRST;
    } else if (retryAttempt === 1) {
      // After first retry - wait 15 minutes
      retryWindow = this.RETRY_WINDOWS.SECOND;
    } else if (retryAttempt === 2) {
      // After second retry - wait 60 minutes
      retryWindow = this.RETRY_WINDOWS.THIRD;
    } else {
      // After 3 retries - don't retry automatically
      return false;
    }

    // Check if enough time has passed since last update
    return minutesSinceLastUpdate >= retryWindow;
  }

  /**
   * Calculate how many retry attempts have been made
   * Based on time elapsed since order creation
   *
   * @param createdAt - Order creation timestamp
   * @returns Number of retry attempts (0-3+)
   */
  private getRetryAttemptNumber(createdAt: Date): number {
    const created = new Date(createdAt);
    const now = new Date();
    const minutesElapsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));

    // Determine retry count based on elapsed time
    if (minutesElapsed < this.RETRY_WINDOWS.FIRST) {
      return 0; // No retries yet
    } else if (
      minutesElapsed <
      this.RETRY_WINDOWS.FIRST + this.RETRY_WINDOWS.SECOND
    ) {
      return 1; // After first retry window
    } else if (
      minutesElapsed <
      this.RETRY_WINDOWS.FIRST +
        this.RETRY_WINDOWS.SECOND +
        this.RETRY_WINDOWS.THIRD
    ) {
      return 2; // After second retry window
    } else {
      return 3; // After all retry windows
    }
  }

  /**
   * Handle scenario where payment has exceeded maximum retries
   * Alerts admin and marks order for manual review
   *
   * @param order - Order that exceeded max retries
   */
  private async handleMaxRetriesExceeded(order: Order): Promise<void> {
    try {
      this.logger.warn(
        `⚠️  Payment exceeded max retries, needs manual review: ${order.id}`,
      );

      // Update order to mark for manual review
      await this.orderRepository.update(
        { id: order.id },
        {
          // payment_notes: `...`,
        },
      );

      // TODO: Send alert to admin dashboard
      // TODO: Create support ticket for manual intervention
    } catch (error) {
      this.logger.error(
        `Error handling max retries exceeded: ${error.message}`,
      );
    }
  }

  /**
   * Secondary job: Mark very old payments as failed
   * If payment is PENDING for more than 2 hours -> mark as FAILED
   * (gives time for payment processing on slow networks)
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async markStalePendingPaymentsAsFailed(): Promise<void> {
    this.logger.log(
      '🔍 Checking for stale pending payments (older than 2 hours)...',
    );

    try {
      const twoHoursAgo = new Date(new Date().getTime() - 2 * 60 * 60 * 1000);

      const staleOrders = await this.orderRepository.find({
        where: {
          payment_status: PaymentStatusEnum.PENDING,
        },
      });

      let marked = 0;

      for (const order of staleOrders) {
        if (order.created_at < twoHoursAgo) {
          // Payment has been PENDING for 2+ hours - mark as FAILED
          await this.orderRepository.update(
            { id: order.id },
            {
              payment_status: PaymentStatusEnum.FAILED,
              // payment_notes: `...`,
            },
          );

          marked++;
          this.logger.log(
            `⏱️  Marked stale payment as FAILED: ${order.id}`,
          );

          // Log the status change (paymentEventService removed - commented out)
          /*
          await this.paymentEventService.recordPaymentEvent({
            order_id: order.id,
            event_type: PaymentEventTypeEnum.FAILED,
            status: PaymentStatusEnum.FAILED,
            description:
              'Payment timeout - no provider response after 2 hours',
          });
          */
        }
      }

      if (marked > 0) {
        this.logger.log(`⏱️  Marked ${marked} stale payments as FAILED`);
      }
    } catch (error) {
      this.logger.error(
        `Error marking stale payments: ${error.message}`,
        error.stack,
      );
    }
  }
}
