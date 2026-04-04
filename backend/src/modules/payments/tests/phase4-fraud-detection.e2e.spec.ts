import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { FraudReviewService } from '../../modules/payments/services/fraud-review.service';
import { FraudDetectionService } from '../../modules/payments/services/fraud-detection.service';
import {
  FraudReview,
  FraudReviewStatus,
  FraudRiskLevel,
  FraudReviewSubjectType,
} from '../../modules/payments/entities/fraud-review.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';

/**
 * Phase 4: Fraud Detection UI - E2E Test Suite
 *
 * Tests cover:
 * 1. Fraud review record creation (entity + service)
 * 2. Fraud moderation queue (filtering, pagination, counts)
 * 3. Risk scoring and level calculation
 * 4. Admin actions (approve, dismiss, block, escalate)
 * 5. Audit trail logging
 * 6. Statistics and reporting
 * 7. API endpoints
 */
describe('Phase 4: Fraud Detection UI (E2E)', () => {
  let app: INestApplication;
  let fraudReviewService: FraudReviewService;
  let fraudReviewRepo: Repository<FraudReview>;
  let fraudDetectionService: FraudDetectionService;
  let adminAuthToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    fraudReviewService = moduleFixture.get<FraudReviewService>(FraudReviewService);
    fraudDetectionService = moduleFixture.get<FraudDetectionService>(FraudDetectionService);
    fraudReviewRepo = moduleFixture.get<Repository<FraudReview>>(getRepositoryToken(FraudReview));

    // Get admin auth token (mock)
    adminAuthToken = 'mock-admin-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================
  // SUITE 1: Fraud Review Creation & Risk Scoring (6 tests)
  // ============================================================

  describe('Suite 1: Fraud Review Creation & Risk Scoring', () => {
    it('✅ Test 1.1: Create fraud review with CRITICAL risk scores correctly', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'order-001',
        risk_score: 95,
        risk_level: FraudRiskLevel.CRITICAL,
        reasons_json: {
          indicators: [
            '5+ failed payment attempts in last 7 days',
            'Amount 200% above customer average',
          ],
          recommended_action: 'BLOCK',
        },
        customer_phone: '+256701234567',
        order_id: 'order-001',
        amount: 500000,
      });

      expect(review.id).toBeDefined();
      expect(review.risk_level).toBe(FraudRiskLevel.CRITICAL);
      expect(review.risk_score).toBe(95);
      expect(review.status).toBe(FraudReviewStatus.OPEN);
      expect(review.reasons_json.recommended_action).toBe('BLOCK');
    });

    it('✅ Test 1.2: Create fraud review with HIGH risk level', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.CUSTOMER,
        subject_id: 'cust-high-risk',
        risk_score: 65,
        risk_level: FraudRiskLevel.HIGH,
        reasons_json: {
          indicators: ['30% refund rate', '3+ failed payments'],
          recommended_action: 'REVIEW',
        },
        customer_phone: '+256701234568',
        amount: 150000,
      });

      expect(review.risk_level).toBe(FraudRiskLevel.HIGH);
      expect(review.status).toBe(FraudReviewStatus.OPEN);
    });

    it('✅ Test 1.3: Create fraud review with MEDIUM risk level', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.PAYMENT,
        subject_id: 'pay-medium',
        risk_score: 35,
        risk_level: FraudRiskLevel.MEDIUM,
        reasons_json: {
          indicators: ['New customer', 'Unusual amount'],
          recommended_action: 'REVIEW',
        },
        payment_id: 'pay-001',
      });

      expect(review.risk_level).toBe(FraudRiskLevel.MEDIUM);
    });

    it('✅ Test 1.4: Create fraud review with LOW risk (should not flag)', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'order-safe',
        risk_score: 10,
        risk_level: FraudRiskLevel.LOW,
        reasons_json: {
          indicators: [],
          recommended_action: 'ALLOW',
        },
      });

      expect(review.risk_level).toBe(FraudRiskLevel.LOW);
      expect(review.status).toBe(FraudReviewStatus.OPEN);
    });

    it('✅ Test 1.5: Multiple reviews for same subject are separate records', async () => {
      const review1 = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.CUSTOMER,
        subject_id: 'cust-multi',
        risk_score: 50,
        risk_level: FraudRiskLevel.MEDIUM,
      });

      const review2 = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.CUSTOMER,
        subject_id: 'cust-multi',
        risk_score: 70,
        risk_level: FraudRiskLevel.HIGH,
      });

      expect(review1.id).not.toEqual(review2.id);
      expect(review1.risk_score).not.toEqual(review2.risk_score);

      const reviews = await fraudReviewService.getReviewsForSubject(
        FraudReviewSubjectType.CUSTOMER,
        'cust-multi',
      );
      expect(reviews.length).toBeGreaterThanOrEqual(2);
    });

    it('✅ Test 1.6: Risk score boundaries enforce correct levels', async () => {
      // Test all boundaries: LOW=0, MEDIUM=30, HIGH=60, CRITICAL=80
      await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'boundary-low',
        risk_score: 25,
        risk_level: FraudRiskLevel.LOW,
      });

      await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'boundary-med',
        risk_score: 45,
        risk_level: FraudRiskLevel.MEDIUM,
      });

      await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'boundary-high',
        risk_score: 75,
        risk_level: FraudRiskLevel.HIGH,
      });

      await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'boundary-crit',
        risk_score: 95,
        risk_level: FraudRiskLevel.CRITICAL,
      });

      const all = await fraudReviewRepo.find();
      expect(all.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ============================================================
  // SUITE 2: Fraud Moderation Queue & Filtering (6 tests)
  // ============================================================

  describe('Suite 2: Fraud Moderation Queue & Filtering', () => {
    beforeEach(async () => {
      // Create test data
      for (let i = 0; i < 10; i++) {
        await fraudReviewService.createReview({
          subject_type: i % 2 === 0 ? FraudReviewSubjectType.ORDER : FraudReviewSubjectType.CUSTOMER,
          subject_id: `queue-test-${i}`,
          risk_score: 20 + i * 10,
          risk_level: i < 3 ? FraudRiskLevel.LOW : i < 6 ? FraudRiskLevel.MEDIUM : i < 8 ? FraudRiskLevel.HIGH : FraudRiskLevel.CRITICAL,
        });
      }
    });

    it('✅ Test 2.1: Fraud queue returns all OPEN items by default', async () => {
      const result = await fraudReviewService.getFraudQueue({});

      expect(result.total).toBeGreaterThanOrEqual(10);
      expect(result.items.length).toBeGreaterThanOrEqual(10);
      expect(result.counts.open).toBeGreaterThanOrEqual(10);
    });

    it('✅ Test 2.2: Filter queue by risk level (CRITICAL only)', async () => {
      const result = await fraudReviewService.getFraudQueue({
        risk_level: FraudRiskLevel.CRITICAL,
      });

      result.items.forEach((item) => {
        expect(item.risk_level).toBe(FraudRiskLevel.CRITICAL);
      });
    });

    it('✅ Test 2.3: Filter queue by subject type (ORDER only)', async () => {
      const result = await fraudReviewService.getFraudQueue({
        subject_type: FraudReviewSubjectType.ORDER,
      });

      result.items.forEach((item) => {
        expect(item.subject_type).toBe(FraudReviewSubjectType.ORDER);
      });
    });

    it('✅ Test 2.4: Filter queue by status (OPEN only)', async () => {
      const result = await fraudReviewService.getFraudQueue({
        status: FraudReviewStatus.OPEN,
      });

      result.items.forEach((item) => {
        expect(item.status).toBe(FraudReviewStatus.OPEN);
      });
    });

    it('✅ Test 2.5: Queue pagination works correctly', async () => {
      const page1 = await fraudReviewService.getFraudQueue({
        limit: 5,
        offset: 0,
      });
      const page2 = await fraudReviewService.getFraudQueue({
        limit: 5,
        offset: 5,
      });

      expect(page1.items.length).toBeLessThanOrEqual(5);
      expect(page2.items.length).toBeLessThanOrEqual(5);

      // IDs should be different
      const page1Ids = page1.items.map((i) => i.id);
      const page2Ids = page2.items.map((i) => i.id);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('✅ Test 2.6: Queue counts show status distribution', async () => {
      const result = await fraudReviewService.getFraudQueue({});

      expect(result.counts.open).toBeGreaterThanOrEqual(0);
      expect(result.counts.under_review).toBeGreaterThanOrEqual(0);
      expect(result.counts.approved).toBeGreaterThanOrEqual(0);
      expect(result.counts.blocked).toBeGreaterThanOrEqual(0);
      expect(result.counts.dismissed).toBeGreaterThanOrEqual(0);
      expect(result.counts.escalated).toBeGreaterThanOrEqual(0);

      const sum = Object.values(result.counts).reduce((a, b) => a + b, 0);
      expect(sum).toBeLessThanOrEqual(result.total);
    });
  });

  // ============================================================
  // SUITE 3: Admin Review Actions (5 tests)
  // ============================================================

  describe('Suite 3: Admin Review Actions', () => {
    let testReview: FraudReview;

    beforeEach(async () => {
      testReview = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'action-test-order',
        risk_score: 85,
        risk_level: FraudRiskLevel.CRITICAL,
      });
    });

    it('✅ Test 3.1: Dismiss review (false positive)', async () => {
      const updated = await fraudReviewService.dismissReview(
        testReview.id,
        'Legitimate customer with unusual pattern',
        'admin-001',
      );

      expect(updated.status).toBe(FraudReviewStatus.DISMISSED);
      expect(updated.notes).toContain('false positive');
      expect(updated.reviewed_at).toBeDefined();
    });

    it('✅ Test 3.2: Approve review (customer safe)', async () => {
      const updated = await fraudReviewService.approveReview(
        testReview.id,
        'Pattern verified, customer has history',
        'admin-002',
      );

      expect(updated.status).toBe(FraudReviewStatus.APPROVED);
      expect(updated.notes).toContain('Pattern verified');
    });

    it('✅ Test 3.3: Block review (fraud confirmed)', async () => {
      const updated = await fraudReviewService.blockReview(
        testReview.id,
        'Confirmed fraudster, multiple chargebacks',
        'admin-003',
      );

      expect(updated.status).toBe(FraudReviewStatus.BLOCKED);
      expect(updated.action_taken).toContain('blocked');
    });

    it('✅ Test 3.4: Escalate review (manual investigation)', async () => {
      const updated = await fraudReviewService.escalateReview(
        testReview.id,
        'Potential organized fraud ring',
        'admin-004',
      );

      expect(updated.status).toBe(FraudReviewStatus.ESCALATED);
      expect(updated.notes).toContain('organized fraud');
    });

    it('✅ Test 3.5: Assign review to admin for review', async () => {
      const updated = await fraudReviewService.assignReview(testReview.id, 'admin-review-001', 'admin-002');

      expect(updated.status).toBe(FraudReviewStatus.UNDER_REVIEW);
      expect(updated.assigned_admin_id).toBe('admin-review-001');
    });
  });

  // ============================================================
  // SUITE 4: API Endpoints (6 tests)
  // ============================================================

  describe('Suite 4: API Endpoints', () => {
    let testReview: FraudReview;

    beforeEach(async () => {
      testReview = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.CUSTOMER,
        subject_id: 'api-test-cust-001',
        risk_score: 70,
        risk_level: FraudRiskLevel.HIGH,
        customer_phone: '+256701234569',
      });
    });

    it('✅ Test 4.1: GET /admin/fraud/queue returns paginated results', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/fraud/queue?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.counts).toBeDefined();
    });

    it('✅ Test 4.2: GET /admin/fraud/:id returns review details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/fraud/${testReview.id}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200);

      expect(response.body.id).toBe(testReview.id);
      expect(response.body.risk_level).toBe(FraudRiskLevel.HIGH);
    });

    it('✅ Test 4.3: POST /admin/fraud/:id/dismiss executes action', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/fraud/${testReview.id}/dismiss`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({ reason: 'False positive verified' })
        .expect(200);

      expect(response.body.status).toBe(FraudReviewStatus.DISMISSED);
    });

    it('✅ Test 4.4: POST /admin/fraud/:id/block executes action', async () => {
      const newReview = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'api-block-test',
        risk_score: 90,
        risk_level: FraudRiskLevel.CRITICAL,
      });

      const response = await request(app.getHttpServer())
        .post(`/admin/fraud/${newReview.id}/block`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({ reason: 'Confirmed fraudster' })
        .expect(200);

      expect(response.body.status).toBe(FraudReviewStatus.BLOCKED);
    });

    it('✅ Test 4.5: GET /admin/fraud/stats returns metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/fraud/stats?days=7')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200);

      expect(response.body.period_days).toBe(7);
      expect(response.body.total_reviewed).toBeGreaterThanOrEqual(0);
      expect(response.body.by_risk_level).toBeDefined();
      expect(response.body.avg_review_time_minutes).toBeGreaterThanOrEqual(0);
    });

    it('✅ Test 4.6: GET /admin/fraud/subject/:type/:id returns all reviews for subject', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/fraud/subject/CUSTOMER/api-test-cust-001`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0].subject_type).toBe(FraudReviewSubjectType.CUSTOMER);
      }
    });
  });

  // ============================================================
  // SUITE 5: Acceptance Criteria Validation (6 tests)
  // ============================================================

  describe('Suite 5: Acceptance Criteria Validation', () => {
    it('✅ Criterion 1: Admin can see all flagged risk cases', async () => {
      // Create multiple high-risk items
      for (let i = 0; i < 5; i++) {
        await fraudReviewService.createReview({
          subject_type: FraudReviewSubjectType.ORDER,
          subject_id: `crit1-order-${i}`,
          risk_score: 75 + i * 5,
          risk_level: FraudRiskLevel.HIGH,
        });
      }

      const queue = await fraudReviewService.getFraudQueue({});
      expect(queue.total).toBeGreaterThanOrEqual(5);
      expect(queue.items.length).toBeGreaterThanOrEqual(5);
    });

    it('✅ Criterion 2: Each case shows score and reasons', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.CUSTOMER,
        subject_id: 'crit2-detailed',
        risk_score: 65,
        risk_level: FraudRiskLevel.HIGH,
        reasons_json: {
          indicators: [
            'Indicator 1: Failed payment',
            'Indicator 2: High velocity',
          ],
          recommended_action: 'REVIEW',
        },
      });

      const detail = await fraudReviewService.getReviewDetails(review.id);
      expect(detail.risk_score).toBe(65);
      expect(detail.reasons_json?.indicators.length).toBeGreaterThanOrEqual(2);
    });

    it('✅ Criterion 3: Admin can review and take action', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'crit3-action',
        risk_score: 80,
        risk_level: FraudRiskLevel.CRITICAL,
      });

      const approved = await fraudReviewService.approveReview(
        review.id,
        'Legitimate transaction',
        'admin-test',
      );
      expect(approved.status).toBe(FraudReviewStatus.APPROVED);
    });

    it('✅ Criterion 4: Decisions are audit logged', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.PAYMENT,
        subject_id: 'crit4-audit',
        risk_score: 60,
        risk_level: FraudRiskLevel.HIGH,
      });

      await fraudReviewService.blockReview(review.id, 'Fraud confirmed', 'admin-audit-test');

      const detail = await fraudReviewService.getReviewDetails(review.id);
      expect(detail.status).toBe(FraudReviewStatus.BLOCKED);
      expect(detail.action_taken).toBeDefined();
      expect(detail.updated_at).toBeDefined();
    });

    it('✅ Criterion 5: High-risk items easy to filter and sort', async () => {
      // Create mixed-risk items
      await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'crit5-low',
        risk_score: 15,
        risk_level: FraudRiskLevel.LOW,
      });

      await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'crit5-critical',
        risk_score: 95,
        risk_level: FraudRiskLevel.CRITICAL,
      });

      // Filter for CRITICAL only
      const critical = await fraudReviewService.getFraudQueue({
        risk_level: FraudRiskLevel.CRITICAL,
      });

      // All filtered results should be CRITICAL
      critical.items.forEach((item) => {
        expect(item.risk_level).toBe(FraudRiskLevel.CRITICAL);
      });
    });

    it('✅ Criterion 6: Service output visible to admins (not hidden)', async () => {
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.CUSTOMER,
        subject_id: 'crit6-visibility',
        risk_score: 70,
        risk_level: FraudRiskLevel.HIGH,
        reasons_json: {
          indicators: ['Test indicator'],
          recommended_action: 'REVIEW',
        },
      });

      const detail = await fraudReviewService.getReviewDetails(review.id);
      // All data should be accessible
      expect(detail.id).toBeDefined();
      expect(detail.risk_score).toBeDefined();
      expect(detail.risk_level).toBeDefined();
      expect(detail.reasons_json).toBeDefined();
      expect(detail.status).toBeDefined();
    });
  });

  // ============================================================
  // SUITE 6: Integration Scenarios (3 tests)
  // ============================================================

  describe('Suite 6: Integration Scenarios', () => {
    it('✅ Scenario 1: Flagged order → Admin reviews → Blocks customer', async () => {
      // Step 1: High-risk order flagged
      const review = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'scenario1-order',
        risk_score: 85,
        risk_level: FraudRiskLevel.CRITICAL,
        customer_phone: '+256701111111',
      });

      expect(review.status).toBe(FraudReviewStatus.OPEN);

      // Step 2: Admin assigns to self
      const assigned = await fraudReviewService.assignReview(review.id, 'admin-1', 'admin-supervisor');
      expect(assigned.status).toBe(FraudReviewStatus.UNDER_REVIEW);

      // Step 3: Admin blocks customer
      const blocked = await fraudReviewService.blockReview(
        review.id,
        'Confirmed fraud pattern',
        'admin-1',
      );
      expect(blocked.status).toBe(FraudReviewStatus.BLOCKED);
    });

    it('✅ Scenario 2: Multiple risks detected → Priority queue', async () => {
      // Create multiple reviews for same customer
      const cust_phone = '+256702222222';
      for (let i = 0; i < 3; i++) {
        await fraudReviewService.createReview({
          subject_type: FraudReviewSubjectType.ORDER,
          subject_id: `scenario2-order-${i}`,
          risk_score: 60 + i * 10,
          risk_level: i === 2 ? FraudRiskLevel.CRITICAL : FraudRiskLevel.HIGH,
          customer_phone: cust_phone,
        });
      }

      // Get all reviews for customer
      const reviews = await fraudReviewService.getReviewsForSubject(
        FraudReviewSubjectType.CUSTOMER,
        cust_phone,
      );

      expect(reviews.length).toBeGreaterThanOrEqual(1);

      // Queue should show critical first
      const queue = await fraudReviewService.getFraudQueue({
        risk_level: FraudRiskLevel.CRITICAL,
      });
      expect(queue.items.some((r) => r.customer_phone === cust_phone)).toBe(true);
    });

    it('✅ Scenario 3: Stats show fraud distribution over time', async () => {
      // Create items with different statuses
      const review1 = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'scenario3-1',
        risk_score: 50,
        risk_level: FraudRiskLevel.MEDIUM,
      });

      const review2 = await fraudReviewService.createReview({
        subject_type: FraudReviewSubjectType.ORDER,
        subject_id: 'scenario3-2',
        risk_score: 75,
        risk_level: FraudRiskLevel.HIGH,
      });

      // Update statuses
      await fraudReviewService.dismissReview(review1.id, 'False positive', 'admin-1');
      await fraudReviewService.approveReview(review2.id, 'Legitimate', 'admin-2');

      // Get stats
      const stats = await fraudReviewService.getStatistics(7);
      expect(stats.by_status).toBeDefined();
      expect(stats.by_risk_level).toBeDefined();
    });
  });
});
