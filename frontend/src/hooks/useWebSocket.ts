import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const newSocket = io(wsUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      extraHeaders: {
        Authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('token')}` : '',
      },
    });

    newSocket.on('connect', () => {
      console.log('🔗 WebSocket connected');
      setIsConnected(true);

      // Subscribe to tenant events if user has tenant_id
      if (user?.tenant_id) {
        console.log(`📢 Subscribing to tenant ${user.tenant_id}`);
        newSocket.emit('subscribe_to_tenant', { tenantId: user.tenant_id });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user?.tenant_id]);

  const emit = useCallback(
    (event: string, data?: any) => {
      if (socket && isConnected) {
        socket.emit(event, data);
      } else {
        console.warn(`Cannot emit ${event}: socket not connected`);
      }
    },
    [socket, isConnected]
  );

  const on = useCallback(
    (event: string, handler: (data: any) => void) => {
      if (socket) {
        socket.on(event, handler);
        return () => {
          socket.off(event, handler);
        };
      }
    },
    [socket]
  );

  const joinOrderTracking = useCallback(
    (orderId: string) => {
      if (socket && isConnected) {
        console.log(`👀 Joining order tracking for ${orderId}`);
        socket.emit('join_order_tracking', { orderId });
      }
    },
    [socket, isConnected]
  );

  return { socket, isConnected, emit, on, joinOrderTracking };
};

