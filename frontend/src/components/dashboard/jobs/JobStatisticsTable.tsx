'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface JobStatistic {
  jobName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDuration: number;
  lastExecution: string;
}

interface JobStatisticsTableProps {
  statistics: JobStatistic[];
  onJobSelect: (jobName: string) => void;
  selectedJob: string | null;
}

/**
 * Job Statistics Table Component
 * 
 * Displays a table of job execution statistics with metrics like:
 * - Total executions and success rate
 * - Failure count and average execution duration
 * - Last execution time
 * - Click to view execution history
 */
export default function JobStatisticsTable({
  statistics,
  onJobSelect,
  selectedJob,
}: JobStatisticsTableProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatJobName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Job Statistics</h2>
        <p className="text-sm text-gray-600 mt-1">
          Performance metrics for all scheduled background jobs
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Executions
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Success Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Failures
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Avg Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Last Execution
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {statistics.map((stat) => (
              <tr
                key={stat.jobName}
                className={`border-b border-gray-200 hover:bg-gray-50 ${
                  selectedJob === stat.jobName ? 'bg-blue-50' : ''
                }`}
              >
                {/* Job Name */}
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {formatJobName(stat.jobName)}
                </td>

                {/* Executions */}
                <td className="px-6 py-4 text-sm text-gray-600">
                  {stat.totalExecutions}
                </td>

                {/* Success Rate */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          stat.successRate >= 0.95
                            ? 'bg-green-600'
                            : stat.successRate >= 0.8
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{
                          width: `${Math.max(stat.successRate * 100, 5)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      {(stat.successRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* Failures */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {stat.failureCount > 0 && (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${stat.failureCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {stat.failureCount}
                    </span>
                  </div>
                </td>

                {/* Avg Duration */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    {formatDuration(stat.averageDuration)}
                  </div>
                </td>

                {/* Last Execution */}
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(stat.lastExecution).toLocaleTimeString()}
                </td>

                {/* Action Button */}
                <td className="px-6 py-4">
                  <button
                    onClick={() => onJobSelect(stat.jobName)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                  >
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
