# 🧪 Flutterwave Payment Testing Guide

**Date:** April 12, 2026  
**Environment:** Staging (Test Mode)  
**Status:** ✅ Ready to Test NOW

---

## Quick Start: Can I Test NOW?

✅ **YES!** Your environment is configured with:
- ✅ Flutterwave staging credentials
- ✅ Backend payment system implemented
- ✅ All features ready
- ✅ Database tables created

**What You Need:** 5-10 minutes setup

---

## Part 1: Pre-Testing Verification

### Step 1: Verify Backend is Running

```bash
# In terminal, go to backend folder
cd backend

# Check if backend is running
npm run dev
# OR if already built:
node dist/main.js

# Expected output:
# ✅ Server running on http://localhost:3001
# ✅ Database connected
# ✅ Redis connected
# ✅ Listening on port 3001
```

### Step 2: Verify Database Connection

```bash
# Connect to PostgreSQL
psql -U restop -d restop_db -h localhost

# Verify tables exist
\dt

# Expected tables to see:
✅ orders
✅ payment_transactions
✅ payouts
✅ commissions
✅ admin_wallet
✅ admin_ledger
✅ tenant_payment_accounts
✅ idempotency_keys
✅ fraud_reviews

# Exit
\q
```

### Step 3: Verify Data Models

```bash
# Check if you have test data
psql -U restop -d restop_db -h localhost << EOF
SELECT COUNT(*) as tenants FROM tenants;
SELECT COUNT(*) as customers FROM customers;
SELECT COUNT(*) as orders FROM orders;
SELECT COUNT(*) as restaurant_items FROM restaurant_menu_items;
EOF

# If empty, see "Part 2: Create Test Data" below
```

### Step 4: Verify Flutterwave Credentials

Your `.env` already has:
```
✅ FLUTTERWAVE_CLIENT_ID=1062848d-3d4a-4b2f-a1ab-83df08c60e2c
✅ FLUTTERWAVE_SECRET_KEY=2wK9oVjl3bYQBSTpdhOZhTmO3kvGvecG
✅ FLUTTERWAVE_SECRET_HASH=xgXqJWYWeO5MS+BXKIBhZa7lCcICvrvej8BtS3pT9RM=
✅ FLUTTERWAVE_ENV=staging
```

**Status:** ✅ **Ready for testing**

---

## Part 2: Create Test Data (If Needed)

### Create Test Tenant

```bash
# Create a restaurant/tenant in database
psql -U restop -d restop_db << EOF
INSERT INTO tenants (
  id, 
  name, 
  email, 
  phone, 
  status, 
  created_at
) VALUES (
  'test-tenant-001',
  'Test Pizza Shop',
  'pizza@test.rw',
  '0788123456',
  'ACTIVE',
  NOW()
) RETURNING id, name;
EOF

# Expected output:
#        id        |       name
# ------------------+------------------
#  test-tenant-001  | Test Pizza Shop
```

### Create Test Restaurant Staff User

```bash
# Create staff user
psql -U restop -d restop_db << EOF
INSERT INTO users (
  id,
  email,
  password_hash,
  first_name,
  phone,
  role,
  tenant_id,
  status,
  created_at
) VALUES (
  'staff-001',
  'staff@pizza.rw',
  '\$2b\$10\$KxXX...', -- bcrypt hash of 'Test@1234'
  'Pizza Staff',
  '0788111111',
  'STAFF',
  'test-tenant-001',
  'ACTIVE',
  NOW()
) RETURNING id, email, role;
EOF
```

### Create Test Customer

```bash
psql -U restop -d restop_db << EOF
INSERT INTO customers (
  id,
  email,
  phone,
  first_name,
  country_code,
  created_at
) VALUES (
  'customer-001',
  'customer@test.rw',
  '0788222222',
  'Test Customer',
  'RW',
  NOW()
) RETURNING id, email, phone;
EOF
```

### Create Test Menu Item

```bash
psql -U restop -d restop_db << EOF
INSERT INTO restaurant_menu_items (
  id,
  tenant_id,
  name,
  description,
  price,
  currency,
  category,
  status,
  created_at
) VALUES (
  'menu-001',
  'test-tenant-001',
  'Margherita Pizza',
  'Classic pizza with mozzarella',
  5000,
  'RWF',
  'Main Course',
  'ACTIVE',
  NOW()
) RETURNING id, name, price;
EOF

# Expected output:
#    id    |        name        | price
# ---------+--------------------+-------
#  menu-001| Margherita Pizza   | 5000
```

