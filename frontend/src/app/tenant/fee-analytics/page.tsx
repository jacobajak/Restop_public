'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/common';
import axios from 'axios';
import { format } from 'date-fns';

interface FeeSettlement {
  id: string;
  settlement_period_start: string;
  settlement_period_end: string;
  total_fees_collected: number;
  settlement_amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SETTLED';
  confirmed_at?: string;
  admin_notes?: string;
  transaction_count?: number;
}

interface FeeSummary {
  pending_fees: {
    count: number;
    total_amount: number;
  };
  awaiting_admin_confirmation: {
    count: number;
    total_amount: number;
  };
  recently_settled: {
    count: number;
    total_amount: number;
  };
  last_settlement?: FeeSettlement;
}

interface MonthlyAnalytics {
  month: string;
  period_start: string;
  period_end: string;
  pending: {
    count: number;
    total_amount: number;
    settlements: FeeSettlement[];
  };
  confirmed: {
    count: number;
    total_amount: number;
    settlements: FeeSettlement[];
  };
  settled: {
    count: number;
    total_amount: number;
    settlements: FeeSettlement[];
  };
  total_this_month: {
    amount: number;
    transaction_count: number;
  };
}

export default function PlatformFeeAnalyticsPage() {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [pendingSettlements, setPendingSettlements] = useState<FeeSettlement[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [historySettlements, setHistorySettlements] = useState<FeeSettlement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSettlement, setSelectedSettlement] = useState<FeeSettlement | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/fee-analytics/summary`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('tenant_token')}` } }
      );
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load fee summary' });
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchPending = async () => {
    setLoadingPending(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/fee-analytics/pending`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('tenant_token')}` } }
      );
      if (response.data.success) {
        setPendingSettlements(response.data.data.items || response.data.data || []);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load pending fees' });
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/fee-analytics/history?limit=100`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('tenant_token')}` } }
      );
      if (response.data.success) {
        setHistorySettlements(response.data.data.items || response.data.data || []);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load settlement history' });
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchMonthlyAnalytics = async () => {
    setLoadingMonthly(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/fee-analytics/current-month`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('tenant_token')}` } }
      );
      if (response.data.success) {
        setMonthlyAnalytics(response.data.data);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load monthly analytics' });
    } finally {
      setLoadingMonthly(false);
    }
  };

  const fetchSettlementDetails = async (settlementId: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/tenants/fee-analytics/settlement/${settlementId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('tenant_token')}` } }
      );
      if (response.data.success) {
        setSelectedSettlement(response.data.data);
        setShowDetailsModal(true);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load settlement details' });
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchPending();
    fetchHistory();
    fetchMonthlyAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Fee Analytics</h1>
        <p className="text-gray-600">Track your platform fees and settlement status</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Summary Cards */}
      {!loadingSummary && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className={`p-4 ${summary.pending_fees.count > 0 ? 'border-l-4 border-yellow-500' : ''}`}>
              <p className="text-sm text-gray-600 font-medium">Pending Fees</p>
              <p className="text-2xl font-bold mt-2">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(summary.pending_fees.total_amount)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summary.pending_fees.count} settlement{summary.pending_fees.count !== 1 ? 's' : ''}</p>
            </div>
          </Card>

          <Card>
            <div className={`p-4 ${summary.awaiting_admin_confirmation.count > 0 ? 'border-l-4 border-blue-500' : ''}`}>
              <p className="text-sm text-gray-600 font-medium">Awaiting Confirmation</p>
              <p className="text-2xl font-bold mt-2">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(summary.awaiting_admin_confirmation.total_amount)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summary.awaiting_admin_confirmation.count} settlement{summary.awaiting_admin_confirmation.count !== 1 ? 's' : ''}</p>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-l-4 border-green-500">
              <p className="text-sm text-gray-600 font-medium">Recently Settled</p>
              <p className="text-2xl font-bold mt-2">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(summary.recently_settled.total_amount)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summary.recently_settled.count} settlement{summary.recently_settled.count !== 1 ? 's' : ''}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Alert Banner */}
      {!loadingSummary && summary && summary.pending_fees.count > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-medium">⚠️ Pending Fees</p>
          <p className="text-sm text-yellow-700 mt-1">
            You have {summary.pending_fees.count} settlement{summary.pending_fees.count !== 1 ? 's' : ''} awaiting platform review totaling{' '}
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(summary.pending_fees.total_amount)}
            . The platform team will review and confirm these within 2-3 business days.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="border-b border-gray-200 mb-4 flex gap-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 font-medium ${activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Pending ({summary?.pending_fees.count || 0})
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 font-medium ${activeTab === 'monthly' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            This Month
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            History
          </button>
        </div>

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Pending Fee Settlements</h2>
              <p className="text-sm text-gray-600 mb-4">Fees pending platform review and confirmation. Once confirmed, they'll be marked as settled.</p>

              {loadingPending ? (
                <p className="text-gray-500">Loading pending settlements...</p>
              ) : pendingSettlements.length === 0 ? (
                <p className="text-gray-500">No pending fees. Great work!</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Period</th>
                        <th className="px-4 py-2 text-right">Transactions</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingSettlements.map((settlement) => (
                        <tr key={settlement.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(settlement.settlement_period_start), 'MMM dd')} -{' '}
                            {format(new Date(settlement.settlement_period_end), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{settlement.transaction_count || 0}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(settlement.settlement_amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge>{settlement.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => fetchSettlementDetails(settlement.id)} className="text-blue-600 hover:underline text-sm">
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Monthly Tab */}
        {activeTab === 'monthly' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2">Monthly Analytics</h2>
              {monthlyAnalytics && (
                <p className="text-sm text-gray-600 mb-4">
                  {monthlyAnalytics.month} ({format(new Date(monthlyAnalytics.period_start), 'MMM dd')} -{' '}
                  {format(new Date(monthlyAnalytics.period_end), 'MMM dd')})
                </p>
              )}

              {loadingMonthly ? (
                <p className="text-gray-500">Loading monthly data...</p>
              ) : monthlyAnalytics ? (
                <div className="space-y-6">
                  {/* Monthly Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 font-medium">Total Fees This Month</p>
                      <p className="text-3xl font-bold mt-2">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(monthlyAnalytics.total_this_month.amount)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">From {monthlyAnalytics.total_this_month.transaction_count} transactions</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 font-medium">Average Fee Per Transaction</p>
                      <p className="text-3xl font-bold mt-2">
                        {monthlyAnalytics.total_this_month.transaction_count > 0
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(
                              monthlyAnalytics.total_this_month.amount / monthlyAnalytics.total_this_month.transaction_count
                            )
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Platform commission rate</p>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-gray-600 font-medium">Pending</p>
                      <p className="text-2xl font-bold mt-2">{monthlyAnalytics.pending.count}</p>
                      <p className="text-xs text-gray-500">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(monthlyAnalytics.pending.total_amount)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-gray-600 font-medium">Confirmed</p>
                      <p className="text-2xl font-bold mt-2">{monthlyAnalytics.confirmed.count}</p>
                      <p className="text-xs text-gray-500">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(monthlyAnalytics.confirmed.total_amount)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-gray-600 font-medium">Settled</p>
                      <p className="text-2xl font-bold mt-2">{monthlyAnalytics.settled.count}</p>
                      <p className="text-xs text-gray-500">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(monthlyAnalytics.settled.total_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Settlement History</h2>

              {loadingHistory ? (
                <p className="text-gray-500">Loading history...</p>
              ) : historySettlements.length === 0 ? (
                <p className="text-gray-500">No settlement history yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Period</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2">Confirmed</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historySettlements.map((settlement) => (
                        <tr key={settlement.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(settlement.settlement_period_start), 'MMM dd')} -{' '}
                            {format(new Date(settlement.settlement_period_end), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(settlement.settlement_amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge>{settlement.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{settlement.confirmed_at ? format(new Date(settlement.confirmed_at), 'MMM dd, yyyy') : 'N/A'}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => fetchSettlementDetails(settlement.id)} className="text-blue-600 hover:underline text-sm">
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Settlement Details</h2>
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Period</p>
                    <p className="text-sm font-medium mt-1">
                      {format(new Date(selectedSettlement.settlement_period_start), 'MMM dd')} -{' '}
                      {format(new Date(selectedSettlement.settlement_period_end), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Status</p>
                    <p className="text-sm font-medium mt-1">
                      <Badge>{selectedSettlement.status}</Badge>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Amount</p>
                    <p className="text-sm font-medium mt-1">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(selectedSettlement.settlement_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Transactions</p>
                    <p className="text-sm font-medium mt-1">{selectedSettlement.transaction_count || 0}</p>
                  </div>
                </div>

                {selectedSettlement.admin_notes && (
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Notes</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedSettlement.admin_notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setShowDetailsModal(false)} className="flex-1">Close</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
