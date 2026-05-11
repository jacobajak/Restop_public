# Financial Analytics API Documentation

## Overview

The Financial Analytics API provides comprehensive financial reporting and business intelligence for merchants (restaurants/tenants). It exposes detailed revenue analytics, payment method breakdown, KPIs, and trend analysis to help restaurants monitor and optimize their business performance.

## Authentication & Authorization

All endpoints require:
- **JWT Token** in `Authorization: Bearer <token>` header
- **Tenant Context** via `X-Tenant-ID` header or embedded in JWT
- User must have merchant/tenant role

All endpoints are scoped to the authenticated tenant - merchants can only access their own financial data.

---

## API Endpoints

### 1. Get Financial Summary Dashboard

**Endpoint:** `GET /financial-analytics/summary`

Returns comprehensive financial overview for the specified period. Perfect for dashboard displays and executive summaries.

**Query Parameters:**
| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| startDate | string | YYYY-MM-DD | Period start date (optional, default: 30 days ago) |
| endDate | string | YYYY-MM-DD | Period end date (optional, default: today) |

**Response (200 - Success):**
```json
{
  "total_orders": 1250,
  "completed_orders": 1200,
  "paid_orders": 1180,
  "failed_orders": 70,
  "total_revenue": 15500000,
  "momo_revenue": 12000000,
  "cash_revenue": 3500000,
  "platform_commission": 775000,
  "net_revenue": 14725000,
  "average_order_value": 12917,
  "payment_success_rate": "94.40%",
  "period": {
    "start_date": "2026-03-09",
    "end_date": "2026-04-08",
    "days": 30
  }
}
```

**Response (400 - Invalid Date):**
```json
{
  "statusCode": 400,
  "message": "Invalid date format. Use YYYY-MM-DD",
  "error": "Bad Request"
}
```

**Use Cases:**
- Dashboard main card showing business health
- Executive summary reporting
- Export for investor presentations
- Performance monitoring
- Monthly/quarterly business reviews

**Example:**
```bash
# Get last 30 days (default)
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     https://api.restop.com/financial-analytics/summary

# Get specific period
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "https://api.restop.com/financial-analytics/summary?startDate=2026-03-01&endDate=2026-03-31"
```

---

### 2. Get Daily Revenue Breakdown

**Endpoint:** `GET /financial-analytics/daily-revenue`

Returns daily revenue trends with breakdown by payment method. Useful for visualizing revenue patterns and identifying peak days.

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| days | integer | 30 | 365 | Number of days to include |

**Response (200 - Success):**
```json
{
  "period_days": 30,
  "total_days_with_orders": 28,
  "data": [
    {
      "date": "2026-04-08",
      "total_orders": 45,
      "total_revenue": 580000,
      "cash_revenue": 120000,
      "momo_revenue": 460000,
      "commission": 29000,
      "net_revenue": 551000,
      "average_order_value": 12889
    },
    {
      "date": "2026-04-07",
      "total_orders": 52,
      "total_revenue": 680000,
      "cash_revenue": 150000,
      "momo_revenue": 530000,
      "commission": 34000,
      "net_revenue": 646000,
      "average_order_value": 13077
    }
  ],
  "summary": {
    "total_revenue": 15500000,
    "avg_daily_revenue": 553571,
    "max_daily_revenue": 850000,
    "min_daily_revenue": 120000
  }
}
```

**Response (400 - Invalid Range):**
```json
{
  "statusCode": 400,
  "message": "Days must be between 1 and 365",
  "error": "Bad Request"
}
```

**Use Cases:**
- Revenue trend chart visualization
- Identify peak/low performing days
- Daily revenue tracking
- Staffing optimization (staffing based on expected daily revenue)
- Pattern identification (weekends vs weekdays)

**Example:**
```bash
# Last 7 days
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "https://api.restop.com/financial-analytics/daily-revenue?days=7"

# Last 90 days
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "https://api.restop.com/financial-analytics/daily-revenue?days=90"
```

---

### 3. Get Payment Method Analysis

**Endpoint:** `GET /financial-analytics/payment-methods`

Returns detailed breakdown of revenue by payment method with insights about customer payment preferences.

