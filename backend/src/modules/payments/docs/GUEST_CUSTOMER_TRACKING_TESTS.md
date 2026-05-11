# Guest Customer Tracking - Test Scenarios

## Test Setup

### Prerequisites
1. Running backend server on `http://localhost:3000`
2. Valid JWT token (obtained from login)
3. Valid tenant ID with orders in the system
4. Customer phone numbers from existing orders

### Test Configuration
```bash
export API="http://localhost:3000"
export TOKEN="YOUR_JWT_TOKEN"
export TENANT_ID="your-tenant-id"
export PHONE="0788123456"  # Valid customer phone from your system
```

---

## Test Scenarios

### Test 1: Get Customer Profile

**Description**: Retrieve comprehensive profile for a known customer

**Setup**:
1. Use a phone number with multiple orders in the system

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/profile/$PHONE
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: customer_phone, total_orders > 0, total_spent > 0
- Contains: first_order_at, last_order_at (valid dates)
- Contains: favorite_items (array)
- Contains: is_returning_customer boolean
- Contains: customer_lifetime_value > 0

**Edge Cases**:
```bash
# Test 1a: Non-existent customer
export UNKNOWN_PHONE="0799999999"
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/profile/$UNKNOWN_PHONE
# Expected: 200 with all fields as null/0/empty

# Test 1b: Missing phone
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/profile/
# Expected: 404 Not Found

# Test 1c: Invalid phone format
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/profile/invalid
# Expected: 200 (phone format accepted, no matching orders)
```

---

### Test 2: Get Order History

**Description**: Retrieve order history for a customer

**Steps - Default Limit**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/order-history/$PHONE
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: phone, orders array
- Contains: total (count of orders)
- Each order has: order_id, amount, status, created_at, items

**Steps - With Limit**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/order-history/$PHONE?limit=5"
```

**Expected Response**:
- Returns maximum 5 orders (in descending created_at order)

**Edge Cases**:
```bash
# Test 2a: Limit = 1
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/order-history/$PHONE?limit=1"
# Expected: Returns latest 1 order

# Test 2b: Limit > 100 (should cap at 100)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/order-history/$PHONE?limit=500"
# Expected: Returns max 100 orders

# Test 2c: Invalid limit
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/order-history/$PHONE?limit=abc"
# Expected: 400 Bad Request

# Test 2d: Negative limit
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/order-history/$PHONE?limit=-5"
# Expected: 400 Bad Request
```

---

### Test 3: Check if Returning Customer

**Description**: Quick check if customer is returning

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/is-returning/$PHONE
```

**Expected Response (200)**:
- Status: 200 OK
- Returns: phone, is_returning_customer (boolean)
- For known customer with orders: is_returning_customer = true
- For new/unknown customer: is_returning_customer = false

**Test Cases**:
```bash
# Test 3a: Known returning customer
export REPEAT_CUSTOMER="0788123456"  # Multiple orders
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/is-returning/$REPEAT_CUSTOMER
# Expected: is_returning_customer = true

# Test 3b: New customer (no orders)
export NEW_CUSTOMER="0799888888"
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/is-returning/$NEW_CUSTOMER
# Expected: is_returning_customer = false
```

---

### Test 4: Get Tenant Customer Stats

**Description**: Retrieve aggregate customer statistics

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/stats
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: total_unique_customers (integer >= 0)
- Contains: new_customers_today (integer >= 0)
- Contains: returning_customers (integer >= 0)
- Contains: avg_customer_lifetime_value (number >= 0)
- Contains: most_active_customers (array of top 10)
- Each most_active_customer has: phone, orders, spent

**Validation**:
```bash
# Verify stats consistency
# total_unique_customers should be >= new_customers_today + returning_customers
# avg_customer_lifetime_value should be <= max spent by top customers
# most_active_customers should be sorted by spent (descending)
```

---

### Test 5: Get Top Spending Customers

**Description**: Retrieve highest-value customers

**Steps - Default Limit**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/top-spending
```

**Expected Response (200)**:
- Status: 200 OK
- Returns: Array of customer profiles
- Default: 20 customers
- Ordered: By customer_lifetime_value (descending)

**Steps - Custom Limit**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/top-spending?limit=50"
```

**Edge Cases**:
```bash
# Test 5a: Limit = 1
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/top-spending?limit=1"
# Expected: Returns single highest-value customer

# Test 5b: Limit > 100 (should cap at 100)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/top-spending?limit=200"
# Expected: Returns max 100

# Test 5c: Invalid limit
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/top-spending?limit=invalid"
# Expected: 400 Bad Request

# Test 5d: Empty result (new tenant)
# Expected: Returns empty array
```

---

### Test 6: Identify VIP Customers

**Description**: Get customers meeting VIP criteria

**Steps - Default Threshold**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/vip-customers
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: vip_customers (array of phone numbers)
- Contains: total_vips (count)
- Contains: min_lifetime_value (threshold used)

