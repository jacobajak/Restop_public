'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, AlertOctagon, MessageSquare, Plus } from 'lucide-react';
import axiosInstance from '@/services/apiClient';
import { ReportErrorModal } from '@/components/common/ReportErrorModal';

interface SupportIssue {
  id: string;
  issue_type: string;
  severity: string;
  status: string;
  subject: string;
  description: string;
  created_at: string;
  resolved_at?: string;
  assigned_admin_id?: string;
  resolution_notes?: string;
}

const statusColors = {
  OPEN: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300' },
  ASSIGNED: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300' },
  INVESTIGATING: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
  RESOLVED: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
  CLOSED: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300' },
};

const severityColors = {
  LOW: 'text-blue-600 dark:text-blue-400',
  MEDIUM: 'text-yellow-600 dark:text-yellow-400',
  HIGH: 'text-orange-600 dark:text-orange-400',
  CRITICAL: 'text-red-600 dark:text-red-400',
};

const statusIcons = {
  OPEN: <AlertTriangle size={16} />,
  ASSIGNED: <Clock size={16} />,
  INVESTIGATING: <MessageSquare size={16} />,
  RESOLVED: <CheckCircle size={16} />,
  CLOSED: <CheckCircle size={16} />,
};

export default function SupportIssuesPage() {
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    loadIssues();
  }, [selectedFilter]);

  const loadIssues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedFilter) {
        params.append('status', selectedFilter);
      }
      params.append('limit', '50');
      params.append('offset', '0');

      const response = await axiosInstance.get(`/tenants/me/support/issues?${params.toString()}`);

      if (response.data.success) {
        setIssues(response.data.data.issues || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load issues');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Support Issues
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track and manage technical issues you've reported
          </p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition shadow-md"
        >
          <Plus size={20} />
          Report New Issue
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200">
              Having an issue?
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
              If you encounter any technical problems, errors, or unexpected behavior, our support team is here to help. Click the button above to report an issue with as much detail as possible.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {['', 'OPEN', 'ASSIGNED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
          >
            {status || 'All Issues'}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Issues List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading issues...</p>
          </div>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
          <AlertTriangle size={32} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {selectedFilter ? 'No issues with this status' : 'No reported issues yet'}
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
            {!selectedFilter && 'Great! Everything seems to be working smoothly.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => {
            const colors = statusColors[issue.status as keyof typeof statusColors] || statusColors.OPEN;
            const severityColor = severityColors[issue.severity as keyof typeof severityColors];

            return (
              <div
                key={issue.id}
                className={`${colors.bg} border ${colors.border} rounded-lg p-6 transition hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Status and Type Row */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex items-center gap-1.5 text-sm font-medium ${colors.text}`}>
                        {statusIcons[issue.status as keyof typeof statusIcons]}
                        {issue.status}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${severityColor} bg-opacity-20`}>
                        {issue.severity}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 px-2.5 py-0.5 rounded">
                        {issue.issue_type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Subject */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {issue.subject}
                    </h3>

                    {/* Description Preview */}
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-3 line-clamp-2">
                      {issue.description}
                    </p>

                    {/* Resolution Notes */}
                    {issue.resolution_notes && (
                      <div className="bg-white dark:bg-gray-700 bg-opacity-50 rounded p-3 mb-3">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                          Resolution:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {issue.resolution_notes}
                        </p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-6 text-xs text-gray-600 dark:text-gray-400">
                      <span>
                        <strong>Reported:</strong> {formatDate(issue.created_at)}
                      </span>
                      {issue.resolved_at && (
                        <span>
                          <strong>Resolved:</strong> {formatDate(issue.resolved_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Issue ID */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-mono break-all">
                      ID: {issue.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Error Modal */}
      <ReportErrorModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          // Reload issues to show the new one
          loadIssues();
        }}
      />
    </div>
  );
}
