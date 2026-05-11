# RESTOP Frontend - Routes & Role-Based Access Map

**Last Updated:** April 9, 2026  
**Framework:** Next.js 13+ (App Router)  
**Authentication:** JWT Token (localStorage + cookies)

---

## 📋 Table of Contents

1. [Available Roles](#available-roles)
2. [Public Routes](#public-routes)
3. [Protected Routes by Role](#protected-routes-by-role)
4. [Navigation & Menu Systems](#navigation--menu-systems)
5. [Role Access Rules](#role-access-rules)
6. [Authentication Context](#authentication-context)

---

## 🔐 Available Roles

| Role | Type | Description | Access Level |
|------|------|-------------|--------------|
| **PLATFORM_ADMIN** | System | Platform administrator - full system access | Dashboard: `/admin/*` |
| **TENANT_OWNER** | Tenant Staff | Restaurant owner - full restaurant control | Dashboard: `/dashboard/*` |
| **TENANT_MANAGER** | Tenant Staff | Restaurant manager - restaurant operations | Dashboard: `/dashboard/*` (limited) |
| **KITCHEN_STAFF** | Tenant Staff | Kitchen staff - order preparation | Dashboard: `/dashboard/orders` |
| **CASHIER** | Tenant Staff | Cashier - payments & orders | Dashboard: `/dashboard/orders`, `/dashboard/payments` |

---

## 🌐 Public Routes

### Anyone can access these routes (no authentication required)

| Route | Path | Component | Purpose |
|-------|------|-----------|---------|
| **Home / Landing** | `/` | Root page (`/page.tsx`) | Landing page with login/signup buttons |
| **Login** | `/auth/login` | Login page | User authentication with email/password |
| **Register** | `/auth/register` | Registration page | Tenant owner registration for new restaurants |
| **OTP Verification** | `/auth/verify-otp` | OTP verification | Two-factor authentication for staff invites |
| **Accept Staff Invitation** | `/auth/accept-invitation` | Invitation acceptance | Staff member account creation via invitation token |
| **Restaurant Menu** | `/menu/[slug]` | Menu display | Public menu accessible via restaurant slug +table param |
| **Order Status** | `/order-status/[orderId]` | Real-time order tracking | Customer order status with WebSocket updates |
| **Auth Test** | `/test-auth` | Test auth page | Dev/test endpoint for debugging auth flow |

**Middleware Rules:**
```typescript
- Routes starting with /auth/login, /auth/register, /menu/* are PUBLIC
- Routes starting with /dashboard, /admin require token
- Root path "/" is PUBLIC
```

---

## 🔒 Protected Routes by Role

### PLATFORM_ADMIN Routes

**Route Group:** `/admin/*`  
**Protection:** `ProtectedAdminRoute` component checks `user.role === 'PLATFORM_ADMIN'`  
**Redirect:** Non-admin users redirected to `/dashboard`

#### Admin Dashboard Pages

| Route | Path | Component | Purpose | Key Features |
|-------|------|-----------|---------|--------------|
| **Admin Overview** | `/admin/overview` | `AdminOverviewPage` | Platform-wide dashboard | • Total restaurants<br/>• Daily orders & GMV<br/>• Payment methods breakdown<br/>• Settlement status<br/>• Platform statistics |
| **System Health** | `/admin/health` | `AdminHealthPage` | System monitoring | • System health score<br/>• Restaurant metrics<br/>• Order analytics<br/>• Payment success rates<br/>• Alert system |
| **Restaurants** | `/admin/restaurants` | `AdminRestaurantsPage` | Restaurant management | • List all restaurants<br/>• Suspend/activate<br/>• View restaurant details<br/>• Search & filter |
| **Orders** | `/admin/orders` | `AdminOrdersPage` | Platform order monitoring | • View all orders<br/>• Filter by status/payment method<br/>• Real-time updates via WebSocket<br/>• Order details |
| **Payments** | `/admin/payments` | `AdminPaymentsPage` | Payment monitoring | • Payment history<br/>• Success/failure tracking<br/>• Payment method breakdown<br/>• Status filtering |
| **Settlements** | `/admin/settlements` | `AdminSettlementsPage` | Settlement tracking | • Tenant settlements<br/>• Amount tracking<br/>• Settlement status<br/>• Transaction details |
| **Platform Fee Settlements** | `/admin/platform-fee-settlements` | `PlatformFeeSettlementsPage` | Fee settlement management | • Pending fee settlements<br/>• Batch confirmation<br/>• Fee collection tracking<br/>• Settlement history |
| **Refunds** | `/admin/refunds` | `AdminRefundsPage` | Refund management | • Pending refunds<br/>• Approval/rejection<br/>• Refund status tracking |
| **Payment Account Verification** | `/admin/verification` | `AdminVerificationPage` | Bank account verification | • Bank account verification<br/>• Account status monitoring<br/>• Rejection handling |
| **Support Tickets** | `/admin/support` | `AdminSupportPage` | Support ticket management | • Open support issues<br/>• Severity filtering<br/>• Status assignment<br/>• Issue resolution |
| **Audit Logs** | `/admin/audit-logs` | `AdminAuditLogsPage` | System audit trail | • Admin actions log<br/>• Entity change tracking<br/>• IP/user agent logging<br/>• Advanced filtering |

**Admin Navigation Menu** (in [AdminLayout.tsx](frontend/src/components/admin/AdminLayout.tsx)):
```
- Overview (📊)
- System Health (❤️)
- Restaurants (🏪)
- Orders (📦)
- Payments (💳)
- Settlements (💰)
- Platform Fee Settlements (💵)
- Refunds (🔄)
- Support Tickets (🎫)
- Verification (✓)
- Audit Logs (📋)
```

---

### TENANT_OWNER & TENANT_MANAGER Routes

**Route Group:** `/dashboard/*`  
**Protection:** `DashboardLayout` requires authentication + checks `user.role`  
**Redirect:** Unauthenticated → `/auth/login`, PLATFORM_ADMIN → `/admin/overview`

#### Dashboard Pages

| Route | Path | Component | Purpose | Owner Only | Manager | Kitchen | Cashier |
|-------|------|-----------|---------|:----------:|:-------:|:-------:|:-------:|
| **Dashboard Home** | `/dashboard` | Dashboard | Main dashboard stats | ✓ | ✓ | ✗ | ✗ |
| **Orders** | `/dashboard/orders` | OrderManagement | View & manage orders | ✓ | ✓ | ✓ | ✓ |
| **Menu** | `/dashboard/menu` | MenuManagement | Menu item management | ✓ | ✓ | ✗ | ✗ |
| **Tables** | `/dashboard/tables` | TablesManagement | Table & QR code management | ✓ | ✓ | ✗ | ✗ |
| **Analytics** | `/dashboard/analytics` | AnalyticsDashboard | Restaurant analytics & reports | ✓ | ✓ | ✗ | ✗ |
| **Payments** | `/dashboard/payments` | PaymentAccountCard | Payment method setup & tracking | ✓ | ✓ | ✗ | ✓ |
| **Reports** | `/dashboard/reports` | Reports | Business reports & exports | ✓ | ✓ | ✗ | ✗ |
| **QR Code** | `/dashboard/qrcode` | QRCodeDisplay | QR code generation & display | ✓ | ✓ | ✗ | ✗ |
| **Support** | `/dashboard/support` | Support Issues | Customer issue reporting | ✓ | ✓ | ✓ | ✓ |
| **Settings** | `/dashboard/settings` | Settings | Restaurant configuration | ✓ | ✓ | ✗ | ✗ |

**Dashboard Navigation Menu** (in [DashboardLayout.tsx](frontend/src/components/dashboard/DashboardLayout.tsx)):
```typescript
const allNavigation = [
  { name: 'Orders', href: '/dashboard/orders', pageKey: 'orders' },
  { name: 'Menu', href: '/dashboard/menu', pageKey: 'menu' },
  { name: 'Tables', href: '/dashboard/tables', pageKey: 'tables' },
  { name: 'Analytics', href: '/dashboard/analytics', pageKey: 'analytics' },
  { name: 'Payments', href: '/dashboard/payments', pageKey: 'payments' },
  { name: 'Reports', href: '/dashboard/reports', pageKey: 'reports' },
  { name: 'QR Code', href: '/dashboard/qrcode', pageKey: 'qrcode' },
  { name: 'Support', href: '/dashboard/support', pageKey: 'support' },
  { name: 'Settings', href: '/dashboard/settings', pageKey: 'settings' },
];

// Filtered by role using hasPageAccess(pageKey)
```

---

### TENANT_OWNER Only Routes

| Route | Path | Feature | Purpose |
|-------|------|---------|---------|
| **Staff Management** | `/dashboard/settings` | Staff section | Invite staff, manage roles |
| **Payment Settings** | `/dashboard/settings` | Payment config | Setup Mobile Money & Cash |
| **Restaurant Profile** | `/dashboard/settings` | Profile section | Edit restaurant details |
| **Fee Analytics** | `/tenant/fee-analytics` | Fee tracking | Platform fee settlement history |

---

### KITCHEN_STAFF Routes

**Limited to:** `/dashboard/orders` only

| Feature | Access |
|---------|--------|
| View Orders | ✓ |
| Update Order Status | ✓ |
| View Support Issues | ✓ |
| Edit Menu | ✗ |
| View Analytics | ✗ |
| Manage Payments | ✗ |

---

### CASHIER Routes

**Limited to:** `/dashboard/orders`, `/dashboard/payments`

| Feature | Access |
|---------|--------|
| View Orders | ✓ |
| Process Payments | ✓ |
| View Support Issues | ✓ |
| Update Order Status | ✓ |
| Edit Menu | ✗ |
| View Analytics | ✗ |
| Manage Staff | ✗ |

---

### Staff Invitation Routes

| Route | Path | Purpose |
|-------|------|---------|
| **Staff Invitation Redirect** | `/staff-invitation` | Redirects to `/auth/accept-invitation` |
| **Accept Invitation** | `/auth/accept-invitation?token=X&tenantId=Y` | Staff creates account via invitation |

---

## 🗂️ Navigation & Menu Systems

### 1. Tenant Dashboard Navigation

**File:** [DashboardLayout.tsx](frontend/src/components/dashboard/DashboardLayout.tsx)

**Navigation Structure:**
```
┌─ Sidebar (collapsible)
│  ├─ Logo & Brand (RESTOP)
│  ├─ Navigation Items (filtered by role)
│  │  ├─ Orders
│  │  ├─ Menu
│  │  ├─ Tables
│  │  ├─ Analytics
│  │  ├─ Payments
│  │  ├─ Reports
│  │  ├─ QR Code
│  │  ├─ Support
│  │  └─ Settings
│  ├─ Role Badge (displays current role)
│  └─ Logout Button
```

**Role-Based Visibility:**
- Uses `hasPageAccess(pageKey)` from `useRoleAccess` hook
- Lock icon (🔒) shown for unavailable pages in sidebar
- Pages not in `PAGE_ACCESS_RULES` are hidden from role

### 2. Admin Dashboard Navigation

**File:** [AdminLayout.tsx](frontend/src/components/admin/AdminLayout.tsx)

**Navigation Structure:**
```
┌─ Admin Sidebar (collapsible)
│  ├─ Admin Logo & Brand
│  ├─ Admin Navigation Items (fixed, no filtering)
│  │  ├─ Overview (📊)
│  │  ├─ System Health (❤️)
│  │  ├─ Restaurants (🏪)
│  │  ├─ Orders (📦)
│  │  ├─ Payments (💳)
│  │  ├─ Settlements (💰)
│  │  ├─ Platform Fee Settlements (💵)
│  │  ├─ Refunds (🔄)
│  │  ├─ Support Tickets (🎫)
│  │  ├─ Verification (✓)
│  │  └─ Audit Logs (📋)
│  ├─ Admin User Section
│  │  ├─ Admin Name
│  │  ├─ Admin Email
│  │  └─ Logout Button
```

### 3. Customer Menu (Public)

**File:** [MenuDisplay.tsx](frontend/src/components/customer/MenuDisplay.tsx)

**Navigation Structure:**
```
┌─ Menu Page (/menu/[slug])
│  ├─ Header
│  │  ├─ Restaurant Name
│  │  ├─ Cart button
│  │  ├─ Table Number Display
│  │  └─ Order Status Link
│  ├─ Menu Categories (horizontal tabs/vertical list)
│  │  ├─ Category 1 Items
│  │  ├─ Category 2 Items
│  │  └─ Category N Items
│  ├─ Menu Items Display
│  │  ├─ Item Image
│  │  ├─ Item Name & Description
│  │  ├─ Price
│  │  ├─ Add to Cart Button
│  │  └─ Availability Status
│  └─ Cart Sidebar (collapsible)
│     ├─ Cart Items
│     ├─ Total Price
│     ├─ Checkout Button
│     └─ Payment Selection
```

---

## 📊 Role Access Rules

### Page Access Rules (from [useRoleAccess.ts](frontend/src/hooks/useRoleAccess.ts))

```typescript
const PAGE_ACCESS_RULES: RolePermissions = {
  // Analytics and reports
  'analytics': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'reports': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // Menu management
  'menu': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // Orders page
  'orders': ['TENANT_OWNER', 'TENANT_MANAGER', 'KITCHEN_STAFF', 'CASHIER'],
  
  // Support issues (all tenant users can report)
  'support': ['TENANT_OWNER', 'TENANT_MANAGER', 'KITCHEN_STAFF', 'CASHIER'],
  
  // Settings and staff management
  'settings': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'settings.staff': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'settings.profile': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'settings.payment': ['TENANT_OWNER'],
  
  // Tables management
  'tables': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // QR code
  'qrcode': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // Payments and settlements
  'payments': ['TENANT_OWNER', 'TENANT_MANAGER', 'CASHIER'],
};
```

### Feature Access Rules

```typescript
const FEATURE_ACCESS_RULES: RolePermissions = {
  'view_analytics': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'manage_menu': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'view_orders': ['TENANT_OWNER', 'TENANT_MANAGER', 'KITCHEN_STAFF', 'CASHIER'],
  'update_order_status': ['TENANT_OWNER', 'TENANT_MANAGER', 'KITCHEN_STAFF'],
  'manage_payments': ['TENANT_OWNER', 'TENANT_MANAGER', 'CASHIER'],
  'add_staff': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'manage_staff': ['TENANT_OWNER'],
  'manage_tables': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'view_reports': ['TENANT_OWNER', 'TENANT_MANAGER'],
};
```

### Role Capability Matrix

```typescript
// Helper methods in useRoleAccess hook
canManageStaff()         → TENANT_OWNER only
canInviteStaff()         → TENANT_OWNER, TENANT_MANAGER
canViewAnalytics()       → TENANT_OWNER, TENANT_MANAGER
canManageMenu()          → TENANT_OWNER, TENANT_MANAGER
canUpdateOrderStatus()   → TENANT_OWNER, TENANT_MANAGER, KITCHEN_STAFF
canProcessPayments()     → TENANT_OWNER, TENANT_MANAGER, CASHIER
```

---

## 🔑 Authentication Context

### AuthContext Structure

**File:** [AuthContext.tsx](frontend/src/context/AuthContext.tsx)

**Context Interface:**
```typescript
interface AuthContextType {
  user: User | null;                           // Current user object
  token: string | null;                        // JWT token
  isAuthenticated: boolean;                    // Auth status
  isLoading: boolean;                          // Loading state
  login(email: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
  updateUser(user: User): void;
  refreshToken(): Promise<boolean>;
  clearAuth(): void;                           // Safe clear without API call
}
```

**User Object Structure:**
```typescript
interface User {
  id: string;
  tenant_id: string | null;           // null for PLATFORM_ADMIN
  name: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_OWNER' | 'TENANT_STAFF' | 'ADMIN' | 'STAFF';
  slug?: string;
  created_at?: string;
}
```

**Token Storage:**
- **localStorage:** `token` and `user` (JSON string)
- **cookies:** `token` (7 day expiry)
- **Headers:** Auto-attached to all API requests via `axios` interceptor

**Role Detection:**
- JWT payload decoded in middleware to detect PLATFORM_ADMIN
- User role checked in `ProtectedAdminRoute` component
- All page access validated via `useRoleAccess` hook

---

## 🔄 Authentication Flow

### 1. Login Flow

```
User enters email/password
         ↓
POST /api/v1/auth/login
         ↓
Response: { data: { access_token, user } }
         ↓
Store in localStorage + cookies
         ↓
Update AuthContext
         ↓
Redirect based on role:
  - PLATFORM_ADMIN → /admin/overview
  - Others → /dashboard
```

### 2. Protected Route Access

```
Access protected route
         ↓
Middleware checks for token
         ↓
No token → redirect to /auth/login
         ↓
Token exists → pass through
         ↓
Component uses ProtectedAdminRoute or DashboardLayout
         ↓
useAuth() hook checks user.role
         ↓
Role mismatch → redirect to appropriate dashboard
```

### 3. Logout Flow

```
Click Logout button
         ↓
POST /api/v1/auth/logout (optional)
         ↓
Clear localStorage (token + user)
         ↓
Clear cookies
         ↓
Clear AuthContext
         ↓
Redirect to /auth/login
```

---

## 📱 Route Access Quick Reference

### Quick Access by Role

#### PLATFORM_ADMIN
```
/admin/overview
/admin/health
/admin/restaurants
/admin/orders
/admin/payments
/admin/settlements
/admin/platform-fee-settlements
/admin/refunds
/admin/verification
/admin/support
/admin/audit-logs
```

#### TENANT_OWNER (Full Dashboard Access)
```
/dashboard                  (main)
/dashboard/orders
/dashboard/menu
/dashboard/tables
/dashboard/analytics
/dashboard/payments
/dashboard/reports
/dashboard/qrcode
/dashboard/support
/dashboard/settings
/tenant/fee-analytics
```

#### TENANT_MANAGER (Limited Dashboard)
```
/dashboard                  (main)
/dashboard/orders
/dashboard/menu
/dashboard/tables
/dashboard/analytics
/dashboard/payments
/dashboard/reports
/dashboard/qrcode
/dashboard/support
/dashboard/settings
```

#### KITCHEN_STAFF
```
/dashboard/orders           (view & update status only)
/dashboard/support
```

#### CASHIER
```
/dashboard/orders           (view & update status)
/dashboard/payments         (process payments)
/dashboard/support
```

#### Public / Unauthenticated
```
/                           (home)
/auth/login
/auth/register
/auth/verify-otp
/auth/accept-invitation
/menu/[slug]                (restaurant menu)
/order-status/[orderId]     (track order)
/test-auth                  (dev only)
```

---

## 🔐 Middleware Configuration

**File:** [middleware.ts](frontend/src/middleware.ts)

**Protected Routes Pattern:**
- `/dashboard/*` - requires token
- `/admin/*` - requires token + PLATFORM_ADMIN role (component level)

**Public Routes Pattern:**
- `/auth/*` - publicly accessible
- `/menu/*` - publicly accessible
- `/order-status/*` - publicly accessible
- `/` - home page

**JWT Role Detection:**
```typescript
try {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const userRole = payload.role;
  if (userRole === 'PLATFORM_ADMIN') redirectUrl = '/admin/overview';
} catch (e) {
  // Fallback to default redirect
}
```

---

## 📝 Notes

1. **Role Inconsistency:** The `types/index.ts` uses `TENANT_STAFF | ADMIN | STAFF` roles, but `useRoleAccess.ts` uses `TENANT_MANAGER | KITCHEN_STAFF | CASHIER`. The latter appears to be the current/correct implementation.

2. **CUSTOMER Role:** There is no explicit CUSTOMER role in the system. Customers access menus and order tracking via public URLs without authentication.

3. **WebSocket Access:** Admin pages use `useAdminWebSocket` hook for real-time updates on settlements, orders, and payments.

4. **API Base URL:** `process.env.NEXT_PUBLIC_API_URL` defaults to `http://localhost:3001/api/v1`

5. **Token Refresh:** Automatic token refresh implemented in `refreshToken()` method with error handling.

6. **Auth Storage:** Dual storage (localStorage + cookies) ensures token persistence across browser sessions.

---

## 🛠️ Implementation Files Reference

| File | Purpose |
|------|---------|
| [AuthContext.tsx](frontend/src/context/AuthContext.tsx) | Authentication state management |
| [useRoleAccess.ts](frontend/src/hooks/useRoleAccess.ts) | Role-based access control hooks |
| [middleware.ts](frontend/src/middleware.ts) | Route protection middleware |
| [DashboardLayout.tsx](frontend/src/components/dashboard/DashboardLayout.tsx) | Tenant dashboard layout & navigation |
| [AdminLayout.tsx](frontend/src/components/admin/AdminLayout.tsx) | Admin dashboard layout & navigation |
| [ProtectedAdminRoute.tsx](frontend/src/components/admin/ProtectedAdminRoute.tsx) | Admin route protection component |

