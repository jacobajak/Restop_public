# Payment Module Resilience Patterns

## Overview

The Payment Module implements enterprise-grade resilience patterns to ensure reliable payment processing even when external services (Flutterwave, email, database) experience issues.

## Core Patterns

### 1. Retry Strategy

**Purpose:** Automatically retry failed operations with intelligent backoff.

**Configuration:** Operation-specific policies with defaults for:
- `PAYMENT_PROCESSING`: 3 attempts, 1s initial delay, 2x backoff
- `PAYMENT_STATUS_CHECK`: 5 attempts, 2s initial delay, 1.5x backoff
- `WEBHOOK_DELIVERY`: 5 attempts, 5s initial delay, 2x backoff
- `EMAIL_DELIVERY`: 3 attempts, 3s initial delay, 2x backoff

**Key Features:**
- Exponential backoff prevents overwhelming services
- Jitter (±10%) prevents thundering herd problem
- Configurable per operation type
- Detects non-retryable errors (validation, authorization)

**Usage:**
```typescript
// Basic usage
const result = await retryService.executeWithRetry(
  'PAYMENT_PROCESSING',
  () => flutterwaveService.charge(paymentData)
);

// With custom policy
const result = await retryService.executeWithRetry(
  'PAYMENT_PROCESSING',
  () => flutterwaveService.charge(paymentData),
  {
    customPolicy: {
      maxAttempts: 5,
      initialDelayMs: 2000
    }
  }
);

// With retry callback
const result = await retryService.executeWithRetry(
  'PAYMENT_PROCESSING',
  () => flutterwaveService.charge(paymentData),
  {
    onRetry: (context) => {
      logger.warn(`Retry attempt ${context.attempt}, next delay: ${context.nextRetryDelayMs}ms`);
      metrics.recordRetry(context.operationType);
    }
  }
);

// With custom retry logic
const result = await retryService.executeWithRetry(
  'EXTERNAL_API',
  () => externalService.call(),
  {
    shouldRetry: (error) => {
      // Custom logic: only retry timeouts, not validation errors
      return error.message.includes('TIMEOUT');
    }
  }
);
```

### 2. Circuit Breaker

**Purpose:** Prevent cascading failures by stopping requests to failing services.

**State Machine:**
```
         ↓─ failures < threshold ─→ CLOSED
    CLOSED ←────────────────────────→ OPEN
         ↑                              ↓
         │                topic timeout
         └─── HALF_OPEN ←───────────────┘
            ↑         ↓
       successes   failures
       ≥ threshold   (any)
            │         │
            └→ CLOSED  OPEN →┘
```

**States:**
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service failing, requests rejected immediately (fail fast)
- **HALF_OPEN**: Testing recovery, limited requests allowed

**Usage:**
```typescript
// Initialize circuit breaker
const breaker = circuitBreakerService;
breaker.initializeCircuitBreaker('FLUTTERWAVE');

// Check before attempting operation
if (breaker.canAttempt('FLUTTERWAVE')) {
  try {
    const result = await flutterwaveService.charge(paymentData);
    breaker.recordSuccess('FLUTTERWAVE'); // Success resets counter
    return result;
  } catch (error) {
    breaker.recordFailure('FLUTTERWAVE', error);
    throw error;
  }
} else {
  // Circuit is open, service unavailable
  throw new ServiceUnavailableException('Flutterwave temporarily unavailable');
}

// Manually open circuit (e.g., for maintenance)
breaker.openCircuit('FLUTTERWAVE');

// Manually close circuit
breaker.closeCircuit('FLUTTERWAVE');

// Get circuit state
const state = breaker.getState('FLUTTERWAVE'); // CLOSED, OPEN, HALF_OPEN
const metrics = breaker.getMetrics('FLUTTERWAVE'); // Detailed metrics
```

### 3. Health Monitoring

**Purpose:** Track health of external services in real-time.

**Services Monitored:**
- Flutterwave API
- Database connectivity
- Email service

**Usage:**
```typescript
// Health checks run automatically every 5 minutes
// Or manually trigger:
await healthService.performHealthChecks();

// Get service health
const flutterwaveHealth = healthService.getServiceHealth('flutterwave');
// Returns: {
//   name: 'Flutterwave API',
//   status: 'UP' | 'DEGRADED' | 'DOWN',
//   lastChecked: Date,
//   responseTimeMs: 234,
//   errorCount: 0
// }

// Get all service health
const allHealth = healthService.getAllServiceHealth();

// Check if critical services are healthy
if (healthService.areCriticalServicesHealthy()) {
  // OK to process payments
}

// Get health summary
const summary = healthService.getHealthSummary();
// {
//   timestamp: Date,
//   overall: 'UP' | 'DEGRADED' | 'DOWN',
//   services: {...},
//   allHealthy: boolean
// }

// Record specific service health
healthService.recordDatabaseHealth(true, 45);
healthService.recordEmailHealth(false, 'SMTP timeout');
```

### 4. Payment Recovery

**Purpose:** Automatically recover incomplete/stuck payments.

