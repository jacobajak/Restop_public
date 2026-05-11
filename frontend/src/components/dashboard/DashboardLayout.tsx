'use client';

import React, { useState, useMemo } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();
  const { hasPageAccess, userRole } = useRoleAccess();
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Redirect to login page after logout
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect to login even if logout fails
      router.push('/auth/login');
    }
  };

  const allNavigation = [
    { name: 'Orders', href: '/dashboard/orders', pageKey: 'orders' },
    { name: 'Menu', href: '/dashboard/menu', pageKey: 'menu' },
    { name: 'Tables', href: '/dashboard/tables', pageKey: 'tables' },
    { name: 'Analytics', href: '/dashboard/analytics', pageKey: 'analytics' },
    { name: 'Payments', href: '/dashboard/payments', pageKey: 'payments' },
    { name: 'Reports', href: '/dashboard/reports', pageKey: 'reports' },
    { name: 'QR Code', href: '/dashboard/qrcode', pageKey: 'qrcode' },
    { name: 'Support', href: '/dashboard/support', pageKey: 'support' },
    { name: 'Settings', href: '/dashboard/settings', pageKey: 'settings' },
  ];

  // Filter navigation based on user's role and page access
  const navigation = useMemo(() => {
    return allNavigation.filter(item => hasPageAccess(item.pageKey));
  }, [userRole]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white shadow-xl transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'hidden'}`}>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
              R
            </div>
            <span className="font-bold text-lg">RESTOP</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition group"
            >
              <div className="w-5 h-5 bg-gray-700 group-hover:bg-blue-500 rounded" />
              {sidebarOpen && (
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-medium text-sm">{item.name}</span>
                  {item.pageKey && userRole && !hasPageAccess(item.pageKey) && (
                    <span className="text-xs opacity-50">🔒</span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* Role Badge */}
        {sidebarOpen && (
          <div className="border-t border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-2">ROLE</div>
            <div className="text-xs font-semibold text-blue-300 px-2 py-1 bg-blue-900/30 rounded">
              {userRole?.replace('TENANT_', '')}
            </div>
          </div>
        )}

        {/* User Section */}
        <div className="border-t border-gray-800 p-4 space-y-4">
          {sidebarOpen && (
            <div className="px-2">
              <p className="text-xs text-gray-500">RESTAURANT OWNER</p>
              <p className="font-semibold text-white truncate">{user?.name}</p>
              <p className="text-gray-400 text-xs truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm px-8 py-6 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">Restaurant Dashboard</h1>
        </header>

        {/* Content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
