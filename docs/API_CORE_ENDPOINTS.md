# RESTOP Core API Endpoints Documentation

**Base URL:** `/api/v1`  
**API Version:** 1.0  
**Last Updated:** January 15, 2024

---

## Table of Contents

1. [Orders API](#orders-api)
2. [Payments API](#payments-api)
3. [Tenants API (Restaurant Management)](#tenants-api--restaurant-management)
4. [Authentication](#authentication)
5. [Error Handling](#error-handling)

---

## Orders API

### Base Route: `/api/v1/orders`

---

### POST /orders

**Purpose:** Create a new order (public endpoint - accessible without authentication)

**Request Body:**
```json
{
  "tenant_id": "UUID",
  "items": [
    {
      "menu_item_id": "UUID",
      "quantity": 2,
      "special_instructions": "No onions"
    }
  ],
  "customer_phone": "optional: +1234567890",
  "payment_method": "optional: CASH|MOBILE_MONEY|CARD",
  "table_number": "optional: 5",
  "estimated_service_time_minutes": "optional: 30"
}
```

**Response (201 Created):**
```json
{
  "id": "UUID",
  "tenant_id": "UUID",
  "status": "CREATED",
  "items": [
    {
      "id": "UUID",
      "menu_item_id": "UUID",
      "name": "Burger",
      "quantity": 2,
      "unit_price": 8.99,
      "subtotal": 17.98
    }
  ],
  "subtotal": 17.98,
  "tax": 2.15,
  "delivery_fee": 2.00,
  "total": 22.13,
  "currency": "USD",
  "payment_method": "CASH",
  "payment_status": "PENDING",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid items or tenant_id
- `404 Not Found` – Tenant or menu items not found
- `409 Conflict` – Tenant is inactive or menu items unavailable

---

### GET /orders/:id

**Purpose:** Get order details (public endpoint)

**URL Parameters:**
- `id` (UUID) – Order ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "tenant_id": "UUID",
  "status": "CONFIRMED",
  "items": [
    {
      "id": "UUID",
      "menu_item_id": "UUID",
      "name": "Burger",
      "quantity": 2,
      "unit_price": 8.99,
      "subtotal": 17.98
    }
  ],
  "subtotal": 17.98,
  "tax": 2.15,
  "delivery_fee": 2.00,
  "total": 22.13,
  "customer_phone": "+1234567890",
  "payment_method": "CASH",
  "payment_status": "COMPLETED",
  "created_at": "2024-01-15T10:30:00Z",
  "confirmed_at": "2024-01-15T10:35:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `404 Not Found` – Order not found

---

### GET /orders

**Purpose:** List orders for authenticated tenant (requires JWT + Tenant role)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (CREATED, PENDING_PAYMENT, CONFIRMED, PREPARING, READY, COMPLETED, REJECTED) |
| `limit` | number | 20 | Items per page (max 100) |
| `offset` | number | 0 | Pagination offset |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "UUID",
      "status": "COMPLETED",
      "total": 22.13,
      "customer_phone": "+1234567890",
      "payment_status": "COMPLETED",
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T11:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 156
  }
}
```

**Status Codes:**
- `200 OK` – Orders retrieved
- `400 Bad Request` – Invalid query parameters
- `401 Unauthorized` – Missing/invalid JWT

---

### PATCH /orders/:id/status

**Purpose:** Update order status (tenant-only endpoint)

**Authentication:** JWT + Tenant role (only restaurant owner can update their own orders)

**URL Parameters:**
- `id` (UUID) – Order ID

**Request Body:**
```json
{
  "status": "CONFIRMED|PREPARING|READY|COMPLETED|REJECTED"
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "status": "PREPARING",
  "previous_status": "CONFIRMED",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid status transition
- `401 Unauthorized` – Missing JWT or insufficient permissions
- `403 Forbidden` – Tenant does not own this order
- `404 Not Found` – Order not found

---

### PATCH /orders/:id/confirm

**Purpose:** Confirm order (move from CREATED to PENDING_PAYMENT state)

**Authentication:** JWT + Tenant role

**URL Parameters:**
- `id` (UUID) – Order ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "status": "PENDING_PAYMENT",
  "previous_status": "CREATED",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Order cannot be confirmed in current state
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Tenant does not own this order
- `404 Not Found` – Order not found

---

### PATCH /orders/:id/reject

**Purpose:** Reject an order with optional reason

**Authentication:** JWT + Tenant role

**URL Parameters:**
- `id` (UUID) – Order ID

**Request Body (optional):**
```json
{
  "reason": "Out of stock for burger"
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "status": "REJECTED",
  "previous_status": "CONFIRMED",
  "reason": "Out of stock for burger",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Order cannot be rejected in current state
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Tenant does not own this order
- `404 Not Found` – Order not found

---

### POST /orders/:id/pay

**Purpose:** Initiate payment for an order (public endpoint)

**URL Parameters:**
- `id` (UUID) – Order ID

**Request Body (optional):**
```json
{
  "phone_number": "+1234567890"
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "status": "PENDING_PAYMENT",
  "payment_status": "PROCESSING",
  "payment_method": "MOBILE_MONEY",
  "message": "Payment initiated. Check your phone for USSD prompt.",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid phone number or order state
- `404 Not Found` – Order not found
- `409 Conflict` – Order already paid or in wrong state

---

### PATCH /orders/:id/confirm-cash

**Purpose:** Confirm cash payment (tenant marks order as cash received)

**Authentication:** JWT + Tenant role

**URL Parameters:**
- `id` (UUID) – Order ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "status": "CONFIRMED",
  "payment_status": "COMPLETED",
  "payment_method": "CASH",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Order cannot confirm cash in current state
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Tenant does not own this order
- `404 Not Found` – Order not found

---

## Payments API

### Base Route: `/api/v1/payments`

**Default Guards:** JwtAuthGuard + TenantGuard  
(All endpoints require JWT authentication + Tenant role)

---

### POST /payments/initiate-mobile-money

**Purpose:** Initiate mobile money payment for an order

**Rate Limits:**
- 100 requests per minute per tenant
- 30 payment initiations per hour per customer phone

**Request Body:**
```json
{
  "order_id": "UUID",
  "customer_phone": "+256701234567"
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "order_id": "UUID",
  "amount": 22.13,
  "currency": "USD",
  "phone": "+256701234567",
  "status": "INITIATED",
  "payment_method": "MOBILE_MONEY",
  "provider": "MTN" | "AIRTEL" | "AFRICELL",
  "external_reference": "MOZ20240115001234",
  "message": "USSD dial *150*00*2# to complete payment",
  "expires_at": "2024-01-15T10:45:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid order or phone number
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Tenant does not own this order
- `404 Not Found` – Order not found
- `409 Conflict` – Order already paid or rate limit exceeded
- `503 Service Unavailable` – Payment gateway down

---

### POST /payments/confirm-cash

**Purpose:** Confirm cash payment received (tenant endpoint)

**Request Body:**
```json
{
  "order_id": "UUID"
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "order_id": "UUID",
  "amount": 22.13,
  "status": "COMPLETED",
  "payment_method": "CASH",
  "confirmed_by": "admin_001",
  "confirmed_at": "2024-01-15T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Order in invalid state
- `401 Unauthorized` – Missing JWT
- `404 Not Found` – Order not found

---

### GET /payments/:id

**Purpose:** Get payment details

**URL Parameters:**
- `id` (UUID) – Payment ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "order_id": "UUID",
  "amount": 22.13,
  "currency": "USD",
  "status": "COMPLETED",
  "payment_method": "MOBILE_MONEY",
  "provider": "MTN",
  "customer_phone": "+256701234567",
  "external_reference": "MOZ20240115001234",
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:32:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – User does not own this payment
- `404 Not Found` – Payment not found

---

### GET /orders/:orderId/payments

**Purpose:** Get all payments for an order

**URL Parameters:**
- `orderId` (UUID) – Order ID

**Response (200 OK):**
```json
{
  "order_id": "UUID",
  "payments": [
    {
      "id": "UUID",
      "amount": 22.13,
      "status": "COMPLETED",
      "payment_method": "MOBILE_MONEY",
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:32:00Z"
    }
  ],
  "total_paid": 22.13,
  "total_due": 0
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `404 Not Found` – Order not found

---

## Tenants API (Restaurant Management)

### Base Route: `/api/v1/tenants`

---

### POST /tenants

**Purpose:** Create a new restaurant (public endpoint - signup)

**Request Body:**
```json
{
  "name": "Burger Palace",
  "slug": "burger-palace",
  "email": "owner@burgerpalace.com",
  "phone": "+1234567890",
  "password": "securepassword",
  "currency": "USD",
  "country_code": "US",
  "country_name": "United States",
  "city": "New York",
  "address": "123 Main St, New York, NY 10001",
  "cuisine_types": ["Burgers", "American"],
  "logo_url": "https://..."
}
```

**Response (201 Created):**
```json
{
  "id": "UUID",
  "name": "Burger Palace",
  "slug": "burger-palace",
  "email": "owner@burgerpalace.com",
  "status": "PENDING",
  "verified": false,
  "currency": "USD",
  "country": "US",
  "city": "New York",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid input
- `409 Conflict` – Email or slug already exists

---

### GET /tenants/me/profile

**Purpose:** Get authenticated restaurant's profile

**Authentication:** JWT required

**Response (200 OK):**
```json
{
  "id": "UUID",
  "name": "Burger Palace",
  "slug": "burger-palace",
  "email": "owner@burgerpalace.com",
  "phone": "+1234567890",
  "currency": "USD",
  "country_code": "US",
  "country_name": "United States",
  "city": "New York",
  "address": "123 Main St, New York, NY 10001",
  "status": "ACTIVE",
  "verified": true,
  "verification_date": "2023-12-01T10:00:00Z",
  "cuisine_types": ["Burgers", "American"],
  "logo_url": "https://...",
  "created_at": "2023-10-15T00:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT

---

### POST /tenants/me/profile

**Purpose:** Update authenticated restaurant's profile

**Authentication:** JWT + Owner/Manager role

**Request Body:**
```json
{
  "name": "Updatedname",
  "phone": "+1234567890",
  "email": "newemail@burgerpalace.com",
  "currency": "USD",
  "country_code": "US",
  "country_name": "United States",
  "city": "Brooklyn",
  "address": "456 New Ave, Brooklyn, NY 11201",
  "logo_url": "https://...",
  "cuisine_types": ["Burgers", "American", "Vegetarian"]
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "name": "Updated Burger Palace",
  "email": "newemail@burgerpalace.com",
  "city": "Brooklyn",
  "updated_at": "2024-01-15T14:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid input
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Insufficient permissions
- `409 Conflict` – Email already in use

---

### GET /tenants/countries/africa

**Purpose:** Get list of African countries (public endpoint)

**Response (200 OK):**
```json
{
  "countries": [
    {
      "code": "ZA",
      "name": "South Africa",
      "currency": "ZAR",
      "region": "Southern Africa"
    },
    {
      "code": "ZM",
      "name": "Zambia",
      "currency": "ZMW",
      "region": "Southern Africa"
    },
    {
      "code": "MW",
      "name": "Malawi",
      "currency": "MWK",
      "region": "Southern Africa"
    }
  ]
}
```

---

### GET /tenants/:slug/qrcode

**Purpose:** Get QR code for restaurant (public endpoint)

**URL Parameters:**
- `slug` (string) – Restaurant slug

**Response (200 OK - Image/PNG):**
```
[QR Code PNG Image]
```

**Query Parameters:**
- `size` (optional, default: 300) – QR code size in pixels

---

### GET /tenants/:slug

**Purpose:** Get public restaurant profile

**URL Parameters:**
- `slug` (string) – Restaurant slug

**Response (200 OK):**
```json
{
  "id": "UUID",
  "name": "Burger Palace",
  "slug": "burger-palace",
  "city": "New York",
  "country": "US",
  "cuisine_types": ["Burgers", "American"],
  "rating": 4.7,
  "total_reviews": 456,
  "verified": true,
  "logo_url": "https://...",
  "operating_hours": {
    "monday": "08:00-23:00",
    "tuesday": "08:00-23:00"
  }
}
```

**Error Responses:**
- `404 Not Found` – Restaurant not found

---

### POST /tenants/:id/regenerate-qrcode

**Purpose:** Regenerate restaurant's QR code

**Authentication:** JWT + Owner/Admin role

**URL Parameters:**
- `id` (UUID) – Restaurant ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "qrcode_url": "https://...",
  "regenerated_at": "2024-01-15T14:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Not restaurant owner
- `404 Not Found` – Restaurant not found

---

### GET /tenants/:id/info

**Purpose:** Get restaurant info (authenticated endpoint)

**Authentication:** JWT required

**URL Parameters:**
- `id` (UUID) – Restaurant ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "name": "Burger Palace",
  "email": "owner@burgerpalace.com",
  "verified": true,
  "status": "ACTIVE",
  "total_orders": 1250,
  "total_revenue": 125430.50,
  "average_rating": 4.7
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `404 Not Found` – Restaurant not found

---

### POST /tenants/:tenantId/payment-accounts

**Purpose:** Add a payment account for the restaurant

**Authentication:** JWT required

**URL Parameters:**
- `tenantId` (UUID) – Restaurant ID

**Request Body:**
```json
{
  "momo_number": "+256701234567",
  "account_name": "Burger Palace LLC",
  "account_type": "BUSINESS" | "INDIVIDUAL",
  "bank_code": "MTN" | "AIRTEL" | "AFRICELL"
}
```

**Response (201 Created):**
```json
{
  "id": "UUID",
  "tenant_id": "UUID",
  "momo_number": "+256701234567",
  "account_name": "Burger Palace LLC",
  "account_type": "BUSINESS",
  "bank_code": "MTN",
  "verified": false,
  "is_default": false,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid account details
- `401 Unauthorized` – Missing JWT
- `404 Not Found` – Restaurant not found
- `409 Conflict` – Account already exists

---

### GET /tenants/:tenantId/payment-accounts

**Purpose:** List all payment accounts for restaurant

**Authentication:** JWT required

**URL Parameters:**
- `tenantId` (UUID) – Restaurant ID

**Response (200 OK):**
```json
{
  "accounts": [
    {
      "id": "UUID",
      "momo_number": "+256701234567",
      "account_name": "Burger Palace LLC",
      "verified": true,
      "is_default": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `404 Not Found` – Restaurant not found

---

### GET /tenants/:tenantId/payment-accounts/:accountId

**Purpose:** Get specific payment account details

**Authentication:** JWT required

**URL Parameters:**
- `tenantId` (UUID) – Restaurant ID
- `accountId` (UUID) – Payment account ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "tenant_id": "UUID",
  "momo_number": "+256701234567",
  "account_name": "Burger Palace LLC",
  "account_type": "BUSINESS",
  "bank_code": "MTN",
  "verified": true,
  "verification_date": "2024-01-10T10:00:00Z",
  "is_default": true,
  "total_payouts": 45230.50,
  "last_payout": "2024-01-14T18:00:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `404 Not Found` – Account or restaurant not found

---

### PATCH /tenants/:tenantId/payment-accounts/:accountId/default

**Purpose:** Set payment account as default

**Authentication:** JWT required

**URL Parameters:**
- `tenantId` (UUID) – Restaurant ID
- `accountId` (UUID) – Payment account ID

**Response (200 OK):**
```json
{
  "id": "UUID",
  "is_default": true,
  "updated_at": "2024-01-15T14:00:00Z",
  "message": "Payment account set as default"
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Not restaurant owner
- `404 Not Found` – Account or restaurant not found

---

### PATCH /tenants/:tenantId/payment-accounts/:accountId/verify

**Purpose:** Verify payment account (admin-only endpoint)

**Authentication:** JWT + Admin role

**URL Parameters:**
- `tenantId` (UUID) – Restaurant ID
- `accountId` (UUID) – Payment account ID

**Request Body:**
```json
{
  "verified": true,
  "notes": "Account verified successfully"
}
```

**Response (200 OK):**
```json
{
  "id": "UUID",
  "verified": true,
  "verification_date": "2024-01-15T14:00:00Z",
  "verified_by": "admin_001"
}
```

**Error Responses:**
- `401 Unauthorized` – Missing JWT
- `403 Forbidden` – Not admin
- `404 Not Found` – Account or restaurant not found

---

## Authentication

### JWT Token Structure

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

**JWT Payload Example:**
```json
{
  "sub": "UUID",
  "email": "owner@burgerpalace.com",
  "role": "TENANT_OWNER" | "TENANT_MANAGER" | "PLATFORM_ADMIN",
  "tenant_id": "UUID",
  "iat": 1705329600,
  "exp": 1705416000
}
```

### Role-Based Access Control

| Role | Endpoints | Permissions |
|------|-----------|-------------|
| Public | POST /tenants, GET /orders/:id, GET /tenants/:slug | Create restaurant, view public order/restaurant info |
| TENANT_OWNER | All /orders, /payments, /tenants/me/* | Full access to own restaurant and orders |
| TENANT_MANAGER | GET /orders, GET /payments, PATCH /orders/:id/* | Read-only + order status updates |
| PLATFORM_ADMIN | All /admin/* | Platform-wide admin functions |

---

## Error Handling

### Error Response Format

All errors follow this standard format:

```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": "BadRequest",
  "timestamp": "2024-01-15T15:30:00Z",
  "path": "/api/v1/orders"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | OK | Successful request |
| `201` | Created | Resource successfully created |
| `400` | Bad Request | Invalid input parameters |
| `401` | Unauthorized | Missing or invalid JWT |
| `403` | Forbidden | User lacks required permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Business logic violation (e.g., duplicate email) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `503` | Service Unavailable | External service down (payment gateway) |

### Validation Errors

For validation failures, additional `errors` field is included:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "BadRequest",
  "errors": [
    {
      "property": "tenant_id",
      "constraints": {
        "isUuid": "tenant_id must be a UUID"
      }
    }
  ]
}
```

---

## Rate Limiting

Endpoints implement rate limiting to protect against abuse:

**Headers Included in Responses:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705329600
```

**Limits by Endpoint:**
| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /payments/initiate-mobile-money | 100 req/min | Per tenant |
| POST /payments/initiate-mobile-money | 30 initiations/hour | Per customer phone |
| Other write endpoints | 50 req/min | Per user |
| Read endpoints | 100 req/min | Per user |

When rate limit is exceeded, you'll receive:
```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

**API Version:** 1.0  
**Last Updated:** January 15, 2024  
**Status:** Production Ready
