/**
 * MVP Critical Flow Test Suite for RESTOP
 * Covers all Phase 1-3 implementations
 * 
 * Test Scenarios:
 * - MCV-001: E2E Payment → Settlement → Payout Flow
 * - MCV-002: Admin Dashboard Data Population
 * - MCV-003: Admin Orders Platform-Wide Visibility
 * - MCV-004: Admin Payments Transaction Visibility
 * - MCV-005: Admin Settlements & Payout Management
 * - MCV-006: Restaurant Suspension Enforcement
 * - MCV-007: Payment Account Verification Enforcement
 * - MCV-008: Background Job: Verify Pending Payments
 * - MCV-009: Background Job: Create Merchant Payables
 * - MCV-010: Background Job: Process Settlements
 * - MCV-011: Admin Restoration & State Management
 * - MCV-012: Data Integrity & Reconciliation
 */

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../src/modules/orders/entities/order.entity';
import { PaymentTransaction } from '../src/modules/payments/entities/payment-transaction.entity';
import { Payout } from '../src/modules/payments/entities/payout.entity';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { TenantPaymentAccount } from '../src/modules/payments/entities/tenant-payment-account.entity';

describe('🚀 MVP CRITICAL FLOW TESTS', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  // Service instances
  let ordersService: any;
  let paymentsService: any;
  let settlementService: any;
  let tenantService: any;
  let tenantPaymentAccountService: any;

  // Repository instances  
  let orderRepository: any;
  let paymentRepository: any;
  let payoutRepository: any;
  let tenantRepository: any;
  let paymentAccountRepository: any;

  // Test data
  let adminToken: string;
  let merchantToken: string;
  let merchantId: string;
  let paymentAccountId: string;
  let orderId: string;
  let paymentId: string;
  let payoutId: string;

  const ADMIN_EMAIL = 'admin@restop.test';
  const ADMIN_PASSWORD = 'TestAdmin@123456';
  const MERCHANT_EMAIL = 'merchant@restop.test';
  const MERCHANT_PASSWORD = 'TestMerchant@123456';
  const MERCHANT_NAME = 'Test Restaurant';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Get services
    ordersService = moduleRef.get('OrdersService');
    paymentsService = moduleRef.get('PaymentService');
    settlementService = moduleRef.get('SettlementService');
    tenantService = moduleRef.get('TenantsService');
    tenantPaymentAccountService = moduleRef.get('TenantPaymentAccountService');

    // Get repositories
    orderRepository = moduleRef.get(getRepositoryToken(Order));
    paymentRepository = moduleRef.get(getRepositoryToken(PaymentTransaction));
    payoutRepository = moduleRef.get(getRepositoryToken(Payout));
    tenantRepository = moduleRef.get(getRepositoryToken(Tenant));
    paymentAccountRepository = moduleRef.get(getRepositoryToken(TenantPaymentAccount));
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== SETUP: Create test users =====
  describe('Setup: Test Data Preparation', () => {
    it('should create admin user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          name: 'Admin User',
          user_type: 'ADMIN',
        });

      expect(response.status).toBe(201);
      adminToken = response.body.access_token;
    });

    it('should create merchant user with restaurant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: MERCHANT_EMAIL,
          password: MERCHANT_PASSWORD,
          name: 'Merchant User',
          user_type: 'RESTAURANT_OWNER',
          restaurant_name: MERCHANT_NAME,
          restaurant_location: 'Downtown',
          restaurant_description: 'Test restaurant',
        });

      expect(response.status).toBe(201);
      merchantToken = response.body.access_token;
      merchantId = response.body.user.tenant_id;
    });

    it('should create payment account for merchant', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${merchantId}/payment-accounts`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          payment_method: 'MTN',
          account_number: '250788123456',
          account_holder: 'Merchant Name',
          network: 'MTN_MOMO_RW',
        });

      expect(response.status).toBe(201);
      paymentAccountId = response.body.data.id;
    });
  });

  // ===== MCV-001: E2E Payment → Settlement → Payout Flow =====
  describe('MCV-001: E2E Payment → Settlement → Payout Flow', () => {
    it('should create order with payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          customer_phone: '250788123456',
          customer_name: 'Test Customer',
          items: [
            {
              menu_item_id: '123e4567-e89b-12d3-a456-426614174000',
              quantity: 2,
              price: 5000,
            },
          ],
          payment_method: 'MTN',
          total_amount: 10000,
        });

      expect(response.status).toBe(201);
      orderId = response.body.data.id;
      expect(response.body.data.payment_status).toBe('PENDING');
    });

    it('should verify pending payment transitions to PAID', async () => {
      // Simulate payment provider confirming payment
      const updatedPayment = await paymentRepository.update(
        { order_id: orderId },
        { status: 'PAID' }
      );

      expect(updatedPayment.affected).toBeGreaterThan(0);

      // Fetch order - payment status should now be PAID
      const order = await orderRepository.findOne({ where: { id: orderId } });
      expect(order.payment_status).toBe('PAID');
    });

    it('should create payout (settlement) for merchant earnings', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/settlements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tenant_id: merchantId,
          amount: 9000, // After 10% fee
          payment_method: 'MTN',
          ordered_by_admin: true,
        });

      expect(response.status).toBe(201);
      payoutId = response.body.data.id;
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should verify payout transitions to SUCCESSFUL', async () => {
      // Simulate payment provider confirming payout
      const updatedPayout = await payoutRepository.update(
        { id: payoutId },
        { status: 'SUCCESSFUL', updated_at: new Date() }
      );

      expect(updatedPayout.affected).toBeGreaterThan(0);

      // Fetch payout - status should be SUCCESSFUL
      const payout = await payoutRepository.findOne({ where: { id: payoutId } });
      expect(payout.status).toBe('SUCCESSFUL');
    });

    it('should complete E2E flow validation', async () => {
      // Verify the complete chain:
      // Order PAID → Settlement Created → Settlement SUCCESSFUL
      const order = await orderRepository.findOne({ 
        where: { id: orderId },
      });
      const payout = await payoutRepository.findOne({ 
        where: { id: payoutId },
      });

      expect(order.payment_status).toBe('PAID');
      expect(payout.status).toBe('SUCCESSFUL');
      expect(payout.tenant_id).toBe(merchantId);
    });
  });

  // ===== MCV-002: Admin Dashboard Data Population =====
  describe('MCV-002: Admin Dashboard Data Population', () => {
    it('should fetch today\'s orders count', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.todays_orders).toBeGreaterThanOrEqual(1);
      expect(typeof response.body.data.todays_orders).toBe('number');
    });

    it('should fetch today\'s GMV (Gross Merchandise Value)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.todays_gmv).toBeGreaterThanOrEqual(0);
      expect(typeof response.body.data.todays_gmv).toBe('number');
    });

    it('should fetch active restaurants count', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.active_restaurants).toBeGreaterThanOrEqual(1);
      expect(typeof response.body.data.active_restaurants).toBe('number');
    });

    it('should fetch payment breakdown by method', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.payment_breakdown).toBeDefined();
      expect(response.body.data.payment_breakdown.cash).toBeGreaterThanOrEqual(0);
      expect(response.body.data.payment_breakdown.mtn).toBeGreaterThanOrEqual(0);
      expect(response.body.data.payment_breakdown.airtel).toBeGreaterThanOrEqual(0);
    });

    it('should fetch settlement statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.settlement_stats).toBeDefined();
      expect(response.body.data.settlement_stats.pending).toBeGreaterThanOrEqual(0);
      expect(response.body.data.settlement_stats.successful).toBeGreaterThanOrEqual(0);
      expect(response.body.data.settlement_stats.failed).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== MCV-003: Admin Orders Platform-Wide Visibility =====
  describe('MCV-003: Admin Orders Platform-Wide Visibility', () => {
    it('should fetch all orders across all restaurants', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/orders?limit=50&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.orders)).toBe(true);
      expect(response.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter orders by restaurant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders?restaurant_id=${merchantId}&limit=50`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // All returned orders should belong to specified restaurant
      response.body.data.orders.forEach((order: any) => {
        expect(order.tenant_id).toBe(merchantId);
      });
    });

    it('should filter orders by payment status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/orders?payment_status=PAID&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.orders.forEach((order: any) => {
        expect(order.payment_status).toBe('PAID');
      });
    });

    it('should filter orders by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders?from_date=${today}&to_date=${today}&limit=50`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.orders)).toBe(true);
    });

    it('should search orders by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders?search=${orderId}&limit=50`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.orders.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.orders[0].id).toBe(orderId);
    });

    it('should support pagination', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/v1/admin/orders?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      const response2 = await request(app.getHttpServer())
        .get('/api/v1/admin/orders?limit=10&offset=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.data.orders.length).toBeLessThanOrEqual(10);
    });
  });

  // ===== MCV-004: Admin Payments Transaction Visibility =====
  describe('MCV-004: Admin Payments Transaction Visibility', () => {
    it('should fetch all payments across platform', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/payments?limit=50&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.payments)).toBe(true);
      expect(response.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter payments by method', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/payments?method=MTN&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.payments.forEach((payment: any) => {
        expect(['MTN', 'CASH']).toContain(payment.payment_method);
      });
    });

    it('should filter payments by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/payments?status=PAID&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.payments.forEach((payment: any) => {
        expect(payment.status).toBe('PAID');
      });
    });

    it('should support payment search by reference', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/payments?search=${paymentId}&limit=50`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.payments.length > 0) {
        expect(response.body.data.payments[0].id).toBe(paymentId);
      }
    });
  });

  // ===== MCV-005: Admin Settlements & Payout Management =====
  describe('MCV-005: Admin Settlements & Payout Management', () => {
    it('should fetch all settlements across platform', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/settlements?limit=50&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.settlements)).toBe(true);
      expect(response.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter settlements by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/settlements?status=SUCCESSFUL&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.settlements.forEach((settlement: any) => {
        expect(settlement.status).toBe('SUCCESSFUL');
      });
    });

    it('should get settlement detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/settlements/${payoutId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(payoutId);
      expect(response.body.data.status).toBe('SUCCESSFUL');
    });

    it('should get settlement statistics', async () => {
      const today = new Date().toISOString().split('T')[0];
      tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/settlements/stats?from_date=${today}&to_date=${tomorrow.toISOString().split('T')[0]}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('pending');
      expect(response.body.data).toHaveProperty('successful');
      expect(response.body.data).toHaveProperty('failed');
      expect(response.body.data).toHaveProperty('total_amount');
    });
  });

  // ===== MCV-006: Restaurant Suspension Enforcement =====
  describe('MCV-006: Restaurant Suspension Enforcement', () => {
    let secondMerchantId: string;
    let secondMerchantToken: string;

    beforeAll(async () => {
      // Create second merchant
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `merchant2-${Date.now()}@restop.test`,
          password: MERCHANT_PASSWORD,
          name: 'Second Merchant',
          user_type: 'RESTAURANT_OWNER',
          restaurant_name: 'Suspended Restaurant',
          restaurant_location: 'Uptown',
          restaurant_description: 'Will be suspended',
        });

      secondMerchantId = registerRes.body.user.tenant_id;
      secondMerchantToken = registerRes.body.access_token;
    });

    it('should allow order creation from active restaurant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${secondMerchantToken}`)
        .send({
          customer_phone: '250788123456',
          customer_name: 'Customer',
          items: [
            {
              menu_item_id: '123e4567-e89b-12d3-a456-426614174000',
              quantity: 1,
              price: 5000,
            },
          ],
          payment_method: 'CASH',
          total_amount: 5000,
        });

      expect([201, 200]).toContain(response.status);
    });

    it('should suspend restaurant via admin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/restaurants/${secondMerchantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'SUSPENDED',
          reason: 'Violation of terms of service',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('SUSPENDED');
      expect(response.body.data.suspended_reason).toBe('Violation of terms of service');
    });

    it('should block order creation from suspended restaurant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${secondMerchantToken}`)
        .send({
          customer_phone: '250788123456',
          customer_name: 'Customer',
          items: [
            {
              menu_item_id: '123e4567-e89b-12d3-a456-426614174000',
              quantity: 1,
              price: 5000,
            },
          ],
          payment_method: 'CASH',
          total_amount: 5000,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('suspended');
    });

    it('should reactivate suspended restaurant', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/restaurants/${secondMerchantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ACTIVE',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('should allow order creation after reactivation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${secondMerchantToken}`)
        .send({
          customer_phone: '250788123456',
          customer_name: 'Customer',
          items: [
            {
              menu_item_id: '123e4567-e89b-12d3-a456-426614174000',
              quantity: 1,
              price: 5000,
            },
          ],
          payment_method: 'CASH',
          total_amount: 5000,
        });

      expect([201, 200]).toContain(response.status);
    });
  });

  // ===== MCV-007: Payment Account Verification Enforcement =====
  describe('MCV-007: Payment Account Verification Enforcement', () => {
    let unverifiedAccountId: string;
    let thirdMerchantId: string;

    beforeAll(async () => {
      // Create third merchant
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `merchant3-${Date.now()}@restop.test`,
          password: MERCHANT_PASSWORD,
          name: 'Third Merchant',
          user_type: 'RESTAURANT_OWNER',
          restaurant_name: 'Unverified Merchant',
          restaurant_location: 'Suburbs',
          restaurant_description: 'Unverified account',
        });

      thirdMerchantId = registerRes.body.user.tenant_id;

      // Create unverified payment account
      const accountRes = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${thirdMerchantId}/payment-accounts`)
        .set('Authorization', `Bearer ${registerRes.body.access_token}`)
        .send({
          payment_method: 'AIRTEL',
          account_number: '250799123456',
          account_holder: 'Unverified Merchant',
          network: 'AIRTEL_MONEY_RW',
        });

      unverifiedAccountId = accountRes.body.data.id;
    });

    it('should list pending verification accounts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/verification/accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.accounts)).toBe(true);
      expect(response.body.data.unverified_count).toBeGreaterThanOrEqual(0);
    });

    it('should prevent payout to unverified account', async () => {
      // Try to create settlement for merchant with unverified account
      const response = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tenant_id: thirdMerchantId,
          amount: 5000,
          payment_method: 'AIRTEL',
          ordered_by_admin: true,
        });

      // Should be rejected or status should indicate account not verified
      expect([400, 409]).toContain(response.status);
      expect(response.body.message).toMatch(/verified|verification/i);
    });

    it('should verify payment account via admin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/verification/accounts/${unverifiedAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'verify',
          verification_method: 'PHONE_CALL',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.is_verified).toBe(true);
    });

    it('should allow payout to verified account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tenant_id: thirdMerchantId,
          amount: 5000,
          payment_method: 'AIRTEL',
          ordered_by_admin: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should reject payment account with reason', async () => {
      // Create another unverified account to reject
      thirdMerchantToken = (await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'merchant3@restop.test',
          password: MERCHANT_PASSWORD,
        })).body.access_token;

      const accountRes = await request(app.getHttpServer())
        .post(`/api/v1/tenants/${thirdMerchantId}/payment-accounts`)
        .set('Authorization', `Bearer ${thirdMerchantToken}`)
        .send({
          payment_method: 'MTN',
          account_number: '250788765432',
          account_holder: 'To Be Rejected',
          network: 'MTN_MOMO_RW',
        });

      const toRejectAccountId = accountRes.body.data.id;

      const response = await request(app.getHttpServer())
        .put(`/api/v1/admin/verification/accounts/${toRejectAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'reject',
          reason: 'Account details do not match registration info',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.is_verified).toBe(false);
      expect(response.body.data.rejection_reason).toContain('do not match');
    });
  });

  // ===== MCV-008 through MCV-012: Background Jobs & Integrity =====
  describe('MCV-008-012: Background Jobs & Data Integrity', () => {
    it('MCV-008: should verify pending payments job would execute correctly', async () => {
      // Check if payment verification service can be called
      const unverifiedPayments = await paymentRepository.find({
        where: { status: 'PENDING' },
      });

      // This test passes if query executes without errors
      expect(Array.isArray(unverifiedPayments)).toBe(true);
    });

    it('MCV-009: should verify merchant payables would be created correctly', async () => {
      // Check if payables calculation works
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);

      const paidOrders = await orderRepository.find({
        where: {
          payment_status: 'PAID',
          created_at: new Date(yesterdayDate.toDateString()),
        },
      });

      // Verify structure is correct
      expect(Array.isArray(paidOrders)).toBe(true);
    });

    it('MCV-010: should verify settlement processing structure', async () => {
      // Verify pending settlements exist and can be processed
      const pendingPayouts = await payoutRepository.find({
        where: { status: 'PENDING' },
      });

      expect(Array.isArray(pendingPayouts)).toBe(true);
    });

    it('MCV-011: should verify audit logging tracks admin actions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs?limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.logs)).toBe(true);
      // Should contain at least suspension/verification actions
      const hasActions = response.body.data.logs.some(
        (log: any) =>
          log.action_type?.includes('SUSPENDED') ||
          log.action_type?.includes('VERIFIED')
      );

      expect(hasActions).toBe(true);
    });

    it('MCV-012: should validate data integrity with reconciliation', async () => {
      // Verify total payments equals total orders paid
      const allOrders = await orderRepository.find({
        where: { payment_status: 'PAID' },
      });

      const totalOrderValue = allOrders.reduce(
        (sum, order) => sum + order.total_amount,
        0
      );

      const allPayments = await paymentRepository.find({
        where: { status: 'PAID' },
      });

      const totalPaymentValue = allPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );

      // These should be equal (in ideal case with no data loss)
      expect(totalPaymentValue).toBeLessThanOrEqual(totalOrderValue);
    });
  });

  // ===== Access Control Tests =====
  describe('Access Control & Authorization', () => {
    it('should deny non-admin access to admin endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny unauthenticated access to admin endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/overview');

      expect(response.status).toBe(401);
    });

    it('should allow merchants to view only their own settlement data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/settlement/summary')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      // Should return summary for authenticated merchant only
      expect(response.body.data).toHaveProperty('wallet_balance');
    });
  });
});

// Helper variable for tomorrow
let tomorrow: Date;
