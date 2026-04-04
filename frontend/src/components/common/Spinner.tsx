/**
 * Spinner Component
 * 
 * Loading spinners for various use cases.
 */

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'current';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const colorClasses = {
    primary: 'text-primary-500 dark:text-primary-400',
    white: 'text-white',
    current: 'text-current',
  };

  return (
    <svg
      className={`
        animate-spin
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${className}
      `}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

/**
 * Loading State Component
 */
interface LoadingProps {
  fullPage?: boolean;
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  fullPage = false,
  message = 'Loading...',
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <Spinner size="lg" color="primary" />
      {message && (
        <p className="text-neutral-600 dark:text-neutral-400 text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-dark-bg z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
};

/**
 * Skeleton Loader Component
 */
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  circle = false,
  className = '',
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`
        bg-neutral-200 dark:bg-neutral-700
        animate-pulse
        ${circle ? 'rounded-full' : 'rounded-md'}
        ${className}
      `}
      style={style}
    />
  );
};

/**
 * Progress Bar Component
 */
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}

const colorClasses = {
  primary: 'bg-primary-500 dark:bg-primary-400',
  success: 'bg-success dark:bg-green-400',
  warning: 'bg-warning dark:bg-amber-400',
  error: 'bg-error dark:bg-red-400',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className={`
        w-full bg-neutral-200 dark:bg-neutral-700
        rounded-full overflow-hidden
        ${sizeClasses[size]}
      `}>
        <div
          className={`
            ${colorClasses[color]}
            ${sizeClasses[size]}
            rounded-full transition-all duration-300
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