**Steps - Custom Threshold**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/vip-customers?min_lifetime_value=50000"
```

**Edge Cases**:
```bash
# Test 6a: Very high threshold
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/vip-customers?min_lifetime_value=10000000"
# Expected: Returns empty array

# Test 6b: Zero threshold
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/vip-customers?min_lifetime_value=0"
# Expected: Returns all customers (who have spent)

# Test 6c: Negative threshold
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/vip-customers?min_lifetime_value=-100"
# Expected: 400 Bad Request

# Test 6d: Invalid threshold type
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/vip-customers?min_lifetime_value=abc"
# Expected: 400 Bad Request
```

---

### Test 7: Get Acquisition Cohort

**Description**: Analyze customer acquisition and retention

**Steps - 30 Days**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=30"
```

**Expected Response (200)**:
- Status: 200 OK
- Contains: period_days = 30
- Contains: new_customers (integer >= 0)
- Contains: returning_from_previous (integer >= 0)
- Contains: churn_rate (float 0-1)
- Contains: retention_rate (float 0-1)
- Contains: total_active (sum of new + returning)

**Validation**:
```bash
# retention_rate should = 1 - churn_rate
# churn_rate + retention_rate ≈ 1.0
# total_active = new_customers + returning_from_previous
```

**Edge Cases**:
```bash
# Test 7a: 1 day
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=1"
# Expected: Data for 1-day period

# Test 7b: 365 days (full year)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=365"
# Expected: Full year of data

# Test 7c: Beyond max (366 days)
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=366"
# Expected: 400 Bad Request

# Test 7d: Invalid days
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=abc"
# Expected: 400 Bad Request

# Test 7e: Zero days
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=0"
# Expected: 400 Bad Request
```

---

## Authorization Tests

### Test A: Missing Authorization Header

**Steps**:
```bash
curl -X GET \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/stats
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
  $API/guest-customers/stats
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

### Test C: Missing Tenant ID

**Steps**:
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  $API/guest-customers/stats
```

**Expected Response**:
- Should fail or use tenant from JWT token
- Varies by implementation

---

## Tenant Isolation Tests

### Test 1: Data Isolation

**Setup**:
1. Get token for Tenant A
2. Get token for Tenant B

**Steps - Tenant A**:
```bash
export TENANT_A="tenant-a-id"
export TOKEN_A="token-for-tenant-a"
curl -X GET \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "X-Tenant-ID: $TENANT_A" \
  $API/guest-customers/stats
```

**Steps - Tenant B**:
```bash
export TENANT_B="tenant-b-id"
export TOKEN_B="token-for-tenant-b"
curl -X GET \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "X-Tenant-ID: $TENANT_B" \
  $API/guest-customers/stats
```

**Expected**:
- Stats for Tenant A ≠ Stats for Tenant B
- Each tenant only sees their own data

---

## Performance Tests

### Test 1: Large Limit
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/top-spending?limit=100"
```

**Expected**:
- Response time < 2 seconds
- All 100 records returned (if available)

---

### Test 2: Complex Query
```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/stats
```

**Expected**:
- Response time < 1 second
- Complete stats calculated efficiently

---

## Data Consistency Tests

### Test: Stats vs Individual Profiles

**Steps**:
```bash
# Get stats
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/stats

# Get top customer profile
export TOP_PHONE="0788123456"  # From most_active_customers
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  $API/guest-customers/profile/$TOP_PHONE
```

**Validation**:
- Profile's customer_lifetime_value should match stats' most_active_customers.spent
- Profile's total_orders should match stats' most_active_customers.orders

---

## Bash Test Script

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API="${API:-http://localhost:3000}"
TOKEN="${TOKEN:-your_token}"
TENANT_ID="${TENANT_ID:-your_tenant_id}"
PHONE="${PHONE:-0788123456}"

echo -e "${BLUE}=== Guest Customer Tracking API Tests ===${NC}\n"

# Test 1
echo -e "${BLUE}Test 1: Get Customer Profile${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/profile/$PHONE" | jq .
echo ""

# Test 2
echo -e "${BLUE}Test 2: Get Order History${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/order-history/$PHONE?limit=5" | jq .
echo ""

# Test 3
echo -e "${BLUE}Test 3: Check if Returning${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/is-returning/$PHONE" | jq .
echo ""

# Test 4
echo -e "${BLUE}Test 4: Get Stats${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/stats" | jq .
echo ""

# Test 5
echo -e "${BLUE}Test 5: Top Spending${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/top-spending?limit=5" | jq .
echo ""

# Test 6
echo -e "${BLUE}Test 6: VIP Customers${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/vip-customers?min_lifetime_value=50000" | jq .
echo ""

# Test 7
echo -e "${BLUE}Test 7: Acquisition Cohort${NC}"
curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  "$API/guest-customers/acquisition-cohort?days=30" | jq .
echo ""

echo -e "${BLUE}=== Tests Complete ===${NC}"
```

**Usage**:
```bash
chmod +x test_guest_tracking.sh
export TOKEN="your_token" TENANT_ID="your_tenant_id"
./test_guest_tracking.sh
```
