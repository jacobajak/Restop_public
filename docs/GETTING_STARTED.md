# RESTOP - Getting Started Guide

## Quick Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Git

### 1. Clone & Install Dependencies

```bash
# Frontend
cd frontend
npm install
cp .env.example .env.local

# Backend
cd ../backend
npm install
cp .env.example .env
```

### 2. Database Setup

```bash
# Start PostgreSQL
# Edit backend/.env with your database credentials

# Run migrations (happens automatically on start)
cd backend
npm run migration:run
```

### 2a. Configure Payment System

**Backend** (`backend/.env`) - Add Payment Configuration:
```env
# Payment Providers
FLUTTERWAVE_SECRET_KEY=test_sk_live_xxx  # Get from https://dashboard.flutterwave.co
FLUTTERWAVE_MOCK_MODE=true              # Enable for development/testing
PAYPACK_API_KEY=test_key_xxx             # Get from Paypack dashboard

# Payment Settings
PAYMENT_TIMEOUT_MS=30000                 # 30 seconds
AUTO_CONFIRM_PAYMENT=true                # Auto-confirm in mock mode
```

**Note**: For development/testing, `FLUTTERWAVE_MOCK_MODE=true` will:
- Auto-confirm payments after 3 seconds
- Allow testing without real credentials
- Log all payment operations

For production, get real credentials from:
- **Flutterwave**: https://dashboard.flutterwave.co
- **Paypack**: https://www.paypack.rw

### 3. Run Development Servers

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
# Runs at http://localhost:3001
```

### 4. Access the Applications

- **Customer Ordering**: Visit `http://localhost:3000` then navigate to `/menu/restaurant-slug`
- **Restaurant Dashboard**: Visit `http://localhost:3000/dashboard/orders`
- **API Documentation**: Visit `http://localhost:3001/api/v1`

## Project Structure

### Frontend (`/frontend`)

**Key Directories:**
- `src/app/` - Next.js app directory (routes)
- `src/components/` - React components
  - `customer/` - Customer interface components
  - `dashboard/` - Restaurant dashboard components
  - `common/` - Shared components
- `src/services/` - API service layer
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks
- `src/context/` - Context API providers
- `src/styles/` - Global styles

**Main Pages:**
- `/` - Home page
- `/menu/[slug]` - Customer menu page (accessed via QR code)
- `/dashboard/orders` - Order management
- `/dashboard/menu` - Menu management
- `/dashboard/analytics` - Sales analytics
- `/dashboard/qrcode` - QR code management

### Backend (`/backend`)

**Key Directories:**
- `src/modules/` - Feature modules
  - `tenants/` - Multi-tenant management
  - `menu/` - Menu items and categories
  - `orders/` - Order processing
  - `payments/` - Payment handling
  - `users/` - User authentication
  - `notifications/` - Real-time notifications
  - `analytics/` - Sales analytics
- `src/common/` - Guards, middleware, decorators
- `src/config/` - Configuration files
- `src/database/` - Database entities and migrations

## API Endpoints

### Menu APIs
```
GET    /api/v1/menu/:slug                 - Get restaurant menu
POST   /api/v1/menu/items                 - Create menu item
PUT    /api/v1/menu/items/:id             - Update menu item
DELETE /api/v1/menu/items/:id             - Delete menu item
PATCH  /api/v1/menu/items/:id/availability - Toggle availability
```

### Order APIs
```
POST   /api/v1/orders                     - Create order
GET    /api/v1/orders                     - Get orders (with filters)
GET    /api/v1/orders/:id                 - Get specific order
PATCH  /api/v1/orders/:id/status          - Update order status
PATCH  /api/v1/orders/:id/confirm         - Confirm cash payment
PATCH  /api/v1/orders/:id/reject          - Reject order
```

### Analytics APIs
```
GET    /api/v1/analytics/sales            - Get sales analytics
GET    /api/v1/analytics/daily-sales      - Get daily sales
GET    /api/v1/analytics/top-items        - Get top selling items
```

## Database Schema

### Key Tables

**tenants**
- id, name, slug, email, phone, logo_url, currency

**users**
- id, tenant_id, name, email, password_hash, role

**menu_categories**
- id, tenant_id, name, description, sort_order

**menu_items**
- id, tenant_id, category_id, name, description, price, image_url, is_available

**orders**
- id, tenant_id, order_number, status, subtotal, platform_fee, total_amount, payment_method, payment_status

