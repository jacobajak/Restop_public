'use client';

import React from 'react';
import { Card } from '@/components/common';
import { SettlementSummary } from '@/services/settlementService';

interface SettlementSummaryCardsProps {
  summary: SettlementSummary;
}

export const SettlementSummaryCards: React.FC<SettlementSummaryCardsProps> = ({
  summary,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Wallet Balance */}
      <Card className="p-6 border-l-4 border-l-green-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Wallet Balance
            </p>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(summary.wallet_balance)}
            </h3>
          </div>
          <div className="text-3xl">💰</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-3">
          Available for withdrawal
        </p>
      </Card>

      {/* Pending Payouts */}
      <Card className="p-6 border-l-4 border-l-yellow-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Pending Payouts
            </p>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(summary.pending)}
            </h3>
          </div>
          <div className="text-3xl">⏳</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-3">
          Processing to your account
        </p>
      </Card>

      {/* Settled Payouts */}
      <Card className="p-6 border-l-4 border-l-blue-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Settled Payouts
            </p>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(summary.settled)}
            </h3>
          </div>
          <div className="text-3xl">✅</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-3">
          Successfully received
        </p>
      </Card>

      {/* Failed Payouts */}
      <Card className="p-6 border-l-4 border-l-red-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Failed Payouts
            </p>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
              {formatCurrency(summary.failed)}
            </h3>
          </div>
          <div className="text-3xl">❌</div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-3">
          Requires attention
        </p>
      </Card>
    </div>
  );
};
