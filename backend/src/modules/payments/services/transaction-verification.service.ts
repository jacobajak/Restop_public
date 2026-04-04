import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum, OrderStatusEnum } from '../../orders/entities/order.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';
import { PayoutService } from './payout.service';
import { SettlementService } from './settlement.service';

/**
 * TransactionVerificationService
 * 
 * Verifies Flutterwave transactions and updates order status.
 * 
 * CRITICAL: Never trust webhook alone - always verify with Flutterwave API.
 * This service ensures:
 * 1. Transaction actually succeeded at Flutterwave
 * 2. Amount matches expected amount
 * 3. Status is SUCCESSFUL
 * 4. Order is only marked PAID if all checks pass
 * 5. Tenant is paid via instant cashout
 */
@Injectable()
export class TransactionVerificationService {
  private readonly logger = new Logger(TransactionVerificationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly flutterwaveService: FlutterwaveIntegrationService,
    private readonly payoutService: PayoutService,
    private readonly settlementService: SettlementService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Verify a transaction with Flutterwave
   * 
   * Called after webhook to ensure payment actually succeeded.
   * 
   * Steps:
   * 1. Load order by tx_ref or flutterwave_id
   * 2. Query Flutterwave for transaction details
   * 3. Verify: status=success, amount matches, currency=RWF
   * 4. Update order to PAID status
   * 5. Trigger instant payout to tenant
   * 6. Send confirmation notification
   * 
   * If verification fails:
   * - Order remains in PENDING or FAILED status
   * - Payment can be retried
   * - Tenant is not paid until verified
   */
  async verifyAndConfirmPayment(
    orderId: string,
  ): Promise<{
    verified: boolean;
    order: Order;
    message: string;
  }> {
    try {
      // Load order
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Must have flutterwave_id or tx_ref to verify
      if (!order.flutterwave_id && !order.tx_ref) {
        throw new Error(
          `Order ${orderId} has no Flutterwave ID or tx_ref - cannot verify`,
        );
      }

      this.logger.log(
        `🔍 Verifying transaction for order ${orderId}: flutterwave_id=${order.flutterwave_id}, tx_ref=${order.tx_ref}`,
      );

      // Query Flutterwave
      let verificationResult;
      if (order.flutterwave_id) {
        verificationResult = await this.flutterwaveService.verifyTransaction(
          order.flutterwave_id,
        );
      } else {
        throw new Error('Cannot verify without flutterwave_id');
      }

      // Verify transaction details
      const { valid, reason } = this.validateTransactionDetails(
        verificationResult,
        order,
      );

      if (!valid) {
        this.logger.warn(
          `❌ Transaction verification failed for order ${orderId}: ${reason}`,
        );

        // Mark order as failed
        order.payment_status = PaymentStatusEnum.FAILED;
        order.rejection_reason = reason;
        await this.orderRepository.save(order);

        this.notificationsService.notifyOrderUpdated(
          order.tenant_id,
          orderId,
          order,
        );

        return {
          verified: false,
          order,
          message: `Verification failed: ${reason}`,
        };
      }

      this.logger.log(
        `✅ Transaction verified for order ${orderId}: amount=${verificationResult.amount}, status=${verificationResult.status}`,
      );

      // Mark order as PAID
      order.payment_status = PaymentStatusEnum.PAID;
      order.status = OrderStatusEnum.CONFIRMED;
      const updatedOrder = await this.orderRepository.save(order);

      // Send payment completed email to customer (fire-and-forget)
      // NOTE: Email will only be sent if customer email is available
      // This should be called from the controller or webhook handler with customer email
      if (order.phone_number) {
        // Placeholder: In production, get customer email from user account or update Order model
        // this.emailService.sendPaymentCompletedEmail(
        //   customerEmail,
        //   customerId,
        //   order.tenant_id,
        //   orderId,
        //   {
        //     customerName: order.customer_name || 'Valued Customer',
        //     restaurantName: tenant.name,
        //     orderId: order.order_code,
        //     amount: (order.total_amount / 100).toFixed(2),
        //     paymentMethod: order.payment_method,
        //     transactionId: verificationResult.transaction_id,
        //   },
        // ).catch(err => this.logger.error('Failed to send payment confirmation email:', err));
      }

      // Create merchant payable record and credit tenant wallet
      try {
        // Convert payment method: 'CASH' stays 'CASH', 'MTN'/'AIRTEL' become 'MOBILE_MONEY'
        const paymentMethod = order.payment_method === 'CASH' ? 'CASH' : 'MOBILE_MONEY';
        await this.settlementService.createMerchantPayable(
          orderId,
          order.tenant_id,
          paymentMethod as 'CASH' | 'MOBILE_MONEY',
        );
        this.logger.log(`✅ Merchant payable created for order ${orderId}`);
      } catch (settlementError: any) {
        // Settlement error should not fail the order confirmation
        // Order is already marked PAID
        // Settlement will be retried by background job or manual process
        this.logger.error(
          `⚠️  Settlement creation failed (will retry): ${settlementError.message}`,
        );
      }

      // Send notification to tenant's dashboard
      this.notificationsService.notifyOrderUpdated(
        order.tenant_id,
        orderId,
        updatedOrder,
      );

      this.logger.log(
        `✅ Order marked PAID: ${orderId}, status=${updatedOrder.payment_status}`,
      );

      // Trigger instant payout to tenant
      try {
        await this.payoutService.triggerInstantPayout(orderId);
        this.logger.log(
          `✅ Instant payout triggered for order ${orderId}`,
        );
      } catch (payoutError: any) {
        // Payout error should not fail the verification
        // Order is already marked PAID
        // Payout will be retried by background job
        this.logger.error(
          `⚠️  Payout trigger failed (will retry): ${payoutError.message}`,
        );
      }

      return {
        verified: true,
        order: updatedOrder,
        message: `Payment verified and confirmed for order ${orderId}`,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Verification error for order ${orderId}: ${error.message}`,
      );

      throw new InternalServerErrorException(
        `Failed to verify transaction: ${error.message}`,
      );
    }
  }

  /**
   * Validate transaction details from Flutterwave
   * 
   * Checks:
   * 1. Status must be "successful"
   * 2. Amount must match order total
   * 3. Currency must be RWF
   * 4. tx_ref must match (if present in response)
   */
  private validateTransactionDetails(
    flutterwaveTransaction: any,
    order: Order,
  ): { valid: boolean; reason?: string } {
    // Status check
    if (flutterwaveTransaction.status !== 'successful') {
      return {
        valid: false,
        reason: `Transaction status is ${flutterwaveTransaction.status}, expected successful`,
      };
    }

    // Amount check
    if (flutterwaveTransaction.amount !== order.total_amount) {
      return {
        valid: false,
        reason: `Amount mismatch: got ${flutterwaveTransaction.amount}, expected ${order.total_amount}`,
      };
    }

    // Currency check
    if (flutterwaveTransaction.currency !== 'RWF') {
      return {
        valid: false,
        reason: `Currency is ${flutterwaveTransaction.currency}, expected RWF`,
      };
    }

    // tx_ref check (if present in order)
    if (order.tx_ref && flutterwaveTransaction.tx_ref !== order.tx_ref) {
      return {
        valid: false,
        reason: `tx_ref mismatch: got ${flutterwaveTransaction.tx_ref}, expected ${order.tx_ref}`,
      };
    }

    return { valid: true };
  }

  /**
   * Verify transaction by tx_ref
   * 
   * Used in webhook handler when we have tx_ref from Flutterwave event.
   * Finds order by tx_ref and triggers verification.
   */
  async verifyByTxRef(txRef: string): Promise<Order | null> {
    try {
      this.logger.log(`🔍 Looking up order by tx_ref: ${txRef}`);

      const order = await this.orderRepository.findOne({
        where: { tx_ref: txRef },
      });

      if (!order) {
        this.logger.warn(`❌ No order found for tx_ref: ${txRef}`);
        return null;
      }

      this.logger.log(`✅ Found order ${order.id} for tx_ref ${txRef}`);

      // Verify and confirm
      const result = await this.verifyAndConfirmPayment(order.id);

      return result.order;
    } catch (error: any) {
      this.logger.error(
        `❌ Error verifying by tx_ref ${txRef}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Retry verification for pending payments
   * 
   * Called by background job to verify payments that are still pending.
   * This handles cases where webhook was lost or webhook processing failed.
   */
  async retryVerificationForPendingPayments(): Promise<{
    verified: number;
    failed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let verified = 0;
    let failed = 0;

    try {
      // Find orders that are still PENDING after 10+ minutes
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);

      const pendingOrders = await this.orderRepository.find({
        where: {
          payment_status: PaymentStatusEnum.PENDING,
          flutterwave_id: 'NOT NULL',
          created_at: cutoffTime,
        },
      });

      this.logger.log(
        `🔄 Running verification retry for ${pendingOrders.length} pending orders`,
      );

      for (const order of pendingOrders) {
        try {
          const result = await this.verifyAndConfirmPayment(order.id);

          if (result.verified) {
            verified++;
          } else {
            failed++;
          }
        } catch (error: any) {
          failed++;
          const errorMsg = `Order ${order.id}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(
        `✅ Verification retry complete: ${verified} verified, ${failed} failed`,
      );

      return { verified, failed, errors };
    } catch (error: any) {
      this.logger.error(
        `❌ Error during retry verification: ${error.message}`,
      );
      throw error;
    }
  }
}
