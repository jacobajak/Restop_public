import { Injectable, Logger } from '@nestjs/common';
import { Order } from '../../orders/entities/order.entity';
import { PaymentTransaction } from '../entities/payment.entity';

interface NotificationMessage {
  recipient_phone: string;
  message_type: 'PAYMENT_FAILED' | 'PAYMENT_SUCCESS' | 'REFUND_REQUESTED' | 'ORDER_CANCELLED' | 'PAYMENT_PENDING' | 'PAYMENT_TIMEOUT';
  title?: string;
  body: string;
  action_url?: string;
  retry_count?: number;
}

/**
 * FailureCommunicationService
 * 
 * Communicates payment failures to customers via:
 * - SMS (primary for Africa)
 * - Push notifications (if user has app)
 * - In-app notifications
 * - Email (for important info)
 * 
 * Strategy:
 * - Immediate SMS on payment failure (customer action needed)
 * - Clear explanation of what went wrong
 * - Next steps and retry instructions
 * - Auto-retry after timeout with notification
 * 
 * MVP: Logs messages (actual SMS provider integration in Phase 3)
 */
@Injectable()
export class FailureCommunicationService {
  private readonly logger = new Logger(FailureCommunicationService.name);

  /**
   * Notify customer of payment failure
   * Sends SMS with clear explanation and retry instructions
   */
  async notifyPaymentFailed(
    order: Order,
    _payment: PaymentTransaction,
    reason: string,
  ): Promise<NotificationMessage> {
    try {
      const message: NotificationMessage = {
        recipient_phone: order.phone_number,
        message_type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        body: this.buildPaymentFailedMessage(order, reason),
      };

      // In MVP: just log the message
      this.logger.warn(
        `📵 SMS to ${order.phone_number}: ${message.body}`,
      );

      // TODO: Phase 3 - Integrate with SMS provider (Twilio, AWS SNS, etc)
      // await this.smsProvider.sendSMS({
      //   phone: message.recipient_phone,
      //   message: message.body,
      // });

      return message;
    } catch (error) {
      this.logger.error(`Error notifying payment failure for order ${order.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify customer of successful payment
   */
  async notifyPaymentSuccess(order: Order, _payment: PaymentTransaction): Promise<NotificationMessage> {
    try {
      const message: NotificationMessage = {
        recipient_phone: order.phone_number,
        message_type: 'PAYMENT_SUCCESS',
        title: 'Payment Confirmed',
        body: this.buildPaymentSuccessMessage(order),
      };

      this.logger.log(`✅ SMS to ${order.phone_number}: ${message.body}`);

      // TODO: Phase 3 - SMS integration
      // await this.smsProvider.sendSMS(message);

      return message;
    } catch (error) {
      this.logger.error(`Error notifying payment success for order ${order.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify customer that refund was requested
   * Informs them of expected processing time
   */
  async notifyRefundRequested(
    order: Order,
    amount: number,
    estimatedDays: number = 2,
  ): Promise<NotificationMessage> {
    try {
      const message: NotificationMessage = {
        recipient_phone: order.phone_number,
        message_type: 'REFUND_REQUESTED',
        title: 'Refund Requested',
        body:
          `Your refund of ${amount} RWF has been requested. ` +
          `It will be processed within ${estimatedDays} business days. ` +
          `You will receive another SMS when it's completed.`,
      };

      this.logger.log(`💳 Refund notification to ${order.phone_number}: ${message.body}`);

      // TODO: Phase 3 - SMS integration
      // await this.smsProvider.sendSMS(message);

      return message;
    } catch (error) {
      this.logger.error(`Error notifying refund for order ${order.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify customer of order cancellation
   */
  async notifyOrderCancelled(order: Order, reason: string): Promise<NotificationMessage> {
    try {
      const message: NotificationMessage = {
        recipient_phone: order.phone_number,
        message_type: 'ORDER_CANCELLED',
        title: 'Order Cancelled',
        body: `Your order #${order.order_number} has been cancelled. Reason: ${reason}. ` +
          `If you were charged, a refund will be processed automatically.`,
      };

      this.logger.log(`❌ Cancellation notification to ${order.phone_number}: ${message.body}`);

      // TODO: Phase 3 - SMS integration
      // await this.smsProvider.sendSMS(message);

      return message;
    } catch (error) {
      this.logger.error(`Error notifying cancellation for order ${order.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify customer that payment is pending (webhook delay)
   * Reassure them and explain they don't need to retry
   */
  async notifyPaymentPending(order: Order, estimatedSeconds: number = 30): Promise<NotificationMessage> {
    try {
      const message: NotificationMessage = {
        recipient_phone: order.phone_number,
        message_type: 'PAYMENT_PENDING',
        title: 'Payment Processing',
        body:
          `Your payment is being processed. This usually takes less than ${estimatedSeconds} seconds. ` +
          `Please do NOT retry. We will confirm via SMS when complete.`,
      };

      this.logger.log(`⏳ Pending notification to ${order.phone_number}: ${message.body}`);

      // TODO: Phase 3 - SMS integration
      // await this.smsProvider.sendSMS(message);

      return message;
    } catch (error) {
      this.logger.error(`Error notifying payment pending for order ${order.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify customer of payment timeout and auto-retry
   * Informs them system is retrying automatically
   */
  async notifyPaymentTimeout(order: Order, attempt: number): Promise<NotificationMessage> {
    try {
      const message: NotificationMessage = {
        recipient_phone: order.phone_number,
        message_type: 'PAYMENT_TIMEOUT',
        title: 'Payment Still Processing',
        body:
          `Payment confirmation took longer than expected (Attempt ${attempt}). ` +
          `Our system is automatically verifying with your provider. ` +
          `You will receive confirmation within a few minutes. Do not pay again.`,
        retry_count: attempt,
      };

      this.logger.warn(`⏱️ Timeout notification to ${order.phone_number}: ${message.body}`);

      // TODO: Phase 3 - SMS integration
      // await this.smsProvider.sendSMS(message);

      return message;
    } catch (error) {
      this.logger.error(`Error notifying payment timeout for order ${order.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build payment failed message
   * Clear, actionable, customer-friendly
   */
  private buildPaymentFailedMessage(order: Order, reason: string): string {
    // Translate technical reasons to customer-friendly messages
    const reasonMap = {
      'insufficient_funds': 'Insufficient funds in your account',
      'invalid_account': 'Invalid mobile money account',
      'network_timeout': 'Network connection issue',
      'provider_error': 'Mobile money provider error',
      'declined': 'Payment declined by provider',
      'duplicate': 'Duplicate payment detected',
    };

    const friendlyReason = reasonMap[reason] || reason;

    return (
      `Payment of ${order.total_amount} RWF for order #${order.order_number} failed. ` +
      `Reason: ${friendlyReason}. ` +
      `Please try again using your mobile money app or contact support at +250-XXX-XXXX`
    );
  }

  /**
   * Build payment success message
   * Confirmation and next steps
   */
  private buildPaymentSuccessMessage(order: Order): string {
    return (
      `✅ Payment of ${order.total_amount} RWF confirmed for order #${order.order_number} at ${order.tenant?.name}. ` +
      `Your order is being prepared. You will receive updates about your order status.`
    );
  }

  /**
   * Queue message for sending (with retry logic)
   * TODO: Implement with queue system (Bull, RabbitMQ) in Phase 3
   */
  async queueMessage(message: NotificationMessage): Promise<string> {
    try {
      // In MVP: just log
      this.logger.log(`📤 Queued message for ${message.recipient_phone}: ${message.message_type}`);

      // TODO: Phase 3
      // return await this.messageQueue.add({
      //   message,
      //   retries: 0,
      //   maxRetries: 3,
      //   scheduled_at: new Date(),
      // });

      return `queued-${Date.now()}`;
    } catch (error) {
      this.logger.error(`Error queueing message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send batch notifications (e.g., to admins about failed payments)
   */
  async notifyAdminOfFailedPayments(failedCount: number, tenantId: string): Promise<void> {
    try {
      const adminMessage = 
        `⚠️ ALERT: ${failedCount} payment(s) failed for your restaurant in the last hour. ` +
        `Please review the payment dashboard and consider contacting affected customers.`;

      this.logger.error(`Admin alert for tenant ${tenantId}: ${adminMessage}`);

      // TODO: Phase 3 - Send to admin email/SMS
      // await this.adminNotification.sendAlert(tenantId, adminMessage);
    } catch (error) {
      this.logger.error(`Error notifying admin: ${error.message}`);
    }
  }
}
