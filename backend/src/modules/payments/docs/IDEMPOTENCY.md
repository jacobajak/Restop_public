# Idempotency Management System

## Overview

The idempotency management system prevents duplicate payment transactions by tracking and caching API requests. When a client sends the same request twice (e.g., due to network timeouts or retries), the system returns the cached response instead of processing the payment again.

## How It Works

```
Request 1: POST /orders/123/pay
  ↓
IdempotencyMiddleware checks header
  ↓
First time? Create idempotency record (status=PROCESSING)
  ↓
Process payment in service
  ↓
Record success with cached response (status=SUCCESS)
  ↓
Return result to client

Request 2: POST /orders/123/pay (same Idempotency-Key)
  ↓
IdempotencyMiddleware checks header
  ↓
Key exists with status=SUCCESS?
  ↓
Return cached response immediately (no payment processing)
```

## Implementation Details

### Entities

**IdempotencyKey** (`idempotency-key.entity.ts`)
- Stores idempotency records with:
  - `idempotency_key`: Unique request identifier (UUID or alphanumeric)
  - `operation_type`: Type of operation (6 types supported)
  - `request_hash`: SHA-256 hash of request payload
  - `response_snapshot`: Cached response for successful operations
  - `status`: PROCESSING | SUCCESS | FAILED
  - `error_message`: Error details for failed operations
  - `expires_at`: Cleanup timestamp (24 hours by default)

**Operation Types**
```typescript
PAYMENT_INITIATION      // Mobile money payment start
PAYMENT_VERIFICATION    // Mark cash order as paid
REFUND_CREATION         // Create refund
SETTLEMENT_TRIGGER      // Create merchant settlement
WEBHOOK_PROCESSING      // Webhook event handling
PAYOUT_CREATION         // Merchant cashout
```

### Middleware

**IdempotencyMiddleware** (`middleware/idempotency.middleware.ts`)
- Extracts `Idempotency-Key` header from HTTP requests
- Determines operation type from request path
- Handles three scenarios:
  1. **First request**: Attach context to request, continue processing
  2. **Duplicate success**: Return 200 with cached response
  3. **Duplicate failure**: Return 422 with cached error
  4. **Still processing**: Return 409 Conflict (safe retry)

### Service

**IdempotencyService** (`services/idempotency.service.ts`)
- `checkIdempotency()`: Create or retrieve idempotency record
- `recordSuccess()`: Cache response after successful operation
- `recordFailure()`: Cache error after failed operation
- `cleanupExpiredKeys()`: Delete expired records (scheduled job)
- `getFailedOperations()`: Retrieve failed operations for admin review

### Integration

**PaymentService** (`services/payment.service.ts`)
```typescript
async startMobileMoneyPayment(
  orderId: string,
  customerPhone: string,
  customerEmail?: string,
  customerName?: string,
  idempotencyKey?: string,  // ← NEW: Optional idempotency tracking
): Promise<...>
```

**PaymentController** (`controllers/payment.controller.ts`)
```typescript
@Post('/orders/:orderId/pay')
async startPayment(
  @Param('orderId') orderId: string,
  @Body() body: { customer_phone?: string },
  @Headers('idempotency-key') idempotencyKey?: string,  // ← NEW: Extract from header
) {
  const result = await this.paymentService.startMobileMoneyPayment(
    orderId,
    customer_phone,
    undefined,
    undefined,
    idempotencyKey,  // ← NEW: Pass to service
  );
  return { ok: true, message: 'Payment initiated', data: result };
}
```

### Cleanup Job

**CleanupExpiredIdempotencyKeysJob** (`jobs/cleanup-expired-idempotency-keys.job.ts`)
- Runs daily at 2:00 AM UTC
- Deletes idempotency records where:
  - `expires_at < now`
  - `status = SUCCESS` (keeps FAILED records for audit trail)
- Prevents table bloat over time

## Usage

### Client Implementation

