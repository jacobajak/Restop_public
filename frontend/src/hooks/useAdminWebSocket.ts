import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AdminEvent {
  event: 
    | 'admin/order.updated'
    | 'admin/payment.updated'
    | 'admin/settlement.updated'
    | 'admin/restaurant.updated'
    | 'admin/support.created'
    | 'admin/metrics.updated';
  data: any;
  changedBy?: string;
  action?: string;
  timestamp: string;
}

/**
 * useAdminWebSocket
 *
 * Custom hook for real-time admin event notifications
 *
 * Subscribes to WebSocket events:
 * - admin/order.updated: Order status changed
 * - admin/payment.updated: Payment status changed
 * - admin/settlement.updated: Settlement status changed
 * - admin/restaurant.updated: Restaurant suspended/activated
 * - admin/support.created: New support issue
 * - admin/metrics.updated: Dashboard metrics changed
 *
 * Usage:
 * const { isConnected } = useAdminWebSocket((event) => {
 *   if (event.event === 'admin/order.updated') {
 *     // Refresh orders list
 *   }
 * });
 */
export const useAdminWebSocket = (
  adminId: string | null,
  onAdminEvent?: (event: AdminEvent) => void,
) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const callbackRef = useRef(onAdminEvent);
  const hasInitializedRef = useRef(false);

  // Keep callback ref in sync with actual callback
  useEffect(() => {
    callbackRef.current = onAdminEvent;
  }, [onAdminEvent]);

  // Single socket creation and setup - only runs once per adminId
  useEffect(() => {
    if (!adminId || socketRef.current) {
      // Already initialized or no adminId
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

    const socket = io(wsUrl, {
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    // Set up event handlers
    const handleConnect = () => {
      console.log('✅ Admin WebSocket connected');
      isConnectedRef.current = true;
      socket.emit('subscribe_to_admin', { adminId });
    };

    const handleDisconnect = () => {
      console.log('❌ Admin WebSocket disconnected');
      isConnectedRef.current = false;
    };

    const handleOrderUpdate = (event: AdminEvent) => {
      console.log('📋 Order updated:', event);
      callbackRef.current?.(event);
    };

    const handlePaymentUpdate = (event: AdminEvent) => {
      console.log('💳 Payment updated:', event);
      callbackRef.current?.(event);
    };

    const handleSettlementUpdate = (event: AdminEvent) => {
      console.log('💰 Settlement updated:', event);
      callbackRef.current?.(event);
    };

    const handleRestaurantUpdate = (event: AdminEvent) => {
      console.log('🏪 Restaurant updated:', event);
      callbackRef.current?.(event);
    };

    const handleSupportCreated = (event: AdminEvent) => {
      console.log('🆘 Support issue created:', event);
      callbackRef.current?.(event);
    };

    const handleMetricsUpdated = (event: AdminEvent) => {
      console.log('📊 Metrics updated:', event);
      callbackRef.current?.(event);
    };

    const handleError = (error: any) => {
      console.error('❌ Admin WebSocket error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('admin/order.updated', handleOrderUpdate);
    socket.on('admin/payment.updated', handlePaymentUpdate);
    socket.on('admin/settlement.updated', handleSettlementUpdate);
    socket.on('admin/restaurant.updated', handleRestaurantUpdate);
    socket.on('admin/support.created', handleSupportCreated);
    socket.on('admin/metrics.updated', handleMetricsUpdated);
    socket.on('error', handleError);

    socketRef.current = socket;
    hasInitializedRef.current = true;

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('admin/order.updated', handleOrderUpdate);
      socket.off('admin/payment.updated', handlePaymentUpdate);
      socket.off('admin/settlement.updated', handleSettlementUpdate);
      socket.off('admin/restaurant.updated', handleRestaurantUpdate);
      socket.off('admin/support.created', handleSupportCreated);
      socket.off('admin/metrics.updated', handleMetricsUpdated);
      socket.off('error', handleError);
      socket.disconnect();
      socketRef.current = null;
      hasInitializedRef.current = false;
    };
  }, [adminId]);

  return {
    isConnected: isConnectedRef.current,
  };
};
