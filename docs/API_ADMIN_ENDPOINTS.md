# RESTOP Admin API Endpoints Documentation

**Base URL:** `/admin`  
**Authentication:** All endpoints require JWT token + `PLATFORM_ADMIN` role  
**Content-Type:** `application/json`

---

## Table of Contents

1. [Overview & Dashboard](#overview--dashboard)
2. [Orders Management](#orders-management)
3. [Restaurants Management](#restaurants-management)
4. [Support Management](#support-management)
5. [Verification & Payment Accounts](#verification--payment-accounts)
6. [Settlements Management](#settlements-management)
7. [Audit Logs](#audit-logs)
8. [Health Monitoring](#health-monitoring)
9. [Payments Management](#payments-management) ⚠️ *Pending*
10. [Refunds Management](#refunds-management) ⚠️ *Pending*
11. [Fraud Detection](#fraud-detection) ⚠️ *Pending*

---

## Overview & Dashboard

### GET /admin/overview

**Purpose:** Fetch platform dashboard summary with real-time metrics

**Response:**
```json
{
  "active_restaurants": 2547,
  "active_orders": 891,
  "total_customers": 45230,
  "total_revenue_today": 125400.50,
  "pending_settlements": 15,
  "failed_payments": 8,
  "support_issues_open": 23,
  "system_health": {
    "database": "healthy",
    "payment_gateway": "healthy",
    "notification_service": "degraded"
  }
}
```

**Status Codes:**
- `200 OK` – Dashboard data retrieved successfully
- `401 Unauthorized` – Missing or invalid JWT token
- `403 Forbidden` – User lacks PLATFORM_ADMIN role

---

## Orders Management

### GET /admin/orders

**Purpose:** Retrieve all orders with filtering and pagination

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | - | Filter by order status (PENDING, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED) |
| `restaurant_id` | string | - | Filter by restaurant |
| `customer_id` | string | - | Filter by customer |
| `date_from` | ISO 8601 | - | Start date filter |
| `date_to` | ISO 8601 | - | End date filter |
| `sort` | string | -created_at | Sort field (created_at, total_amount, status) |

**Response:**
```json
{
  "data": [
    {
      "id": "ord_123456",
      "restaurant_id": "rest_789",
      "customer_id": "cust_456",
      "status": "DELIVERED",
      "total_amount": 45.99,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T11:45:00Z",
      "items": [
        {
          "menu_item_id": "item_101",
          "name": "Burger",
          "quantity": 2,
          "unit_price": 8.99,
          "subtotal": 17.98
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12450,
    "pages": 623
  }
}
```

**Status Codes:**
- `200 OK` – Orders retrieved successfully
- `400 Bad Request` – Invalid filter parameters
- `401 Unauthorized` – Missing/invalid token
- `403 Forbidden` – Insufficient permissions

---

### GET /admin/orders/:id

**Purpose:** Get detailed information for a specific order

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID (required) |

**Response:**
```json
{
  "id": "ord_123456",
  "restaurant_id": "rest_789",
  "restaurant_name": "Burger Palace",
  "customer_id": "cust_456",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "status": "DELIVERED",
  "total_amount": 45.99,
  "platform_fee": 4.60,
  "restaurant_earnings": 38.82,
  "payment_method": "CREDIT_CARD",
  "payment_status": "COMPLETED",
  "delivery_address": "123 Main St, City, 12345",
  "estimated_delivery": "2024-01-15T11:15:00Z",
  "actual_delivery": "2024-01-15T11:12:00Z",
  "created_at": "2024-01-15T10:30:00Z",
  "items": [
    {
      "menu_item_id": "item_101",
      "name": "Burger",
      "quantity": 2,
      "unit_price": 8.99,
      "subtotal": 17.98,
      "special_instructions": "No onions"
    }
  ],
  "timeline": [
    {
      "event": "ORDER_CREATED",
      "timestamp": "2024-01-15T10:30:00Z",
      "actor": "CUSTOMER"
    },
    {
      "event": "ORDER_CONFIRMED",
      "timestamp": "2024-01-15T10:32:00Z",
      "actor": "RESTAURANT"
    },
    {
      "event": "DELIVERY_COMPLETED",
      "timestamp": "2024-01-15T11:12:00Z",
      "actor": "DRIVER"
    }
  ]
}
```

**Status Codes:**
- `200 OK` – Order details retrieved
- `404 Not Found` – Order not found
- `401 Unauthorized` – Missing/invalid token

---

## Restaurants Management

### GET /admin/restaurants

**Purpose:** List all restaurants with filters

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | string | ACTIVE, SUSPENDED, PENDING, CLOSED |
| `city` | string | Filter by city |
| `country` | string | Filter by country |
| `search` | string | Search by name or phone |

**Response:**
```json
{
  "data": [
    {
      "id": "rest_789",
      "name": "Burger Palace",
      "status": "ACTIVE",
      "owner_id": "user_123",
      "owner_name": "Jane Smith",
      "city": "New York",
      "country": "US",
      "verified": true,
      "verification_date": "2023-12-01T10:00:00Z",
      "total_orders": 1250,
      "rating": 4.7,
      "commission_rate": 15,
      "created_at": "2023-10-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2547,
    "pages": 128
  }
}
```

**Status Codes:**
- `200 OK` – Restaurants retrieved
- `400 Bad Request` – Invalid parameters
- `401 Unauthorized` – Missing/invalid token

---

### GET /admin/restaurants/:id

**Purpose:** Get detailed restaurant information

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Restaurant ID (required) |

**Response:**
```json
{
  "id": "rest_789",
  "name": "Burger Palace",
  "status": "ACTIVE",
  "owner_id": "user_123",
  "owner_email": "owner@burgerpalace.com",
  "owner_phone": "+1234567890",
  "city": "New York",
  "country": "US",
  "address": "456 Food Street, New York, NY 10001",
  "cuisine_types": ["Burgers", "American"],
  "verified": true,
  "verification_date": "2023-12-01T10:00:00Z",
  "commission_rate": 15,
  "total_orders": 1250,
  "total_revenue": 125430.50,
  "platform_fees_paid": 18814.58,
  "average_rating": 4.7,
  "total_reviews": 456,
  "operating_hours": {
    "monday": "08:00-23:00",
    "tuesday": "08:00-23:00",
    "wednesday": "08:00-23:00",
    "thursday": "08:00-23:00",
    "friday": "08:00-00:00",
    "saturday": "09:00-00:00",
    "sunday": "09:00-22:00"
  },
  "documents": [
    {
      "type": "BUSINESS_LICENSE",
      "verified": true,
      "verification_date": "2023-12-01T10:00:00Z"
    }
  ],
  "created_at": "2023-10-15T00:00:00Z",
  "last_order": "2024-01-15T18:30:00Z"
}
```

**Status Codes:**
- `200 OK` – Restaurant details retrieved
- `404 Not Found` – Restaurant not found
- `401 Unauthorized` – Missing/invalid token

---

### PATCH /admin/restaurants/:id/status

**Purpose:** Update restaurant operational status

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Restaurant ID (required) |

**Request Body:**
```json
{
  "status": "ACTIVE" | "SUSPENDED" | "PENDING" | "CLOSED",
  "reason": "Optional suspension reason"
}
```

**Response:**
```json
{
  "id": "rest_789",
  "status": "SUSPENDED",
  "previous_status": "ACTIVE",
  "reason": "Failed health inspection",
  "updated_by": "admin_001",
  "updated_at": "2024-01-15T14:00:00Z"
}
```

**Status Codes:**
- `200 OK` – Status updated
- `400 Bad Request` – Invalid status value
- `404 Not Found` – Restaurant not found
- `401 Unauthorized` – Missing/invalid token

---

### PATCH /admin/restaurants/:id/verify

**Purpose:** Verify or unverify a restaurant

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Restaurant ID (required) |

**Request Body:**
```json
{
  "verified": true,
  "notes": "All documents verified successfully"
}
```

**Response:**
```json
{
  "id": "rest_789",
  "verified": true,
  "verification_date": "2024-01-15T14:00:00Z",
  "verified_by": "admin_001"
}
```

**Status Codes:**
- `200 OK` – Verification updated
- `400 Bad Request` – Invalid request
- `404 Not Found` – Restaurant not found

---

## Support Management

### GET /admin/support/issues

**Purpose:** List support issues with filtering

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `status` | string | OPEN, ASSIGNED, RESOLVED, CLOSED |
| `priority` | string | LOW, MEDIUM, HIGH, URGENT |
| `assigned_to` | string | Filter by assigned admin |
| `sort` | string | created_at, updated_at, priority |

**Response:**
```json
{
  "data": [
    {
      "id": "support_456",
      "title": "Payment not received",
      "description": "I haven't received my payment from last order",
      "status": "OPEN",
      "priority": "HIGH",
      "created_by_type": "TENANT" | "CUSTOMER",
      "created_by_id": "user_123",
      "assigned_to": null,
      "created_at": "2024-01-15T08:30:00Z",
      "updated_at": "2024-01-15T08:30:00Z",
      "resolved_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

**Status Codes:**
- `200 OK` – Issues retrieved
- `400 Bad Request` – Invalid parameters
- `401 Unauthorized` – Missing/invalid token

---

### GET /admin/support/issues/:id

**Purpose:** Get detailed support issue information

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Support issue ID (required) |

**Response:**
```json
{
  "id": "support_456",
  "title": "Payment not received",
  "description": "I haven't received my payment from last order",
  "status": "ASSIGNED",
  "priority": "HIGH",
  "created_by_type": "TENANT",
  "created_by_id": "user_123",
  "created_by_name": "John Restaurant",
  "assigned_to_id": "admin_001",
  "assigned_to_name": "Admin User",
  "assigned_date": "2024-01-15T10:00:00Z",
  "created_at": "2024-01-15T08:30:00Z",
  "updated_at": "2024-01-15T10:00:00Z",
  "resolved_at": null,
  "resolution_notes": null,
  "messages": [
    {
      "id": "msg_1",
      "sender_id": "user_123",
      "sender_type": "TENANT",
      "message": "I haven't received my payment from last order",
      "created_at": "2024-01-15T08:30:00Z"
    },
    {
      "id": "msg_2",
      "sender_id": "admin_001",
      "sender_type": "ADMIN",
      "message": "I'll investigate this immediately",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` – Issue details retrieved
- `404 Not Found` – Issue not found
- `401 Unauthorized` – Missing/invalid token

---

### PATCH /admin/support/issues/:id/assign

**Purpose:** Assign support issue to an admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Support issue ID (required) |

**Request Body:**
```json
{
  "assigned_to": "admin_001"
}
```

**Response:**
```json
{
  "id": "support_456",
  "status": "ASSIGNED",
  "assigned_to": "admin_001",
  "assigned_date": "2024-01-15T10:15:00Z",
  "updated_at": "2024-01-15T10:15:00Z"
}
```

**Status Codes:**
- `200 OK` – Issue assigned
- `404 Not Found` – Issue or admin not found
- `400 Bad Request` – Invalid request

---

### PATCH /admin/support/issues/:id/resolve

**Purpose:** Mark support issue as resolved

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Support issue ID (required) |

**Request Body:**
```json
{
  "resolution_notes": "Payment issued successfully",
  "close_issue": true
}
```

**Response:**
```json
{
  "id": "support_456",
  "status": "RESOLVED",
  "resolved_at": "2024-01-15T10:30:00Z",
  "resolution_notes": "Payment issued successfully",
  "resolved_by": "admin_001",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Status Codes:**
- `200 OK` – Issue resolved
- `404 Not Found` – Issue not found
- `400 Bad Request` – Invalid request

---

## Verification & Payment Accounts

### GET /admin/verification/payment-accounts

**Purpose:** Get queue of payment accounts awaiting verification

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `status` | string | PENDING, VERIFIED, REJECTED |

**Response:**
```json
{
  "data": [
    {
      "id": "payacct_001",
      "restaurant_id": "rest_789",
      "restaurant_name": "Burger Palace",
      "owner_name": "Jane Smith",
      "account_holder": "Burger Palace LLC",
      "bank_name": "First National Bank",
      "account_ending": "****5678",
      "status": "PENDING",
      "submitted_at": "2024-01-10T15:00:00Z",
      "verification_documents": [
        {
          "type": "BANK_STATEMENT",
          "verified": false
        },
        {
          "type": "TAX_ID",
          "verified": false
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**Status Codes:**
- `200 OK` – Accounts retrieved
- `401 Unauthorized` – Missing/invalid token

---

### GET /admin/verification/payment-accounts/:id

**Purpose:** Get detailed payment account verification information

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Payment account ID (required) |

**Response:**
```json
{
  "id": "payacct_001",
  "restaurant_id": "rest_789",
  "restaurant_name": "Burger Palace",
  "owner_id": "user_123",
  "owner_name": "Jane Smith",
  "account_holder": "Burger Palace LLC",
  "account_type": "BUSINESS",
  "bank_name": "First National Bank",
  "bank_code": "012345",
  "account_number": "****5678",
  "routing_number": "****6789",
  "currency": "USD",
  "status": "PENDING",
  "submitted_at": "2024-01-10T15:00:00Z",
  "verification_documents": [
    {
      "id": "doc_001",
      "type": "BANK_STATEMENT",
      "file_url": "https://...",
      "verified": false,
      "verification_notes": null
    },
    {
      "id": "doc_002",
      "type": "TAX_ID",
      "file_url": "https://...",
      "verified": false,
      "verification_notes": null
    },
    {
      "id": "doc_003",
      "type": "BUSINESS_LICENSE",
      "file_url": "https://...",
      "verified": true,
      "verification_date": "2024-01-11T10:00:00Z",
      "verified_by": "admin_001"
    }
  ],
  "risk_assessment": {
    "score": 15,
    "level": "LOW",
    "flags": []
  }
}
```

**Status Codes:**
- `200 OK` – Account details retrieved
- `404 Not Found` – Account not found
- `401 Unauthorized` – Missing/invalid token

---

### PATCH /admin/verification/payment-accounts/:id/verify

**Purpose:** Approve a payment account for verification

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Payment account ID (required) |

**Request Body:**
```json
{
  "notes": "All documents verified. Account approved for payouts.",
  "verified_documents": ["doc_001", "doc_002"]
}
```

**Response:**
```json
{
  "id": "payacct_001",
  "status": "VERIFIED",
  "verified_at": "2024-01-15T14:00:00Z",
  "verified_by": "admin_001",
  "notes": "All documents verified. Account approved for payouts."
}
```

**Status Codes:**
- `200 OK` – Account verified
- `400 Bad Request` – Invalid request
- `404 Not Found` – Account not found

---

### PATCH /admin/verification/payment-accounts/:id/reject

**Purpose:** Reject a payment account verification

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Payment account ID (required) |

**Request Body:**
```json
{
  "reason": "INVALID_DOCUMENTS",
  "notes": "Bank statement does not match submitted information",
  "resubmit_allowed": true
}
```

**Response:**
```json
{
  "id": "payacct_001",
  "status": "REJECTED",
  "rejected_at": "2024-01-15T14:00:00Z",
  "rejected_by": "admin_001",
  "reason": "INVALID_DOCUMENTS",
  "notes": "Bank statement does not match submitted information",
  "resubmit_allowed": true
}
```

**Status Codes:**
- `200 OK` – Account rejected
- `400 Bad Request` – Invalid request
- `404 Not Found` – Account not found

---

## Settlements Management

### GET /admin/settlements

**Purpose:** List all settlements with filtering

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `status` | string | PENDING, COMPLETED, FAILED, CANCELLED |
| `restaurant_id` | string | Filter by restaurant |
| `date_from` | ISO 8601 | Start date filter |
| `date_to` | ISO 8601 | End date filter |

**Response:**
```json
{
  "data": [
    {
      "id": "settle_001",
      "restaurant_id": "rest_789",
      "restaurant_name": "Burger Palace",
      "amount": 4500.00,
      "currency": "USD",
      "status": "COMPLETED",
      "settlement_date": "2024-01-15T00:00:00Z",
      "completed_date": "2024-01-15T06:30:00Z",
      "period_start": "2024-01-08T00:00:00Z",
      "period_end": "2024-01-14T23:59:59Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5234,
    "pages": 262
  }
}
```

**Status Codes:**
- `200 OK` – Settlements retrieved
- `400 Bad Request` – Invalid parameters
- `401 Unauthorized` – Missing/invalid token

---

### GET /admin/settlements/:id

**Purpose:** Get detailed settlement information

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Settlement ID (required) |

**Response:**
```json
{
  "id": "settle_001",
  "restaurant_id": "rest_789",
  "restaurant_name": "Burger Palace",
  "owner_name": "Jane Smith",
  "payment_account_id": "payacct_001",
  "amount": 4500.00,
  "currency": "USD",
  "status": "COMPLETED",
  "settlement_date": "2024-01-15T00:00:00Z",
  "completed_date": "2024-01-15T06:30:00Z",
  "period_start": "2024-01-08T00:00:00Z",
  "period_end": "2024-01-14T23:59:59Z",
  "breakdown": {
    "total_orders": 287,
    "total_revenue": 5294.00,
    "platform_fees": 794.10,
    "restaurant_earnings": 4500.00,
    "adjustments": 0
  },
  "payment_details": {
    "bank_name": "First National Bank",
    "account_ending": "****5678",
    "transaction_id": "txn_123456789",
    "reference_number": "RF123456"
  },
  "retry_count": 0,
  "last_retry": null,
  "failure_reason": null
}
```

**Status Codes:**
- `200 OK` – Settlement details retrieved
- `404 Not Found` – Settlement not found
- `401 Unauthorized` – Missing/invalid token

---

### POST /admin/settlements/:id/retry

**Purpose:** Retry a failed settlement payout

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Settlement ID (required) |

**Request Body (optional):**
```json
{
  "notes": "Retrying after bank account was verified"
}
```

**Response:**
```json
{
  "id": "settle_001",
  "status": "PENDING",
  "retry_count": 1,
  "previous_status": "FAILED",
  "retry_initiated_at": "2024-01-15T14:00:00Z",
  "initiated_by": "admin_001",
  "notes": "Retrying after bank account was verified"
}
```

**Status Codes:**
- `200 OK` – Retry initiated
- `400 Bad Request` – Settlement cannot be retried
- `404 Not Found` – Settlement not found

---

## Audit Logs

### GET /admin/audit-logs

**Purpose:** Retrieve audit log entries with filtering

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `action` | string | Filter by action type (CREATED, UPDATED, DELETED, etc.) |
| `entity_type` | string | Filter by entity (ORDER, RESTAURANT, PAYMENT, etc.) |
| `actor_id` | string | Filter by actor (admin/user who made change) |
| `date_from` | ISO 8601 | Start date filter |
| `date_to` | ISO 8601 | End date filter |

**Response:**
```json
{
  "data": [
    {
      "id": "audit_789",
      "action": "UPDATED",
      "entity_type": "RESTAURANT",
      "entity_id": "rest_789",
      "actor_id": "admin_001",
      "actor_type": "ADMIN",
      "changes": {
        "status": {
          "old": "ACTIVE",
          "new": "SUSPENDED"
        }
      },
      "reason": "Failed health inspection",
      "ip_address": "192.168.1.100",
      "timestamp": "2024-01-15T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45678,
    "pages": 2284
  }
}
```

**Status Codes:**
- `200 OK` – Audit logs retrieved
- `400 Bad Request` – Invalid parameters
- `401 Unauthorized` – Missing/invalid token

---

### GET /admin/audit-logs/:reference_type/:reference_id

**Purpose:** Get audit trail for a specific entity

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `reference_type` | string | Entity type (ORDER, RESTAURANT, PAYMENT, etc.) |
| `reference_id` | string | Entity ID |

**Response:**
```json
{
  "entity_type": "RESTAURANT",
  "entity_id": "rest_789",
  "entity_name": "Burger Palace",
  "audit_trail": [
    {
      "id": "audit_1",
      "action": "CREATED",
      "actor_id": "user_123",
      "actor_name": "Jane Smith",
      "actor_type": "TENANT",
      "changes": {},
      "timestamp": "2023-10-15T08:00:00Z"
    },
    {
      "id": "audit_2",
      "action": "UPDATED",
      "actor_id": "admin_001",
      "actor_name": "Platform Admin",
      "actor_type": "ADMIN",
      "changes": {
        "status": {
          "old": "PENDING",
          "new": "ACTIVE"
        }
      },
      "timestamp": "2023-12-01T10:00:00Z"
    },
    {
      "id": "audit_3",
      "action": "UPDATED",
      "actor_id": "admin_001",
      "actor_name": "Platform Admin",
      "actor_type": "ADMIN",
      "changes": {
        "status": {
          "old": "ACTIVE",
          "new": "SUSPENDED"
        },
        "suspension_reason": {
          "old": null,
          "new": "Failed health inspection"
        }
      },
      "timestamp": "2024-01-15T14:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` – Audit trail retrieved
- `404 Not Found` – Entity not found
- `401 Unauthorized` – Missing/invalid token

---

## Health Monitoring

### GET /admin/health

**Purpose:** Get system health metrics and status

**Response:**
```json
{
  "system_status": "OPERATIONAL",
  "timestamp": "2024-01-15T15:30:00Z",
  "components": {
    "database": {
      "status": "HEALTHY",
      "response_time_ms": 12,
      "connections_active": 45,
      "connections_max": 100
    },
    "payment_gateway": {
      "status": "HEALTHY",
      "response_time_ms": 250,
      "transactions_per_minute": 12
    },
    "notification_service": {
      "status": "DEGRADED",
      "response_time_ms": 5000,
      "queue_size": 2345,
      "last_error": "Timeout connecting to email service"
    },
    "auth_service": {
      "status": "HEALTHY",
      "tokens_issued_per_minute": 45
    }
  },
  "metrics": {
    "active_orders": 891,
    "pending_settlements": 15,
    "failed_payments": 8,
    "support_issues_open": 23,
    "restaurants_online": 2504,
    "restaurants_offline": 43
  },
  "alerts": [
    {
      "level": "WARNING",
      "component": "notification_service",
      "message": "Email service experiencing delays"
    }
  ]
}
```

**Status Codes:**
- `200 OK` – Health metrics retrieved
- `401 Unauthorized` – Missing/invalid token

---

## Payments Management ⚠️ *Pending*

**Status:** Currently disabled due to circular dependency with PaymentService. Scheduled for Phase 3+.

### Planned Endpoints:

- `GET /admin/payments` – List all payments with filters
- `GET /admin/payments/:id` – Get payment details
- `POST /admin/payments/manual` – Create manual test payment
- `PATCH /admin/payments/:id/status` – Override payment status
- `POST /admin/payments/:id/refund` – Issue refund for payment

---

## Refunds Management ⚠️ *Pending*

**Status:** Currently disabled due to circular dependency with PaymentService. Scheduled for Phase 3+.

### Planned Endpoints:

- `GET /admin/refunds` – List all refunds
- `GET /admin/refunds/:id` – Get refund details
- `POST /admin/refunds/:id/approve` – Approve refund
- `POST /admin/refunds/:id/reject` – Reject refund
- `POST /admin/refunds/bulk-process` – Bulk process refunds

---

## Fraud Detection ⚠️ *Pending*

**Status:** Currently not integrated into AdminModule. Scheduled for Phase 3+.

### Planned Endpoints:

- `GET /admin/fraud/queue` – Get fraud moderation queue  
- `GET /admin/fraud/:id` – Get fraud review details
- `GET /admin/fraud/subject/:type/:id` – Reviews for entity
- `POST /admin/fraud/:id/assign` – Assign review
- `POST /admin/fraud/:id/approve` – Approve review
- `POST /admin/fraud/:id/dismiss` – Dismiss review  
- `POST /admin/fraud/:id/escalate` – Escalate for investigation
- `GET /admin/fraud/stats` – Get fraud statistics

---

## Error Response Format

All endpoints return standardized error responses:

```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": "BadRequest",
  "timestamp": "2024-01-15T15:30:00Z"
}
```

### Common Status Codes:

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict (business logic violation) |
| `500` | Internal Server Error |

---

## Authentication & Authorization

All admin endpoints require:

1. **Valid JWT Token** in Authorization header:
   ```
   Authorization: Bearer <your_jwt_token>
   ```

2. **PLATFORM_ADMIN Role** in JWT payload:
   ```json
   {
     "sub": "admin_001",
     "email": "admin@restop.com",
     "role": "PLATFORM_ADMIN",
     "iat": 1234567890
   }
   ```

Requests without proper credentials will receive a `401 Unauthorized` response.

---

## Rate Limiting

Admin endpoints support the following rate limits:

- **List endpoints**: 100 requests per minute
- **Detail endpoints**: 200 requests per minute
- **Write endpoints**: 50 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705329600
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` – Page number (starting from 1)
- `limit` – Items per page (default: 20, max: 100)

**Response Structure:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "pages": 25
  }
}
```

---

**Last Updated:** January 15, 2024  
**API Version:** 1.0  
**Status:** Active (with pending features)
