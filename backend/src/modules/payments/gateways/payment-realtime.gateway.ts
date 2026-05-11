import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PaymentRealtimeService } from '../services/payment-realtime.service';

/**
 * Payment Real-Time Gateway
 *
 * WebSocket endpoint for real-time payment status updates and notifications.
 *
 * Features:
 * - JWT authentication for WebSocket connections
 * - Room-based updates (per order, per customer, per tenant)
 * - Payment status updates (PENDING → PAID → SETTLED)
 * - Refund notifications
 * - Settlement updates
 * - Error and failure notifications
 *
 * Events:
 * - Client: subscribe_order → Subscribe to order updates
 * - Client: subscribe_customer → Subscribe to all customer's orders
 * - Client: ping → Health check
 * - Server: payment_status_changed → Payment status update
 * - Server: refund_initiated → Refund started
 * - Server: settlement_confirmed → Settlement completed
 * - Server: payment_error → Payment failed
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────┐
 * │        Payment Real-Time Gateway                │
 * │  (Receives WebSocket connections + messages)    │
 * └────────────┬────────────────────────────────────┘
 *              │
 *              ↓
 * ┌─────────────────────────────────────────────────┐
 * │      PaymentRealtimeService                     │
 * │  (Broadcasts events to subscribed clients)      │
 * │  (Manages rooms & connections)                  │
 * └────────────┬────────────────────────────────────┘
 *              │
 *              ↓
 * ┌─────────────────────────────────────────────────┐
 * │      PaymentEventService                        │
 * │  (Event audit trail)                            │
 * └─────────────────────────────────────────────────┘
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/payments',
})
@Injectable()
export class PaymentRealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentRealtimeGateway.name);
  private connectedClients = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeService: PaymentRealtimeService,
  ) {}

  /**
   * Initialize gateway
   * Set up event listeners and broadcast channels
   */
  afterInit() {
    this.logger.log('✅ Payment Real-Time WebSocket Gateway initialized');
    this.realtimeService.setGateway(this.server);
  }

  /**
   * Client connects
   *
   * Flow:
   * 1. JWT token validation (via query ?token=JWT)
   * 2. Create user entry in connectedClients
   * 3. Listen to subscribe messages
   */
  async handleConnection(client: Socket) {
    try {
      // Extract JWT from query parameters
      const token = client.handshake.query.token as string;

      if (!token) {
        this.logger.warn(`❌ Connection attempted without token: ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      try {
        const payload = this.jwtService.verify(token);
        const userId = payload.sub;

        // Track connected client
        if (!this.connectedClients.has(userId)) {
          this.connectedClients.set(userId, new Set());
        }
        this.connectedClients.get(userId).add(client.id);

        // Store user info on socket for later use
        (client as any).userId = userId;
        (client as any).tenantId = payload.tenant_id;

        this.logger.log(
          `✅ Client connected: user=${userId}, socket=${client.id}`,
        );

        // Notify user of successful connection
        client.emit('connection_established', {
          success: true,
          message: 'Connected to payment updates',
          userId,
          timestamp: new Date(),
        });

        // Register gateway with realtime service
        await this.realtimeService.registerClientConnection(client.id, userId);
      } catch (error) {
        this.logger.warn(`❌ Invalid JWT token: ${error.message}`);
        client.disconnect();
      }
    } catch (error: any) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Client disconnects
   *
   * Flow:
   * 1. Clean up client connection tracking
   * 2. Leave all rooms
   * 3. Log disconnection
   */
  async handleDisconnect(client: Socket) {
    try {
      const userId = (client as any).userId;

      if (userId) {
        const clientSet = this.connectedClients.get(userId);
        if (clientSet) {
          clientSet.delete(client.id);
          if (clientSet.size === 0) {
            this.connectedClients.delete(userId);
          }
        }

        await this.realtimeService.unregisterClientConnection(client.id, userId);
      }

      this.logger.log(`👋 Client disconnected: socket=${client.id}, user=${userId}`);
    } catch (error: any) {
      this.logger.error(`Disconnection error: ${error.message}`);
    }
  }

  /**
   * Subscribe to order updates
   *
   * Message:
   * { orderId: "order-123" }
   *
   * Response:
   * { success: true, message: "Subscribed to order-123" }
   *
   * Events:
   * - payment_status_changed
   * - refund_initiated
   * - payment_error
   */
  @SubscribeMessage('subscribe_order')
  async subscribeToOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    try {
      const userId = (client as any).userId;
      const { orderId } = data;

      if (!orderId) {
        return {
          success: false,
          message: 'orderId is required',
        };
      }

      // Subscribe client to order room
      client.join(`order:${orderId}`);

      await this.realtimeService.subscribeToOrder(userId, orderId, client.id);

      this.logger.log(
        `📡 User subscribed to order: user=${userId}, order=${orderId}, socket=${client.id}`,
      );

      return {
        success: true,
        message: `Subscribed to order ${orderId}`,
        orderId,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Subscription error: ${error.message}`);
      return {
        success: false,
        message: `Subscription failed: ${error.message}`,
      };
    }
  }

  /**
   * Subscribe to all customer orders
   *
   * Message:
   * { customerId: "cust-123" }
   *
   * Response:
   * { success: true, message: "Subscribed to all your orders" }
   *
   * Events:
   * - All events for all customer's orders
   */
  @SubscribeMessage('subscribe_customer')
  async subscribeToCustomer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { customerId: string },
  ) {
    try {
      const userId = (client as any).userId;
      const { customerId } = data;

      if (!customerId) {
        return {
          success: false,
          message: 'customerId is required',
        };
      }

      // Subscribe to customer room
      client.join(`customer:${customerId}`);

      await this.realtimeService.subscribeToCustomer(userId, customerId, client.id);

      this.logger.log(
        `📡 User subscribed to customer orders: user=${userId}, customer=${customerId}, socket=${client.id}`,
      );

      return {
        success: true,
        message: `Subscribed to all your order updates`,
        customerId,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Customer subscription error: ${error.message}`);
      return {
        success: false,
        message: `Subscription failed: ${error.message}`,
      };
    }
  }

  /**
   * Subscribe to tenant settlement updates
   *
   * Message:
   * {}
   *
   * For: Restaurant/Merchant admins
   *
   * Events:
   * - settlement_confirmed
   * - settlement_initiated
   * - payout_triggered
   */
  @SubscribeMessage('subscribe_tenant')
  async subscribeToTenant(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = (client as any).userId;
      const tenantId = (client as any).tenantId;

      if (!tenantId) {
        return {
          success: false,
          message: 'Not authorized as tenant',
        };
      }

      // Subscribe to tenant room
      client.join(`tenant:${tenantId}`);

      await this.realtimeService.subscribeToTenant(userId, tenantId, client.id);

      this.logger.log(
        `📡 Tenant subscribed to settlement updates: tenant=${tenantId}, user=${userId}, socket=${client.id}`,
      );

      return {
        success: true,
        message: `Subscribed to settlement and payout updates`,
        tenantId,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Tenant subscription error: ${error.message}`);
      return {
        success: false,
        message: `Subscription failed: ${error.message}`,
      };
    }
  }

  /**
   * Unsubscribe from order
   *
   * Message:
   * { orderId: "order-123" }
   */
  @SubscribeMessage('unsubscribe_order')
  async unsubscribeFromOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    try {
      const userId = (client as any).userId;
      const { orderId } = data;

      client.leave(`order:${orderId}`);

      await this.realtimeService.unsubscribeFromOrder(userId, orderId, client.id);

      this.logger.log(
        `📴 User unsubscribed from order: user=${userId}, order=${orderId}`,
      );

      return {
        success: true,
        message: `Unsubscribed from order ${orderId}`,
      };
    } catch (error: any) {
      this.logger.error(`Unsubscription error: ${error.message}`);
      return {
        success: false,
        message: `Unsubscription failed: ${error.message}`,
      };
    }
  }

  /**
   * Health check ping
   *
   * Message:
   * {}
   *
   * Response:
   * { success: true, timestamp: now }
   *
   * Use for: Keeping connection alive
   */
  @SubscribeMessage('ping')
  ping(@ConnectedSocket() client: Socket) {
    return {
      success: true,
      message: 'pong',
      timestamp: new Date(),
    };
  }

  /**
   * Get current subscriptions
   *
   * Returns: List of all subscribed orders/customers
   */
  @SubscribeMessage('get_subscriptions')
  async getSubscriptions(@ConnectedSocket() client: Socket) {
    try {
      const userId = (client as any).userId;
      const subscriptions = await this.realtimeService.getClientSubscriptions(
        client.id,
        userId,
      );

      return {
        success: true,
        subscriptions,
        count: subscriptions.length,
      };
    } catch (error: any) {
      this.logger.error(`Get subscriptions error: ${error.message}`);
      return {
        success: false,
        message: `Failed to fetch subscriptions: ${error.message}`,
      };
    }
  }
}
