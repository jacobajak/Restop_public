import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PaymentEventService } from './payment-event.service';
import { PaymentEventTypeEnum } from '../entities/payment-event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

/**
 * Payment Real-Time Service
 *
 * Manages real-time payment updates and broadcasts events to connected clients.
 *
 * Responsibilities:
 * - Track client connections and subscriptions
 * - Broadcast payment events to interested clients
 * - Emit payment status changes
 * - Emit refund notifications
 * - Emit settlement updates
 * - Manage room subscriptions
 *
 * Integration Points:
 * - PaymentEventService: Logs all events
 * - PaymentService: Broadcasts INITIATED events
 * - TransactionVerificationService: Broadcasts VERIFIED, PAID events
 * - RefundService: Broadcasts REFUND_INITIATED, REFUND_COMPLETED
 * - SettlementService: Broadcasts SETTLEMENT events
 *
 * Event Flow:
 * 
 * Payment Flow:
 * 1. Customer initiates payment
 *    └─> PaymentService calls broadcastPaymentInitiated()
 *    └─> Emits 'payment_status_changed' to client
 *
 * 2. Payment verified via webhook
 *    └─> TransactionVerificationService calls broadcastPaymentConfirmed()
 *    └─> Emits 'payment_confirmed' to client
 *
 * 3. Payment wallet updated
 *    └─> Emits 'payment_status_changed' with status=PAID
 *
 * Refund Flow:
 * 1. Refund requested
 *    └─> RefundService calls broadcastRefundInitiated()
 *    └─> Emits 'refund_initiated' to customer + admin
 *
 * 2. Refund completed
 *    └─> Emits 'refund_completed' with status=SUCCESS/FAILED
 *
 * Settlement Flow:
 * 1. Daily settlement triggered
 *    └─> SettlementService calls broadcastSettlementCreated()
 *    └─> Emits 'settlement_initiated' to merchant
 *
 * 2. Settlement confirmed
 *    └─> Emits 'settlement_confirmed' with amount + timestamp
 */
@Injectable()
export class PaymentRealtimeService {
  private readonly logger = new Logger(PaymentRealtimeService.name);
  private io: Server;
  private clientSubscriptions = new Map<string, Set<string>>();
  private userConnections = new Map<string, Set<string>>();

  constructor(
    private readonly paymentEventService: PaymentEventService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Set the Socket.IO server instance
   * Called by gateway after initialization
   */
  setGateway(server: Server) {
    this.io = server;
    this.logger.log('✅ Gateway registered with realtime service');
  }

  /**
   * Register a client connection
   */
  async registerClientConnection(socketId: string, userId: string) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(socketId);

    if (!this.clientSubscriptions.has(socketId)) {
      this.clientSubscriptions.set(socketId, new Set());
    }

    this.logger.debug(`📱 Connection registered: socket=${socketId}, user=${userId}`);
  }

