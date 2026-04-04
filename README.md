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

### Infrastructure
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Deployment**: AWS/GCP/DigitalOcean

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

### Tenant (Restaurant) Features
- ✅ Dashboard for order management
- ✅ Menu management (Add/Edit/Delete items)
- ✅ Real-time order notifications
- ✅ Cash payment confirmation workflow
- ✅ Order status management
- ✅ Basic sales analytics
- ✅ QR code management

### Admin/Platform Features
- ✅ Multi-tenant isolation
- ✅ Tenant onboarding
- ✅ Revenue tracking
- ✅ System monitoring

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

### Key Endpoints

**Menu APIs**
- `GET /menu/{tenant_slug}` - Get restaurant menu
- `POST /menu/items` - Add menu item (Tenant)
- `PUT /menu/items/{id}` - Update menu item
- `PATCH /menu/items/{id}/availability` - Toggle availability

**Order APIs**
- `POST /orders` - Create order
- `GET /orders` - Get orders (Tenant)
- `PATCH /orders/{id}/confirm` - Confirm cash payment
- `PATCH /orders/{id}/reject` - Reject order
- `PATCH /orders/{id}/status` - Update order status

**Analytics APIs**
- `GET /analytics/sales` - Sales analytics

## 🚀 Deployment

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

## 🔮 Future Enhancements

- Mobile Money (MoMo) payment integration
- Customer reviews and ratings
- Loyalty programs
- Multi-language support
- SMS notifications
- Mobile apps (iOS/Android)
- Advanced analytics
- Table management
- Reservation system

## 🤝 Contributing

Contributions are welcome! Please follow the existing code structure and commit message conventions.

## 📄 License

MIT License - See LICENSE file for details

## 📧 Support

For issues and questions, please create an issue in the repository.
