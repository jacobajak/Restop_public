# RESTOP API Documentation Hub

**Base URL:** `https://api.restop.com` or `/api/v1` for core endpoints, `/admin` for admin  
**API Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** January 15, 2024

---

## Quick Navigation

### 📚 Documentation Modules

1. **[Core API Endpoints](API_CORE_ENDPOINTS.md)** – Orders, Payments, Tenants (Restaurants)
2. **[Admin API Endpoints](API_ADMIN_ENDPOINTS.md)** – Platform administration, analytics, fraud detection
3. **API Reference** – Complete endpoint specifications with examples
4. **Authentication Guide** – JWT, OAuth2, API keys
5. **Webhooks** – Event subscriptions and integrations

---

## API Overview

RESTOP provides three main API modules:

### 1. Core APIs (`/api/v1`)
Customer-facing and restaurant business operations

| Module | Base Route | Purpose |
|--------|-----------|---------|
| **Orders** | `/api/v1/orders` | Order creation, status management, lifecycle |
| **Payments** | `/api/v1/payments` | Payment processing, mobile money, cash handling |
| **Tenants** | `/api/v1/tenants` | Restaurant management, profiles, settings |

👉 **[See Core API Documentation](API_CORE_ENDPOINTS.md)**

### 2. Admin APIs (`/admin`)
Platform management and oversight

| Module | Base Route | Purpose | Status |
|--------|-----------|---------|--------|
| **Overview** | `/admin/overview` | Dashboard, metrics, KPIs | ✅ Active |
| **Orders** | `/admin/orders` | View & manage all orders | ✅ Active |
| **Restaurants** | `/admin/restaurants` | Restaurant management, verification | ✅ Active |
| **Support** | `/admin/support` | Support ticket management | ✅ Active |
| **Settlements** | `/admin/settlements` | Payout monitoring, retry logic | ✅ Active |
| **Verification** | `/admin/verification` | Payment account verification queue | ✅ Active |
| **Audit Logs** | `/admin/audit-logs` | Action audit trail | ✅ Active |
| **Health** | `/admin/health` | System health monitoring | ✅ Active |
| **Payments** | `/admin/payments` | Payment management | ⏳ Phase 3+ |
| **Refunds** | `/admin/refunds` | Refund processing | ⏳ Phase 3+ |
| **Fraud** | `/admin/fraud` | Fraud detection & moderation | ⏳ Phase 3+ |

👉 **[See Admin API Documentation](API_ADMIN_ENDPOINTS.md)**

---

## Quick Start

### 1. Authenticate

Get a JWT token by signing up as a restaurant or admin:

```bash
# Restaurant Signup
POST /api/v1/tenants
{
  "name": "My Restaurant",
  "email": "owner@restaurant.com",
  "password": "secure_password",
  "currency": "USD",
  "country_code": "US"
}
```

### 2. Create an Order

```bash
# Create Order (Public - no auth needed)
POST /api/v1/orders
{
  "tenant_id": "restaurant-uuid",
  "items": [
    {
      "menu_item_id": "item-uuid",
      "quantity": 2
    }
  ],
  "payment_method": "MOBILE_MONEY"
}
```

### 3. Process Payment

```bash
# Initiate Mobile Money Payment (Requires JWT)
POST /api/v1/payments/initiate-mobile-money
Authorization: Bearer {jwt_token}
{
  "order_id": "order-uuid",
  "customer_phone": "+256701234567"
}
```

### 4. Manage Restaurant

```bash
# Get Restaurant Profile (Requires JWT + Tenant role)
GET /api/v1/tenants/me/profile
Authorization: Bearer {jwt_token}
```

---

## Authentication

### Types Supported

1. **JWT (JSON Web Tokens)** – Primary authentication for all protected endpoints
2. **Public Endpoints** – No authentication required (e.g., restaurant signup, order creation)
3. **Admin Token** – Special JWT with `PLATFORM_ADMIN` role for admin endpoints

### JWT Header Format

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Required for Protected Endpoints

All protected endpoints require:
- Valid JWT token in Authorization header
- Token must include required `role` (TENANT_OWNER, TENANT_MANAGER, PLATFORM_ADMIN)
- Token must not be expired

---

## API Response Format

### Success Response

```json
{
  "data": {
    "id": "uuid",
    "name": "Example",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "statusCode": 200,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": "BadRequest",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/orders"
}
```

### Pagination Response

```json
{
  "data": [ {...}, {...} ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "pages": 25
  }
}
```

---

## Status Codes

| Code | Category | Meaning |
|------|----------|---------|
| `200` | Success | Request succeeded |
| `201` | Success | Resource created |
| `204` | Success | No content (empty response) |
| `400` | Client Error | Bad request, invalid parameters |
| `401` | Client Error | Unauthorized (missing/invalid token) |
| `403` | Client Error | Forbidden (insufficient permissions) |
| `404` | Client Error | Not found |
| `409` | Client Error | Conflict (business logic violation) |
| `429` | Client Error | Too many requests (rate limited) |
| `500` | Server Error | Internal server error |
| `503` | Server Error | Service unavailable |

---

## Common Patterns

### Filtering

Most list endpoints support filtering:

```bash
GET /api/v1/orders?status=COMPLETED&limit=20&offset=0
GET /admin/restaurants?country=US&status=ACTIVE
```

### Sorting

Sort parameter format: `field` or `-field` (descending):

```bash
GET /admin/orders?sort=-created_at  # Most recent first
GET /api/v1/orders?sort=total       # Lowest total first
```

