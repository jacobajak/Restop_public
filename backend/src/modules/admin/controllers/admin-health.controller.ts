import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Order } from '../../orders/entities/order.entity';
import { PaymentTransaction } from '../../payments/entities/payment.entity';
import { Refund, RefundStatusEnum } from '../../payments/entities/refund.entity';

/**
 * AdminHealthController - System health and performance monitoring
 *
 * Provides comprehensive platform health metrics:
 * - System status
 * - Error rates and performance
 * - Activity metrics
 * - Health indicators
 */
@Controller('admin/health')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminHealthController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
  ) {}

  /**
   * Get comprehensive system health dashboard
   */
  @Get()
  async getSystemHealth() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // ===== RESTAURANT HEALTH =====
      const totalRestaurants = await this.tenantRepository.count();
      const activeRestaurants = await this.tenantRepository.count({
        where: { status: 'ACTIVE' },
      });
      const suspendedRestaurants = await this.tenantRepository.count({
        where: { status: 'SUSPENDED' },
      });
      const pendingRestaurants = await this.tenantRepository.count({
        where: { status: 'PENDING' },
      });

      // ===== ORDER METRICS =====
      const totalOrders = await this.orderRepository.count();
      const ordersLast24h = await this.orderRepository
        .createQueryBuilder('order')
        .where('order.created_at >= :twentyFourHoursAgo', { twentyFourHoursAgo })
        .getCount();

      const ordersLastHour = await this.orderRepository
        .createQueryBuilder('order')
        .where('order.created_at >= :oneHourAgo', { oneHourAgo })
        .getCount();

      const ordersToday = await this.orderRepository
        .createQueryBuilder('order')
        .where('DATE(order.created_at) = :today', {
          today: todayStart.toISOString().split('T')[0],
        })
        .getCount();

      // Order status breakdown
      const orderStatuses = await this.orderRepository
        .createQueryBuilder('order')
        .select('order.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('order.status')
        .getRawMany();

      const orderStatusMap = orderStatuses.reduce(
        (acc, item) => {
          acc[item.status.toLowerCase()] = parseInt(item.count, 10);
          return acc;
        },
        {} as Record<string, number>,
      );

      // ===== PAYMENT METRICS =====
      const totalPayments = await this.paymentRepository.count();
      const paymentsLast24h = await this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.created_at >= :twentyFourHoursAgo', { twentyFourHoursAgo })
        .getCount();

      const successfulPayments = await this.paymentRepository.count({
        where: { status: 'COMPLETED' },
      });

      const failedPayments = await this.paymentRepository.count({
        where: { status: 'FAILED' },
      });

      const pendingPayments = await this.paymentRepository.count({
        where: { status: 'PENDING' },
      });

      // Payment method breakdown - join with orders to get payment_method
      const paymentMethods = await this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.order', 'order')
        .select('order.payment_method', 'method')
        .addSelect('COUNT(*)', 'count')
        .where('payment.created_at >= :twentyFourHoursAgo', { twentyFourHoursAgo })
        .groupBy('order.payment_method')
        .getRawMany();

      const paymentMethodMap = paymentMethods.reduce(
        (acc, item) => {
          acc[item.method || 'unknown'] = parseInt(item.count, 10);
          return acc;
        },
        {} as Record<string, number>,
      );

      // ===== REFUND METRICS =====
      const totalRefunds = await this.refundRepository.count();
      const pendingRefunds = await this.refundRepository.count({
        where: { status: RefundStatusEnum.PENDING },
      });
      const approvedRefunds = await this.refundRepository.count({
        where: { status: RefundStatusEnum.APPROVED },
      });
      const rejectedRefunds = await this.refundRepository.count({
        where: { status: RefundStatusEnum.REJECTED },
      });

      // ===== CALCULATE HEALTH SCORES =====
      const paymentSuccessRate =
        totalPayments > 0
          ? Math.round((successfulPayments / totalPayments) * 100)
          : 100;

      const systemHealth = {
        status: this.getSystemStatus(
          activeRestaurants,
          paymentSuccessRate,
          failedPayments,
        ),
        score: this.calculateHealthScore(
          activeRestaurants,
          totalRestaurants,
          paymentSuccessRate,
        ),
        lastChecked: new Date(),
      };

      return {
        success: true,
        data: {
          timestamp: now,
          system_health: systemHealth,

          // ===== RESTAURANT METRICS =====
          restaurants: {
            total: totalRestaurants,
            active: activeRestaurants,
            suspended: suspendedRestaurants,
            pending: pendingRestaurants,
            active_rate: totalRestaurants > 0
              ? Math.round((activeRestaurants / totalRestaurants) * 100)
              : 0,
          },

          // ===== ORDER METRICS =====
          orders: {
            total: totalOrders,
            today: ordersToday,
            last_24h: ordersLast24h,
            last_hour: ordersLastHour,
            avg_per_hour: ordersLast24h > 0 ? Math.round(ordersLast24h / 24) : 0,
            status_breakdown: {
              pending: orderStatusMap['pending'] || 0,
              confirmed: orderStatusMap['confirmed'] || 0,
              preparing: orderStatusMap['preparing'] || 0,
              ready: orderStatusMap['ready'] || 0,
              completed: orderStatusMap['completed'] || 0,
              cancelled: orderStatusMap['cancelled'] || 0,
              rejected: orderStatusMap['rejected'] || 0,
            },
          },

          // ===== PAYMENT METRICS =====
          payments: {
            total: totalPayments,
            successful: successfulPayments,
            failed: failedPayments,
            pending: pendingPayments,
            last_24h: paymentsLast24h,
            success_rate: paymentSuccessRate,
            failure_rate: 100 - paymentSuccessRate,
            method_breakdown: paymentMethodMap,
          },

          // ===== REFUND METRICS =====
          refunds: {
            total: totalRefunds,
            pending: pendingRefunds,
            approved: approvedRefunds,
            rejected: rejectedRefunds,
            approval_rate:
              totalRefunds > 0
                ? Math.round((approvedRefunds / totalRefunds) * 100)
                : 0,
          },

          // ===== PERFORMANCE ALERTS =====
          alerts: this.generateAlerts(
            activeRestaurants,
            totalRestaurants,
            paymentSuccessRate,
            failedPayments,
            ordersLastHour,
            suspendedRestaurants,
            pendingRefunds,
          ),
        },
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        success: false,
        error: error.message,
        data: {
          system_health: {
            status: 'CRITICAL',
            score: 0,
            lastChecked: new Date(),
          },
          alerts: [
            {
              severity: 'CRITICAL',
              title: 'Health Check Failed',
              message: error.message,
              timestamp: new Date(),
            },
          ],
        },
      };
    }
  }

  /**
   * Determine overall system status
   */
  private getSystemStatus(
    activeRestaurants: number,
    paymentSuccessRate: number,
    failedPayments: number,
  ): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
    if (
      paymentSuccessRate < 80 ||
      failedPayments > 10 ||
      activeRestaurants === 0
    ) {
      return 'CRITICAL';
    }
    if (paymentSuccessRate < 95 || failedPayments > 5) {
      return 'DEGRADED';
    }
    return 'HEALTHY';
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(
    activeRestaurants: number,
    totalRestaurants: number,
    paymentSuccessRate: number,
  ): number {
    const restaurantHealth =
      totalRestaurants > 0
        ? (activeRestaurants / totalRestaurants) * 100
        : 0;
    const paymentHealth = paymentSuccessRate;

    return Math.round((restaurantHealth * 0.4 + paymentHealth * 0.6) / 2);
  }

  /**
   * Generate alerts based on health metrics
   */
  private generateAlerts(
    activeRestaurants: number,
    totalRestaurants: number,
    paymentSuccessRate: number,
    failedPayments: number,
    ordersLastHour: number,
    suspendedRestaurants: number,
    pendingRefunds: number,
  ) {
    const alerts: any[] = [];

    if (paymentSuccessRate < 80) {
      alerts.push({
        severity: 'CRITICAL',
        title: 'Payment Processing Issue',
        message: `Payment success rate is ${paymentSuccessRate}%. Expected at least 95%.`,
        timestamp: new Date(),
      });
    }

    if (failedPayments > 10) {
      alerts.push({
        severity: 'WARNING',
        title: 'High Payment Failures',
        message: `${failedPayments} payments have failed in recent period.`,
        timestamp: new Date(),
      });
    }

    if (activeRestaurants === 0) {
      alerts.push({
        severity: 'CRITICAL',
        title: 'No Active Restaurants',
        message: 'Platform has no active restaurants.',
        timestamp: new Date(),
      });
    }

    if (totalRestaurants > 0 && activeRestaurants / totalRestaurants < 0.5) {
      alerts.push({
        severity: 'WARNING',
        title: 'Low Restaurant Activity',
        message: `Only ${Math.round(
          (activeRestaurants / totalRestaurants) * 100,
        )}% of restaurants are active.`,
        timestamp: new Date(),
      });
    }

    if (ordersLastHour === 0) {
      alerts.push({
        severity: 'INFO',
        title: 'No Orders in Last Hour',
        message: 'No orders received in the last hour.',
        timestamp: new Date(),
      });
    }

    if (suspendedRestaurants > totalRestaurants * 0.1) {
      alerts.push({
        severity: 'WARNING',
        title: 'High Suspension Rate',
        message: `${suspendedRestaurants} restaurants are currently suspended.`,
        timestamp: new Date(),
      });
    }

    if (pendingRefunds > 20) {
      alerts.push({
        severity: 'INFO',
        title: 'Pending Refunds',
        message: `${pendingRefunds} refund requests are awaiting approval.`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }
}
