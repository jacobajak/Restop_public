'use client';

import React from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface JobStatus {
  lastRun: string | null;
  status: 'healthy' | 'warning' | 'critical';
  successRate: number;
}

interface HealthStatus {
  isHealthy: boolean;
  issues: string[];
  jobs: Record<string, JobStatus>;
}

interface JobHealthCardProps {
  health: HealthStatus;
}

/**
 * Job Health Card Component
 * 
 * Displays overall scheduler health status and per-job status indicators.
 * Shows:
 * - Overall health status
 * - List of issues if any
 * - Per-job status with success rates
 */
export default function JobHealthCard({ health }: JobHealthCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Overall Health Status */}
      <div className={`p-6 rounded-lg border-2 ${getStatusColor(health.isHealthy ? 'healthy' : 'critical')}`}>
        <div className="flex items-center gap-3 mb-4">
          {getStatusIcon(health.isHealthy ? 'healthy' : 'critical')}
          <h3 className="text-lg font-semibold text-gray-900">Overall Status</h3>
        </div>
        <p className={`text-2xl font-bold ${health.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
          {health.isHealthy ? 'Healthy' : 'Issues Detected'}
        </p>
        <p className="text-sm text-gray-600 mt-2">
          {health.isHealthy ? 'All background jobs running normally' : `${health.issues.length} issue(s) detected`}
        </p>
      </div>

      {/* Issues Alert */}
      {health.issues.length > 0 && (
        <div className="lg:col-span-2 p-6 rounded-lg border-2 bg-red-50 border-red-200">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Issues Detected</h4>
              <ul className="mt-2 space-y-1">
                {health.issues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-red-700">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Per-Job Status */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(health.jobs).map(([jobName, status]) => (
          <div
            key={jobName}
            className={`p-4 rounded-lg border-2 ${getStatusColor(status.status)}`}
          >
            <div className="flex items-center gap-2 mb-3">
              {getStatusIcon(status.status)}
              <h5 className="text-sm font-semibold text-gray-900 truncate">
                {jobName.replace(/-/g, ' ').toUpperCase()}
              </h5>
            </div>
            
            {/* Success Rate */}
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {(status.successRate * 100).toFixed(1)}%
              </span>
            </div>

            {/* Last Run */}
            {status.lastRun && (
              <div className="mt-2">
                <p className="text-xs text-gray-600">
                  Last run:{' '}
                  <span className="font-medium">
                    {new Date(status.lastRun).toLocaleTimeString()}
                  </span>
                </p>
              </div>
            )}

            {!status.lastRun && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 italic">Never run</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
