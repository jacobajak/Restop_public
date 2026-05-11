# Transaction Verification Implementation - Complete Guide

## Overview

The transaction verification system implements the **"Never-Trust-Webhook-Alone"** principle with resilience patterns integrated throughout. This ensures payments are verified via Flutterwave API before any wallet credit occurs.

---

## Core Principle: Never-Trust-Webhook-Alone

### Attack Scenarios Prevented

| Scenario | Risk | Prevention |
|----------|------|-----------|
| **Webhook Replay Attack** | Attacker replays same webhook 10 times | Idempotency + API verification |
| **Amount Tampering** | Webhook body says 500,000 RWF but Flutterwave says 5,000 | Amount validation against Flutterwave |
| **Status Tampering** | Webhook says "successful" but Flutterwave says "pending" | Status verification against Flutterwave |
| **Fake Transaction ID** | Webhook references non-existent Flutterwave ID | Flutterwave API validation |
| **Wrong Currency** | Webhook claims USD payment treated as RWF | Explicit currency verification |

### Protection Mechanism

```
Webhook Received (UNTRUSTED)
    ↓
Query Flutterwave API (TRUSTED)
    ↓
Validate:
  ✓ Status = "successful" (not pending/failed)
  ✓ Amount matches order total exactly
  ✓ Currency = RWF
  ✓ Transaction ID matches
    ↓
IF ALL CHECKS PASS:
  ✓ Create PaymentTransaction record
  ✓ Credit wallet
  ✓ Mark order PAID
  ✓ Trigger payout
  ✓ Log audit trail
    ↓
ELSE:
  ✗ Order remains PENDING
  ✗ Wallet NOT credited
  ✗ Retry via background job
```

---

## Verification Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FLUTTERWAVE                             │
│         (Authoritative Payment Data Source)                  │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │
              (Query + Verify - Never Trust Webhook)
                              │
┌─────────────────────────────────────────────────────────────┐
│         TransactionVerificationService                       │
│  (Implements Never-Trust-Webhook-Alone Principle)            │
│  - Resilience patterns (retry, circuit breaker, degradation) │
│  - Comprehensive validation (amount, status, currency)       │
│  - Audit trail (all verification steps logged)               │
│  - Settlement integration (wallet credit gating)             │
│  - Compensation logic (if settlement fails)                  │
└─────────────────────────────────────────────────────────────┘
        ↑                  │                    ↓
        │                  │                    │
    Webhook          Verification         Settlement/Payout
    (Initial         (Verification)       (Irrevocable)
     Signal)         NEVER TRUST
```

---

## 11-Step Verification Process

### Step 1: Load and Validate Order
```
Load order from database
Validate: order exists
Validate: order has flutterwave_id or tx_ref
Fail → Error, retry later
```

**Error Handling:**
- If order not found: Log and return error (order may be created soon)
- If no Flutterwave reference: Fatal error, cannot verify

---

### Step 2: Check Degradation Level

**Purpose:** Don't verify if system is OFFLINE

**Behavior:**
- OFFLINE → Defer verification, order remains PENDING
- CRITICAL → Allow verification, monitor closely
- DEGRADED → Allow verification, expect slower response
- NORMAL → Full speed

**Code:**
```typescript
const degradationLevel = await this.degradation.evaluateDegradationLevel();
if (degradationLevel === DegradationLevel.OFFLINE) {
  throw new Error('System OFFLINE - verification deferred');
}
```

---

### Step 3: Check Circuit Breaker

**Purpose:** Don't hammer Flutterwave if it's down

**Service:** `flutterwave-verify`

**Circuit Breaker States:**
- CLOSED (normal): Process verification
- OPEN (degraded): Reject verification (fail fast)
- HALF_OPEN (recovering): Allow limited verification to test recovery

**Code:**
```typescript
const circuitState = this.circuitBreaker.getState('flutterwave-verify');
if (circuitState === 'OPEN') {
  throw new Error('Circuit breaker OPEN - backing off');
}
```

---

### Step 4: Query Flutterwave with Retry Strategy

**Purpose:** Get authoritative transaction data with resilience

**Retry Configuration:**
- Max attempts: 3
- Backoff: 1s → 10s → 30s
- Jitter: ±10%

**Code:**
```typescript
verificationResult = await this.retryStrategy.executeWithRetry(
  'flutterwave-verify',
  async () => {
    return await this.flutterwaveService.verifyTransaction(
      order.flutterwave_id
    );
  },
);

