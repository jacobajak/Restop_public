import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { RefundsController } from '../refunds.controller';
import { AdminRefundsController } from '../../admin/controllers/admin-refunds.controller';
import { RefundService } from '../refund.service';
import { AuditService } from '../../audit/services/audit.service';
import { RefundStatusEnum, RefundReasonEnum } from '../entities/refund.entity';

/**
 * Test Suite: Refund System
 * 
 * Tests:
 * - Refund request creation (merchant endpoint)
 * - Refund list with filtering (admin endpoint)
 * - Refund approval with audit logging
 * - Refund rejection with proper error handling
 * - Refund status retrieval
 * 
 * Coverage:
 * - Request validation
 * - Authorization (tenant isolation + admin guard)
 * - Error cases (invalid order, amount exceeds, etc.)
 * - Audit trail logging
 */
describe('RefundSystem (e2e)', () => {
  let app: INestApplication;
  let refundService: RefundService;
  let auditService: AuditService;

  // Mock data
  const mockOrderId = 'order_123';
  const mockTenantId = 'tenant_abc';
  const mockUserId = 'user_xyz';
  const mockRefundId = 'refund_001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RefundsController, AdminRefundsController],
      providers: [
        {
          provide: RefundService,
          useValue: {
            requestRefund: jest.fn(),
            getRefundsByOrder: jest.fn(),
            listRefunds: jest.fn(),
            approveRefund: jest.fn(),
            rejectRefund: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    refundService = moduleFixture.get<RefundService>(RefundService);
    auditService = moduleFixture.get<AuditService>(AuditService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders/:id/request-refund', () => {
    it('should create a refund request', async () => {
      const mockRefund = {
        id: mockRefundId,
        order_id: mockOrderId,
        tenant_id: mockTenantId,
        amount: 50000,
        reason: RefundReasonEnum.CUSTOMER_REQUESTED,
        status: RefundStatusEnum.PENDING,
        created_at: new Date(),
      };

      jest.spyOn(refundService, 'requestRefund').mockResolvedValue(mockRefund as any);

      const response = await request(app.getHttpServer())
        .post(`/orders/${mockOrderId}/request-refund`)
        .set('Authorization', `Bearer mock_token`)
        .send({
          reason: RefundReasonEnum.CUSTOMER_REQUESTED,
          amount: 50000,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe(mockRefundId);
      expect(response.body.data.status).toBe(RefundStatusEnum.PENDING);
    });

    it('should reject request for non-existent order', async () => {
      jest
        .spyOn(refundService, 'requestRefund')
        .mockRejectedValue(new Error('Order not found'));

      const response = await request(app.getHttpServer())
        .post('/orders/invalid_id/request-refund')
        .set('Authorization', `Bearer mock_token`)
        .send({
          reason: RefundReasonEnum.CUSTOMER_REQUESTED,
          amount: 50000,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject refund amount exceeding order total', async () => {
      jest
        .spyOn(refundService, 'requestRefund')
        .mockRejectedValue(new Error('Refund amount exceeds original payment'));

      const response = await request(app.getHttpServer())
        .post(`/orders/${mockOrderId}/request-refund`)
        .set('Authorization', `Bearer mock_token`)
        .send({
          reason: RefundReasonEnum.CUSTOMER_REQUESTED,
          amount: 999999, // exceeds order total
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /admin/refunds', () => {
    it('should list all refunds with pagination', async () => {
      const mockRefunds = [
        {
          id: 'refund_001',
          status: RefundStatusEnum.PENDING,
          amount: 50000,
          created_at: new Date(),
        },
        {
          id: 'refund_002',
          status: RefundStatusEnum.APPROVED,
          amount: 25000,
          created_at: new Date(),
        },
      ];

      jest.spyOn(refundService, 'listRefunds').mockResolvedValue({
        data: mockRefunds as any,
        total: 2,
        limit: 50,
        offset: 0,
      });

      const response = await request(app.getHttpServer())
        .get('/admin/refunds?limit=50&offset=0')
        .set('Authorization', `Bearer admin_token`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should filter refunds by status', async () => {
      const pendingRefunds = [
        {
          id: 'refund_001',
          status: RefundStatusEnum.PENDING,
          amount: 50000,
        },
      ];

      jest.spyOn(refundService, 'listRefunds').mockResolvedValue({
        data: pendingRefunds as any,
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await request(app.getHttpServer())
        .get(`/admin/refunds?status=${RefundStatusEnum.PENDING}`)
        .set('Authorization', `Bearer admin_token`);

      expect(response.status).toBe(200);
      expect(response.body.data.data[0].status).toBe(RefundStatusEnum.PENDING);
    });

    it('should filter refunds by tenant', async () => {
      const tenantRefunds = [
        {
          id: 'refund_001',
          tenant_id: mockTenantId,
          amount: 50000,
        },
      ];

      jest.spyOn(refundService, 'listRefunds').mockResolvedValue({
        data: tenantRefunds as any,
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await request(app.getHttpServer())
        .get(`/admin/refunds?tenant_id=${mockTenantId}`)
        .set('Authorization', `Bearer admin_token`);

      expect(response.status).toBe(200);
      expect(response.body.data.data[0].tenant_id).toBe(mockTenantId);
    });

    it('should filter refunds by amount range', async () => {
      const filteredRefunds = [
        {
          id: 'refund_001',
          amount: 50000,
        },
      ];

      jest.spyOn(refundService, 'listRefunds').mockResolvedValue({
        data: filteredRefunds as any,
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await request(app.getHttpServer())
        .get('/admin/refunds?min_amount=40000&max_amount=60000')
        .set('Authorization', `Bearer admin_token`);

      expect(response.status).toBe(200);
      expect(response.body.data.data[0].amount).toBe(50000);
    });

    it('should require admin authorization', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/refunds')
        .set('Authorization', `Bearer merchant_token`);

      expect(response.status).toBe(403); // Forbidden
    });
  });

  describe('POST /admin/refunds/:id/approve', () => {
    it('should approve a pending refund', async () => {
      const approvedRefund = {
        id: mockRefundId,
        status: RefundStatusEnum.APPROVED,
        amount: 50000,
      };

      jest.spyOn(refundService, 'approveRefund').mockResolvedValue(approvedRefund as any);

      const response = await request(app.getHttpServer())
        .post(`/admin/refunds/${mockRefundId}/approve`)
        .set('Authorization', `Bearer admin_token`)
        .send({
          approval_notes: 'Approved by admin',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatusEnum.APPROVED);
    });

    it('should log audit entry on approval', async () => {
      const approvedRefund = {
        id: mockRefundId,
        status: RefundStatusEnum.APPROVED,
        amount: 50000,
        before_state: { status: RefundStatusEnum.PENDING },
      };

      jest.spyOn(refundService, 'approveRefund').mockResolvedValue(approvedRefund as any);

      await request(app.getHttpServer())
        .post(`/admin/refunds/${mockRefundId}/approve`)
        .set('Authorization', `Bearer admin_token`)
        .send({ approval_notes: 'Test' });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'REFUND_APPROVED',
        })
      );
    });

    it('should reject approval of non-existent refund', async () => {
      jest
        .spyOn(refundService, 'approveRefund')
        .mockRejectedValue(new Error('Refund not found'));

      const response = await request(app.getHttpServer())
        .post('/admin/refunds/invalid_id/approve')
        .set('Authorization', `Bearer admin_token`)
        .send({ approval_notes: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /admin/refunds/:id/reject', () => {
    it('should reject a pending refund', async () => {
      const rejectedRefund = {
        id: mockRefundId,
        status: RefundStatusEnum.REJECTED,
        amount: 50000,
        rejection_reason: 'Policy violation',
      };

      jest.spyOn(refundService, 'rejectRefund').mockResolvedValue(rejectedRefund as any);

      const response = await request(app.getHttpServer())
        .post(`/admin/refunds/${mockRefundId}/reject`)
        .set('Authorization', `Bearer admin_token`)
        .send({
          rejection_reason: 'Policy violation',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatusEnum.REJECTED);
    });

    it('should log audit entry on rejection', async () => {
      const rejectedRefund = {
        id: mockRefundId,
        status: RefundStatusEnum.REJECTED,
      };

      jest.spyOn(refundService, 'rejectRefund').mockResolvedValue(rejectedRefund as any);

      await request(app.getHttpServer())
        .post(`/admin/refunds/${mockRefundId}/reject`)
        .set('Authorization', `Bearer admin_token`)
        .send({ rejection_reason: 'Test' });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'REFUND_REJECTED',
        })
      );
    });
  });

  describe('GET /orders/:id/refund-status', () => {
    it('should retrieve refund status for an order', async () => {
      const mockRefundStatus = {
        order_id: mockOrderId,
        has_refund: true,
        refund_id: mockRefundId,
        status: RefundStatusEnum.APPROVED,
        amount: 50000,
      };

      jest.spyOn(refundService, 'getRefundsByOrder').mockResolvedValue([mockRefundStatus] as any);

      const response = await request(app.getHttpServer())
        .get(`/orders/${mockOrderId}/refund-status`)
        .set('Authorization', `Bearer mock_token`);

      expect(response.status).toBe(200);
      expect(response.body.data.refund_id).toBe(mockRefundId);
      expect(response.body.data.status).toBe(RefundStatusEnum.APPROVED);
    });

    it('should tenant-isolate refund queries', async () => {
      // This is implicit in the controller implementation
      // If trying to access another tenant's refund, should fail
      const response = await request(app.getHttpServer())
        .get(`/orders/other_tenant_order/refund-status`)
        .set('Authorization', `Bearer different_tenant_token`);

      // Should either 404 or 403 depending on implementation
      expect([403, 404]).toContain(response.status);
    });
  });
});
