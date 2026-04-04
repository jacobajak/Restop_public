# 📡 API Request/Response Cheat Sheet

## Complete API Examples - Copy & Paste Ready

All endpoints require authentication (JWT token in Authorization header).

---

## 1️⃣ CREATE PAYMENT ACCOUNT

### Request
```bash
curl -X POST http://localhost:3001/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "momo_number": "0788123456",
    "account_name": "John Doe"
  }'
```

### Response (201 Created)
```json
{
  "success": true,
  "message": "Payment account saved. Awaiting admin verification.",
  "data": {
    "id": "66f456e5-33c0-4c76-9f56-abcd1234efgh",
    "network": "MTN",
    "momo_number": "0788123456",
    "account_name": "John Doe",
    "is_verified": false,
    "is_default": true,
    "created_at": "2026-03-18T10:30:45.123Z"
  }
}
```

### Response (400 Bad Request - Invalid Phone)
```json
{
  "statusCode": 400,
  "message": "Invalid phone number format. Use format like 0788111111 or +250788111111",
  "error": "Bad Request"
}
```

### Response (404 Not Found - Tenant Missing)
```json
{
  "statusCode": 404,
  "message": "Tenant 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

---

## 2️⃣ LIST ALL PAYMENT ACCOUNTS

### Request
```bash
curl -X GET http://localhost:3001/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "66f456e5-33c0-4c76-9f56-abcd1234efgh",
      "network": "MTN",
      "momo_number": "0788123456",
      "account_name": "John Doe",
      "is_verified": false,
      "is_default": true,
      "created_at": "2026-03-18T10:30:45.123Z"
    },
    {
      "id": "77a567f6-44d1-5d87-0g67-bcde2345fghi",
      "network": "AIRTEL",
      "momo_number": "0733654321",
      "account_name": null,
      "is_verified": false,
      "is_default": false,
      "created_at": "2026-03-18T10:35:20.456Z"
    }
  ]
}
```

### Response (200 OK - Empty)
```json
{
  "success": true,
  "data": []
}
```

---

## 3️⃣ GET SPECIFIC PAYMENT ACCOUNT

### Request
```bash
curl -X GET http://localhost:3001/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts/66f456e5-33c0-4c76-9f56-abcd1234efgh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "66f456e5-33c0-4c76-9f56-abcd1234efgh",
    "network": "MTN",
    "momo_number": "0788123456",
    "account_name": "John Doe",
    "is_verified": false,
    "is_default": true,
    "created_at": "2026-03-18T10:30:45.123Z"
  }
}
```

### Response (404 Not Found)
```json
{
  "statusCode": 404,
  "message": "Payment account 66f456e5-33c0-4c76-9f56-abcd1234efgh not found",
  "error": "Not Found"
}
```

---

## 4️⃣ SET ACCOUNT AS DEFAULT

### Request
```bash
curl -X PATCH http://localhost:3001/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts/77a567f6-44d1-5d87-0g67-bcde2345fghi/default \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment account set as default",
  "data": {
    "id": "77a567f6-44d1-5d87-0g67-bcde2345fghi",
    "is_default": true
  }
}
```

**Note:** This automatically sets all other accounts with same network to `is_default = false`

---

## 5️⃣ VERIFY ACCOUNT (ADMIN ONLY)

### Request (Must use admin JWT token with PLATFORM_ADMIN role)
```bash
curl -X PATCH http://localhost:3001/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts/66f456e5-33c0-4c76-9f56-abcd1234efgh/verify \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment account verified and ready for payouts",
  "data": {
    "id": "66f456e5-33c0-4c76-9f56-abcd1234efgh",
    "network": "MTN",
    "is_verified": true
  }
}
```

### Response (403 Forbidden - Not Admin)
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### Response (400 Bad Request - Already Verified)
```json
{
  "statusCode": 400,
  "message": "Account is already verified",
  "error": "Bad Request"
}
```

---

## 6️⃣ DELETE PAYMENT ACCOUNT

### Request
```bash
curl -X DELETE http://localhost:3001/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts/77a567f6-44d1-5d87-0g67-bcde2345fghi \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment account deleted"
}
```

### Response (400 Bad Request - Default Account)
```json
{
  "statusCode": 400,
  "message": "Cannot delete default payment account",
  "error": "Bad Request"
}
```

### Response (400 Bad Request - Verified Account)
```json
{
  "statusCode": 400,
  "message": "Cannot delete verified payment account",
  "error": "Bad Request"
}
```

---

## 🧪 Testing in Browser Console

### Add Account
```javascript
const response = await fetch(
  '/api/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts',
  {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      momo_number: '0788123456',
      account_name: 'John Doe'
    })
  }
);
const data = await response.json();
console.log(data);
```

### List Accounts
```javascript
const response = await fetch(
  '/api/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts',
  { credentials: 'include' }
);
const data = await response.json();
console.log(data.data);
```

### Verify Account (Admin)
```javascript
const response = await fetch(
  '/api/tenants/550e8400-e29b-41d4-a716-446655440000/payment-accounts/66f456e5-33c0-4c76-9f56-abcd1234efgh/verify',
  {
    method: 'PATCH',
    credentials: 'include'
  }
);
const data = await response.json();
console.log(data);
```

---

## 📊 Database Query Examples

### View All Payment Accounts for a Tenant
```sql
SELECT * FROM tenant_payment_accounts 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY is_default DESC, created_at ASC;
```

### View Unverified Accounts (Pending Admin Action)
```sql
SELECT ta.id, ta.tenant_id, t.name AS tenant_name, ta.network, 
       ta.momo_number, ta.account_name, ta.created_at
