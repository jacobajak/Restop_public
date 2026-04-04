'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import { Download, Calendar, Filter, TrendingUp, DollarSign, Eye } from 'lucide-react';
import { settlementService, TransactionRecord } from '@/services/settlementService';

interface ReportSummary {
  total_transactions: number;
  total_revenue: number;
  platform_fees: number;
  provider_fees: number;
  net_payable: number;
  completed_count: number;
  pending_count: number;
  failed_count: number;
}

export default function ReportsPage() {
  const { hasPageAccess } = useRoleAccess();
  const [activeReport, setActiveReport] = useState<'summary' | 'detailed' | 'daily'>('summary');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!hasPageAccess('reports')) {
      return;
    }

    loadReportData();
  }, [hasPageAccess]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const result = await settlementService.getTransactionHistory({
        limit: 1000,
        offset: 0,
        method: paymentMethod || undefined,
        status: transactionStatus || undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      });

      setTransactions(result.data);

      // Calculate summary
      const summary: ReportSummary = {
        total_transactions: result.total,
        total_revenue: result.data.reduce((sum, t) => sum + t.amount, 0),
        platform_fees: result.data.reduce((sum, t) => sum + t.platform_fee, 0),
        provider_fees: result.data.reduce((sum, t) => sum + t.provider_fee, 0),
        net_payable: result.data.reduce((sum, t) => sum + t.net_payable, 0),
        completed_count: result.data.filter(t => t.status === 'COMPLETED').length,
        pending_count: result.data.filter(t => t.status === 'PENDING').length,
        failed_count: result.data.filter(t => t.status === 'FAILED').length,
      };

      setSummary(summary);
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = () => {
    loadReportData();
  };

  const exportReport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      if (format === 'csv') {
        const headers = [
          'Date',
          'Order ID',
          'Payment Method',
          'Amount (RWF)',
          'Platform Fee (RWF)',
          'Provider Fee (RWF)',
          'Net Payable (RWF)',
          'Status',
        ];
        const rows = transactions.map((t) => [
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
        link.setAttribute('download', `report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error exporting report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!hasPageAccess('reports')) {
    return (
      <DashboardLayout>
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Only authorized users can access reports.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-dark-text mb-2">
              📊 Reports & Analytics
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Comprehensive view of all transactions and financial data
            </p>
          </div>
          <button
            onClick={() => exportReport('csv')}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={20} />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Filters */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-neutral-600" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text">
              Filters
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-gray-800 dark:text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-gray-800 dark:text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-gray-800 dark:text-dark-text"
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
                value={transactionStatus}
                onChange={(e) => setTransactionStatus(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-border rounded-lg dark:bg-gray-800 dark:text-dark-text"
              >
                <option value="">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleFilterChange}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Apply Filters
          </button>
        </Card>

        {summary && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                      Total Transactions
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
                      {summary.total_transactions}
                    </p>
                  </div>
                  <TrendingUp className="text-blue-500" size={40} />
                </div>
                <div className="mt-4 text-xs space-y-1">
                  <p className="text-green-600">✓ Completed: {summary.completed_count}</p>
                  <p className="text-yellow-600">⏳ Pending: {summary.pending_count}</p>
                  <p className="text-red-600">✗ Failed: {summary.failed_count}</p>
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                      Total Revenue
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
                      {formatCurrency(summary.total_revenue)}
                    </p>
                  </div>
                  <DollarSign className="text-green-500" size={40} />
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                      Total Fees
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
                      {formatCurrency(summary.platform_fees + summary.provider_fees)}
                    </p>
                  </div>
                  <div className="text-orange-500 text-4xl">⚙️</div>
                </div>
                <div className="mt-4 text-xs space-y-1">
                  <p>Platform: {formatCurrency(summary.platform_fees)}</p>
                  <p>Provider: {formatCurrency(summary.provider_fees)}</p>
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                      Net Payable
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
                      {formatCurrency(summary.net_payable)}
                    </p>
                  </div>
                  <Eye className="text-purple-500" size={40} />
                </div>
              </Card>
            </div>
          </>
        )}

        {/* Detailed Transaction Table */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text mb-4">
            📋 Transaction Details
          </h2>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-neutral-500">Loading...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 dark:border-dark-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                      Method
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                      Fees
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                      Net
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-neutral-700 dark:text-neutral-300">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-neutral-900 dark:text-dark-text">
                        {new Date(t.created_at).toLocaleDateString('en-RW', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-neutral-900 dark:text-dark-text font-mono text-xs">
                        {t.order_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium">
                          {t.payment_method === 'MTN' && '📱 MTN'}
                          {t.payment_method === 'AIRTEL' && '📱 Airtel'}
                          {t.payment_method === 'CASH' && '💵 Cash'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-900 dark:text-dark-text font-medium">
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400 text-xs">
                        {formatCurrency(t.platform_fee + t.provider_fee)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-900 dark:text-dark-text font-medium">
                        {formatCurrency(t.net_payable)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            t.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : t.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Footer Note */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-200 mb-1">
                Report Information
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                All reports are generated from verified transaction data. Platform fees are collected
                by RESTOP, while provider fees are charged by payment partners (MTN/Airtel).
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
