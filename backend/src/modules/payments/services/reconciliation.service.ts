import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { TransactionVerificationService } from './transaction-verification.service';
import { PaymentEventService } from './payment-event.service';
import { PaymentEventTypeEnum } from '../entities/payment-event.entity';

/**
 * ReconciliationService
 * 
 * Background job that runs every 5-10 minutes.
 * 
 * Problem it solves:
 * Webhooks are not 100% reliable in African networks.
 * 
 * Solution:
 * Periodically query Flutterwave API to verify pending payments.
 * API verification overrides webhook status (source of truth).
 * 
 * Runs on schedule (@Cron) and can be manually triggered.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly transactionVerificationService: TransactionVerificationService,
    private readonly paymentEventService: PaymentEventService,
  ) {}

  /**
   * Run reconciliation job every 5 minutes
   * 
   * Cron expression breakdown:
   * 0-59/5 = every 5 minutes
   * * = every hour
   * * = every day
   * * = every month
   * 0-6 = every day of week
   * 
   * TODO: Install @nestjs/schedule and uncomment @Cron decorator
   */
  // @Cron('0 */5 * * * *') // Run every 5 minutes
  async reconcilePaymentsPeriodic(): Promise<void> {
    try {
      this.logger.log('🔄 Starting periodic payment reconciliation...');
      const result = await this.reconcilePendingPayments();
      
      if (result.verified > 0 || result.failed > 0 || result.timedOut > 0) {
        this.logger.log(
          `✅ Reconciliation complete: verified=${result.verified}, failed=${result.failed}, timedOut=${result.timedOut}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ Reconciliation job failed: ${error.message}`);
    }
  }

  /**
   * Manually trigger reconciliation (for testing or admin control)
   * 
   * Returns statistics on what was reconciled.
   */
  async reconcilePendingPayments(): Promise<{
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
      // Find orders PENDING for 5+ minutes
      // (Allow webhook time to be processed)
      const retryThreshold = new Date(Date.now() - 5 * 60 * 1000);
      
      // 30 minute timeout for payment confirmation
      const timeoutThreshold = new Date(Date.now() - 30 * 60 * 1000);

      const pendingOrders = await this.orderRepository.find({
        where: {
          payment_status: PaymentStatusEnum.PENDING,
        },
      });

      this.logger.debug(
        `Reconciliation: Found ${pendingOrders.length} pending orders to check`,
      );

      for (const order of pendingOrders) {
        // Only reconcile Flutterwave orders
        if (!order.flutterwave_id) {
          continue;
        }

        processed++;

        try {
          // Check if order has timed out (30 minutes)
          if (order.created_at < timeoutThreshold) {
            this.logger.warn(
              `⏰ Order ${order.id} has been pending for 30+ minutes - marking as FAILED`,
            );

            order.payment_status = PaymentStatusEnum.FAILED;
            order.rejection_reason =
              'Payment confirmation timeout - no response from payment provider after 30 minutes';
            await this.orderRepository.save(order);

            await this.paymentEventService.logEvent(
              order.id,
              PaymentEventTypeEnum.FAILED,
              {
                description: 'Payment timeout - pending for 30+ minutes',
                error: order.rejection_reason,
              },
            );

            timedOut++;
            continue;
          }

          // Only retry if order has been pending 5+ minutes
          if (order.created_at < retryThreshold) {
            this.logger.debug(
              `🔍 Reconciling order ${order.id} (tx_ref=${order.tx_ref}, flutterwave_id=${order.flutterwave_id})`,
            );

            await this.paymentEventService.logEvent(
              order.id,
              PaymentEventTypeEnum.RETRY,
              {
                description: 'Automatic reconciliation - verifying with API',
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
              description: 'Reconciliation verification retry failed',
              error: error.message,
            },
          ).catch((err) => {
            this.logger.error(`Failed to log event: ${err.message}`);
          });
        }
      }

      this.logger.debug(
        `Reconciliation summary: processed=${processed}, verified=${verified}, failed=${failed}, timedOut=${timedOut}`,
      );

      return { processed, verified, failed, timedOut, errors };
    } catch (error: any) {
      this.logger.error(`❌ Error during reconciliation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get reconciliation status (for monitoring)
   */
  async getReconciliationStatus(): Promise<{
    pending_orders: number;
    failed_orders: number;
    last_reconciliation: string;
  }> {
    const pending = await this.orderRepository.count({
      where: { payment_status: PaymentStatusEnum.PENDING },
    });

    const failed = await this.orderRepository.count({
      where: { payment_status: PaymentStatusEnum.FAILED },
    });

    return {
      pending_orders: pending,
      failed_orders: failed,
      last_reconciliation: new Date().toISOString(),
    };
  }
}
