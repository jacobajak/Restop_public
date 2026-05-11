/**
 * Real-Time Payment Events Types
 *
 * Defines all events that can be emitted through WebSocket
 * to frontend clients and subscribed services.
 */

/**
 * Payment Status Changed Event
 *
 * Emitted when:
 * - Payment is initiated
 * - Payment is confirmed
 * - Payment transitions between states
 *
 * Example:
 * ```json
 * {
 *   "orderId": "order-123",
 *   "status": "CONFIRMED",
 *   "amount": 50000,
 *   "currency": "RWF",
 *   "paymentMethod": "MOBILE_MONEY",
 *   "timestamp": "2024-01-15T10:30:00Z",
 *   "message": "✅ Payment confirmed! Order being prepared.",
 *   "reference": "ref_abc123"
 * }
 * ```
 */
export interface PaymentStatusChangedEvent {
  orderId: string;
  status: 'INITIATED' | 'PENDING' | 'CONFIRMED' | 'PAID' | 'FAILED';
  amount: number;
  currency: string;
  paymentMethod?: string;
  timestamp: Date;
  message: string;
  reference?: string;
  customerName?: string;
}

/**
 * Payment Confirmed Event
 *
 * Emitted after webhook verification confirms payment
 *
 * Example:
 * ```json
 * {
 *   "orderId": "order-123",
 *   "amount": 50000,
 *   "reference": "ref_abc123xyz",
 *   "timestamp": "2024-01-15T10:30:15Z",
 *   "message": "✅ Payment confirmed! Your order is being prepared."
 * }
 * ```
 */
export interface PaymentConfirmedEvent {
  orderId: string;
  status: 'CONFIRMED';
  amount: number;
  currency: string;
  reference: string;
  timestamp: Date;
  message: string;
}

/**
 * Payment Failed Event
 *
 * Emitted when payment verification fails
 *
 * Example:
 * ```json
 * {
 *   "orderId": "order-123",
 *   "status": "FAILED",
 *   "reason": "Insufficient funds",
 *   "errorCode": "INSUFFICIENT_BALANCE",
 *   "timestamp": "2024-01-15T10:31:00Z",
 *   "message": "❌ Payment failed: Insufficient funds. Please try again."
 * }
 * ```
 */
export interface PaymentFailedEvent {
  orderId: string;
  status: 'FAILED';
  reason: string;
  errorCode?: string;
  timestamp: Date;
  message: string;
}

/**
 * Refund Initiated Event
 *
 * Emitted when customer requests refund
 *
 * Example:
 * ```json
 * {
 *   "orderId": "order-123",
 *   "amount": 50000,
 *   "reason": "Item not as described",
 *   "status": "INITIATED",
 *   "timestamp": "2024-01-15T10:35:00Z",
 *   "message": "🔄 Refund initiated for 50000 RWF. Processing..."
 * }
 * ```
 */
export interface RefundInitiatedEvent {
  orderId: string;
  amount: number;
  reason: string;
  status: 'INITIATED';
  timestamp: Date;
  message: string;
  customerName?: string;
}

/**
 * Refund Completed Event
 *
 * Emitted after refund processing completes
 *
 * Example:
 * ```json
 * {
 *   "orderId": "order-123",
 *   "amount": 50000,
 *   "status": "SUCCESS",
 *   "timestamp": "2024-01-15T10:40:00Z",
 *   "message": "✅ Refund completed! 50000 RWF returned to your account."
 * }
 * ```
 */
export interface RefundCompletedEvent {
  orderId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  timestamp: Date;
  message: string;
  reason?: string;
}

/**
 * Settlement Initiated Event
 *
 * Emitted when daily settlement cycle begins
 *
 * Example:
 * ```json
 * {
 *   "settlementId": "settle-123",
 *   "tenantId": "tenant-abc",
 *   "amount": 500000,
 *   "ordersCount": 45,
 *   "status": "INITIATED",
 *   "timestamp": "2024-01-15T23:00:00Z",
 *   "message": "📊 Settlement initiated: 45 orders, 500000 RWF total."
 * }
 * ```
 */
export interface SettlementInitiatedEvent {
  settlementId: string;
  tenantId: string;
  amount: number;
  ordersCount: number;
  status: 'INITIATED';
  timestamp: Date;
  message: string;
}

/**
 * Settlement Confirmed Event
 *
 * Emitted after settlement is processed and ledger updated
 *
 * Example:
 * ```json
 * {
 *   "settlementId": "settle-123",
 *   "tenantId": "tenant-abc",
 *   "amount": 500000,
 *   "commission": 25000,
 *   "netAmount": 475000,
 *   "status": "CONFIRMED",
 *   "timestamp": "2024-01-16T00:30:00Z",
 *   "message": "✅ Settlement confirmed: 475000 RWF transferred."
 * }
 * ```
 */
export interface SettlementConfirmedEvent {
  settlementId: string;
  tenantId: string;
  amount: number;
  commission: number;
  netAmount: number;
  status: 'CONFIRMED';
  timestamp: Date;
  message: string;
}