  /**
   * Unregister client connection
   */
  async unregisterClientConnection(socketId: string, userId: string) {
    const clientSet = this.userConnections.get(userId);
    if (clientSet) {
      clientSet.delete(socketId);
      if (clientSet.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    this.clientSubscriptions.delete(socketId);
    this.logger.debug(`📴 Connection unregistered: socket=${socketId}, user=${userId}`);
  }

  /**
   * Subscribe client to order updates
   */
  async subscribeToOrder(userId: string, orderId: string, socketId: string) {
    const key = `order:${orderId}`;
    if (!this.clientSubscriptions.has(socketId)) {
      this.clientSubscriptions.set(socketId, new Set());
    }
    this.clientSubscriptions.get(socketId).add(key);

    // Log subscription event
    await this.paymentEventService.logEvent(orderId, PaymentEventTypeEnum.SUBSCRIPTION_INITIATED, {
      description: `User subscribed to order: user=${userId}, socket=${socketId}`,
    });
  }

  /**
   * Subscribe client to all customer orders
   */
  async subscribeToCustomer(userId: string, customerId: string, socketId: string) {
    const key = `customer:${customerId}`;
    if (!this.clientSubscriptions.has(socketId)) {
      this.clientSubscriptions.set(socketId, new Set());
    }
    this.clientSubscriptions.get(socketId).add(key);
  }

  /**
   * Subscribe to tenant settlement updates
   */
  async subscribeToTenant(userId: string, tenantId: string, socketId: string) {
    const key = `tenant:${tenantId}`;
    if (!this.clientSubscriptions.has(socketId)) {
      this.clientSubscriptions.set(socketId, new Set());
    }
    this.clientSubscriptions.get(socketId).add(key);
  }

  /**
   * Unsubscribe from order
   */
  async unsubscribeFromOrder(userId: string, orderId: string, socketId: string) {
    const key = `order:${orderId}`;
    const subscriptions = this.clientSubscriptions.get(socketId);
    if (subscriptions) {
      subscriptions.delete(key);
    }

    await this.paymentEventService.logEvent(orderId, PaymentEventTypeEnum.SUBSCRIPTION_ENDED, {
      description: `User unsubscribed from order: user=${userId}`,
    });
  }

  /**
   * Get all subscriptions for a client
   */
  async getClientSubscriptions(socketId: string, userId: string) {
    const subscriptions = this.clientSubscriptions.get(socketId);
    return subscriptions ? Array.from(subscriptions) : [];
  }

  /**
   * PAYMENT INITIATED
   *
   * Called by PaymentService when customer initiates payment
   *
   * Broadcast to:
   * - Customer (real-time update)
   * - Tenant/Merchant (admin dashboard)
   */
  async broadcastPaymentInitiated(orderId: string, data: any) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for broadcast: ${orderId}`);
        return;
      }

      const eventData = {
        orderId,
        status: 'INITIATED',
        amount: order.total_amount,
        currency: 'RWF',
        paymentMethod: order.payment_method,
        customerName: order.customer_name,
        timestamp: new Date(),
        message: 'Payment initiated. Awaiting confirmation...',
      };

      // Broadcast to customer subscriptions
      this.io.to(`order:${orderId}`).emit('payment_status_changed', eventData);

      // Also broadcast to tenant dashboard
      this.io.to(`tenant:${order.tenant_id}`).emit('new_payment_initiated', {
        ...eventData,
        orderId,
      });

      this.logger.log(
        `📡 Broadcast PAYMENT_INITIATED: order=${orderId}, amount=${order.total_amount}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast payment initiated: ${error.message}`);
    }
  }

  /**
   * PAYMENT CONFIRMED
   *
   * Called by TransactionVerificationService after webhook verification
   *
   * Broadcast to:
   * - Customer (real-time confirmation)
   * - Restaurant/Merchant (order ready)
   */
  async broadcastPaymentConfirmed(
    orderId: string,
    data: {
      amount: number;
      reference: string;
      timestamp?: Date;
    },
  ) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for payment confirmed broadcast: ${orderId}`);
        return;
      }

      const eventData = {
        orderId,
        status: 'CONFIRMED',
        amount: data.amount,
        currency: 'RWF',
        reference: data.reference,
        timestamp: data.timestamp || new Date(),
        message: '✅ Payment confirmed! Your order is being prepared.',
      };

      // Broadcast to customer
      this.io.to(`order:${orderId}`).emit('payment_confirmed', eventData);

      // Broadcast to customer's other connections (if any)
      this.io.to(`customer:${order.phone_number}`).emit('payment_confirmed', eventData);

      // Notify restaurant/merchant
      this.io.to(`tenant:${order.tenant_id}`).emit('payment_confirmed', {
        ...eventData,
        orderId,
        customerName: order.customer_name,
      });