### Register Tenant Payment Account

This is needed for payouts. Will need to use API:

```bash
# First, login as staff to get JWT token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@pizza.rw",
    "password": "Test@1234"
  }'

# Response will have: challenge_id and expires_at
# Then verify OTP (check console or database)
# Get access_token

# Then register payment account
curl -X POST http://localhost:3001/api/v1/payment-accounts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "network": "MTN",
    "momo_number": "0788123456",
    "account_name": "Pizza Shop MTN Account"
  }'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "id": "account-uuid",
#     "network": "MTN",
#     "momo_number": "+250788123456",
#     "is_default": true
#   }
# }
```

---

## Part 3: Test Payment Flow

### Test 1: Create an Order

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant-001",
    "items": [
      {
        "menu_item_id": "menu-001",
        "quantity": 2,
        "price": 5000
      }
    ],
    "delivery_address": "123 Main St, Kigali",
    "customer_phone": "0788222222"
  }'

# Expected response:
# {
#   "id": "order-uuid",
#   "status": "PENDING",
#   "total_amount": 10000,
#   "currency": "RWF"
# }

# SAVE THE ORDER ID FOR NEXT STEPS
```

### Test 2: Initiate Payment (MTN)

```bash
# Pay using MTN Mobile Money
curl -X POST http://localhost:3001/api/v1/orders/ORDER_UUID/pay \
  -H "Authorization: Bearer CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $(uuidgen)" \
  -d '{
    "payment_method": "MTN",
    "customer_phone": "0788222222",
    "description": "Order for 2x Pizza"
  }'

# Expected response (201):
# {
#   "ok": true,
#   "order": {
#     "id": "order-uuid",
#     "status": "PENDING",
#     "total_amount": 10000
#   },
#   "transaction": {
#     "id": "tx-uuid",
#     "provider_ref": "flutterwave-tx-id",
#     "status": "INITIATED",
#     "amount": 10000
#   }
# }
```

### Test 3: Verify Payment in Database

```bash
# Check transaction created
psql -U restop -d restop_db << EOF
SELECT 
  id,
  order_id,
  payment_method,
  amount,
  status,
  created_at
FROM payment_transactions 
WHERE order_id = 'ORDER_UUID'
ORDER BY created_at DESC;
EOF

# Expected:
# - status: INITIATED (waiting for webhook)
# - amount: 10000
# - payment_method: MTN
```

### Test 4: Simulate Webhook (Flutterwave Payment Confirmation)

In test mode, Flutterwave won't actually charge MTN until you simulate complete. Use curl to simulate:

```bash
# This simulates Flutterwave sending webhook that payment is complete
curl -X POST http://localhost:3001/api/v1/webhooks/flutterwave \
  -H "Content-Type: application/json" \
  -H "x-verif-hash: YOUR_WEBHOOK_SECRET" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": "flutterwave-tx-id",
      "tx_ref": "ORDER_UUID",
      "amount": 10000,
      "currency": "RWF",
      "status": "successful",
      "customer": {
        "name": "Test Customer",
        "email": "customer@test.rw",
        "phone_number": "0788222222"
      }
    }
  }'

# Expected response (200):
# {
#   "ok": true,
#   "message": "Webhook processed successfully"
# }
```

### Test 5: Verify Commission Was Deducted

After webhook, verify the commission flow:

```bash
psql -U restop -d restop_db << EOF
-- Check payment status
SELECT status FROM payment_transactions 
WHERE order_id = 'ORDER_UUID';
-- Expected: COMPLETED

-- Check commission recorded
SELECT id, amount, status FROM commissions 
WHERE order_id = 'ORDER_UUID';
-- Expected: 1000 RWF, status: PENDING

-- Check admin wallet updated
SELECT available_balance, pending_balance
FROM admin_wallet 
WHERE wallet_type = 'PLATFORM_FEES';
-- Expected: available_balance increased by 1000

-- Check payout created (9000 = 10000 - 10% commission)
SELECT id, amount, status FROM payouts 
WHERE order_id = 'ORDER_UUID';
-- Expected: 9000 RWF, status: PENDING