### Pagination

Use `page` and `limit` for pagination:

```bash
GET /admin/orders?page=2&limit=50
```

Or use `limit` and `offset`:

```bash
GET /api/v1/orders?limit=20&offset=20  # Second page
```

### Bulk Operations

Some endpoints support bulk operations:

```bash
POST /admin/refunds/bulk-process
{
  "refund_ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

## Rate Limiting

APIs are rate-limited to ensure fair usage:

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705329600
```

**Limits:**
- Write endpoints: 50 requests/minute per user
- Read endpoints: 100 requests/minute per user
- Mobile money initiation: 30 per hour per phone number

**When Limit Exceeded:**
```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## Error Handling Best Practices

### 1. Always Check Status Codes

```javascript
if (response.status === 400) {
  // Validation error - retry won't help
  console.error(response.data.errors);
}

if (response.status === 429) {
  // Rate limited - wait before retry
  const retryAfter = response.headers['retry-after'];
  setTimeout(retry, retryAfter * 1000);
}

if (response.status === 503) {
  // Service down - exponential backoff
  exponentialBackoff(retry);
}
```

### 2. Handle Asynchronous Operations

Some operations (payments, settlements) are asynchronous:

```bash
# Initiates payment processing
POST /api/v1/payments/initiate-mobile-money
# Returns immediately with status: INITIATED

# Poll for completion
GET /api/v1/payments/{id}
# Check status: INITIATED > PROCESSING > COMPLETED
```

### 3. Idempotency

For critical operations, include Idempotency-Key:

```bash
POST /api/v1/orders
Idempotency-Key: unique-order-request-id-12345
```

---

## Webhooks & Events

Subscribe to platform events for real-time updates:

### Supported Events

- `order.created` – New order placed
- `order.confirmed` – Order confirmed by restaurant
- `order.completed` – Order delivered/completed
- `payment.completed` – Payment successfully processed
- `payment.failed` – Payment processing failed
- `settlement.processed` – Money disbursed to restaurant
- `settlement.failed` – Settlement payout failed

### Webhook Signature Verification

All webhook requests include a signature header:

```
X-RESTOP-Signature: sha256=...
```

Verify with your webhook secret to ensure authenticity.

---

## SDK & Client Libraries

Official client libraries available for:

- **JavaScript/TypeScript** – `@restop/sdk`
- **Python** – `restop-sdk`
- **Java** – `com.restop:sdk`
- **Go** – `github.com/restop/go-sdk`
- **PHP** – `restop/sdk`

---

## Rate Limit Tiers

### Tier 1: Free Development
- 100 requests/minute
- 1000 requests/day
- Mobile money: 10 initiations/hour

### Tier 2: Production
- 1000 requests/minute
- Unlimited daily
- Mobile money: 100 initiations/hour

### Tier 3: Enterprise
- Custom limits
- Dedicated support
- Custom integration support

---

## Environments

### Development
```
Base URL: http://localhost:3000/api/v1
Admin URL: http://localhost:3000/admin
```

### Staging
```
Base URL: https://staging-api.restop.com/api/v1
Admin URL: https://staging-api.restop.com/admin
```

### Production
```
Base URL: https://api.restop.com/api/v1
Admin URL: https://api.restop.com/admin
```

---

## Testing

### Using cURL

```bash
# Create Order
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "uuid",
    "items": [{
      "menu_item_id": "item-uuid",
      "quantity": 2
    }]
  }'

# Get Order
curl -X GET http://localhost:3000/api/v1/orders/order-uuid
```

### Using Postman

1. Import the API collection from `/docs/postman_collection.json`
2. Set environment variables for base URL, auth tokens
3. Run tests against development endpoints

### Using a Client Library

```javascript
import { ResotpClient } from '@restop/sdk';

const client = new RestopClient({ token: 'jwt_token' });

// Create order
const order = await client.orders.create({
  tenant_id: 'restaurant-uuid',
  items: [{ menu_item_id: 'item-uuid', quantity: 2 }]
});

// Get orders
const orders = await client.orders.list({ status: 'COMPLETED' });
```

---

## Support & Contact

- **Email:** api-support@restop.com
- **Slack:** #api-support channel in Restop workspace
- **Documentation:** https://docs.restop.com
- **Status Page:** https://status.restop.com
- **GitHub Issues:** https://github.com/restop/api/issues

---

## Changelog

### Version 1.0 (January 15, 2024)
- ✅ Core APIs: Orders, Payments, Tenants
- ✅ Admin APIs: Overview, Orders, Restaurants, Support, Settlements, Verification, Audit, Health
- ✅ JWT Authentication
- ✅ Rate limiting
- ⏳ Fraud Detection APIs (Phase 3+)
- ⏳ Refunds APIs (Phase 3+)

### Roadmap
- Phase 2: Advanced analytics, reporting
- Phase 3: Fraud detection, advanced refunds
- Phase 4: Machine learning integration, predictive analytics

---

## Legal & Security

- **Terms of Service:** https://restop.com/terms
- **Privacy Policy:** https://restop.com/privacy
- **Security Policy:** https://restop.com/security
- **API Rate Limits:** Subject to Terms of Service

### Data Protection

- All APIs use HTTPS encryption
- Request/response logging for audit trail
- Sensitive data (passwords, PII) never logged
- GDPR compliant data handling

---

**API Version:** 1.0  
**Maintained by:** RESTOP API Team  
**Last Updated:** January 15, 2024  
**Next Review:** April 15, 2024
