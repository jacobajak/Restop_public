'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import { PaymentDashboard } from '@/components/dashboard/payments/PaymentDashboard';
import { settlementService } from '@/services/settlementService';

interface SettlementSummary {
  wallet_balance: number;
  pending: number;
  settled: number;
  failed: number;
}

export default function PaymentsPage() {
  const { hasPageAccess } = useRoleAccess();
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Memoized loadSettlement function outside effect to prevent recreations
  const loadSettlement = React.useCallback(async () => {
    setError(null);
    try {
      console.log('💰 Fetching settlement summary...');
      const data = await settlementService.getSettlementSummary();
      console.log('✅ Settlement summary loaded:', data);
      setSummary(data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load payment data';
      console.error('❌ Failed to load settlement:', errorMsg);
      setError(errorMsg);
    }
  }, []);

  // Initial load - runs only once on first mount
  useEffect(() => {
    // Guard: only run once
    if (initializedRef.current) return;
    
    // Guard: check access without adding to dependency array
    if (!hasPageAccess('payments')) {
      setIsLoading(false);
      return;
    }

    initializedRef.current = true;
    setIsLoading(true);
    loadSettlement().finally(() => setIsLoading(false));
  }, []);

  if (!hasPageAccess('payments')) {
    return (
      <DashboardLayout>
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Only restaurant owners, managers, and cashiers can access payment records.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PaymentDashboard summary={summary} isLoading={isLoading} error={error} />
    </DashboardLayout>
  );
}
