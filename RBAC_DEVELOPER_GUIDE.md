# 🚀 RBAC Developer Quick Reference

## Quick Start: Using RBAC in Your Code

### Frontend: Checking User Permissions

#### Option 1: Hook-based (Recommended)
```tsx
import { useRoleAccess } from '@/hooks/useRoleAccess';

export function MyComponent() {
  const { canManageMenu, isOwner, userRole, hasFeatureAccess } = useRoleAccess();

  if (!canManageMenu()) {
    return <div>Access Denied</div>;
  }

  return <MenuEditor />;
}
```

#### Option 2: Component-based
```tsx
import { ProtectedContent, RoleBased } from '@/components/common';

export function MyComponent() {
  return (
    <>
      {/* Feature-level protection */}
      <ProtectedContent 
        featureKey="manage_menu"
        fallback={<p>You don't have permission to manage the menu</p>}
      >
        <MenuEditor />
      </ProtectedContent>

      {/* Role-level protection */}
      <RoleBased 
        allowedRoles={['TENANT_OWNER']}
        fallback={<p>Owner access only</p>}
      >
        <PaymentSettings />
      </RoleBased>
    </>
  );
}
```

#### Option 3: Page-level protection
```tsx
'use client';

import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';

export default function MyPage() {
  const { hasPageAccess } = useRoleAccess();

  if (!hasPageAccess('my_page')) {
    return <AccessDeniedComponent />;
  }

  return <div>Page Content</div>;
}
```

### All Available Permission Checks

```tsx
const {
  // Role info
  userRole,              // 'TENANT_OWNER' | 'TENANT_MANAGER' | etc.

  // Page access
  hasPageAccess('orders'),           // boolean
  hasPageAccess('menu'),             // boolean
  hasPageAccess('analytics'),        // boolean
  hasPageAccess('settings.payment'), // boolean

  // Feature access
  hasFeatureAccess('manage_menu'),        // boolean
  hasFeatureAccess('view_analytics'),     // boolean
  hasFeatureAccess('update_order_status'),// boolean

  // Convenience methods (role-specific)
  isOwner(),              // userRole === 'TENANT_OWNER'
  isManager(),            // userRole === 'TENANT_MANAGER'
  isKitchenStaff(),       // userRole === 'KITCHEN_STAFF'
  isCashier(),            // userRole === 'CASHIER'

  // Permission checks
  canManageStaff(),       // owner only
  canInviteStaff(),       // owner + manager
  canViewAnalytics(),     // owner + manager
  canManageMenu(),        // owner + manager
  canUpdateOrderStatus(), // owner + manager + kitchen
  canProcessPayments(),   // owner + manager + cashier
} = useRoleAccess();
```

---

## Backend: Protecting Endpoints

### Option 1: Using @Roles Decorator (Recommended)
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/modules/users/entities/user.entity';

@Controller('api/menu')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MenuController {
  @Post()
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async createMenuItem(@Body() data: CreateMenuItemDto) {
    // Only owner and manager can reach here
  }

  @Get()
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async getMenuItems() {
    // Only owner and manager can reach here
  }
}
```

### Option 2: Using Custom Guards
```typescript
import { UseGuards } from '@nestjs/common';
import { ManagerOrHigherGuard } from '@/common/guards/role-access.guard';

@Controller('api/orders')
@UseGuards(ManagerOrHigherGuard)
export class OrdersController {
  @Get()
  async getOrders() {
    // Only owner + manager can access
  }
}
```

### Option 3: Manual Role Checking
```typescript
import { ForbiddenException } from '@nestjs/common';

@Post()
async deleteStaff(@Request() req: any, @Param('id') staffId: string) {
  // Only owner can delete staff
  if (req.user.role !== UserRole.TENANT_OWNER) {
    throw new ForbiddenException('Only owners can delete staff');
  }
  
  // Perform deletion
}
```

---

## Adding New Roles

### 1. Update Backend Enum
```typescript
// backend/src/modules/users/entities/user.entity.ts
export enum UserRole {
  // ... existing roles
  SUPERVISOR = 'SUPERVISOR',  // NEW
}
```

### 2. Add to Staff Role Mapping
```typescript
// backend/src/modules/users/services/staff-management.service.ts
private mapStaffRoleToUserRole(staffRole: StaffRole): UserRole {
  switch (staffRole) {
    case StaffRole.SUPERVISOR:  // NEW
      return UserRole.SUPERVISOR;
    // ... other mappings
  }
}
```

### 3. Update Frontend Hook
```typescript
// frontend/src/hooks/useRoleAccess.ts
export type UserRole = 
  | 'PLATFORM_ADMIN' 
  | 'TENANT_OWNER' 
  | 'TENANT_MANAGER' 
  | 'KITCHEN_STAFF' 
  | 'CASHIER'
  | 'SUPERVISOR';  // NEW

const PAGE_ACCESS_RULES: RolePermissions = {
  'supervisor_dashboard': ['SUPERVISOR'],  // NEW
  // ... other rules
};
```

### 4. Update StaffAccessSettings Component
```typescript
const ROLES = [
  // ... existing roles
  {
    value: 'supervisor',
    label: '🔍 Supervisor',
    description: 'Manages operations and reporting',
    color: 'bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-100',
    backendRole: 'SUPERVISOR',
  },
];
```

---

## Adding New Page Access Rule

### Frontend
```typescript
// In useRoleAccess.ts
const PAGE_ACCESS_RULES: RolePermissions = {
  'my_new_page': ['TENANT_OWNER', 'TENANT_MANAGER'],
};

