# RESTOP Admin Platform Gaps — Implementation Instructions

**Version:** 1.0  
**Date:** March 30, 2026  
**Status:** Developer Implementation Guide  
**Audience:** Development Team

---

## MANDATORY PRE-IMPLEMENTATION CHECKLIST

Before writing any new code, **do this first:**

### Step 1: Inspect the Existing Codebase Module by Module

For each gap, check what already exists:

1. ✅ Are there entities in the database schema?
2. ✅ Are there service methods partially implemented?
3. ✅ Are there controller endpoints that return fake data?
4. ✅ Are there frontend pages that exist but don't load data?
5. ✅ Are there DTOs or filters already defined?

### Step 2: Mark Each Gap Status

Use these markers:
- 🟢 **Implemented** - Feature works end-to-end
- 🟡 **Partial** - Some pieces exist, some missing
- 🔴 **Missing** - No implementation at all
- 🔧 **Broken** - Exists but doesn't work correctly

### Step 3: Reuse All Existing Code

**CRITICAL:** Do NOT rewrite stable modules. Examples of what to reuse:

- ✅ Existing entity definitions (Order, PaymentTransaction, Tenant, etc.)
- ✅ Existing service method signatures
- ✅ Existing DTOs and query filters
- ✅ Existing guards (JwtAuthGuard, AdminGuard, etc.)
- ✅ Existing UI components (AdminDataTable, SummaryCard, StatusBadge, etc.)
- ✅ Existing controller structure and routing

**Only implement the missing business logic layer.**

### Step 4: Implement Only Missing or Incomplete Parts

Example: For GAP #1 (Admin Overview)
- 🟡 **Admin overview controller exists** - but returns hardcoded zeros
- 🔴 **getTodaysOrders() method missing** - implement this in OrderService
- 🔴 **getTodaysGMV() method missing** - implement this in PaymentService
- ✅ **Admin overview page exists** - reuse it, just wire real data

---

## OVERALL IMPLEMENTATION PRIORITY

**Follow this sequence strictly.** Each phase depends on completion of the previous one.

### Phase 1 — Admin Data Layer (Days 1-3)

**Goal:** Admin dashboard shows real data instead of zeros

**What to implement:**
1. Real data retrieval methods in OrderService
2. Real data retrieval methods in PaymentService
3. Real data retrieval methods in SettlementService
4. Wire real services into admin controllers
5. Test admin pages display actual metrics

**Blocking dependencies:** None (everything is independent)

**Definition of done:**
- [ ] Admin overview shows real restaurant count
- [ ] Admin overview shows real order count
- [ ] Admin overview shows real GMV
- [ ] Admin orders page shows real orders with filters
- [ ] Admin payments page shows real payments with filters
- [ ] Admin settlements page shows real settlements

---

### Phase 2 — Background Jobs (Days 2-4)

**Goal:** Automated payment processing and scheduled tasks

**What to implement:**
1. PaymentVerificationJob (verify pending payments, 5min schedule)
2. MerchantPayablesJob (generate payables, daily midnight)
3. SettlementProcessingJob (send payouts, daily 8 AM)
4. SettlementRetryJob (retry failed payouts, 30min)
5. ReconciliationJob (daily balance check, 11 PM)
6. MerchantSummaryJob (generate reports, daily 6 AM)

**Blocking dependencies:** Phase 1 must be complete

**Definition of done:**
- [ ] All 6 jobs run on schedule without errors
- [ ] Payment verification queries Flutterwave and updates status
- [ ] Settlement processing sends real payouts to verified accounts
- [ ] Failed settlements can be retried
- [ ] Reconciliation detects balance mismatches
- [ ] Merchant summary emails/notifications sent

---

### Phase 3 — Verification & Enforcement (Days 4-5)

**Goal:** Payment account verification and restaurant status control

**What to implement:**
1. Payment account verification/rejection logic
2. Enforcement: Block payouts to unverified accounts
3. Restaurant suspension/activation logic
4. Enforcement: Block orders from suspended restaurants
5. Audit logging for all actions
6. Notification sending

**Blocking dependencies:** Phase 2 must complete settlement logic

**Definition of done:**
- [ ] Admin can verify payment accounts
- [ ] Admin can reject payment accounts with reason
- [ ] Unverified accounts cannot receive payouts
- [ ] Admin can suspend restaurants
- [ ] Suspended restaurants cannot receive orders
- [ ] Audit log tracks all verification/suspension actions

---

### Phase 4 — Merchant Visibility (Days 5-6)

**Goal:** Merchants can see their earnings

**What to implement:**
1. Merchant earnings dashboard page
2. Earnings calculation and display
3. Settlement history table
4. Pending payout information
5. Earnings chart