// Record circuit breaker success/failure
this.circuitBreaker.recordSuccess('flutterwave-verify');
```

---

### Step 5: Validate Transaction Details

**Checks (ALL must pass):**

| Check | Expected | Why |
|-------|----------|-----|
| Status | "successful" | Transaction must be complete |
| Amount | Order total exactly | Prevent amount tampering |
| Currency | "RWF" | Prevent currency confusion |
| tx_ref | Match order.tx_ref | Prevent transaction swapping |

**Code:**
```typescript
const { valid, reason } = this.validateTransactionDetails(
  verificationResult,
  order
);

if (!valid) {
  // Mark order FAILED with reason
  order.payment_status = PaymentStatusEnum.FAILED;
  order.rejection_reason = reason;
  // Webhook replay? Amount tampered? Log and return
}
```

---

### Step 6: Create PaymentTransaction Record

**Purpose:** Audit trail of verification

**Fields:**
```typescript
PaymentTransaction.create({
  order_id: orderId,
  tenant_id: order.tenant_id,
  provider_ref: order.flutterwave_id,
  kind: TransactionKindEnum.CASHIN,
  amount: verificationResult.amount,
  currency: 'RWF',
  status: 'VERIFIED',  // Marked VERIFIED after API check
  metadata_json: {
    verification_time_ms: Date.now() - startTime,
    tx_ref: order.tx_ref,
    flutterwave_response: verificationResult,
  },
});
```

---

### Step 7: Create Merchant Payable and Credit Wallet

**Purpose:** Irrevocable wallet credit (only after verification)

**Compensation Logic:**
- If settlement succeeds: Order marked PAID, wallet credited
- If settlement fails: Order marked PAID (verified), wallet credit deferred, retry scheduled

**Code:**
```typescript
try {
  await this.settlementService.createMerchantPayable(
    orderId,
    order.tenant_id,
    paymentMethod
  );
} catch (settlementError: any) {
  // Compensation: Mark order PAID anyway
  order.payment_status = PaymentStatusEnum.PAID;
  // Settlement will retry via background job
}
```

**Why Compensation?**
- Flutterwave verification succeeded (money confirmed to arrive)
- Settlement service failure is temporary
- Better to mark order PAID and retry settlement
- Than to mark order FAILED and lose the payment

---

### Step 8: Mark Order as PAID

**Purpose:** Signal successful payment to order system

**Fields Updated:**
```typescript
order.payment_status = PaymentStatusEnum.PAID;
order.status = OrderStatusEnum.CONFIRMED;
order.save();
```

---

### Step 9: Record Health Metrics

**Purpose:** Power degradation level decisions

**Metrics Recorded:**
- Service: "flutterwave"
- Status: "UP" (after success)
- Response time: milliseconds (verification_time_ms)

**Uses:**
- Degradation service monitors metrics
- If response time > 5s (3+ times): Triggers DEGRADED
- If service DOWN (5+ consecutive failures): Triggers CRITICAL
- If multiple services down: Triggers OFFLINE

---

### Step 10: Audit Log Success

**Purpose:** Compliance and debugging

**Audit Entry:**
```json
{
  "action_type": "PAYMENT_VERIFIED",
  "reference_type": "order",
  "reference_id": "order-uuid",
  "metadata": {
    "flutterwave_id": "fw-123456",
    "amount": 50000,
    "verification_time_ms": 523,
    "flutterwave_response": { ... }
  }
}
```

---

### Step 11: Trigger Instant Payout

**Purpose:** Send money to tenant quickly (fire-and-forget)

**Non-Blocking:**
- Payout trigger happens in background
- Does not delay order confirmation
- If payout fails, background job retries

**Code:**
```typescript
try {
  await this.payoutService.triggerInstantPayout(orderId);
} catch (payoutError: any) {
  // Non-fatal - will retry by background job
}
```

---

## Integration Points

### 1. WebhookService → TransactionVerificationService

**WebhookService (Entry Point):**
```typescript
async processFlutterwaveWebhookEvent(event: any): Promise<void> {
  // Extract tx_ref from webhook
  const txRef = event.data.tx_ref;
  
  // Find order by tx_ref
  const order = await this.orderRepository.findOne({ where: { tx_ref } });
  
  if (!order) return;  // Order created soon
  
  if (order.payment_status === PaymentStatusEnum.PAID) {
    return;  // Already confirmed, idempotency
  }
  
  // CRITICAL: Never trust webhook alone
  try {
    await this.transactionVerificationService.verifyAndConfirmPayment(
      order.id
    );
  } catch (error: any) {
    // Order remains PENDING
    // Background verification job will retry
  }
}
```

**TransactionVerificationService (Verification Logic):**
```typescript
async verifyAndConfirmPayment(orderId: string): Promise<...> {
  // 1. Load order
  // 2. Check degradation
  // 3. Check circuit breaker
  // 4. Query Flutterwave (with retry)
  // 5. Validate details
  // 6. Create PaymentTransaction
  // 7. Settlement + wallet credit
  // 8. Mark order PAID
  // 9. Audit log
  // 10. Trigger payout
}
```

---

### 2. SettlementService → WalletService

**SettlementService (Initiated by Verification):**
```typescript
async createMerchantPayable(
  orderId: string,
  tenantId: string,
  paymentMethod: 'CASH' | 'MOBILE_MONEY'
): Promise<void> {
  // Calculate net payable (after platform fees)
  const { net_payable } = await this.calculateNetPayable(...);
  
  // Credit tenant wallet
  const { wallet } = await this.walletService.credit(
    tenantId,
    net_payable,
    LedgerSourceEnum.CASHIN,  // or MOBILE_MONEY_CASHIN
    orderId,
    `Payment for order ${orderId}`
  );
}
```

**WalletService (Irrevocable Credit):**
```typescript
async credit(
  tenantId: string,
  amount: number,
  source: LedgerSourceEnum,
  referenceId: string,
  description: string
): Promise<{ wallet: TenantWallet; entry: LedgerEntry }> {
  // Load wallet
  const wallet = await this.getOrCreateWallet(tenantId);
  
  // Create ledger entry (immutable audit trail)
  const entry = await this.ledgerRepository.save(
    this.ledgerRepository.create({
      tenant_id: tenantId,
      type: LedgerEntryTypeEnum.CREDIT,
      amount,
      source,
      reference_id: referenceId,
      description,
    })
  );
  
  // Update wallet available_balance
  wallet.available_balance += amount;
  await this.walletRepository.save(wallet);
  
  return { wallet, entry };
}
```

---

### 3. Error Recovery: Background Job

**PaymentVerificationJob (Runs every 5 minutes):**
```typescript
async verifyPendingPayments(): Promise<void> {
  // Find orders PENDING after 10+ minutes
  // (webhook may have been lost or webhook handler crashed)
  
  const pendingOrders = await this.orderRepository.find({
    where: {
      payment_status: PaymentStatusEnum.PENDING,
      flutterwave_id: NotNull(),
      created_at: cutoffTime,
    },
  });
  
  for (const order of pendingOrders) {
    try {
      // Attempt verification again
      await this.transactionVerificationService
        .verifyAndConfirmPayment(order.id);
      
      // If succeeded, wallet is now credited
      // If failed, order remains PENDING for next retry
    } catch (error) {
      // Log error, will retry next cycle
    }
  }
}
```

---

## Resilience Patterns Applied

### 1. Retry Strategy (Flutterwave Query)
- **Operation:** Flutterwave transaction verification API call
- **Max attempts:** 3
- **Backoff:** 1s → 10s → 30s with ±10% jitter
- **Use case:** Network timeout, Flutterwave temporary error
- **Cost:** ~45 seconds for complete failure

### 2. Circuit Breaker
- **Service:** `flutterwave-verify`
- **Failure threshold:** 5 consecutive failures
- **Timeout:** 60 seconds (auto-recovery attempt)
- **States:** CLOSED → OPEN → HALF_OPEN → CLOSED
- **Use case:** Prevent thundering herd if Flutterwave down

### 3. Graceful Degradation
- **Levels:** OFFLINE, CRITICAL, DEGRADED, NORMAL
- **Trigger:** Based on health metrics (response time, error rate)
- **Refund handling:** Block verification if OFFLINE
- **Use case:** Communicate system issues to customers

### 4. Health Monitoring
- **Metric:** Response time from Flutterwave query
- **Frequency:** Recorded after every verification
- **Decision:** Degradation service raises level if metrics degrade

---

## Data Consistency & Atomicity

### Verification Success Path

```
1. Flutterwave verified ✓
2. PaymentTransaction created ✓
       ↓ (if fails, order FAILED)
