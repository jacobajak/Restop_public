import apiClient from './apiClient';
import { Order, OrderStatus } from '@/types';

export interface CreateOrderRequest {
  tenant_id: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
  }>;
}

export const orderService = {
  createOrder: async (payload: CreateOrderRequest): Promise<Order> => {
    const response = await apiClient.post('/orders', payload);
    return response.data.data;
  },

  getOrders: async (status?: OrderStatus, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await apiClient.get(`/orders?${params.toString()}`);
    return response.data.data;
  },

  getOrder: async (id: string): Promise<Order> => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data.data;
  },

  confirmPayment: async (id: string): Promise<Order> => {
    const response = await apiClient.patch(`/orders/${id}/confirm`);
    return response.data.data;
  },

  rejectOrder: async (id: string, reason?: string): Promise<Order> => {
    const response = await apiClient.patch(`/orders/${id}/reject`, { reason });
    return response.data.data;
  },

  updateOrderStatus: async (id: string, status: OrderStatus): Promise<Order> => {
    const response = await apiClient.patch(`/orders/${id}/status`, { status });
    return response.data.data;
  },
};
