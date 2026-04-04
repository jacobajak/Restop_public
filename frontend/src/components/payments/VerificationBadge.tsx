import React from 'react';
import { CheckCircle, AlertCircle, Clock, Ban, Info } from 'lucide-react';
import { useState } from 'react';

interface VerificationInfo {
  verification_status: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'SUSPENDED';
  message: string;
  requirements: string[];
  verified_accounts_count: number;
  total_accounts_count: number;
  can_receive_payouts: boolean;
}

interface VerificationBadgeProps {
  status: VerificationInfo;
  compact?: boolean;
  showRequirements?: boolean;
  onViewDetails?: () => void;
}

/**
 * VerificationBadge Component
 * 
 * Displays merchant account verification status with color-coded badge and helpful messaging.
 * Supports both compact and detailed views with requirement lists.
 * 
 * States:
 * - VERIFIED (Green): Account fully verified, can receive payouts
 * - PENDING (Yellow): Awaiting verification review, payouts blocked
 * - UNVERIFIED (Red): Not started verification, payouts blocked
 * - SUSPENDED (Red): Account suspended, payouts blocked
 * 
 * Usage:
 * ```tsx
 * const [status, setStatus] = useState<VerificationInfo>(...);
 * <VerificationBadge 
 *   status={status} 
 *   compact={false}
 *   showRequirements={true}
 *   onViewDetails={() => openModal()}
 * />
 * ```
 */
export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  status,
  compact = false,
  showRequirements = true,
  onViewDetails,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine badge styling based on verification status
  const getStatusStyles = () => {
    switch (status.verification_status) {
      case 'VERIFIED':
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          badgeBg: 'bg-green-100 dark:bg-green-900/60',
          badgeText: 'text-green-800 dark:text-green-200',
          textColor: 'text-green-700 dark:text-green-300',
          icon: CheckCircle,
          iconColor: 'text-green-600 dark:text-green-400',
        };
      case 'PENDING':
        return {
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          badgeBg: 'bg-yellow-100 dark:bg-yellow-900/60',
          badgeText: 'text-yellow-800 dark:text-yellow-200',
          textColor: 'text-yellow-700 dark:text-yellow-300',
          icon: Clock,
          iconColor: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'SUSPENDED':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          badgeBg: 'bg-red-100 dark:bg-red-900/60',
          badgeText: 'text-red-800 dark:text-red-200',
          textColor: 'text-red-700 dark:text-red-300',
          icon: Ban,
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'UNVERIFIED':
      default:
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          badgeBg: 'bg-red-100 dark:bg-red-900/60',
          badgeText: 'text-red-800 dark:text-red-200',
          textColor: 'text-red-700 dark:text-red-300',
          icon: AlertCircle,
          iconColor: 'text-red-600 dark:text-red-400',
        };
    }
  };

  const getStatusLabel = () => {
    switch (status.verification_status) {
      case 'VERIFIED':
        return 'Verified';
      case 'PENDING':
        return 'Pending Review';
      case 'SUSPENDED':
        return 'Suspended';
      case 'UNVERIFIED':
      default:
        return 'Not Verified';
    }
  };

  const styles = getStatusStyles();
  const StatusIcon = styles.icon;

  // Compact view - just the badge
  if (compact) {
    return (
      <div className="relative inline-block">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${styles.badgeBg} border ${styles.borderColor}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <StatusIcon className={`w-4 h-4 ${styles.iconColor}`} />
          <span className={`text-sm font-medium ${styles.badgeText}`}>
            {getStatusLabel()}
          </span>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 min-w-max">
            <div className={`${styles.bgColor} border ${styles.borderColor} rounded-lg p-3 shadow-lg`}>
              <p className={`text-xs font-medium ${styles.textColor} mb-1`}>
                {status.message}
              </p>
              {status.verification_status === 'SUSPENDED' && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Contact support to resolve this issue.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view with details
  return (
    <div
      className={`rounded-lg border ${styles.borderColor} ${styles.bgColor} p-4`}
    >
      <div className="flex items-start gap-3">
        <StatusIcon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`font-semibold text-sm ${styles.textColor}`}>
              {getStatusLabel()}
            </h3>
            {status.can_receive_payouts && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/60 rounded text-xs font-medium text-green-700 dark:text-green-200">
                <CheckCircle className="w-3 h-3" />
                Can receive payouts
              </span>
            )}
          </div>

          <p className={`text-sm ${styles.textColor} mb-3`}>
            {status.message}
          </p>

          {/* Account Progress */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Verified Accounts: {status.verified_accounts_count} / {status.total_accounts_count}
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  status.can_receive_payouts
                    ? 'bg-green-600'
                    : 'bg-yellow-600'
                }`}
                style={{
                  width: `${(status.verified_accounts_count / status.total_accounts_count) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Requirements List */}
          {showRequirements && status.requirements.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Next steps:
              </p>
              <ul className="space-y-1">
                {status.requirements.map((req, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  >
                    <span className="text-gray-400 dark:text-gray-600 mt-1">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Button */}
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className={`text-xs font-medium ${styles.textColor} hover:underline transition-colors`}
            >
              View verification requirements →
            </button>
          )}

          {/* Suspend Message */}
          {status.verification_status === 'SUSPENDED' && (
            <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Your account has been suspended. Please contact our support team at support@dineflow.app
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationBadge;
