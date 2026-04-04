'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, ShoppingCart, Clock, AlertCircle } from 'lucide-react';
import { DashboardAnalytics } from '@/services/analyticsService';
import { formatPrice } from '@/utils/currency';

interface AnalyticsDashboardProps {
  analytics: DashboardAnalytics | null;
  isLoading?: boolean;
  error?: string | null;
}

const COLORS = ['#FF6B35', '#004E89', '#F7B801', '#06D6A0', '#EF476F', '#FFD166'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ analytics, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600 text-lg">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 bg-red-50 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <div>
            <p className="text-red-700 font-semibold">Error Loading Analytics</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600 text-lg">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue & Order Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Today */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 shadow-md border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-700 text-sm font-semibold">Revenue Today</p>
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{formatPrice(analytics.revenue.today)}</p>
          <p className="text-xs text-blue-600 mt-1">{analytics.revenue.ordersToday} orders</p>
        </div>

        {/* Orders Today */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 shadow-md border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-700 text-sm font-semibold">Orders Today</p>
            <ShoppingCart size={20} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">{analytics.orders.today}</p>
          <p className="text-xs text-green-600 mt-1">{analytics.orders.completed} completed</p>
        </div>

        {/* Average Order Value */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 shadow-md border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-orange-700 text-sm font-semibold">Average Order</p>
            <Clock size={20} className="text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-orange-900">{formatPrice(analytics.revenue.averageOrderValue)}</p>
          <p className="text-xs text-orange-600 mt-1">Per order</p>
        </div>

        {/* Commission Today */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 shadow-md border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-purple-700 text-sm font-semibold">Commission</p>
            <TrendingUp size={20} className="text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-900">{formatPrice(analytics.revenue.commissionToday)}</p>
          <p className="text-xs text-purple-600 mt-1">Platform fee (3%)</p>
        </div>
      </div>

      {/* Weekly Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-bold mb-4">Revenue Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-700">This Week</span>
              <span className="font-bold text-blue-600">{formatPrice(analytics.revenue.week)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-700">This Month</span>
              <span className="font-bold text-green-600">{formatPrice(analytics.revenue.month)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Avg Daily</span>
              <span className="font-bold text-orange-600">
                {formatPrice(analytics.revenue.week / 7)}
              </span>
            </div>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-bold mb-4">Order Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-red-700">Pending:</span>
              <span className="font-bold">{analytics.orders.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-700">Confirmed:</span>
              <span className="font-bold">{analytics.orders.confirmed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Preparing:</span>
              <span className="font-bold">{analytics.orders.preparing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-700">Ready:</span>
              <span className="font-bold">{analytics.orders.ready}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Completed:</span>
              <span className="font-bold">{analytics.orders.completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Rejected:</span>
              <span className="font-bold">{analytics.orders.rejected}</span>
            </div>
          </div>
        </div>

        {/* Live Orders */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Orders
          </h3>
          <div className="space-y-3">
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <p className="text-red-700 text-sm">New Orders</p>
              <p className="text-2xl font-bold text-red-600">{analytics.liveOrders.new}</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <p className="text-yellow-700 text-sm">Preparing</p>
              <p className="text-2xl font-bold text-yellow-600">{analytics.liveOrders.preparing}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-blue-700 text-sm">Ready</p>
              <p className="text-2xl font-bold text-blue-600">{analytics.liveOrders.ready}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Trend Chart */}
      {analytics.dailySales.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-bold mb-4">Sales Trend (7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'revenue') return [formatPrice(Number(value)), 'Revenue'];
                  return [value, 'Orders'];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#FF6B35"
                name="Revenue (RWF)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ordersCount"
                stroke="#004E89"
                name="Orders"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Peak Hours Chart */}
      {analytics.peakHours.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-bold mb-4">Peak Hours (Today)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 12 }}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis />
              <Tooltip
                formatter={(value) => [value, 'Orders']}
                labelFormatter={(label) => `${label}:00`}
              />
              <Bar dataKey="orders" fill="#004E89" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Selling Items */}
      {analytics.topItems.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-bold mb-4">Top Selling Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Item</th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">Qty</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topItems.map((item, index) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-gray-900 font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-700 font-semibold">{item.quantitySold}</td>
                      <td className="py-3 px-3 text-right text-green-600 font-bold">
                        {formatPrice(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pie Chart */}
            {analytics.topItems.length > 0 && (
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.topItems}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ payload }: any) => `${payload?.quantitySold || 0}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="quantitySold"
                    >
                      {analytics.topItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
