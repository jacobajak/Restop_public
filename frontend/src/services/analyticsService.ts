import apiClient from './apiClient';

export interface RevenueAnalytics {
  today: number;
  week: number;
  month: number;
  commissionToday: number;
  averageOrderValue: number;
  ordersToday: number;
}

export interface OrderAnalytics {
  today: number;
  week: number;
  completed: number;
  confirmed: number;
  preparing: number;
  ready: number;
  pending: number;
  rejected: number;
}

export interface PeakHour {
  hour: number;
  orders: number;
  revenue: number;
}

export interface TopItem {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface LiveOrders {
  new: number;
  confirmed: number;
  preparing: number;
  ready: number;
  completed: number;
}

export interface DailySale {
  date: string;
  ordersCount: number;
  revenue: number;
}

export interface DashboardAnalytics {
  revenue: RevenueAnalytics;
  orders: OrderAnalytics;
  topItems: TopItem[];
  peakHours: PeakHour[];
  liveOrders: LiveOrders;
  dailySales: DailySale[];
}

export const analyticsService = {
  getDashboardAnalytics: async (): Promise<DashboardAnalytics> => {
    const response = await apiClient.get('/analytics/dashboard');
    return response.data.data;
  },

  getRevenueAnalytics: async (): Promise<RevenueAnalytics> => {
    const response = await apiClient.get('/analytics/revenue');
    return response.data.data;
  },

  getOrderAnalytics: async (): Promise<OrderAnalytics> => {
    const response = await apiClient.get('/analytics/orders');
    return response.data.data;
  },

  getPeakHours: async (): Promise<PeakHour[]> => {
    const response = await apiClient.get('/analytics/peak-hours');
    return response.data.data;
  },

  getTopItems: async (): Promise<TopItem[]> => {
    const response = await apiClient.get('/analytics/top-items');
    return response.data.data;
  },

  getLiveOrders: async (): Promise<LiveOrders> => {
    const response = await apiClient.get('/analytics/live-orders');
    return response.data.data;
  },

  getDailySales: async (): Promise<DailySale[]> => {
    const response = await apiClient.get('/analytics/daily-sales');
    return response.data.data;
  },
};
