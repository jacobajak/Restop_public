# RESTOP - QR-Based Multi-Tenant Restaurant Ordering Platform

A comprehensive digital ordering platform for restaurants using QR codes, enabling customers to scan and order from a digital menu while restaurant owners manage operations through a dedicated dashboard.

## 🚀 Project Overview

RESTOP is an MVP-stage platform designed as a multi-tenant system supporting:

- **Customer Interface**: Web app accessed via QR code scanning for ordering
- **Tenant Dashboard**: Restaurant management and order processing
- **Backend Services**: Multi-tenant order, menu, and payment handling
- **Real-time Updates**: WebSocket-based live order notifications
- **MoMo-Ready**: Payment architecture prepared for Mobile Money integration

## 📁 Project Structure

```
RESTOP/
├── frontend/                 # Next.js customer & dashboard interface
│   ├── src/
│   │   ├── app/             # Next.js app directory
│   │   ├── components/      # React components
│   │   ├── services/        # API service layer
│   │   ├── types/           # TypeScript type definitions
│   │   ├── hooks/           # Custom React hooks
│   │   ├── context/         # Context API providers
│   │   └── styles/          # Global styles
│   └── package.json
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── modules/         # Feature modules
│   │   ├── common/          # Guards, middleware, decorators
│   │   ├── database/        # Database entities & migrations
│   │   └── config/          # Configuration files
│   └── package.json
├── docker/                   # Docker compositions
├── docs/                     # Documentation
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **API Client**: Axios + React Query
- **Real-time**: Socket.IO

### Backend
- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT + Passport
- **Real-time**: WebSockets (Socket.IO)
- **Caching**: Redis

### Infrastructure & Services
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Deployment**: AWS/GCP/DigitalOcean
- **Payment Gateway**: Flutterwave (MTN/Airtel Mobile Money)
- **Email**: Ethereal (test) / SendGrid (production)
- **Monitoring**: Built-in circuit breakers, health checks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker (optional)

### Setup Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
# Frontend available at http://localhost:3000
```

