'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/common';
import { settlementService, TransactionRecord } from '@/services/settlementService';

export const TodaySummaryCards: React.FC = () => {
  const [todayTransactions, setTodayTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTodayData = async () => {
      try {
        setIsLoading(true);
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const result = await settlementService.getTransactionHistory({
          limit: 1000,
          offset: 0,
          startDate: today,
          endDate: today,
        });
        setTodayTransactions(result.data);
      } catch (err) {
        console.error('Failed to load today data:', err);
        setTodayTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTodayData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate today's summary
  const completedTransactions = todayTransactions.filter((t) => t.status === 'COMPLETED');
  const totalCollectedToday = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashCollected = completedTransactions
    .filter((t) => t.payment_method === 'CASH')
    .reduce((sum, t) => sum + t.amount, 0);
  const momoCollected = completedTransactions
    .filter((t) => ['MTN', 'AIRTEL'].includes(t.payment_method))
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingPayments = todayTransactions.filter((t) => t.status === 'PENDING').length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-gray-300 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Collected Today */}
      <Card className="p-6 border-l-4 border-l-green-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Total Today
            </p>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(totalCollectedToday)}
            </h3>
          </div>
          <div className="text-2xl">📊</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
          {completedTransactions.length} transactions
        </p>
      </Card>

      {/* Cash Collected Today */}
      <Card className="p-6 border-l-4 border-l-blue-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              💵 Cash Today
            </p>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(cashCollected)}
            </h3>
          </div>
          <div className="text-2xl">💵</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
          Staff collected
        </p>
      </Card>

      {/* MoMo Collected Today */}
      <Card className="p-6 border-l-4 border-l-orange-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              📱 Mobile Money Today
            </p>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(momoCollected)}
            </h3>
          </div>
          <div className="text-2xl">📱</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
          MTN + Airtel
        </p>
      </Card>

      {/* Pending Payments */}
      <Card className="p-6 border-l-4 border-l-yellow-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              ⏳ Pending Today
            </p>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-dark-text">
              {pendingPayments}
            </h3>
          </div>
          <div className="text-2xl">⏳</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
          Awaiting confirmation
        </p>
      </Card>

      {/* Completion Rate */}
      <Card className="p-6 border-l-4 border-l-purple-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              ✅ Success Rate
            </p>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-dark-text">
              {todayTransactions.length > 0
                ? ((completedTransactions.length / todayTransactions.length) * 100).toFixed(0)
                : '0'}
              %
            </h3>
          </div>
          <div className="text-2xl">✅</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
          Of today's transactions
        </p>
      </Card>
    </div>
  );
};
