# Refund Processing Implementation - Complete Guide

## Overview

The refund processing system is now fully implemented with:
- **Customer endpoints** for requesting refunds
- **Admin endpoints** for approving, rejecting, and managing refunds
- **Resilience patterns** integrated throughout the flow (retry strategy, circuit breaker, degradation levels)
- **Comprehensive error handling** and state management

---

## Architecture

### Workflow

```
Customer Request
    ↓
POST /refunds/request
    ↓
RefundService.requestRefund()
    ↓
Refund created in PENDING state
    ↓
Admin reviews
    ↓
POST /admin/refunds/:id/approve
    ↓
RefundService.approveRefund()
    ↓
Refund transitions to APPROVED
    ↓
Async: processRefundAsync() (with resilience patterns)
    ↓
Check degradation level
Check circuit breaker
Call Flutterwave with retry strategy (3 attempts)
Update refund status to PROCESSED
Debit customer wallet
    ↓
Refund complete
```

### State Machine

```
PENDING (initial state, awaiting admin decision)
    ├─→ APPROVED (admin approved, queued for processing)
    │   └─→ PROCESSED (successfully sent to Flutterwave, money returned)
    │       └─→ COMPLETED (not yet implemented, phase 2)
    ├─→ REJECTED (admin rejected, refund cancelled)
    └─→ FAILED (error during processing, retry available)
```

---

## API Endpoints

### Customer Endpoints

#### 1. Request Refund

**POST /refunds/request**

Creates a PENDING refund request for an order.

**Request:**
```json
{
  "order_id": "uuid",
  "reason": "CUSTOMER_REQUEST|ORDER_CANCELLED|DUPLICATE_PAYMENT|WRONG_AMOUNT|MERCHANT_ERROR|PAYMENT_FAILED",
  "amount": 50000  // optional, defaults to order total
}
```

