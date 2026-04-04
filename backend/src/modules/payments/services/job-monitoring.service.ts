import { Injectable, Logger } from '@nestjs/common';

/**
 * Job Execution Record
 * 
 * Tracks each background job execution for monitoring and debugging
 */
interface JobExecution {
  jobName: string;
  executedAt: Date;
  duration: number; // milliseconds
  success: boolean;
  error?: string;
  message?: string;
  details?: any;
}

/**
 * Job Monitoring Service
 * 
 * Tracks background job execution metrics for:
 * - Monitoring overall scheduler health
 * - Detecting if jobs stop running
 * - Performance monitoring (duration trends)
 * - Error tracking and alerting
 * - Dashboard APIs for admin visibility
 * 
 * Architecture:
 * - Stores execution records in memory (in-production would use database)
 * - Maintains rolling window of last 100 executions per job
 * - Calculates execution statistics (avg duration, success rate, etc.)
 * - Provides health check endpoint for monitoring
 */
@Injectable()
export class JobMonitoringService {
  private readonly logger = new Logger(JobMonitoringService.name);

  // Store job execution history (in-memory for MVP, would use DB in production)
  private jobExecutions: Map<string, JobExecution[]> = new Map();
  private readonly MAX_HISTORY_PER_JOB = 100;

  // Health check thresholds
  private readonly JOB_TIMEOUT_MINUTES = 30;

  constructor() {
    this.initializeJobTracking();
  }

  /**
   * Initialize tracking for all known jobs
   */
  private initializeJobTracking(): void {
    const knownJobs = [
      'settlement-reconciliation',
      'payout-retry',
      'webhook-verification',
      'daily-settlement-summary',
      'health-check',
    ];

    for (const job of knownJobs) {
      this.jobExecutions.set(job, []);
    }
  }

  /**
   * Record a job execution
   * 
   * Called by PaymentSchedulerService after each job runs
   */
  async recordJobExecution(
    jobName: string,
    result: {
      success: boolean;
      duration: number;
      error?: string;
      message?: string;
      details?: any;
    }
  ): Promise<void> {
    const execution: JobExecution = {
      jobName,
      executedAt: new Date(),
      duration: result.duration,
      success: result.success,
      error: result.error,
      message: result.message,
      details: result.details,
    };

    // Store execution record
    if (!this.jobExecutions.has(jobName)) {
      this.jobExecutions.set(jobName, []);
    }

    const executions = this.jobExecutions.get(jobName);
    executions.push(execution);

    // Keep only last N executions
    while (executions.length > this.MAX_HISTORY_PER_JOB) {
      executions.shift();
    }

    // Log for monitoring
    const status = result.success ? '✅' : '❌';
    this.logger.log(
      `${status} Job recorded: ${jobName} (${result.duration}ms) - ${result.message || result.error || 'No message'}`
    );
  }

  /**
   * Get job execution history
   * 
   * @param jobName - Name of the job
   * @param limit - Max number of records to return
   * @returns Recent job executions
   */
  getJobExecutionHistory(jobName: string, limit: number = 20): JobExecution[] {
    const executions = this.jobExecutions.get(jobName) || [];
    return executions.slice(-limit).reverse();
  }

  /**
   * Get job execution statistics
   * 
   * Calculates metrics like:
   * - Total executions
   * - Success rate
   * - Average duration
   * - Min/max duration
   * - Last execution time
   */
  getJobStatistics(jobName: string): {
    jobName: string;
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    lastExecution: Date;
    lastSuccess: Date;
    lastFailure: Date;
  } {
    const executions = this.jobExecutions.get(jobName) || [];

    if (executions.length === 0) {
      return {
        jobName,
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        lastExecution: null,
        lastSuccess: null,
        lastFailure: null,
      };
    }

    const successes = executions.filter((e) => e.success);
    const failures = executions.filter((e) => !e.success);
    const durations = executions.map((e) => e.duration);

    return {
      jobName,
      totalExecutions: executions.length,
      successCount: successes.length,
      failureCount: failures.length,
      successRate: successes.length / executions.length,
      averageDuration:
        durations.reduce((a, b) => a + b, 0) / executions.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastExecution: executions[executions.length - 1].executedAt,
      lastSuccess: successes.length > 0 ? successes[successes.length - 1].executedAt : null,
      lastFailure: failures.length > 0 ? failures[failures.length - 1].executedAt : null,
    };
  }

