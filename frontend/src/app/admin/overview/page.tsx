'use client';

import React, { useEffect, useState } from 'react';
import { SummaryCard } from '@/components/admin/SummaryCard';
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket';
import axios from 'axios';

interface OverviewData {
  platform_summary: {
    total_restaurants: number;
    active_restaurants_today: number;
    total_orders_today: number;
    total_gmv_today: number;
    average_order_value: number;
  };
  payments_today: {
    cash: number;
    mtn: number;
    airtel: number;
    total: number;
  };
  settlements: {
    pending: number;
    successful: number;
    failed: number;
  };
  platform_stats: {
    successful_payments: number;
    failed_payments: number;
    pending_settlements: number;
    failed_settlements: number;
  };
  latest_activity: any[];
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminId] = useState<string>(() => {
    // Get admin ID from localStorage or JWT
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

  const fetchOverview = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(`${apiUrl}/admin/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError('Failed to load overview data');
      }
    } catch (err) {
      console.error('Error fetching overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchOverview();
  }, []);

  // Subscribe to admin WebSocket events
  useAdminWebSocket(adminId, (event) => {
    if (event.event === 'admin/metrics.updated') {
      // Update data with new metrics from WebSocket
      console.log('📊 Updating overview with real-time metrics:', event.data);
      setData((prevData) =>
        prevData
          ? {
              ...prevData,
              platform_summary: {
                total_restaurants: event.data.activeRestaurants || prevData.platform_summary.total_restaurants,
                active_restaurants_today: event.data.activeRestaurants || prevData.platform_summary.active_restaurants_today,
                total_orders_today: event.data.todaysOrders || prevData.platform_summary.total_orders_today,
                total_gmv_today: event.data.todaysGMV || prevData.platform_summary.total_gmv_today,
                average_order_value:
                  event.data.todaysOrders > 0
                    ? (event.data.todaysGMV || 0) / event.data.todaysOrders
                    : prevData.platform_summary.average_order_value,
              },
              payments_today: event.data.todaysPaymentMethods || prevData.payments_today,
            }
          : null
      );
    } else if (
      event.event === 'admin/order.updated' ||
      event.event === 'admin/payment.updated' ||
      event.event === 'admin/settlement.updated'
    ) {
      // For other events, optionally refresh the full overview
      // Or implement targeted updates as needed
      console.log(`📊 Admin event received: ${event.event}, refreshing overview...`);
      fetchOverview();
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading platform overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Error loading overview</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Platform Overview</h2>
        <p className="text-gray-600">Real-time platform metrics and performance</p>
      </div>

      {/* Summary Cards - Restaurant Stats */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Restaurant Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard
            label="Total Restaurants"
            value={data.platform_summary.total_restaurants}
            icon="🏪"
            color="blue"
          />
          <SummaryCard
            label="Active Today"
            value={data.platform_summary.active_restaurants_today}
            icon="✅"
            color="green"
          />
          <SummaryCard
            label="Average Order Value"
            value={`RWF ${(data.platform_summary.average_order_value ?? 0).toLocaleString()}`}
            icon="📈"
            color="purple"
          />
        </div>
      </div>

      {/* Summary Cards - Orders & Revenue */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Orders</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard
            label="Total Orders"
            value={data.platform_summary.total_orders_today}
            icon="📦"
            color="blue"
          />
          <SummaryCard
            label="Total GMV"
            value={`RWF ${(data.platform_summary.total_gmv_today ?? 0).toLocaleString()}`}
            icon="💰"
            color="green"
          />
          <SummaryCard
            label="Platform Revenue"
            value={`RWF ${Math.round((data.platform_summary.total_gmv_today ?? 0) * 0.03).toLocaleString()}`}
            icon="💳"
            color="yellow"
            trend={{ value: 12, isPositive: true }}
          />
        </div>
      </div>

      {/* Summary Cards - Payments */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods Today</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard
            label="Cash Payments"
            value={data.payments_today.cash}
            icon="💴"
            color="green"
          />
          <SummaryCard
            label="MTN Mobile Money"
            value={data.payments_today.mtn}
            icon="📱"
            color="yellow"
          />
          <SummaryCard
            label="Airtel Money"
            value={data.payments_today.airtel}
            icon="📞"
            color="red"
          />
          <SummaryCard
            label="Total Payments"
            value={data.payments_today.total}
            icon="✓"
            color="blue"
          />
        </div>
      </div>

      {/* Summary Cards - Settlements */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Settlement Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard
            label="Pending Settlements"
            value={data.settlements.pending}
            icon="⏳"
            color="yellow"
          />
          <SummaryCard
            label="Successful Settlements"
            value={data.settlements.successful}
            icon="✅"
            color="green"
          />
          <SummaryCard
            label="Failed Settlements"
            value={data.settlements.failed}
            icon="❌"
            color="red"
          />
          <SummaryCard
            label="Success Rate"
            value={
              data.settlements.successful + data.settlements.failed > 0
                ? `${Math.round(
                    (data.settlements.successful /
                      (data.settlements.successful + data.settlements.failed)) *
                      100,
                  )}%`
                : 'N/A'
            }
            icon="📊"
            color="purple"
          />
        </div>
      </div>

      {/* Performance Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Payment Performance</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>✓ Successful: {data.platform_stats.successful_payments}</p>
            <p>✗ Failed: {data.platform_stats.failed_payments}</p>
            <p>
              Success Rate:{' '}
              {data.platform_stats.successful_payments + data.platform_stats.failed_payments > 0
                ? Math.round(
                    (data.platform_stats.successful_payments /
                      (data.platform_stats.successful_payments +
                        data.platform_stats.failed_payments)) *
                      100,
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-3">Settlement Health</h3>
          <div className="space-y-2 text-sm text-purple-800">
            <p>⏳ Pending: {data.platform_stats.pending_settlements}</p>
            <p>✗ Failed: {data.platform_stats.failed_settlements}</p>
            <p>Attention Needed: {data.platform_stats.failed_settlements} items</p>
          </div>
        </div>
      </div>
    </div>
  );
}
