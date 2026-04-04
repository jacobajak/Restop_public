'use client';

import React, { useEffect, useState } from 'react';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';
import axios from 'axios';

interface Payment {
  id: string;
  order_id: string;
  tenant_id: string;
  provider: string;
  kind: string;
  amount: number;
  status: string;
  provider_ref: string;
  created_at: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    method: '',
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

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(`${apiUrl}/admin/payments`, {
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
        setPayments(response.data.data.payments || []);
      } else {
        setError('Failed to load payments');
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [filters]);

  // Subscribe to real-time payment updates
  useAdminWebSocket(adminId, (event) => {
    if (event.event === 'admin/payment.updated') {
      console.log('💳 Payment updated via WebSocket:', event.data);
      // Update the payment in the list or full refresh
      setPayments((prevPayments) =>
        prevPayments.map((payment) =>
          payment.id === event.data.id
            ? {
                ...payment,
                status: event.data.status,
                amount: event.data.amount,
                method: event.data.method,
              }
            : payment
        )
      );
    }
  });

  const columns = [
    {
      key: 'provider_ref' as const,
      label: 'Transaction ID',
      width: '20%',
      render: (value: string) => <span className="font-mono text-xs">{value}</span>,
    },
    {
      key: 'kind' as const,
      label: 'Type',
      width: '12%',
    },
    {
      key: 'provider' as const,
      label: 'Provider',
      width: '12%',
      render: (value: string) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'amount' as const,
      label: 'Amount',
      width: '15%',
      render: (value: number) => `RWF ${value.toLocaleString()}`,
    },
    {
      key: 'status' as const,
      label: 'Status',
      width: '18%',
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: 'created_at' as const,
      label: 'Date',
      width: '20%',
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payments Monitoring</h2>
        <p className="text-gray-600">Track all payment transactions across the platform</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="INITIATED">Initiated</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESSFUL">Successful</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={filters.method}
          onChange={(e) => setFilters({ ...filters, method: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Methods</option>
          <option value="PAYPACK">Paypack</option>
          <option value="FLUTTERWAVE">Flutterwave</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Total Transactions</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{payments.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Successful</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {payments.filter((p) => p.status === 'SUCCESSFUL').length}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {payments.filter((p) => p.status === 'PENDING').length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Failed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {payments.filter((p) => p.status === 'FAILED').length}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800 font-medium">Error loading payments</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Payments Table */}
      <AdminDataTable
        columns={columns}
        data={payments}
        isLoading={loading}
        total={payments.length}
        onRowClick={(payment) => {
          // TODO: Navigate to payment details page
          console.log('Clicked payment:', payment);
        }}
      />
    </div>
  );
}