3. Settlement created + wallet credited ✓
       ↓ (if fails, order still PAID, retry scheduled)
4. Order marked PAID ✓
5. Audit logged ✓
6. Payout triggered ✓
       (if fails, non-blocking)
```

### Key Property

**If verification succeeded but settlement failed:**
- Order status: PAID (safe - verified with Flutterwave)
- Wallet: Deferred credit
- Action: Background job retries settlement
- Reason: Settlement is temporary issue, don't lose the payment

**If any validation failed:**
- Order status: FAILED
- Wallet: NOT credited
- Action: Manual review needed or automatic retry

---

## Testing Scenarios

### Scenario 1: Successful Payment Verification

```bash
1. Customer pays via Flutterwave
2. Webhook received: charge.completed
3. WebhookService.processFlutterwaveWebhookEvent()
4. TransactionVerificationService.verifyAndConfirmPayment()
   - Query Flutterwave API
   - Validate: status=successful, amount=50000, currency=RWF
   - Create PaymentTransaction
   - createMerchantPayable() (credits wallet)
   - Mark order PAID
5. Payout triggered
6. Audit logged

Result: Order PAID, wallet credited, tenant receives money
```

---

### Scenario 2: Webhook Replay Attack

```bash
1. First webhook processed successfully (order PAID)
2. Attacker replays same webhook (duplicate)
3. WebhookService checks: order.payment_status === PAID
   - Returns early (idempotency)
