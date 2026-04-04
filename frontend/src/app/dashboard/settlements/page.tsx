'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useWebSocket } from '@/hooks/useWebSocket';

interface EarningsSummary {
  gmv: number;
  order_count: number;
  platform_fee: number;
  net_earnings: number;
}

interface Payout {
  id: string;
  amount: number;
  destination?: string;
  network?: string;
  initiated_at?: string;
  completed_at?: string;
  reference?: string;
  reason?: string;
  failure_reason?: string;
}

interface PayoutGroup {
  count: number;
  amount: number;
  payouts?: Payout[];
}

interface SettlementData {
  period: string;
  earnings: EarningsSummary;
  payouts: {
    pending: PayoutGroup;
    completed: PayoutGroup;
    failed: PayoutGroup;
  };
}

interface SettlementHistory {
  id: string;
  amount: number;
  status: string;
  destination: string;
  network: string;
  initiated_at: string;
  completed_at?: string;
  reference?: string;
  failure_reason?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-800' },
    SUCCESSFUL: { bg: 'bg-green-100', text: 'text-green-800' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-800' },
  };

  const style = styles[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
};

export default function MerchantSettlementsPage() {
  const [summary, setSummary] = useState<SettlementData | null>(null);
  const [history, setHistory] = useState<SettlementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState({
    status: '',
    limit: 20,
    offset: 0,
  });

  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(`${apiUrl}/merchant/settlements`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setSummary(response.data.data);
      } else {
        setError('Failed to load settlements summary');
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const params = new URLSearchParams();
      params.append('limit', historyFilter.limit.toString());
      params.append('offset', historyFilter.offset.toString());
      if (historyFilter.status) {
        params.append('status', historyFilter.status);
      }

      const response = await axios.get(`${apiUrl}/merchant/settlements/history?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setHistory(response.data.data.payouts);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchHistory();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [historyFilter]);

  // Subscribe to real-time settlement updates
  const { socket } = useWebSocket();
  useEffect(() => {
    if (!socket) return;

    const handleSettlementInitiated = () => {
      console.log('📊 Settlement initiated, refreshing summary...');
      fetchSummary();
      fetchHistory();
    };

    const handleSettlementCompleted = () => {
      console.log('✅ Settlement completed, refreshing summary...');
      fetchSummary();
      fetchHistory();
    };

    socket.on('settlement_initiated', handleSettlementInitiated);
    socket.on('settlement_completed', handleSettlementCompleted);

    return () => {
      socket.off('settlement_initiated', handleSettlementInitiated);
      socket.off('settlement_completed', handleSettlementCompleted);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your settlements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Error loading settlements</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Earnings & Settlements</h2>
        <p className="text-gray-600">Track your daily earnings and payout status</p>
      </div>

      {summary && (
        <>
          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total GMV */}
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm font-medium">Today's GMV</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                RWF {summary.earnings.gmv.toLocaleString('en-US')}
              </p>
              <p className="text-gray-500 text-xs mt-2">{summary.earnings.order_count} orders</p>
            </div>

            {/* Platform Fees */}
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm font-medium">Platform Fees</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                -RWF {summary.earnings.platform_fee.toLocaleString('en-US')}
              </p>
              <p className="text-gray-500 text-xs mt-2">3% of GMV</p>
            </div>

            {/* Net Earnings */}
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <p className="text-gray-600 text-sm font-medium">Net Earnings</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                RWF {summary.earnings.net_earnings.toLocaleString('en-US')}
              </p>
              <p className="text-gray-500 text-xs mt-2">After fees</p>
            </div>

            {/* Pending Payout */}
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <p className="text-gray-600 text-sm font-medium">Pending Payout</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                RWF {summary.payouts.pending.amount.toLocaleString('en-US')}
              </p>
              <p className="text-gray-500 text-xs mt-2">{summary.payouts.pending.count} settlement(s)</p>
            </div>
          </div>

          {/* Pending Payouts Section */}
          {summary.payouts.pending.count > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-4">Pending Payouts</h3>
              <div className="space-y-3">
                {summary.payouts.pending.payouts?.map((payout) => (
                  <div key={payout.id} className="flex justify-between items-center bg-white p-4 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{payout.network} - {payout.destination}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Initiated: {new Date(payout.initiated_at || '').toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      RWF {payout.amount.toLocaleString('en-US')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Payouts Section */}
          {summary.payouts.failed.count > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4">Failed Payouts (Action Needed)</h3>
              <div className="space-y-3">
                {summary.payouts.failed.payouts?.map((payout) => (
                  <div key={payout.id} className="flex justify-between items-center bg-white p-4 rounded">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{payout.network} - {payout.destination}</p>
                      <p className="text-sm text-red-600 mt-1">Reason: {payout.failure_reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        RWF {payout.amount.toLocaleString('en-US')}
                      </p>
                      <button className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                        Retry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settlement History */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Settlement History</h3>
                <select
                  value={historyFilter.status}
                  onChange={(e) => setHistoryFilter({ ...historyFilter, status: e.target.value, offset: 0 })}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Status</option>
                  <option value="P ENDING">Pending</option>
                  <option value="SUCCESSFUL">Successful</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No settlement history available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Amount</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Network</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Destination</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((settlement) => (
                        <tr key={settlement.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(settlement.initiated_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            RWF {settlement.amount.toLocaleString('en-US')}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{settlement.network}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{settlement.destination}</td>
                          <td className="py-3 px-4 text-sm">
                            <StatusBadge status={settlement.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
