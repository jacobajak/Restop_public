import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum } from '../../orders/entities/order.entity';

/**
 * FinancialReportingService
 * 
 * Provides business visibility for restaurants.
 * 
 * Metrics:
 * - Total orders
 * - Paid orders
 * - Revenue by payment method
 * - Commission analysis
 * - Conversion rates
 */
@Injectable()
export class FinancialReportingService {
  private readonly logger = new Logger(FinancialReportingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  // TODO Phase 3: Add WalletService for tenant wallet financial reporting

  /**
   * Get financial summary for tenant
   * 
   * Typically by day, week, or month.
   */
  async getSummary(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_orders: number;
    completed_orders: number;
    paid_orders: number;
    failed_orders: number;
    total_revenue: number;
    momo_revenue: number;
    cash_revenue: number;
    platform_commission: number;
    net_revenue: number;
    average_order_value: number;
    payment_success_rate: string;
  }> {
    try {
      // Default to last 30 days
      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const whereClause = {
        tenant_id: tenantId,
        status: OrderStatusEnum.COMPLETED,
        created_at: Between(start, end),
      };

      // Get all completed orders
      const completedOrders = await this.orderRepository.find({
        where: whereClause,
      });

      const totalOrders = completedOrders.length;

      // Get all paid orders (regardless of completion)
      const paidOrders = await this.orderRepository.find({
        where: {
          tenant_id: tenantId,
          payment_status: PaymentStatusEnum.PAID,
          created_at: Between(start, end),
        },
      });

      const failedOrders = await this.orderRepository.find({
        where: {
          tenant_id: tenantId,
          payment_status: PaymentStatusEnum.FAILED,
          created_at: Between(start, end),
        },
      });

      // Calculate metrics
      let totalRevenue = 0;
      let momoRevenue = 0;
      let cashRevenue = 0;
      let platformCommission = 0;

      for (const order of completedOrders) {
        totalRevenue += order.total_amount;
        platformCommission += order.platform_fee;

        if (order.payment_method === PaymentMethodEnum.CASH) {
          cashRevenue += order.total_amount;
        } else {
          momoRevenue += order.total_amount;
        }
      }

      const netRevenue = totalRevenue - platformCommission;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const paymentSuccessRate =
        totalOrders > 0
          ? ((paidOrders.length / (paidOrders.length + failedOrders.length || 1)) * 100).toFixed(2)
          : '0.00';

      return {
        total_orders: totalOrders,
        completed_orders: totalOrders,
        paid_orders: paidOrders.length,
        failed_orders: failedOrders.length,
        total_revenue: totalRevenue,
        momo_revenue: momoRevenue,
        cash_revenue: cashRevenue,
        platform_commission: platformCommission,
        net_revenue: netRevenue,
        average_order_value: Math.round(averageOrderValue),
        payment_success_rate: `${paymentSuccessRate}%`,
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate financial summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get daily revenue breakdown
   */
  async getDailyRevenue(tenantId: string, days: number = 30): Promise<
    Array<{
      date: string;
      total_orders: number;
      total_revenue: number;
      cash_revenue: number;
      momo_revenue: number;
      commission: number;
    }>
  > {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const orders = await this.orderRepository.find({
      where: {
        tenant_id: tenantId,
        status: OrderStatusEnum.COMPLETED,
        created_at: Between(startDate, endDate),
      },
    });

    // Group by date
    const dailyData: Record<string, any> = {};

    for (const order of orders) {
      const dateKey = order.created_at.toISOString().split('T')[0];

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          total_orders: 0,
          total_revenue: 0,
          cash_revenue: 0,
          momo_revenue: 0,
          commission: 0,
        };
      }

      dailyData[dateKey].total_orders += 1;
      dailyData[dateKey].total_revenue += order.total_amount;
      dailyData[dateKey].commission += order.platform_fee;

      if (order.payment_method === PaymentMethodEnum.CASH) {
        dailyData[dateKey].cash_revenue += order.total_amount;
      } else {
        dailyData[dateKey].momo_revenue += order.total_amount;
      }
    }

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  /**
   * Get payment method breakdown
   */
  async getPaymentMethodBreakdown(tenantId: string): Promise<{
    cash: {
      count: number;
      total: number;
    };
    mtn: {
      count: number;
      total: number;
    };
    airtel: {
      count: number;
      total: number;
    };
  }> {
    const allOrders = await this.orderRepository.find({
      where: { tenant_id: tenantId, status: OrderStatusEnum.COMPLETED },
    });

    const breakdown = {
      cash: { count: 0, total: 0 },
      mtn: { count: 0, total: 0 },
      airtel: { count: 0, total: 0 },
    };

    for (const order of allOrders) {
      if (order.payment_method === PaymentMethodEnum.CASH) {
        breakdown.cash.count += 1;
        breakdown.cash.total += order.total_amount;
      } else if (order.payment_method === PaymentMethodEnum.MTN) {
        breakdown.mtn.count += 1;
        breakdown.mtn.total += order.total_amount;
      } else if (order.payment_method === PaymentMethodEnum.AIRTEL) {
        breakdown.airtel.count += 1;
        breakdown.airtel.total += order.total_amount;
      }
    }

    return breakdown;
  }
}