4. Transaction not verified twice

Result: Safe - no duplicate wallet credit
```

---

### Scenario 3: Flutterwave Down (Circuit Breaker)

```bash
1. First verification attempt: Flutterwave timeout
2. Record failure in circuit breaker
3. After 5 failures: Circuit breaker opens (OPEN state)
4. 6th attempt: Circuit breaker rejects (fail fast)
   - Order remains PENDING
   - Wallet NOT credited
5. Background job retries later
6. If Flutterwave recovers: Circuit half-open, test request succeeds, closed again

Result: Safe - no cascading failures, automatic recovery
```

---

### Scenario 4: Amount Tampering in Webhook

```bash
1. Webhook received with amount=500000 (actual: 50000)
2. TransactionVerificationService queries Flutterwave API
3. Flutterwave returns amount=50000 (source of truth)
4. Validation fails: 500000 ≠ 50000
5. Order marked FAILED

Result: Prevented - wallet not credited with wrong amount
```

---

### Scenario 5: Settlement Fails (Compensation)

```bash
1. Flutterwave verification succeeds
2. PaymentTransaction created
3. SettlementService.createMerchantPayable() fails
   - Exception thrown
4. Compensation logic:
   - Order still marked PAID
   - Wallet credit deferred
   - Error logged
5. Background job retries settlement next cycle
6. If retried settlement succeeds: Wallet credited

Result: Order not lost, settlement retried automatically
```

---

## Monitoring & Alerts

### Metrics to Watch

```
1. Verification Success Rate: Should be > 95%
   - Alert if < 90%
   
2. Average Verification Time: Should be < 2 seconds
   - Alert if > 5 seconds (3+ times)
   
3. Circuit Breaker State: Should be CLOSED
   - Alert if OPEN > 5 minutes
   
4. Retry Count: Average 1-1.5 per verification
   - Alert if > 2.5 (Flutterwave instability)
   
5. Settlement Failed But Paid: Should be < 1%
   - These trigger compensation logic
```

---

## Audit Trail Example

```json
{
  "timestamp": "2026-04-07T10:30:45Z",
  "action_type": "PAYMENT_VERIFIED",
  "reference_type": "order",
  "reference_id": "order-abc123",
  "admin_user_id": null,
  "metadata": {
    "order_id": "order-abc123",
    "total_amount": 50000,
    "flutterwave_id": "1234567890",
    "verification_time_ms": 523,
    "settlement_status": "COMPLETED",
    "wallet_credit_amount": 47500,
    "platform_fee": 2500,
    "payout_triggered": true,
    "flutterwave_response": {
      "id": "1234567890",
      "tx_ref": "DineFlow-1712503845-abc123xyz",
      "status": "successful",
      "amount": 50000,
      "currency": "RWF",
      "customer": { "email": "customer@example.com" }
    }
  }
}
```

---

## FAQ

**Q: What happens if webhook is lost?**
A: Background job (`PaymentVerificationJob`) runs every 5 minutes. It finds orders PENDING after 10 minutes with Flutterwave ID, then verifies them. Automatic recovery.

**Q: Can I verify a payment multiple times?**
A: Yes, but only the first verification matters. After order is PAID, subsequent verifications return early (idempotency). No duplicate wallet credits.

**Q: What if Flutterwave API is down?**
A: Retry strategy retries 3 times with exponential backoff. If all fail, circuit breaker opens (OPEN state). Order remains PENDING. Background job retries later when Flutterwave recovers.

**Q: Is wallet credit reversible?**
A: No. Once credited, ledger entry is immutable. If error later, use refund system (not reversal).

**Q: What if settlement fails but order is marked PAID?**
A: Compensation logic applies. Order is marked PAID (safe - Flutterwave verified), but wallet credit deferred. Background job retries settlement. This prevents losing verified payments.

**Q: How do I verify a specific order manually?**
A: Admin can call TransactionVerificationService.verifyAndConfirmPayment(orderId) directly. Useful for testing or manual recovery.

---