#### Using cURL
```bash
# Generate a UUID for idempotency key
IDEMPOTENCY_KEY=$(uuidgen)

# First request
curl -X POST http://localhost:3001/api/v1/orders/order-123/pay \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "customer_phone": "0788123456"
  }'

# Response (first time):
# {
#   "ok": true,
#   "message": "Payment initiated",
#   "data": {
#     "order": {...},
#     "flutterwaveId": "123456789",
#     "txRef": "DineFlow-1234567890-abcdef"
#   }
# }

# Duplicate request with same Idempotency-Key (e.g., client retry)
curl -X POST http://localhost:3001/api/v1/orders/order-123/pay \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "customer_phone": "0788123456"
  }'

# Response (duplicate):
# {
#   "ok": true,
#   "message": "Payment initiated",
#   "data": {
#     "order": {...},
#     "flutterwaveId": "123456789",
#     "txRef": "DineFlow-1234567890-abcdef"
#   }
# }
```

#### Using JavaScript/Fetch
```javascript
const idempotencyKey = crypto.randomUUID();
const orderId = 'order-123';

const response = await fetch(
  `http://localhost:3001/api/v1/orders/${orderId}/pay`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      customer_phone: '0788123456',
    }),
  }
);

const result = await response.json();
// First call: processes payment, returns result
// Retry with same key: returns cached result, no payment processing
```

#### Using TypeScript/Axios
```typescript
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const client = axios.create({
  baseURL: 'http://localhost:3001/api/v1',
});

async function initiatePayment(orderId: string, phone: string) {
  const idempotencyKey = uuidv4();

  try {
    const response = await client.post(
      `/orders/${orderId}/pay`,
      { customer_phone: phone },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Operation still processing, retry after delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      return initiatePayment(orderId, phone);
    }
    throw error;
  }
}
```

## API Reference

### Supported Endpoints

| Method | Endpoint | Operation Type |
|--------|----------|-----------------|
| POST | `/orders/{id}/pay` | PAYMENT_INITIATION |
| PATCH | `/orders/{id}/mark-paid` | PAYMENT_VERIFICATION |
| POST | `/refund` | REFUND_CREATION |
| POST | `/cashout` | PAYOUT_CREATION |
| POST | `/settlement` | SETTLEMENT_TRIGGER |
| POST | `/webhooks/flutterwave` | WEBHOOK_PROCESSING |

### Request Header

```
Idempotency-Key: <UUID or alphanumeric string (min 16 chars)>
```

**Examples:**
- UUID: `550e8400-e29b-41d4-a716-446655440000`
- Alphanumeric: `payment-request-20240115-001`

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Operation succeeded (first time or cached) |
| 400 | Invalid Idempotency-Key format |
| 409 | Operation still processing (retry after 5 seconds) |
| 422 | Operation previously failed with error (see `error` field) |

### Error Handling

**Still Processing (409)**
```json
{
  "ok": false,
  "error": "Operation in progress",
  "message": "An operation with this idempotency key is already being processed",
  "retryAfter": 5
}
```

**Previously Failed (422)**
```json
{
  "ok": false,
  "error": "Operation previously failed",
  "message": "Payment declined by Flutterwave",
  "cached": true
}
```

**Invalid Key (400)**
```json
{
  "error": "Invalid Idempotency-Key header. Must be a valid UUID or alphanumeric string."
}
```

## Common Scenarios

### Scenario 1: Network Timeout Retry

```
Time 1: Client sends payment request
  ↓ Network timeout
  ↓ Client doesn't receive response but payment processes
Time 2: Client retries with same Idempotency-Key
  ↓ System finds cached response
  ↓ Returns cached data without processing again
  ↓ Client receives result (duplicate prevention successful)
```

**Result**: Single charge, no double-payment risk ✅

### Scenario 2: Webhook Failure

```
Time 1: Payment initiated (Idempotency-Key: "req-123")
  ↓ Status updates to SUCCESS, response cached
Time 2: Webhook from Flutterwave lost due to network issue
  ↓ Client never receives notification
Time 3: Client retries payment with same key
  ↓ System returns cached response
  ↓ No new payment created
  ↓ Cleanup job handles old idempotency record after 24h
```

**Result**: Failed webhook doesn't cause duplicate charge ✅

### Scenario 3: Manual Retry

```
User clicks "Pay" button
  | (network slow, takes 6 seconds)
  | 
User clicks "Pay" again (impatient)
  ↓ Both requests use same Idempotency-Key
  ↓ First request processes, creates record
  ↓ Second request gets 409 "Still Processing"
  ↓ Client waits/retries
  ↓ First request completes, second gets cached response
