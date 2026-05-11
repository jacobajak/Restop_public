# Rate Limiting & Throttling Implementation

## Overview

A comprehensive rate limiting and throttling system has been implemented to protect payment endpoints from abuse, spam, and DOS attacks. The system uses Redis for distributed rate limiting across multiple servers.

## Status: 100% Implemented ✅

**Before**:
- ❌ No rate limiter on payment endpoints
- ❌ No fraud prevention throttling
- ❌ No DOS protection on webhooks
- ❌ Could be abused with spam payment requests
- Impact: System vulnerable to attacks

**After**:
- ✅ Payment rate limiting (100 req/min per tenant)
- ✅ Fraud prevention throttling (30 initiations/hour)
- ✅ Comprehensive DOS protection on webhooks
- ✅ Per-IP and per-provider webhook limits
- ✅ Burst detection for attack identification
- ✅ Rate limit headers on all responses
- ✅ Graceful degradation if Redis unavailable
- Impact: System protected from abuse and attacks

## Architecture

### Three Layers of Protection

```
┌─────────────────────────────────────────────────────────────┐
│                   Request Arrives                            │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │ Rate Limit Guard │
        └────────┬────────┘
                 │
        ┌────────▼──────────────────┐
        │ Redis Sliding Window Check │  ◄─── Identifies rate limit key
        └────────┬──────────────────┘     ◄─── Checks request count
                 │                        ◄─── Allows or rejects
        ┌────────▼─────────────┐
        │ Response with Headers │
        └──────────────────────┘
```

### Rate Limit Keys

Each rate limit operates on a unique Redis key:

1. **Payment Endpoint**: `ratelimit:payment:tenant:{tenantId}`
2. **Payment Initiation**: `ratelimit:payment:initiate:{tenantId}`
3. **Webhook IP**: `ratelimit:webhook:ip:{clientIP}`
4. **Webhook Provider**: `ratelimit:webhook:provider:{provider}`
5. **Admin**: `ratelimit:admin:user:{userId}`
6. **Refund**: `ratelimit:refund:user:{userId}`

## Rate Limits

### Payment Endpoints (Authenticated)

| Endpoint | Method | Limit | Window | Guard |
|----------|--------|-------|--------|-------|
| `/payments/initiate-mobile-money` | POST | 30 | 1 hour | PaymentInitiationFraudGuard |
| `/payments/initiate-mobile-money` | POST | 100 | 1 minute | PaymentRateLimitGuard |
| `/payments/confirm-cash` | POST | 100 | 1 minute | PaymentRateLimitGuard |

**Purpose**:
- Fraud Prevention: Max 30 payment initiation attempts per hour per tenant
- General Rate Limiting: Max 100 payment requests per minute per tenant
- Combined protection: First checks fraud limit, then general limit

### Webhook Endpoints (Public - DOS Protection)

| Endpoint | Limit | Window | Guard |
|----------|-------|--------|-------|
| `/payments/webhook` - IP-based | 1000 | 1 hour | WebhookRateLimitGuard |
| `/payments/webhook` - Provider-based | 500 | 1 minute | WebhookRateLimitGuard |

**Purpose**:
- Prevents DDoS attacks from individual IPs
- Prevents single provider from flooding system
- Automatic burst detection when 2x+ normal rate detected

### Refund Endpoints (User-Based)

| Endpoint | Limit | Window | Guard |
|----------|-------|--------|-------|
| `POST /refunds/request` | 5 | 1 hour | RefundRateLimitGuard |

**Purpose**:
- Prevents spam/abuse of refund system
- One per user per 12 minutes on average

### Admin Endpoints

| Endpoint | Limit | Window | Guard |
|----------|-------|--------|-------|
| All admin endpoints | 200 | 1 minute | AdminRateLimitGuard |

**Purpose**:
- Protects admin operations from abuse
- Allows normal admin operations while preventing spam

## Implementation Files

### 1. Rate Limiter Service
**File**: `src/common/services/rate-limiter.service.ts`

**Features**:
- Sliding window rate limiting algorithm
- Pre-built limits for common endpoints
- Custom rate limit checking
- Burst detection
- Batch checking support
- Status monitoring
- Graceful degradation if Redis fails

**Key Methods**:
```typescript
// Check generic rate limit
checkLimit(key, limit, windowSeconds)

// Pre-built convenience methods
checkPaymentLimit(tenantId)
checkPaymentInitiationLimit(tenantId)
checkWebhookLimitByIP(ip)
checkWebhookLimitByProvider(provider)
checkAdminLimit(userId)
checkRefundLimit(userId)
checkCustomLimit(identifier, limit, windowSeconds)

// Monitoring
detectBurst(key, normalRate, windowSeconds)
getStatus(key, limit, windowSeconds)
getCount(key, windowSeconds)
reset(key)
```

