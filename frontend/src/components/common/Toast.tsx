/**
 * Toast Component
 * 
 * Toast notification system for displaying temporary messages.
 */

'use client';

import React, { useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

/**
 * Toast Context Provider
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    if (toast.duration !== 0) {
      setTimeout(() => removeToast(id), toast.duration || 4000);
    }

    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast notifications
 */
export const useToast = () => {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return {
    toast: context.addToast,
    info: (message: string, duration?: number) =>
      context.addToast({ message, type: 'info', duration }),
    success: (message: string, duration?: number) =>
      context.addToast({ message, type: 'success', duration }),
    warning: (message: string, duration?: number) =>
      context.addToast({ message, type: 'warning', duration }),
    error: (message: string, duration?: number) =>
      context.addToast({ message, type: 'error', duration }),
    remove: context.removeToast,
    clear: context.clearToasts,
  };
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const typeConfig = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      button: 'hover:bg-blue-100 dark:hover:bg-blue-900',
      icon: 'ℹ️',
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-950',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-900 dark:text-green-100',
      button: 'hover:bg-green-100 dark:hover:bg-green-900',
      icon: '✅',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-900 dark:text-amber-100',
      button: 'hover:bg-amber-100 dark:hover:bg-amber-900',
      icon: '⚠️',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-100',
      button: 'hover:bg-red-100 dark:hover:bg-red-900',
      icon: '❌',
    },
  };

  const config = typeConfig[toast.type];

  useEffect(() => {
    if (toast.duration === 0) return;

    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`
        ${config.bg} ${config.border}
        rounded-lg border px-4 py-3
        flex items-center gap-3
        shadow-lg
        animate-slideIn
      `}
      role="alert"
    >
      <div className="text-xl flex-shrink-0">{config.icon}</div>

      <div className={`flex-1 ${config.text}`}>
        <p className="text-sm font-medium">{toast.message}</p>
      </div>

      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className={`
            text-sm font-semibold
            px-3 py-1
            rounded transition-colors
            ${config.button}
            ${config.text}
          `}
        >
          {toast.action.label}
        </button>
      )}

      <button
        onClick={() => onRemove(toast.id)}
        className={`
          text-lg flex-shrink-0
          rounded transition-colors
          ${config.button}
          ${config.text}
        `}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
};

/**
 * Toast Container - displays all active toasts
 */
interface ToastContainerProps {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  position = 'bottom-right',
}) => {
  const context = React.useContext(ToastContext);

  if (!context) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div
      className={`
        fixed ${positionClasses[position]}
        z-[600]
        pointer-events-none
        max-w-md w-full px-4
      `}
    >
      <div className="space-y-2 pointer-events-auto">
        {context.toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={context.removeToast}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Standalone Toast Component (for non-context usage)
 */
interface StandaloneToastProps extends Toast {
  onClose: () => void;
}

export const Toast: React.FC<StandaloneToastProps> = ({
  message,
  type,
  duration,
  action,
  onClose,
}) => {
  useEffect(() => {
    if (duration === 0) return;

    const timer = setTimeout(onClose, duration || 4000);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeConfig = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      button: 'hover:bg-blue-100 dark:hover:bg-blue-900',
      icon: 'ℹ️',
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-950',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-900 dark:text-green-100',
      button: 'hover:bg-green-100 dark:hover:bg-green-900',
      icon: '✅',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-900 dark:text-amber-100',
      button: 'hover:bg-amber-100 dark:hover:bg-amber-900',
      icon: '⚠️',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-100',
      button: 'hover:bg-red-100 dark:hover:bg-red-900',
      icon: '❌',
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={`
        ${config.bg} ${config.border}
        rounded-lg border px-4 py-3
        flex items-center gap-3
        shadow-lg
      `}
      role="alert"
    >
      <div className="text-xl flex-shrink-0">{config.icon}</div>

      <div className={`flex-1 ${config.text}`}>
        <p className="text-sm font-medium">{message}</p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={`
            text-sm font-semibold
            px-3 py-1
            rounded transition-colors
            ${config.button}
            ${config.text}
          `}
        >
          {action.label}
        </button>
      )}

      <button
        onClick={onClose}
        className={`
          text-lg flex-shrink-0
          rounded transition-colors
          ${config.button}
          ${config.text}
        `}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
};