**Response (201 Created):**
```json
{
  "ok": true,
  "refund": {
    "id": "uuid",
    "order_id": "uuid",
    "amount": 50000,
    "reason": "CUSTOMER_REQUEST",
    "status": "PENDING",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Validation:**
- Order MUST exist and be in PAID status
- Order MUST have Flutterwave transaction reference
- Refund amount MUST be ≤ order total
- No duplicate PENDING/APPROVED refunds for same payment

---

#### 2. View Own Refund Status

**GET /refunds/:id**

View status of a refund.

**Response (200 OK):**
```json
{
  "ok": true,
  "refund": {
    "id": "uuid",
    "order_id": "uuid",
    "amount": 50000,
    "reason": "CUSTOMER_REQUEST",
    "status": "PENDING|APPROVED|PROCESSED|FAILED|REJECTED",
    "notes": "Admin notes if any",
    "error_message": "If status is FAILED",
    "created_at": "2024-01-15T10:30:00Z",
    "approved_at": "2024-01-15T11:00:00Z",
    "processed_at": "2024-01-15T11:05:00Z"
  }
}
```

---

### Admin Endpoints

#### 1. List Refunds

**GET /admin/refunds?status=PENDING&tenant_id=uuid&limit=50&offset=0**

List and filter all refunds (admin view).

**Query Parameters:**
- `status`: RefundStatusEnum (optional)
- `tenant_id`: string (optional)
- `order_id`: string (optional)
- `min_amount`: number (optional)
- `max_amount`: number (optional)
- `limit`: number (default 50, max 200)
- `offset`: number (default 0)

**Response (200 OK):**
```json
{
  "ok": true,
  "refunds": [
    {
      "id": "uuid",
      "order_id": "uuid",
      "tenant_id": "uuid",
      "amount": 50000,
      "reason": "CUSTOMER_REQUEST",
      "status": "PENDING",
      "notes": null,
      "approved_by": null,
      "approved_at": null,
      "processed_at": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

#### 2. View Specific Refund (Admin)

**GET /admin/refunds/:id**

View detailed refund information (admin).

**Response (200 OK):**
```json
{
  "ok": true,
  "refund": {
    "id": "uuid",
    "order_id": "uuid",
    "tenant_id": "uuid",
    "payment_id": "uuid",
    "amount": 50000,
    "reason": "CUSTOMER_REQUEST",
    "status": "PENDING",
    "notes": null,
    "error_message": null,
    "flutterwave_refund_id": null,
    "approved_by": null,
    "approved_at": null,
    "processed_at": null,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

#### 3. Approve Refund

**POST /admin/refunds/:id/approve**

Approve a PENDING refund. Transitions PENDING → APPROVED and triggers async processing.

**Request:**
```json
{
  "approved_by": "admin_user_id",
  "admin_tenant_id": "tenant_uuid",
  "notes": "Approved per customer request"  // optional
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "refund": {
    "id": "uuid",
    "status": "APPROVED",
    "approved_at": "2024-01-15T11:00:00Z",
    "approved_by": "admin_user_id",
    "amount": 50000
  }
}
```

**Async Processing:**
After approval, the endpoint immediately returns but processing continues in background:
1. Check degradation level (fail if OFFLINE)
2. Check circuit breaker state (warn if OPEN)
3. Call Flutterwave with retry strategy (3 attempts)
4. Update refund status to PROCESSED
5. Debit tenant wallet
6. Record health metrics

---

#### 4. Reject Refund

**POST /admin/refunds/:id/reject**

Reject a PENDING refund. Transitions PENDING → REJECTED.

**Request:**
```json
{
  "approved_by": "admin_user_id",
  "admin_tenant_id": "tenant_uuid",
  "notes": "Duplicate payment detected"  // optional
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "refund": {
    "id": "uuid",
    "status": "REJECTED",
    "approved_by": "admin_user_id",
    "notes": "Duplicate payment detected",
    "amount": 50000
  }
}
```

---

## Resilience Patterns Integration

### 1. Retry Strategy

**Operation:** Flutterwave refund API call

**Configuration:**
- Max attempts: 3
- Exponential backoff: 1s → 10s → 30s
- Jitter: ±10% to prevent thundering herd

**Behavior:**
```
Attempt 1: Immediate
  ↓ Fails
Wait 1s ± 10%
Attempt 2: ~1 second later
  ↓ Fails
Wait 10s ± 10%
Attempt 3: ~11 seconds later
  ↓ Fails
Throw error → Mark refund as FAILED
```

### 2. Circuit Breaker

**Service:** `flutterwave-refund`

**States:**
- **CLOSED** (normal): All requests pass through
- **OPEN** (degraded): Requests rejected immediately (fail fast)
- **HALF_OPEN** (recovering): Limited requests allowed to test recovery

**Triggers:**
- Failure threshold: 5 consecutive failures
- Time to open: 60 seconds
- Time to half-open: 60 seconds (auto-recovery attempt)

**Behavior in Controller:**
```typescript
const state = circuitBreaker.getState('flutterwave-refund');
if (state === 'OPEN') {
  // Warn but allow approval (processing will catch this)
  logger.warn('Circuit breaker OPEN - refund may fail');
}
```

### 3. Graceful Degradation

**Levels:**
- **NORMAL** (100%): All features enabled
- **DEGRADED** (80%): Non-essential features disabled
- **CRITICAL** (40%): Only critical operations (payments, refunds)
- **OFFLINE** (0%): All operations blocked

**Refund Handling:**
- NORMAL/DEGRADED/CRITICAL: Refunds allowed
- OFFLINE: Block refund requests with error response

**Degradation Triggers:**
- Flutterwave → 3+ consecutive failures → DEGRADED
- Database → Down → CRITICAL
- Multiple services down → OFFLINE

### 4. Health Monitoring

**Service:** `flutterwave-refund`

**Metrics:**
- Last status (UP/DOWN)
- Response time (milliseconds)
- Error count
- Last check time

**Recorded After:**
- Successful Flutterwave refund call
- Failed Flutterwave refund call (after retries exhausted)

---

## Error Handling

### Customer-Facing Errors

| HTTP Status | Error Message | Cause |
|------------|--------------|-------|
| 400 | order_id is required | Missing required field |
| 400 | reason must be one of: ... | Invalid reason enum |
| 400 | Refund service is temporarily offline | System in OFFLINE state |
| 404 | Order not found | Order doesn't exist |
| 400 | Cannot refund order with payment_status=... | Order not paid |
| 400 | Refund amount exceeds original payment | Amount > order total |
| 400 | Refund already exists for this payment | Duplicate pending/approved refund |

### Admin-Facing Errors

| HTTP Status | Error Message | Cause |
|------------|--------------|-------|
| 400 | approved_by (admin user id) is required | Missing admin user |
| 400 | admin_tenant_id is required | Missing tenant ID |
| 400 | Refund service is temporarily offline | System degraded |
| 404 | Refund not found | Refund ID doesn't exist |
| 400 | Cannot approve refund with status=... | Already approved/rejected/processed |

### Async Processing Errors

All errors during async refund processing are:
1. **Caught and logged** at appropriate levels
2. **Recorded in refund.error_message** field
3. **Refund status set to FAILED**
4. **Circuit breaker notified** (recordFailure)
5. **Available for manual retry** (TBD: implement manual retry endpoint)

**Common Error Scenarios:**
- **Flutterwave API timeout**: Retried with exponential backoff
- **Flutterwave API error**: Logged, circuit breaker opens after 5 failures
- **Wallet service error**: Refund marked FAILED, no recovery
- **Database connection**: Refund status update fails, transaction not marked PROCESSED

---

## Integration with Existing Services

### RefundService

**Constructor Injection:**
```typescript
constructor(
  private readonly refundRepository: Repository<Refund>,
  private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
  private readonly orderRepository: Repository<Order>,
  private readonly flutterwaveService: FlutterwaveIntegrationService,
  private readonly walletService: WalletService,
  private readonly auditService: AuditService,
  private readonly retryStrategy: RetryStrategyService,      // NEW
  private readonly circuitBreaker: CircuitBreakerService,    // NEW
  private readonly degradation: GracefulDegradationService,  // NEW
  private readonly healthCheck: HealthCheckService,          // NEW
) {}
```

**Key Methods:**
- `requestRefund()`: Creates PENDING refund, validates order
- `approveRefund()`: Transitions PENDING → APPROVED, logs audit, triggers async processing
- `rejectRefund()`: Transitions PENDING → REJECTED
- `processRefundAsync()`: Calls Flutterwave with resilience, updates wallet (now public)
- `getRefund()`: Retrieve single refund
- `listRefunds()`: Query with filtering
- `getTenantRefunds()`: Get all refunds for tenant
- `getRefundsByOrder()`: Get all refunds for order

### RefundController

**Endpoints:**
- POST /refunds/request - Customer requests refund
- GET /refunds/:id - Customer views refund
- GET /admin/refunds - Admin lists refunds
- GET /admin/refunds/:id - Admin views specific refund
- POST /admin/refunds/:id/approve - Admin approves refund
- POST /admin/refunds/:id/reject - Admin rejects refund

**Services Injected:**
```typescript
constructor(
  private readonly refundService: RefundService,
  private readonly retryStrategy: RetryStrategyService,
  private readonly circuitBreaker: CircuitBreakerService,
  private readonly degradation: GracefulDegradationService,
) {}
```

### Module Registration

**PaymentsModule Update:**
```typescript
controllers: [
  PaymentController,
  RefundController,  // NEW
  SettlementController,
  // ... other controllers
]
```

---

## Testing

### Manual Testing Flow

#### 1. Request Refund (Customer)
```bash
POST /refunds/request
Content-Type: application/json

{
  "order_id": "order-123",
  "reason": "CUSTOMER_REQUEST",
  "amount": 50000
}

# Response: 201 Created
```

#### 2. List Pending Refunds (Admin)
```bash
GET /admin/refunds?status=PENDING

# Response: 200 OK
{
  "ok": true,
  "refunds": [...],
  "total": 1
}
```

#### 3. Approve Refund (Admin)
```bash
POST /admin/refunds/refund-uuid/approve
Content-Type: application/json

{
  "approved_by": "admin-user-123",
  "admin_tenant_id": "tenant-456",
  "notes": "Approved"
}

# Response: 200 OK
# Async: processRefundAsync() called in background
```

#### 4. Verify Processing (after ~5 seconds)
```bash
GET /refunds/refund-uuid

# Response:
{
  "ok": true,
  "refund": {
    "id": "refund-uuid",
    "status": "PROCESSED",  // Changed from APPROVED
    "flutterwave_refund_id": "fw-12345",
    "processed_at": "2024-01-15T11:05:00Z"
  }
}
```

### Unit Tests (To Be Implemented)

```typescript
describe('RefundController', () => {
  describe('POST /refunds/request', () => {
    it('should create PENDING refund for valid order', () => {});
    it('should reject order not in PAID status', () => {});
    it('should reject duplicate refund request', () => {});
  });

  describe('POST /admin/refunds/:id/approve', () => {
    it('should transition PENDING → APPROVED', () => {});
    it('should trigger async processing', () => {});
    it('should record failure if circuit breaker OPEN', () => {});
  });

  describe('Resilience Patterns', () => {
    it('should retry Flutterwave call 3 times', () => {});
    it('should open circuit breaker after 5 failures', () => {});
    it('should mark refund FAILED after all retries exhausted', () => {});
  });
});
```

---

## Deployment Checklist

- [ ] RefundController deployed
- [ ] RefundService resilience integration tested
- [ ] Circuit breaker state monitored in production
- [ ] Degradation levels set correctly
- [ ] Error messages logged to monitoring system
- [ ] Flutterwave refund API credentials configured
- [ ] Wallet service integration tested
- [ ] Audit logging verified for all admin actions
- [ ] Admin endpoints documented in API gateway
- [ ] Customer endpoints documented in mobile app
- [ ] Retry strategy tuning verified in production

---

## Phase 2 Enhancements (Future)

1. **Auto-Refund**: Automatic refund for cancellations within X minutes
2. **Partial Refunds**: Support for partial refunds of original payment
3. **Bulk Refunds**: Admin CSV upload for bulk refund processing
4. **Retry Endpoint**: Manual retry for FAILED refunds
5. **Scheduled Processing**: Batch processing of APPROVED refunds
6. **Bank Account Refunds**: Direct refund to customer bank account (not Flutterwave)
7. **Refund Analytics**: Dashboard showing refund trends, reasons, success rates
8. **Notifications**: Email/SMS to customer when refund approved/processed
9. **Webhooks**: Allow merchant systems to subscribe to refund status changes
10. **Payment Method Detection**: Different handling for MTN vs Airtel vs Cash orders

---

## Monitoring & Alerts

### Metrics to Monitor

1. **Refund Request Rate**: Requests per minute
2. **Approval Rate**: % of refunds approved vs rejected
3. **Success Rate**: % of approved refunds that successfully process
4. **Processing Time**: Seconds from approval to PROCESSED
5. **Retry Count**: Average number of Flutterwave API retries
6. **Circuit Breaker State**: Time spent in OPEN state

### Alerts to Configure

1. **Circuit Breaker OPEN > 5 min**: Escalate to engineering
2. **Refund Success Rate < 95%**: Check Flutterwave API
3. **Refund Processing Time > 60s**: Database or wallet service issue
4. **Retry Exhaustion Rate > 10%**: Flutterwave reliability degraded
5. **Degradation Level CRITICAL > 10 min**: Multiple services down

---

## FAQ

**Q: What happens if the customer requests a refund for a cash order?**
A: Cash orders are manually marked paid. RefundService validates that order.flutterwave_id exists, which won't be present for cash. Refund will fail at step 1 with "Order has no Flutterwave transaction".

**Q: Can a customer request a refund multiple times?**
A: No, RefundService checks for duplicate PENDING/APPROVED refunds. Only one at a time is allowed.

**Q: What if Flutterwave API is down?**
A: After 3 retries (exponential backoff), circuit breaker opens and refund marked FAILED. Manual retry (phase 2) will be available.

**Q: Can admin approve 1000 refunds at once?**
A: Yes, each approval is independent. /admin/refunds supports limit=200 for listing. Each approval triggers async processing independently.

**Q: Is the wallet debit transactional with Flutterwave call?**
A: No. If Flutterwave succeeds but wallet fails, refund status is FAILED with error_message. This is a known limitation (phase 2 should add compensation logic).

**Q: Can a partially refunded order be refunded again?**
A: Yes, if amount is specified. E.g., refund 30000 once, then 20000 later (total ≤ 50000).

---

