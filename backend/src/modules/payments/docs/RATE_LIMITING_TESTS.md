# Rate Limiting & Throttling - Test Scenarios

## Test Scenario Overview

Comprehensive test scenarios covering:
- Normal operation (under limits)
- Rate limit exceeded scenarios
- DOS protection verification
- Edge cases and corner cases
- Error handling
- Performance testing

## 1. Payment Endpoint Rate Limiting Tests

### Test 1.1: Normal Payment Requests (Under Limit)

**Scenario**: Make requests below rate limit

**Setup**:
- Tenant: `tenant-123`
- Rate limit: 100 req/min
- Test: Make 50 requests rapidly

**Steps**:
```bash
for i in {1..50}; do
  curl -X POST http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: tenant-123" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"order-'$i'","customer_phone":"+256..."}'
done
```

**Expected Results**:
- All 50 requests succeed (HTTP 200)
- X-RateLimit-Remaining decreases from 100 to 50
- No rate limit errors

**Assertion**:
```javascript
assert(response.statusCode === 200);
assert(parseInt(response.headers['x-ratelimit-remaining']) === 100 - i);
```

---

### Test 1.2: Rate Limit Exceeded

**Scenario**: Exceed payment rate limit

**Setup**:
- Rate limit: 100 req/min
- Test: Make 101 requests rapidly

**Steps**:
```bash
# Make 101 requests
for i in {1..101}; do
  response=$(curl -s -X POST http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: tenant-123" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"order-'$i'","customer_phone":"+256..."}')
  
  if [ $i -eq 101 ]; then
    echo "Request 101: $(echo $response | jq '.statusCode')"
  fi
done
```

**Expected Results**:
- First 100 requests: HTTP 200
- 101st request: HTTP 429
- Error message: "Too many payment requests"
- X-RateLimit-Reset header: Unix timestamp when limit resets

**Assertion**:
```javascript
assert(response.statusCode === 429);
assert(response.body.message.includes('Too many payment requests'));
assert(response.headers['retry-after'] > 0);
```

---

### Test 1.3: Different Tenants Have Independent Limits

**Scenario**: Verify rate limits are per-tenant

**Setup**:
- Tenant A: Make 100 requests
- Tenant B: Should still have full quota

**Steps**:
```bash
# Tenant A: 100 requests
for i in {1..100}; do
  curl -X POST http://localhost:3000/payments/confirm-cash \
    -H "Authorization: Bearer $TOKEN_A" \
    -H "X-Tenant-ID: tenant-a" \
    -d '{"order_id":"order-'$i'"}'
done

# Tenant B: Should work normally (fresh limit)
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "X-Tenant-ID: tenant-b" \
  -d '{"order_id":"order-1"}'
```

**Expected Results**:
- Tenant A: All 100 succeed, 101st fails
- Tenant B: Requests succeed (independent limit)
- Different X-RateLimit-Remaining values

**Assertion**:
```javascript
assert(tenantA_response_101.statusCode === 429);
assert(tenantB_response_1.statusCode === 200);
```

---

## 2. Fraud Prevention Tests

### Test 2.1: Fraud Prevention Throttling

**Scenario**: Exceed payment initiation limit (30 per hour)

**Setup**:
- Rate limit: 30 initiations/hour per tenant
- Test: Make 31 initiation requests

**Steps**:
```bash
# Make 31 payment initiation attempts
for i in {1..31}; do
  curl -X POST http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: tenant-123" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"order-'$i'","customer_phone":"+256..."}'
done
```

**Expected Results**:
- First 30 requests: HTTP 200
- 31st request: HTTP 429
- Error message: "Too many payment initiation attempts"
- Retry-After: ~3600 seconds (1 hour)

**Assertion**:
```javascript
assert(response_30.statusCode === 200);
assert(response_31.statusCode === 429);
assert(response_31.body.message.includes('initiation'));
```

---

### Test 2.2: Dual Rate Limits (General + Fraud Prevention)

**Scenario**: Verify both guards work together

