'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import apiClient from '@/services/apiClient';
import { Order, OrderStatus } from '@/types';

const STATUS_STEPS = [
  { status: 'CREATED' as OrderStatus, label: 'Order Created', icon: '📦' },
  { status: 'CONFIRMED' as OrderStatus, label: 'Confirmed', icon: '✅' },
  { status: 'PREPARING' as OrderStatus, label: 'Preparing', icon: '👨‍🍳' },
  { status: 'READY' as OrderStatus, label: 'Ready for Pickup', icon: '🎉' },
  { status: 'COMPLETED' as OrderStatus, label: 'Completed', icon: '✔️' },
];

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = (params?.orderId || '') as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { socket, isConnected } = useWebSocket();

  // Fetch initial order data
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        console.log(`📦 Fetching order status for orderId: ${orderId}`);
        const response = await apiClient.get(`/orders/${orderId}`);
        console.log('✅ Order status loaded:', response.data.data);
        setOrder(response.data.data);
        setIsLoading(false);
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
        const status = err.response?.status || 'Unknown';
        console.error(`❌ Failed to fetch order (${status}):`, errorMsg, err);
        setError(`Failed to fetch order: ${errorMsg}`);
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Listen for order updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !orderId) return;

    console.log('🔗 Subscribing to order updates for:', orderId);

    socket.on(`order_updated_${orderId}`, (updatedOrder: Order) => {
      console.log('📨 Order update received:', updatedOrder);
      setOrder(updatedOrder);
    });

    return () => {
      socket.off(`order_updated_${orderId}`);
    };
  }, [socket, isConnected, orderId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium mb-6 text-lg">{error || 'Order not found'}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold"
            >
              ← Try Again / Go Back
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-bold"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEPS.findIndex(
    (step) => step.status === order.status
  );

  const isRejected = order.status === 'REJECTED';
  const isCompleted = order.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header with Order Code */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center">
            <p className="text-orange-100 text-sm font-semibold mb-3">Your Order</p>
            <h1 className="text-5xl font-bold font-mono tracking-wider mb-2">
              {order.order_code}
            </h1>
            <p className="text-orange-100 text-sm font-medium">
              Placed on {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          
          {/* Status Badge */}
          <div className="mt-6 flex justify-center">
            <div
              className={`inline-block px-6 py-3 rounded-full font-bold text-lg shadow-lg ${
                isRejected
                  ? 'bg-red-500 text-white'
                  : isCompleted
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-orange-600'
              }`}
            >
              {isRejected && '❌ Rejected'}
              {!isRejected && !isCompleted && '⏳ In Progress'}
              {isCompleted && '✅ Completed'}
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        {!isRejected && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Progress</h2>
            <div className="space-y-4">
              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= currentStatusIndex;
                const isCurrentStep = index === currentStatusIndex;

                return (
                  <div key={step.status} className="flex items-start">
                    {/* Status Indicator */}
                    <div className="flex flex-col items-center mr-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                          isActive
                            ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                        }`}
                      >
                        {step.icon}
                      </div>
                      {index < STATUS_STEPS.length - 1 && (
                        <div
                          className={`w-1 h-12 my-2 ${
                            isActive ? 'bg-blue-200' : 'bg-gray-200'
                          }`}
                        ></div>
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 pt-2">
                      <p
                        className={`font-medium ${
                          isActive ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrentStep && (
                        <p className="text-sm text-blue-600 mt-1">
                          {isCompleted ? 'Completed' : 'Current step'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>

          {/* Items */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 mb-3">Items</h3>
            <div className="space-y-2">
              {order.items?.map((item, index) => (
                <div key={index} className="flex justify-between text-gray-700">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>₦{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Platform Fee (3%)</span>
              <span>₦{order.platform_fee.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900 text-lg">
              <span>Total</span>
              <span>₦{order.total_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 mb-1">Payment Method</p>
              <p className="font-medium text-gray-900 capitalize">
                {order.payment_method?.replace('_', ' ') || 'Not specified'}
              </p>
            </div>
            <div
              className={`px-4 py-2 rounded-full font-medium text-white ${
                order.payment_status === 'PAID'
                  ? 'bg-green-500'
                  : 'bg-yellow-500'
              }`}
            >
              {order.payment_status === 'PAID'
                ? '✅ Paid'
                : '⏳ Awaiting Payment'}
            </div>
          </div>
        </div>

        {/* WebSocket Connection Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm mb-6">
          <p className="text-blue-900">
            {isConnected
              ? '🟢 Connected - Real-time updates enabled'
              : '🔴 Reconnecting - Checking for updates...'}
          </p>
        </div>

        {/* Customer Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="block w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-center"
          >
            📱 Continue Shopping / Place Another Order
          </button>
          <button
            onClick={() => {
              alert('Thank you for your order! Please come again soon. 🙏');
              window.location.href = '/';
            }}
            className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-bold"
          >
            👋 Exit
          </button>
          <p className="text-xs text-gray-600 text-center mt-4">
            Keep this page open to track your order in real-time. You can continue shopping to place another order.
          </p>
        </div>
      </div>
    </div>
  );
}
