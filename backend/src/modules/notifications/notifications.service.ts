import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(private notificationsGateway: NotificationsGateway) {}

  /**
   * Notify tenant of new order
   */
  notifyOrderCreated(tenantId: string, order: any) {
    this.notificationsGateway.emitOrderCreated(tenantId, order);
  }

  /**
   * Notify tenant and customer of order status update
   */
  notifyOrderUpdated(tenantId: string, orderId: string, order: any) {
    this.notificationsGateway.emitOrderUpdated(tenantId, orderId, order);
  }

  /**
   * Notify tenant and customer when order is ready
   */
  notifyOrderReady(tenantId: string, orderId: string, order: any) {
    this.notificationsGateway.emitOrderReady(tenantId, orderId, order);
  }

  /**
   * Notify tenant of settlement initiated
   * Fired when payment is confirmed and merchant payable is created
   */
  notifySettlementInitiated(
    tenantId: string,
    payable: {
      id: string;
      amount: number;
      payment_method: string;
      created_at: Date;
    },
  ) {
    this.notificationsGateway.emitSettlementInitiated(tenantId, payable);
  }

  /**
   * Notify tenant of settlement completed
   * Fired when payout is confirmed to merchant account
   */
  notifySettlementCompleted(
    tenantId: string,
    payout: {
      id: string;
      amount: number;
      reference: string;
      destination: string;
      completed_at: Date;
    },
  ) {
    this.notificationsGateway.emitSettlementCompleted(tenantId, payout);
  }

  /**
   * Emit admin-scoped event: Order updated
   * Called by OrderService when order status changes
   */
  notifyAdminOrderUpdated(order: any, changedBy?: string) {
    this.notificationsGateway.emitAdminOrderUpdated(order, changedBy);
  }

  /**
   * Emit admin-scoped event: Payment updated
   * Called by PaymentService when payment status changes
   */
  notifyAdminPaymentUpdated(payment: any, changedBy?: string) {
    this.notificationsGateway.emitAdminPaymentUpdated(payment, changedBy);
  }

  /**
   * Emit admin-scoped event: Settlement updated
   * Called by SettlementService when settlement status changes
   */
  notifyAdminSettlementUpdated(settlement: any, changedBy?: string) {
    this.notificationsGateway.emitAdminSettlementUpdated(settlement, changedBy);
  }

  /**
   * Emit admin-scoped event: Restaurant status changed
   * Called by TenantService when restaurant is suspended/activated
   */
  notifyAdminRestaurantUpdated(restaurant: any, changedBy?: string, action?: string) {
    this.notificationsGateway.emitAdminRestaurantUpdated(restaurant, changedBy, action);
  }

  /**
   * Emit admin-scoped event: Support issue created
   * Called by SupportIssueService when new issue created
   */
  notifyAdminSupportCreated(issue: any) {
    this.notificationsGateway.emitAdminSupportCreated(issue);
  }

  /**
   * Emit admin-scoped event: Metrics updated
   * Called by admin services when metrics change significantly
   */
  notifyAdminMetricsUpdated(metrics: {
    todaysOrders: number;
    todaysGMV: number;
    todaysPaymentMethods: { cash: number; mtn: number; airtel: number };
    activeRestaurants: number;
    totalEarnings: number;
  }) {
    this.notificationsGateway.emitAdminMetricsUpdated(metrics);
  }
}
