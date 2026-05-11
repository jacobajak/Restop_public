// Simple Mode Feature Visibility Control
// Gradually hide complex features to simplify merchant UI

export const SIMPLE_MODE_CONFIG = {
  // Phase 1: Hide for all non-admin roles (CURRENT - Implement first)
  hidden_globally: {
    pages: [
      '/dashboard/analytics',      // Complex charts
      '/dashboard/analytics/detailed',  // Advanced analytics
      '/dashboard/reports',        // Report builder
      '/dashboard/settlements',    // Payment settlements (complex)
      '/dashboard/support',        // Support system initially
    ],
    sidebar_items: [
      'analytics',
      'reports', 
      'settlements',
      'support',
    ],
    features: [
      'advanced_filters',          // Complex order/menu filtering
      'bulk_operations',           // Bulk actions
      'export_data',               // Data export
      'webhooks_config',           // Webhook setup
      'api_keys',                  // API management
    ],
  },

  // Phase 2: Hide for non-owner roles (KITCHEN_STAFF, CASHIER, MANAGER)
  hidden_for_staff: {
    pages: [
      '/dashboard/menu',           // Menu management (complex editing)
      '/dashboard/tables',         // Table/QR management
      '/dashboard/settings',       // All settings
      '/dashboard/payments',       // Payment settings/administration
    ],
    sidebar_items: [
      'menu',
      'tables',
      'settings',
      'payments',  // Payment admin
    ],
  },

  // Phase 3: Keep visible for MVP
  visible_for_all_staff: [
    '/dashboard/orders',           // Core: View and manage orders
    '/dashboard/tables',           // Core: View QR codes for tables
  ],

  // Phase 4: SimpleFied views for staff roles
  simplified_views: {
    orders_page: {
      hide: [
        'advanced_filters',
        'bulk_actions',
        'order_export',
        'refund_button',           // Only backend admin can refund
        'modify_order',            // Only owner can modify after creation
      ],
      show_limited: [
        'order_status_only',       // Just mark as ready/delivered
        'view_order_details',      // Read-only order view
      ],
    },

    menu_page: {
      owner_sees: [
        'category_management',
        'item_crud',
        'pricing_management',
        'availability_toggle',
        'bulk_import',
      ],
      hidden_for_staff: [
        'all_menu_functions',
      ],
    },

    settings_page: {
      owner_sees: [
        'restaurant_profile',
        'tax_settings',
        'delivery_zones',
        'payment_methods',
        'country_currency',
      ],
      hidden_for_staff: [
        'all_settings',
      ],
    },
  },
};

export const shouldHideFeature = (featureName: string, role: string): boolean => {
  // Always hide for all roles
  if (SIMPLE_MODE_CONFIG.hidden_globally.features.includes(featureName)) {
    return true;
  }

  // Hide for non-owner staff
  if (
    role !== 'PLATFORM_ADMIN' &&
    role !== 'TENANT_OWNER' &&
    SIMPLE_MODE_CONFIG.hidden_for_staff.sidebar_items.includes(featureName)
  ) {
    return true;
  }

  return false;
};

export const isSimpleModeRoute = (pathname: string): boolean => {
  return SIMPLE_MODE_CONFIG.hidden_globally.pages.some(page =>
    pathname.startsWith(page)
  );
};