**Scenarios Handled:**
1. **Timeout during submission** → Check Flutterwave for reference
2. **Webhook not received** → Poll Flutterwave for status
3. **Database error** → Recover from webhook or query Flutterwave
4. **Rate limiting** → Queue for later retry

**Recovery Process:**
1. Payment fails or times out
2. Register for recovery: `recovery.registerIncompletePayment(paymentData)`
3. Background job runs every 5 minutes
4. Reconciles with Flutterwave
5. Updates local status if discrepancy found
6. Creates payment record if missing
7. Triggers notifications

**Usage:**
```typescript
// Register incomplete payment when it fails
try {
  const result = await flutterwaveService.charge(paymentData);
} catch (error) {
  recovery.registerIncompletePayment({
    userId: paymentData.userId,
    amount: paymentData.amount,
    currency: paymentData.currency,
    flutterwaveReference: error.transactionRef // if available
  });
  throw error;
}

// Manual recovery attempt
const result = await recovery.attemptPaymentRecovery(paymentId);
// Returns: { status: 'VERIFIED' | 'RESOLVED' | 'FAILED', message, actualStatus }

// Get incomplete payments
const incomplete = recovery.getIncompletePayments(userId);

// Get recovery metrics
const metrics = recovery.getRecoveryMetrics();
// {
//   totalIncomplete: 42,
//   byStatus: { PENDING: 12, TIMEOUT: 20, FAILED: 10 },
//   averageAttempts: 1.5,
//   oldestPaymentAge: 3600000
// }

// Manually resolve payment (after investigation)
recovery.resolvePayment(paymentId, true);
```

### 5. Graceful Degradation

**Purpose:** Maintain service quality by reducing capacity under load.

**Degradation Levels:**
```
NORMAL      → All features available, process all requests
             Retry: 3 attempts, 2x backoff, 5s timeout
             Rate limit: 100 payments/sec, 1000 emails/min

DEGRADED    → Some services struggling, skip non-critical
             Retry: 2 attempts, 1.5x backoff, 3s timeout
             Rate limit: 50 payments/sec, 100 emails/min
             Skip: Analytics

CRITICAL    → Essential services only, minimal processing
             Retry: 1 attempt, 1x backoff, 2s timeout
             Rate limit: 10 payments/sec, 0 emails/min
             Skip: Email, Webhooks, Analytics

OFFLINE     → Service unavailable, fail all except critical
             Rate limit: 0 operations
             Only process: Critical payments (queued)
```

**Triggers:**
- Database DOWN → Degradation Level CRITICAL
- Flutterwave DOWN → Degradation Level CRITICAL
- 2+ critical services DOWN → Degradation Level OFFLINE
- 2+ services DEGRADED → Degradation Level DEGRADED

**Usage:**
```typescript
// Auto-evaluation runs with health checks
await degradationService.evaluateDegradationLevel();

// Get current level
const level = degradationService.getCurrentLevel();
// NORMAL, DEGRADED, CRITICAL, or OFFLINE

// Get feature availability
const features = degradationService.getFeatureAvailability();
// {
//   paymentProcessing: true,
//   emailNotifications: true,
//   paymentReconciliation: true,
//   webhookDelivery: true,
//   analyticsTracking: true,
//   externalApis: true
// }

// Check specific feature
if (degradationService.isFeatureAvailable('emailNotifications')) {
  await emailService.send(notification);
} else {
  // Queue for later or skip
  await queueService.add('email', notification);
}

// Skip non-critical operations based on degradation
if (degradationService.shouldProcessRequest('analytics')) {
  recordAnalytics(event);
}

// Get recommended strategy
const strategy = degradationService.getCurrentStrategy();
// QUEUE_AND_RETRY, SKIP_OPTIONAL, CRITICAL_ONLY, or FAIL_FAST

// Get current rate limits
const limits = degradationService.getRateLimits();
// { paymentsPerSecond: 50, emailsPerMinute: 100, apiCallsPerSecond: 200 }

// Get status page data
const status = degradationService.getStatusPage();
// {
//   currentTime: Date,
//   degradationLevel: 'DEGRADED',
//   features: {...},
//   strategy: 'SKIP_OPTIONAL',
//   message: '⚠️  Some services experiencing issues...'
// }

// Manual override (for testing/maintenance)
degradationService.manuallySetLevel(DegradationLevel.CRITICAL);
degradationService.restore(); // Back to NORMAL
```

## Integration Pattern

### Typical Payment Processing Flow

