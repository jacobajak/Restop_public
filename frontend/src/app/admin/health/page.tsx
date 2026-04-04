'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface SystemHealthData {
  timestamp: string;
  system_health: {
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    score: number;
    lastChecked: string;
  };
  restaurants: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
    active_rate: number;
  };
  orders: {
    total: number;
    today: number;
    last_24h: number;
    last_hour: number;
    avg_per_hour: number;
    status_breakdown: Record<string, number>;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    last_24h: number;
    success_rate: number;
    failure_rate: number;
    method_breakdown: Record<string, number>;
  };
  refunds: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    approval_rate: number;
  };
  alerts: Array<{
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    timestamp: string;
  }>;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(`${apiUrl}/admin/health`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.success) {
        setHealth(response.data.data);
        setLastRefresh(new Date());
        setError(null);
      } else {
        setError('Failed to load health data');
      }
    } catch (err) {
      console.error('Error fetching health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'DEGRADED':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'CRITICAL':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'WARNING':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'INFO':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading system health...</p>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
            <h2 className="text-xl font-semibold mb-2">Error Loading Health Data</h2>
            <p>{error}</p>
            <button
              onClick={fetchHealth}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
            <p className="text-gray-600 mt-2">Last updated: {lastRefresh.toLocaleTimeString()}</p>
          </div>
          <button
            onClick={fetchHealth}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Now
          </button>
        </div>

        {/* System Status Card */}
        <div className={`border-2 rounded-lg p-6 mb-8 ${getStatusColor(health.system_health.status)}`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Overall System Status</h2>
              <p className="text-lg font-semibold mt-2">{health.system_health.status}</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{health.system_health.score}</div>
              <p className="text-sm mt-2">Health Score / 100</p>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Restaurants */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">Active Restaurants</h3>
            <p className="text-3xl font-bold text-gray-900">{health.restaurants.active}</p>
            <p className="text-sm text-gray-500 mt-2">of {health.restaurants.total} total</p>
            <p className="text-sm text-green-600 font-semibold mt-2">{health.restaurants.active_rate}% active</p>
          </div>

          {/* Orders Today */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">Orders Today</h3>
            <p className="text-3xl font-bold text-gray-900">{health.orders.today}</p>
            <p className="text-sm text-gray-500 mt-2">Avg: {health.orders.avg_per_hour}/hour</p>
            <p className="text-sm text-green-600 font-semibold mt-2">Last 24h: {health.orders.last_24h}</p>
          </div>

          {/* Payment Health */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">Payment Success Rate</h3>
            <p className="text-3xl font-bold text-gray-900">{health.payments.success_rate}%</p>
            <p className="text-sm text-gray-500 mt-2">Success: {health.payments.successful}</p>
            <p className="text-sm text-red-600 font-semibold mt-2">Failed: {health.payments.failed}</p>
          </div>

          {/* Pending Refunds */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">Pending Refunds</h3>
            <p className="text-3xl font-bold text-gray-900">{health.refunds.pending}</p>
            <p className="text-sm text-gray-500 mt-2">Approval: {health.refunds.approval_rate}%</p>
            <p className="text-sm text-orange-600 font-semibold mt-2">Approved: {health.refunds.approved}</p>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Restaurant Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Restaurant Status</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Active</span>
                  <span className="font-semibold text-green-600">{health.restaurants.active}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${health.restaurants.active_rate}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Suspended</span>
                  <span className="font-semibold text-red-600">{health.restaurants.suspended}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Pending</span>
                  <span className="font-semibold text-yellow-600">{health.restaurants.pending}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Status Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Order Status</h3>
            <div className="space-y-3">
              {Object.entries(health.orders.status_breakdown).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <span className="text-gray-700 capitalize">{status}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Methods (24h)</h3>
            <div className="space-y-3">
              {Object.entries(health.payments.method_breakdown).map(([method, count]) => (
                <div key={method} className="flex justify-between items-center">
                  <span className="text-gray-700 capitalize">{method}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Refund Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Refund Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Pending</span>
                <span className="font-semibold text-yellow-600">{health.refunds.pending}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Approved</span>
                <span className="font-semibold text-green-600">{health.refunds.approved}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Rejected</span>
                <span className="font-semibold text-red-600">{health.refunds.rejected}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-3 mt-3">
                <span className="text-gray-700 font-semibold">Total</span>
                <span className="font-bold text-gray-900">{health.refunds.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {health.alerts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">System Alerts</h3>
            <div className="space-y-4">
              {health.alerts.map((alert, idx) => (
                <div key={idx} className={`border rounded-lg p-4 ${getAlertColor(alert.severity)}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">{alert.title}</h4>
                      <p className="mt-1">{alert.message}</p>
                    </div>
                    <span className="text-xs font-semibold capitalize px-2 py-1 bg-black bg-opacity-10 rounded">
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Platform Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{health.orders.total}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{health.payments.total}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Restaurants</p>
              <p className="text-2xl font-bold text-gray-900">{health.restaurants.total}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Refunds</p>
              <p className="text-2xl font-bold text-gray-900">{health.refunds.total}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
