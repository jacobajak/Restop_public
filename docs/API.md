# RESTOP API Documentation

## Base URL
```
http://localhost:3001/api/v1
```

## Authentication
```
Header: Authorization: Bearer <JWT_TOKEN>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { /* ... */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Menu Endpoints

### GET /menu/:slug
Get restaurant menu by tenant slug

**Parameters:**
- `slug` (path) - Restaurant slug

**Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "uuid",
      "name": "Kigali Burger House",
      "slug": "kigali-burger",
      "currency": "RWF"
    },
    "categories": [
      {
        "id": "uuid",
        "name": "Burgers",
        "description": "...",
        "sort_order": 1
      }
    ],
    "items": [
      {
        "id": "uuid",
        "name": "Chicken Burger",
        "description": "...",
        "price": 5000,
        "category_id": "uuid",
        "is_available": true,
        "image_url": "https://..."
      }
    ]
  }
}
```

### POST /menu/items
Create menu item

**Auth:** Required (ADMIN/STAFF)

**Body:**
```json
{
  "category_id": "uuid",
  "name": "Chicken Burger",
  "description": "Grilled chicken with lettuce",
  "price": 5000,
  "image_url": "https://...",
  "is_available": true
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Created menu item */ }
}
```

### PUT /menu/items/:id
Update menu item

**Auth:** Required (ADMIN/STAFF)

**Body:**
```json
{
  "name": "Updated Name",
  "price": 6000,
  "is_available": true
}
```

### DELETE /menu/items/:id
Delete menu item

**Auth:** Required (ADMIN/STAFF)

### PATCH /menu/items/:id/availability
Toggle item availability

**Auth:** Required (ADMIN/STAFF)

**Body:**
```json
{
  "is_available": false
}
```

## Order Endpoints

### POST /orders
Create new order

**Body:**
```json
{
  "tenant_id": "uuid",
  "items": [
    {
      "menu_item_id": "uuid",
      "quantity": 2
    },
    {
      "menu_item_id": "uuid",
      "quantity": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_number": "ORD-1234567890-abcd1234",
    "tenant_id": "uuid",
    "status": "PENDING_PAYMENT",
    "items": [
      {
        "id": "uuid",
        "menu_item_id": "uuid",
        "name": "Chicken Burger",
        "quantity": 2,
        "price": 5000,
        "subtotal": 10000
      }
    ],
    "subtotal": 17000,
    "platform_fee": 510,
    "total_amount": 17510,
    "payment_method": "CASH",
    "payment_status": "PENDING",
    "created_at": "2026-03-07T10:30:00Z"
  }
}
```

### GET /orders
Get orders for authenticated tenant

**Auth:** Required

**Query Parameters:**
- `status` (optional) - Filter by status: PENDING_PAYMENT, CONFIRMED, PREPARING, READY, COMPLETED, REJECTED
- `limit` (optional, default: 20) - Number of results
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [ /* Array of orders */ ],
  "total": 42
}
```

### GET /orders/:id
Get specific order

**Parameters:**
- `id` (path) - Order ID

### PATCH /orders/:id/status
Update order status

**Auth:** Required (ADMIN/STAFF)

**Body:**
```json
{
  "status": "PREPARING"
}
```

**Valid Statuses:**
- CREATED
- PENDING_PAYMENT
- CONFIRMED
- PREPARING
- READY
- COMPLETED
- REJECTED

### PATCH /orders/:id/confirm
Confirm cash payment

**Auth:** Required (ADMIN/STAFF)

Changes status: `PENDING_PAYMENT` → `CONFIRMED`

### PATCH /orders/:id/reject
Reject order

**Auth:** Required (ADMIN/STAFF)

**Body (optional):**
```json
{
  "reason": "Out of stock"
}
```

## Analytics Endpoints

### GET /analytics/sales
Get sales analytics for authenticated tenant

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "total_revenue": 500000,
    "total_orders": 42,
    "average_order_value": 11905,
    "top_items": [
      {
        "id": "uuid",
        "name": "Chicken Burger",
        "price": 5000
      }
    ],
    "daily_sales": [
      {
        "date": "2026-03-07",
        "orders_count": 12,
        "revenue": 85000,
        "top_item": "Chicken Burger"
      }
    ]
  }
}
```

### GET /analytics/daily-sales
Get daily sales with filters

**Auth:** Required

**Query Parameters:**
- `start_date` (optional) - ISO date string
- `end_date` (optional) - ISO date string

### GET /analytics/top-items
Get top selling items

**Auth:** Required

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request body |
| 401 | Unauthorized | Provide valid JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Validation Error | Check field formats |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Contact support |

## Status Transitions

### Order Status Flow
```
CREATED 
   ↓
PENDING_PAYMENT
   ├→ CONFIRMED
   │    ├→ PREPARING
   │    │   └→ READY
   │    │       └→ COMPLETED
   │    └→ (can cancel)
   └→ REJECTED
```

## Pagination Example

```bash
# Get first page
curl "http://localhost:3001/api/v1/orders?limit=10&offset=0"

# Get next page
curl "http://localhost:3001/api/v1/orders?limit=10&offset=10"
```

## Rate Limiting

Currently not implemented, but planned:
- 100 requests per minute per IP for public endpoints
- 1000 requests per minute per authenticated user

## WebSocket Events

### Connect
```javascript
io.on('connect', () => {
  console.log('Connected to server');
});
```

### Listen to Events
```javascript
socket.on('order_created', (order) => {
  console.log('New order:', order);
});

socket.on('order_updated', (order) => {
  console.log('Order updated:', order);
});
```

### Emit Events
```javascript
socket.emit('order_status_changed', {
  orderId: 'uuid',
  status: 'PREPARING'
});
```

## Examples

### Complete Order Flow

**1. Get Menu**
```bash
curl http://localhost:3001/api/v1/menu/kigali-burger
```

**2. Create Order**
```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "abc-123",
    "items": [
      {"menu_item_id": "item-1", "quantity": 2}
    ]
  }'
```

**3. Get Order Status**
```bash
curl http://localhost:3001/api/v1/orders/order-123
```

**4. Confirm Payment (as Restaurant)**
```bash
curl -X PATCH http://localhost:3001/api/v1/orders/order-123/confirm \
  -H "Authorization: Bearer TOKEN"
```

**5. Update to Preparing**
```bash
curl -X PATCH http://localhost:3001/api/v1/orders/order-123/status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "PREPARING"}'
```

## Future Endpoints

- `/auth/login` - User authentication
- `/auth/logout` - User logout
- `/tenants` - Tenant management
- `/tenants/:id/qrcode` - QR code management
- `/payments/webhook` - Payment provider webhooks
- `/reports` - Advanced reporting

For more information, visit the [Getting Started Guide](./GETTING_STARTED.md)
