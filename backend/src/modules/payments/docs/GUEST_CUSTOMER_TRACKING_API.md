# Guest Customer Tracking API Documentation

## Overview

The Guest Customer Tracking API enables restaurants (tenants) to track and analyze guest customers who order without creating an account. All tracking is done via phone numbers, enabling customer profiling for loyalty programs, marketing, and business intelligence.

## Authentication & Authorization

All endpoints require:
- **JWT Token** in `Authorization: Bearer <token>` header
- **Tenant Context** via `X-Tenant-ID` header or embedded in JWT
- User must have appropriate permissions for the tenant

All endpoints are scoped to the authenticated tenant - customers can only access their own data.

---

## API Endpoints

### 1. Get Guest Customer Profile

**Endpoint:** `GET /guest-customers/profile/:phone`

Retrieves comprehensive profile for a guest customer at the specific restaurant.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | Customer phone number (e.g., `0788123456` or `+250788123456`) |

**Response (200 - Success):**
```json
{
  "customer_phone": "0788123456",
  "total_orders": 5,
  "total_spent": 45000,
  "first_order_at": "2024-01-01T14:30:00Z",
  "last_order_at": "2024-01-15T18:45:00Z",
  "preferred_restaurants": [],
  "favorite_items": [
    {
      "item_name": "Pizza Margherita",
      "frequency": 3
    },
    {
      "item_name": "Caesar Salad",
      "frequency": 2
    }
  ],
  "average_order_value": 9000,
  "is_returning_customer": true,
  "customer_lifetime_value": 45000
}
```

**Response (400 - Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Phone number is required",
  "error": "Bad Request"
}
```

**Use Cases:**
- Look up customer when they call to place an order
- Staff can see if customer is a repeat visitor
- Identify customer preferences for personalized service
- Pull up order history for customer service

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     https://api.restop.com/guest-customers/profile/0788123456
```

---

### 2. Get Customer Order History

**Endpoint:** `GET /guest-customers/order-history/:phone`

Retrieves detailed order history for a guest customer.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | Customer phone number |

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| limit | integer | 20 | 100 | Number of orders to return |

**Response (200 - Success):**
```json
{
  "phone": "0788123456",
  "orders": [
    {
      "order_id": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 15000,
      "status": "PAID",
      "created_at": "2024-01-15T18:45:00Z",
      "items": 3
    },
    {
      "order_id": "550e8400-e29b-41d4-a716-446655440001",
      "amount": 12000,
      "status": "PAID",
      "created_at": "2024-01-14T12:30:00Z",
      "items": 2
    }
  ],
  "total": 2
}
```

**Response (400 - Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Phone number is required",
  "error": "Bad Request"
}
```

**Use Cases:**
- View customer's complete order history
- Identify patterns in ordering behavior
- Support team can review past orders for customer service
- Identify frequently ordered items for recommendations

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     "https://api.restop.com/guest-customers/order-history/0788123456?limit=50"
```

---

### 3. Check if Returning Customer

**Endpoint:** `GET /guest-customers/is-returning/:phone`

Quick check to determine if customer has placed previous orders.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | Customer phone number |

**Response (200 - Success):**
```json
{
  "phone": "0788123456",
  "is_returning_customer": true
}
```

**Response (400 - Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Phone number is required",
  "error": "Bad Request"
}
```

**Use Cases:**
- Quick lookup when customer places order
- Determine if special welcome/loyalty offers should apply
- Call center agents can identify regular customers
- Qualify customers for exclusive deals

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     https://api.restop.com/guest-customers/is-returning/0788123456
```

---

### 4. Get Tenant Customer Statistics

**Endpoint:** `GET /guest-customers/stats`

Aggregate customer metrics for the tenant's dashboard.

**Query Parameters:** None

**Response (200 - Success):**
```json
{
  "total_unique_customers": 1250,
  "new_customers_today": 45,
  "returning_customers": 380,
  "avg_customer_lifetime_value": 35000,
  "most_active_customers": [
    {
      "phone": "0788123456",
      "orders": 52,
      "spent": 450000
    },
    {
      "phone": "0789654321",
      "orders": 48,
      "spent": 420000
    },
    {
      "phone": "0788999999",
      "orders": 45,
      "spent": 390000
    }
  ]
}
```

