/**
 * Badge Component
 * 
 * Compact status indicator for orders, notifications, and metadata.
 * Supports color variants based on ORDER_STATUS_COLORS from design system.
 */

import React from 'react';
import { ORDER_STATUS_COLORS } from '@/constants/design';

type BadgeVariant = 'info' | 'warning' | 'success' | 'error' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  info: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
  warning: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
  success: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-800',
  error: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800',
  neutral: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700',
};

const sizeStyles = {
  sm: 'px-2 py-1 text-xs font-medium',
  md: 'px-3 py-1.5 text-sm font-semibold',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  icon,
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
};

/**
 * Status Badge - Specialized badge for order and entity statuses
 */
interface StatusBadgeProps {
  status: 'NEW' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'REJECTED' | string;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

const statusIcons: Record<string, string> = {
  NEW: '🆕',
  PENDING_PAYMENT: '💳',
  CONFIRMED: '✓',
  PREPARING: '👨‍🍳',
  READY: '🚪',
  COMPLETED: '✅',
  REJECTED: '❌',
};

const statusLabelMap: Record<string, string> = {
  NEW: 'New Order',
  PENDING_PAYMENT: 'Pending Payment',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
  showIcon = true,
}) => {
  // Map status to variant based on ORDER_STATUS_COLORS
  const colorMap: Record<string, BadgeVariant> = {
    NEW: 'info',
    PENDING_PAYMENT: 'info',
    CONFIRMED: 'warning',
    PREPARING: 'warning',
    READY: 'success',
    COMPLETED: 'success',
    REJECTED: 'error',
  };

  const variant = colorMap[status] || 'neutral';
  const label = statusLabelMap[status] || status;
  const icon = showIcon ? statusIcons[status] : null;

  return (
    <Badge variant={variant} size={size} icon={icon} className={className}>
      {label}
    </Badge>
  );
};

/**
 * Tag Badge - For generic tags and metadata
 */
interface TagBadgeProps {
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: Exclude<BadgeVariant, 'info' | 'warning' | 'success' | 'error'> | 'primary';
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  children,
  onRemove,
  variant = 'neutral',
}) => {
  const variantMap: Record<string, BadgeVariant> = {
    primary: 'info',
    neutral: 'neutral',
  };

  return (
    <Badge
      variant={variantMap[variant] || 'neutral'}
      size="sm"
      className={onRemove ? 'pr-1.5' : ''}
    >
      <div className="flex items-center gap-1.5">
        <span>{children}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="ml-1 inline-flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            aria-label="Remove tag"
          >
            ✕
          </button>
        )}
      </div>
    </Badge>
  );
};

/**
 * Count Badge - For displaying small counts/notifications
 */
interface CountBadgeProps {
  count: number;
  maxDisplay?: number;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  maxDisplay = 99,
}) => {
  const displayCount = count > maxDisplay ? `${maxDisplay}+` : count;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-6 px-1.5 py-1
        text-xs font-bold text-white
        rounded-full
        ${count > 0 ? 'bg-error' : 'bg-neutral-400'}
      `}
    >
      {displayCount}
    </span>
  );
};