### Setup Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
# Backend available at http://localhost:3001
```

## 📊 Core Features (MVP)

### Customer Features
- ✅ Scan QR code
- ✅ Browse digital menu
- ✅ Add items to cart
- ✅ View itemized pricing with platform fee
- ✅ Place order with cash confirmation
- ✅ Real-time order status updates
- ✅ **Mobile Money payments** (MTN/Airtel via Flutterwave)
- ✅ Automatic commission deduction (10%)
- ✅ Idempotency-protected transactions

### Tenant (Restaurant) Features
- ✅ Dashboard for order management
- ✅ Menu management (Add/Edit/Delete items)
- ✅ Real-time order notifications
- ✅ Multiple payment method support
- ✅ **Payment account registration** (MTN/Airtel)
- ✅ Automatic payout settlement (<5 min)
- ✅ Order status management
- ✅ Sales analytics
- ✅ QR code management

### Admin/Platform Features
- ✅ Multi-tenant isolation
- ✅ Tenant onboarding
- ✅ **Platform commission tracking** (real-time wallet)
- ✅ **Commission ledger** (payment history)
- ✅ Revenue tracking & analytics
- ✅ System monitoring
- ✅ Payment verification & reconciliation
- ✅ Circuit breaker & resilience patterns

## 🔐 Security

- JWT-based authentication
- Tenant data isolation with tenant_id filtering
- Bcrypt password hashing
- CORS protection
- Rate limiting
- Input validation
- HTTPS enforcement (production)

## 🔄 API Architecture

Base URL: `/api/v1`

### Payment Endpoints (NEW)
- `POST /orders/{orderId}/pay` - Initiate MTN/Airtel payment
- `PATCH /orders/{orderId}/mark-paid` - Mark cash order as paid
- `POST /webhooks/flutterwave` - Flutterwave webhook receiver
- `POST /tenants/{tenantId}/payment-accounts` - Register payment account
- `GET /admin/wallet` - View platform commission wallet
- `GET /admin/ledger` - View commission history

### Menu APIs
- `GET /menu/{tenant_slug}` - Get restaurant menu
- `POST /menu/items` - Add menu item (Tenant)
- `PUT /menu/items/{id}` - Update menu item
- `PATCH /menu/items/{id}/availability` - Toggle availability

**Order APIs**
- `POST /orders` - Create order
- `GET /orders` - Get orders (Tenant)
- `PATCH /orders/{id}/confirm` - Confirm order
- `PATCH /orders/{id}/reject` - Reject order
- `PATCH /orders/{id}/status` - Update order status

**Analytics APIs**
- `GET /analytics/sales` - Sales analytics
- `GET /financial-analytics/summary` - Financial overview

**See [ENDPOINT_REFERENCE_GUIDE.md](ENDPOINT_REFERENCE_GUIDE.md) for complete API reference (91+ endpoints)**

## � Payment Integration

### Flutterwave Native Integration (April 2026)
RESTOP now uses **Flutterwave's native split-at-payment-time model**:

**How it works:**
1. Customer initiates MTN/Airtel payment
2. Flutterwave automatically splits payment:
   - Platform receives 10% commission
   - Tenant receives 90% (automatic payout <5 min)
3. Order marked PAID, payout initiated
4. Commission recorded in admin wallet

**Features:**
- ✅ 10% automatic commission deduction
- ✅ <5 minute payout settlement
- ✅ Webhook verification with idempotency
- ✅ Circuit breaker error handling
- ✅ Automatic reconciliation every 5-10 min
- ✅ Graceful degradation on network failure

**Payment Methods:**
- 🇷🇼 MTN Mobile Money (0788/0789)
- 🇷🇼 Airtel Money (0773/0774)
- 💰 Cash (Pay on Delivery)

**See [PAYMENT_FEATURES_AND_GAPS_ANALYSIS.md](PAYMENT_FEATURES_AND_GAPS_ANALYSIS.md) for complete feature checklist**

---

## 📚 Documentation

Complete documentation is organized in [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md).

### Key Documents
- 📖 [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Central documentation guide
- 🔧 [ENDPOINT_REFERENCE_GUIDE.md](ENDPOINT_REFERENCE_GUIDE.md) - API endpoints (91+)
- 💳 [PAYMENT_FEATURES_AND_GAPS_ANALYSIS.md](PAYMENT_FEATURES_AND_GAPS_ANALYSIS.md) - Payment feature checklist
- 🧪 [FLUTTERWAVE_TESTING_GUIDE_NOW.md](FLUTTERWAVE_TESTING_GUIDE_NOW.md) - Step-by-step testing
- 🚀 [QUICK_CURL_TESTS.md](QUICK_CURL_TESTS.md) - Quick curl commands for testing
- 🌐 [FRONTEND_ROUTES_AND_ACCESS.md](FRONTEND_ROUTES_AND_ACCESS.md) - Frontend routing guide
- 🔐 [RBAC_DEVELOPER_GUIDE.md](RBAC_DEVELOPER_GUIDE.md) - Authentication & authorization
- 📱 [OFFLINE_READINESS_ANALYSIS.md](OFFLINE_READINESS_ANALYSIS.md) - Offline capability analysis
- 📊 [MVP_FEATURE_SUMMARY.md](MVP_FEATURE_SUMMARY.md) - MVP feature overview

---

## 🧪 Quick Testing

### Test Payment Endpoints (CLI)
```bash
# See QUICK_CURL_TESTS.md for detailed testing guide

# Health check
curl http://localhost:3001/api/v1/admin/health

# Create order
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"tenant_id": "test-tenant", "total_amount": 10000, "payment_method": "MTN"}'