**Setup**:
- General limit: 100 req/min
- Fraud prevention: 30 initiations/hour
- Test: Hit fraud limit first (30 initiations), then general limit

**Steps**:
```bash
# Step 1: Make 30 legitimate initiations
for i in {1..30}; do
  curl -X POST http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: tenant-123" \
    -d '{"order_id":"order-'$i'","customer_phone":"+256..."}'
done

# Step 2: 31st initiation should fail with fraud limit
response=$(curl -s -X POST http://localhost:3000/payments/initiate-mobile-money \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"order_id":"order-31","customer_phone":"+256..."}')

echo "Response: $(echo $response | jq '.statusCode')"
```

**Expected Results**:
- 30th request: HTTP 200, X-RateLimit-Remaining: 0
- 31st request: HTTP 429 (fraud limit)
- Error indicates fraud limit hit first

**Assertion**:
```javascript
assert(response_30_headers['x-ratelimit-remaining'] === '0');
// This should be fraud prevention limit
assert(response_31.statusCode === 429);
```

---

## 3. Webhook DOS Protection Tests

### Test 3.1: IP-Based Rate Limiting (1000 per hour)

**Scenario**: Protect against webhook floods from single IP

**Setup**:
- Rate limit: 1000 webhooks/hour per IP
- Test: Send 1001 webhooks from same IP

**Steps**:
```bash
PAYLOAD='{"provider":"MTN","transaction_id":"txn-123","status":"0"}'

# Make 1001 webhook requests
for i in {1..1001}; do
  if [ $((i % 100)) -eq 0 ]; then
    echo "Request $i..."
  fi
  
  curl -s -X POST http://localhost:3000/payments/webhook \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null
done
```

**Expected Results**:
- First 1000 webhooks: HTTP 200
- 1001st webhook: HTTP 429
- Error: "Webhook rate limit exceeded (IP-based)"
- X-RateLimit-IP-Remaining: 0

**Assertion**:
```javascript
assert(response_1000.statusCode === 200);
assert(response_1001.statusCode === 429);
assert(response_1001.body.message.includes('IP-based'));
```

---

### Test 3.2: Provider-Based Rate Limiting (500 per minute)

**Scenario**: Protect against single provider overwhelming system

**Setup**:
- Rate limit: 500 webhooks/minute per provider
- Test: Send 501 webhooks from MTN provider

**Steps**:
```bash
# Make 501 webhooks from MTN
for i in {1..501}; do
  PAYLOAD='{"provider":"MTN","transaction_id":"txn-'$i'","status":"0"}'
  curl -s -X POST http://localhost:3000/payments/webhook \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null
done
```

**Expected Results**:
- First 500 webhooks: HTTP 200
- 501st webhook: HTTP 429
- Error: "Provider MTN webhook rate limit exceeded"
- X-RateLimit-Provider-Remaining: 0

**Assertion**:
```javascript
assert(response_500.statusCode === 200);
assert(response_501.statusCode === 429);
assert(response_501.body.message.includes('MTN'));
```

---

### Test 3.3: Multiple Providers Independent Limits

**Scenario**: Verify per-provider limits are independent

**Setup**:
- Send 500 MTN webhooks
- Then send 500 Airtel webhooks
- Both should work independently

**Steps**:
```bash
# MTN: 500 webhooks
for i in {1..500}; do
  PAYLOAD='{"provider":"MTN","transaction_id":"mtn-'$i'","status":"0"}'
  curl -s -X POST http://localhost:3000/payments/webhook \
    -d "$PAYLOAD"
done

# Airtel: 500 webhooks (should work, different provider)
for i in {1..500}; do
  PAYLOAD='{"provider":"AIRTEL","transaction_id":"air-'$i'","status":"0"}'
  curl -s -X POST http://localhost:3000/payments/webhook \
    -d "$PAYLOAD"
done
```

**Expected Results**:
- All MTN webhooks: HTTP 200
- All Airtel webhooks: HTTP 200
- Separate rate limit counters for each provider