**Query Parameters:** None

**Response (200 - Success):**
```json
{
  "summary": {
    "total_orders": 1200,
    "total_revenue": 15500000
  },
  "breakdown": {
    "cash": {
      "count": 300,
      "total": 3750000,
      "percentage": 25.0,
      "average_order_value": 12500
    },
    "mtn": {
      "count": 720,
      "total": 9360000,
      "percentage": 60.39,
      "average_order_value": 13000
    },
    "airtel": {
      "count": 180,
      "total": 2390000,
      "percentage": 15.42,
      "average_order_value": 13278
    }
  },
  "insights": {
    "preferred_method": "mtn",
    "highest_aov_method": "airtel",
    "cash_penetration": 0.25,
    "digital_penetration": 0.75
  }
}
```

**Use Cases:**
- Understand customer payment preferences
- Method mix analysis (cash vs digital)
- Optimize mobile money provider partnership
- Identify payment method specific strategies
- Customer segment analysis

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     https://api.restop.com/financial-analytics/payment-methods
```

---

### 4. Get Key Performance Metrics

**Endpoint:** `GET /financial-analytics/metrics`

Returns comprehensive KPIs for business health monitoring and performance evaluation.

**Query Parameters:**
| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| startDate | string | YYYY-MM-DD | Period start date (optional) |
| endDate | string | YYYY-MM-DD | Period end date (optional) |

**Response (200 - Success):**
```json
{
  "revenue_metrics": {
    "total_revenue": 15500000,
    "net_revenue": 14725000,
    "platform_commission": 775000,
    "commission_rate": 5.0
  },
  "order_metrics": {
    "total_orders": 1250,
    "completed_orders": 1200,
    "completion_rate": 96.0,
    "paid_orders": 1180,
    "payment_success_rate": 98.33,
    "average_order_value": 12917,
    "revenue_per_order": 12400
  },
  "efficiency_metrics": {
    "failed_orders": 70,
    "failure_rate": 5.6,
    "average_commission_per_order": 620
  }
}
```

**KPI Definitions:**

| Metric | Definition | Target |
|--------|-----------|--------|
| **Commission Rate** | (Platform Commission / Total Revenue) × 100 | ~5% |
| **Completion Rate** | (Completed Orders / Total Orders) × 100 | >95% |
| **Payment Success Rate** | (Paid Orders / (Paid + Failed)) × 100 | >95% |
| **Average Order Value** | Total Revenue / Total Orders | Industry dependent |
| **Revenue per Order** | Total Revenue / Total Orders | Same as AOV |
| **Failure Rate** | (Failed Orders / Total Orders) × 100 | <5% |

**Use Cases:**
- KPI dashboard
- Performance benchmarking
- Health check system
- Automated alerts (if metrics deviate)
- Monthly performance reviews

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "https://api.restop.com/financial-analytics/metrics"
```

---

### 5. Compare Financial Performance (Period vs Period)

**Endpoint:** `GET /financial-analytics/comparison`

Returns period-over-period comparison for trend analysis and growth tracking.

**Query Parameters:**
| Parameter | Type | Format | Required | Description |
|-----------|------|--------|----------|-------------|
| period1_start | string | YYYY-MM-DD | Yes | First period start |
| period1_end | string | YYYY-MM-DD | Yes | First period end |
| period2_start | string | YYYY-MM-DD | Yes | Second period start |
| period2_end | string | YYYY-MM-DD | Yes | Second period end |

**Response (200 - Success):**
```json
{
  "period_1": {
    "label": "2026-03-01 to 2026-03-31",
    "total_revenue": 14000000,
    "total_orders": 1100,
    "average_order_value": 12727
  },
  "period_2": {
    "label": "2026-04-01 to 2026-04-08",
    "total_revenue": 3500000,
    "total_orders": 250,
    "average_order_value": 14000
  },
  "comparison": {
    "revenue_change": {
      "absolute": -10500000,
      "percentage": -75.0
    },
    "order_change": {
      "absolute": -850,
      "percentage": -77.27
    },
    "aov_change": {
      "absolute": 1273,
      "percentage": 10.01
    },
    "trend": "declining"
  }
}
```

