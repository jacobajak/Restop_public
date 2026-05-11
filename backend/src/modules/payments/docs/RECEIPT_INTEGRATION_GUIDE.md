# Receipt Integration Guide

## Quick Setup

### 1. Register ReceiptController (✅ Already Done)

The ReceiptController is now registered in PaymentsModule:

```typescript
// src/modules/payments/payments.module.ts
controllers: [
  PaymentController,
  RefundController,
  ReceiptController,  // ✅ Added
  // ... other controllers
]
```

### 2. Available API Endpoints

```
CUSTOMER ENDPOINTS:
  GET    /receipts/:orderId                  - Get receipt (JSON/text/HTML)
  GET    /receipts/:orderId/download         - Download as text file
  POST   /receipts/:orderId/send             - Send via SMS/Email

ADMIN ENDPOINTS:
  GET    /admin/receipts                     - List receipts (Phase 5)
  POST   /admin/receipts/:receiptId/resend   - Resend receipt
```

### 3. Using ReceiptService Directly

**In TransactionVerificationService** (post-payment verification):

```typescript
// After payment confirmed as PAID
try {
  // Generate receipt
  const receipt = await this.receiptService.generateReceiptData(order.id);
  this.logger.log(`✅ Receipt generated: ${receipt.receipt_id}`);

  // Fire-and-forget SMS delivery (will retry via NotificationsService)
  this.receiptService.sendReceiptViaSMS(order.id)
    .catch(err => this.logger.error(`Receipt SMS failed: ${err.message}`));
} catch (error) {
  this.logger.error(`Receipt generation failed: ${error.message}`);
  // Don't fail payment if receipt generation fails
}
```

### 4. Receipt Data Available Immediately

Once generated, receipts can be accessed via:

```typescript
// JSON format (API responses)
const json = await receiptService.getReceiptJSON(orderId);

// Text format (SMS, console, downloads)
const text = await receiptService.getReceiptText(orderId);

// HTML format (Email, web display)
const html = await receiptService.getReceiptHTML(orderId);
```

## Delivery Channels

### SMS Delivery
```typescript
// Customer requests SMS delivery
POST /receipts/order-123/send
{
  "channel": "sms"
}

// Send from service code
await receiptService.sendReceiptViaSMS(orderId);
```

**Notes**:
- Uses order's phone_number field
- Fails gracefully if no phone available
- Retry strategy will be added in Phase 5

### Email Delivery
```typescript
// Customer requests email delivery
POST /receipts/order-123/send
{
  "channel": "email",
  "email": "customer@example.com"
}

// Send from service code
await receiptService.sendReceiptViaEmail(orderId, 'customer@example.com');
```

**Notes**:
- Requires explicit email in body (Phase 5 will fetch from User profile)
- HTML formatted receipt
- Retry strategy will be added in Phase 5

### Self-Service Download
```bash
# JSON format
GET /receipts/order-123

# Text file
GET /receipts/order-123?format=text

# HTML file
GET /receipts/order-123?format=html
```

## Data Included in Receipt

```
✅ Receipt ID (RCP-{orderID}-{timestamp})
✅ Order details (number, code, date, total)
✅ Payment details (method, status, amount, Flutterwave ref)
✅ Merchant info (name, phone, location)
✅ Customer info (name, phone)
✅ Amount breakdown (subtotal, tax, fees, total)
```

## Error Handling

```typescript
// Order not found
❌ NotFoundException: "Order ABC123 not found"

// No phone for SMS
❌ BadRequestException: "Order has no customer phone number"

// Unpaid order
❌ BadRequestException: "Cannot send receipt for unpaid order"

// Email channel without email
❌ BadRequestException: "Email is required for email delivery"
```

## Receipt ID Generation

```
Format: RCP-{orderID_first_8_chars}-{timestamp_base36}
Example: RCP-A1B2C3D4-ABC123XY@2024-01-15T10:30:00

Generates unique, sortable, human-readable IDs
```

## Next Steps (Phase 5)

**Planned Enhancements**:

1. **Audit Trail**
   - Create `receipt_logs` table
   - Track generation, delivery channel, status
   - Support for resend tracking

2. **Email Service Integration**
   - Wire NotificationsService.sendEmail()
   - Template customization
   - HTML template variables

3. **Retry Strategy**
   - Integrate RetryStrategyService
   - 3 attempts with exponential backoff
   - Circuit breaker protection

4. **PDF Support**
   - Add `getReceiptPDF()` method
   - Support PDF downloads
   - Print-optimized format

5. **Advanced Queries**
   - Admin receipt search
   - Filter by date range, customer, status
   - Export audit reports

6. **Compliance**
   - VAT/Tax documentation
   - Audit trail export
   - Retention policies

## Testing Phase 4

### Manual Testing

1. **Generate Receipt**
   ```bash
   GET /receipts/order-123
   # Returns JSON receipt
   ```

2. **Download as Text**
   ```bash
   GET /receipts/order-123?format=text
   # Downloads receipt-order-123.txt
   ```

3. **Get HTML Version**
   ```bash
   GET /receipts/order-123?format=html
   # Returns HTML for email/web
   ```

4. **Request SMS Delivery**
   ```bash
   POST /receipts/order-123/send
   { "channel": "sms" }
   # Returns: { "success": true, "message": "Receipt SMS sent..." }
   ```

5. **Admin Resend**
   ```bash
   POST /admin/receipts/order-123/resend
   { "channel": "email", "email": "test@example.com" }
   # Returns: { "success": true, "message": "Receipt email sent..." }
   ```

### Unit Tests

See `E_RECEIPT_SYSTEM.md` → Testing Examples section for full test suites.

## Common Issues

**Q: How to access receipt in mobile app?**
- `GET /receipts/order-123` returns JSON
- Mobile app can display using returned data
- Can call same API for "Resend" feature

**Q: How to ensure customer receives receipt?**
- Phase 4: Customer self-service access + manual delivery
- Phase 5: Automatic SMS after payment + retry logic
- Phase 5: Email on-demand with delivery tracking

**Q: How to handle delivery failures?**
- Phase 4: Service logs all errors
- Phase 5: Automatic retry (3 attempts)
- Phase 5: Fallback channel (SMS → Email)
- Phase 5: Admin resend capability

**Q: Do receipts expire?**
- Currently: No expiration
- Phase 5: Configure retention policy
- Phase 5: Support archive/restore flow

## API Authentication

All endpoints require JWT token:

```bash
Headers: Authorization: Bearer {JWT_TOKEN}

# Customer can only access their own receipts
GET /receipts/order-123
# Validates: order belongs to authenticated customer

# Admin can access any receipt
POST /admin/receipts/order-123/resend
# Role: ADMIN required
```

## Metrics & Monitoring

**Phase 4** (Available now):
- Logger: All operations logged with context
- Error tracking: Detailed error messages
- Performance: Fast JSON/text generation

**Phase 5** (Planned):
- Receipt generation metrics (avg time)
- Delivery success rate (SMS/Email)
- Retry statistics
- Audit trail queries

---

**Status**: ✅ Phase 4 Complete - Ready for Production Testing
