'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { OrderManagement } from '@/components/dashboard/OrderManagement';
import { Order, OrderStatus } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import apiClient from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/common';

export default function OrdersPage() {
  const { user } = useAuth();
  const { hasPageAccess } = useRoleAccess();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { socket, isConnected } = useWebSocket();

  // Load orders from API
  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.tenant_id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const response = await apiClient.get('/orders');
        console.log('📦 Fetched orders response:', response.data);
        console.log('📦 Orders data:', response.data.data);
        if (response.data.data && Array.isArray(response.data.data)) {
          console.log('📦 First order structure:', response.data.data[0]);
        }
        setOrders(response.data.data || []);
      } catch (err) {
        console.error('Failed to load orders:', err);
        setError('Failed to load orders');
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.tenant_id) {
      loadOrders();
    }
  }, [user?.tenant_id]);

  // Listen for real-time order updates
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('order_created', (newOrder: Order) => {
        console.log('New order received via WebSocket:', newOrder);
        setOrders((prev) => [newOrder, ...prev]);
      });

      socket.on('order_updated', (updatedOrder: Order) => {
        console.log('Order updated via WebSocket:', updatedOrder);
        setOrders((prev) =>
          prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
        );
      });

      return () => {
        socket.off('order_created');
        socket.off('order_updated');
      };
    }
  }, [socket, isConnected]);

  // Check access - after hooks
  if (!hasPageAccess('orders')) {
    return (
      <DashboardLayout>
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            You don't have permission to view this page.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  const handleConfirmPayment = async (orderId: string) => {
    try {
      const response = await apiClient.patch(`/orders/${orderId}/confirm`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? response.data.data : o))
      );
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      setError('Failed to confirm payment');
    }
  };

  const handleConfirmCashPayment = async (orderId: string) => {
    try {
      console.log(`💵 Confirming cash payment for order: ${orderId}`);
      const response = await apiClient.patch(`/orders/${orderId}/confirm-cash`);
      console.log('✅ Cash payment confirmed:', response.data.data);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? response.data.data : o))
      );
      // Clear error if previously set
      setError('');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to confirm cash payment';
      console.error('❌ Failed to confirm cash payment:', errorMsg);
      setError(errorMsg);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const response = await apiClient.patch(`/orders/${orderId}/status`, {
        status: newStatus,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? response.data.data : o))
      );
    } catch (error) {
      console.error('Failed to update order status:', error);
      setError('Failed to update order status');
    }
  };

  const handleRejectOrder = async (orderId: string, reason?: string) => {
    try {
      const response = await apiClient.patch(`/orders/${orderId}/reject`, {
        reason,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? response.data.data : o))
      );
    } catch (error) {
      console.error('Failed to reject order:', error);
      setError('Failed to reject order');
    }
  };

  return (
    <DashboardLayout>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      <OrderManagement
        orders={orders}
        isLoading={isLoading}
        onConfirmPayment={handleConfirmPayment}
        onConfirmCashPayment={handleConfirmCashPayment}
        onRejectOrder={handleRejectOrder}
        onUpdateStatus={handleUpdateStatus}
      />
    </DashboardLayout>
  );
}
