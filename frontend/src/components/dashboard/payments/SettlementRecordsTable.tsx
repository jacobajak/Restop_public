'use client';

import React, { useState, useEffect } from 'react';
import { Card, Loading } from '@/components/common';
import { settlementService, SettlementRecord } from '@/services/settlementService';

export const SettlementRecordsTable: React.FC = () => {
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await settlementService.getSettlementRecords({
          limit,
          offset: page * limit,
        });
        setRecords(result.data);
        setTotal(result.total);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, [page, limit]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-RW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  };

  const getDestination = (record: SettlementRecord) => {
    if (record.mobile_number) {
      return `📱 ${record.mobile_number}`;
    }
    if (record.bank_account) {
      return `🏦 ${record.bank_account}`;
    }
    return '—';
  };

  if (isLoading && records.length === 0) {
    return <Loading />;
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {error ? (
          <div className="p-6 text-center text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        ) : records.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
            📭 No payout records found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-dark-surface border-b border-neutral-200 dark:border-dark-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Destination
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-neutral-50 dark:hover:bg-dark-surface/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-neutral-900 dark:text-dark-text">
                        {formatDate(record.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-neutral-900 dark:text-dark-text font-semibold">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 dark:text-dark-text">
                        {getDestination(record)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 font-mono text-xs">
                        {record.reference}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-dark-border">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-dark-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-dark-surface"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="px-3 py-1 text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-dark-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-dark-surface"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
