import { useAuth } from '@/context/AuthContext';

export type UserRole = 
  | 'PLATFORM_ADMIN' 
  | 'TENANT_OWNER' 
  | 'TENANT_MANAGER' 
  | 'KITCHEN_STAFF' 
  | 'CASHIER';

interface RolePermissions {
  [key: string]: UserRole[];
}

const PAGE_ACCESS_RULES: RolePermissions = {
  // Core features (ALWAYS VISIBLE for MVP)
  'orders': ['TENANT_OWNER', 'TENANT_MANAGER', 'KITCHEN_STAFF', 'CASHIER'],
  'tables': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // SIMPLE MODE: Hidden for MVP (shown only after 10+ orders)
  // Analytics and reports
  'analytics': ['TENANT_OWNER'],  // Only for owner, not in simple mode
  'reports': ['TENANT_OWNER'],    // Only for owner, not in simple mode
  
  // Menu management (owner/manager only)
  'menu': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // Support issues (all tenant users can report) - HIDDEN IN SIMPLE MODE
  'support': [],  // Hidden for now - will show after MVP
  
  // Settings and staff management
  'settings': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'settings.staff': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'settings.profile': ['TENANT_OWNER', 'TENANT_MANAGER'],
  'settings.payment': ['TENANT_OWNER'],
  
  // QR code
  'qrcode': ['TENANT_OWNER', 'TENANT_MANAGER'],
  
  // Payments and settlements - HIDDEN FOR NOW
  'payments': [],  // Hidden in simple mode - use QR code instead
};

const FEATURE_ACCESS_RULES: RolePermissions = {
  // Features that different roles can access
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

export const useRoleAccess = () => {
  const authContext = useAuth();
  const userRole = authContext?.user?.role as UserRole;

  const hasPageAccess = (pageKey: string): boolean => {
    if (!userRole) return false;
    const allowedRoles = PAGE_ACCESS_RULES[pageKey] || [];
    return allowedRoles.includes(userRole);
  };

  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!userRole) return false;
    const allowedRoles = FEATURE_ACCESS_RULES[featureKey] || [];
    return allowedRoles.includes(userRole);
  };

  const isOwner = (): boolean => userRole === 'TENANT_OWNER';
  
  const isManager = (): boolean => userRole === 'TENANT_MANAGER';
  
  const isKitchenStaff = (): boolean => userRole === 'KITCHEN_STAFF';
  
  const isCashier = (): boolean => userRole === 'CASHIER';

  const canManageStaff = (): boolean => userRole === 'TENANT_OWNER';
  
  const canInviteStaff = (): boolean => ['TENANT_OWNER', 'TENANT_MANAGER'].includes(userRole);
  
  const canViewAnalytics = (): boolean => ['TENANT_OWNER', 'TENANT_MANAGER'].includes(userRole);
  
  const canManageMenu = (): boolean => ['TENANT_OWNER', 'TENANT_MANAGER'].includes(userRole);
  
  const canUpdateOrderStatus = (): boolean => 
    ['TENANT_OWNER', 'TENANT_MANAGER', 'KITCHEN_STAFF'].includes(userRole);
  
  const canProcessPayments = (): boolean => 
    ['TENANT_OWNER', 'TENANT_MANAGER', 'CASHIER'].includes(userRole);

  return {
    userRole,
    hasPageAccess,
    hasFeatureAccess,
    isOwner,
    isManager,
    isKitchenStaff,
    isCashier,
    canManageStaff,
    canInviteStaff,
    canViewAnalytics,
    canManageMenu,
    canUpdateOrderStatus,
    canProcessPayments,
  };
};
