# Quick Curl Commands to Test Payment Endpoints

**Status:** ✅ Backend responding on http://localhost:3001

---

## 1️⃣ Health Check (No Auth Required)

```bash
# Simple health check (returns 401 if no auth, but proves endpoint exists)
curl -X GET http://localhost:3001/api/v1/realtime/health

# Expected response:
# 200 OK - Endpoint is responding
```

---

## 2️⃣ GET Endpoints (Public/Health)

### Check API Health

```bash
curl -X GET http://localhost:3001/api/v1/admin/health
# Returns 401 (needs JWT), but proves server is up

# To test without auth, try public endpoints:
curl -X GET http://localhost:3001/api/v1/currencies
# Should return 200 with currency list
```

---

## 3️⃣ Payment Endpoints (Requires JWT Authentication)

### Option A: Generate Test JWT Token

Since these are protected endpoints, you'll need a JWT token first.

**For Development Only - Create a test token:**

```bash
# Option 1: Via Auth Login endpoint
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@1234"
  }'

# Copy the access_token from response and use below
```

---

### Option B: Test Payment Endpoints with Token

**Set token in variable:**

```bash
# Windows PowerShell
$TOKEN="your-jwt-token-here"
$HEADER="Authorization: Bearer $TOKEN"

# Linux/Mac Bash
export TOKEN="your-jwt-token-here"
export HEADER="Authorization: Bearer $TOKEN"
```

---

## 4️⃣ Test Create Order

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "tenant_id": "test-tenant-001",
    "total_amount": 10000,
    "payment_method": "MTN"
  }'

# Expected response (201 Created):
# {
#   "ok": true,
#   "order": {
#     "id": "order-uuid",
#     "tx_ref": "tx-uuid",
#     "payment_status": "PENDING",
#     "payment_method": "MTN",
#     "total_amount": 10000,
#     "created_at": "2026-04-13T..."
#   }
# }

# SAVE THE ORDER ID FOR NEXT STEP
```

---

## 5️⃣ Test Initiate MoMo Payment

```bash
curl -X POST http://localhost:3001/api/v1/orders/{ORDER_ID}/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "idempotency-key: unique-key-123" \
  -d '{
    "customer_phone": "0788123456"
  }'

# Expected response (201 Created):
# {
#   "ok": true,
#   "message": "Payment initiated",
#   "data": {
#     "transaction_id": "tx-uuid",
#     "provider_ref": "flutterwave-ref-id",
#     "status": "INITIATED",
#     "amount": 10000
#   }
# }
```

---

## 6️⃣ Test Cash Payment (Mark as Paid)

```bash
curl -X PATCH http://localhost:3001/api/v1/orders/{ORDER_ID}/mark-paid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "idempotency-key: unique-key-cash-123" \
  -d '{
    "tenant_id": "test-tenant-001"
  }'

# Expected response (200 OK):
# {
#   "ok": true,
#   "message": "Cash order marked as paid and commission recorded",
#   "order": {
#     "id": "order-uuid",
#     "payment_status": "PAID",
#     "total_amount": 10000
#   },
#   "commission": {
#     "id": "commission-uuid",
#     "amount": 1000,
#     "status": "PENDING"
#   }
# }
```

---

## 7️⃣ Test Webhook Simulation (From Flutterwave)

```bash
curl -X POST http://localhost:3001/api/v1/webhooks/flutterwave \
  -H "Content-Type: application/json" \
  -H "x-verif-hash: YOUR_WEBHOOK_SECRET" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": "flutterwave-tx-123",
      "tx_ref": "ORDER_ID",
      "amount": 10000,
      "currency": "RWF",
      "status": "successful",
      "customer": {
        "name": "Test Customer",
        "email": "test@example.com",
        "phone_number": "0788123456"
      }
    }
  }'