```

**Result**: Clean, predictable retry behavior ✅

## Configuration

### Expiration Time

Default: 24 hours. Change in `IdempotencyService.getExpirationMs()`:

```typescript
private getExpirationMs(_operationType: OperationTypeEnum): number {
  // Customize per operation type if needed
  return 24 * 60 * 60 * 1000; // 24 hours
}
```

### Middleware Routes

Configure which endpoints require idempotency in `PaymentsModule.configure()`:

```typescript
consumer
  .apply(IdempotencyMiddleware)
  .forRoutes(
    { path: 'orders/*/pay', method: RequestMethod.POST },
    { path: 'orders/*/mark-paid', method: RequestMethod.PATCH },
    // Add more endpoints as needed
  );
```

### Cleanup Schedule

Default: Daily at 2:00 AM UTC. Change in `CleanupExpiredIdempotencyKeysJob`:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async cleanup() {
  // Change cron expression to adjust schedule
}
```

## Monitoring

### Database Queries

**Check pending operations:**
```sql
SELECT * FROM idempotency_key
WHERE status = 'PROCESSING'
AND created_at > NOW() - INTERVAL '30 minutes';
```

**Check failed operations:**
```sql
SELECT id, idempotency_key, error_message, created_at
FROM idempotency_key
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 50;
```

**Check table size:**
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing
FROM idempotency_key;
```

### Admin API

**Get failed operations:**
```bash
curl http://localhost:3001/api/v1/idempotency/failed?limit=50
```

**Manual cleanup trigger:**
```bash
curl -X POST http://localhost:3001/api/v1/admin/idempotency/cleanup
```

## Testing

Run tests:
```bash
npm test -- idempotency.spec.ts
npm test -- idempotency.e2e.ts
```

**Test Coverage:**
- ✅ Middleware: Valid/invalid keys, operation types, cached responses
- ✅ Service: Create, success, failure, cleanup, hash generation
- ✅ Integration: End-to-end payment with idempotency
- ✅ Scenarios: Network timeout, webhook failure, manual retry

## Performance Considerations

- **Request Overhead**: ~5-10ms per request (hash calculation + DB lookup)
- **Storage**: ~2KB per idempotency record; cleanup after 24h removes expired records
- **Concurrency**: Safe for parallel requests; middleware handles race conditions
- **Database**: Single unique index on `idempotency_key` column (fast lookups)

## Security Considerations

- **Key Validation**: Only accepts UUID v1/v4 or alphanumeric strings (16+ chars)
- **Payload Hash**: SHA-256 prevents same key with different payload (API misuse detection)
- **Audit Trail**: Failed operations kept for 24h+ for debugging/forensics
- **Error Details**: Cached error messages truncated to 1000 chars (prevents info disclosure)

## Troubleshooting

### Q: Getting 409 "Operation in progress" repeatedly
**A**: Operation likely failed or crashed. Check logs, manual cleanup of idempotency record may be needed.

### Q: Cached response doesn't match latest client request
**A**: Using same Idempotency-Key for different requests (API misuse). Generate new key per unique request.

### Q: Idempotency table growing too large
**A**: Cleanup job not running or failing. Verify:
1. ScheduleModule is configured in app module
2. Cron job is registered
3. Database cleanup permissions OK

### Q: Can't find old idempotency records
**A**: Records auto-delete after 24h. Query within 24h window or adjust `calculateExpiresAt()`.

## Future Enhancements

- [ ] Redis Cache: Cache successful responses in Redis for sub-10ms lookups
- [ ] Per-Tenant TTL: Different expiration for different customers
- [ ] Idempotency-Key-Lifetime: Client-specified TTL (RFC draft)
- [ ] Metrics: Track duplicate detection rates, cleanup efficiency
- [ ] Admin Dashboard: Visualize idempotency statistics
- [ ] Graceful Degradation: Fallback when idempotency service is down

## References

- [Best Practices for Building Idempotent APIs](https://www.rfc-editor.org/rfc/draft-idempotency-header-last.html) (RFC Draft)
- [NestJS Middleware Documentation](https://docs.nestjs.com/middleware)
- [TypeORM Documentation](https://typeorm.io/)
- [Payment System Architecture](../docs/PAYMENT_SYSTEM.md)
