import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Order, OrderStatusEnum, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { PaymentTransaction, TransactionKindEnum } from '../entities/payment.entity';
import { PayoutService } from './payout.service';
import { TransactionVerificationService } from './transaction-verification.service';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * WebhookService - Receives and validates payment webhook events
 * 
 * Supports both:
 * - Flutterwave webhooks (new)
 * - Paypack webhooks (legacy)
 * 
 * Responsibilities:
 * - Verify HMAC-SHA256 signature
 * - Parse charge.completed events (Flutterwave)
 * - Match transactions to orders
 * - Trigger transaction verification (never trust webhook alone)
 * - Handle idempotency
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    private readonly transactionVerificationService: TransactionVerificationService,
    private readonly payoutService: PayoutService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Verify Flutterwave webhook signature using HMAC-SHA256
   * 
   * Flutterwave sends x-verif-hash header.
   * We compute HMAC-SHA256 of request body with our secret hash.
   */
  verifyFlutterwaveWebhookSignature(
    rawBody: string,
    signatureHeader: string,
  ): boolean {
    const webhookSecret = this.configService.get('FLUTTERWAVE_SECRET_HASH');
    if (!webhookSecret) {
      this.logger.warn('FLUTTERWAVE_SECRET_HASH not configured');
      return false;
    }

    const computed = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const verified = computed === signatureHeader;
    if (!verified) {
      this.logger.warn('Flutterwave webhook signature verification failed');
    }
    return verified;
  }

  /**
   * Process Flutterwave webhook event
   * 
   * Flutterwave sends charge.completed events when payment succeeds.
   * 
   * Event structure:
   * {
   *   "event": "charge.completed",
   *   "data": {
   *     "id": 123456,
   *     "tx_ref": "DineFlow-1234567890-abc123",
   *     "amount": 25000,
   *     "currency": "RWF",
   *     "status": "successful"
   *   }
   * }
   */
  async processFlutterwaveWebhookEvent(event: any): Promise<void> {
    // Only process charge.completed events
    if (event.event !== 'charge.completed') {
      this.logger.debug(`Ignoring event: ${event.event}`);
      return;
    }

    const data = event.data;
    const txRef = data.tx_ref;

    // Try to find order by tx_ref
    const order = await this.orderRepository.findOne({
      where: { tx_ref: txRef },
    });

    if (!order) {
      this.logger.warn(
        `No order found for Flutterwave tx_ref: ${txRef}. Webhook will be reprocessed on retry.`,
      );
      // Webhook should return 200 OK but order lookup may succeed on retry
      return;
    }

    // Idempotency: If already paid, ignore
    if (order.payment_status === PaymentStatusEnum.PAID) {
      this.logger.debug(
        `Order ${order.id} already paid. Ignoring duplicate webhook.`,
      );
      return;
    }

    // CRITICAL: Never blindly trust webhook - verify with Flutterwave API
    this.logger.log(
      `📋 Webhook received for order ${order.id}, triggering verification...`,
    );

    try {
      await this.transactionVerificationService.verifyAndConfirmPayment(
        order.id,
      );
      this.logger.log(
        `✅ Order ${order.id} verified and confirmed via Flutterwave webhook`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Verification failed for order ${order.id}: ${error.message}`,
      );
      // Order will be retried by background verification job
    }
  }

  /**
   * Process Paypack webhook event (legacy - REMOVED)
   * @deprecated This method has been removed - using Flutterwave exclusively
   */
  async processPaypackWebhookEvent_REMOVED(event: any): Promise<void> {
    // Only process transaction:processed events
    if (event.kind !== 'transaction:processed') {
      this.logger.debug(`Ignoring non-processed event kind: ${event.kind}`);
      return;
    }

    const tx = event.data;

    // Only process CASHIN transactions (not CASHOUT)
    if (tx.kind !== 'CASHIN') {
      this.logger.debug(`Ignoring non-CASHIN transaction kind: ${tx.kind}`);
      return;
    }

    // Find payment transaction by provider ref
    const paymentTx = await this.paymentTransactionRepository.findOne({
      where: {
        provider_ref: tx.ref,
        kind: TransactionKindEnum.CASHIN,
      },
      relations: ['order'],
    });

    if (!paymentTx) {
      this.logger.warn(`No payment transaction found for provider ref: ${tx.ref}`);
      return;
    }

    const order = paymentTx.order;
    if (!order) {
      this.logger.error(`Order not found for payment transaction ${paymentTx.id}`);
      return;
    }

    // Idempotency: If already paid, ignore
    if (order.payment_status === PaymentStatusEnum.PAID) {
      this.logger.debug(`Order ${order.id} already paid. Ignoring duplicate webhook.`);
      return;
    }

    // Validate amount matches
    if (tx.amount !== order.total_amount) {
      this.logger.error(
        `Amount mismatch for order ${order.id}: webhook=${tx.amount}, order=${order.total_amount}`,
      );
      return;
    }

    // Update payment transaction with webhook status
    paymentTx.status = tx.status;
    paymentTx.raw_payload = tx;
    await this.paymentTransactionRepository.save(paymentTx);

    // Handle successful payment
    if (tx.status === 'successful') {
      order.payment_status = PaymentStatusEnum.PAID;
      order.status = OrderStatusEnum.CONFIRMED;
      const updatedOrder = await this.orderRepository.save(order);

      this.logger.log(`✅ Order ${order.id} marked as PAID and CONFIRMED via webhook`);

      // Emit WebSocket notification about payment confirmation
      this.notificationsService.notifyOrderUpdated(order.tenant_id, order.id, updatedOrder);

      // Trigger instant payout to tenant
      await this.payoutService.triggerInstantPayout(order.id);
    } else if (tx.status === 'failed') {
      order.payment_status = PaymentStatusEnum.FAILED;
      await this.orderRepository.save(order);

      this.logger.log(`❌ Order ${order.id} marked as FAILED via webhook`);

      // Emit WebSocket notification about payment failure
      this.notificationsService.notifyOrderUpdated(order.tenant_id, order.id, order);
    }
  }

  /**
   * Handle webhook callback - auto-detects provider
   * 
   * Supports:
   * - Flutterwave: x-verif-hash header, charge.completed events
   * - Paypack: x-paypack-signature header, transaction:processed events
   * 
   * @param rawBody Raw request body
   * @param headers Request headers (including signature headers)
   * @param parsedEvent Parsed JSON event
   */
  async handleWebhookCallback(
    rawBody: string,
    headers: Record<string, any>,
    parsedEvent: any,
  ): Promise<{ success: boolean; message: string }> {
    // Only handle Flutterwave webhooks (using Flutterwave exclusively)
    if (!headers['x-verif-hash']) {
      throw new BadRequestException('Missing x-verif-hash header - only Flutterwave webhooks are supported');
    }

    return this.handleFlutterwaveWebhook(rawBody, headers['x-verif-hash'], parsedEvent);
  }

  /**
   * Handle Flutterwave webhook callback
   */
  private async handleFlutterwaveWebhook(
    rawBody: string,
    signatureHeader: string,
    parsedEvent: any,
  ): Promise<{ success: boolean; message: string }> {
    // Verify signature
    if (!this.verifyFlutterwaveWebhookSignature(rawBody, signatureHeader)) {
      throw new BadRequestException('Invalid Flutterwave webhook signature');
    }

    try {
      // Process the event
      await this.processFlutterwaveWebhookEvent(parsedEvent);
      return { success: true, message: 'Flutterwave webhook processed successfully' };
    } catch (error: any) {
      this.logger.error(
        `Error processing Flutterwave webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * REMOVED: Paypack webhook handler (using Flutterwave exclusively)
   * @deprecated This method has been removed
   * @see handleFlutterwaveWebhook for the Flutterwave implementation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handlePaypackWebhook_REMOVED(
    _rawBody: string,
    _signatureHeader: string,
    _parsedEvent: any,
  ): Promise<{ success: boolean; message: string }> {
    // Legacy code - Paypack integration removed
    // All payment processing now uses Flutterwave exclusively
    throw new Error('Paypack webhook handler has been removed. Use Flutterwave only.');
  }
}