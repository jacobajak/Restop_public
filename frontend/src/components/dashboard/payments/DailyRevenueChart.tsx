'use client';

import React, { useState, useEffect } from 'react';
import { Card, Loading } from '@/components/common';
import { settlementService, DailySummary } from '@/services/settlementService';

export const DailyRevenueChart: React.FC = () => {
  const [dailyData, setDailyData] = useState<DailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const loadDailyData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await settlementService.getDailySummary(days);
        setDailyData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadDailyData();
  }, [days]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-RW', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading && dailyData.length === 0) {
    return <Loading />;
  }

  // Calculate statistics
  const totalRevenue = dailyData.reduce((sum, d) => sum + (d.cash_revenue + d.mobile_money_revenue), 0);
  const totalOrders = dailyData.reduce((sum, d) => sum + d.total_orders, 0);
  const totalFees = dailyData.reduce((sum, d) => sum + d.total_fees, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Find max revenue for scaling the chart
  const maxRevenue = Math.max(...dailyData.map(d => d.cash_revenue + d.mobile_money_revenue), 1);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
            Total Revenue
          </p>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
            {formatCurrency(totalRevenue)}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
            Last {days} days
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
            Total Orders
          </p>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
            {totalOrders}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
            {(totalOrders / days).toFixed(1)} per day
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
            Average Order Value
          </p>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
            {formatCurrency(averageOrderValue)}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
            Per transaction
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
            Total Platform Fees
          </p>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
            {formatCurrency(totalFees)}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
            Deducted from revenue
          </p>
        </Card>
      </div>

      {/* Chart Controls */}
      <Card className="p-4">
        <div className="flex gap-2">
          {[7, 14, 30, 60].map((dayRange) => (
            <button
              key={dayRange}
              onClick={() => setDays(dayRange)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                days === dayRange
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-100 dark:bg-dark-surface text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-dark-border'
              }`}
            >
              {dayRange}d
            </button>
          ))}
        </div>
      </Card>

      {/* Daily Revenue Chart */}
      <Card className="p-6">
        {error ? (
          <div className="text-center text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        ) : dailyData.length === 0 ? (
          <div className="text-center text-neutral-500 dark:text-neutral-400">
            📭 No data available
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text">
              Daily Revenue Breakdown
            </h3>

            <div className="overflow-x-auto">
              <div className="min-w-full space-y-3">
                {dailyData.map((day) => {
                  const totalDaily = day.cash_revenue + day.mobile_money_revenue;
                  const barWidth = (totalDaily / maxRevenue) * 100;
                  const cashPercent = day.cash_revenue > 0 ? (day.cash_revenue / totalDaily) * 100 : 0;

                  return (
                    <div key={day.date}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-neutral-900 dark:text-dark-text">
                          {formatDate(day.date)}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
                            {formatCurrency(totalDaily)}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-500 ml-2">
                            {day.total_orders} orders
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-neutral-200 dark:bg-dark-surface rounded-full overflow-hidden h-8">
                        <div
                          className="h-full flex rounded-full overflow-hidden transition-all duration-300"
                          style={{ width: `${Math.max(barWidth, 5)}%` }}
                        >
                          {/* Cash portion (blue) */}
                          <div
                            className="bg-blue-500"
                            style={{ width: `${cashPercent}%` }}
                            title={`Cash: ${formatCurrency(day.cash_revenue)}`}
                          />
                          {/* Mobile money portion (green) */}
                          <div
                            className="bg-green-500"
                            style={{ width: `${100 - cashPercent}%` }}
                            title={`Mobile Money: ${formatCurrency(day.mobile_money_revenue)}`}
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 text-xs mt-1">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          💵 {formatCurrency(day.cash_revenue)}
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          📱 {formatCurrency(day.mobile_money_revenue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-6 justify-center mt-6 pt-4 border-t border-neutral-200 dark:border-dark-border">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">Cash Payments</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">Mobile Money</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
