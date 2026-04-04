'use client';

import React, { useState } from 'react';
import { Order, OrderStatus } from '@/types';
import { OrderCard } from './OrderCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/common/Tabs';

interface OrderManagementProps {
  orders: Order[];
  onConfirmPayment?: (orderId: string) => void;
  onConfirmCashPayment?: (orderId: string) => void;
  onRejectOrder?: (orderId: string) => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
  isLoading?: boolean;
}

const statusTabs: { label: string; value: OrderStatus }[] = [
  { label: 'All', value: 'CREATED' },
  { label: 'Pending', value: 'PENDING_PAYMENT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Preparing', value: 'PREPARING' },
  { label: 'Ready', value: 'READY' },
];

export const OrderManagement: React.FC<OrderManagementProps> = ({
  orders,
  onConfirmPayment,
  onConfirmCashPayment,
  onRejectOrder,
  onUpdateStatus,
  isLoading,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'CREATED'>('PENDING_PAYMENT');

  const filteredOrders =
    selectedStatus === 'CREATED'
      ? orders
      : orders.filter((order) => order.status && order.status === selectedStatus);

  const tableOrders = orders.filter((o) => o.table_number);
  const counterOrders = orders.filter((o) => !o.table_number);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600 text-lg">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Order Type Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-2 border-purple-300">
          <p className="text-purple-700 text-sm font-semibold">🍽️ TABLE ORDERS</p>
          <p className="text-3xl font-bold text-purple-900 mt-1">{tableOrders.length}</p>
          <p className="text-xs text-purple-600 mt-2">Orders from QR codes attached to tables</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-300">
          <p className="text-blue-700 text-sm font-semibold">🛒 COUNTER/DIRECT ORDERS</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{counterOrders.length}</p>
          <p className="text-xs text-blue-600 mt-2">Orders from main menu (no specific table)</p>
        </div>
      </div>

      {/* Order Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">Pending Payment</p>
          <p className="text-3xl font-bold text-gray-900">
            {orders.filter((o) => o.status && o.status === 'PENDING_PAYMENT').length}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">Preparing</p>
          <p className="text-3xl font-bold text-gray-900">
            {orders.filter((o) => o.status && o.status === 'PREPARING').length}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Ready</p>
          <p className="text-3xl font-bold text-gray-900">
            {orders.filter((o) => o.status && o.status === 'READY').length}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-3xl font-bold text-gray-900">
            {orders.filter((o) => o.status && o.status === 'COMPLETED').length}
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value as OrderStatus)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                selectedStatus === tab.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Grid */}
        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onConfirmPayment={onConfirmPayment}
                onConfirmCashPayment={onConfirmCashPayment}
                onRejectOrder={onRejectOrder}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No orders found</p>
          </div>
        )}
      </div>
    </div>
  );
};
