# Financial Analytics - Test Scenarios

## Test Setup

### Prerequisites
1. Running backend server on `http://localhost:3000`
2. Valid JWT token (obtained from login)
3. Valid tenant ID with orders in the system
4. Historical order data with various payment methods

### Test Configuration
```bash
export API="http://localhost:3000"
export TOKEN="YOUR_JWT_TOKEN"
export TENANT_ID="your-tenant-id"
```

---

## Test Scenarios

### Test 1: Get Financial Summary (Default - Last 30 Days)

**Description**: Retrieve financial summary for default period

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/financial-analytics/summary
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: total_orders, completed_orders, paid_orders, failed_orders
- Contains: total_revenue, momo_revenue, cash_revenue
- Contains: platform_commission, net_revenue
- Contains: average_order_value, payment_success_rate
- Contains: period object with start_date, end_date, days

**Validation**:
- net_revenue = total_revenue - platform_commission
- payment_success_rate is percentage string
- period.days = 30
- total_revenue >= net_revenue

---

### Test 2: Get Financial Summary (Custom Period)

**Description**: Retrieve summary for specific date range

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/summary?\
startDate=2026-03-01&endDate=2026-03-31"
```

**Expected Response (200)**:
- Same as Test 1
- period.start_date = 2026-03-01
- period.end_date = 2026-03-31
- period.days = 31

**Edge Cases**:
```bash
# Test 2a: Only start date
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/summary?startDate=2026-03-01"
# Expected: End date defaults to today

# Test 2b: Invalid start date format
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/summary?startDate=03/01/2026"
# Expected: 400 Bad Request

# Test 2c: Start date after end date
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/summary?\
startDate=2026-04-01&endDate=2026-03-01"
# Expected: 200 OK (may return 0 data)

# Test 2d: Future dates
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/summary?\
startDate=2027-01-01&endDate=2027-01-31"
# Expected: 200 OK with 0 orders/revenue
```

---

### Test 3: Get Daily Revenue (Last 7 Days)

**Description**: Retrieve daily revenue breakdown

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=7"
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: period_days = 7
- Contains: total_days_with_orders (0-7)
- Contains: data array with daily records
- Each record has: date, total_orders, total_revenue, cash_revenue, momo_revenue, commission, net_revenue, average_order_value
- Contains: summary with total_revenue, avg_daily_revenue, max_daily_revenue, min_daily_revenue

**Validation**:
- Data sorted descending by date
- net_revenue = total_revenue - commission for each day
- max_daily_revenue >= min_daily_revenue
- avg_daily_revenue = total_revenue / data.length
- Each date format is YYYY-MM-DD

**Edge Cases**:
```bash
# Test 3a: Last 1 day
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=1"
# Expected: 0-1 days of data

# Test 3b: Last 90 days
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=90"
# Expected: Up to 90 days of data

# Test 3c: Last 365 days
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=365"
# Expected: Up to 365 days of data

# Test 3d: Invalid days (0)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=0"
# Expected: 400 Bad Request "Days must be between 1 and 365"

# Test 3e: Invalid days (366)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=366"
# Expected: 400 Bad Request

# Test 3f: Invalid days (abc)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=abc"
# Expected: 400 Bad Request
```

---

### Test 4: Get Payment Method Analysis

**Description**: Retrieve payment method breakdown

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/financial-analytics/payment-methods
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: summary with total_orders, total_revenue
- Contains: breakdown with cash, mtn, airtel
- Each method has: count, total, percentage, average_order_value
- Contains: insights with preferred_method, highest_aov_method, cash_penetration, digital_penetration

**Validation**:
- cash.count + mtn.count + airtel.count = summary.total_orders
- cash.total + mtn.total + airtel.total = summary.total_revenue
- cash.percentage + mtn.percentage + airtel.percentage ≈ 100
- preferred_method ∈ [cash, mtn, airtel]
- highest_aov_method ∈ [cash, mtn, airtel]
- cash_penetration + digital_penetration = 1.0

**Edge Cases**:
```bash
# Test 4a: No cash orders (100% digital)
# Expected: cash.count = 0, digital_penetration = 1.0