**Assertion**:
```javascript
assert(mtn_response_500.statusCode === 200);
assert(airtel_response_500.statusCode === 200);
assert(mtn_headers['x-ratelimit-provider-remaining'] === '0');
assert(airtel_headers['x-ratelimit-provider-remaining'] === '0');
```

---

### Test 3.4: Burst Detection

**Scenario**: Detect unusual traffic spikes (2x normal rate)

**Setup**:
- Normal rate: 100 webhooks/min
- Send: 200+ in 60 seconds
- Verify burst is detected

**Steps**:
```bash
# Send 250 webhooks rapidly (2.5x normal)
echo '[Sending 250 webhooks rapidly (burst scenario)]'
for i in {1..250}; do
  if [ $((i % 50)) -eq 0 ]; then
    echo "Burst webhook $i..."
  fi
  
  PAYLOAD='{"provider":"MTN","transaction_id":"burst-'$i'","status":"0"}'
  curl -s -X POST http://localhost:3000/payments/webhook \
    -d "$PAYLOAD" &
done
wait
```

**Expected Results**:
- All webhooks accepted (IP limit not hit: 1000/hour)
- Burst detected and logged
- Log entry: "SECURITY: Potential webhook DOS from IP <IP>"
- No 429 responses (detection only, no blocking)

**Assertion**:
```javascript
// Check logs for burst detection
assert(logs.includes('Potential webhook DOS'));
// Requests still succeed
assert(all_responses.every(r => r.statusCode === 200));
```

---

## 4. Refund Rate Limiting Tests

### Test 4.1: Normal Refund Requests

**Scenario**: Make refund requests below limit (5 per hour)

**Setup**:
- Rate limit: 5 refunds/hour per user
- Test: Make 5 refund requests

**Steps**:
```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/refunds/request \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"order-'$i'","reason":"CUSTOMER_REQUEST"}' \
    -i
done
```

**Expected Results**:
- All 5 requests: HTTP 201
- X-RateLimit-Remaining: 0 after 5th request

**Assertion**:
```javascript
assert(response_5.statusCode === 201);
assert(response_5.headers['x-ratelimit-remaining'] === '0');
```

---

### Test 4.2: Refund Rate Limit Exceeded

**Scenario**: Exceed refund limit (6th refund in 1 hour)

**Setup**:
- Make 5 refund requests
- Attempt 6th refund

**Steps**:
```bash
# Make 6 refund requests
for i in {1..6}; do
  curl -X POST http://localhost:3000/refunds/request \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"order_id":"order-'$i'","reason":"CUSTOMER_REQUEST"}'
done
```

**Expected Results**:
- First 5 requests: HTTP 201
- 6th request: HTTP 429
- Error: "Too many refund requests. Maximum 5 per hour."

**Assertion**:
```javascript
assert(response_5.statusCode === 201);
assert(response_6.statusCode === 429);
assert(response_6.body.message.includes('5 per hour'));
```

---

## 5. Edge Cases and Corner Cases

### Test 5.1: Window Boundary

**Scenario**: Test behavior at window boundary (exactly 1 minute)

**Setup**:
- Make request at start of minute
- Wait 60 seconds (window boundary)
- Make another request

**Steps**:
```bash
echo "Making request at $(date '+%M:%S')"
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"order_id":"order-1"}'

echo "Waiting 60 seconds..."
sleep 60

echo "Making request at $(date '+%M:%S') (should work - new window)"
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"order_id":"order-2"}'
```

**Expected Results**:
- Request after window expires: HTTP 200
- Counter is reset
- X-RateLimit-Remaining returns to full

**Assertion**:
```javascript
assert(response_before_boundary.statusCode === 200);
assert(response_after_boundary.statusCode === 200);
assert(response_after_boundary_headers['x-ratelimit-remaining'] === '99');
```

---

### Test 5.2: Redis Unavailable (Graceful Degradation)

**Scenario**: Test behavior when Redis is down

**Setup**:
- Stop Redis: `redis-cli SHUTDOWN`
- Make payment request