**Response (400 - Missing Parameters):**
```json
{
  "statusCode": 400,
  "message": "All parameters required: period1_start, period1_end, period2_start, period2_end (YYYY-MM-DD)",
  "error": "Bad Request"
}
```

**Use Cases:**
- Month-over-month growth tracking
- Year-over-year comparison
- Campaign effectiveness analysis
- Seasonal trend identification
- Business growth monitoring

**Example:**
```bash
# March vs April
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "https://api.restop.com/financial-analytics/comparison?\
period1_start=2026-03-01&period1_end=2026-03-31&\
period2_start=2026-04-01&period2_end=2026-04-30"

# Q1 vs Q2
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "https://api.restop.com/financial-analytics/comparison?\
period1_start=2026-01-01&period1_end=2026-03-31&\
period2_start=2026-04-01&period2_end=2026-06-30"
```

---

## Data Models

### Summary Response
```typescript
{
  total_orders: number;              // All orders in period
  completed_orders: number;          // Only completed orders
  paid_orders: number;               // Orders with successful payment
  failed_orders: number;             // Orders with payment failures
  total_revenue: number;             // Total order amounts (RWF)
  momo_revenue: number;              // Mobile money revenue
  cash_revenue: number;              // Cash payment revenue
  platform_commission: number;       // Platform fee deducted
  net_revenue: number;               // Total - Commission
  average_order_value: number;       // Total Revenue / Total Orders
  payment_success_rate: string;      // Percentage string (e.g., "94.40%")
  period: {
    start_date: string;              // YYYY-MM-DD
    end_date: string;                // YYYY-MM-DD
    days: number;                    // Days in period
  };
}
```

### Daily Revenue Item
```typescript
{
  date: string;                      // YYYY-MM-DD
  total_orders: number;
  total_revenue: number;
  cash_revenue: number;
  momo_revenue: number;
  commission: number;
  net_revenue: number;
  average_order_value: number;
}
```

### Payment Method Breakdown
```typescript
{
  count: number;                     // Number of transactions
  total: number;                     // Total amount (RWF)
  percentage: number;                // % of total (0-100)
  average_order_value: number;       // Avg transaction amount
}
```

### Comparison Metrics
```typescript
{
  absolute: number;                  // Absolute change (value1 - value2)
  percentage: number;                // Percentage change
}
```

---

## Common Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Invalid date format. Use YYYY-MM-DD",
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

```json
{
  "statusCode": 400,
  "message": "All parameters required: period1_start, period1_end, period2_start, period2_end (YYYY-MM-DD)",
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

Missing or invalid JWT token.

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

// Get financial summary
async function getFinancialSummary() {
  try {
    const response = await axios.get(
      `${API_BASE}/financial-analytics/summary`,
      { headers }
    );
    console.log('Financial Summary:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

// Get daily revenue for last 7 days
async function getWeeklyRevenue() {
  try {
    const response = await axios.get(
      `${API_BASE}/financial-analytics/daily-revenue?days=7`,
      { headers }
    );
    console.log('Weekly Revenue:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

// Compare March vs April
async function compareMonths() {
  try {
    const response = await axios.get(
      `${API_BASE}/financial-analytics/comparison`,
      {
        headers,
        params: {
          period1_start: '2026-03-01',
          period1_end: '2026-03-31',
          period2_start: '2026-04-01',
          period2_end: '2026-04-30',
        },
      }
    );
    console.log('Month Comparison:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

// Get dashboard metrics
async function getDashboard() {
  const [summary, daily, methods, metrics] = await Promise.all([
    getFinancialSummary(),
    getWeeklyRevenue(),
    axios.get(
      `${API_BASE}/financial-analytics/payment-methods`,
      { headers }
    ).then((r) => r.data),
    axios.get(
      `${API_BASE}/financial-analytics/metrics`,
      { headers }
    ).then((r) => r.data),
  ]);

  return {
    summary,
    weeklyTrend: daily,
    paymentBreakdown: methods,
    kpis: metrics,
  };
}
```

### Python

