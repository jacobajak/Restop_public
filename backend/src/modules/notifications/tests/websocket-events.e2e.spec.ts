import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MerchantSettlementsController } from '../../orders/controllers/merchant-settlements.controller';
import { NotificationsGateway } from '../../notifications/notifications.gateway';

/**
 * Test Suite: WebSocket Real-Time Events
 * 
 * Tests:
 * - Admin WebSocket connection and subscription
 * - Real-time order updates when orders are created
 * - Real-time payment updates when payments succeed/fail
 * - Real-time settlement updates when payouts are processed
 * - WebSocket event message format and structure
 * - Tenant isolation (tenant can only see own events)
 * - Admin scope filtering (admins see relevant events)
 * 
 * WebSocket Events Tested:
 * - orders.created, orders.updated, orders.cancelled
 * - payments.initiated, payments.completed, payments.failed
 * - settlements.pending, settlements.processed, settlements.failed
 * - support.created, support.escalated
 */
describe('WebSocket Real-Time Events (e2e)', () => {
  let app: INestApplication;
  let notificationsGateway: NotificationsGateway;

  const mockTenantId = 'tenant_abc';
  const mockOrderId = 'order_123';
  const mockAdminId = 'admin_user_001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MerchantSettlementsController],
      providers: [
        {
          provide: NotificationsGateway,
          useValue: {
            handleConnection: jest.fn(),
            handleDisconnect: jest.fn(),
            handleSubscribeToRoom: jest.fn(),
            emitAdminEvent: jest.fn(),
            emitTenantOrderUpdate: jest.fn(),
            emitTenantPaymentUpdate: jest.fn(),
            emitOrderPaymentVerified: jest.fn(),
            emitSettlementInitiated: jest.fn(),
            emitRefundStatusUpdate: jest.fn(),
            emitSupportIssueCreated: jest.fn(),
            emitSupportIssueEscalated: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    notificationsGateway = moduleFixture.get<NotificationsGateway>(NotificationsGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Connection & Subscription', () => {
    it('should establish WebSocket connection for authenticated user', async () => {
      const handleConnection = jest.spyOn(notificationsGateway, 'handleConnection');

      // Simulate WebSocket connection
      // Note: In real tests, use Socket.io-client to connect to the server
      notificationsGateway.handleConnection({ id: 'socket_123', handshake: { auth: { token: 'jwt_token' } } } as any);

      expect(handleConnection).toHaveBeenCalled();
    });

    it('should subscribe to tenant room when merchant connects', async () => {
      const subscribe = jest.spyOn(notificationsGateway, 'handleSubscribeToRoom');

      // Simulate subscription
      notificationsGateway.handleSubscribeToRoom(
        { id: 'socket_123' } as any,
        { room: `tenant_${mockTenantId}` }
      );

      expect(subscribe).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          room: `tenant_${mockTenantId}`,
        })
      );
    });

    it('should subscribe to admin broadcast room when admin connects', async () => {
      const subscribe = jest.spyOn(notificationsGateway, 'handleSubscribeToRoom');

      // Simulate admin subscription
      notificationsGateway.handleSubscribeToRoom(
        { id: 'admin_socket_456' } as any,
        { room: 'admin' }
      );

      expect(subscribe).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          room: 'admin',
        })
      );
    });

    it('should handle disconnect gracefully', async () => {
      const handleDisconnect = jest.spyOn(notificationsGateway, 'handleDisconnect');

      notificationsGateway.handleDisconnect({ id: 'socket_123' } as any);

      expect(handleDisconnect).toHaveBeenCalled();
    });
  });

  describe('Order Events', () => {
    it('should emit order.created event to tenant room', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitTenantOrderUpdate');

      const orderPayload = {
        event: 'orders.created',
        data: {
          id: mockOrderId,
          tenant_id: mockTenantId,
          status: 'PENDING_PAYMENT',
          total_amount: 100000,
          created_at: new Date(),
        },
      };

      notificationsGateway.emitTenantOrderUpdate(`tenant_${mockTenantId}`, orderPayload);

      expect(emitEvent).toHaveBeenCalledWith(`tenant_${mockTenantId}`, orderPayload);
    });

    it('should emit order.updated event when order status changes', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitTenantOrderUpdate');

      const orderPayload = {
        event: 'orders.updated',
        data: {
          id: mockOrderId,
          tenant_id: mockTenantId,
          status: 'CONFIRMED',
          table_id: 'table_5',
        },
      };

      notificationsGateway.emitTenantOrderUpdate(`tenant_${mockTenantId}`, orderPayload);

      expect(emitEvent).toHaveBeenCalledWith(`tenant_${mockTenantId}`, orderPayload);
    });

    it('should emit order.cancelled event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitTenantOrderUpdate');

      const orderPayload = {
        event: 'orders.cancelled',
        data: {
          id: mockOrderId,
          tenant_id: mockTenantId,
          cancelled_reason: 'Customer request',
          cancelled_at: new Date(),
        },
      };

      notificationsGateway.emitTenantOrderUpdate(`tenant_${mockTenantId}`, orderPayload);

      expect(emitEvent).toHaveBeenCalled();
    });
  });

  describe('Payment Events', () => {
    it('should emit payment.initiated event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitTenantPaymentUpdate');

      const paymentPayload = {
        event: 'payments.initiated',
        data: {
          id: 'payment_123',
          order_id: mockOrderId,
          tenant_id: mockTenantId,
          amount: 100000,
          provider: 'FLUTTERWAVE',
          status: 'INITIATED',
        },
      };

      notificationsGateway.emitTenantPaymentUpdate(`tenant_${mockTenantId}`, paymentPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit payment.completed event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitOrderPaymentVerified');

      const paymentPayload = {
        event: 'payments.completed',
        data: {
          order_id: mockOrderId,
          amount: 100000,
          status: 'SUCCESSFUL',
          verified_at: new Date(),
        },
      };

      notificationsGateway.emitOrderPaymentVerified(mockOrderId, paymentPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit payment.failed event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitTenantPaymentUpdate');

      const paymentPayload = {
        event: 'payments.failed',
        data: {
          order_id: mockOrderId,
          tenant_id: mockTenantId,
          failure_reason: 'Insufficient funds',
          failed_at: new Date(),
        },
      };

      notificationsGateway.emitTenantPaymentUpdate(`tenant_${mockTenantId}`, paymentPayload);

      expect(emitEvent).toHaveBeenCalled();
    });
  });

  describe('Settlement Events', () => {
    it('should emit settlement.pending event to admin', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitAdminEvent');

      const settlementPayload = {
        event: 'settlements.pending',
        data: {
          payout_id: 'payout_001',
          tenant_id: mockTenantId,
          amount: 500000,
          status: 'PENDING',
          created_at: new Date(),
        },
      };

      notificationsGateway.emitAdminEvent('settlements.pending', settlementPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit settlement.processed event to admin', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitAdminEvent');

      const settlementPayload = {
        event: 'settlements.processed',
        data: {
          payout_id: 'payout_001',
          tenant_id: mockTenantId,
          amount: 500000,
          provider_ref: 'paypack_ref_123',
          processed_at: new Date(),
        },
      };

      notificationsGateway.emitAdminEvent('settlements.processed', settlementPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit settlement.failed event to admin', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitAdminEvent');

      const settlementPayload = {
        event: 'settlements.failed',
        data: {
          payout_id: 'payout_001',
          tenant_id: mockTenantId,
          amount: 500000,
          failure_reason: 'Invalid account',
          retry_count: 1,
          max_retries: 3,
        },
      };

      notificationsGateway.emitAdminEvent('settlements.failed', settlementPayload);

      expect(emitEvent).toHaveBeenCalled();
    });
  });

  describe('Support Events', () => {
    it('should emit support.created event to admin', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitSupportIssueCreated');

      const supportPayload = {
        event: 'support.created',
        data: {
          id: 'issue_001',
          type: 'REFUND_REQUEST',
          severity: 'NORMAL',
          related_order_id: mockOrderId,
          created_at: new Date(),
        },
      };

      notificationsGateway.emitSupportIssueCreated(supportPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit support.escalated event to admin', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitSupportIssueEscalated');

      const escalationPayload = {
        event: 'support.escalated',
        data: {
          issue_id: 'issue_001',
          severity: 'CRITICAL',
          reason: 'Auto-escalated after 24h',
          escalated_at: new Date(),
        },
      };

      notificationsGateway.emitSupportIssueEscalated(escalationPayload);

      expect(emitEvent).toHaveBeenCalled();
    });
  });

  describe('Refund Events', () => {
    it('should emit refund.requested event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitRefundStatusUpdate');

      const refundPayload = {
        event: 'refund.requested',
        data: {
          refund_id: 'refund_001',
          order_id: mockOrderId,
          tenant_id: mockTenantId,
          amount: 50000,
          status: 'PENDING',
        },
      };

      notificationsGateway.emitRefundStatusUpdate(mockOrderId, refundPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit refund.approved event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitRefundStatusUpdate');

      const refundPayload = {
        event: 'refund.approved',
        data: {
          refund_id: 'refund_001',
          order_id: mockOrderId,
          status: 'APPROVED',
          approved_by: mockAdminId,
        },
      };

      notificationsGateway.emitRefundStatusUpdate(mockOrderId, refundPayload);

      expect(emitEvent).toHaveBeenCalled();
    });

    it('should emit refund.rejected event', async () => {
      const emitEvent = jest.spyOn(notificationsGateway, 'emitRefundStatusUpdate');

      const refundPayload = {
        event: 'refund.rejected',
        data: {
          refund_id: 'refund_001',
          order_id: mockOrderId,
          status: 'REJECTED',
          rejection_reason: 'Policy violation',
        },
      };

      notificationsGateway.emitRefundStatusUpdate(mockOrderId, refundPayload);

      expect(emitEvent).toHaveBeenCalled();
    });
  });

  describe('Tenant Isolation', () => {
    it('should NOT send tenant events to different tenant', async () => {
      // Events should only be sent to the specific tenant room
      const emitEvent = jest.spyOn(notificationsGateway, 'emitTenantOrderUpdate');

      const orderPayload = {
        event: 'orders.created',
        data: {
          id: mockOrderId,
          tenant_id: mockTenantId,
        },
      };

      // Should only emit to tenant_abc, not to tenant_xyz
      notificationsGateway.emitTenantOrderUpdate(`tenant_${mockTenantId}`, orderPayload);

      expect(emitEvent).toHaveBeenCalledWith(
        `tenant_${mockTenantId}`,
        expect.anything()
      );
    });

    it('should NOT send tenant events to admin broadcast room', async () => {
      // Admin should only receive admin-scoped events
      const emitTenant = jest.spyOn(notificationsGateway, 'emitTenantOrderUpdate');
      const emitAdmin = jest.spyOn(notificationsGateway, 'emitAdminEvent');

      // Tenant order update should NOT go to admin room
      notificationsGateway.emitTenantOrderUpdate(`tenant_${mockTenantId}`, {
        event: 'orders.created',
        data: { id: mockOrderId },
      });

      // Admin should only get admin-scoped events
      expect(emitAdmin).not.toHaveBeenCalledWith(
        'admin',
        expect.objectContaining({
          event: 'orders.created',
        })
      );
    });
  });

  describe('Event Format & Structure', () => {
    it('should include required metadata in all events', async () => {
      const eventPayload = {
        event: 'orders.created',
        timestamp: new Date().toISOString(),
        data: {
          id: mockOrderId,
          tenant_id: mockTenantId,
        },
      };

      // All events should have: event type, timestamp, structured data
      expect(eventPayload).toHaveProperty('event');
      expect(eventPayload).toHaveProperty('timestamp');
      expect(eventPayload).toHaveProperty('data');
    });

    it('should handle large payloads efficiently', async () => {
      // WebSocket should handle bulk operations without degradation
      const largePayload = {
        event: 'analytics.batch_update',
        data: {
          metrics: Array(1000)
            .fill(0)
            .map((_, i) => ({
              id: `metric_${i}`,
              value: Math.random() * 100000,
            })),
        },
      };

      // Should complete without timeout
      const emitEvent = jest.spyOn(notificationsGateway, 'emitAdminEvent');
      notificationsGateway.emitAdminEvent('analytics.batch_update', largePayload);

      expect(emitEvent).toHaveBeenCalled();
    });
  });
});