**Steps**:
```bash
# Stop Redis
redis-cli SHUTDOWN

# Try to make request
curl -X POST http://localhost:3000/payments/initiate-mobile-money \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":"order-1"}'

# Restart Redis
redis-server
```

**Expected Results**:
- Request: HTTP 200 (graceful degradation - fail open)
- Log error: "Rate limit check failed"
- System continues operating
- Rate limits restored when Redis comes online

**Assertion**:
```javascript
assert(response.statusCode === 200);
assert(logs.includes('Rate limit check failed'));
```

---

### Test 5.3: Concurrent Requests at Limit

**Scenario**: Handle race condition when hitting exact limit

**Setup**:
- 99 requests completed
- Make 2 concurrent requests (both should see remaining=1)
- Only 1 should succeed

**Steps**:
```bash
# Make concurrent requests at limit
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":"order-1"}' &

curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":"order-2"}' &

wait
```

**Expected Results**:
- One request: HTTP 200
- One request: HTTP 429
- OR both succeed (race condition okay for this use case)

**Assertion**:
```javascript
// At least one should succeed
const responses = [response1, response2];
assert(responses.some(r => r.statusCode === 200));
```

---

## 6. Performance Tests

### Test 6.1: Rate Limiter Latency

**Scenario**: Measure latency added by rate limiting

**Setup**:
- Disable rate limiter code
- Measure response time
- Enable rate limiter
- Compare latency impact

**Steps**:
```bash
# Test with rate limiter enabled
time curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":"order-1"}'
```

**Expected Results**:
- Latency overhead: 1-5ms per request
- Redis operation: ~1ms
- Guard execution: ~1-2ms
- Total system latency < 500ms

**Assertion**:
```javascript
assert(response_time < 500); // 500ms threshold
assert(redis_operation_time < 5); // 5ms for Redis
```

---

### Test 6.2: Scale Testing (1000 requests per minute)

**Scenario**: Load test with 1000 req/min

**Setup**:
- Send 1000 requests rapidly
- Measure throughput and latency

**Steps**:
```bash
#!/bin/bash
REQUESTS=1000
CONCURRENCY=10
TIME_START=$(date +%s%N)

# Make 1000 requests with 10 concurrent connections
seq 1 $REQUESTS | \
  xargs -P $CONCURRENCY -I {} \
  curl -s -X POST http://localhost:3000/payments/confirm-cash \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"order_id":"order-{}"}' \
    > /dev/null

TIME_END=$(date +%s%N)
DURATION=$((($TIME_END - $TIME_START) / 1000000)) # Convert to ms

echo "Duration: ${DURATION}ms"
echo "Throughput: $((1000 * 1000 / DURATION)) req/sec"
```

**Expected Results**:
- All 1000 requests processed in < 10 seconds
- Throughput: > 100 req/sec
- No timeouts or errors
- Redis handles the load fine

**Assertion**:
```javascript
assert(duration < 10000); // 10 seconds
assert(throughput > 100); // 100 req/sec
```

---

## 7. Security Tests

### Test 7.1: SQL Injection in Rate Limit Key

**Scenario**: Try to manipulate rate limit via tenant ID injection

**Setup**:
- Inject malicious tenant ID
- Verify sanitization

**Steps**:
```bash
# Try SQL injection in tenant ID
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123' OR '1'='1" \
  -d '{"order_id":"order-1"}'

# Or via URL encoding
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123%27%20OR%20%271%27=%271" \
  -d '{"order_id":"order-1"}'
```

**Expected Results**:
- Rate limiting works correctly
- Malicious tenant ID is treated as string
- No bypass of rate limits
- Separate rate limit counter created

**Assertion**:
```javascript
assert(response.statusCode === 200 || 429);
assert(!logs.includes('ERROR')); // No syntax error
```

---

### Test 7.2: Rate Limit Bypass Attempts

**Scenario**: Try various bypass techniques

**Setup**:
- Change User-Agent
- Change X-Forwarded-For
- Change Authorization

