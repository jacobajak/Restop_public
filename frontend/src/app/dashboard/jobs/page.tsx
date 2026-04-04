import React from 'react';
import JobMonitoringDashboard from '@/components/dashboard/jobs/JobMonitoringDashboard';

/**
 * Job Monitoring Dashboard Page
 * 
 * Admin-only page for monitoring background job health and performance.
 * Route: /dashboard/jobs
 */
export default function JobsPage() {
  return <JobMonitoringDashboard />;
}
