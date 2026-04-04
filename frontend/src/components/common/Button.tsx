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
    bg-primary-500 text-white hover:bg-primary-600
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
    disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-150
  `,
  secondary: `
    bg-neutral-200 text-neutral-900 hover:bg-neutral-300
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500
    disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-150
  `,
  danger: `
    bg-error text-white hover:bg-red-600
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error
    disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-150
  `,
  success: `
    bg-success text-white hover:bg-green-600
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success
    disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-150
  `,
  ghost: `
    bg-transparent text-primary-500 hover:bg-primary-50
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
    disabled:text-neutral-400 disabled:cursor-not-allowed
    active:scale-95 transition-all duration-150
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
