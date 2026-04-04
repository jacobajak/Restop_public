import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      if (!origin || isDevelopment) {
        // Allow requests without origin (like from same domain) and all localhost in development
        callback(null, true);
      } else if (origin === frontendUrl || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  private clientTenantMap = new Map<string, string>(); // socket.id -> tenantId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clientTenantMap.delete(client.id);
  }

  /**
   * Subscribe to tenant room
   * Client should emit this with their tenantId after connecting
   */
  @SubscribeMessage('subscribe_to_tenant')
  handleSubscribeToTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string }
  ) {
    const { tenantId } = data;
    if (tenantId) {
      client.join(`tenant_${tenantId}`);
      this.clientTenantMap.set(client.id, tenantId);
      this.logger.log(`Client ${client.id} subscribed to tenant ${tenantId}`);
    }
  }

  /**
   * Emit order created event to tenant
   */
  emitOrderCreated(tenantId: string, order: any) {
    this.server.to(`tenant_${tenantId}`).emit('order_created', {
      event: 'order_created',
      data: order,
      timestamp: new Date(),
    });
    this.logger.log(`Order created event emitted for tenant ${tenantId}`);
  }

  /**
   * Emit order updated event to tenant and customer
   */
  emitOrderUpdated(tenantId: string, orderId: string, order: any) {
    this.server.to(`tenant_${tenantId}`).emit('order_updated', {
      event: 'order_updated',
      data: order,
      timestamp: new Date(),
    });

    // Also emit to specific order room for customer tracking
    this.server.to(`order_${orderId}`).emit(`order_updated_${orderId}`, {
      event: 'order_updated',
      data: order,
      timestamp: new Date(),
    });

    this.logger.log(`Order updated event emitted for tenant ${tenantId} and order ${orderId}`);
  }

  /**
   * Emit order ready event (kitchen ready notification)
   */
  emitOrderReady(tenantId: string, orderId: string, order: any) {
    this.server.to(`tenant_${tenantId}`).emit('order_ready', {
      event: 'order_ready',
      data: order,
      timestamp: new Date(),
    });

    this.server.to(`order_${orderId}`).emit('order_ready', {
      event: 'order_ready',
      data: order,
      timestamp: new Date(),
    });

    this.logger.log(`Order ready event emitted for tenant ${tenantId} and order ${orderId}`);
  }

  /**
   * Emit settlement initiated event
   * Fired when payment is confirmed and merchant payable is created
   */
  emitSettlementInitiated(
    tenantId: string,
    payable: {
      id: string;
      amount: number;
      payment_method: string;
      created_at: Date;
    },
  ) {
    this.server.to(`tenant_${tenantId}`).emit('settlement_initiated', {
      event: 'settlement_initiated',
      data: {
        payable_id: payable.id,
        amount: payable.amount,
        payment_method: payable.payment_method,
        created_at: payable.created_at,
      },
      timestamp: new Date(),
    });
    this.logger.log(
      `Settlement initiated event emitted for tenant ${tenantId}: payable ${payable.id}`,
    );
  }

  /**
   * Emit settlement completed event
   * Fired when payout is confirmed to merchant account
   */
  emitSettlementCompleted(
    tenantId: string,
    payout: {
      id: string;
      amount: number;
      reference: string;
      destination: string;
      completed_at: Date;
    },
  ) {
    this.server.to(`tenant_${tenantId}`).emit('settlement_completed', {
      event: 'settlement_completed',
      data: {
        payout_id: payout.id,
        amount: payout.amount,
        reference: payout.reference,
        destination: payout.destination,
        completed_at: payout.completed_at,
      },
      timestamp: new Date(),
    });
    this.logger.log(
      `Settlement completed event emitted for tenant ${tenantId}: payout ${payout.id}`,
    );
  }

  /**
   * Client joins order tracking room
   */
  @SubscribeMessage('join_order_tracking')
  handleJoinOrderTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string }
  ) {
    const { orderId } = data;
    if (orderId) {
      client.join(`order_${orderId}`);
      this.logger.log(`Client ${client.id} joined order ${orderId} tracking`);
    }
  }

  /**
   * Subscribe to admin events (for authenticated admins only)
   * Client should emit this after connecting and authenticating
   */
  @SubscribeMessage('subscribe_to_admin')
  handleSubscribeToAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { adminId: string }
  ) {
    const { adminId } = data;
    if (adminId) {
      client.join('admin');
      this.logger.log(`Admin ${adminId} subscribed to admin events via socket ${client.id}`);
    }
  }

  /**
   * Emit admin order updated event
   * Sent to all connected admins when order changes
   */
  emitAdminOrderUpdated(order: any, changedBy?: string) {
    this.server.to('admin').emit('admin/order.updated', {
      event: 'admin/order.updated',
      data: order,
      changedBy,
      timestamp: new Date(),
    });
    this.logger.log(`Admin event emitted: order ${order.id} updated`);
  }

  /**
   * Emit admin payment updated event
   * Sent to all connected admins when payment status changes
   */
  emitAdminPaymentUpdated(payment: any, changedBy?: string) {
    this.server.to('admin').emit('admin/payment.updated', {
      event: 'admin/payment.updated',
      data: payment,
      changedBy,
      timestamp: new Date(),
    });
    this.logger.log(`Admin event emitted: payment ${payment.id} updated`);
  }

  /**
   * Emit admin settlement updated event
   * Sent to all connected admins when settlement status changes
   */
  emitAdminSettlementUpdated(settlement: any, changedBy?: string) {
    this.server.to('admin').emit('admin/settlement.updated', {
      event: 'admin/settlement.updated',
      data: settlement,
      changedBy,
      timestamp: new Date(),
    });
    this.logger.log(`Admin event emitted: settlement ${settlement.id} updated`);
  }

  /**
   * Emit admin restaurant updated event
   * Sent to all connected admins when restaurant status changes
   */
  emitAdminRestaurantUpdated(restaurant: any, changedBy?: string, action?: string) {
    this.server.to('admin').emit('admin/restaurant.updated', {
      event: 'admin/restaurant.updated',
      data: restaurant,
      action, // e.g., 'suspended', 'activated', 'verified'
      changedBy,
      timestamp: new Date(),
    });
    this.logger.log(`Admin event emitted: restaurant ${restaurant.id} updated (${action})`);
  }

  /**
   * Emit admin support issue created event
   * Sent to all connected admins when new support issue created
   */
  emitAdminSupportCreated(issue: any) {
    this.server.to('admin').emit('admin/support.created', {
      event: 'admin/support.created',
      data: issue,
      timestamp: new Date(),
    });
    this.logger.log(`Admin event emitted: support issue ${issue.id} created`);
  }

  /**
   * Emit admin metrics update
   * Sent periodically or on significant change for dashboard refresh
   */
  emitAdminMetricsUpdated(metrics: {
    todaysOrders: number;
    todaysGMV: number;
    todaysPaymentMethods: { cash: number; mtn: number; airtel: number };
    activeRestaurants: number;
    totalEarnings: number;
  }) {
    this.server.to('admin').emit('admin/metrics.updated', {
      event: 'admin/metrics.updated',
      data: metrics,
      timestamp: new Date(),
    });
    this.logger.log('Admin event emitted: metrics updated');
  }
}