      this.logger.log(
        `✅ Broadcast PAYMENT_CONFIRMED: order=${orderId}, amount=${data.amount}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast payment confirmed: ${error.message}`);
    }
  }

  /**
   * PAYMENT FAILED
   *
   * Called by TransactionVerificationService if verification fails
   *
   * Broadcast to:
   * - Customer (error notification)
   * - Support team (error tracking)
   */
  async broadcastPaymentFailed(
    orderId: string,
    data: {
      reason: string;
      errorCode?: string;
      timestamp?: Date;
    },
  ) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for payment failed broadcast: ${orderId}`);
        return;
      }

      const eventData = {
        orderId,
        status: 'FAILED',
        reason: data.reason,
        errorCode: data.errorCode,
        timestamp: data.timestamp || new Date(),
        message: `❌ Payment failed: ${data.reason}. Please try again or contact support.`,
      };

      // Broadcast to customer
      this.io.to(`order:${orderId}`).emit('payment_failed', eventData);

      // Broadcast to support team
      this.io.to('support').emit('payment_error', {
        ...eventData,
        orderId,
        customerName: order.customer_name,
        amount: order.total_amount,
      });

      this.logger.error(
        `❌ Broadcast PAYMENT_FAILED: order=${orderId}, reason=${data.reason}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast payment failed: ${error.message}`);
    }
  }

  /**
   * REFUND INITIATED
   *
   * Called by RefundService when refund is requested
   *
   * Broadcast to:
   * - Customer (refund notification)
   * - Merchant (refund tracking)
   * - Admin (refund approval queue)
   */
  async broadcastRefundInitiated(
    orderId: string,
    data: {
      amount: number;
      reason: string;
      timestamp?: Date;
    },
  ) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for refund initiated broadcast: ${orderId}`);
        return;
      }

      const eventData = {
        orderId,
        amount: data.amount,
        reason: data.reason,
        status: 'INITIATED',
        timestamp: data.timestamp || new Date(),
        message: `🔄 Refund initiated for ${data.amount} RWF. Processing...`,
      };

      // Broadcast to customer
      this.io.to(`order:${orderId}`).emit('refund_initiated', eventData);

      // Broadcast to merchant
      this.io.to(`tenant:${order.tenant_id}`).emit('refund_initiated', {
        ...eventData,
        orderId,
        customerName: order.customer_name,
      });

      // Broadcast to admin
      this.io.to('admin').emit('refund_request', {
        ...eventData,
        orderId,
        customerName: order.customer_name,
      });

      this.logger.log(
        `🔄 Broadcast REFUND_INITIATED: order=${orderId}, amount=${data.amount}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast refund initiated: ${error.message}`);
    }
  }

  /**
   * REFUND COMPLETED
   *
   * Called by RefundService after refund is processed
   *
   * Broadcast to:
   * - Customer (refund confirmation)
   * - Merchant (refund confirmation)
   */
  async broadcastRefundCompleted(
    orderId: string,
    data: {
      amount: number;
      status: 'SUCCESS' | 'FAILED';
      timestamp?: Date;
      reason?: string;
    },
  ) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for refund completed broadcast: ${orderId}`);
        return;
      }

      const isSuccess = data.status === 'SUCCESS';
      const eventData = {
        orderId,
        amount: data.amount,
        status: data.status,
        timestamp: data.timestamp || new Date(),
        message: isSuccess
          ? `✅ Refund completed! ${data.amount} RWF returned to your account.`
          : `❌ Refund failed: ${data.reason}. Please contact support.`,
      };

      // Broadcast to customer
      this.io.to(`order:${orderId}`).emit('refund_completed', eventData);

      // Broadcast to merchant
      this.io.to(`tenant:${order.tenant_id}`).emit('refund_completed', {
        ...eventData,
        orderId,
        customerName: order.customer_name,
      });

      const logLevel = isSuccess ? 'log' : 'error';
      this.logger[logLevel](
        `💰 Broadcast REFUND_COMPLETED: order=${orderId}, status=${data.status}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast refund completed: ${error.message}`);
    }
  }

  /**
   * SETTLEMENT INITIATED
   *
   * Called by SettlementService at start of daily settlement
   *
   * Broadcast to:
   * - Merchant/Restaurant (settlement notification)
   * - Admin (settlement tracking)
   */
  async broadcastSettlementInitiated(
    tenantId: string,
    data: {
      settlementId: string;
      amount: number;
      ordersCount: number;
      timestamp?: Date;
    },
  ) {
    try {
      const eventData = {
        settlementId: data.settlementId,
        tenantId,
        amount: data.amount,
        ordersCount: data.ordersCount,
        status: 'INITIATED',
        timestamp: data.timestamp || new Date(),
        message: `📊 Settlement initiated: ${data.ordersCount} orders, ${data.amount} RWF total.`,
      };

      // Broadcast to merchant
      this.io.to(`tenant:${tenantId}`).emit('settlement_initiated', eventData);

      // Broadcast to admin
      this.io.to('admin').emit('settlement_initiated', eventData);

      this.logger.log(
        `📊 Broadcast SETTLEMENT_INITIATED: tenant=${tenantId}, amount=${data.amount}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast settlement initiated: ${error.message}`);
    }
  }

  /**
   * SETTLEMENT CONFIRMED
   *
   * Called by SettlementService after settlement processed
   *
   * Broadcast to:
   * - Merchant (settlement success)
   * - Admin (settlement dashboard)
   */
  async broadcastSettlementConfirmed(
    tenantId: string,
    data: {
      settlementId: string;
      amount: number;
      commission: number;
      netAmount: number;
      timestamp?: Date;
    },
  ) {
    try {
      const eventData = {
        settlementId: data.settlementId,
        tenantId,
        amount: data.amount,
        commission: data.commission,
        netAmount: data.netAmount,
        status: 'CONFIRMED',
        timestamp: data.timestamp || new Date(),
        message: `✅ Settlement confirmed: ${data.netAmount} RWF transferred.`,
      };

      // Broadcast to merchant
      this.io.to(`tenant:${tenantId}`).emit('settlement_confirmed', eventData);

      // Broadcast to admin
      this.io.to('admin').emit('settlement_confirmed', eventData);

      this.logger.log(
        `✅ Broadcast SETTLEMENT_CONFIRMED: tenant=${tenantId}, net=${data.netAmount}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast settlement confirmed: ${error.message}`);
    }
  }

  /**
   * PAYOUT TRIGGERED
   *
   * Called by PayoutService when payout is sent to merchant
   *
   * Broadcast to:
   * - Merchant (payout notification)
   * - Admin (payout tracking)
   */
  async broadcastPayoutTriggered(
    tenantId: string,
    data: {
      payoutId: string;
      amount: number;
      reference: string;
      timestamp?: Date;
    },
  ) {
    try {
      const eventData = {
        payoutId: data.payoutId,
        tenantId,
        amount: data.amount,
        reference: data.reference,
        status: 'PROCESSING',
        timestamp: data.timestamp || new Date(),
        message: `💳 Payout processing: ${data.amount} RWF to registered account.`,
      };

      // Broadcast to merchant
      this.io.to(`tenant:${tenantId}`).emit('payout_triggered', eventData);

      // Broadcast to admin
      this.io.to('admin').emit('payout_triggered', eventData);

      this.logger.log(
        `💳 Broadcast PAYOUT_TRIGGERED: tenant=${tenantId}, amount=${data.amount}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to broadcast payout triggered: ${error.message}`);
    }
  }

  /**
   * Get active connections count
   * Used for monitoring
   */
  getActiveConnectionsCount(): number {
    return this.userConnections.size;
  }

  /**
   * Get total subscriptions
   * Used for monitoring
   */
  getTotalSubscriptions(): number {
    let count = 0;
    this.clientSubscriptions.forEach((subs) => {
      count += subs.size;
    });
    return count;
  }

  /**
   * Get detailed status
   * Used for health checks
   */
  getStatus() {
    return {
      activeUsers: this.userConnections.size,
      totalSubscriptions: this.getTotalSubscriptions(),
      io: this.io ? 'Connected' : 'Disconnected',
    };
  }
}
