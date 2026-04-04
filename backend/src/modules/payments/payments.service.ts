import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction, PaymentMethodEnum, Payment } from './entities/payment.entity';
import { Order, PaymentStatusEnum } from '../orders/entities/order.entity';

/**
 * PaymentService
 * 
 * Handles all payment-related operations including:
 * - Mobile money payment initiation (MTN, Airtel)
 * - Cash payment confirmation
 * - Webhook handling for payment provider callbacks
 * - Payment record creation and tracking
 * 
 * @class
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Initiate mobile money payment
   * 
   * Creates a payment record and calls the mobile money provider's API
   * to send a payment prompt to the customer's phone
   * 
   * @async
   * @param {string} orderId - The order ID to process payment for
   * @param {string} customerPhone - Customer's mobile money phone number (format: +250XXXXXXXXX)
   * @param {string} tenantId - Restaurant/tenant ID for authorization
   * @returns {Promise<Payment>} Payment record with pending status
   * @throws {NotFoundException} If order not found
   * @throws {BadRequestException} If order already paid or payment in progress
   * @throws {InternalServerErrorException} If provider API call fails
   */
  async initiateMobileMoneyPayment(
    orderId: string,
    customerPhone: string,
    tenantId: string,
  ): Promise<Payment> {
    // Find the order
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate order is ready for payment
    if (order.payment_status === PaymentStatusEnum.PAID) {
      throw new BadRequestException('Order already paid');
    }

    if (order.payment_status === PaymentStatusEnum.PENDING) {
      throw new BadRequestException('Payment already in progress');
    }

    // Validate and normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(customerPhone);
    if (!normalizedPhone) {
      throw new BadRequestException('Invalid phone number format');
    }

    // Determine provider based on phone number
    const provider = this.detectMobileMoneyProvider(normalizedPhone);

    // Create payment record
    const payment = this.paymentRepository.create({
      order_id: orderId,
      tenant_id: tenantId,
      status: 'PENDING',
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update order to track payment
    order.phone_number = normalizedPhone;
    order.payment_status = PaymentStatusEnum.PENDING;
    await this.orderRepository.save(order);

    // Initiate payment with provider
    try {
      await this.callMobileMoneyProvider(provider, order, normalizedPhone);
    } catch (error: any) {
      // Update payment record with error
      savedPayment.status = 'FAILED';
      savedPayment.raw_payload = { error_message: error?.message };
      await this.paymentRepository.save(savedPayment);

      throw new InternalServerErrorException(
        `Failed to initiate payment with ${provider}: ${error?.message}`,
      );
    }

    return savedPayment;
  }

  /**
   * Confirm cash payment
   * 
   * Called when restaurant staff confirms the customer has paid in cash.
   * Updates payment status to PAID and transitions order status to CONFIRMED.
   * 
   * @async
   * @param {string} orderId - The order ID to confirm payment for
   * @param {string} tenantId - Restaurant/tenant ID for authorization
   * @returns {Promise<Payment>} Payment record with COMPLETED status
   * @throws {NotFoundException} If order not found
   * @throws {BadRequestException} If order is not waiting for cash payment
   */
  async confirmCashPayment(orderId: string, tenantId: string): Promise<Payment> {
    // Find the order
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate order is awaiting cash payment
    if (order.payment_status !== PaymentStatusEnum.PENDING) {
      throw new BadRequestException(
        'Order is not awaiting payment confirmation',
      );
    }

    // Create payment record for cash
    const payment = this.paymentRepository.create({
      order_id: orderId,
      tenant_id: tenantId,
      provider: 'MANUAL',
      kind: 'CASHIN' as any,
      provider_ref: `CASH-${orderId}`,
      amount: order.total_amount,
      status: 'COMPLETED',
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update order payment status
    order.payment_status = PaymentStatusEnum.PAID;
    await this.orderRepository.save(order);

    return savedPayment;
  }

  /**
   * Handle payment provider webhook callback
   * 
   * Called by mobile money providers (MTN, Airtel) to notify of payment success/failure.
   * Verifies webhook signature and updates order payment status accordingly.
   * 
   * @async
   * @param {string} provider - The payment provider (MTN or AIRTEL)
   * @param {any} payload - Webhook payload from provider
   * @param {string} signature - Webhook signature for verification
   * @returns {Promise<Payment>} Updated payment record
   * @throws {BadRequestException} If signature verification fails
   * @throws {NotFoundException} If referenced payment not found
   */
  async handleWebhookCallback(
    provider: string,
    payload: any,
    signature: string,
  ): Promise<Payment> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(provider, payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Extract transaction reference from payload
    const transactionRef = this.extractTransactionRef(provider, payload);
    if (!transactionRef) {
      throw new BadRequestException('No transaction reference in webhook');
    }

    // Find payment record
    const payment = await this.paymentRepository.findOne({
      where: { provider_ref: transactionRef },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    // Parse webhook payload
    const isSuccessful = this.parseWebhookStatus(provider, payload);

    // Update payment record
    payment.raw_payload = payload;
    payment.status = isSuccessful ? 'COMPLETED' : 'FAILED';

    if (!isSuccessful) {
      const errorMessage = this.extractErrorMessage(provider, payload);
      payment.raw_payload = { ...payment.raw_payload, error_message: errorMessage };
    }

    const updatedPayment = await this.paymentRepository.save(payment);

    // Update associated order
    if (isSuccessful) {
      const order = payment.order;
      order.payment_status = PaymentStatusEnum.PAID;
      await this.orderRepository.save(order);
    }

    return updatedPayment;
  }

  /**
   * Retrieve payment details
   * 
   * @async
   * @param {string} paymentId - Payment ID
   * @param {string} tenantId - Tenant ID for authorization
   * @returns {Promise<Payment>} Payment details
   * @throws {NotFoundException} If payment not found
   */
  async getPayment(paymentId: string, tenantId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, tenant_id: tenantId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  /**
   * Get payments for an order
   * 
   * @async
   * @param {string} orderId - Order ID
   * @param {string} tenantId - Tenant ID for authorization
   * @returns {Promise<Payment[]>} List of payments for order
   */
  async getOrderPayments(orderId: string, tenantId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { order_id: orderId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * HELPER METHODS
   */

  /**
   * Normalize phone number to standard format
   * Accepts: +250XXXXXXXXX, 250XXXXXXXXX, 0XXXXXXXXX
   * Returns: +250XXXXXXXXX or null if invalid
   */
  private normalizePhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Remove all non-digits
    const digitsOnly = phone.replace(/\D/g, '');

    // Handle different formats
    let normalized: string;

    if (digitsOnly.length === 12 && digitsOnly.startsWith('250')) {
      // Format: 250XXXXXXXXX
      normalized = `+${digitsOnly}`;
    } else if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
      // Format: 0XXXXXXXXX (Rwanda)
      normalized = `+250${digitsOnly.substring(1)}`;
    } else if (digitsOnly.length === 9) {
      // Format: XXXXXXXXX (Rwanda)
      normalized = `+250${digitsOnly}`;
    } else if (digitsOnly.length === 13 && digitsOnly.startsWith('250')) {
      // Format: +250XXXXXXXXX (already with +)
      normalized = `+${digitsOnly}`;
    } else {
      return null;
    }

    // Validate length (Rwanda: +250 + 9 digits = 13 chars)
    if (normalized.length !== 13) {
      return null;
    }

    return normalized;
  }

  /**
   * Detect mobile money provider based on phone number network operator
   * In Rwanda: 0xx represents different networks
   * For MVP: Default to MTN (most common)
   */
  private detectMobileMoneyProvider(phone: string): PaymentMethodEnum {
    // Extract network prefix
    const normalized = phone.replace('+250', '0');
    const networkCode = normalized.substring(0, 3);

    // Rwanda operator codes
    switch (networkCode) {
      case '078': // MTN
      case '079': // MTN
        return PaymentMethodEnum.MTN;
      case '080': // Airtel
      case '081': // Airtel
        return PaymentMethodEnum.AIRTEL;
      default:
        // Default to MTN for unknown operators
        return PaymentMethodEnum.MTN;
    }
  }

  /**
   * Call mobile money provider API to initiate payment
   * This is a placeholder - actual implementation depends on provider's API
   * 
   * For MVP, this should integrate with:
   * - MTN Mobile Money API
   * - Airtel Money API
   */
  private async callMobileMoneyProvider(
    method: PaymentMethodEnum,
    order: Order,
    phone: string,
  ): Promise<void> {
    this.logger.log(`[PaymentService] Initiating ${method} payment for order ${order.id} with phone ${phone}`);
    
    switch (method) {
      case PaymentMethodEnum.MTN:
        // For Mobile Money, log that payment initiation is needed
        // Actual payment processing happens via the PaymentService (services/payment.service.ts)
        // which handles Flutterwave integration
        this.logger.log(`[MTN] Payment request recorded for order ${order.id}. Flutterwave will handle the actual payment initiation.`);
        break;

      case PaymentMethodEnum.AIRTEL:
        // Same as MTN - actual payment processing via Flutterwave
        this.logger.log(`[AIRTEL] Payment request recorded for order ${order.id}. Flutterwave will handle the actual payment initiation.`);
        break;

      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }

  /**
   * Verify webhook signature for security
   * This is a placeholder - implement provider-specific verification
   */
  private verifyWebhookSignature(
    provider: string,
    _payload: any,
    _signature: string,
  ): boolean {
    // TODO: Implement actual signature verification
    // Each provider uses different signing methods (HMAC-SHA256, etc.)
    console.log(`[${provider}] Verifying webhook signature`);

    // For MVP, allow all signatures (NOT FOR PRODUCTION)
    return true;
  }

  /**
   * Extract transaction reference from provider webhook payload
   */
  private extractTransactionRef(provider: string, payload: any): string | null {
    switch (provider) {
      case 'MTN':
        return payload.transaction_id || payload.transactionReference;
      case 'AIRTEL':
        return payload.transaction_id || payload.transRef;
      default:
        return null;
    }
  }

  /**
   * Parse webhook status to determine payment success/failure
   */
  private parseWebhookStatus(provider: string, payload: any): boolean {
    switch (provider) {
      case 'MTN':
        // MTN typically uses status code 0 for success
        return payload.status === '0' || payload.status === 0;
      case 'AIRTEL':
        // Airtel typically uses 'CC' or 'SUCCESS' for success
        return (
          payload.status === 'CC' ||
          payload.status === 'SUCCESS' ||
          payload.response_code === '0'
        );
      default:
        return false;
    }
  }

  /**
   * Extract error message from provider webhook payload
   */
  private extractErrorMessage(provider: string, payload: any): string {
    switch (provider) {
      case 'MTN':
        return payload.message || payload.error || 'MTN payment failed';
      case 'AIRTEL':
        return payload.message || payload.error || 'Airtel payment failed';
      default:
        return 'Payment failed';
    }
  }

  /**
   * Get all payments for a specific date
   */
  async getAllPaymentsByDate(date: Date): Promise<PaymentTransaction[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.created_at >= :start', { start: startOfDay })
      .andWhere('payment.created_at <= :end', { end: endOfDay })
      .orderBy('payment.created_at', 'DESC')
      .getMany();
  }

  /**
   * Get payment breakdown by method for a date
   */
  async getPaymentBreakdownByMethod(
    date: Date,
  ): Promise<{ cash: number; mtn: number; airtel: number }> {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.payment_method', 'method')
      .addSelect('COUNT(payment.id)', 'count')
      .where('payment.created_at >= :today', { today })
      .andWhere('payment.created_at < :tomorrow', { tomorrow })
      .andWhere('payment.status = :status', { status: 'SUCCESSFUL' })
      .groupBy('payment.payment_method')
      .getRawMany();

    const breakdown = {
      cash: 0,
      mtn: 0,
      airtel: 0,
    };

    result.forEach((row) => {
      if (row.method === 'CASH') breakdown.cash = parseInt(row.count, 10);
      if (row.method === 'MTN') breakdown.mtn = parseInt(row.count, 10);
      if (row.method === 'AIRTEL') breakdown.airtel = parseInt(row.count, 10);
    });

    return breakdown;
  }

  /**
   * Get payment statistics for today
   */
  async getTodaysPaymentStats(): Promise<{
    successful: number;
    failed: number;
    pending: number;
    total: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.created_at >= :today', { today })
      .andWhere('payment.created_at < :tomorrow', { tomorrow });

    const successful = await baseQuery
      .clone()
      .andWhere('payment.status = :status', { status: 'SUCCESSFUL' })
      .getCount();

    const failed = await baseQuery
      .clone()
      .andWhere('payment.status = :status', { status: 'FAILED' })
      .getCount();

    const pending = await baseQuery
      .clone()
      .andWhere('payment.status = :status', { status: 'PENDING' })
      .getCount();

    const total = await baseQuery.getCount();

    return { successful, failed, pending, total };
  }

  /**
   * Get all payments across all restaurants (platform-wide, admin only)
   * Supports filtering by tenant, status, method, date range, and search
   */
  async getAllPaymentsPlatformWide(
    filters?: {
      tenantId?: string;
      status?: string;
      method?: string;
      fromDate?: Date;
      toDate?: Date;
      search?: string;
    },
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ payments: PaymentTransaction[]; total: number }> {
    let query = this.paymentRepository.createQueryBuilder('payment');

    // Apply filters
    if (filters?.tenantId) {
      query = query.andWhere('payment.tenant_id = :tenantId', {
        tenantId: filters.tenantId,
      });
    }

    if (filters?.status) {
      query = query.andWhere('payment.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.method) {
      query = query.andWhere('payment.payment_method = :method', {
        method: filters.method,
      });
    }

    if (filters?.fromDate) {
      query = query.andWhere('payment.created_at >= :fromDate', {
        fromDate: filters.fromDate,
      });
    }

    if (filters?.toDate) {
      query = query.andWhere('payment.created_at <= :toDate', {
        toDate: filters.toDate,
      });
    }

    if (filters?.search) {
      // Search by provider reference or order_id
      query = query.andWhere(
        '(payment.provider_ref ILIKE :search OR payment.order_id ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Get total
    const total = await query.getCount();

    // Apply pagination
    const payments = await query
      .orderBy('payment.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    return { payments, total };
  }

  /**
   * Get payment with all details (platform-wide)
   */
  async getPaymentDetailsByIdPlatformWide(id: string): Promise<PaymentTransaction> {
    const payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.id = :id', { id })
      .getOne();

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return payment;
  }
}
