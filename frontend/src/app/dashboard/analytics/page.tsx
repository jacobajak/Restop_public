'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import { analyticsService, DashboardAnalytics } from '@/services/analyticsService';

export default function AnalyticsPage() {
  const { hasPageAccess } = useRoleAccess();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPageAccess('analytics')) {
      setIsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('📊 Fetching dashboard analytics...');
        const data = await analyticsService.getDashboardAnalytics();
        console.log('✅ Analytics loaded:', data);
        setAnalytics(data);
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || err.message || 'Failed to load analytics';
        console.error('❌ Failed to load analytics:', errorMsg);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (!hasPageAccess('analytics')) {
    return (
      <DashboardLayout>
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Only Managers and Owners can view analytics.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AnalyticsDashboard analytics={analytics} isLoading={isLoading} error={error} />
    </DashboardLayout>
  );
}