-- Check order status updated
SELECT payment_status FROM orders 
WHERE id = 'ORDER_UUID';
-- Expected: PAID
EOF
```

### Test 6: Verify Payout to Tenant

```bash
# Check payout was triggered
psql -U restop -d restop_db << EOF
SELECT 
  p.id,
  p.amount,
  p.status,
  p.created_at,
  ta.momo_number
FROM payouts p
LEFT JOIN tenant_payment_accounts ta ON p.tenant_payment_account_id = ta.id
WHERE p.order_id = 'ORDER_UUID';
EOF

# Expected:
# - id: payout-uuid
# - amount: 9000
# - status: PENDING (Flutterwave will process)
# - momo_number: +250788123456 (tenant's account)
```

---

## Part 4: Test Cash Payment Flow

### Create Order (Same as Above)

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer CUSTOMER_JWT" \
  -d '{ ... }' # Same as Test 1
```

### Mark as Cash Payment

```bash
# Staff marks order as paid when customer pays cash
curl -X PATCH http://localhost:3001/api/v1/orders/ORDER_UUID/mark-paid \
  -H "Authorization: Bearer STAFF_JWT" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $(uuidgen)" \
  -d '{
    "tenant_id": "test-tenant-001"
  }'

# Expected response (200):
# {
#   "ok": true,
#   "message": "Cash order marked as paid and commission recorded",
#   "order": {
#     "id": "order-uuid",
#     "payment_status": "PAID"
#   },
#   "commission": {
#     "id": "commission-uuid",
#     "amount": 1000,
#     "status": "PENDING"
#   }
# }
```

### Verify Commission (Same as Test 5)

Commission should be automatic without webhook.

---

## Part 5: Test Admin Features

### View Platform Commission Wallet

```bash
# Login as admin first
curl -X GET http://localhost:3001/api/v1/admin/wallet \
  -H "Authorization: Bearer ADMIN_JWT"

# Expected response:
# {
#   "admin_wallets": [
#     {
#       "wallet_type": "PLATFORM_FEES",
#       "available_balance": 2000,      # From 2 orders
#       "pending_balance": 0,
#       "total_accumulated": 2000
#     }
#   ]
# }
```

### View Commission Ledger

```bash
curl -X GET http://localhost:3001/api/v1/admin/ledger \
  -H "Authorization: Bearer ADMIN_JWT"

# Expected response:
# {
#   "entries": [
#     {
#       "id": "ledger-entry-1",
#       "amount": 1000,
#       "transaction_type": "COMMISSION",
#       "order_id": "order-1",
#       "created_at": "2026-04-12T10:30:00Z"
#     },
#     {
#       "id": "ledger-entry-2",
#       "amount": 1000,
#       "transaction_type": "COMMISSION",
#       "order_id": "order-2",
#       "created_at": "2026-04-12T10:35:00Z"
#     }
#   ]
# }
```

---

## Part 6: Test Idempotency (Duplicate Prevention)

### Double-Pay with Same Idempotency Key

```bash
# First request
curl -X POST http://localhost:3001/api/v1/orders/ORDER_UUID/pay \
  -H "Authorization: Bearer CUSTOMER_JWT" \
  -H "idempotency-key: test-key-12345" \
  -d '{ ... }'

# Response #1: Created new transaction

# Second request (same key)
curl -X POST http://localhost:3001/api/v1/orders/ORDER_UUID/pay \
  -H "Authorization: Bearer CUSTOMER_JWT" \
  -H "idempotency-key: test-key-12345" \
  -d '{ ... }'

# Response #2: Returns CACHED response from first request
# Database check: Only 1 transaction created (not 2!)
```

---

## Part 7: Test Error Cases

### Invalid Phone Number

```bash
curl -X POST http://localhost:3001/api/v1/payment-accounts \
  -H "Authorization: Bearer STAFF_JWT" \
  -d '{
    "network": "MTN",
    "momo_number": "invalid123",
    "account_name": "Test"
  }'

# Expected response (400):
# {
#   "statusCode": 400,
#   "message": "Invalid phone number format..."
# }
```

### Duplicate Account

