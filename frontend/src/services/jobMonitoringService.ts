import apiClient from './apiClient';

export interface JobExecution {
  jobName: string;
  executedAt: string;
  duration: number;
  success: boolean;
  error?: string;
  message?: string;
  details?: any;
}

export interface JobStatistic {
  jobName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDuration: number;
  lastExecution: string;
}

export interface JobStatus {
  lastRun: string | null;
  status: 'healthy' | 'warning' | 'critical';
  successRate: number;
}

export interface HealthStatus {
  isHealthy: boolean;
  issues: string[];
  jobs: Record<string, JobStatus>;
}

/**
 * Job Monitoring Service
 * 
 * API calls for monitoring background job health and execution metrics
 */

/**
 * Get overall scheduler health status
 */
export const getJobHealth = async (): Promise<HealthStatus> => {
  const response = await apiClient.get('/jobs/health');
  return response.data.data;
};

/**
 * Get statistics for all jobs
 */
export const getJobStatistics = async (): Promise<JobStatistic[]> => {
  const response = await apiClient.get('/jobs/statistics');
  return response.data.data;
};

/**
 * Get execution history for a specific job
 */
export const getJobHistory = async (jobName: string, limit = 50): Promise<JobExecution[]> => {
  const response = await apiClient.get(`/jobs/${jobName}/history`);
  return response.data.data;
};

/**
 * Get detailed statistics for a specific job
 */
export const getJobDetailedStatistics = async (jobName: string): Promise<JobStatistic> => {
  const response = await apiClient.get(`/jobs/${jobName}/statistics`);
  return response.data.data;
};

export const jobMonitoringService = {
  getJobHealth,
  getJobStatistics,
  getJobHistory,
  getJobDetailedStatistics,
};