/**
 * Payout Triggered Event
 *
 * Emitted when settlement payout is sent to merchant's bank
 *
 * Example:
 * ```json
 * {
 *   "payoutId": "payout-123",
 *   "tenantId": "tenant-abc",
 *   "amount": 475000,
 *   "reference": "payout_ref_123",
 *   "status": "PROCESSING",
 *   "timestamp": "2024-01-16T01:00:00Z",
 *   "message": "💳 Payout processing: 475000 RWF to registered account."
 * }
 * ```
 */
export interface PayoutTriggeredEvent {
  payoutId: string;
  tenantId: string;
  amount: number;
  reference: string;
  status: 'PROCESSING';
  timestamp: Date;
  message: string;
}

/**
 * Connection Established Event
 *
 * Sent by server when client connects successfully
 *
 * Example:
 * ```json
 * {
 *   "success": true,
 *   "message": "Connected to payment updates",
 *   "userId": "user-123",
 *   "timestamp": "2024-01-15T10:00:00Z"
 * }
 * ```
 */
export interface ConnectionEstablishedEvent {
  success: boolean;
  message: string;
  userId: string;
  timestamp: Date;
}

/**
 * Subscription Response
 *
 * Sent after client subscribes to updates
 *
 * Example:
 * ```json
 * {
 *   "success": true,
 *   "message": "Subscribed to order-123",
 *   "orderId": "order-123",
 *   "timestamp": "2024-01-15T10:01:00Z"
 * }
 * ```
 */
export interface SubscriptionResponseEvent {
  success: boolean;
  message: string;
  orderId?: string;
  customerId?: string;
  timestamp: Date;
}

/**
 * Ping/Pong Response
 *
 * Health check response
 *
 * Example:
 * ```json
 * {
 *   "success": true,
 *   "message": "pong",
 *   "timestamp": "2024-01-15T10:05:00Z"
 * }
 * ```
 */
export interface PingPongEvent {
  success: boolean;
  message: string;
  timestamp: Date;
}

/**
 * All Payment Real-Time Events
 *
 * Union type of all events that can be emitted
 */
export type PaymentRealtimeEvent =
  | PaymentStatusChangedEvent
  | PaymentConfirmedEvent
  | PaymentFailedEvent
  | RefundInitiatedEvent
  | RefundCompletedEvent
  | SettlementInitiatedEvent
  | SettlementConfirmedEvent
  | PayoutTriggeredEvent
  | ConnectionEstablishedEvent
  | SubscriptionResponseEvent
  | PingPongEvent;

/**
 * WebSocket Client Subscribe Message
 *
 * Sent by client to subscribe to updates
 */
export interface SubscribeToOrderMessage {
  orderId: string;
}

export interface SubscribeToCustomerMessage {
  customerId: string;
}

export interface UnsubscribeFromOrderMessage {
  orderId: string;
}

/**
 * WebSocket Server Events (Event Names)
 *
 * Event names that server emits to clients
 */
export enum PaymentRealtimeEventName {
  // Connection
  CONNECTION_ESTABLISHED = 'connection_established',
  DISCONNECTED = 'disconnected',

  // Subscription
  SUBSCRIPTION_CONFIRMED = 'subscription_confirmed',
  UNSUBSCRIPTION_CONFIRMED = 'unsubscription_confirmed',

  // Payment Events
  PAYMENT_STATUS_CHANGED = 'payment_status_changed',
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_ERROR = 'payment_error',

  // Refund Events
  REFUND_INITIATED = 'refund_initiated',
  REFUND_COMPLETED = 'refund_completed',
  NEW_PAYMENT_INITIATED = 'new_payment_initiated',

  // Settlement Events
  SETTLEMENT_INITIATED = 'settlement_initiated',
  SETTLEMENT_CONFIRMED = 'settlement_confirmed',

  // Payout Events
  PAYOUT_TRIGGERED = 'payout_triggered',

  // Health Check
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket Client Events (Event Names)
 *
 * Event names that client sends to server
 */
export enum PaymentRealtimeClientEventName {
  // Subscription
  SUBSCRIBE_ORDER = 'subscribe_order',
  SUBSCRIBE_CUSTOMER = 'subscribe_customer',
  SUBSCRIBE_TENANT = 'subscribe_tenant',
  UNSUBSCRIBE_ORDER = 'unsubscribe_order',

  // Admin
  GET_SUBSCRIPTIONS = 'get_subscriptions',

  // Health
  PING = 'ping',
}

/**
 * Real-Time Service Status
 */
export interface RealtimeServiceStatus {
  activeUsers: number;
  totalSubscriptions: number;
  io: 'Connected' | 'Disconnected';
}

/**
 * Client Subscription Info
 */
export interface ClientSubscription {
  socketId: string;
  userId: string;
  subscriptions: string[];
  connectedAt: Date;
}
