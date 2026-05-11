'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    completed_orders: 0,
  });

  console.log('[Dashboard] Current state:', { isLoading, isAuthenticated, user: user?.name });

  useEffect(() => {
    console.log('[Dashboard] Auth state changed:', { isLoading, isAuthenticated, hasUser: !!user, role: user?.role });
    
    // Only check auth after component mounts to avoid hydration issues
    if (!isLoading) {
      if (!isAuthenticated) {
        console.log('[Dashboard] Not authenticated, redirecting to login');
        // Use window.location for a hard redirect instead of router.push
        window.location.href = '/auth/login';
      } else if (user?.role === 'PLATFORM_ADMIN') {
        console.log('[Dashboard] Platform admin detected, redirecting to admin dashboard');
        router.push('/admin/overview');
      } else {
        console.log('[Dashboard] Authenticated, rendering dashboard for:', user?.name);
      }
    }
  }, [isLoading, isAuthenticated, router, user?.name, user?.role]);

  // Show loading spinner while checking auth
  if (isLoading) {
    console.log('[Dashboard] Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-50">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-500 mx-auto"></div>
          <p className="mt-6 text-gray-700 text-lg font-semibold">⏳ Loading dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we prepare your dashboard</p>
        </div>
      </div>
    );
  }

  // Show error if redirecting
  if (!isAuthenticated) {
    console.log('[Dashboard] Not authenticated, redirecting now');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-4xl mb-4">🔑</div>
          <p className="text-gray-700 text-lg font-semibold">Redirecting to login...</p>
          <p className="text-sm text-gray-500 mt-2">Preparing to sign you in</p>
        </div>
      </div>
    );
  }

  console.log('[Dashboard] Rendering dashboard content for:', user?.name);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome back, {user?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total_orders}</p>
              </div>
              <div className="text-4xl text-blue-500 opacity-20">📦</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Pending Orders</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{stats.pending_orders}</p>
              </div>
              <div className="text-4xl text-orange-500 opacity-20">⏳</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Completed Orders</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.completed_orders}</p>
              </div>
              <div className="text-4xl text-green-500 opacity-20">✅</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            <Link
              href="/dashboard/menu"
              className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-500 hover:shadow-md transition-all text-center"
            >
              <div className="text-3xl mb-2">🍕</div>
              <p className="font-medium text-gray-900">Menu Management</p>
              <p className="text-sm text-gray-600">Add or edit items</p>
            </Link>

            <Link
              href="/dashboard/orders"
              className="block p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 hover:border-orange-500 hover:shadow-md transition-all text-center"
            >
              <div className="text-3xl mb-2">📋</div>
              <p className="font-medium text-gray-900">View Orders</p>
              <p className="text-sm text-gray-600">Manage incoming orders</p>
            </Link>

            <Link
              href="/dashboard/qrcode"
              className="block p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-500 hover:shadow-md transition-all text-center"
            >
              <div className="text-3xl mb-2">📱</div>
              <p className="font-medium text-gray-900">QR Code</p>
              <p className="text-sm text-gray-600">View menu QR code</p>
            </Link>

            <Link
              href="/dashboard/analytics"
              className="block p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-500 hover:shadow-md transition-all text-center"
            >
              <div className="text-3xl mb-2">📊</div>
              <p className="font-medium text-gray-900">Analytics</p>
              <p className="text-sm text-gray-600">View statistics</p>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
          </div>
          <div className="p-6">
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-3 flex-shrink-0">
                  1
                </span>
                <div>
                  <p className="font-medium text-gray-900">Add Menu Items</p>
                  <p className="text-sm text-gray-600">Go to Menu Management to add restaurants items with prices</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-3 flex-shrink-0">
                  2
                </span>
                <div>
                  <p className="font-medium text-gray-900">Share Your QR Code</p>
                  <p className="text-sm text-gray-600">Display your QR code so customers can order from your menu</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-3 flex-shrink-0">
                  3
                </span>
                <div>
                  <p className="font-medium text-gray-900">Receive & Manage Orders</p>
                  <p className="text-sm text-gray-600">View incoming orders and update their status in real-time</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-3 flex-shrink-0">
                  4
                </span>
                <div>
                  <p className="font-medium text-gray-900">Track Analytics</p>
                  <p className="text-sm text-gray-600">Monitor your sales, orders, and business metrics</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
