/**
 * Card Component
 * 
 * Flexible card component for analytics, metrics, and content containers.
 * Supports hover effects and responsive padding.
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverable = false,
  noPadding = false,
}) => {
  return (
    <div
      className={`
        bg-white dark:bg-neutral-800
        rounded-2xl
        border border-neutral-100 dark:border-neutral-700
        shadow-card hover:shadow-card-lg transition-all duration-350
        ${!noPadding ? 'p-6' : ''}
        ${hoverable ? 'cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transform hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

interface CardSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const CardSection: React.FC<CardSectionProps> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {title && (
        <h3 className="text-label font-semibold text-neutral-700 dark:text-dark-textSecondary uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

/**
 * Metric Card - Used for displaying KPIs and metrics
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}

const colorBgMap = {
  primary: 'bg-orange-50 dark:bg-orange-950',
  success: 'bg-green-50 dark:bg-green-950',
  warning: 'bg-amber-50 dark:bg-amber-950',
  error: 'bg-red-50 dark:bg-red-950',
  info: 'bg-blue-50 dark:bg-blue-950',
};

const colorTextMap = {
  primary: 'text-primary-600 dark:text-orange-400',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = 'primary',
}) => {
  return (
    <Card className={colorBgMap[color]}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-label font-semibold text-neutral-600 dark:text-dark-textSecondary">
            {label}
          </span>
          {icon && <div className={`${colorTextMap[color]} text-xl`}>{icon}</div>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="text-metric font-bold text-neutral-900 dark:text-dark-text">
            {value}
          </span>
          {trend && (
            <span
              className={`text-sm font-semibold ${
                trend.direction === 'up'
                  ? 'text-success'
                  : 'text-error'
              }`}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}%
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
