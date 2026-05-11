/**
 * Button Component
 * 
 * Professional, accessible button with multiple variants and sizes.
 * Follows DineFlow Design System.
 */

import React from 'react';
import { COLORS, SIZES, ANIMATION } from '@/constants/design';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-primary-500 to-primary-600 text-white
    hover:from-primary-600 hover:to-primary-700 hover:shadow-lg
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
    disabled:from-neutral-300 disabled:to-neutral-400 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none
    active:scale-95 transition-all duration-250 shadow-md hover:shadow-hover
  `,
  secondary: `
    bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 border-2 border-primary-200 dark:border-primary-800
    hover:bg-primary-50 dark:hover:bg-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
    disabled:bg-neutral-100 dark:disabled:bg-neutral-900 disabled:text-neutral-400 disabled:border-neutral-300 dark:disabled:border-neutral-700 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-250 shadow-sm
  `,
  danger: `
    bg-gradient-to-r from-error-500 to-error-600 text-white
    hover:from-error-600 hover:to-error-700 hover:shadow-lg
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-500
    disabled:from-neutral-300 disabled:to-neutral-400 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none
    active:scale-95 transition-all duration-250 shadow-md hover:shadow-hover
  `,
  success: `
    bg-gradient-to-r from-success-500 to-success-600 text-white
    hover:from-success-600 hover:to-success-700 hover:shadow-lg
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success-500
    disabled:from-neutral-300 disabled:to-neutral-400 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none
    active:scale-95 transition-all duration-250 shadow-md hover:shadow-hover
  `,
  ghost: `
    bg-transparent text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
    disabled:text-neutral-400 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-250
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm font-medium',
  md: 'h-10 px-4 text-base font-medium',
  lg: 'h-12 px-6 text-lg font-semibold',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          ${fullWidth ? 'w-full' : ''}
          rounded-lg
          font-medium
          transition-all
          duration-${ANIMATION.normal}
          focus-visible:ring-2
          focus-visible:ring-offset-2
          relative
          inline-flex
          items-center
          justify-center
          gap-2
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="opacity-70">Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
