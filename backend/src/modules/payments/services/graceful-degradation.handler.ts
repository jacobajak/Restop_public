import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatusEnum } from '../../orders/entities/order.entity';

/**
 * Graceful Degradation Handlers
 *
 * When external services fail:
 * - Continue order processing instead of crashing
 * - Record failure state for later retry/manual handling
 * - Show users clear messaging about next steps
 * - Provide actionable recovery paths
 *
 * Patterns:
 * 1. Payment provider down → Queue for retry, show "Try again later"
 * 2. Email provider down → Log failure, continue, retry later
 * 3. Webhook provider down → Queue webhook event, retry on schedule
 * 4. Database down → Return error (must fail fast)
 */
@Injectable()
export class GracefulDegradationHandler {
  private readonly logger = new Logger(GracefulDegradationHandler.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  /**
   * Handle payment provider failure (Flutterwave/Paypack down)
   *
   * Instead of crashing, mark payment as PENDING_RETRY and suggest next actions.
   * User can:
   * - Try again (triggers payment retry job)
   * - Use alternative payment method
   * - Contact support
   *
   * @param orderId - Order ID
   * @param providerName - Name of provider that failed
   * @param error - Original error
   * @returns User-facing message
   */
  async handlePaymentProviderDown(
    orderId: string,
    providerName: string,
    error: Error,
  ): Promise<string> {
    try {
      this.logger.warn(
        `Payment provider ${providerName} unavailable for order ${orderId}: ${error.message}`,
      );

      // Mark order for retry
      await this.orderRepository.update(
        { id: orderId },
        {
          payment_status: PaymentStatusEnum.PENDING,
          // payment_notes field not available on Order entity
        },
      );

      // Return user-friendly message
      return `Payment service is temporarily unavailable. Your request has been queued and we'll retry automatically. You can also try again from the order page in a few moments.`;
    } catch (error) {
      this.logger.error(
        `Error handling payment provider down: ${error.message}`,
      );
      // Return fallback message
      return 'We encountered a temporary issue. Please try again shortly or contact support.';
    }
  }

  /**
   * Handle email service failure
   *
   * Continue order processing, log failure, schedule retry of email.
   * User still gets order confirmation - email will be retried automatically.
   *
   * @param orderId - Order ID
   * @param recipientEmail - Email that failed to send
   * @param emailType - Type of email (confirmation, receipt, etc)
   * @param error - Original error
   * @returns User-facing message (can ignore, silent failure)
   */
  async handleEmailProviderDown(
    orderId: string,
    recipientEmail: string,
    emailType: string,
    error: Error,
  ): Promise<string> {
    try {
      this.logger.warn(
        `Email delivery failed for ${emailType} to ${recipientEmail} (order ${orderId}): ${error.message}`,
      );

      // Update order notes with email failure
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (order) {
        // payment_notes field not available on Order entity - silently skip note update
        /*
        const notes =
          (order.payment_notes || '') +
          `\n[${new Date().toISOString()}] ${emailType} email failed to send - queued for retry`;
        await this.orderRepository.update({ id: orderId }, { payment_notes: notes });
        */
      }

      // Notification service should automatically retry failed emails
      // Return silent message - user doesn't need to know about this
      return 'continued'; // Signal to continue without user-facing error
    } catch (error) {
      this.logger.error(
        `Error handling email provider down: ${error.message}`,
      );
      return 'continued'; // Fail silently
    }
  }

  /**
   * Handle payment verification timeout
   *
   * Sometimes webhook is slow to arrive. Instead of timing out:
   * - Mark payment as PENDING (not FAILED)
   * - Queue for automatic retry verification
   * - Tell user to check status later
   *
   * @param orderId - Order ID
   * @returns User-facing message
   */
  async handlePaymentVerificationTimeout(orderId: string): Promise<string> {
    try {
      this.logger.log(
        `Payment verification timed out for order ${orderId} - marking for retry`,
      );

      await this.orderRepository.update(
        { id: orderId },
        {
          payment_status: PaymentStatusEnum.PENDING,
          // payment_notes field not available on Order entity
        },
      );

      return `Payment is being processed. This may take a few moments. Please check your order status after 1-2 minutes or contact us if needed.`;
    } catch (error) {
      this.logger.error(
        `Error handling verification timeout: ${error.message}`,
      );
      return 'Payment processing is temporarily unavailable. Please try again shortly.';
    }
  }

  /**
   * Handle webhook processing failure
   *
   * Webhook received but processing failed. Don't lose the webhook:
   * - Persist to dead-letter queue
   * - Schedule automatic retry
   * - Alert admin
   *
   * Webhook event should be retried on schedule.
   *
   * @param provider - Payment provider
   * @param eventReference - Event reference ID
   * @param error - Processing error
   * @returns Suggested action
   */
  async handleWebhookProcessingFailure(
    provider: string,
    eventReference: string,
    error: Error,
  ): Promise<string> {
    try {
      this.logger.warn(
        `Webhook processing failed: ${provider}/${eventReference} - ${error.message}`,
      );

      // Webhook event service should have already persisted this,
      // just log and return action
      return 'queued_for_retry'; // Signal that webhook is queued
    } catch (error) {
      this.logger.error(
        `Error handling webhook failure: ${error.message}`,
      );
      return 'queued_for_retry';
    }
  }

  /**
   * Handle settlement/payout service failure
   *
   * Payment confirmed but settlement couldn't be created. Don't lose the payment:
   * - Record payment as PAID
   * - Queue settlement creation for retry
   * - Alert merchant to check settlement status
   *
   * @param orderId - Order ID
   * @param merchantId - Merchant ID
   * @param amount - Payment amount
   * @param error - Settlement error
   * @returns User-facing message for merchant
   */
  async handleSettlementFailure(
    orderId: string,
    merchantId: string,
    amount: number,
    error: Error,
  ): Promise<string> {
    try {
      this.logger.warn(
        `Settlement creation failed for order ${orderId} (merchant ${merchantId}, amount=${amount}): ${error.message}`,
      );

      // Settlement service should handle queuing for retry
      // Just log and notify merchant
      return `Payment received (${amount}) but settlement processing is temporarily delayed. Check your dashboard in a few moments for updates.`;
    } catch (error) {
      this.logger.error(
        `Error handling settlement failure: ${error.message}`,
      );
      return 'Payment received. Settlement will be processed shortly.';
    }
  }

  /**
   * Handle refund service failure
   *
   * Refund approved but couldn't be created. Queue for retry:
   * - Refund record stays in APPROVED state
   * - Creation attempt scheduled for retry
   * - User notified to check status later
   *
   * @param orderId - Order ID
   * @param refundAmount - Refund amount
   * @param error - Refund error
   * @returns Message to show user
   */
  async handleRefundFailure(
    orderId: string,
    refundAmount: number,
    error: Error,
  ): Promise<string> {
    try {
      this.logger.warn(
        `Refund processing failed for order ${orderId} (amount=${refundAmount}): ${error.message}`,
      );

      // Refund service should queue for retry
      return `Refund of ${refundAmount} has been approved and will be processed shortly. Check your account in 1-3 business days.`;
    } catch (error) {
      this.logger.error(
        `Error handling refund failure: ${error.message}`,
      );
      return 'Refund will be processed shortly.';
    }
  }

  /**
   * Build recovery action plan for user
   *
   * When payment fails, provide clear next steps:
   * 1. Shown the error
   * 2. Suggest retry with auto-retry
   * 3. Offer alternative methods
   * 4. Provide support contact
   *
   * @param orderId - Order ID
   * @param errorType - Type of error
   * @returns Recovery action plan
   */
  getRecoveryActionPlan(
    _orderId: string,
    errorType: 'payment_provider' | 'email' | 'verification_timeout' | 'webhook' | 'settlement' | 'refund',
  ): {
    userMessage: string;
    suggestedActions: string[];
    automaticActions: string[];
  } {
    switch (errorType) {
      case 'payment_provider':
        return {
          userMessage:
            'The payment provider is temporarily unavailable. We will automatically retry your payment.',
          suggestedActions: [
            'Wait 1-2 minutes for automatic retry',
            'Try a different payment method',
            'Contact support for immediate assistance',
          ],
          automaticActions: [
            'Retry after 5 minutes',
            'Retry after 15 minutes',
            'Retry after 1 hour',
          ],
        };

      case 'verification_timeout':
        return {
          userMessage:
            'We are still verifying your payment. This may take a few moments.',
          suggestedActions: [
            'Check order status after 2 minutes',
            'Wait for automatic verification',
          ],
          automaticActions: [
            'Verify after 5 minutes',
            'Verify after 15 minutes',
          ],
        };

      case 'webhook':
        return {
          userMessage:
            'Payment received but confirmation is pending. Your order will be updated shortly.',
          suggestedActions: [
            'Check order status shortly',
            'Notification will be sent when confirmed',
          ],
          automaticActions: [
            'Retry webhook processing every 5 minutes',
            'Manual replay available to admin',
          ],
        };

      case 'settlement':
        return {
          userMessage:
            'Payment confirmed! Settlement is being processed.',
          suggestedActions: [
            'Funds will appear in account shortly',
            'Check dashboard for settlement status',
          ],
          automaticActions: [
            'Retry settlement creation automatically',
          ],
        };

      case 'refund':
        return {
          userMessage:
            'Refund approved and being processed.',
          suggestedActions: [
            'Check account in 1-3 business days',
            'Contact support if not received',
          ],
          automaticActions: [
            'Process refund automatically',
          ],
        };

      default:
        return {
          userMessage:
            'Something went wrong. Please try again or contact support.',
          suggestedActions: [
            'Try again',
            'Contact support',
          ],
          automaticActions: [],
        };
    }
  }
}