FROM tenant_payment_accounts ta
JOIN tenants t ON ta.tenant_id = t.id
WHERE ta.is_verified = false
ORDER BY ta.created_at ASC;
```

### View Verified Accounts Ready for Payout
```sql
SELECT ta.id, ta.tenant_id, t.name AS tenant_name, ta.network, 
       ta.momo_number, ta.is_default
FROM tenant_payment_accounts ta
JOIN tenants t ON ta.tenant_id = t.id
WHERE ta.is_verified = true AND ta.is_default = true;
```

### Count Verified vs Unverified
```sql
SELECT 
  is_verified,
  COUNT(*) as count
FROM tenant_payment_accounts
GROUP BY is_verified;
```

---

## 🔍 Real-World Workflow Example

### Step 1: New Tenant Registers
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kigali Kitchen",
    "email": "owner@kigali.com",
    "password": "SecurePass123!"
  }'
# Response includes JWT token
```

### Step 2: Tenant Creates Tenant (Restaurant)
```bash
curl -X POST http://localhost:3001/tenants \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kigali Kitchen",
    "slug": "kigali-kitchen",
    "email": "owner@kigali.com"
  }'
# Response: { id: "tenant-id", ... }
```

### Step 3: Tenant Adds Payment Account
```bash
curl -X POST http://localhost:3001/tenants/tenant-id/payment-accounts \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "momo_number": "0788123456",
    "account_name": "Kigali Kitchen Owner"
  }'
# Response: is_verified = false (awaiting admin)
```

### Step 4: Admin Verifies Account
```bash
curl -X PATCH http://localhost:3001/tenants/tenant-id/payment-accounts/account-id/verify \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
# Response: is_verified = true (ready for payouts!)
```

### Step 5: Customer Orders & Pays
```bash
# Customer scans QR → Orders → Pays with MTN
# Webhook triggers payment confirmation
# PayoutService loads verified account
# Paypack sends 0788123456 their money
# Tenant receives funds ✅
```

---

## ✅ Status Codes Reference

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request successful |
| 201 | Created | Account successfully created |
| 400 | Bad Request | Invalid input (phone format, etc) |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Admin action by non-admin |
| 404 | Not Found | Tenant/Account doesn't exist |
| 409 | Conflict | Account for network already exists |
| 500 | Server Error | Unexpected backend error |

---

## 🔒 Authentication Note

All endpoints require JWT token in `Authorization` header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Admin-Only Endpoints
- `PATCH /tenants/:tenantId/payment-accounts/:accountId/verify`

Required: `UserRole.PLATFORM_ADMIN`

---

## 🚀 Quick Start Test

```bash
# 1. Get your tenant ID (from profile endpoint)
TENANT_ID="your-tenant-id"

# 2. Add MTN account
curl -X POST http://localhost:3001/tenants/$TENANT_ID/payment-accounts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"momo_number": "0788123456", "account_name": "Test"}'

# 3. List accounts
curl -X GET http://localhost:3001/tenants/$TENANT_ID/payment-accounts \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Verify (as admin)
ACCOUNT_ID="id-from-step-2"
curl -X PATCH http://localhost:3001/tenants/$TENANT_ID/payment-accounts/$ACCOUNT_ID/verify \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Done! Account is verified and ready for payouts
```

---

**Last Updated:** March 18, 2026  
**API Version:** v1  
**Status:** ✅ Production Ready
