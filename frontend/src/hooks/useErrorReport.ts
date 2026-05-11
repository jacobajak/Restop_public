'use client';

import { useCallback } from 'react';
import axiosInstance from '@/services/apiClient';

export interface ErrorReportOptions {
  issueType?: 'PAYMENT_ISSUE' | 'ORDER_ISSUE' | 'SETTLEMENT_ISSUE' | 'VERIFICATION_ISSUE' | 'SYNC_ISSUE' | 'SYSTEM_ISSUE' | 'OTHER';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subject: string;
  description?: string;
  errorDetails?: string;
  relatedOrderId?: string;
  relatedPaymentId?: string;
  relatedSettlementId?: string;
}

/**
 * Hook to report errors to the platform admin
 * Can be used anywhere in the app to report technical issues
 * 
 * Usage:
 * const { reportError, isLoading } = useErrorReport();
 * await reportError({
 *   subject: 'Payment processing failed',
 *   description: 'User tried to process payment but got 500 error',
 *   errorDetails: 'Error: Internal Server Error',
 *   relatedOrderId: 'order-123'
 * });
 */
export const useErrorReport = () => {
  const reportError = useCallback(
    async (options: ErrorReportOptions): Promise<{ success: boolean; issueId?: string; error?: string }> => {
      try {
        const payload = {
          issue_type: options.issueType || 'SYSTEM_ISSUE',
          severity: options.severity || 'MEDIUM',
          subject: options.subject,
          description: options.description || options.subject,
          error_details: options.errorDetails,
          related_order_id: options.relatedOrderId,
          related_payment_id: options.relatedPaymentId,
          related_settlement_id: options.relatedSettlementId,
        };

        const response = await axiosInstance.post('/tenants/me/support/report', payload);

        if (response.data.success) {
          return {
            success: true,
            issueId: response.data.data.issue_id,
          };
        }

        return {
          success: false,
          error: response.data.message || 'Failed to report error',
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.response?.data?.message || err.message || 'Failed to report error',
        };
      }
    },
    []
  );

  return { reportError };
};