```bash
# First: Create account (succeeds)
curl -X POST http://localhost:3001/api/v1/payment-accounts \
  -d '{"network": "MTN", "momo_number": "0788123456", ...}'

# Second: Try same network (fails)
curl -X POST http://localhost:3001/api/v1/payment-accounts \
  -d '{"network": "MTN", "momo_number": "0788999999", ...}'

# Expected response (400):
# {
#   "statusCode": 400,
#   "message": "Account already exists for MTN network..."
# }
```

### Bad Webhook Signature

```bash
curl -X POST http://localhost:3001/api/v1/webhooks/flutterwave \
  -H "x-verif-hash: wrong-hash-value" \
  -d '{ ... }'

# Expected response (401):
# {
#   "statusCode": 401,
#   "message": "Webhook verification failed"
# }
```

---

## Part 8: Common Issues & Solutions

### Issue 1: "Database Connection Failed"
```
Solution:
1. Verify PostgreSQL is running:
   - Windows: Check Services
   - MAC: brew services list | grep postgres
   - Linux: systemctl status postgresql

2. Check credentials in .env match actual DB
3. Verify DB exists: psql -l | grep restop
```

### Issue 2: "Flutterwave API Error"
```
Solution:
1. Check credentials in .env are correct (non-empty)
2. Verify FLUTTERWAVE_ENV=staging (not production)
3. Check network connectivity
4. Review backend logs for full error:
   - Check dist/main.js output
   - Look in logs directory
```

### Issue 3: "Payment Status Not Updating"
```
Solution:
1. Webhook not arriving? 
   - Use curl to simulate (see Part 4)
   - Check webhook URL in Flutterwave dashboard
   - Verify webhook secret in .env

2. Not seeing commission?
   - Check background jobs are running
   - Look for scheduler logs
   - Manually trigger job if needed
```

### Issue 4: "Payout Not Created"
```
Solution:
1. Check payment status is PAID
2. Check tenant has payment account
3. Check admin_wallet exists
4. Look for commission record
5. Check error logs
```

---

## Part 9: Quick Testing Checklist

Before declaring "ready":

```
Data Setup:
✅ [ ] Test tenant created
✅ [ ] Test staff user created
✅ [ ] Test customer created
✅ [ ] Test menu item created
✅ [ ] Tenant payment account registered

Mobile Money Payment:
✅ [ ] Order created successfully
✅ [ ] Payment initiated to MTN
✅ [ ] Webhook simulated
✅ [ ] Order status changed to PAID
✅ [ ] Commission calculated (10%)
✅ [ ] Admin wallet updated
✅ [ ] Payout created (90%)

Cash Payment:
✅ [ ] Order created successfully
✅ [ ] Staff marked as paid
✅ [ ] Commission recorded instantly
✅ [ ] Admin wallet updated

Admin Features:
✅ [ ] Can view wallet balance
✅ [ ] Can view commission ledger
✅ [ ] Ledger shows correct amounts

Error Handling:
✅ [ ] Invalid phone rejected
✅ [ ] Duplicate account rejected
✅ [ ] Bad webhook rejected
✅ [ ] Idempotency works
```

---

## Part 10: Next Steps After Testing

### If Everything Works ✅
1. Push code to staging server
2. Configure Flutterwave webhook URL to point to staging
3. Run 10 real test transactions
4. Verify funds reach tenant test account
5. Launch MVP!

### If Issues Found ⚠️
1. Check logs: `tail -f backend.log`
2. Debug in database directly
3. Review error messages
4. Contact Flutterwave support if API issue
5. Fix and re-test

---

## Testing Tools

### Use Postman
```
Import API endpoints:
- collection.json in /docs
OR
- Manually create requests using examples above
```

### Use cURL (Terminal)
```
All examples above use curl
Great for quick testing
```

### Use Frontend
```
If UI built: Use normal checkout flow
System will call backend APIs
Watch for errors in browser console & backend logs
```

---

## Status After Testing

**If all tests pass:** ✅ Ready for MVP launch  
**If some tests fail:** ⚠️ Fix and re-test  
**If critical issues:** ❌ Don't launch yet

---

**Current Status:** 🟢 **READY TO TEST NOW**

All infrastructure is in place. Start with Part 3 "Test Payment Flow" immediately.

Last Updated: April 12, 2026
