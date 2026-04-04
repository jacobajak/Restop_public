'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/common';
import { Spinner } from '@/components/common';
import { useToast } from '@/components/common';
import { SettlementSummaryCards } from './SettlementSummaryCards';
import { TodaySummaryCards } from './TodaySummaryCards';
import { TransactionHistoryTable } from './TransactionHistoryTable';
import { SettlementRecordsTable } from './SettlementRecordsTable';
import { DailyRevenueChart } from './DailyRevenueChart';
import { VerificationBadge } from '../../payments/VerificationBadge';
import { VerificationInfoModal } from '../../payments/VerificationInfoModal';
import { settlementService, SettlementSummary } from '@/services/settlementService';
import { merchantVerificationService } from '@/services/merchantVerificationService';
import { useSettlementWebSocket, SettlementEvent } from '@/hooks/useSettlementWebSocket';
import { useAuth } from '@/context/AuthContext';

interface PaymentDashboardProps {
  summary: SettlementSummary | null;
  isLoading: boolean;
  error: string | null;
}

interface VerificationInfo {
  verification_status: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'SUSPENDED';
  message: string;
  requirements: string[];
  verified_accounts_count: number;
  total_accounts_count: number;
  can_receive_payouts: boolean;
}

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({
  summary,
  isLoading,
  error,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'payouts' | 'daily'>('transactions');
  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  
  // Use ref to debounce settlement event refresh (prevent excessive state updates)
  const settlementEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch verification info on mount
  useEffect(() => {
    const fetchVerificationInfo = async () => {
      try {
        setVerificationLoading(true);
        setVerificationError(null);
        const response = await merchantVerificationService.getVerificationStatus();
        setVerificationInfo(response.data);
      } catch (err: any) {
        console.error('Failed to fetch verification info:', err);
        setVerificationError(err.message || 'Failed to fetch verification status');
      } finally {
        setVerificationLoading(false);
      }
    };

    fetchVerificationInfo();
  }, []);

  // Handle settlement events with debouncing to prevent excessive re-renders
  const handleSettlementEvent = useCallback((event: SettlementEvent) => {
    // Clear existing timeout to debounce multiple events
    if (settlementEventTimeoutRef.current) {
      clearTimeout(settlementEventTimeoutRef.current);
    }

    // Just show toast immediately without triggering refresh
    if (event.event === 'settlement_initiated') {
      console.log('🔄 Settlement initiated event received');
      toast.success(`💰 Payment received: ${event.data.amount.toLocaleString()} RWF`);
    } else if (event.event === 'settlement_completed') {
      console.log('🔄 Settlement completed event received');
      toast.success(`✅ Payout completed to ${event.data.destination}`);
    }
    
    // Note: Removed setRefreshTrigger to prevent infinite update cycles
    // Settlement data will update naturally on next polling interval or page refresh
  }, [toast]);

  // Subscribe to real-time settlement events
  const { isConnected } = useSettlementWebSocket(user?.tenant_id || null, handleSettlementEvent);

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <Card className="text-center py-12 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
          Unable to Load Payment Data
        </h2>
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-dark-text mb-2">
              💰 Payment & Settlement
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Track transactions, payouts, and daily revenue
            </p>
          </div>
          
          {/* WebSocket Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <a
            href="/dashboard/payments"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition text-blue-900 dark:text-blue-200 font-medium text-sm hover:shadow-md"
          >
            📊 Transactions
          </a>
          <a
            href="/dashboard/reports"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 transition text-purple-900 dark:text-purple-200 font-medium text-sm hover:shadow-md"
          >
            📈 View Reports
          </a>
          <a
            href="/dashboard/settings/payment"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/60 transition text-orange-900 dark:text-orange-200 font-medium text-sm hover:shadow-md"
          >
            ⚙️ Settings
          </a>
          <a
            href="/dashboard/payments?export=csv"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition text-green-900 dark:text-green-200 font-medium text-sm hover:shadow-md"
          >
            ⬇️ Download
          </a>
        </div>
      </div>

      {/* Verification Badge */}
      {verificationInfo && (
        <>
          <VerificationBadge
            status={verificationInfo}
            compact={false}
            showRequirements={true}
            onViewDetails={() => setShowVerificationModal(true)}
          />
          <VerificationInfoModal
            isOpen={showVerificationModal}
            onClose={() => setShowVerificationModal(false)}
            verificationInfo={verificationInfo}
            isLoading={verificationLoading}
            error={verificationError || undefined}
          />
        </>
      )}

      {/* Summary Cards */}
      {summary && (
        <>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text">
            📈 Today's Summary
          </h2>
          <TodaySummaryCards />

          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text mt-6">
            💼 Overall Settlement
          </h2>
          <SettlementSummaryCards summary={summary} />
        </>
      )}

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-neutral-200 dark:border-dark-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-dark-text'
            }`}
          >
            📊 Transaction History
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'payouts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-dark-text'
            }`}
          >
            💳 Settlement & Payouts
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'daily'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-dark-text'
            }`}
          >
            📈 Daily Revenue Chart
          </button>
        </div>

        {/* Tab Descriptions */}
        <Card className="p-4 bg-neutral-50 dark:bg-gray-800 border-l-4 border-l-blue-500">
          {activeTab === 'transactions' && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              View all individual customer payment transactions. Filter by payment method, status, and date range. Download transaction data as CSV for external analysis.
            </p>
          )}
          {activeTab === 'payouts' && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              View settlements and payouts to your mobile money accounts. Shows when payments were processed and sent to your registered account.
            </p>
          )}
          {activeTab === 'daily' && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Visual breakdown of revenue by day. Helps you identify peak periods and track business growth over time.
            </p>
          )}
        </Card>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'transactions' && <TransactionHistoryTable />}
        {activeTab === 'payouts' && <SettlementRecordsTable />}
        {activeTab === 'daily' && <DailyRevenueChart />}
      </div>
    </div>
  );
};
