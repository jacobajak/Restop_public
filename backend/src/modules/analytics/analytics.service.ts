import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(tenantId: string) {
    const [revenue, orders, topItems, peakHours, liveOrders, dailySales] = await Promise.all([
      this.getRevenueAnalytics(tenantId),
      this.getOrderAnalytics(tenantId),
      this.getTopSellingItems(tenantId, 5),
      this.getPeakHoursAnalytics(tenantId),
      this.getLiveOrderStatus(tenantId),
      this.getDailySalesAnalytics(tenantId),
    ]);

    return {
      revenue,
      orders,
      topItems,
      peakHours,
      liveOrders,
      dailySales,
    };
  }

  /**
   * Get revenue analytics for today, week, month
   */
  async getRevenueAnalytics(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);

    const monthStart = new Date(today);
    monthStart.setDate(1);

    // Revenue today
    const todayRevenue = await this.orderRepository
      .createQueryBuilder('orders')
      .select('SUM(orders.total_amount)', 'total')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.status = :status', { status: 'COMPLETED' })
      .andWhere('DATE(orders.created_at) = DATE(:today)', { today })
      .getRawOne();

    // Revenue this week
    const weekRevenue = await this.orderRepository
      .createQueryBuilder('orders')
      .select('SUM(orders.total_amount)', 'total')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.status = :status', { status: 'COMPLETED' })
      .andWhere('orders.created_at >= :weekStart', { weekStart })
      .getRawOne();

    // Revenue this month
    const monthRevenue = await this.orderRepository
      .createQueryBuilder('orders')
      .select('SUM(orders.total_amount)', 'total')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.status = :status', { status: 'COMPLETED' })
      .andWhere('orders.created_at >= :monthStart', { monthStart })
      .getRawOne();

    // Commission earned today
    const todayCommission = await this.orderRepository
      .createQueryBuilder('orders')
      .select('SUM(orders.platform_fee)', 'total')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.status = :status', { status: 'COMPLETED' })
      .andWhere('DATE(orders.created_at) = DATE(:today)', { today })
      .getRawOne();

    // Average order value today
    const aovData = await this.orderRepository
      .createQueryBuilder('orders')
      .select('COUNT(*)', 'count')
      .addSelect('AVG(orders.total_amount)', 'average')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.status = :status', { status: 'COMPLETED' })
      .andWhere('DATE(orders.created_at) = DATE(:today)', { today })
      .getRawOne();

    return {
      today: parseInt(todayRevenue?.total || 0),
      week: parseInt(weekRevenue?.total || 0),
      month: parseInt(monthRevenue?.total || 0),
      commissionToday: parseInt(todayCommission?.total || 0),
      averageOrderValue: parseInt(aovData?.average || 0),
      ordersToday: parseInt(aovData?.count || 0),
    };
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);

    // Orders today
    const todayOrders = await this.orderRepository.count({
      where: {
        tenant_id: tenantId,
        created_at: today,
      },
    });

    // Orders this week
    const weekOrders = await this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.created_at >= :weekStart', { weekStart })
      .getCount();

    // Get status breakdown for today
    const statusBreakdown = await this.orderRepository
      .createQueryBuilder('orders')
      .select('orders.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(orders.created_at) = DATE(:today)', { today })
      .groupBy('orders.status')
      .getRawMany();

    const statusMap = {
      COMPLETED: 0,
      PENDING_PAYMENT: 0,
      CONFIRMED: 0,
      PREPARING: 0,
      READY: 0,
      REJECTED: 0,
    };

    statusBreakdown.forEach((row) => {
      statusMap[row.status] = parseInt(row.count);
    });

    return {
      today: todayOrders,
      week: weekOrders,
      completed: statusMap.COMPLETED,
      confirmed: statusMap.CONFIRMED,
      preparing: statusMap.PREPARING,
      ready: statusMap.READY,
      pending: statusMap.PENDING_PAYMENT,
      rejected: statusMap.REJECTED,
    };
  }

  /**
   * Get peak hours analytics
   */
  async getPeakHoursAnalytics(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const peakHours = await this.orderRepository
      .createQueryBuilder('orders')
      .select('EXTRACT(HOUR FROM orders.created_at)', 'hour')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(orders.total_amount)', 'revenue')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(orders.created_at) = DATE(:today)', { today })
      .groupBy('EXTRACT(HOUR FROM orders.created_at)')
      .orderBy('EXTRACT(HOUR FROM orders.created_at)', 'ASC')
      .getRawMany();

    return peakHours.map((row) => ({
      hour: parseInt(row.hour),
      orders: parseInt(row.orders),
      revenue: parseInt(row.revenue || 0),
    }));
  }

  /**
   * Get top selling menu items
   */
  async getTopSellingItems(tenantId: string, limit: number = 5) {
    const topItems = await this.orderItemRepository
      .createQueryBuilder('order_items')
      .innerJoin('order_items.order', 'orders')
      .innerJoin('order_items.menu_item', 'menu_items')
      .select('order_items.menu_item_id', 'id')
      .addSelect('order_items.name', 'name')
      .addSelect('COUNT(*)', 'quantity_sold')
      .addSelect('SUM(order_items.subtotal)', 'revenue')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('orders.status = :status', { status: 'COMPLETED' })
      .groupBy('order_items.menu_item_id')
      .addGroupBy('order_items.name')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany();

    return topItems.map((row) => ({
      id: row.id,
      name: row.name,
      quantitySold: parseInt(row.quantity_sold),
      revenue: parseInt(row.revenue || 0),
    }));
  }

  /**
   * Get live order status summary
   */
  async getLiveOrderStatus(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statusCounts = await this.orderRepository
      .createQueryBuilder('orders')
      .select('orders.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('orders.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(orders.created_at) >= DATE(:today)', { today })
      .groupBy('orders.status')
      .getRawMany();

    const liveStatus = {
      new: 0, // PENDING_PAYMENT
      confirmed: 0, // CONFIRMED
      preparing: 0, // PREPARING
      ready: 0, // READY
      completed: 0, // COMPLETED
    };

    statusCounts.forEach((row) => {
      const status = row.status.toLowerCase();
      if (status === 'pending_payment') liveStatus.new = parseInt(row.count);
      if (status === 'confirmed') liveStatus.confirmed = parseInt(row.count);
      if (status === 'preparing') liveStatus.preparing = parseInt(row.count);
      if (status === 'ready') liveStatus.ready = parseInt(row.count);
      if (status === 'completed') liveStatus.completed = parseInt(row.count);
    });

    return liveStatus;
  }

  /**
   * Get daily sales analytics for last 7 days
   */
  async getDailySalesAnalytics(tenantId: string) {
    const salesData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayData = await this.orderRepository
        .createQueryBuilder('orders')
        .select('COUNT(*)', 'orders_count')
        .addSelect('SUM(orders.total_amount)', 'revenue')
        .where('orders.tenant_id = :tenantId', { tenantId })
        .andWhere('orders.status = :status', { status: 'COMPLETED' })
        .andWhere('DATE(orders.created_at) = DATE(:date)', { date })
        .getRawOne();

      salesData.push({
        date: date.toISOString().split('T')[0],
        ordersCount: parseInt(dayData?.orders_count || 0),
        revenue: parseInt(dayData?.revenue || 0),
      });
    }

    return salesData;
  }
}
