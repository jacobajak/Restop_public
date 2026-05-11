# Guest Customer Tracking - Quick Reference

## Endpoints Summary

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/guest-customers/profile/:phone` | Get customer profile & lifetime stats | Required |
| GET | `/guest-customers/order-history/:phone` | Get customer's order history | Required |
| GET | `/guest-customers/is-returning/:phone` | Check if returning customer | Required |
| GET | `/guest-customers/stats` | Get tenant's customer statistics | Required |
| GET | `/guest-customers/top-spending` | Get top spending customers | Required |
| GET | `/guest-customers/vip-customers` | Identify VIP customers | Required |
| GET | `/guest-customers/acquisition-cohort` | Get acquisition & retention metrics | Required |

---

## Quick Test Commands

### 1. Get Customer Profile
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     http://localhost:3000/guest-customers/profile/0788123456
```

### 2. Get Order History
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     "http://localhost:3000/guest-customers/order-history/0788123456?limit=20"
```

### 3. Check if Returning
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     http://localhost:3000/guest-customers/is-returning/0788123456
```

### 4. Get Stats
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     http://localhost:3000/guest-customers/stats
```

### 5. Top Spending Customers
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     "http://localhost:3000/guest-customers/top-spending?limit=20"
```

### 6. VIP Customers
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     "http://localhost:3000/guest-customers/vip-customers?min_lifetime_value=100000"
```

### 7. Acquisition Cohort
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT_ID" \
     "http://localhost:3000/guest-customers/acquisition-cohort?days=30"
```

---

## Response Examples

### Customer Profile
```json
{
  "customer_phone": "0788123456",
  "total_orders": 5,
  "total_spent": 45000,
  "first_order_at": "2024-01-01T14:30:00Z",
  "last_order_at": "2024-01-15T18:45:00Z",
  "favorite_items": [
    { "item_name": "Pizza", "frequency": 3 },
    { "item_name": "Salad", "frequency": 2 }
  ],
  "average_order_value": 9000,
  "is_returning_customer": true,
  "customer_lifetime_value": 45000
}
```

### Customer Statistics
```json
{
  "total_unique_customers": 1250,
  "new_customers_today": 45,
  "returning_customers": 380,
  "avg_customer_lifetime_value": 35000,
  "most_active_customers": [
    { "phone": "0788123456", "orders": 52, "spent": 450000 },
    { "phone": "0789654321", "orders": 48, "spent": 420000 }
  ]
}
```

### Acquisition Cohort
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

---

## Required Headers

All requests require:
```
Authorization: Bearer YOUR_JWT_TOKEN
X-Tenant-ID: your-tenant-id
Content-Type: application/json
```

---

## Use Cases

### For Customer Service
- Look up customer profile when they call
- Access order history for support inquiries
- Identify regular customers for special offers

### For Marketing
- Target loyalty offers to top spenders
- Identify VIP customers
- Analyze customer retention rates
- Plan seasonal campaigns

### For Management
- Monitor business health via customer stats
- Track acquisition vs retention trends
- Identify high-value customer segments
- Measure marketing campaign effectiveness

### For Operations
- Personalize service for repeat customers
- Forecast demand based on customer patterns
- Identify staffing needs based on customer volume