// In your page component
const { hasPageAccess } = useRoleAccess();

if (!hasPageAccess('my_new_page')) {
  return <AccessDeniedComponent />;
}
```

### Backend
```typescript
// In your controller
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
@Get('my-endpoint')
async myEndpoint() {
  // Protected endpoint
}
```

---

## Adding New Feature Permission

### Update Hook
```typescript
// frontend/src/hooks/useRoleAccess.ts
const FEATURE_ACCESS_RULES: RolePermissions = {
  'new_feature': ['TENANT_OWNER', 'TENANT_MANAGER'],
};

export const useRoleAccess = () => {
  // ... existing code
  
  const canAccessNewFeature = (): boolean => 
    ['TENANT_OWNER', 'TENANT_MANAGER'].includes(userRole);
  
  return {
    // ... existing returns
    canAccessNewFeature,
  };
};
```

### Use in Component
```tsx
export function MyComponent() {
  const { canAccessNewFeature } = useRoleAccess();

  if (!canAccessNewFeature()) {
    return <FeatureLockedMessage />;
  }

  return <NewFeatureComponent />;
}
```

---

## Testing RBAC

### Backend Testing Example
```bash
# 1. Create owner
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.com","password":"pass","role":"TENANT_OWNER"}'

# 2. Login to get token
OWNER_TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -d '{"email":"owner@test.com","password":"pass"}' \
  -H "Content-Type: application/json" | jq -r '.token')

# 3. Test endpoint with owner (should work)
curl -H "Authorization: Bearer $OWNER_TOKEN" \
  http://localhost:3001/api/staff

# 4. Test with kitchen staff token (should fail)
KITCHEN_TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -d '{"email":"kitchen@test.com","password":"pass"}' \
  -H "Content-Type: application/json" | jq -r '.token')

curl -H "Authorization: Bearer $KITCHEN_TOKEN" \
  http://localhost:3001/api/staff
# Returns 403 Forbidden
```

### Frontend Testing Example
```tsx
// In a test component
import { useRoleAccess } from '@/hooks/useRoleAccess';

export function TestComponent() {
  const access = useRoleAccess();
  
  return (
    <div>
      <p>User Role: {access.userRole}</p>
      <p>Can Manage Staff: {access.canManageStaff()}</p>
      <p>Can View Analytics: {access.canViewAnalytics()}</p>
      
      {access.isOwner() && <p>You are an owner!</p>}
      {access.isKitchenStaff() && <p>You are kitchen staff!</p>}
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: Admin-Only Action
```tsx
if (!useRoleAccess().isOwner()) {
  return <p>Owner access only</p>;
}
```

### Pattern 2: Multiple Role Check
```tsx
const { userRole } = useRoleAccess();
const canViewReport = ['TENANT_OWNER', 'TENANT_MANAGER', 'SUPERVISOR'].includes(userRole);

if (!canViewReport) {
  return <AccessDenied />;
}
```

### Pattern 3: Conditional Rendering
```tsx
const { canManageMenu } = useRoleAccess();

return (
  <>
    <OrderList />
    {canManageMenu() && <MenuEditor />}
  </>
);
```

### Pattern 4: Backend Endpoint Protection
```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.TENANT_OWNER)  // Only owner
@Post('admin-action')
async adminAction() {
  // Admin-only logic
}
```

---

## Debugging RBAC Issues

### Check User's Current Role
```tsx
import { useRoleAccess } from '@/hooks/useRoleAccess';

export function DebugComponent() {
  const { userRole } = useRoleAccess();
  
  console.log('Current role:', userRole);
  
  return <div>{userRole}</div>;
}
```

### Check Database
```sql
-- Check user's role
SELECT id, email, role FROM users WHERE email = 'test@example.com';

-- Check staff members
SELECT id, name, email, role, user_id, is_active 
FROM staff_members 
WHERE tenant_id = 'your-tenant-id';
```

### Check Backend Logs
```bash
docker logs restop-backend -f | grep -i "role\|guard\|forbidden"
```

### Check Frontend Console
```javascript
// In browser console
console.log('Auth context:', authContext);
console.log('Current role:', localStorage.getItem('userRole'));
```

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | Wrong role for endpoint | Verify user has required role |
| Access Denied on page | Role not in PAGE_ACCESS_RULES | Add role to rules or update user's role |
| Navigation item hidden | Role not in page access rules | Update navigation filtering in DashboardLayout |
| Can't see settings section | Role not in requiredRoles | Update SettingsLayout requiredRoles array |
| Staff can't login after invite | user_id not linked | Check if acceptance process completed |

---

## Performance Tips

1. **Cache permission checks** - useRoleAccess already caches by role
2. **Avoid re-renders** - Use useMemo for permission-based lists
3. **Batch API calls** - Check permissions before making requests
4. **Backend-first check** - Never trust frontend-only permissions

---

## Security Best Practices

✅ **Always validate on backend** - Never trust frontend checks alone  
✅ **Use @Roles decorator** - More maintainable than manual checks  
✅ **Validate tenant_id** - Ensure users can only access their tenant  
✅ **Log access attempts** - Monitor failed access attempts  
✅ **Review role hierarchy** - Keep roles simple and clear  
✅ **Test edge cases** - Test with invalid tokens, expired tokens, etc.  

---

## Resources

- Full implementation guide: `RBAC_IMPLEMENTATION_GUIDE.md`
- Solution summary: `RBAC_SOLUTION_SUMMARY.md`
- Source files: See backend and frontend directories
