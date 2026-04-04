'use client';

import React, { useEffect, useState } from 'react';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';
import axios from 'axios';

interface Settlement {
  id: string;
  tenant_id: string;
  order_id: string;
  amount: number;
  status: string;
  destination_network?: string;
  initiated_at: string;
  completed_at?: string;
}

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
  });
  const [adminId] = useState<string>(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
      }
    } catch (e) {
      console.error('Failed to decode admin ID:', e);
    }
    return '';
  });

  const fetchSettlements = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(`${apiUrl}/admin/settlements`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit: 100,
          offset: 0,
          ...filters,
        },
      });

      if (response.data.success) {
        setSettlements(response.data.data.settlements || []);
      } else {
        setError('Failed to load settlements');
      }
    } catch (err) {
      console.error('Error fetching settlements:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [filters]);

  // Subscribe to real-time settlement updates
  useAdminWebSocket(adminId, (event) => {
    if (event.event === 'admin/settlement.updated') {
      console.log('💰 Settlement updated via WebSocket:', event.data);
      // Update the settlement in the list or full refresh
      setSettlements((prevSettlements) =>
        prevSettlements.map((settlement) =>
          settlement.id === event.data.id
            ? {
                ...settlement,
                status: event.data.status,
                amount: event.data.amount,
                completed_at: event.data.completed_at,
              }
            : settlement
        )
      );
    }
  });

  const columns = [
    {
      key: 'id' as const,
      label: 'Settlement ID',
      width: '20%',
      render: (value: string) => <span className="font-mono text-xs">{value.slice(0, 12)}...</span>,
    },
    {
      key: 'order_id' as const,
      label: 'Order ID',
      width: '18%',
      render: (value: string) => <span className="font-mono text-xs">{value.slice(0, 12)}...</span>,
    },
    {
      key: 'amount' as const,
      label: 'Amount',
      width: '15%',
      render: (value: number) => `RWF ${value.toLocaleString()}`,
    },
    {
      key: 'destination_network' as const,
      label: 'Network',
      width: '12%',
      render: (value?: string) => <span>{value || 'N/A'}</span>,
    },
    {
      key: 'status' as const,
      label: 'Status',
      width: '18%',
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: 'initiated_at' as const,
      label: 'Date',
      width: '17%',
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Settlements & Payouts</h2>
        <p className="text-gray-600">Monitor and manage merchant payouts</p>
      </div>

      {/* Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="SUCCESSFUL">Successful</option>
          <option value="FAILED">Failed</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Total Payouts</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{settlements.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Successful</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {settlements.filter((s) => s.status === 'SUCCESSFUL').length}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {settlements.filter((s) => s.status === 'PENDING').length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Failed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {settlements.filter((s) => s.status === 'FAILED').length}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800 font-medium">Error loading settlements</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Settlements Table */}
      <AdminDataTable
        columns={columns}
        data={settlements}
        isLoading={loading}
        total={settlements.length}
        onRowClick={(settlement) => {
          // TODO: Navigate to settlement details page
          console.log('Clicked settlement:', settlement);
        }}
      />

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Settlement Process</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>✓ Orders are marked PAID when customer confirms payment</li>
          <li>✓ Settlements are automatically initiated based on settlement mode</li>
          <li>✓ Payouts are sent to the merchant's registered mobile money account</li>
          <li>✓ Failed payouts can be manually retried by admin</li>
        </ul>
      </div>
    </div>
  );
}
