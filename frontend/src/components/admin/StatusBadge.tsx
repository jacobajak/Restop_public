import React from 'react';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

/**
 * StatusBadge - Display status with color coding
 *
 * Maps common statuses to appropriate colors:
 * - active, verified, completed, successful → success (green)
 * - pending, processing → warning (yellow)
 * - suspended, failed, rejected → error (red)
 * - other → default (gray)
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant }) => {
  let displayVariant = variant;

  if (!displayVariant) {
    const lowerStatus = status.toLowerCase();
    if (
      lowerStatus.includes('active') ||
      lowerStatus.includes('verified') ||
      lowerStatus.includes('completed') ||
      lowerStatus.includes('successful') ||
      lowerStatus.includes('resolved')
    ) {
      displayVariant = 'success';
    } else if (
      lowerStatus.includes('pending') ||
      lowerStatus.includes('processing') ||
      lowerStatus.includes('investigating')
    ) {
      displayVariant = 'warning';
    } else if (
      lowerStatus.includes('suspended') ||
      lowerStatus.includes('failed') ||
      lowerStatus.includes('rejected') ||
      lowerStatus.includes('cancelled')
    ) {
      displayVariant = 'error';
    } else if (lowerStatus.includes('open') || lowerStatus.includes('assigned')) {
      displayVariant = 'info';
    } else {
      displayVariant = 'default';
    }
  }

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        variantClasses[displayVariant]
      }`}
    >
      {status}
    </span>
  );
};
