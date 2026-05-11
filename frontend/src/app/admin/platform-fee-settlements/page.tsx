'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '@/components/common';
import axios from 'axios';
import { format } from 'date-fns';

interface PlatformFeeSettlement {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  settlement_period_start: string;
  settlement_period_end: string;
  total_fees_collected: number;
  settlement_amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SETTLED';
  confirmed_by_admin_id?: string;
  confirmed_at?: string;
  admin_notes?: string;
  transaction_count?: number;
}

interface SettlementStats {
  total_pending: number;
  total_pending_amount: number;
  total_confirmed_today: number;
  total_confirmed_today_amount: number;
}

export default function PlatformFeeSettlementsPage() {
  const [pendingSettlements, setPendingSettlements] = useState<PlatformFeeSettlement[]>([]);
  const [selectedSettlements, setSelectedSettlements] = useState<Set<string>>(new Set());
  const [loadingPending, setLoadingPending] = useState(true);
  const [historySettlements, setHistorySettlements] = useState<PlatformFeeSettlement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const fetchPendingSettlements = async () => {
    setLoadingPending(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/platform-fee-settlements/pending`,
        {
          params: { limit: 50, offset: 0 },
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        }
      );
      if (response.data.success) {
        setPendingSettlements(response.data.data.items || response.data.data || []);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load pending settlements' });
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/platform-fee-settlements/history?limit=50&offset=0`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      );
      if (response.data.success) {
        setHistorySettlements(response.data.data.items || response.data.data || []);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to load history' });
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/platform-fee-settlements/stats`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      );
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to load statistics' });
    } finally {
      setLoadingStats(false);
    }
  };

  const executeConfirmation = async () => {
    try {
      if (isBatchMode) {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/platform-fee-settlements/batch-confirm`,
          {
            settlement_ids: Array.from(selectedSettlements),
            notes: confirmNotes || undefined,
          },
          { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
        );
        if (response.data.success) {
          setMessage({ type: 'success', text: `${response.data.data.count} settlements confirmed` });
          setSelectedSettlements(new Set());
          setConfirmNotes('');
          fetchPendingSettlements();
          fetchStats();
        }
      } else {
        const response = await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/platform-fee-settlements/${confirmingId}/confirm`,
          { notes: confirmNotes || undefined },
          { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
        );
        if (response.data.success) {
          setMessage({ type: 'success', text: 'Settlement confirmed' });
          setConfirmingId(null);
          setConfirmNotes('');
          fetchPendingSettlements();
          fetchStats();
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to confirm' });
    } finally {
      setShowConfirmDialog(false);
    }
  };

  useEffect(() => {
    fetchPendingSettlements();
    fetchStats();
    fetchHistory();
  }, []);

  const toggleSettlement = (id: string) => {
    const newSelected = new Set(selectedSettlements);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSettlements(newSelected);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Fee Settlements</h1>
        <p className="text-gray-600">Manage restaurant platform fee settlement confirmations</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Statistics */}
      {!loadingStats && stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600 font-medium">Pending</p>
              <p className="text-2xl font-bold mt-2">{stats.total_pending}</p>
              <p className="text-xs text-gray-500">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(stats.total_pending_amount)}
              </p>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600 font-medium">Confirmed Today</p>
              <p className="text-2xl font-bold mt-2">{stats.total_confirmed_today}</p>
              <p className="text-xs text-gray-500">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(stats.total_confirmed_today_amount)}
              </p>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600 font-medium">Status</p>
              <p className="text-2xl font-bold mt-2">Active</p>
              <p className="text-xs text-gray-500">Feature operational</p>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="border-b border-gray-200 mb-4 flex gap-4">
          <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 font-medium ${activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}>
            Pending ({pendingSettlements.length})
          </button>
          <button onClick={() => setActiveTab('batch')} className={`px-4 py-2 font-medium ${activeTab === 'batch' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}>
            Batch ({selectedSettlements.size})
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 font-medium ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}>
            History
          </button>
        </div>

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Pending Settlements</h2>
              {loadingPending ? (
                <p className="text-gray-500">Loading...</p>
              ) : pendingSettlements.length === 0 ? (
                <p className="text-gray-500">No pending settlements</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Restaurant</th>
                        <th className="px-4 py-2 text-left">Period</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingSettlements.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{s.tenant_name || s.tenant_id}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {format(new Date(s.settlement_period_start), 'MMM dd')} - {format(new Date(s.settlement_period_end), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(s.settlement_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge>{s.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => { setConfirmingId(s.id); setIsBatchMode(false); setShowConfirmDialog(true); }} className="text-blue-600 hover:underline">
                              Confirm
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

        {/* Batch Tab */}
        {activeTab === 'batch' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Batch Confirm</h2>
              {selectedSettlements.size > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded">
                    <p className="font-medium">{selectedSettlements.size} selected</p>
                    <p className="text-sm text-gray-600">
                      Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(pendingSettlements.filter((s) => selectedSettlements.has(s.id)).reduce((sum, s) => sum + s.settlement_amount, 0))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Notes</label>
                    <Input placeholder="Optional notes..." value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} />
                  </div>
                  <Button onClick={() => { setIsBatchMode(true); setShowConfirmDialog(true); }} className="w-full bg-green-600 hover:bg-green-700">
                    Confirm {selectedSettlements.size}
                  </Button>
                </div>
              ) : (
                <p className="text-gray-500">Select settlements in Pending tab to batch confirm</p>
              )}
            </div>
          </Card>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Settlement History</h2>
              {loadingHistory ? (
                <p className="text-gray-500">Loading...</p>
              ) : historySettlements.length === 0 ? (
                <p className="text-gray-500">No history</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Restaurant</th>
                        <th className="px-4 py-2 text-left">Period</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Confirmed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historySettlements.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{s.tenant_name || s.tenant_id}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {format(new Date(s.settlement_period_start), 'MMM dd')} - {format(new Date(s.settlement_period_end), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RWF' }).format(s.settlement_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge>{s.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {s.confirmed_at ? format(new Date(s.confirmed_at), 'MMM dd') : 'N/A'}
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

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Confirm Settlement(s)</h2>
              <p className="text-gray-600 mb-4">
                {isBatchMode ? `Confirm ${selectedSettlements.size} settlements?` : 'Confirm this settlement?'}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <Input placeholder="..." value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowConfirmDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={executeConfirmation} className="flex-1 bg-green-600 hover:bg-green-700">Confirm</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