# Test 4b: No digital orders (100% cash)
# Expected: mtn.count + airtel.count = 0, cash_penetration = 1.0

# Test 4c: No orders at all
# Expected: All counters = 0, percentages = 0

# Test 4d: Single payment method only
# Expected: Only one method has count > 0
```

---

### Test 5: Get Key Performance Metrics

**Description**: Retrieve KPI metrics

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/metrics"
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: revenue_metrics (total_revenue, net_revenue, platform_commission, commission_rate)
- Contains: order_metrics (total_orders, completed_orders, completion_rate, paid_orders, payment_success_rate, average_order_value, revenue_per_order)
- Contains: efficiency_metrics (failed_orders, failure_rate, average_commission_per_order)

**Validation**:
- commission_rate = (platform_commission / total_revenue) × 100
- completion_rate = (completed_orders / total_orders) × 100
- payment_success_rate = (paid_orders / (paid_orders + failed_orders)) × 100
- failure_rate = (failed_orders / total_orders) × 100
- average_order_value = total_revenue / total_orders
- All percentages are floats 0-100

**Edge Cases**:
```bash
# Test 5a: No orders
# Expected: All counts = 0, percentages = 0 or undefined

# Test 5b: With custom date range
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/metrics?\
startDate=2026-03-01&endDate=2026-03-31"
# Expected: KPIs for March only

# Test 5c: Perfect scenario (all paid, all completed)
# Expected: payment_success_rate = 100, completion_rate = 100, failure_rate = 0
```

---

### Test 6: Compare Period vs Period

**Description**: Compare two time periods

**Setup**:
```bash
# March vs April
PERIOD1_START=2026-03-01
PERIOD1_END=2026-03-31
PERIOD2_START=2026-04-01
PERIOD2_END=2026-04-30
```

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/comparison?\
period1_start=$PERIOD1_START&period1_end=$PERIOD1_END&\
period2_start=$PERIOD2_START&period2_end=$PERIOD2_END"
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: period_1 with label, total_revenue, total_orders, average_order_value
- Contains: period_2 with same fields
- Contains: comparison with revenue_change, order_change, aov_change, trend
- Each change has absolute and percentage

**Validation**:
- revenue_change.absolute = period2.total_revenue - period1.total_revenue
- percentage calculation correct
- trend ∈ [growing, declining, stable]
- Percentages accurate

**Edge Cases**:
```bash
# Test 6a: Missing parameters
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/comparison?\
period1_start=$PERIOD1_START&period1_end=$PERIOD1_END"
# Expected: 400 Bad Request "All parameters required"

# Test 6b: Invalid date format
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/comparison?\
period1_start=03/01/2026&period1_end=03/31/2026&\
period2_start=04/01/2026&period2_end=04/30/2026"
# Expected: 400 Bad Request

# Test 6c: Period 1 = Period 2 (same dates)
# Expected: All changes = 0, trend = stable

# Test 6d: Growing period
# Expected: trend = growing, percentage > 0

# Test 6e: Declining period
# Expected: trend = declining, percentage < 0

# Test 6f: Overlapping periods
# Expected: Should work (may double count some data)
```

---

## Authorization Tests

### Test A: Missing Token

**Steps**:
```bash
curl -X GET \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/financial-analytics/summary
```

**Expected Response (401)**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

### Test B: Invalid Token

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer invalid_token" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/financial-analytics/summary
```

**Expected Response (401)**

---