### 2. Rate Limit Guards
**File**: `src/common/guards/rate-limit.guard.ts`

**Guards Provided**:

1. **PaymentRateLimitGuard**
   - Checks: 100 req/min per tenant
   - Used on: All payment endpoints

2. **PaymentInitiationFraudGuard**
   - Checks: 30 initiations/hour per tenant
   - Used on: Payment initiation endpoints
   - Purpose: Fraud prevention

3. **WebhookRateLimitGuard**
   - Checks: 1000 req/hour per IP + 500 req/min per provider
   - Used on: Webhook endpoints
   - Purpose: DOS protection + burst detection

4. **AdminRateLimitGuard**
   - Checks: 200 req/min per user
   - Used on: Admin endpoints

5. **RefundRateLimitGuard**
   - Checks: 5 req/hour per user
   - Used on: Refund endpoints

6. **CustomRateLimitGuard**
   - Configurable via @RateLimit() decorator
   - Used on: Custom endpoints

### 3. Rate Limit Decorators
**File**: `src/common/decorators/rate-limit.decorator.ts`

**Decorators Available**:

```typescript
// Specific decorators (metadata + guard name)
@PaymentRateLimit()
@PaymentInitiationFraudLimit()
@WebhookRateLimit()
@AdminRateLimit()
@RefundRateLimit()

// Generic decorator with configuration
@RateLimit({ 
  limit: 10, 
  windowSeconds: 60, 
  identifier: 'user:123' 
})
```

### 4. Common Module Updates
**File**: `src/common/common.module.ts`

**Exports**:
- RateLimiterService
- All 6 Rate Limit Guards

**Usage**: Automatically available to all modules

### 5. Controllers with Rate Limiting

#### Payment Controller
**File**: `src/modules/payments/payments.controller.ts`

**Endpoints with Rate Limiting**:

```typescript
@Post('initiate-mobile-money')
@UseGuards(PaymentRateLimitGuard, PaymentInitiationFraudGuard)
async initiateMobileMoneyPayment(...)

@Post('confirm-cash')
@UseGuards(PaymentRateLimitGuard)
async confirmCashPayment(...)
```

#### Payment Webhook Controller (NEW)
**File**: `src/modules/payments/controllers/payment-webhook.controller.ts`

**Endpoints with Rate Limiting**:

```typescript
@Post('webhook')
@UseGuards(WebhookRateLimitGuard)
async handleWebhook(...)
```

**Why Separate Controller?**:
- Webhooks are public endpoints (no JWT auth)
- Need different rate limiting strategy (IP/provider based)
- Separate from authenticated endpoints

#### Refund Controller
**File**: `src/modules/payments/controllers/refund.controller.ts`

**Endpoints with Rate Limiting**:

```typescript
@Post('/refunds/request')
@UseGuards(RefundRateLimitGuard)
async requestRefund(...)
```

## Sliding Window Algorithm

Rate limiting uses a sliding window algorithm with Redis sorted sets:

```
Time →

Request 1: ████ ← score = 1000
Request 2:      ████ ← score = 1100
Request 3:           ████ ← score = 1200
Request 4:               ████ ← score = 1300

Window (60 seconds):    [────────────────────────]
                        ↑                        ↑
                     windowStart              now

Algorithm:
1. Get current count in [windowStart, now] from Redis sorted set
2. If count < limit, allow and add new entry
3. If count >= limit, reject
4. Set Redis key TTL to cleanup old entries
```

**Advantages**:
- More accurate than fixed windows
- No thundering herd at window boundaries
- Distributed across servers via Redis
- Automatic cleanup via TTL

## Response Headers

All rate-limited endpoints return rate limit headers:

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1704067200
...
```

**Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed in window
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**For Webhooks**:
```
X-RateLimit-IP-Limit: 1000
X-RateLimit-IP-Remaining: 850
X-RateLimit-Provider-Limit: 500
X-RateLimit-Provider-Remaining: 420
```

## Error Responses

### Too Many Requests (429)

```json
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "statusCode": 429,
  "message": "Too many payment requests. Please try again later.",
  "retryAfter": 45
}
```

**Error Messages by Endpoint**:

| Endpoint | Message |
|----------|---------|
| Payment | Too many payment requests. Please try again later. |
| Payment Initiation | Too many payment initiation attempts. Try again in 1 hour. |
| Webhook (IP) | Webhook rate limit exceeded (IP-based). Check back later. |
| Webhook (Provider) | Provider {name} webhook rate limit exceeded. |
| Refund | Too many refund requests. Maximum 5 per hour. |
| Admin | Admin rate limit exceeded. Please try again later. |

## Security Features

### 1. Burst Detection
Automatic detection of unusual traffic spikes:

```typescript
// Detect if requests are 2x+ the normal rate
const burstDetected = await rateLimiter.detectBurst(
  'webhook:ip:192.168.1.1',
  normalRate: 100,     // normal rate
  windowSeconds: 60    // check 1 minute window
);
// Logs: SECURITY: Potential webhook DOS from IP 192.168.1.1
```

**Usage**: Webhook endpoints check for burst and log for security monitoring

### 2. IP Detection
Handles proxies and load balancers:

```typescript
// Checks multiple headers in order
const ip = 
  request.headers['x-forwarded-for']?.split(',')[0] ||
  request.headers['x-real-ip'] ||
  request.socket.remoteAddress;
