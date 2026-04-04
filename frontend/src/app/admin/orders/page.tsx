'use client';

import React, { useEffect, useState } from 'react';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';
import axios from 'axios';

interface Order {
  id: string;
  order_number: string;
  tenant_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    payment_status: '',
    payment_method: '',
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

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(`${apiUrl}/admin/orders`, {
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
        setOrders(response.data.data.orders || []);
      } else {
        setError('Failed to load orders');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  // Subscribe to real-time order updates
  useAdminWebSocket(adminId, (event) => {
    if (event.event === 'admin/order.updated') {
      console.log('📋 Order updated via WebSocket:', event.data);
      // Update the order in the list
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === event.data.id
            ? {
                ...order,
                status: event.data.status,
                payment_status: event.data.payment_status,
                total_amount: event.data.total_amount,
              }
            : order
        )
      );
      // Or refresh the full list
      // fetchOrders();
    }
  });

  const columns = [
    {
      key: 'order_number' as const,
      label: 'Order #',
      width: '15%',
      render: (value: string) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'status' as const,
      label: 'Status',
      width: '15%',
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: 'payment_method' as const,
      label: 'Payment Method',
      width: '15%',
    },
    {
      key: 'payment_status' as const,
      label: 'Payment',
      width: '15%',
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: 'total_amount' as const,
      label: 'Amount',
      width: '15%',
      render: (value: number) => `RWF ${value.toLocaleString()}`,
    },
    {
      key: 'created_at' as const,
      label: 'Created',
      width: '15%',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Orders Monitoring</h2>
        <p className="text-gray-600">View and monitor all orders across the platform</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Order Statuses</option>
          <option value="CREATED">Created</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PREPARING">Preparing</option>
          <option value="READY">Ready</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={filters.payment_status}
          onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Payment Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={filters.payment_method}
          onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Payment Methods</option>
          <option value="CASH">Cash</option>
          <option value="MTN">MTN Mobile Money</option>
          <option value="AIRTEL">Airtel Money</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{orders.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Completed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {orders.filter((o) => o.status === 'COMPLETED').length}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {orders.filter((o) => o.status === 'PENDING_PAYMENT').length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Failed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {orders.filter((o) => o.status === 'CANCELLED').length}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800 font-medium">Error loading orders</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Orders Table */}
      <AdminDataTable
        columns={columns}
        data={orders}
        isLoading={loading}
        total={orders.length}
        onRowClick={(order) => {
          // TODO: Navigate to order details page
          console.log('Clicked order:', order);
        }}
      />
    </div>
  );
}