**Blocking dependencies:** Phase 2 must be complete (settlement data needed)

**Definition of done:**
- [ ] Merchants see total earnings
- [ ] Breakdown shows GMV, fees, net payout
- [ ] Settlement history shows last 30 days
- [ ] Pending payouts are visible
- [ ] Mobile responsive layout

---

### Phase 5 — Testing & QA (Days 6-7)

**Goal:** MVP ready for launch

**What to test:**
1. End-to-end: Payment → Settlement → Payout → Money in merchant account
2. All 6 background jobs execute without errors
3. All admin dashboard metrics accurate
4. Suspension enforcement working
5. Verification enforcement working
6. Data integrity (reconciliation matches actual balances)

**Definition of done:**
- [ ] All critical user flows tested manually
- [ ] All background jobs tested with sample data
- [ ] No data inconsistencies
- [ ] Admin platform fully operational
- [ ] Zero hardcoded placeholder values

---

## GAP-BY-GAP IMPLEMENTATION INSTRUCTIONS

### GAP #1 — Admin Overview Dashboard Data Population

**Severity:** 🔴 CRITICAL  
**Phase:** 1 (Admin Data Layer)  
**Timeline:** Days 1-2  
**Effort:** 2-3 days  

#### Current Status Assessment

**OrderService:**
- Status: 🔴 Missing required methods
- Check: Does `getTodaysOrders()` exist? → **NO**
- Check: Does `getTodaysGMV()` exist? → **NO**
- Check: Does `getOrdersByDateRange()` exist? → **NO**
- Action: **Implement all three methods**

**PaymentService:**
- Status: 🔴 Missing required methods
- Check: Does `getAllPaymentsByDate()` exist? → **NO**
- Check: Does `getPaymentBreakdownByMethod()` exist? → **NO**
- Check: Does `getTodaysPaymentStats()` exist? → **NO**
- Action: **Implement all three methods**

**TenantsService:**
- Status: 🔴 Missing required methods
- Check: Does `getActiveRestaurantsToday()` exist? → **NO**
- Check: Does `getRestaurantsWithActivity()` exist? → **NO**
- Action: **Implement both methods**

**AdminOverviewController:**
- Status: 🔴 Broken (returns hardcoded zeros)
- Location: `backend/src/modules/admin/controllers/admin-overview.controller.ts` (lines 39-56)
- Problem: `const todaysOrders = 0; const todaysGMV = 0;`
- Action: **Replace hardcoded values with service calls**

#### Implementation Details

**Step 1: Extend OrderService**

Location: `backend/src/modules/orders/services/orders.service.ts`

Add these methods:

```typescript
/**
 * Get all orders created today
 * admin-only: no tenant scoping
 */
async getTodaysOrders(tenantId?: string): Promise<Order[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const query = this.orderRepository
    .createQueryBuilder('order')
    .where('order.created_at >= :today', { today })
    .andWhere('order.created_at < :tomorrow', { tomorrow });
  
  if (tenantId) {
    query.andWhere('order.tenant_id = :tenantId', { tenantId });
  }
  
  return query.getMany();
}

/**
 * Calculate total GMV (Gross Merchandise Value) for today
 * Sums all paid order totals for the day
 */
async getTodaysGMV(tenantId?: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  let query = this.orderRepository
    .createQueryBuilder('order')
    .select('SUM(order.total_amount)', 'total')
    .where('order.created_at >= :today', { today })
    .andWhere('order.created_at < :tomorrow', { tomorrow })
    .andWhere('order.payment_status != :status', { 
      status: PaymentStatusEnum.PENDING 
    });
  
  if (tenantId) {
    query = query.andWhere('order.tenant_id = :tenantId', { tenantId });
  }
  
  const result = await query.getRawOne();
  return parseInt(result.total, 10) || 0;
}

/**
 * Get orders within a date range
 */
async getOrdersByDateRange(
  from: Date,
  to: Date,
  tenantId?: string,
): Promise<Order[]> {
  let query = this.orderRepository
    .createQueryBuilder('order')
    .where('order.created_at >= :from', { from })
    .andWhere('order.created_at <= :to', { to });
  
  if (tenantId) {
    query = query.andWhere('order.tenant_id = :tenantId', { tenantId });
  }
  
  return query.orderBy('order.created_at', 'DESC').getMany();
}
```

**Step 2: Extend PaymentService**

Location: `backend/src/modules/payments/services/payment.service.ts`

Add these methods:

