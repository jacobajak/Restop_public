import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order, PaymentMethodEnum, PaymentStatusEnum, OrderStatusEnum } from '../../orders/entities/order.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentTransaction, TransactionKindEnum } from '../entities/payment.entity';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';
import * as crypto from 'crypto';

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
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.mockMode = this.configService.get('FLUTTERWAVE_MOCK_MODE') === 'true';
  }

  /**
   * Generate unique transaction reference for order
   */
  private generateTxRef(): string {
    return `DineFlow-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate idempotency key for Paypack API calls
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
   * Payment flow:
   * 1. Load and validate order
   * 2. Create unique tx_ref for idempotency
   * 3. Call Flutterwave API to initiate payment
   * 4. Store Flutterwave transaction ID
   * 5. Await webhook callback for payment confirmation
   * 
   * @param orderId Order to pay for
   * @param customerPhone Customer's mobile number
   * @param customerEmail Customer email for payment confirmation
   * @param customerName Customer name for payment receipt
   */
  async startMobileMoneyPayment(
    orderId: string,
    customerPhone: string,
    customerEmail: string = 'customer@dineflow.app',
    customerName: string = 'Customer',
  ): Promise<{ order: Order; flutterwaveId: string; txRef: string; status: string }> {
    // Load order
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Validate order state
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

    // Use tx_ref from order if exists, otherwise create new one
    const tx_ref = order.tx_ref || this.generateTxRef();

    try {
      // Call Flutterwave API
      const flutterwaveResponse = await this.flutterwaveService.createPayment({
        tx_ref,
        amount: order.total_amount,
        phone_number: customerPhone,
        email: customerEmail,
        name: customerName,
        order_id: orderId,
      });

      // Store Flutterwave response
      order.flutterwave_id = flutterwaveResponse.flutterwave_id;
      order.tx_ref = flutterwaveResponse.tx_ref;
      order.phone_number = customerPhone;
      await this.orderRepository.save(order);

      // Record payment transaction
      const paymentTransaction = this.paymentTransactionRepository.create({
        order_id: orderId,
        tenant_id: order.tenant_id,
        provider: 'FLUTTERWAVE',
        kind: TransactionKindEnum.CASHIN,
        provider_ref: flutterwaveResponse.flutterwave_id,
        amount: order.total_amount,
        status: flutterwaveResponse.status,
        raw_payload: flutterwaveResponse,
      });
      await this.paymentTransactionRepository.save(paymentTransaction);

      // MOCK MODE: Auto-confirm payment after 3 seconds to simulate webhook callback
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

      this.logger.log(`✅ Flutterwave payment initiated: tx_ref=${tx_ref}, flutterwave_id=${flutterwaveResponse.flutterwave_id}`);

      return {
        order,
        flutterwaveId: flutterwaveResponse.flutterwave_id,
        txRef: flutterwaveResponse.tx_ref,
        status: flutterwaveResponse.status,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to initiate Flutterwave payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark a cash order as paid by tenant staff
   * 
   * @param orderId Order to mark as paid
   */
  async markCashOrderPaid(orderId: string): Promise<Order> {
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
    return this.orderRepository.save(order);
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
   * Find order by Paypack cashin reference (legacy)
   */
  async findOrderByPaypackRef(paypackRef: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { paypack_cashin_ref: paypackRef },
    });
  }

  /**
   * Find order by provider transaction reference (webhook)
   * Supports both Flutterwave and Paypack
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
}