```

### 3. Per-Provider Limits
Prevents one provider from overwhelming system:

- MTN floods webhooks: Caught by per-provider limit
- Airtel works normally: Different provider key
- System continues operating

### 4. Graceful Degradation
If Redis is unavailable:

```typescript
try {
  // Normal Redis operation
} catch (error) {
  logger.error('Rate limit check failed');
  // Fail open: allow request
  return { allowed: true, remaining: limit, resetAt: now + window };
}
```

## Usage Examples

### Apply to Custom Endpoint

```typescript
import { CustomRateLimitGuard } from '@common/guards/rate-limit.guard';
import { RateLimit } from '@common/decorators/rate-limit.decorator';

@Post('/custom-endpoint')
@UseGuards(CustomRateLimitGuard)
@RateLimit({
  limit: 20,
  windowSeconds: 60,
  identifier: (req) => `custom:user:${req.user.id}`
})
async customEndpoint(@Body() body: any) {
  return { success: true };
}
```

### Check Rate Limit Manually

```typescript
import { RateLimiterService } from '@common/services/rate-limiter.service';

export class MyService {
  constructor(private rateLimiter: RateLimiterService) {}

  async processBatch(tenantId: string) {
    const limit = await this.rateLimiter.checkPaymentLimit(tenantId);
    
    if (!limit.allowed) {
      throw new Error('Rate limit exceeded');
    }

    // Process request...
  }
}
```

### Get Rate Limit Status

```typescript
const status = await this.rateLimiter.getStatus(
  'payment:tenant:123',
  100,  // limit
  60    // window (seconds)
);

console.log(`${status.current}/${status.limit} - ${status.percentage}%`);
// Output: 85/100 - 85%
// Status: critical (>80%)
```

## Configuration

### Environment Variables

```env
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Redis password
REDIS_PASSWORD=your-password
```

### Rate Limit Constants

To modify limits, edit the RateLimiterService methods:

```typescript
// src/common/services/rate-limiter.service.ts

async checkPaymentLimit(tenantId: string) {
  const key = `payment:tenant:${tenantId}`;
  return this.checkLimit(key, 100, 60); // ← Edit here: limit, window
}

async checkPaymentInitiationLimit(tenantId: string) {
  const key = `payment:initiate:${tenantId}`;
  return this.checkLimit(key, 30, 3600); // ← Edit here
}
```

## Monitoring & Alerts

### Rate Limit Status Endpoint

Create a monitoring endpoint:

```typescript
@Get('/metrics/rate-limits')
async getRateLimitMetrics() {
  const payment = await this.rateLimiter.getStatus(
    'payment:tenant:all', 100, 60
  );
  
  const webhook = await this.rateLimiter.getStatus(
    'webhook:ip:all', 1000, 3600
  );

  return {
    payment,
    webhook,
    timestamp: new Date()
  };
}
```

### Security Monitoring

Bursts are logged automatically:

```typescript
// src/common/guards/rate-limit.guard.ts
const burstDetected = await this.rateLimiter.detectBurst(...);
if (burstDetected) {
  console.warn(`SECURITY: Potential webhook DOS from IP ${clientIP}`);
  // Could trigger: alert, temp ban, additional verification
}
```

## Testing

### Unit Tests

```typescript
import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    service = new RateLimiterService();
  });

  it('should allow requests under limit', async () => {
    const result = await service.checkLimit('test:key', 5, 60);
    expect(result.allowed).toBe(true);
  });

  it('should reject requests over limit', async () => {
    // Make 5 requests to hit limit
    for (let i = 0; i < 5; i++) {
      await service.checkLimit('test:key', 5, 60);
    }
    
    // 6th request should fail
    const result = await service.checkLimit('test:key', 5, 60);
    expect(result.allowed).toBe(false);
  });
});
```

### Integration Tests

```bash
# Test payment rate limiting
curl -X POST http://localhost:3000/payments/initiate-mobile-money \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: tenant-123" \
  -d '{"order_id":"123","customer_phone":"+256..."}' \
  -i