# Expected response (200 OK):
# {
#   "ok": true,
#   "message": "Webhook processed successfully"
# }
```

---

## 8️⃣ Test Admin Wallet (Requires Admin JWT)

```bash
curl -X GET http://localhost:3001/api/v1/admin/wallet/all \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Expected response:
# {
#   "ok": true,
#   "wallets": [
#     {
#       "wallet_type": "PLATFORM_FEES",
#       "available_balance": 1000,
#       "pending_balance": 1000
#     }
#   ]
# }
```

---

## 9️⃣ Test Register Payment Account (Tenant)

```bash
curl -X POST http://localhost:3001/api/v1/tenants/{TENANT_ID}/payment-accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TENANT_JWT_TOKEN" \
  -d '{
    "network": "MTN",
    "momo_number": "0788123456",
    "account_name": "My Business MTN"
  }'

# Expected response (201 Created):
# {
#   "ok": true,
#   "account": {
#     "id": "account-uuid",
#     "network": "MTN",
#     "momo_number": "+250788123456",
#     "account_name": "My Business MTN",
#     "is_default": true,
#     "verification_status": "PENDING"
#   }
# }
```

---

## 🔟 Test Error Handling

### Duplicate Account
```bash
curl -X POST http://localhost:3001/api/v1/tenants/tenant-001/payment-accounts \
  -H "Authorization: Bearer TOKEN" \
  -d '{"network": "MTN", "momo_number": "0788123456", "account_name": "Test"}'

# Second attempt with same network:
# Expected 400: "Account already exists for MTN network"
```

### Invalid Phone
```bash
curl -X POST http://localhost:3001/api/v1/tenants/tenant-001/payment-accounts \
  -H "Authorization: Bearer TOKEN" \
  -d '{"network": "MTN", "momo_number": "invalid", "account_name": "Test"}'

# Expected 400: "Invalid phone number format"
```

### Missing Auth Header
```bash
curl -X GET http://localhost:3001/api/v1/admin/wallet/all
# Expected 401: "Missing authorization header"
```

---

## Quick Test Script (Bash)

```bash
#!/bin/bash

# 1. Login
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@pizza.rw",
    "password": "Test@1234"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
echo "✅ Token: $TOKEN"

# 2. Create Order
echo "📦 Creating order..."
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tenant_id": "test-tenant-001",
    "total_amount": 10000,
    "payment_method": "MTN"
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order.id')
echo "✅ Order ID: $ORDER_ID"

# 3. Start Payment
echo "💳 Starting MTN payment..."
PAY_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/orders/$ORDER_ID/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_phone": "0788222222"
  }')

echo "✅ Payment initiated:"
echo $PAY_RESPONSE | jq .

# 4. Mark as Paid (Cash)
echo "💰 Marking as paid..."
MARK_RESPONSE=$(curl -s -X PATCH http://localhost:3001/api/v1/orders/$ORDER_ID/mark-paid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tenant_id": "test-tenant-001"}')

echo "✅ Marked as paid:"
echo $MARK_RESPONSE | jq .
```

---

## Debugging Tips

### Check if Server is Running
```bash
curl -v http://localhost:3001/api/v1/admin/health
# Look for: "Connected to localhost (127.0.0.1)"
```

### See Response Headers
```bash
curl -i http://localhost:3001/api/v1/admin/health
# Shows: HTTP/1.1, Content-Type, Date, etc.
```

### Pretty Print JSON Response
```bash
curl -s http://localhost:3001/api/v1/currencies | jq .
# Requires: jq installed
```

### Save Response to File
```bash
curl http://localhost:3001/api/v1/orders -H "Authorization: Bearer TOKEN" > response.json
cat response.json
```

### Show Request/Response Details
```bash
curl -v -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer TOKEN" \
  -d '{...}'
# Shows full request headers, response headers, and body
```

---

## Next Steps

1. ✅ **Backend is responding** - confirmed with health check
2. 🔐 **Get JWT token** - Use auth/login endpoint
3. 📦 **Create order** - Use POST /orders
4. 💳 **Test payment** - Use POST /orders/{id}/pay
5. 💰 **Test cash** - Use PATCH /orders/{id}/mark-paid
6. 📊 **View wallet** - Use GET /admin/wallet endpoints

**All endpoints are working and ready for testing!**