```typescript
async processPayment(paymentData: CreatePaymentDto): Promise<Payment> {
  const { userId, amount, currency } = paymentData;

  // Step 1: Check degradation level
  if (!degradationService.shouldProcessRequest('payment')) {
    throw new ServiceUnavailableException(
      'Payment service temporarily unavailable'
    );
  }

  // Step 2: Check circuit breaker
  if (!circuitBreaker.canAttempt('PAYMENT_PROCESSING')) {
    throw new ServiceUnavailableException(
      'Payment processor temporarily unavailable'
    );
  }

  try {
    // Step 3: Process payment with retry
    const flutterwaveResult = await retryService.executeWithRetry(
      'PAYMENT_PROCESSING',
      () => this.flutterwaveService.charge({
        amount,
        email: user.email,
        ...paymentData
      }),
      {
        onRetry: (ctx) => {
          logger.warn(
            `Payment retry ${ctx.attempt}/${3}: ${ctx.lastError?.message}`
          );
        }
      }
    );

    // Step 4: Record success
    circuitBreaker.recordSuccess('PAYMENT_PROCESSING');
    healthService.recordSuccess('flutterwave');

    // Step 5: Create payment record
    const payment = await paymentRepository.create({
      userId,
      amount,
      currency,
      status: 'COMPLETED',
      reference: flutterwaveResult.transactionId,
      externalReference: flutterwaveResult.id
    });

    // Step 6: Send notification (if available)
    if (degradationService.isFeatureAvailable('emailNotifications')) {
      await emailService.sendPaymentSuccess(user, payment);
    } else {
      await queueService.add('email:payment:success', { user, payment });
    }

    return payment;

  } catch (error) {
    // Step 7: Handle failure
    circuitBreaker.recordFailure('PAYMENT_PROCESSING', error);
    healthService.recordFailure('flutterwave', error);

    // Step 8: Register for recovery
    if (error.transactionRef) {
      recovery.registerIncompletePayment({
        userId,
        amount,
        currency,
        flutterwaveReference: error.transactionRef,
        error: error.message
      });
    }

    throw new PaymentProcessingException(
      'Payment processing failed. Please try again or contact support.'
    );
  }
}
```

## Monitoring & Observability

### Key Metrics to Track

```typescript
// Circuit breaker metrics
- Circuit state transitions
- Failure rate before opening
- Time in each state
- Success rate in HALF_OPEN

// Retry metrics
- Retry attempts per operation type
- Success rate after retries
- Jitter effectiveness

// Recovery metrics
- Incomplete payments in queue
- Recovery success rate
- Average recovery time
- Payments resolved manually

// Degradation metrics
- Level transitions
- Feature availability changes
- Rate limiting effectiveness
- Strategy changes

// Health metrics
- Service health status
- Response time trends
- Error rates
- Combined system health score
```

### Logging

Each service logs important events:
- `✓ Success messages`: Service recovery, successful operations
- `⚠️  Warnings`: Retries, degradation triggers, threshold warnings
- `❌ Errors`: Failures, circuit breaker opens, recovery failures
- `📊 Metrics`: Health checks, degradation level changes

## Best Practices

1. **Always check circuit breaker before critical operations**
2. **Use retry service instead of manual retry logic**
3. **Register incomplete payments immediately on failure**
4. **Respect degradation level for non-critical features**
5. **Monitor health check results and alert on changes**
6. **Test recovery scenarios in staging**
7. **Implement circuit breaker observability (dashboards, alerts)**
8. **Set meaningful timeouts per operation type**
9. **Log correlation IDs for tracing failures**
10. **Implement graceful error messages for clients**

## Configuration

Services can be fine-tuned via environment variables:

```bash
# Circuit breaker
CIRCUIT_BREAKER_FLUTTERWAVE_THRESHOLD=5
CIRCUIT_BREAKER_FLUTTERWAVE_TIMEOUT_MS=30000

# Retry
RETRY_PAYMENT_MAX_ATTEMPTS=3
RETRY_PAYMENT_INITIAL_DELAY_MS=1000

# Health checks
HEALTH_CHECK_INTERVAL_MS=300000
HEALTH_CHECK_TIMEOUT_MS=5000

# Degradation
DEGRADATION_CHECK_INTERVAL_MS=60000
CRITICAL_SERVICES_HEALTH_REQUIRED=FLUTTERWAVE,DATABASE
```

## Emergency Procedures

### Service Degradation

If payment service is degraded:
1. Check health service status
2. Review circuit breaker states
3. Check Flutterwave status page
4. Monitor recovery queue size
5. Consider manual intervention if recovery stuck

### Circuit Breaker Stuck Open

If circuit stays open:
1. Verify external service is recovered
2. Check health check results
3. Manually close circuit via admin API
4. Monitor payment processing resumption

### Recovery Queue Overflow

If recovery queue growing:
1. Switch to CRITICAL degradation level
2. Increase recovery job frequency
3. Manually attempt reconciliation
4. Review Flutterwave logs for issues
5. Consider manual payment status update

## Testing Resilience

```typescript
// Test circuit breaker
circuitBreaker.initializeCircuitBreaker('TEST_SERVICE');
for (let i = 0; i < 5; i++) {
  circuitBreaker.recordFailure('TEST_SERVICE');
}
expect(circuitBreaker.getState('TEST_SERVICE')).toBe(CircuitState.OPEN);
expect(circuitBreaker.canAttempt('TEST_SERVICE')).toBe(false);

// Test retry exhaustion
await expect(
  retryService.executeWithRetry(
    'TEST_OP',
    () => { throw new Error('Always fails'); },
    { customPolicy: { maxAttempts: 2 } }
  )
).rejects.toThrow();

// Test degradation level changes
degradationService.manuallySetLevel(DegradationLevel.CRITICAL);
expect(degradationService.shouldProcessRequest('email')).toBe(false);
```