### Test C: Missing Tenant ID

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  $API/financial-analytics/summary
```

**Expected Response**: 
- Probably 401 or uses tenant from token

---

## Tenant Isolation Tests

### Test 1: Data Isolation

**Setup**:
- Tenant A with orders
- Tenant B with orders

**Steps - Tenant A**:
```bash
export TOKEN_A="token-for-tenant-a"
export TENANT_A="tenant-a-id"
curl -X GET \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "X-Tenant-ID: $TENANT_A" \
  $API/financial-analytics/summary
```

**Steps - Tenant B**:
```bash
export TOKEN_B="token-for-tenant-b"
export TENANT_B="tenant-b-id"
curl -X GET \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "X-Tenant-ID: $TENANT_B" \
  $API/financial-analytics/summary
```

**Expected**: 
- Summary for Tenant A ≠ Summary for Tenant B
- Each tenant only sees their own data

---

## Performance Tests

### Test 1: Summary (Fast Query)
```bash
time curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/financial-analytics/summary
```

**Expected**: Response time < 500ms

---

### Test 2: Daily Revenue (Medium Query)
```bash
time curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/financial-analytics/daily-revenue?days=90
```

**Expected**: Response time < 1000ms

---

### Test 3: Comparison (Complex Query)
```bash
time curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/comparison?\
period1_start=2026-01-01&period1_end=2026-03-31&\
period2_start=2026-04-01&period2_end=2026-06-30"
```

**Expected**: Response time < 2000ms

---

## Data Consistency Tests

### Test 1: Math Validation

```bash
# Get summary
SUMMARY=$(curl -s $API/financial-analytics/summary \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

# Extract values
TOTAL=$(echo $SUMMARY | jq '.total_revenue')
COMM=$(echo $SUMMARY | jq '.platform_commission')
NET=$(echo $SUMMARY | jq '.net_revenue')

# Calculate expected
EXPECTED=$((TOTAL - COMM))

# Verify
if [ "$NET" == "$EXPECTED" ]; then
  echo "✓ Net revenue calculation correct"
else
  echo "✗ Net revenue calculation FAILED"
fi
```

---

### Test 2: Payment Method Totals

```bash
# Get payment methods
METHODS=$(curl -s $API/financial-analytics/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

# Extract totals
CASH=$(echo $METHODS | jq '.breakdown.cash.total')
MTN=$(echo $METHODS | jq '.breakdown.mtn.total')
AIRTEL=$(echo $METHODS | jq '.breakdown.airtel.total')
TOTAL=$(echo $METHODS | jq '.summary.total_revenue')

# Calculate expected
EXPECTED=$((CASH + MTN + AIRTEL))

# Verify
if [ "$TOTAL" == "$EXPECTED" ]; then
  echo "✓ Payment method totals correct"
else
  echo "✗ Payment method totals FAILED"
  echo "Expected: $EXPECTED, Got: $TOTAL"
fi
```

---

## Bash Test Script

```bash
#!/bin/bash

API="${API:-http://localhost:3000}"
TOKEN="${TOKEN:-your_token}"
TENANT_ID="${TENANT_ID:-your_tenant_id}"

echo "=== Financial Analytics API Tests ==="
echo ""

# Test 1: Summary
echo "Test 1: Get Summary"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/summary" | jq .

# Test 2: Daily Revenue
echo ""
echo "Test 2: Get Daily Revenue (7 days)"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/daily-revenue?days=7" | jq .

# Test 3: Payment Methods
echo ""
echo "Test 3: Get Payment Methods"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/payment-methods" | jq .

# Test 4: Metrics
echo ""
echo "Test 4: Get Metrics"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/metrics" | jq .

# Test 5: Comparison
echo ""
echo "Test 5: Get Comparison"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/financial-analytics/comparison?\
period1_start=2026-03-01&period1_end=2026-03-31&\
period2_start=2026-04-01&period2_end=2026-04-30" | jq .

echo ""
echo "=== Tests Complete ==="
```

**Usage**:
```bash
chmod +x test_financial_analytics.sh
export TOKEN="your_token" TENANT_ID="your_tenant_id"
./test_financial_analytics.sh
```
