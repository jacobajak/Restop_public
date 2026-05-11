'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import axiosInstance from '@/services/apiClient';

interface ReportErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportErrorModal: React.FC<ReportErrorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    issue_type: 'SYSTEM_ISSUE',
    severity: 'MEDIUM',
    subject: '',
    description: '',
    error_details: '',
    related_order_id: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.subject.trim() || !formData.description.trim()) {
        throw new Error('Subject and description are required');
      }

      const payload = {
        ...formData,
        related_order_id: formData.related_order_id || undefined,
      };

      const response = await axiosInstance.post(
        '/tenants/me/support/report',
        payload
      );

      if (response.data.success) {
        setIsSuccess(true);
        setFormData({
          issue_type: 'SYSTEM_ISSUE',
          severity: 'MEDIUM',
          subject: '',
          description: '',
          error_details: '',
          related_order_id: '',
        });

        // Close modal after 3 seconds
        setTimeout(() => {
          onClose();
          setIsSuccess(false);
        }, 3000);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to report error. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-orange-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Report Technical Issue
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Success Message */}
        {isSuccess && (
          <div className="p-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-start gap-4">
            <Check className="text-green-600 dark:text-green-400 flex-shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-200">
                Issue Reported Successfully
              </h3>
              <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                Thank you for reporting this issue. Our support team will investigate and get back to you soon.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-start gap-4">
            <X className="text-red-600 dark:text-red-400 flex-shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                Error
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        {!isSuccess && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>How this helps:</strong> Detailed information about the issue you're experiencing will help our support team resolve it faster. Include error messages, screenshots, or steps to reproduce when possible.
              </p>
            </div>

            {/* Issue Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Issue Type *
              </label>
              <select
                name="issue_type"
                value={formData.issue_type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="PAYMENT_ISSUE">Payment Issue</option>
                <option value="ORDER_ISSUE">Order Issue</option>
                <option value="SETTLEMENT_ISSUE">Settlement Issue</option>
                <option value="VERIFICATION_ISSUE">Verification Issue</option>
                <option value="SYNC_ISSUE">Data Sync Issue</option>
                <option value="SYSTEM_ISSUE">System Issue</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Severity Level *
              </label>
              <select
                name="severity"
                value={formData.severity}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="LOW">Low - Minor inconvenience</option>
                <option value="MEDIUM">Medium - Some functionality affected</option>
                <option value="HIGH">High - Major functionality broken</option>
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject *
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Brief summary of the issue"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Provide detailed information:
- What were you trying to do?
- What happened instead?
- When did it occur?
- Is it still happening?"
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Error Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Error Details (Optional)
              </label>
              <textarea
                name="error_details"
                value={formData.error_details}
                onChange={handleInputChange}
                placeholder="Error messages, codes, or stack traces (if available)"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Related Order ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Related Order ID (Optional)
              </label>
              <input
                type="text"
                name="related_order_id"
                value={formData.related_order_id}
                onChange={handleInputChange}
                placeholder="If this issue is related to a specific order"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={18} className="animate-spin" />}
                {isLoading ? 'Submitting...' : 'Report Issue'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