```python
import requests
from datetime import datetime, timedelta

API_BASE = 'https://api.restop.com'
TOKEN = 'YOUR_JWT_TOKEN'
TENANT_ID = 'your-tenant-id'

headers = {
    'Authorization': f'Bearer {TOKEN}',
    'X-Tenant-ID': TENANT_ID,
}

def get_financial_summary(start_date=None, end_date=None):
    """Get financial dashboard summary"""
    try:
        params = {}
        if start_date:
            params['startDate'] = start_date.strftime('%Y-%m-%d')
        if end_date:
            params['endDate'] = end_date.strftime('%Y-%m-%d')
        
        response = requests.get(
            f'{API_BASE}/financial-analytics/summary',
            headers=headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None

def get_daily_revenue(days=30):
    """Get daily revenue breakdown"""
    try:
        response = requests.get(
            f'{API_BASE}/financial-analytics/daily-revenue',
            headers=headers,
            params={'days': days}
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None

def get_payment_methods():
    """Get payment method analysis"""
    try:
        response = requests.get(
            f'{API_BASE}/financial-analytics/payment-methods',
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None

def get_kpis(start_date=None, end_date=None):
    """Get key performance metrics"""
    try:
        params = {}
        if start_date:
            params['startDate'] = start_date.strftime('%Y-%m-%d')
        if end_date:
            params['endDate'] = end_date.strftime('%Y-%m-%d')
        
        response = requests.get(
            f'{API_BASE}/financial-analytics/metrics',
            headers=headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None

def compare_periods(p1_start, p1_end, p2_start, p2_end):
    """Compare two time periods"""
    try:
        response = requests.get(
            f'{API_BASE}/financial-analytics/comparison',
            headers=headers,
            params={
                'period1_start': p1_start.strftime('%Y-%m-%d'),
                'period1_end': p1_end.strftime('%Y-%m-%d'),
                'period2_start': p2_start.strftime('%Y-%m-%d'),
                'period2_end': p2_end.strftime('%Y-%m-%d'),
            }
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e.response.json()}')
        return None
```

### cURL

```bash
# Get financial summary (last 30 days)
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  https://api.restop.com/financial-analytics/summary

# Get summary for specific period
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/financial-analytics/summary?\
startDate=2026-03-01&endDate=2026-03-31"

# Get daily revenue for last 7 days
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/financial-analytics/daily-revenue?days=7"

# Get payment method breakdown
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  https://api.restop.com/financial-analytics/payment-methods

# Get KPIs for specific period
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/financial-analytics/metrics?\
startDate=2026-03-01&endDate=2026-03-31"

# Compare March vs April
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant-id" \
  "https://api.restop.com/financial-analytics/comparison?\
period1_start=2026-03-01&period1_end=2026-03-31&\
period2_start=2026-04-01&period2_end=2026-04-30"
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

## Performance & Caching

### Recommendation
- Cache summary/metrics for 1 hour
- Cache daily revenue for 24 hours
- Cache payment method breakdown for 24 hours
- Keep comparison queries uncached (real-time)

### Optimal Query Times
- Run heavy queries (daily-revenue, comparison) during off-peak hours
- Consider pre-computing daily summaries at end of day
- Implement incremental updates for continuous reporting

---

## Use Cases & Workflows

### Merchant Dashboard
```
1. Load financial summary (30 days)
2. Load payment method breakdown
3. Load daily revenue (7 days)
4. Load KPIs
5. Update every 5 minutes
```

### Monthly Business Review
```
1. Get summary for current month
2. Get summary for previous month
3. Compare two periods
4. Analyze payment methods
5. Export to PDF/CSV
```

### Trend Analysis
```
1. Get daily revenue for 90 days
2. Identify peak days/patterns
3. Compare Q1 vs Q2
4. Track AOV trends
5. Forecast next month
```

### Performance Alerts
```
1. Monitor KPIs hourly
2. Alert if payment success rate < 95%
3. Alert if AOV drops > 10%
4. Alert if failure rate > 5%
5. Notify merchant immediately
```

---

## Changelog

### Version 1.0 (Current)
- Initial release of Financial Analytics API
- 5 main endpoints for financial reporting
- Comprehensive KPI metrics
- Period-over-period comparison
- Payment method analysis
- Real-time data aggregation