**order_items**
- id, order_id, menu_item_id, name, quantity, price, subtotal

**payments**
- id, tenant_id, order_id, amount, method, status, transaction_reference

## Multi-Tenancy Architecture

Every table has a `tenant_id` column for data isolation:

```typescript
// All queries must filter by tenant_id
WHERE tenant_id = current_tenant
```

This ensures:
- ✅ Complete data isolation between restaurants
- ✅ Secure multi-tenant separation
- ✅ Easy analytics per restaurant

## Real-Time Updates (WebSockets)

The system uses Socket.IO for real-time order notifications:

```typescript
// Customer
- Listens for order status updates

// Restaurant Dashboard
- Listens for new orders
- Listens for order updates
- Emits status changes
```

Events:
- `order_created` - New order placed
- `order_confirmed` - Payment confirmed
- `order_updated` - Order status changed
- `order_ready` - Food ready for pickup

## Authentication Flow

**Dashboard Login:**
1. User submits email & password
2. Server validates and returns JWT token
3. Token stored in localStorage
4. All API requests include token in Authorization header

**Current Status:** Authentication placeholders in code (TODO)

## Security Best Practices

✅ **Implemented:**
- CORS configuration
- Input validation
- Helmet.js security headers
- HTTP-only cookies (when JWT implemented)

📋 **To Implement:**
- JWT authentication middleware
- Request rate limiting
- CSRF protection
- Password hashing with bcrypt

## Development Workflow

### Adding a New Feature

1. **Create Database Entity**
```typescript
// backend/src/modules/feature/entities/feature.entity.ts
@Entity('features')
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;
  // ... other columns
}
```

2. **Create Service**
```typescript
// backend/src/modules/feature/feature.service.ts
@Injectable()
export class FeatureService {
  // Business logic
}
```

3. **Create Controller**
```typescript
// backend/src/modules/feature/feature.controller.ts
@Controller('feature')
export class FeatureController {
  // Routes
}
```

4. **Create Module**
```typescript
// backend/src/modules/feature/feature.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Feature])],
  controllers: [FeatureController],
  providers: [FeatureService],
})
export class FeatureModule {}
```

### Frontend Component Development

1. **Create Type Definition**
```typescript
// src/types/index.ts
export interface Feature {
  id: string;
  name: string;
  // ...
}
```

2. **Create Service**
```typescript
// src/services/featureService.ts
export const featureService = {
  getFeatures: async (): Promise<Feature[]> => {
    const response = await apiClient.get('/features');
    return response.data.data;
  },
};
```

3. **Create Component**
```typescript
// src/components/FeatureComponent.tsx
export const FeatureComponent: React.FC = () => {
  // Component logic
};
```

## Testing

### Backend Tests
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
```

### Frontend Tests
```bash
npm run test              # Jest tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage
```

## Deployment

### Docker Deployment

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend API (port 3001)
- Frontend (port 3000)

### Production Checklist

- [ ] Set all environment variables
- [ ] Database migrations run successfully
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] CORS restricted to frontend domain
- [ ] JWT secrets rotated
- [ ] Database backups configured
- [ ] Monitoring/logging setup (Sentry, etc.)

## Troubleshooting

### Backend Won't Start
```bash
# Check database connection
psql -U restop -d restop_db -h localhost

# Check migrations
npm run migration:run

# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Frontend Won't Load Menu
```bash
# Check backend API is running
curl http://localhost:3001/api/v1/health

# Check environment variables
cat .env.local

# Verify tenant slug exists in database
```

### WebSocket Connection Issues
```bash
# Check backend WebSocket server
telnet localhost 3001

# Check CORS in backend
# Verify NEXT_PUBLIC_WS_URL in frontend .env.local
```

## Next Steps

1. **Implement Authentication**
   - JWT guards in backend
   - Login page in frontend
   - User management

2. **Add Mobile Money Integration**
   - Payment provider setup
   - Webhook handlers
   - Payment retry logic

3. **Enhance Analytics**
   - Advanced filtering
   - Export functionality
   - Performance optimizations

4. **Mobile App**
   - React Native version
   - Offline support
   - Push notifications

5. **Admin Dashboard**
   - Platform-wide analytics
   - Tenant management
   - Revenue tracking

## Support & Documentation

For detailed API documentation, see: `docs/API.md`
For database schema details, see: `docs/DATABASE.md`
For architecture overview, see: `docs/ARCHITECTURE.md`

## License

MIT
