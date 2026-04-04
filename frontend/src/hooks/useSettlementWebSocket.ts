import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SettlementEvent {
  event: 'settlement_initiated' | 'settlement_completed';
  data: {
    payable_id?: string;
    payout_id?: string;
    amount: number;
    payment_method?: string;
    reference?: string;
    destination?: string;
    created_at?: string;
    completed_at?: string;
  };
  timestamp: string;
}

/**
 * useSettlementWebSocket
 * 
 * Custom hook for real-time settlement notifications
 * 
 * Subscribes to WebSocket events:
 * - settlement_initiated: Payment confirmed, merchant payable created
 * - settlement_completed: Payout confirmed to merchant account
 * 
 * Usage:
 * const { isConnected } = useSettlementWebSocket(tenantId, (event) => {
 *   if (event.event === 'settlement_initiated') {
 *     // Refresh settlement summary
 *   }
 * });
 */
export const useSettlementWebSocket = (
  tenantId: string | null,
  onSettlementEvent?: (event: SettlementEvent) => void,
) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const callbackRef = useRef(onSettlementEvent);
  const hasInitializedRef = useRef(false);

  // Keep callback ref in sync with actual callback
  useEffect(() => {
    callbackRef.current = onSettlementEvent;
  }, [onSettlementEvent]);

  // Single socket creation and setup - only runs once per tenantId
  useEffect(() => {
    if (!tenantId || socketRef.current) {
      // Already initialized or no tenantId
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
      console.log('✅ WebSocket connected');
      isConnectedRef.current = true;
      socket.emit('subscribe_to_tenant', { tenantId });
    };

    const handleDisconnect = () => {
      console.log('❌ WebSocket disconnected');
      isConnectedRef.current = false;
    };

    const handleSettlementInitiated = (event: SettlementEvent) => {
      console.log('📊 Settlement initiated:', event);
      callbackRef.current?.(event);
    };

    const handleSettlementCompleted = (event: SettlementEvent) => {
      console.log('✅ Settlement completed:', event);
      callbackRef.current?.(event);
    };

    const handleError = (error: any) => {
      console.error('❌ WebSocket error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('settlement_initiated', handleSettlementInitiated);
    socket.on('settlement_completed', handleSettlementCompleted);
    socket.on('error', handleError);

    socketRef.current = socket;
    hasInitializedRef.current = true;

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('settlement_initiated', handleSettlementInitiated);
      socket.off('settlement_completed', handleSettlementCompleted);
      socket.off('error', handleError);
      socket.disconnect();
      socketRef.current = null;
      hasInitializedRef.current = false;
    };
  }, [tenantId]);

  const isConnected = isConnectedRef.current;

  return { isConnected };
};
