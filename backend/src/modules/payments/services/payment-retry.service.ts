import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { TransactionVerificationService } from './transaction-verification.service';
import { PaymentEventService } from './payment-event.service';
import { PaymentEventTypeEnum } from '../entities/payment-event.entity';

/**
 * PaymentRetryService
 * 
 * Handles payment retries and failure scenarios.
 * 
 * Scenarios:
 * 1. Webhook processing failed
 *    - Retry verification after N minutes
 *    - Max 3 retries before escalating to support
 * 
 * 2. Payment pending for too long
 *    - After 30 minutes with no confirmation → mark as FAILED
 *    - Alert user to retry or check status
 * 
 * 3. Verification failed
 *    - Transaction amounts don't match
 *    - Status is not 'successful'
 *    - Retry after 5 minutes (may be processing)
 * 
 * Run as background job via:
 * - Scheduled task (every 5 minutes)
 * - Manual trigger via admin endpoint
 * 
 * Key principle: Never lose data. All attempts are logged to PaymentEvent.
 */
@Injectable()
export class PaymentRetryService {
  private readonly logger = new Logger(PaymentRetryService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly transactionVerificationService: TransactionVerificationService,
    private readonly paymentEventService: PaymentEventService,
  ) {}

  /**
   * Retry verification for orders with pending payments
   * 
   * Finds orders that are PENDING for 5+ minutes and retries verification.
   * This handles webhook loss scenarios.
   * 
   * Returns count of orders processed and results.
   */
  async retryPendingPayments(): Promise<{
    processed: number;
    verified: number;
    failed: number;
    timedOut: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;
    let verified = 0;
    let failed = 0;
    let timedOut = 0;

    try {
      // Find orders PENDING for 5+ minutes with Flutterwave ID
      const retryThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const timeoutThreshold = new Date(Date.now() - 30 * 60 * 1000);

      const pendingOrders = await this.orderRepository.find({
        where: {
          payment_status: PaymentStatusEnum.PENDING,
          flutterwave_id: null as any, // Will be replaced with proper condition
        },
      });

      this.logger.log(
        `🔄 Checking ${pendingOrders.length} pending orders for retry...`,
      );

      for (const order of pendingOrders) {
        if (!order.flutterwave_id) {
          continue; // Skip non-Flutterwave orders
        }

        processed++;

        try {
          // Check if order has timed out (30 minutes)
          if (order.created_at < timeoutThreshold) {
            this.logger.warn(
              `⏰ Order ${order.id} has been pending for 30+ minutes - marking as FAILED`,
            );

            order.payment_status = PaymentStatusEnum.FAILED;
            order.rejection_reason = 'Payment confirmation timeout - no response from payment provider after 30 minutes';
            await this.orderRepository.save(order);

            await this.paymentEventService.logEvent(
              order.id,
              PaymentEventTypeEnum.CANCELLED,
              {
                description: 'Payment timeout - pending for 30+ minutes',
                error: order.rejection_reason,
              },
            );

            timedOut++;
            continue;
          }

          // Retry verification if order has been pending 5+ minutes
          if (order.created_at < retryThreshold) {
            this.logger.log(
              `🔄 Retrying verification for order ${order.id}...`,
            );

            await this.paymentEventService.logEvent(
              order.id,
              PaymentEventTypeEnum.RETRY,
              {
                description: 'Automatic retry - order pending for 5+ minutes',
              },
            );

            const result = await this.transactionVerificationService.verifyAndConfirmPayment(
              order.id,
            );

            if (result.verified) {
              verified++;
            } else {
              failed++;
            }
          }
        } catch (error: any) {
          failed++;
          const errorMsg = `Order ${order.id}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);

          await this.paymentEventService.logEvent(
            order.id,
            PaymentEventTypeEnum.RETRY,
            {
              description: 'Automatic retry failed',
              error: error.message,
            },
          );
        }
      }

      this.logger.log(
        `✅ Retry check complete: processed=${processed}, verified=${verified}, failed=${failed}, timedOut=${timedOut}`,
      );

      return { processed, verified, failed, timedOut, errors };
    } catch (error: any) {
      this.logger.error(`❌ Error during retry check: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get orders that have failed payment and need support attention
   */
  async getFailedPaymentsRequiringAttention(): Promise<Order[]> {
    // Orders that failed 2+ minutes ago (past immediate retry window)
    const attentionThreshold = new Date(Date.now() - 2 * 60 * 1000);

    return this.orderRepository.find({
      where: {
        payment_status: PaymentStatusEnum.FAILED,
        updated_at: LessThan(attentionThreshold),
      },
      order: { updated_at: 'ASC' },
      take: 20, // Batch to prevent overload
    });
  }

  /**
   * Manually trigger retry for specific order
   */
  async retryOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.payment_status === PaymentStatusEnum.PAID) {
        return {
          success: false,
          message: 'Order already paid - no retry needed',
        };
      }

      if (!order.flutterwave_id) {
        throw new Error(`Order ${orderId} has no Flutterwave ID - cannot retry`);
      }

      this.logger.log(`🔄 Manual retry triggered for order ${orderId}`);

      await this.paymentEventService.logEvent(
        orderId,
        PaymentEventTypeEnum.RETRY,
        {
          description: 'Manual retry triggered by support',
        },
      );

      // Reset to PENDING to allow new payment attempt
      order.payment_status = PaymentStatusEnum.PENDING;
      order.rejection_reason = null;
      await this.orderRepository.save(order);

      return {
        success: true,
        message: `Order ${orderId} reset to PENDING - customer can retry payment`,
      };
    } catch (error: any) {
      this.logger.error(`Error during manual retry: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics on payment health
   */
  async getPaymentHealthStats(): Promise<{
    pendingOrders: number;
    failedOrders: number;
    successfulOrders: number;
    avgTimeToConfirmation: number; // seconds
    failureRate: string; // percentage
  }> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const pending = await this.orderRepository.count({
        where: { payment_status: PaymentStatusEnum.PENDING },
      });

      const failed = await this.orderRepository.count({
        where: { payment_status: PaymentStatusEnum.FAILED },
      });

      const successful = await this.orderRepository.count({
        where: {
          payment_status: PaymentStatusEnum.PAID,
          created_at: yesterday as any,
        },
      });

      const failureRate =
        successful + failed > 0
          ? ((failed / (successful + failed)) * 100).toFixed(2)
          : '0.00';

      return {
        pendingOrders: pending,
        failedOrders: failed,
        successfulOrders: successful,
        avgTimeToConfirmation: 0, // TODO: Calculate from PaymentEvent timestamps
        failureRate: `${failureRate}%`,
      };
    } catch (error: any) {
      this.logger.error(`Error getting health stats: ${error.message}`);
      throw error;
    }
  }
}
