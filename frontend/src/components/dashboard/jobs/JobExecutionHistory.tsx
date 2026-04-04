'use client';

import React from 'react';
import { X, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface JobExecution {
  jobName: string;
  executedAt: string;
  duration: number;
  success: boolean;
  error?: string;
  message?: string;
  details?: any;
}

interface JobExecutionHistoryProps {
  jobName: string;
  executions: JobExecution[];
  onClose: () => void;
}

/**
 * Job Execution History Component
 * 
 * Displays recent execution history for a specific job.
 * Shows:
 * - Execution timestamp and duration
 * - Success/failure status
 * - Error messages and details
 * - Expandable details for each execution
 */
export default function JobExecutionHistory({
  jobName,
  executions,
  onClose,
}: JobExecutionHistoryProps) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  const formatJobName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {formatJobName(jobName)} - Execution History
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Last {executions.length} executions
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Executions List */}
      <div className="divide-y divide-gray-200">
        {executions.map((execution, idx) => (
          <div key={idx} className="hover:bg-gray-50 transition">
            {/* Main Row */}
            <button
              onClick={() => setExpandedId(expandedId === idx ? null : idx)}
              className="w-full px-6 py-4 text-left flex items-center gap-4 cursor-pointer"
            >
              {/* Status Icon */}
              {execution.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}

              {/* Timestamp and Status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {formatTime(execution.executedAt)}
                </p>
                <p className={`text-sm ${execution.success ? 'text-green-600' : 'text-red-600'}`}>
                  {execution.success ? 'Success' : 'Failed'}
                  {execution.message && ` - ${execution.message}`}
                </p>
              </div>

              {/* Duration */}
              <div className="px-4 py-2 bg-gray-100 rounded flex items-center gap-2 flex-shrink-0">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {formatDuration(execution.duration)}
                </span>
              </div>

              {/* Expand Arrow */}
              <div className={`flex-shrink-0 transition ${expandedId === idx ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </button>

            {/* Expanded Details */}
            {expandedId === idx && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                {/* Error Message */}
                {execution.error && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">
                      Error
                    </h5>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded font-mono break-words">
                      {execution.error}
                    </p>
                  </div>
                )}

                {/* Details */}
                {execution.details && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">
                      Details
                    </h5>
                    <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-48">
                      {JSON.stringify(execution.details, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Execution Time</span>
                    <p className="font-medium text-gray-900">
                      {formatTime(execution.executedAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration</span>
                    <p className="font-medium text-gray-900">
                      {formatDuration(execution.duration)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {executions.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500">
          No executions recorded yet
        </div>
      )}
    </div>
  );
}
