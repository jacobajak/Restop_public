/**
 * DineFlow Design System
 * 
 * Centralized design tokens and constants for consistent UI/UX.
 * All components must use these values instead of hardcoding styles.
 */

// Color Tokens
export const COLORS = {
  // Primary Brand
  primary: {
    50: '#FEF3E2',
    100: '#FDE5C8',
    200: '#FCC992',
    300: '#FAB15C',
    400: '#F99A3C',
    500: '#F97316', // Primary Orange
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A2C0B',
    900: '#7C1D0A',
  },

  // Semantic Colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutral Grays
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Dark Mode
  dark: {
    bg: '#0F172A',
    bgSecondary: '#1E293B',
    text: '#E2E8F0',
    textSecondary: '#CBD5E1',
    border: '#334155',
  },
};

// Order Status Colors
export const ORDER_STATUS_COLORS = {
  NEW: COLORS.info,           // Blue
  PENDING_PAYMENT: COLORS.info,  // Blue
  CONFIRMED: COLORS.warning,  // Orange
  PREPARING: COLORS.warning,  // Orange
  READY: COLORS.success,      // Green
  COMPLETED: COLORS.success,  // Green
  REJECTED: COLORS.error,     // Red
  CANCELLED: COLORS.error,    // Red
} as const;

// Typography Scale
export const TYPOGRAPHY = {
  pageTitle: {
    className: 'text-2xl font-semibold',
    size: '24px',
    weight: 600,
  },
  sectionTitle: {
    className: 'text-lg font-semibold',
    size: '18px',
    weight: 600,
  },
  metricNumbers: {
    className: 'text-3xl font-bold',
    size: '28px',
    weight: 700,
  },
  body: {
    className: 'text-sm',
    size: '14px',
    weight: 400,
  },
  label: {
    className: 'text-xs text-neutral-500 font-medium',
    size: '12px',
    weight: 500,
  },
} as const;

// Spacing Scale (4px base unit)
export const SPACING = {
  xs: '4px',   // 1
  sm: '8px',   // 2
  md: '12px',  // 3
  lg: '16px',  // 4
  xl: '24px',  // 6
  '2xl': '32px', // 8
  '3xl': '48px', // 12
  '4xl': '64px', // 16
} as const;

// Component Sizing
export const SIZES = {
  // Button sizes
  button: {
    sm: {
      height: '32px',    // h-8
      padding: '0 12px', // px-3
      className: 'h-8 px-3 text-sm',
    },
    md: {
      height: '40px',    // h-10
      padding: '0 16px', // px-4
      className: 'h-10 px-4 text-base',
    },
    lg: {
      height: '48px',    // h-12
      padding: '0 24px', // px-6
      className: 'h-12 px-6 text-base font-medium',
    },
  },
  // Minimum touch target (WCAG)
  touchTarget: '44px',
  // Border radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
} as const;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  mobile: 0,      // < 640px
  tablet: 640,    // 640px - 1024px
  desktop: 1024,  // > 1024px
} as const;

// Shadow system
export const SHADOWS = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px rgba(0,0,0,0.1)',
  lg: '0 10px 15px rgba(0,0,0,0.1)',
  xl: '0 20px 25px rgba(0,0,0,0.1)',
} as const;

// Component Rules
export const COMPONENT_RULES = {
  button: {
    minHeight: '44px',      // WCAG minimum
    minWidth: '44px',
    borderRadius: '12px',
    transitionDuration: '150ms',
    focusOutline: '2px solid',
    focusOutlineOffset: '2px',
  },
  card: {
    borderRadius: '12px',
    border: `1px solid ${COLORS.neutral[200]}`,
    boxShadow: SHADOWS.sm,
    padding: '16px',
    backgroundColor: '#FFFFFF',
  },
  input: {
    minHeight: '44px',
    borderRadius: '8px',
    borderWidth: '1px',
    padding: '12px 16px',
    fontSize: '14px',
  },
  table: {
    cellPadding: '12px 16px',
    rowHeight: '48px',
    borderColor: COLORS.neutral[200],
  },
} as const;

// Z-index System
export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 150,
  fixed: 200,
  modal: 300,
  tooltip: 400,
  notification: 500,
} as const;

// Animation Durations
export const ANIMATION = {
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
} as const;

// Accessibility
export const ACCESSIBILITY = {
  minContrastRatio: 4.5,
  minTouchTarget: '44px',
  focusBorder: '2px',
  focusOutlineOffset: '2px',
} as const;