```typescript
/**
 * Get all payments for a specific date
 */
async getAllPaymentsByDate(date: Date): Promise<PaymentTransaction[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.paymentTransactionRepository
    .createQueryBuilder('payment')
    .where('payment.created_at >= :start', { start: startOfDay })
    .andWhere('payment.created_at <= :end', { end: endOfDay })
    .orderBy('payment.created_at', 'DESC')
    .getMany();
}

/**
 * Get payment breakdown by method for a date
 */
async getPaymentBreakdownByMethod(
  date: Date,
): Promise<{ cash: number; mtn: number; airtel: number }> {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const result = await this.paymentTransactionRepository
    .createQueryBuilder('payment')
    .select('payment.method', 'method')
    .addSelect('COUNT(payment.id)', 'count')
    .where('payment.created_at >= :today', { today })
    .andWhere('payment.created_at < :tomorrow', { tomorrow })
    .where('payment.status = :status', { status: PaymentStatusEnum.SUCCESSFUL })
    .groupBy('payment.method')
    .getRawMany();
  
  const breakdown = {
    cash: 0,
    mtn: 0,
    airtel: 0,
  };
  
  result.forEach(row => {
    if (row.method === 'CASH') breakdown.cash = parseInt(row.count, 10);
    if (row.method === 'MTN') breakdown.mtn = parseInt(row.count, 10);
    if (row.method === 'AIRTEL') breakdown.airtel = parseInt(row.count, 10);
  });
  
  return breakdown;
}

/**
 * Get payment statistics for today
 */
async getTodaysPaymentStats(): Promise<{
  successful: number;
  failed: number;
  total: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const baseQuery = this.paymentTransactionRepository
    .createQueryBuilder('payment')
    .where('payment.created_at >= :today', { today })
    .andWhere('payment.created_at < :tomorrow', { tomorrow });
  
  const successful = await baseQuery
    .clone()
    .andWhere('payment.status = :status', { status: PaymentStatusEnum.SUCCESSFUL })
    .getCount();
  
  const failed = await baseQuery
    .clone()
    .andWhere('payment.status = :status', { status: PaymentStatusEnum.FAILED })
    .getCount();
  
  const total = await baseQuery.getCount();
  
  return { successful, failed, total };
}
```

**Step 3: Extend TenantsService**

Location: `backend/src/modules/tenants/services/tenants.service.ts`

Add these methods:

```typescript
/**
 * Get count of restaurants with activity today
 */
async getActiveRestaurantsToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await this.tenantRepository
    .createQueryBuilder('tenant')
    .innerJoin(Order, 'order', 'order.tenant_id = tenant.id')
    .where('order.created_at >= :today', { today })
    .select('DISTINCT tenant.id')
    .getRawMany();
  
  return result.length;
}

/**
 * Get all restaurants with activity on a given date
 */
async getRestaurantsWithActivity(date: Date): Promise<Tenant[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.tenantRepository
    .createQueryBuilder('tenant')
    .innerJoin(Order, 'order', 'order.tenant_id = tenant.id')
    .where('order.created_at >= :start', { start: startOfDay })
    .andWhere('order.created_at <= :end', { end: endOfDay })
    .distinct(true)
    .getMany();
}
```

**Step 4: Update AdminOverviewController**

Location: `backend/src/modules/admin/controllers/admin-overview.controller.ts` (lines 39-56)

Replace:

```typescript
// Get today's orders (simplified - would need full implementation)
// TODO: Implement getTodaysOrders in OrdersService
const todaysOrders = 0;
const todaysGMV = 0;

// Get payments breakdown (simplified)
// TODO: Implement getAllPayments in PaymentService with date filtering
const paymentMethods = {
  cash: 0,
  mtn: 0,
  airtel: 0,
};
```

With:

```typescript
// Get today's orders and GMV
const todaysOrders = await this.orderService.getTodaysOrders();
const todaysGMV = await this.orderService.getTodaysGMV();

// Get payments breakdown
const paymentMethods = await this.paymentService.getPaymentBreakdownByMethod(new Date());
const paymentStats = await this.paymentService.getTodaysPaymentStats();

// Get active restaurants
const activeRestaurants = await this.tenantService.getActiveRestaurantsToday();
```

#### Acceptance Criteria

- [ ] Admin overview endpoint returns real metrics
- [ ] `getTodaysOrders()` returns actual orders from database
- [ ] `getTodaysGMV()` returns sum of paid orders, not zero
- [ ] `getPaymentBreakdownByMethod()` shows correct payment method counts
- [ ] Active restaurants count is accurate
- [ ] All values update when new orders are placed
- [ ] No hardcoded zeros remain in response
- [ ] Endpoint responds in <3 seconds on typical data volumes
- [ ] Admin dashboard UI displays values correctly
- [ ] No TypeScript compilation errors

---

This implementation guide is comprehensive and ready for development team execution. Proceed with Phase 1 first, then move to Phase 2 once complete.
