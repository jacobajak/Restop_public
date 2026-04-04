'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, TrendingUp, AlertTriangle, Smartphone, DollarSign } from 'lucide-react';
import { Cart, Order } from '@/types';
import { orderService } from '@/services/orderService';
import { useCart } from '@/context/CartContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import apiClient from '@/services/apiClient';
import { formatPrice } from '@/utils/currency';
import { validateAndNormalizePhone } from '@/utils/phoneValidation';
import Link from 'next/link';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Cart;
  tenantId: string;
  onOrderSuccess?: (orderId: string) => void;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  onClose,
  cart,
  tenantId,
  onOrderSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isFetchingOrder, setIsFetchingOrder] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const { clearCart } = useCart();
  const { socket, isConnected, joinOrderTracking } = useWebSocket();

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MTN' | 'AIRTEL' | null>(null);
  const [mobilePhone, setMobilePhone] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const handleConfirmOrder = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      setPhoneError(null);

      // Validate payment method
      if (!paymentMethod) {
        setError('Please select a payment method');
        setIsSubmitting(false);
        return;
      }

      // If Mobile Money, validate phone number
      let normalizedPhone: string | undefined = undefined;
      if (paymentMethod !== 'CASH') {
        const validation = validateAndNormalizePhone(mobilePhone);
        if (!validation.isValid) {
          setPhoneError(validation.error || 'Invalid phone number');
          setIsSubmitting(false);
          return;
        }
        normalizedPhone = validation.normalized;
      }

      const orderPayload = {
        tenant_id: tenantId,
        items: cart.items.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        })),
        // Include cart totals as fallback for backend calculation
        subtotal: cart.subtotal,
        platform_fee: cart.platform_fee,
        total_amount: cart.total,
        // Include table ID and number if ordering from a table
        table_id: cart.table_id || undefined,
        table_number: cart.table_number || undefined,
        // New: Payment method and phone
        payment_method: paymentMethod,
        customer_phone: normalizedPhone || undefined,
      };

      const response = await orderService.createOrder(orderPayload);
      setOrderId(response.id);
      
      // IMPORTANT: Set order data immediately from response to avoid "Loading..." state
      // This eliminates the need for a separate fetch after order creation
      setOrder(response);
      
      // Join the order tracking room for real-time updates
      joinOrderTracking(response.id);
      
      // Initiate payment if Mobile Money (CASH doesn't need payment initiation)
      if (paymentMethod !== 'CASH') {
        try {
          console.log(`💳 Initiating payment for order: ${response.id}`);
          const paymentResponse = await apiClient.post(`/orders/${response.id}/pay`, {
            phone_number: normalizedPhone,
          });
          console.log('✅ Payment initiated:', paymentResponse.data.data);
          
          // If Paypack returned a payment reference, store it
          if (paymentResponse.data.data.paymentRef) {
            console.log(`📱 Payment reference: ${paymentResponse.data.data.paymentRef}`);
          }
        } catch (paymentError: any) {
          console.error('⚠️ Payment initiation error (order created but payment failed):', paymentError);
          
          // Extract detailed error message from response if available
          const errorMessage = paymentError.response?.data?.message 
            || paymentError.response?.data?.error?.message
            || paymentError.message 
            || 'Unknown error';
          
          const detailedError = paymentError.response?.data?.error ? 
            `${errorMessage} (${paymentError.response.data.error})` : 
            errorMessage;
          
          // Don't throw here - order was created successfully, but payment initiation failed
          // The customer can try again or contact support
          setError(`Payment initiation failed: ${detailedError}. Order was created. Please check your connection and try again.`);
        }
      }
      
      setOrderCreated(true);
      clearCart();
      onOrderSuccess?.(response.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order data is set immediately from creation response, no need to fetch again
  // This eliminates the "Loading..." state that was causing the slow display
  useEffect(() => {
    // If for some reason order is missing (shouldn't happen), fetch it
    if (orderCreated && orderId && !order) {
      const fetchOrder = async () => {
        try {
          setIsFetchingOrder(true);
          console.log(`📦 Fetching order details for orderId: ${orderId}`);
          const response = await apiClient.get(`/orders/${orderId}`);
          console.log('✅ Order fetched successfully:', response.data.data);
          setOrder(response.data.data);
        } catch (err: any) {
          const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
          const status = err.response?.status || 'Unknown';
          console.error(`❌ Failed to fetch order (${status}):`, errorMsg, err);
          setError(`Failed to load order details: ${errorMsg}`);
        } finally {
          setIsFetchingOrder(false);
        }
      };
      fetchOrder();
    }
  }, [orderCreated, orderId, order]);

  // Poll order status as fallback when WebSocket is unavailable
  useEffect(() => {
    if (!orderCreated || !orderId || !order) return;

    // Stop polling if payment is already confirmed or failed
    if (order.payment_status === 'PAID' || order.status !== 'PENDING_PAYMENT') {
      console.log('⏸️ Payment confirmed or order status changed - stopping polling');
      return;
    }

    // Start polling interval
    const pollInterval = setInterval(async () => {
      try {
        console.log(`🔄 Polling order status for: ${orderId}`);
        const response = await apiClient.get(`/orders/${orderId}`);
        const updatedOrder = response.data.data;

        console.log('📊 Poll response:', {
          status: updatedOrder.status,
          payment_status: updatedOrder.payment_status,
        });

        // Update local state with new order data
        setOrder(updatedOrder);

        // Stop polling if payment is confirmed
        if (updatedOrder.payment_status === 'PAID') {
          console.log('✅ Payment confirmed via polling - stopping polling');
        }
      } catch (err) {
        console.error('⚠️ Polling error:', err);
        // Continue polling even if there's an error
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [orderCreated, orderId]);

  // Listen for real-time order updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !orderId) return;

    console.log('🔗 Subscribing to order updates in confirmation modal for:', orderId);

    // Listen for order_updated event with the specific order ID
    const handleOrderUpdate = (updatedOrder: Order) => {
      console.log('📨 Order update received in modal:', updatedOrder);
      setOrder(updatedOrder);
    };

    socket.on(`order_updated_${orderId}`, handleOrderUpdate);

    return () => {
      socket.off(`order_updated_${orderId}`, handleOrderUpdate);
    };
  }, [socket, isConnected, orderId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Confirm Your Order</h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 rounded-lg transition font-semibold"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!orderCreated ? (
            <>
              {/* Order Summary */}
              <div className="mb-6 space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-semibold">
                    {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Platform Fee:</span>
                  <span className="font-semibold">{formatPrice(cart.platform_fee)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(cart.total)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">How would you like to pay?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Cash Option */}
                  <button
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setShowPhoneInput(false);
                      setPhoneError(null);
                    }}
                    className={`p-4 rounded-lg border-2 transition ${
                      paymentMethod === 'CASH'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-green-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign size={24} className={paymentMethod === 'CASH' ? 'text-green-600' : 'text-gray-600'} />
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">💵 Pay in Cash</p>
                        <p className="text-xs text-gray-600">Pay at the counter</p>
                      </div>
                    </div>
                  </button>

                  {/* Mobile Money Option */}
                  <button
                    onClick={() => {
                      setPaymentMethod('MTN');
                      setShowPhoneInput(true);
                      setPhoneError(null);
                    }}
                    className={`p-4 rounded-lg border-2 transition ${
                      paymentMethod === 'MTN'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-orange-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone size={24} className={paymentMethod === 'MTN' ? 'text-orange-600' : 'text-gray-600'} />
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">📱 Mobile Money</p>
                        <p className="text-xs text-gray-600">MTN/Airtel Instant</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Phone Input for Mobile Money */}
              {showPhoneInput && (
                <div className="mb-6 p-4 border-2 border-orange-300 bg-orange-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Enter your phone number
                  </label>
                  <input
                    type="tel"
                    value={mobilePhone}
                    onChange={(e) => {
                      setMobilePhone(e.target.value);
                      setPhoneError(null);
                    }}
                    placeholder="0788123456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Format: 0788123456 or +250788123456
                  </p>
                  {phoneError && (
                    <p className="text-xs text-red-600 mt-2">{phoneError}</p>
                  )}
                </div>
              )}

              {/* Payment Method Instructions */}
              {paymentMethod === 'CASH' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-green-900 font-semibold">Payment Instructions:</p>
                      <p className="text-sm text-green-800 mt-1">
                        You will receive an order ID. Show it to the cashier and provide the total amount {formatPrice(cart.total)}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'MTN' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-orange-900 font-semibold">Mobile Payment Instructions:</p>
                      <p className="text-sm text-orange-800 mt-1">
                        You'll be directed to complete payment securely via MTN. Your order will be confirmed once payment is verified.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 hover:text-gray-900 transition font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOrder}
                  disabled={isSubmitting || !paymentMethod}
                  className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 active:scale-95 transition font-bold disabled:opacity-50 shadow-md"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Success Message */}
              <div className="text-center py-6">
                <div className="flex justify-center mb-4">
                  <div className="bg-green-100 rounded-full p-4">
                    <CheckCircle size={48} className="text-green-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-green-700 mb-4">Order Placed!</h3>
                
                {/* Display payment error if it occurred */}
                {error && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm text-red-700 font-medium">⚠️ Payment Error</p>
                    <p className="text-sm text-red-600 mt-2">{error}</p>
                    <p className="text-xs text-red-500 mt-2">Your order has been created. Please retry payment from the order tracking page.</p>
                  </div>
                )}
                
                {/* Creative Order Code Display */}
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-5 mb-6 border-2 border-orange-300 inline-block mx-auto">
                  <p className="text-sm text-gray-600 font-medium mb-1">Your Order #</p>
                  <p className="text-4xl font-bold text-orange-600 font-mono tracking-wider">{order?.order_code || 'Loading...'}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    {order?.payment_method === 'CASH' 
                      ? 'Show this to the cashier' 
                      : 'Reference Code'}
                  </p>
                </div>

                {/* Order Status */}
                {isFetchingOrder ? (
                  <div className="my-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">Loading order details...</p>
                  </div>
                ) : order ? (
                  <div className="my-6 space-y-4">
                    {/* Order Status Badge */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm font-semibold text-gray-700 mb-3">Order Status</div>
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <div className="text-2xl font-bold text-blue-600 capitalize">
                            {order?.status === 'PENDING_PAYMENT' ? 'Awaiting Payment' :
                             order?.status === 'CONFIRMED' ? 'Payment Confirmed ✓' :
                             order?.status === 'PREPARING' ? 'Being Prepared' :
                             order?.status === 'READY' ? 'Ready for Pickup' :
                             order?.status === 'COMPLETED' ? 'Completed' :
                             order?.status === 'REJECTED' ? 'Rejected' :
                             order?.status || 'Pending'}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Current Status</p>
                        </div>
                        <div className="text-3xl">
                          {order?.status === 'PENDING_PAYMENT' ? '💳' :
                           order?.status === 'CONFIRMED' ? '✅' :
                           order?.status === 'PREPARING' ? '👨‍🍳' :
                           order?.status === 'READY' ? '🎉' :
                           order?.status === 'COMPLETED' ? '✔️' :
                           order?.status === 'REJECTED' ? '❌' :
                           '📦'}
                        </div>
                      </div>
                    </div>

                    {/* Payment Confirmed Celebration - Show when status changes from PENDING_PAYMENT */}
                    {order?.status && order.status !== 'PENDING_PAYMENT' && (
                      <div className="p-4 bg-green-50 rounded-lg border-2 border-green-400 animate-pulse">
                        <div className="flex items-center gap-3">
                          <CheckCircle size={24} className="text-green-600" />
                          <div>
                            <div className="text-lg font-bold text-green-700">Payment Confirmed!</div>
                            <div className="text-sm text-green-600">Restaurant is processing your order</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Method & Status */}
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="text-sm font-semibold text-gray-700 mb-3">Payment Method & Status</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {order?.payment_method === 'CASH' ? (
                            <>
                              <DollarSign size={20} className="text-green-600" />
                              <span className="font-semibold text-gray-900">Cash Payment</span>
                            </>
                          ) : (
                            <>
                              <Smartphone size={20} className="text-orange-600" />
                              <span className="font-semibold text-gray-900">Mobile Money ({order?.payment_method})</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {order?.payment_status === 'PAID' ? (
                            <>
                              <CheckCircle size={20} className="text-green-600" />
                              <span className="text-green-700 font-semibold">Payment Verified</span>
                            </>
                          ) : order?.payment_status === 'PENDING' ? (
                            <>
                              <Clock size={20} className="text-amber-600" />
                              <span className="text-amber-700 font-semibold">Awaiting Verification</span>
                            </>
                          ) : (
                            <>
                              <Clock size={20} className="text-blue-600" />
                              <span className="text-blue-700 font-semibold">Payment Processing</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment Instructions */}
                    {order?.payment_method === 'CASH' && order?.payment_status === 'PENDING' && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-semibold text-green-900 mb-2">📋 What to do next:</p>
                        <p className="text-sm text-green-800">
                          Show your order ID (ORD-{order?.order_code}) to the cashier and pay {formatPrice(order?.total_amount || 0)}. 
                          The restaurant will confirm your payment and start preparing your order.
                        </p>
                      </div>
                    )}

                    {order?.payment_method !== 'CASH' && order?.payment_status === 'PENDING' && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm font-semibold text-orange-900 mb-2">📱 Mobile Money Payment:</p>
                        <p className="text-sm text-orange-800">
                          You should have received a payment prompt on your {order?.payment_method} account. 
                          Complete the payment to finalize your order.
                        </p>
                      </div>
                    )}

                    {/* Total */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-semibold">Total Amount:</span>
                        <span className="text-2xl font-bold text-orange-600">
                          {formatPrice(order?.total_amount || cart.total || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Next Steps */}
                    <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                      <div className="text-sm font-semibold text-teal-900 mb-2 flex items-center gap-2">
                        <TrendingUp size={16} />
                        Next Steps
                      </div>
                      <ul className="text-sm text-teal-900 space-y-1">
                        {order?.payment_method === 'CASH' && (
                          <>
                            <li>• Show order ID to the cashier</li>
                            <li>• Pay {formatPrice(order?.total_amount || 0)} in cash</li>
                            <li>• Wait for restaurant to confirm payment</li>
                          </>
                        )}
                        {order?.payment_method !== 'CASH' && (
                          <>
                            <li>• Complete payment on your {order?.payment_method} account</li>
                            <li>• Restaurant will confirm once payment received</li>
                            <li>• Order will move to preparation</li>
                          </>
                        )}
                        {order?.status === 'CONFIRMED' && (
                          <li>• Restaurant is preparing your order</li>
                        )}
                        {order?.status === 'PREPARING' && (
                          <li>• Your order is being prepared</li>
                        )}
                        {order?.status === 'READY' && (
                          <li>• Your order is ready for pickup!</li>
                        )}
                        {(order?.status === 'COMPLETED' || order?.status === 'READY') && (
                          <li>• Track your order status via the link below</li>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <p className="text-sm text-gray-500 mb-6">
                  {order?.payment_status === 'PENDING' 
                    ? 'Please wait for the restaurant to verify your payment.'
                    : 'Your order status will update as the restaurant processes your order.'}
                </p>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {orderId && (
                    <Link href={`/order-status/${orderId}`}>
                      <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition font-bold shadow-md">
                        📊 Track Your Order
                      </button>
                    </Link>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 active:scale-95 transition font-bold shadow-md"
                  >
                    🛒 Continue Shopping
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