**Use Cases:**
- Dashboard display of key metrics
- Monitor business health
- Identify trends in customer acquisition
- Understand customer engagement
- Track customer lifetime value trends

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     https://api.restop.com/guest-customers/stats
```

---

### 5. Get Top Spending Customers

**Endpoint:** `GET /guest-customers/top-spending`

Identifies customers with highest lifetime value for loyalty/marketing programs.

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| limit | integer | 20 | 100 | Number of customers to return |

**Response (200 - Success):**
```json
[
  {
    "customer_phone": "0788123456",
    "total_orders": 52,
    "total_spent": 450000,
    "first_order_at": "2023-01-15T14:30:00Z",
    "last_order_at": "2024-01-15T18:45:00Z",
    "favorite_items": [
      {
        "item_name": "Premium Steak",
        "frequency": 15
      },
      {
        "item_name": "House Wine",
        "frequency": 12
      }
    ],
    "average_order_value": 8654,
    "is_returning_customer": true,
    "customer_lifetime_value": 450000
  }
]
```

**Use Cases:**
- Identify high-value customers for VIP programs
- Target loyalty offers to top spenders
- Premium customer service for best customers
- Plan special promotions and events
- Analyze what drives high-value customer engagement

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     "https://api.restop.com/guest-customers/top-spending?limit=50"
```

---

### 6. Identify VIP Customers

**Endpoint:** `GET /guest-customers/vip-customers`

Identifies customers meeting VIP criteria for special treatment and programs.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| min_lifetime_value | integer | 100000 | Minimum lifetime value to qualify as VIP |

**Response (200 - Success):**
```json
{
  "vip_customers": [
    "0788123456",
    "0789654321",
    "0788999999"
  ],
  "total_vips": 3,
  "min_lifetime_value": 100000
}
```

**Use Cases:**
- Create and manage loyalty tiers
- Send exclusive offers to VIP customers
- Priority phone support for VIPs
- Invite to special events/tastings
- Give VIP discounts or rewards

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     "https://api.restop.com/guest-customers/vip-customers?min_lifetime_value=150000"
```

---

### 7. Get Customer Acquisition Metrics

**Endpoint:** `GET /guest-customers/acquisition-cohort`

Analyzes customer acquisition trends and retention rates.

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| days | integer | 30 | 365 | Number of days to analyze |

**Response (200 - Success):**
```json
{
  "period_days": 30,
  "new_customers": 125,
  "returning_from_previous": 450,
  "churn_rate": 0.15,
  "retention_rate": 0.85,
  "total_active": 575
}
```

**Response (400 - Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Days must be between 1 and 365",
  "error": "Bad Request"
}
```

**Definitions:**
- **new_customers**: Customers who placed their first order in this period
- **returning_from_previous**: Customers who had orders before AND in this period
- **churn_rate**: Percentage of previous customers who didn't order in this period
- **retention_rate**: Percentage of previous customers retained (1 - churn_rate)
- **total_active**: Total unique customers active in this period

**Use Cases:**
- Analyze business growth trends
- Measure effectiveness of marketing campaigns
- Understand customer retention
- Identify periods of high/low acquisition
- Plan seasonal marketing strategies

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: restaurant-uuid" \
     "https://api.restop.com/guest-customers/acquisition-cohort?days=90"