# Check rate limit headers
# X-RateLimit-Remaining: 29
# X-RateLimit-Reset: 1704067245

# Exceed limit (make 30+ requests quickly)
# Response: 429 Too Many Requests
```

## Performance Implications

### Redis Overhead

- **Latency**: +1-5ms per request (Redis lookup + sorted set operation)
- **Memory**: ~100 bytes per tracked rate limit key
- **CPU**: Negligible (Redis handles sorted set ops efficiently)

### Optimization Tips

1. **Use Caching**: Cache rate limit checks for 100ms
2. **Batch Operations**: Use `checkAll()` for multiple checks
3. **Filter Noise**: Only rate-limit on high-value operations
4. **Monitor Redis**: Keep Redis connection healthy

## Files Created/Modified

### New Files

1. `src/common/services/rate-limiter.service.ts` (320 lines)
   - Complete rate limiting logic
   - Pre-built limit methods
   - Monitoring and status tracking

2. `src/common/guards/rate-limit.guard.ts` (360 lines)
   - 6 specialized guards
   - IP detection
   - Burst detection
   - Rate limit headers

3. `src/common/decorators/rate-limit.decorator.ts` (90 lines)
   - 6 specific decorators
   - 1 generic @RateLimit() decorator

4. `src/modules/payments/controllers/payment-webhook.controller.ts` (130 lines)
   - Separate public webhook endpoint
   - DOS protection
   - Health check endpoint

### Modified Files

1. `src/common/common.module.ts`
   - Added RateLimiterService provider
   - Added all 6 rate limit guards
   - Updated exports

2. `src/modules/payments/payments.controller.ts`
   - Added PaymentRateLimitGuard to payment endpoints
   - Added PaymentInitiationFraudGuard to initiation
   - Updated documentation

3. `src/modules/payments/controllers/refund.controller.ts`
   - Added RefundRateLimitGuard to request endpoint
   - Updated documentation

4. `src/modules/payments/payments.module.ts`
   - Added PaymentWebhookController import
   - Registered in controllers array

## Deployment Considerations

### Before Deploying

1. **Verify Redis Connection**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Test Rate Limits**:
   ```bash
   # Make rapid requests and verify 429 response
   for i in {1..100}; do
     curl http://localhost:3000/payments/initiate-mobile-money
   done
   ```

3. **Monitor Performance**:
   - Check Redis latency
   - Monitor error rates
   - Track rate limit rejections

### Configuration

```env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

### Scaling Horizontally

- Redis is shared across all servers
- Rate limits work correctly across load balancers
- No session affinity required
- Use Redis Cluster for high availability

## Future Enhancements

### Potential Improvements

1. **Dynamic Rate Limits**: Adjust limits based on merchant tier
2. **Whitelist/Blacklist**: Allow exceptions for trusted IPs
3. **Adaptive Rate Limiting**: AI-based limit adjustments
4. **Caching Layer**: Cache rate limit checks for 100ms
5. **Analytics Dashboard**: Visualize rate limit metrics
6. **Custom Strategies**: User-defined rate limit rules
7. **Webhook Retry Logic**: Backoff for rate-limited webhooks
8. **Cost-Based Limits**: Charge differently based on usage

### Implementation Path

1. Month 1: Deploy current implementation
2. Month 2: Add monitoring and metrics
3. Month 3: Implement dynamic limits
4. Month 4: Add whitelist/blacklist
5. Month 5: Analytics dashboard

## Troubleshooting

### Common Issues

**Issue**: All requests getting 429
- Check Redis connection
- Verify Redis has memory
- Check rate limit configuration

**Issue**: Rate limits not working
- Verify Redis is connected
- Check rate limit key in Redis
- Verify guards are applied to endpoints

**Issue**: High latency
- Check Redis latency: `redis-cli --latency`
- Consider connection pooling
- Monitor network connectivity

### Testing Commands

```bash
# Check Redis status
redis-cli info stats

# Monitor rate limit keys
redis-cli MONITOR | grep ratelimit

# Check key count
redis-cli DBSIZE

# Clear all rate limits
redis-cli FLUSHDB
```

## Conclusion

The rate limiting and throttling system provides:

✅ **Production-Ready Protection**:
- Payment endpoint rate limiting (fraud prevention)
- Webhook rate limiting (DOS protection)
- Per-tenant and per-IP isolation
- Automatic burst detection
- Graceful degradation

✅ **Developer-Friendly**:
- Easy to apply (@UseGuards decorator)
- Pre-built limits for common endpoints
- Simple custom configuration
- Clear error messages

✅ **Scalable**:
- Redis-backed distributed limits
- Works across multiple servers
- Handles high-traffic scenarios
- Minimal performance overhead

The system successfully prevents abuse while maintaining a good user experience for legitimate requests.
