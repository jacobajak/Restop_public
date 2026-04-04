'use client';

import React from 'react';
import { Order, OrderStatus } from '@/types';
import { Clock, CheckCircle, AlertCircle, Printer } from 'lucide-react';
import { formatPrice } from '@/utils/currency';

interface OrderCardProps {
  order: Order;
  onConfirmPayment?: (orderId: string) => void;
  onConfirmCashPayment?: (orderId: string) => void;
  onRejectOrder?: (orderId: string) => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onConfirmPayment,
  onConfirmCashPayment,
  onRejectOrder,
  onUpdateStatus,
}) => {
  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      CREATED: 'bg-gray-100 text-gray-800',
      PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PREPARING: 'bg-purple-100 text-purple-800',
      READY: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status];
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'READY':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'PREPARING':
        return <Clock className="text-purple-600" size={20} />;
      case 'PENDING_PAYMENT':
        return <AlertCircle className="text-yellow-600" size={20} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border-l-4 border-transparent" style={{
      borderLeftColor: order.table_number ? '#8b5cf6' : '#3b82f6'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {/* Order Code - Short and Creative */}
            <div className="bg-gradient-to-r from-orange-100 to-orange-50 rounded-lg px-4 py-2 border border-orange-300">
              <span className="text-lg font-bold text-orange-600 font-mono">{order.order_code}</span>
            </div>
            {/* Table/Direct Order Badge */}
            {order.table_number ? (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full whitespace-nowrap">
                🍽️ Table {order.table_number}
              </span>
            ) : (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full whitespace-nowrap">
                🛒 Counter Order
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex-shrink-0">
          {order.status && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              <span>{order.status.replace('_', ' ')}</span>
            </div>
          )}
          {!order.status && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold bg-gray-100 text-gray-800">
              <span>Unknown Status</span>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mb-4 pb-4 border-b">
        <p className="text-sm font-semibold text-gray-600 mb-2">Items:</p>
        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.id} className="text-sm text-gray-700">
              {item.name} × {item.quantity} - {formatPrice(item.subtotal)}
            </li>
          ))}
        </ul>
      </div>

      {/* Total */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium">{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Platform Fee:</span>
          <span className="font-medium">{formatPrice(order.platform_fee)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="font-bold">Total:</span>
          <span className="text-lg font-bold text-primary">{formatPrice(order.total_amount)}</span>
        </div>
      </div>

      {/* Actions */}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="space-y-3">
          {/* Payment Method Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">
              💳 Payment: {order.payment_method === 'CASH' ? '💵 Cash' : `📱 ${order.payment_method}`}
            </span>
            {order.payment_status !== 'PENDING' && (
              <span className="ml-auto text-sm font-semibold text-green-600">
                ✓ {order.payment_status}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {/* For Cash Orders - Show specific cash confirmation button */}
            {order.payment_method === 'CASH' ? (
              <>
                <button
                  onClick={() => onConfirmCashPayment?.(order.id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  ✓ Confirm Cash Received
                </button>
                <button
                  onClick={() => onRejectOrder?.(order.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Reject
                </button>
              </>
            ) : (
              <>
                {/* For Mobile Money Orders - Show regular confirm (auto-confirmed via webhook) */}
                <button
                  onClick={() => onConfirmPayment?.(order.id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Confirm Payment
                </button>
                <button
                  onClick={() => onRejectOrder?.(order.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {order.status === 'CONFIRMED' && (
        <div className="flex gap-3">
          <button
            onClick={() => onUpdateStatus?.(order.id, 'PREPARING')}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
          >
            Mark Preparing
          </button>
          <button className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium flex items-center justify-center gap-2">
            <Printer size={18} />
            Print
          </button>
        </div>
      )}

      {order.status === 'PREPARING' && (
        <button
          onClick={() => onUpdateStatus?.(order.id, 'READY')}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-lg"
        >
          Mark Ready
        </button>
      )}

      {order.status === 'READY' && (
        <button
          onClick={() => onUpdateStatus?.(order.id, 'COMPLETED')}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-lg"
        >
          Order Picked Up / Completed
        </button>
      )}
    </div>
  );
};
