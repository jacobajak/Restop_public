# Financial Analytics - Quick Reference

## Endpoints Summary

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/financial-analytics/summary` | GET | Financial dashboard overview | Summary stats + period info |
| `/financial-analytics/daily-revenue` | GET | Daily revenue trends | Daily breakdown + summary |
| `/financial-analytics/payment-methods` | GET | Payment method analysis | Breakdown by method + insights |
| `/financial-analytics/metrics` | GET | Key performance metrics | Revenue, order, efficiency metrics |
| `/financial-analytics/comparison` | GET | Period vs period comparison | Side-by-side comparison + trends |

---

## Quick Test Commands

### 1. Get Summary (Last 30 Days)
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     http://localhost:3000/financial-analytics/summary
```

### 2. Get Summary (Custom Period)
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "http://localhost:3000/financial-analytics/summary?\
startDate=2026-03-01&endDate=2026-03-31"
```

### 3. Get Daily Revenue (Last 7 Days)
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "http://localhost:3000/financial-analytics/daily-revenue?days=7"
```

### 4. Get Payment Methods
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     http://localhost:3000/financial-analytics/payment-methods
```

### 5. Get KPIs
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     http://localhost:3000/financial-analytics/metrics
```

### 6. Compare Period vs Period
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Tenant-ID: $TENANT_ID" \
     "http://localhost:3000/financial-analytics/comparison?\
period1_start=2026-03-01&period1_end=2026-03-31&\
period2_start=2026-04-01&period2_end=2026-04-30"
```

---

## Response Examples

### Summary Response
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

### Daily Revenue (Single Day)
```json
{
  "date": "2026-04-08",
  "total_orders": 45,
  "total_revenue": 580000,
  "cash_revenue": 120000,
  "momo_revenue": 460000,
  "commission": 29000,
  "net_revenue": 551000,
  "average_order_value": 12889
}
```

### Payment Methods
```json
{
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

### KPIs
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

---

## Required Headers

All requests require:
```
Authorization: Bearer YOUR_JWT_TOKEN
X-Tenant-ID: your-tenant-id
Content-Type: application/json
```

---

## Common Query Patterns

### Last 7 Days
```bash
curl "http://localhost:3000/financial-analytics/daily-revenue?days=7" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

### Last 30 Days (Default)
```bash
curl "http://localhost:3000/financial-analytics/summary" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

### Last 90 Days
```bash
curl "http://localhost:3000/financial-analytics/daily-revenue?days=90" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

### Last Year
```bash
curl "http://localhost:3000/financial-analytics/daily-revenue?days=365" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

### This Month
```bash
# Today at 00:00 of current month
MONTH_START=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)

curl "http://localhost:3000/financial-analytics/summary?\
startDate=$MONTH_START&endDate=$TODAY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

### This Year
```bash
YEAR_START=$(date +%Y)-01-01
TODAY=$(date +%Y-%m-%d)

curl "http://localhost:3000/financial-analytics/summary?\
startDate=$YEAR_START&endDate=$TODAY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

---

## KPI Targets

| Metric | Target | Action if Low |
|--------|--------|--------------|
| Commission Rate | 5% | Review pricing |
| Completion Rate | >95% | Check for order issues |
| Payment Success Rate | >95% | Contact payment provider |
| Failure Rate | <5% | Investigate causes |
| AOV | Industry dependent | Review menu pricing |

---

## Dashboard Assembly

```javascript
// Build complete dashboard with single Promise.all()
const dashboard = await Promise.all([
  // Financial summary
  fetch('/financial-analytics/summary', { headers })
    .then(r => r.json()),
  
  // Daily trends (7 days)
  fetch('/financial-analytics/daily-revenue?days=7', { headers })
    .then(r => r.json()),
  
  // Payment methods
  fetch('/financial-analytics/payment-methods', { headers })
    .then(r => r.json()),
  
  // KPIs
  fetch('/financial-analytics/metrics', { headers })
    .then(r => r.json()),
]);

const [summary, dailyTrend, paymentMethods, kpis] = dashboard;
```

---

## Error Handling

```bash
# 400 - Invalid date
# Use YYYY-MM-DD format

# 400 - Days out of range
# Use 1-365 for days parameter

# 401 - Unauthorized
# Check JWT token validity

# 403 - Forbidden
# Verify tenant access

# 429 - Rate limit exceeded
# Wait before retry
```

---

## Use Cases

### Morning Review
1. Get summary (today)
2. Compare with yesterday
3. Check payment methods
4. Monitor KPIs

### Weekly Report
1. Get daily revenue (7 days)
2. Analyze trends
3. Identify peak days
4. Calculate averages

### Monthly Report
1. Get summary for month
2. Compare with previous month
3. Trend analysis
4. Export data

### Quarterly Business Review
1. Compare Q1 vs Q2
2. Analyze payment method shifts
3. Review KPI progress
4. Plan next quarter
