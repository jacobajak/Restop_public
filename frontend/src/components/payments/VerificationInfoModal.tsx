import React from 'react';
import { X, CheckCircle, AlertCircle, Clock, MessageCircle } from 'lucide-react';

interface VerificationInfo {
  verification_status: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'SUSPENDED';
  message: string;
  requirements: string[];
  verified_accounts_count: number;
  total_accounts_count: number;
  can_receive_payouts: boolean;
}

interface VerificationInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationInfo: VerificationInfo | null;
  isLoading?: boolean;
  error?: string;
}

/**
 * VerificationInfoModal Component
 * 
 * Modal dialog showing detailed merchant account verification information.
 * Displays verification status, requirements, accounts, and contact information.
 * 
 * States:
 * - VERIFIED: Account ready to receive payouts
 * - PENDING: Verification in review
 * - UNVERIFIED: No verification started
 * - SUSPENDED: Account issues, contact support required
 * 
 * Usage:
 * ```tsx
 * const [modalOpen, setModalOpen] = useState(false);
 * <VerificationInfoModal 
 *   isOpen={modalOpen}
 *   onClose={() => setModalOpen(false)}
 *   verificationInfo={verificationData}
 *   isLoading={loading}
 *   error={error}
 * />
 * ```
 */
export const VerificationInfoModal: React.FC<VerificationInfoModalProps> = ({
  isOpen,
  onClose,
  verificationInfo,
  isLoading = false,
  error,
}) => {
  if (!isOpen) return null;

  const getStatusColor = () => {
    switch (verificationInfo?.verification_status) {
      case 'VERIFIED':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'PENDING':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'SUSPENDED':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'UNVERIFIED':
      default:
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    }
  };

  const getStatusIcon = () => {
    switch (verificationInfo?.verification_status) {
      case 'VERIFIED':
        return <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />;
      case 'PENDING':
        return <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />;
      case 'SUSPENDED':
        return <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />;
      case 'UNVERIFIED':
      default:
        return <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />;
    }
  };

  const getStatusTitle = () => {
    switch (verificationInfo?.verification_status) {
      case 'VERIFIED':
        return 'Account Verified';
      case 'PENDING':
        return 'Verification Pending';
      case 'SUSPENDED':
        return 'Account Suspended';
      case 'UNVERIFIED':
      default:
        return 'Account Not Verified';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Account Verification
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loading verification info...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Error loading verification info
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            ) : verificationInfo ? (
              <div className="space-y-6">
                {/* Status Card */}
                <div
                  className={`rounded-lg border p-4 flex items-start gap-4 ${getStatusColor()}`}
                >
                  {getStatusIcon()}
                  <div className="flex-grow">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {getStatusTitle()}
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {verificationInfo.message}
                    </p>
                    {verificationInfo.can_receive_payouts && (
                      <p className="text-sm font-medium text-green-700 dark:text-green-300 mt-2">
                        ✓ You can receive payouts
                      </p>
                    )}
                    {!verificationInfo.can_receive_payouts && (
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mt-2">
                        ⚠ Payouts are currently blocked
                      </p>
                    )}
                  </div>
                </div>

                {/* Account Progress */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Account Status
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Verified accounts
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {verificationInfo.verified_accounts_count} / {verificationInfo.total_accounts_count}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          verificationInfo.verification_status === 'VERIFIED'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${(verificationInfo.verified_accounts_count / verificationInfo.total_accounts_count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                {verificationInfo.requirements.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      {verificationInfo.verification_status === 'VERIFIED'
                        ? 'Verification Requirements (Completed)'
                        : 'Verification Requirements'}
                    </h4>
                    <div className="space-y-2">
                      {verificationInfo.requirements.map((req, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                        >
                          {verificationInfo.verification_status === 'VERIFIED' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {req}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Section */}
                {verificationInfo.verification_status === 'SUSPENDED' && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                    <div className="flex gap-3">
                      <MessageCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-medium text-red-900 dark:text-red-200 mb-1">
                          Account Suspended
                        </h5>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                          Your account has been suspended. Please contact our support team to resolve this issue.
                        </p>
                        <a
                          href="mailto:support@dineflow.app"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Contact Support
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {verificationInfo.verification_status === 'UNVERIFIED' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Complete the verification requirements to start receiving payouts. Once verified, funds will be transferred to your account within 24 hours of each transaction.
                    </p>
                  </div>
                )}

                {verificationInfo.verification_status === 'PENDING' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Your verification is under review. This typically takes 1-2 business days. We'll send you an email when verification is complete.
                    </p>
                  </div>
                )}

                {verificationInfo.verification_status === 'VERIFIED' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your account is verified! Funds from orders will be transferred to your account within 24 hours. You can track payouts on the dashboard.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default VerificationInfoModal;
