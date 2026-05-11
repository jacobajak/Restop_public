import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order, PaymentMethodEnum, PaymentStatusEnum, OrderStatusEnum } from '../../orders/entities/order.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentTransaction, TransactionKindEnum } from '../entities/payment.entity';
import { TenantPaymentAccount } from '../entities/tenant-payment-account.entity';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';
import { IdempotencyService } from './idempotency.service';
import { AdminWalletService } from './admin-wallet.service';
import { TenantPaymentAccountService } from './tenant-payment-account-management.service';
import { OperationTypeEnum } from '../entities/idempotency-key.entity';
import * as crypto from 'crypto';
// Resilience pattern services
import { RetryStrategyService } from './retry-strategy.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GracefulDegradationService } from './graceful-degradation.service';
import { PaymentRecoveryService } from './payment-recovery.service';
import { HealthCheckService } from './health-check.service';

/**
 * PaymentService - Initiates Flutterwave mobile money payment for customers
 * 
 * When customer confirms MTN or Airtel payment:
 * 1. Load order
 * 2. Validate payment_status == PENDING
 * 3. Create unique tx_ref for idempotency
 * 4. Call Flutterwave createPayment
 * 5. Store Flutterwave transaction ID
 * 6. Wait for webhook confirmation
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly mockMode: boolean;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    private readonly flutterwaveService: FlutterwaveIntegrationService,
    private readonly idempotencyService: IdempotencyService,
    private readonly adminWalletService: AdminWalletService,
    private readonly tenantPaymentAccountService: TenantPaymentAccountService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    // Resilience pattern services
    private readonly retryService: RetryStrategyService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly degradation: GracefulDegradationService,
    private readonly recovery: PaymentRecoveryService,
    private readonly healthCheck: HealthCheckService,
  ) {
    this.mockMode = this.configService.get('FLUTTERWAVE_MOCK_MODE') === 'true';
    // Initialize circuit breaker for Flutterwave
    this.circuitBreaker.initializeCircuitBreaker('FLUTTERWAVE');
  }

  /**
   * Generate unique transaction reference for order
   */
  private generateTxRef(): string {
    return `DineFlow-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate idempotency key for Flutterwave API calls
   * TODO Phase 3: Implement idempotency key generation for request deduplication
   */
  // private generateIdempotencyKey(txRef: string, kind: string): string {
  //   return `${txRef}-${kind}-${crypto.randomBytes(4).toString('hex')}`;
  // }

  /**
   * Create a new order (without payment yet)
   */
  async createOrder(
    tenantId: string,
    totalAmount: number,
    paymentMethod: PaymentMethodEnum,
    tableId?: string,
    tableNumber?: number,
  ): Promise<Order> {
    const tx_ref = this.generateTxRef();
    
    const order = this.orderRepository.create({
      tenant_id: tenantId,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_status: PaymentStatusEnum.PENDING,
      tx_ref,
      table_id: tableId,
      table_number: tableNumber,
    });

    return this.orderRepository.save(order);
  }

  /**
   * Start a Flutterwave mobile money payment for MTN/AIRTEL
   * 
   * Payment flow with resilience patterns:
   * 1. Check degradation level - reject if service can't handle payments
   * 2. Check circuit breaker - reject if Flutterwave is unavailable
   * 3. Check idempotency key if provided
   * 4. Load and validate order
   * 5. Create unique tx_ref for idempotency
   * 6. Call Flutterwave API with retry strategy (3 attempts, exponential backoff)
   * 7. Record success or register for recovery on failure
   * 8. Update health status
   * 9. Store Flutterwave transaction ID
   * 10. Record idempotency success
   * 11. Await webhook callback for payment confirmation
   * 
   * @param orderId Order to pay for
   * @param customerPhone Customer's mobile number
   * @param customerEmail Customer email for payment confirmation
   * @param customerName Customer name for payment receipt
   * @param idempotencyKey Optional idempotency key for request deduplication
   */
  async startMobileMoneyPayment(
    orderId: string,
    customerPhone: string,
    customerEmail: string = 'customer@dineflow.app',
    customerName: string = 'Customer',
    idempotencyKey?: string,
  ): Promise<{ order: Order; flutterwaveId: string; txRef: string; status: string }> {
    let idempotencyRecord: any = null;

    // Step 1: Check if system can handle payments (graceful degradation)
    if (!this.degradation.shouldProcessRequest('payment')) {
      const degradationLevel = this.degradation.getCurrentLevel();
      const message = `Payment processing temporarily unavailable (degradation: ${degradationLevel})`;
      this.logger.warn(`⚠️  ${message}`);
      throw new ServiceUnavailableException(message);
    }

    // Step 2: Check if Flutterwave is available (circuit breaker)
    if (!this.circuitBreaker.canAttempt('FLUTTERWAVE')) {
      const circuitState = this.circuitBreaker.getState('FLUTTERWAVE');
      const message = `Flutterwave temporarily unavailable (circuit: ${circuitState})`;
      this.logger.warn(`🔴 ${message}`);
      throw new ServiceUnavailableException(message);
    }

    // Step 3: Check idempotency if key provided
    if (idempotencyKey) {
      const payload = { orderId, customerPhone, customerEmail, customerName };
      idempotencyRecord = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        OperationTypeEnum.PAYMENT_INITIATION,
        payload,
      );

      // If operation already succeeded, return cached response
      if (idempotencyRecord.response_snapshot) {
        this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
        return idempotencyRecord.response_snapshot;
      }
    }

    try {
      // Step 4: Load order
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Step 5: Validate order state
      if (order.payment_status !== PaymentStatusEnum.PENDING) {
        throw new BadRequestException(
          `Order is not in PENDING state (current: ${order.payment_status})`,
        );
      }

      if (![PaymentMethodEnum.MTN, PaymentMethodEnum.AIRTEL].includes(order.payment_method as PaymentMethodEnum)) {
        throw new BadRequestException(
          `Payment method ${order.payment_method} is not supported for Mobile Money`,
        );
      }

      // Step 6: Get tenant's Flutterwave subaccount for payment split
      let subaccountId: string | undefined;
      try {
        const tenantPaymentAccount = await this.tenantPaymentAccountService.getDefaultPaymentAccount(order.tenant_id);
        if (!tenantPaymentAccount?.flutterwave_subaccount_id) {
          throw new BadRequestException(
            `Tenant has no Flutterwave subaccount. Payment accounts must be properly configured.`,
          );
        }
        subaccountId = tenantPaymentAccount.flutterwave_subaccount_id;
        this.logger.log(`✅ Using Flutterwave subaccount for split: ${subaccountId}`);
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        this.logger.warn(`⚠️  Could not fetch subaccount: ${error.message}`);
      }

      // Step 7: Use tx_ref from order if exists, otherwise create new one
      const tx_ref = order.tx_ref || this.generateTxRef();

      // Step 8: Call Flutterwave API with split payment (Flutterwave handles commission deduction)
      // 💡 Architecture: "Split at payment time" - Flutterwave automatically splits payment
      // No manual payout needed - tenant receives 90%, platform receives 10%
      let flutterwaveResponse: any;
      try {
        flutterwaveResponse = await this.retryService.executeWithRetry(
          'PAYMENT_PROCESSING',
          () => this.flutterwaveService.createPayment({
            tx_ref,
            amount: order.total_amount,
            phone_number: customerPhone,
            email: customerEmail,
            name: customerName,
            order_id: orderId,
            subaccount_id: subaccountId,
          }),
          {
            onRetry: (context) => {
              this.logger.warn(
                `💬 Payment retry attempt ${context.attempt}/3: ${context.lastError?.message}`,
              );
            },
          }
        );

        // Record success with circuit breaker and health check
        this.circuitBreaker.recordSuccess('FLUTTERWAVE');
        // TODO: Fix HealthCheckService - recordSuccess method missing
        // this.healthCheck.recordSuccess('flutterwave');

        this.logger.log(
          `✅ Flutterwave API call successful (retry success after ${1} attempts)`,
        );
      } catch (error: any) {
        // Record failure with circuit breaker and health check
        this.circuitBreaker.recordFailure('FLUTTERWAVE', error);
        // TODO: Fix HealthCheckService - recordFailure method missing
        // this.healthCheck.recordFailure('flutterwave', error.message);

        this.logger.error(
          `❌ Flutterwave API call failed after retries: ${error.message}`,
        );

        // Register payment for recovery
        this.recovery.registerIncompletePayment({
          userId: order.tenant_id,
          amount: order.total_amount,
          currency: 'RWF', // TODO: Move to order.currency
          error: error.message,
          flutterwaveReference: order.flutterwave_id, // If we have it from previous attempt
        });

        // Record idempotency failure if key provided
        if (idempotencyKey && idempotencyRecord) {
          await this.idempotencyService.recordFailure(
            idempotencyRecord.id,
            error.message,
          );
        }

        throw new ServiceUnavailableException(
          'Payment processing failed. Please try again or contact support.',
        );
      }

      // Step 8: Store Flutterwave response
      order.flutterwave_id = flutterwaveResponse.flutterwave_id;
      order.tx_ref = flutterwaveResponse.tx_ref;
      order.phone_number = customerPhone;
      await this.orderRepository.save(order);

      // Step 9: Record payment transaction
      const paymentTransaction = this.paymentTransactionRepository.create({
        order_id: orderId,
        tenant_id: order.tenant_id,
        provider: 'FLUTTERWAVE',
        kind: TransactionKindEnum.CASHIN,
        provider_ref: flutterwaveResponse.flutterwave_id,
        amount: order.total_amount,
        currency: order.currency || 'RWF', // Include currency from order
        status: flutterwaveResponse.status,
        raw_payload: flutterwaveResponse,
      });
      await this.paymentTransactionRepository.save(paymentTransaction);

      // Step 10: MOCK MODE: Auto-confirm payment after 3 seconds to simulate webhook callback
      if (this.mockMode) {
        this.logger.warn(`🎭 MOCK MODE: Auto-confirming payment in 3 seconds...`);
        setTimeout(async () => {
          try {
            // Reload order to ensure we have latest data
            const updatedOrder = await this.orderRepository.findOne({ where: { id: orderId } });
            if (!updatedOrder) {
              this.logger.error(`❌ Order ${orderId} not found during auto-confirmation`);
              return;
            }

            updatedOrder.payment_status = PaymentStatusEnum.PAID;
            updatedOrder.status = OrderStatusEnum.CONFIRMED;
            const savedOrder = await this.orderRepository.save(updatedOrder);

            // IMPORTANT: Send WebSocket notification so frontend knows payment was confirmed
            this.notificationsService.notifyOrderUpdated(updatedOrder.tenant_id, orderId, savedOrder);

            this.logger.log(`✅ Mock payment auto-confirmed for order ${orderId}`);
          } catch (error) {
            this.logger.error(`❌ Failed to auto-confirm mock payment: ${error.message}`);
          }
        }, 3000);
      }

      const result = {
        order,
        flutterwaveId: flutterwaveResponse.flutterwave_id,
        txRef: flutterwaveResponse.tx_ref,
        status: flutterwaveResponse.status,
      };

      // Step 11: Record idempotency success if key provided
      if (idempotencyKey && idempotencyRecord) {
        await this.idempotencyService.recordSuccess(idempotencyRecord.id, result);
      }

      this.logger.log(`✅ Flutterwave payment initiated: tx_ref=${tx_ref}, flutterwave_id=${flutterwaveResponse.flutterwave_id}`);

      return result;
    } catch (error: any) {
      // Record idempotency failure if key provided
      if (idempotencyKey && idempotencyRecord) {
        await this.idempotencyService.recordFailure(
          idempotencyRecord.id,
          error.message,
        );
      }

      this.logger.error(`❌ Failed to initiate Flutterwave payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark a cash order as paid by tenant staff
   * 
   * With resilience considerations:
   * - Check degradation level for non-critical operations
   * - Send notifications only if available
   * - Log operations for recovery
   * 
   * @param orderId Order to mark as paid
   * @param idempotencyKey Optional idempotency key for request deduplication
   */
  async markCashOrderPaid(orderId: string, idempotencyKey?: string): Promise<Order> {
    let idempotencyRecord: any = null;

    // Check idempotency if key provided
    if (idempotencyKey) {
      const payload = { orderId };
      idempotencyRecord = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        OperationTypeEnum.PAYMENT_VERIFICATION,
        payload,
      );

      // If operation already succeeded, return cached response
      if (idempotencyRecord.response_snapshot) {
        this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
        return idempotencyRecord.response_snapshot;
      }
    }

    try {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (order.payment_method !== PaymentMethodEnum.CASH) {
        throw new BadRequestException(
          `Order payment method is ${order.payment_method}, not CASH`,
        );
      }

      if (order.payment_status !== PaymentStatusEnum.PENDING) {
        throw new BadRequestException(
          `Cash order must be in PENDING state, current: ${order.payment_status}`,
        );
      }

      order.payment_status = PaymentStatusEnum.PAID;
      const savedOrder = await this.orderRepository.save(order);

      // Record cash commission in admin wallet
      try {
        await this.adminWalletService.creditPlatformFee(
          savedOrder.total_amount,
          order.tenant_id,
          `CASH_ORDER_${orderId}`,
          'Cash order marked as paid',
        );
        this.logger.log(`✅ Cash commission recorded for order ${orderId}`);
      } catch (walletError: any) {
        this.logger.error(`❌ Failed to record cash commission: ${walletError.message}`);
        // Don't throw - continue with order processing
      }

      // Send notification only if email service is available
      // (respects graceful degradation)
      if (this.degradation.isFeatureAvailable('emailNotifications')) {
        try {
          // TODO: Send payment confirmation email
          this.logger.debug(`📧 Email notification available for cash payment`);
        } catch (emailError: any) {
          this.logger.warn(`⚠️  Failed to send email notification: ${emailError.message}`);
        }
      } else {
        this.logger.warn(`📵 Email notifications disabled (degradation level)`);
      }

      // Record idempotency success if key provided
      if (idempotencyKey && idempotencyRecord) {
        await this.idempotencyService.recordSuccess(idempotencyRecord.id, savedOrder);
      }

      return savedOrder;
    } catch (error: any) {
      // Record idempotency failure if key provided
      if (idempotencyKey && idempotencyRecord) {
        await this.idempotencyService.recordFailure(
          idempotencyRecord.id,
          error.message,
        );
      }
      throw error;
    }
  }

  /**
   * Find order by Flutterwave transaction reference (tx_ref)
   */
  async findOrderByTxRef(txRef: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { tx_ref: txRef },
    });
  }

  /**
   * Find order by provider transaction reference (webhook)
   * Supports Flutterwave transactions
   */
  async findOrderByProviderRef(providerRef: string): Promise<Order | null> {
    const paymentTx = await this.paymentTransactionRepository.findOne({
      where: {
        provider_ref: providerRef,
        kind: TransactionKindEnum.CASHIN,
      },
      relations: ['order'],
    });
    return paymentTx?.order || null;
  }

  /**
   * Get all payments platform-wide with advanced filtering
   * Used by admin to view all payments across all restaurants
   * 
   * @param filters Payment filters (method, status, tenantId, date range, search)
   * @param limit Page size (default 20)
   * @param offset Pagination offset (default 0)
   * @returns Array of payments matching criteria
   */
  async getAllPaymentsPlatformWide(
    filters: {
      method?: string;
      status?: string;
      tenantId?: string;
      fromDate?: Date;
      toDate?: Date;
      search?: string;
    },
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaymentTransaction[]> {
    let query = this.paymentTransactionRepository.createQueryBuilder('payment');

    // Apply filters
    if (filters.method) {
      query = query.where('payment.kind = :method', { method: filters.method });
    }

    if (filters.status) {
      if (filters.method) {
        query = query.andWhere('payment.status = :status', { status: filters.status });
      } else {
        query = query.where('payment.status = :status', { status: filters.status });
      }
    }

    if (filters.tenantId) {
      const whereCondition = filters.method || filters.status ? 'andWhere' : 'where';
      query = query[whereCondition]('payment.tenant_id = :tenantId', { tenantId: filters.tenantId });
    }

    if (filters.fromDate) {
      const whereCondition = filters.method || filters.status || filters.tenantId ? 'andWhere' : 'where';
      query = query[whereCondition]('payment.created_at >= :fromDate', { fromDate: filters.fromDate });
    }

    if (filters.toDate) {
      const whereCondition = filters.method || filters.status || filters.tenantId || filters.fromDate ? 'andWhere' : 'where';
      query = query[whereCondition]('payment.created_at <= :toDate', { toDate: filters.toDate });
    }

    if (filters.search) {
      const whereCondition = filters.method || filters.status || filters.tenantId || filters.fromDate || filters.toDate ? 'andWhere' : 'where';
      query = query[whereCondition](
        '(payment.provider_ref ILIKE :search OR payment.tx_ref ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Order by created date descending and apply pagination
    const payments = await query
      .orderBy('payment.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();

    return payments;
  }

  /**
   * Get payment details by ID (platform-wide access)
   * Admin can view any payment in system
   * 
   * @param id Payment transaction ID
   * @returns Payment details with related order information
   */
  async getPaymentDetailsByIdPlatformWide(id: string): Promise<PaymentTransaction> {
    const payment = await this.paymentTransactionRepository.findOne({
      where: { id },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return payment;
  }
}
