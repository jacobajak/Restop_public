/**
 * Input Component
 * 
 * Text input, textarea, select, and checkbox components with validation support.
 */

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      iconPosition = 'right',
      containerClassName = '',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            disabled={disabled}
            className={`
              w-full px-4 py-3
              text-base text-neutral-900 dark:text-neutral-100
              placeholder-neutral-400 dark:placeholder-neutral-500
              bg-white dark:bg-neutral-900
              border-b-2 rounded-lg transition-all duration-250
              focus:outline-none
              ${
                error
                  ? 'border-b-error-500 focus:shadow-lg focus:shadow-error-100 dark:focus:shadow-error-900/20'
                  : 'border-b-neutral-200 dark:border-b-neutral-700 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20'
              }
              ${disabled ? 'bg-neutral-50 dark:bg-neutral-900 cursor-not-allowed opacity-60 border-b-neutral-200 dark:border-b-neutral-700' : ''}
              ${icon && iconPosition === 'left' ? 'pl-10' : ''}
              ${icon && iconPosition === 'right' ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {icon && (
            <div
              className={`
                absolute top-1/2 transform -translate-y-1/2
                text-gray-400 dark:text-gray-600
                pointer-events-none
                ${iconPosition === 'left' ? 'left-3' : 'right-3'}
              `}
            >
              {icon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Textarea Component
 */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  rows?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      containerClassName = '',
      className = '',
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          disabled={disabled}
          rows={rows}
          className={`
            w-full px-4 py-2.5
            text-base text-neutral-900 dark:text-dark-text
            placeholder-neutral-500 dark:placeholder-neutral-400
            bg-white dark:bg-dark-card
            border rounded-lg transition-colors duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
            dark:focus-visible:ring-primary-400
            resize-vertical
            font-normal
            ${
              error
                ? 'border-error focus-visible:ring-error dark:focus-visible:ring-error'
                : 'border-neutral-300 dark:border-neutral-600'
            }
            ${disabled ? 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-error font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-neutral-600 dark:text-neutral-400">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

/**
 * Select Component
 */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string | number; label: string; disabled?: boolean }[];
  containerClassName?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      containerClassName = '',
      className = '',
      disabled,
      placeholder,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={`
              w-full px-4 py-2.5 pr-10
              text-base text-neutral-900 dark:text-dark-text
              bg-white dark:bg-dark-card
              border rounded-lg transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
              dark:focus-visible:ring-primary-400
              appearance-none cursor-pointer
              ${
                error
                  ? 'border-error focus-visible:ring-error dark:focus-visible:ring-error'
                  : 'border-neutral-300 dark:border-neutral-600'
              }
              ${disabled ? 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : ''}
              ${className}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled selected>
                {placeholder}
              </option>
            )}
            {options.map(option => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
            ▼
          </div>
        </div>
        {error && <p className="text-xs text-error font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-neutral-600 dark:text-neutral-400">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

/**
 * Checkbox Component
 */
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error,
      containerClassName = '',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className={`
              w-5 h-5
              accent-primary-500 dark:accent-primary-400
              rounded border border-neutral-300 dark:border-neutral-600
              cursor-pointer transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
              dark:focus-visible:ring-primary-400
              ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
              ${className}
            `}
            {...props}
          />
          {label && (
            <span
              className={`
                text-base text-neutral-700 dark:text-neutral-300
                ${disabled ? 'opacity-60' : ''}
              `}
            >
              {label}
            </span>
          )}
        </label>
        {error && <p className="text-xs text-error font-medium ml-7">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

/**
 * Radio Button Component
 */
interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className = '', disabled, ...props }, ref) => {
    return (
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          ref={ref}
          type="radio"
          disabled={disabled}
          className={`
            w-5 h-5
            accent-primary-500 dark:accent-primary-400
            cursor-pointer transition-colors duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
            dark:focus-visible:ring-primary-400
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            ${className}
          `}
          {...props}
        />
        {label && (
          <span
            className={`
              text-base text-neutral-700 dark:text-neutral-300
              ${disabled ? 'opacity-60' : ''}
            `}
          >
            {label}
          </span>
        )}
      </label>
    );
  }
);

Radio.displayName = 'Radio';

/**
 * Form Group Component - containers multiple form fields
 */
interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({ children, className = '' }) => {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
};

/**
 * Form Row Component - display fields side-by-side
 */
interface FormRowProps {
  children: React.ReactNode;
  columns?: number;
  className?: string;
}

export const FormRow: React.FC<FormRowProps> = ({
  children,
  columns = 2,
  className = '',
}) => {
  return (
    <div
      className={`grid gap-4 ${
        columns === 1
          ? 'grid-cols-1'
          : columns === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : columns === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : `grid-cols-1 md:grid-cols-${columns}`
      } ${className}`}
    >
      {children}
    </div>
  );
};