# Initiate payment
curl -X POST http://localhost:3001/api/v1/orders/{orderId}/pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"customer_phone": "0788123456"}'
```

**For comprehensive testing guide:** See [FLUTTERWAVE_TESTING_GUIDE_NOW.md](FLUTTERWAVE_TESTING_GUIDE_NOW.md)

---

## ⚙️ Configuration

### Environment Variables (Backend)
```bash
# Database
DATABASE_URL=postgresql://restop:restop_password@localhost:5432/restop_db

# Flutterwave (Staging)
FLUTTERWAVE_CLIENT_ID=your-client-id
FLUTTERWAVE_SECRET_KEY=your-secret-key
FLUTTERWAVE_SECRET_HASH=your-webhook-hash
FLUTTERWAVE_ENV=staging

# JWT
JWT_SECRET=your-jwt-secret

# Redis (optional, graceful fallback)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 📱 Offline Capability Status

**Current:** ⚠️ Internet-required (Flutterwave payments, live DB)

**Analysis:** Comprehensive offline readiness analysis in [OFFLINE_READINESS_ANALYSIS.md](OFFLINE_READINESS_ANALYSIS.md)

**Offline Features Possible:**
- ✅ Menu browsing (cached)
- ✅ Pending order creation
- ✅ Sync on reconnection

**Features Requiring Internet:**
- ❌ Flutterwave MoMo payments
- ❌ Real-time order updates
- ❌ Commission settlements

**Recommendation:** Implement PWA + offline queue in Phase 2 (3-4 week effort)

---

## �🚀 Deployment

### Docker

```bash
docker-compose up
```

### Manual Deployment

Frontend deployer to Vercel:
```bash
cd frontend
vercel deploy
```

Backend deployment (Docker):
```bash
cd backend
docker build -t restop-backend .
docker run -p 3001:3001 restop-backend
```

## 📝 Database Schema

All tables include `tenant_id` for multi-tenant isolation.

Key tables:
- `tenants` - Restaurant information
- `users` - Restaurant staff
- `menu_categories` - Menu categories
- `menu_items` - Individual menu items
- `orders` - Customer orders
- `order_items` - Order line items
- `payments` - Payment records
- `qr_codes` - QR code mappings

## 🔮 Phase 2+ Enhancements

### Phase 2 (Post-MVP)
- 📱 Offline mode with PWA + service worker
- 🔌 Advanced offline payment queue & sync
- 📧 Email/SMS notifications (Ethereal test → SendGrid prod)
- 📊 Advanced analytics dashboard
- 🛏️ Table management system
- ⭐ Customer reviews & ratings
- 👥 Loyalty programs

### Phase 3+
- 🌍 Multi-language support
- 📱 Mobile apps (iOS/Android)
- 📅 Reservation system
- 💳 Multiple currency support
- 🔄 Subscription billing
- 📈 Predictive analytics

## 🤝 Contributing

Contributions are welcome! Please follow the existing code structure and commit message conventions.

## 🧹 Project Maintenance

**Last Cleanup:** April 21, 2026
- ✅ Removed 59 unnecessary files (test files, logs, old migrations)
- ✅ Consolidated 14 redundant payment docs → 4 essential docs
- ✅ Organized documentation via DOCUMENTATION_INDEX.md
- ✅ Verified backend compiles with zero TypeScript errors
- ✅ Fixed NestJS dependency injection issues

**Key Statistics:**
- 📊 91+ API endpoints across 15+ modules
- 🗄️ 25+ database tables with multi-tenant isolation
- 🔐 JWT + Passport authentication with RBAC
- 🌊 Flutterwave integration with circuit breaker resilience
- ✅ Backend tested & running on port 3001
- ✅ Frontend ready on port 3000

---

## 📄 License

MIT License - See LICENSE file for details

## 📧 Support & Contributing

For issues and questions, please:
1. Check [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) first
2. Review relevant documentation in the list above
3. Create an issue in the repository with:
   - Clear description of the problem
   - Steps to reproduce
   - Relevant logs/errors

Contributions welcome! Follow existing code structure and commit conventions.