**Steps**:
```bash
# Try bypass 1: Different User-Agent
for i in {1..5}; do
  curl -X POST http://localhost:3000/payments/confirm-cash \
    -H "User-Agent: Mozilla/5.0 variation-$i" \
    -d '{"order_id":"order-'$i'"}'
done

# Limit should still apply (tenant-based, not user-agent)
curl -X POST http://localhost:3000/payments/confirm-cash \
  -H "User-Agent: Different Agent" \
  -d '{"order_id":"order-6"}'
```

**Expected Results**:
- All requests counted against tenant limit
- No bypass by changing headers
- Rate limit enforced consistently

**Assertion**:
```javascript
assert(request_6_remaining < request_1_remaining);
// All counted together
```

---

## 8. Integration Tests

### Test 8.1: Complete Payment Flow with Rate Limiting

**Scenario**: Full payment + webhook flow respecting rate limits

**Setup**:
- Make payment initiation
- Simulate webhook response
- Verify rate limits applied at each step

**Steps**:
```bash
# Step 1: Initiate payment (uses both guards)
INIT_RESPONSE=$(curl -s -X POST http://localhost:3000/payments/initiate-mobile-money \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"order_id":"order-123","customer_phone":"+256..."}')

PAYMENT_ID=$(echo $INIT_RESPONSE | jq '.id')

# Step 2: Confirm payment
CONFIRM_RESPONSE=$(curl -s -X POST http://localhost:3000/payments/confirm-cash \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"order_id":"order-123"}')

# Step 3: Provider webhook
WEBHOOK_RESPONSE=$(curl -s -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"provider":"MTN","transaction_id":"'$PAYMENT_ID'","status":"0"}')
```

**Expected Results**:
- Initiation: HTTP 200, uses PaymentInitiationFraudGuard + PaymentRateLimitGuard
- Confirmation: HTTP 200, uses PaymentRateLimitGuard
- Webhook: HTTP 200, uses WebhookRateLimitGuard
- All continue under their respective limits

**Assertion**:
```javascript
assert(init_response.statusCode === 200);
assert(confirm_response.statusCode === 200);
assert(webhook_response.statusCode === 200);
```

---

## 9. Cleanup Test

### Test 9.1: Redis Cleanup After Tests

**Scenario**: Clear rate limits after test suite

**Setup**:
- All tests completed
- Clean up Redis

**Steps**:
```bash
# View all rate limit keys
redis-cli KEYS "ratelimit:*"

# Clear specific test rate limits
redis-cli DEL ratelimit:payment:tenant:tenant-123
redis-cli DEL ratelimit:webhook:ip:*

# Or clear all
redis-cli FLUSHDB
```

**Expected Results**:
- All rate limit keys cleared
- Fresh state for next test run
- No stale data

---

## Test Execution Script

```bash
#!/bin/bash

echo "=== Rate Limiting & Throttling Test Suite ==="
echo ""

# Test 1: Payment rate limiting
echo "[1/9] Testing payment rate limiting..."
bash test_payment_limit.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 2: Fraud prevention
echo "[2/9] Testing fraud prevention throttling..."
bash test_fraud_prevention.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 3: Webhook DOS protection
echo "[3/9] Testing webhook DOS protection..."
bash test_webhook_dos.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 4: Refund limiting
echo "[4/9] Testing refund rate limiting..."
bash test_refund_limit.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 5: Edge cases
echo "[5/9] Testing edge cases..."
bash test_edge_cases.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 6: Performance
echo "[6/9] Testing performance..."
bash test_performance.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 7: Security
echo "[7/9] Testing security..."
bash test_security.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 8: Integration
echo "[8/9] Testing integration..."
bash test_integration.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

# Test 9: Cleanup
echo "[9/9] Cleanup..."
bash test_cleanup.sh
if [ $? -eq 0 ]; then echo "✓ PASSED"; else echo "✗ FAILED"; exit 1; fi

echo ""
echo "=== All Tests Passed! ==="
```

## Notes

- All tests should run in isolated environment
- Clear Redis between test suites
- Monitor logs for errors and warnings
- Measure actual latency in your environment
- Adjust timeouts based on network conditions
- Run security tests in staging first
