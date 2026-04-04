'use client';

import React, { useState, useEffect } from 'react';
import { Card, Loading } from '@/components/common';
import { Download } from 'lucide-react';
import { settlementService, TransactionRecord } from '@/services/settlementService';

export const TransactionHistoryTable: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [method, setMethod] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await settlementService.getTransactionHistory({
          limit,
          offset: page * limit,
          method: method || undefined,
          status: status || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setTransactions(result.data);
        setTotal(result.total);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, [page, limit, method, status, startDate, endDate]);

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

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'MTN':
        return '📱 MTN';
      case 'AIRTEL':
        return '📱 Airtel';
      case 'CASH':
        return '💵 Cash';
      default:
        return method;
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const result = await settlementService.getTransactionHistory({
        limit: 1000, // Get all available records
        offset: 0,
        method: method || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const headers = ['Date', 'Order ID', 'Payment Method', 'Amount (RWF)', 'Platform Fee (RWF)', 'Provider Fee (RWF)', 'Net Payable (RWF)', 'Status'];
      const rows = result.data.map((t) => [
        new Date(t.created_at).toLocaleString('en-RW'),
        t.order_id,
        t.payment_method,
        t.amount.toString(),
        t.platform_fee.toString(),
        t.provider_fee.toString(),
        t.net_payable.toString(),
        t.status,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && transactions.length === 0) {
    return <Loading />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-dark-surface"
              >
                <option value="">All Methods</option>
                <option value="MTN">MTN</option>
                <option value="AIRTEL">Airtel</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-dark-surface"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-dark-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-dark-surface"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={exportToCSV}
              disabled={isExporting || transactions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={18} />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {error ? (
          <div className="p-6 text-center text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
            📭 No transactions found
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Method
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Fees
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Net Payable
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-dark-text">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="hover:bg-neutral-50 dark:hover:bg-dark-surface/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-neutral-900 dark:text-dark-text">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 dark:text-dark-text">
                        {getMethodBadge(transaction.payment_method)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-neutral-900 dark:text-dark-text font-medium">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(transaction.platform_fee + transaction.provider_fee)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-600 dark:text-green-400 font-semibold">
                        {formatCurrency(transaction.net_payable)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
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
