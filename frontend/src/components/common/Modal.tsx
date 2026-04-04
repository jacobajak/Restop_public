/**
 * Modal Component
 * 
 * Accessible modal dialog with customizable content and actions.
 */

'use client';

import React, { useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  closeButton?: boolean;
  backdrop?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  closeButton = true,
  backdrop = true,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      {backdrop && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <Card
          className={`
            w-full ${sizeClasses[size]}
            max-h-[90vh] overflow-y-auto
            ${className}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4">
            <h2
              id="modal-title"
              className="text-lg font-bold text-neutral-900 dark:text-dark-text"
            >
              {title}
            </h2>
            {closeButton && (
              <button
                onClick={onClose}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          <div className="mb-6 text-neutral-700 dark:text-neutral-300">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex gap-3 justify-end border-t border-neutral-200 dark:border-neutral-700 pt-4">
              {footer}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

/**
 * Confirm Modal - simplified modal for confirmations
 */
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  danger?: boolean;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
}) => {
  const [confirming, setConfirming] = React.useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = () => {
    setConfirming(false);
    onCancel?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="sm"
      closeButton={!confirming}
    >
      <div className="mb-6">
        <p className="text-neutral-700 dark:text-neutral-300">{message}</p>
      </div>

      <div className="flex gap-3 justify-end">
        <Button
          variant="secondary"
          onClick={handleCancel}
          disabled={confirming}
        >
          {cancelText}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={handleConfirm}
          isLoading={confirming || loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

/**
 * Alert Modal - for displaying alerts and messages
 */
interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
  actionText = 'Ok',
  onAction,
}) => {
  const iconMap = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  const typeColorMap = {
    info: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="flex gap-4">
        <div className={`text-2xl flex-shrink-0 ${typeColorMap[type]}`}>
          {iconMap[type]}
        </div>
        <div className="flex-1 text-neutral-700 dark:text-neutral-300">
          {message}
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button
          variant="primary"
          onClick={handleAction}
        >
          {actionText}
        </Button>
      </div>
    </Modal>
  );
};