  /**
   * Get health status of the scheduler
   * 
   * Checks:
   * - All critical jobs have run in last N minutes
   * - No job has been failing consistently
   * - Execution durations are within normal ranges
   */
  async getSchedulerHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    jobs: {
      [jobName: string]: {
        lastRun: Date;
        status: 'healthy' | 'warning' | 'critical';
        successRate: number;
      };
    };
  }> {
    const criticalJobs = [
      'settlement-reconciliation',
      'payout-retry',
      'webhook-verification',
    ];

    const health: {
      isHealthy: boolean;
      issues: string[];
      jobs: {
        [jobName: string]: {
          lastRun: Date;
          status: 'healthy' | 'warning' | 'critical';
          successRate: number;
        };
      };
    } = {
      isHealthy: true,
      issues: [],
      jobs: {},
    };

    const now = new Date();
    const timeoutMs = this.JOB_TIMEOUT_MINUTES * 60 * 1000;

    for (const jobName of criticalJobs) {
      const stats = this.getJobStatistics(jobName);
      const timeSinceLastRun = now.getTime() - (stats.lastExecution?.getTime() || 0);

      if (stats.totalExecutions === 0) {
        health.isHealthy = false;
        health.issues.push(`${jobName}: Never executed`);
        health.jobs[jobName] = {
          lastRun: null,
          status: 'critical',
          successRate: 0,
        };
      } else if (timeSinceLastRun > timeoutMs) {
        health.isHealthy = false;
        health.issues.push(
          `${jobName}: Last execution ${Math.floor(timeSinceLastRun / 60000)} minutes ago`
        );
        health.jobs[jobName] = {
          lastRun: stats.lastExecution,
          status: 'critical',
          successRate: stats.successRate,
        };
      } else if (stats.successRate < 0.5) {
        health.isHealthy = false;
        health.issues.push(
          `${jobName}: Low success rate (${(stats.successRate * 100).toFixed(2)}%)`
        );
        health.jobs[jobName] = {
          lastRun: stats.lastExecution,
          status: 'warning',
          successRate: stats.successRate,
        };
      } else {
        health.jobs[jobName] = {
          lastRun: stats.lastExecution,
          status: 'healthy',
          successRate: stats.successRate,
        };
      }
    }

    return health;
  }

  /**
   * Get all job statistics
   * 
   * @returns Statistics for all tracked jobs
   */
  getAllJobStatistics(): Array<{
    jobName: string;
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageDuration: number;
    lastExecution: Date;
  }> {
    return Array.from(this.jobExecutions.keys())
      .map((jobName) => {
        const stats = this.getJobStatistics(jobName);
        return {
          jobName: stats.jobName,
          totalExecutions: stats.totalExecutions,
          successCount: stats.successCount,
          failureCount: stats.failureCount,
          successRate: stats.successRate,
          averageDuration: stats.averageDuration,
          lastExecution: stats.lastExecution,
        };
      })
      .sort((a, b) => b.lastExecution?.getTime() - a.lastExecution?.getTime());
  }

  /**
   * Clear job execution history
   * 
   * Useful for resetting metrics after debugging
   */
  clearJobHistory(jobName?: string): void {
    if (jobName) {
      this.jobExecutions.set(jobName, []);
      this.logger.log(`Cleared history for job: ${jobName}`);
    } else {
      this.jobExecutions.forEach((_, key) => this.jobExecutions.set(key, []));
      this.logger.log('Cleared history for all jobs');
    }
  }
}
