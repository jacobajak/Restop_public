import {
  Controller,
  Get,
  UseGuards,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { JobMonitoringService } from '../services/job-monitoring.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';

/**
 * Job Monitoring Controller
 * 
 * REST API endpoints for background job monitoring and health checks.
 * 
 * Purpose:
 * - Provide visibility into background job execution
 * - Enable admin dashboard to display job metrics
 * - Support health checks for monitoring systems
 * - Debug job failures and performance issues
 * 
 * Endpoints:
 * - GET /jobs/health - Overall scheduler health status
 * - GET /jobs/statistics - Metrics for all jobs
 * - GET /jobs/:jobName/history - Recent executions for specific job
 * - GET /jobs/:jobName/statistics - Detailed metrics for specific job
 * 
 * All endpoints require admin authentication
 * 
 * @controller jobs
 */
@Controller('jobs')
@UseGuards(JwtAuthGuard, AdminGuard) // Admin-only endpoints
export class JobMonitoringController {
  constructor(private readonly jobMonitoringService: JobMonitoringService) {}

  /**
   * Get scheduler health status
   * 
   * Returns overall health of background job system including:
   * - Whether scheduler is healthy
   * - Individual job status (healthy/warning/critical)
   * - Issues detected (jobs not running, high failure rates, etc.)
   * 
   * GET /jobs/health
   * 
   * @returns { isHealthy, issues, jobs: { lastRun, status, successRate } }
   * 
   * @example
   * GET /api/v1/jobs/health
   * Authorization: Bearer eyJhbG...
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": {
   *     "isHealthy": true,
   *     "issues": [],
   *     "jobs": {
   *       "settlement-reconciliation": {
   *         "lastRun": "2025-03-23T10:35:42.123Z",
   *         "status": "healthy",
   *         "successRate": 1.0
   *       },
   *       "payout-retry": {
   *         "lastRun": "2025-03-23T10:30:12.456Z",
   *         "status": "healthy",
   *         "successRate": 0.98
   *       },
   *       "webhook-verification": {
   *         "lastRun": "2025-03-23T10:25:33.789Z",
   *         "status": "warning",
   *         "successRate": 0.85
   *       }
   *     }
   *   }
   * }
   */
  @Get('health')
  async getSchedulerHealth() {
    const data = await this.jobMonitoringService.getSchedulerHealth();
    return {
      success: true,
      data,
    };
  }

  /**
   * Get statistics for all jobs
   * 
   * Returns summary metrics for each background job:
   * - Total executions
   * - Success/failure counts
   * - Average execution duration
   * - Last execution time
   * 
   * Useful for:
   * - Performance trending
   * - Reliability monitoring
   * - Capacity planning
   * 
   * GET /jobs/statistics
   * 
   * @returns Array of job statistics objects
   * 
   * @example
   * GET /api/v1/jobs/statistics
   * Authorization: Bearer eyJhbG...
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "jobName": "settlement-reconciliation",
   *       "totalExecutions": 432,
   *       "successCount": 431,
   *       "failureCount": 1,
   *       "successRate": 0.9977,
   *       "averageDuration": 2150,
   *       "lastExecution": "2025-03-23T10:35:42.123Z"
   *     },
   *     {
   *       "jobName": "payout-retry",
   *       "totalExecutions": 216,
   *       "successCount": 212,
   *       "failureCount": 4,
   *       "successRate": 0.9815,
   *       "averageDuration": 3420,
   *       "lastExecution": "2025-03-23T10:30:12.456Z"
   *     },
   *     ...
   *   ]
   * }
   */
  @Get('statistics')
  getJobStatistics() {
    const data = this.jobMonitoringService.getAllJobStatistics();
    return {
      success: true,
      data,
    };
  }

  /**
   * Get execution history for a specific job
   * 
   * Returns recent execution records for debugging and monitoring:
   * - Execution time
   * - Duration
   * - Success/failure status
   * - Error messages if failed
   * - Result details
   * 
   * GET /jobs/:jobName/history
   * 
   * @param jobName - Name of the job (e.g., "settlement-reconciliation")
   * @returns Array of recent job executions
   * 
   * @example
   * GET /api/v1/jobs/settlement-reconciliation/history
   * Authorization: Bearer eyJhbG...
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "jobName": "settlement-reconciliation",
   *       "executedAt": "2025-03-23T10:35:42.123Z",
   *       "duration": 2150,
   *       "success": true,
   *       "message": "Verified: 12, Failed: 0, Timed out: 0",
   *       "details": { "verified": 12, "failed": 0, "timedOut": 0 }
   *     },
   *     {
   *       "jobName": "settlement-reconciliation",
   *       "executedAt": "2025-03-23T10:30:42.456Z",
   *       "duration": 1980,
   *       "success": true,
   *       "message": "Verified: 8, Failed: 0, Timed out: 0",
   *       "details": { "verified": 8, "failed": 0, "timedOut": 0 }
   *     },
   *     ...
   *   ]
   * }
   */
  @Get(':jobName/history')
  getJobHistory(@Param('jobName') jobName: string): any {
    if (!jobName) {
      throw new BadRequestException('Job name is required');
    }

    const data = this.jobMonitoringService.getJobExecutionHistory(jobName, 50);
    return {
      success: true,
      data,
    };
  }

  /**
   * Get detailed statistics for a specific job
   * 
   * Returns comprehensive metrics:
   * - Total executions and time period
   * - Success rate with counts
   * - Performance stats (avg, min, max duration)
   * - Trend information (last success/failure times)
   * 
   * Useful for:
   * - Debugging performance regressions
   * - Identifying when jobs started failing
   * - Capacity planning
   * - SLA monitoring
   * 
   * GET /jobs/:jobName/statistics
   * 
   * @param jobName - Name of the job
   * @returns Comprehensive statistics object
   * 
   * @example
   * GET /api/v1/jobs/settlement-reconciliation/statistics
   * Authorization: Bearer eyJhbG...
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": {
   *     "jobName": "settlement-reconciliation",
   *     "totalExecutions": 432,
   *     "successCount": 431,
   *     "failureCount": 1,
   *     "successRate": 0.9977,
   *     "averageDuration": 2150,
   *     "minDuration": 1200,
   *     "maxDuration": 5400,
   *     "lastExecution": "2025-03-23T10:35:42.123Z",
   *     "lastSuccess": "2025-03-23T10:35:42.123Z",
   *     "lastFailure": "2025-03-22T15:20:18.456Z"
   *   }
   * }
   */
  @Get(':jobName/statistics')
  getJobDetailedStatistics(@Param('jobName') jobName: string) {
    if (!jobName) {
      throw new BadRequestException('Job name is required');
    }

    const data = this.jobMonitoringService.getJobStatistics(jobName);
    return {
      success: true,
      data,
    };
  }
}
