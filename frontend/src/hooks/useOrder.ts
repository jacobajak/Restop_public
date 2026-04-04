import { useState, useEffect } from 'react';
import { Order, OrderStatus } from '@/types';
import { orderService } from '@/services/orderService';

export const useOrder = (orderId: string) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await orderService.getOrder(orderId);
        setOrder(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch order');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const updateStatus = async (status: OrderStatus) => {
    try {
      const updated = await orderService.updateOrderStatus(orderId, status);
      setOrder(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
      throw err;
    }
  };

  const confirmPayment = async () => {
    try {
      const updated = await orderService.confirmPayment(orderId);
      setOrder(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm payment');
      throw err;
    }
  };

  const rejectOrder = async (reason?: string) => {
    try {
      const updated = await orderService.rejectOrder(orderId, reason);
      setOrder(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject order');
      throw err;
    }
  };

  return { order, loading, error, updateStatus, confirmPayment, rejectOrder };
};