```

---

## Data Model

### GuestCustomerProfile

```typescript
interface GuestCustomerProfile {
  customer_phone: string;           // Phone number (primary identifier)
  total_orders: number;              // Total orders placed
  total_spent: number;               // Total amount spent (RWF)
  first_order_at: Date;              // Date of first order
  last_order_at: Date;               // Date of most recent order
  preferred_restaurants: Array<{
    tenant_id: string;
    order_count: number;
    total_spent: number;
  }>;
  favorite_items: Array<{
    item_name: string;
    frequency: number;               // How many times ordered
  }>;
  average_order_value: number;       // Average spending per order
  is_returning_customer: boolean;    // true if 2+ orders
  customer_lifetime_value: number;   // Total spending (CLV)
}
```

### CustomerStatistics

```typescript
interface CustomerStatistics {
  total_unique_customers: number;
  new_customers_today: number;
  returning_customers: number;      // Customers with 2+ orders
  avg_customer_lifetime_value: number;
  most_active_customers: Array<{
    phone: string;
    orders: number;
    spent: number;
  }>;
}
```

### AcquisitionCohort

```typescript
interface AcquisitionCohort {
  new_customers: number;
  returning_from_previous: number;
  churn_rate: number;               // Decimal (0-1)
  retention_rate: number;           // Decimal (0-1)
  total_active: number;
}
```

---

## Common Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Phone number is required",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "Limit must be between 1 and 100",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "Days must be between 1 and 365",
  "error": "Bad Request"
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

Missing or invalid JWT token. Include valid token in `Authorization: Bearer <token>` header.

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Forbidden"
}
```

User does not have permission to access the tenant's data.

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'https://api.restop.com';
const TOKEN = 'YOUR_JWT_TOKEN';
const TENANT_ID = 'your-tenant-id';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'X-Tenant-ID': TENANT_ID,
};

// Get customer profile
async function getCustomerProfile(phone) {
  try {
    const response = await axios.get(
      `${API_BASE}/guest-customers/profile/${phone}`,
      { headers }
    );
    console.log('Customer Profile:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

// Get top spending customers
async function getTopCustomers(limit = 20) {
  try {
    const response = await axios.get(
      `${API_BASE}/guest-customers/top-spending`,
      { headers, params: { limit } }
    );
    console.log('Top Customers:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

// Get stats
async function getStats() {
  try {
    const response = await axios.get(
      `${API_BASE}/guest-customers/stats`,
      { headers }
    );
    console.log('Stats:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}
```

### Python

```python
import requests

API_BASE = 'https://api.restop.com'
TOKEN = 'YOUR_JWT_TOKEN'
TENANT_ID = 'your-tenant-id'

headers = {
    'Authorization': f'Bearer {TOKEN}',
    'X-Tenant-ID': TENANT_ID,
}

def get_customer_profile(phone):
    """Get guest customer profile"""
    try:
        response = requests.get(
            f'{API_BASE}/guest-customers/profile/{phone}',
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None

def get_top_customers(limit=20):
    """Get top spending customers"""
    try:
        response = requests.get(
            f'{API_BASE}/guest-customers/top-spending',
            headers=headers,
            params={'limit': limit}
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None

def get_stats():
    """Get tenant customer statistics"""
    try:
        response = requests.get(
            f'{API_BASE}/guest-customers/stats',
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None
```

### cURL

```bash
# Get customer profile
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  https://api.restop.com/guest-customers/profile/0788123456

# Get top spending customers
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/guest-customers/top-spending?limit=50"

# Get customer statistics
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  https://api.restop.com/guest-customers/stats

# Get customer order history
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/guest-customers/order-history/0788123456?limit=50"

# Check if returning customer
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  https://api.restop.com/guest-customers/is-returning/0788123456

# Get VIP customers
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/guest-customers/vip-customers?min_lifetime_value=100000"

# Get acquisition cohort
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/guest-customers/acquisition-cohort?days=30"
```

---

## Rate Limiting

- **Limit**: 100 requests per minute per tenant
- **Error Response** (429 Too Many Requests):
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests",
  "retryAfter": 60
}
```

---

## Privacy & Security Notes

1. **Phone Number as Identifier**: Only phone number is stored and used for customer identification
2. **No Personal Data**: No names, addresses, or personal information is stored beyond order timestamps and amounts
3. **Tenant Isolation**: Each tenant can only access their own customer data
4. **No Tracking Beyond Orders**: Customer tracking limited to order-related data only
5. **Data Retention**: Customer records retained according to compliance requirements

---

## Changelog

### Version 1.0 (Current)
- Initial release of Guest Customer Tracking API
- 7 endpoints for customer profiling and analytics
- Real-time customer statistics
- VIP identification and cohort analysis
