# Rate Limiting & Throttling - Quick Reference

## Rate Limits at a Glance

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| POST `/payments/initiate-mobile-money` | 30 + 100 | 1h + 1m | Fraud prevention + rate limit |
| POST `/payments/confirm-cash` | 100 | 1 min | General rate limit |
| POST `/payments/webhook` | 1000 IP / 500 provider | 1h / 1m | DOS protection |
| POST `/refunds/request` | 5 | 1 hour | Spam prevention |

## Quick Test Commands

### Test Payment Endpoint Rate Limiting

```bash
# Get JWT token
TOKEN="your-jwt-token"
TENANT_ID="your-tenant-id"

# Make a payment request (should succeed)
curl -X POST http://localhost:3000/payments/initiate-mobile-money \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "123e4567-e89b-12d3-a456-426614174000",
    "customer_phone": "+256701234567"
  }' \
  -i

# Response headers show rate limit status
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1704067245

# Make 100 requests rapidly to hit limit
#!/bin/bash
for i in {1..101}; do
  echo "Request $i..."
  curl -X POST http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"123e4567-e89b-12d3-a456-426614174000","customer_phone":"+256701234567"}' \
    -s | jq -r '.statusCode // .id'
done

# After 100 requests:
# Response: 429 Too Many Requests
# Message: Too many payment requests. Please try again later.
# retryAfter: 45
```

### Test Fraud Prevention Throttling

```bash
# Make payment initiations (max 30 per hour)
for i in {1..31}; do
  echo "Initiation $i..."
  curl -X POST http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"order-'$i'","customer_phone":"+256701234567"}' \
    -s | jq -r '.statusCode // .id'
done

# After 30 requests, 31st fails:
# Response: 429 Too Many Requests
# Message: Too many payment initiation attempts. Try again in 1 hour.
```

### Test Webhook DOS Protection

```bash
# Simulate webhook from provider
PAYLOAD='{"provider":"MTN","transaction_id":"txn-123","status":"0","amount":5000,"phone":"+256701234567","signature":"sig123"}'

# Make requests from same IP (should work for 1000 per hour)
for i in {1..10}; do
  echo "Webhook $i..."
  curl -X POST http://localhost:3000/payments/webhook \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    -s | jq '.success'
done

# Check rate limit headers
curl -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -i | grep X-RateLimit

# Output:
# X-RateLimit-IP-Limit: 1000
# X-RateLimit-IP-Remaining: 990
# X-RateLimit-Provider-Limit: 500
# X-RateLimit-Provider-Remaining: 500
```

### Test Refund Rate Limiting

```bash
# Rate limit: 5 per hour per user
for i in {1..6}; do
  echo "Refund $i..."
  curl -X POST http://localhost:3000/refunds/request \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"order_id":"order-'$i'","reason":"CUSTOMER_REQUEST"}' \
    -s | jq '.ok // .statusCode'
done

# After 5 requests, 6th fails:
# Response: 429 Too Many Requests
```

## Integration Examples

### JavaScript/Node.js

```javascript
async function initiatePayment(token, tenantId, orderId, phone) {
  const maxRetries = 3;
  let retryAfter = 0;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (retryAfter > 0) {
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
    }

    const response = await fetch('http://localhost:3000/payments/initiate-mobile-money', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: orderId,
        customer_phone: phone
      })
    });

    // Check rate limit headers
    const rateLimit = {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: response.headers.get('X-RateLimit-Reset')
    };
    
    console.log(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`);

    if (response.status === 429) {
      const body = await response.json();
      retryAfter = body.retryAfter || 60;
      continue;
    }

    if (response.ok) {
      return await response.json();
    }

    throw new Error(`HTTP ${response.status}`);
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
await initiatePayment(token, tenantId, orderId, '+256701234567');
```

### Python

```python
import requests
import time
from datetime import datetime, timedelta

