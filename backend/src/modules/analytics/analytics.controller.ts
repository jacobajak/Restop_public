import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../common/strategies/jwt.strategy';

@Controller('analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/dashboard
   * Get comprehensive analytics dashboard data
   */
  @Get('dashboard')
  async getDashboard(@GetUser() user: JwtPayload) {
    const analytics = await this.analyticsService.getDashboardAnalytics(user.tenantId);
    return {
      success: true,
      data: analytics,
    };
  }

  /**
   * GET /analytics/revenue
   * Get revenue analytics for today, week, month
   */
  @Get('revenue')
  async getRevenueAnalytics(@GetUser() user: JwtPayload) {
    const revenue = await this.analyticsService.getRevenueAnalytics(user.tenantId);
    return {
      success: true,
      data: revenue,
    };
  }

  /**
   * GET /analytics/orders
   * Get order analytics
   */
  @Get('orders')
  async getOrderAnalytics(@GetUser() user: JwtPayload) {
    const orders = await this.analyticsService.getOrderAnalytics(user.tenantId);
    return {
      success: true,
      data: orders,
    };
  }

  /**
   * GET /analytics/peak-hours
   * Get peak hours analytics
   */
  @Get('peak-hours')
  async getPeakHours(@GetUser() user: JwtPayload) {
    const peakHours = await this.analyticsService.getPeakHoursAnalytics(user.tenantId);
    return {
      success: true,
      data: peakHours,
    };
  }

  /**
   * GET /analytics/top-items
   * Get top selling menu items
   */
  @Get('top-items')
  async getTopItems(@GetUser() user: JwtPayload) {
    const items = await this.analyticsService.getTopSellingItems(user.tenantId);
    return {
      success: true,
      data: items,
    };
  }

  /**
   * GET /analytics/live-orders
   * Get live order status summary
   */
  @Get('live-orders')
  async getLiveOrders(@GetUser() user: JwtPayload) {
    const liveOrders = await this.analyticsService.getLiveOrderStatus(user.tenantId);
    return {
      success: true,
      data: liveOrders,
    };
  }

  /**
   * GET /analytics/daily-sales
   * Get daily sales for the last 7 days
   */
  @Get('daily-sales')
  async getDailySales(@GetUser() user: JwtPayload) {
    const sales = await this.analyticsService.getDailySalesAnalytics(user.tenantId);
    return {
      success: true,
      data: sales,
    };
  }
}
