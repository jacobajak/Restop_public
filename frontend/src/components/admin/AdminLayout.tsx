'use client';

import React, { useState } from 'react';
import { LogOut, Menu, X, BarChart3, Building2, ShoppingCart, CreditCard, DollarSign, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const router = useRouter();

  const adminNavigation = [
    { name: 'Overview', href: '/admin/overview', icon: '📊' },
    { name: 'System Health', href: '/admin/health', icon: '❤️' },
    // TODO: Fraud Detection disabled for MVP, enable in advanced phase
    { name: 'Restaurants', href: '/admin/restaurants', icon: '🏪' },
    { name: 'Orders', href: '/admin/orders', icon: '📦' },
    { name: 'Payments', href: '/admin/payments', icon: '💳' },
    { name: 'Settlements', href: '/admin/settlements', icon: '💰' },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white shadow-xl transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'hidden'}`}>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <span className="font-bold text-lg">Admin</span>
              <p className="text-xs text-gray-400">Platform Control</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Admin Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {adminNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition group"
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="font-medium text-sm">{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* Admin User Section */}
        <div className="border-t border-gray-800 p-4 space-y-4">
          {sidebarOpen && (
            <div className="px-2 text-xs">
              <p className="text-gray-500 mb-1">ADMIN USER</p>
              <p className="font-semibold text-white truncate">{user?.name}</p>
              <p className="text-gray-400 text-xs truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Admin Header */}
        <header className="bg-white shadow-sm px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Platform operations and management</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">PLATFORM_ADMIN</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
};