def initiate_payment_with_retry(token, tenant_id, order_id, phone):
    max_retries = 3
    url = 'http://localhost:3000/payments/initiate-mobile-money'
    
    for attempt in range(1, max_retries + 1):
        headers = {
            'Authorization': f'Bearer {token}',
            'X-Tenant-ID': tenant_id,
            'Content-Type': 'application/json'
        }
        
        data = {
            'order_id': order_id,
            'customer_phone': phone
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        # Check rate limit
        rate_limit = {
            'limit': response.headers.get('X-RateLimit-Limit'),
            'remaining': response.headers.get('X-RateLimit-Remaining'),
            'reset': response.headers.get('X-RateLimit-Reset')
        }
        
        print(f"Rate limit: {rate_limit['remaining']}/{rate_limit['limit']}")
        
        if response.status_code == 429:
            body = response.json()
            retry_after = body.get('retryAfter', 60)
            print(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            continue
        
        if response.ok:
            return response.json()
        
        raise Exception(f"HTTP {response.status_code}")
    
    raise Exception("Max retries exceeded")

# Usage
try:
    result = initiate_payment_with_retry(
        token, 
        tenant_id, 
        'order-123', 
        '+256701234567'
    )
    print("Payment initiated:", result)
except Exception as e:
    print("Error:", e)
```

### cURL with Retry

```bash
#!/bin/bash

TOKEN="your-jwt-token"
TENANT_ID="your-tenant-id"
MAX_RETRIES=3
RETRY_AFTER=0

for attempt in $(seq 1 $MAX_RETRIES); do
  if [ $RETRY_AFTER -gt 0 ]; then
    echo "Rate limited. Waiting $RETRY_AFTER seconds..."
    sleep $RETRY_AFTER
  fi

  response=$(curl -s -w "\n%{http_code}" -X POST \
    http://localhost:3000/payments/initiate-mobile-money \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "order_id": "order-123",
      "customer_phone": "+256701234567"
    }')

  # Split response and status code
  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" == "429" ]; then
    RETRY_AFTER=$(echo "$body" | jq '.retryAfter // 60')
    echo "Rate limited (attempt $attempt/$MAX_RETRIES)"
    continue
  fi

  if [ "$http_code" == "200" ]; then
    echo "Success:"
    echo "$body" | jq
    exit 0
  fi

  echo "Error: HTTP $http_code"
  exit 1
done

echo "Max retries exceeded"
exit 1
```

## Monitoring Dashboard

### Redis Rate Limit Keys

```bash
# Monitor in real-time
redis-cli MONITOR | grep ratelimit

# Get all rate limit keys
redis-cli KEYS "ratelimit:*"

# Check specific key
redis-cli ZRANGE ratelimit:payment:tenant:tenant-123 0 -1 WITHSCORES

# Get count for a limit
redis-cli ZCARD ratelimit:payment:tenant:tenant-123

# Clear specific rate limit
redis-cli DEL ratelimit:payment:tenant:tenant-123

# Clear all rate limits
redis-cli FLUSHDB
```

### Rate Limit Status Endpoint

Create monitoring endpoint:

```typescript
@Get('/health/rate-limits')
async getRateLimitHealth() {
  const status = await this.rateLimiter.getStatus(
    'payment:tenant:all', 100, 60
  );
  
  return {
    payment: status,
    status: status.status,
    percentage: `${status.percentage}%`,
    timestamp: new Date().toISOString()
  };
}
```

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.statusCode !== 429) throw error;
      
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Client-Side Queue

```typescript
class RateLimitedQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private nextRetry = 0;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      if (now < this.nextRetry) {
        await new Promise(r => 
          setTimeout(r, this.nextRetry - now)
        );
      }

      const fn = this.queue.shift();
      try {
        await fn!();
      } catch (error: any) {
        if (error.statusCode === 429) {
          this.nextRetry = Date.now() + (error.retryAfter || 60) * 1000;
          this.queue.unshift(fn!); // Re-queue
          await new Promise(r => 
            setTimeout(r, (error.retryAfter || 60) * 1000)
          );
        }
      }
    }

    this.processing = false;
  }
}
```

## Rate Limit Configuration

### Modify Limits

To change rate limits, edit the service methods:

**File**: `src/common/services/rate-limiter.service.ts`

```typescript
// Example: Change payment limit to 200 req/min
async checkPaymentLimit(tenantId: string) {
  const key = `payment:tenant:${tenantId}`;
  return this.checkLimit(key, 200, 60); // ← Change 100 to 200
}

// Example: Change fraud prevention to 50 attempts/hour
async checkPaymentInitiationLimit(tenantId: string) {
  const key = `payment:initiate:${tenantId}`;
  return this.checkLimit(key, 50, 3600); // ← Change 30 to 50
}
```

### Per-Merchant Tiers

```typescript
async checkPaymentLimitByTier(tenantId: string, tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE') {
  const limits = {
    BASIC: { limit: 100, window: 60 },
    PREMIUM: { limit: 500, window: 60 },
    ENTERPRISE: { limit: 5000, window: 60 }
  };
  
  const { limit, window } = limits[tier];
  const key = `payment:tenant:${tenantId}`;
  return this.checkLimit(key, limit, window);
}
```

## Common Responses

### Success (200 OK)

```json
{
  "id": "pay-123",
  "order_id": "ord-123",
  "status": "PENDING",
  "method": "MOBILE_MONEY"
}
```

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1704067245
```

### Rate Limited (429)

```json
{
  "statusCode": 429,
  "message": "Too many payment requests. Please try again later.",
  "retryAfter": 45
}
```

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067245
Retry-After: 45
```

### Not Authenticated (401)

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## Troubleshooting

### Issue: "REDIS_HOST not found"
**Solution**: Set environment variable
```bash
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
```

### Issue: All requests getting 429
**Solution**: Check Redis
```bash
redis-cli ping # Should return PONG
redis-cli FLUSHDB # Clear limits
```

### Issue: Rate limits not working
**Solution**: Verify guards are applied
- Check @UseGuards decorator on endpoint
- Verify guard is exported from CommonModule
- Check Redis connection logs

### Issue: High latency
**Solution**: Optimize Redis
```bash
redis-cli --latency
redis-cli DBSIZE # Check key count
```

## Performance Tips

1. **Cache Checks**: Cache rate limit results for 100ms
2. **Batch Operations**: Use `checkAll()` for multiple checks
3. **Monitor Redis**: Keep Redis connection healthy
4. **Use Pipelines**: Batch Redis commands
5. **Tune TTL**: Adjust key expiration as needed

## References

- **Implementation**: `src/common/services/rate-limiter.service.ts`
- **Guards**: `src/common/guards/rate-limit.guard.ts`
- **Decorators**: `src/common/decorators/rate-limit.decorator.ts`
- **Full Guide**: `RATE_LIMITING_IMPLEMENTATION.md`
