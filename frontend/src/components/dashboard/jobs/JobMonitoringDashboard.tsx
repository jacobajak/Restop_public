'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import JobHealthCard from '@/components/dashboard/jobs/JobHealthCard';
import JobStatisticsTable from '@/components/dashboard/jobs/JobStatisticsTable';
import JobExecutionHistory from '@/components/dashboard/jobs/JobExecutionHistory';
import {
  getJobHealth,
  getJobStatistics,
  getJobHistory,
  type HealthStatus,
  type JobStatistic,
  type JobExecution,
} from '@/services/jobMonitoringService';


/**
 * Job Monitoring Dashboard
 * 
 * Admin-only dashboard for monitoring background job health and metrics.
 * Displays:
 * - Overall scheduler health status
 * - Per-job execution statistics
 * - Recent execution history
 * - Alert thresholds
 */
export default function JobMonitoringDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [statistics, setStatistics] = useState<JobStatistic[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [history, setHistory] = useState<JobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Fetch all data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, statsData] = await Promise.all([
        getJobHealth(),
        getJobStatistics(),
      ]);
      setHealth(healthData);
      setStatistics(statsData);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load job metrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch history for selected job
  const loadHistory = async (jobName: string) => {
    try {
      const historyData = await getJobHistory(jobName);
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Fetch history when job is selected
  useEffect(() => {
    if (selectedJob) {
      loadHistory(selectedJob);
    }
  }, [selectedJob]);

  const handleRefresh = async () => {
    await loadData();
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Monitor background job execution, health status, and performance metrics
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Auto-refresh (30s)</span>
          </label>
          {lastRefresh && (
            <span className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {loading && !health ? (
        <div className="flex justify-center py-12">
          <div className="text-gray-500">Loading metrics...</div>
        </div>
      ) : (
        <>
          {/* Health Status */}
          {health && <JobHealthCard health={health} />}

          {/* Statistics Table */}
          {statistics.length > 0 && (
            <div className="mt-8">
              <JobStatisticsTable
                statistics={statistics}
                onJobSelect={setSelectedJob}
                selectedJob={selectedJob}
              />
            </div>
          )}

          {/* Execution History */}
          {selectedJob && history.length > 0 && (
            <div className="mt-8">
              <JobExecutionHistory
                jobName={selectedJob}
                executions={history}
                onClose={() => setSelectedJob(null)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
