import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FinancialReportingService } from '../services/financial-reporting.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetTenant } from '../../../common/decorators/get-tenant.decorator';

/**
 * FinancialAnalyticsController
 *
 * REST API endpoints for comprehensive financial reporting and analytics:
 * - GET /financial-analytics/summary - Financial dashboard overview
 * - GET /financial-analytics/daily-revenue - Daily revenue breakdown
 * - GET /financial-analytics/payment-methods - Payment method analysis
 * - GET /financial-analytics/revenue-by-period - Revenue by time period
 * - GET /financial-analytics/metrics - Key performance metrics
 * - GET /financial-analytics/comparison - Period-over-period comparison
 * - GET /financial-analytics/export - Export data (CSV/JSON)
 *
 * All endpoints require:
 * - JWT authentication
 * - Tenant context (X-Tenant-ID header or verified via JWT)
 *
 * Data is scoped to the authenticated tenant only.
 */
@Controller('financial-analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinancialAnalyticsController {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
  ) {}

  /**
   * Get financial dashboard summary
   *
   * GET /financial-analytics/summary
   *
   * Returns comprehensive financial overview for the specified period:
   * - Total orders and completed orders
   * - Revenue breakdown (cash, mobile money)
   * - Payment method distribution
   * - Platform commission and net revenue
   * - Payment success rates
   * - Average order value
   *
   * Query Parameters:
   * - startDate (optional, YYYY-MM-DD): Period start date (default: 30 days ago)
   * - endDate (optional, YYYY-MM-DD): Period end date (default: today)
   *
   * Response (200):
   * {
   *   "total_orders": 1250,
   *   "completed_orders": 1200,
   *   "paid_orders": 1180,
   *   "failed_orders": 70,
   *   "total_revenue": 15500000,
   *   "momo_revenue": 12000000,
   *   "cash_revenue": 3500000,
   *   "platform_commission": 775000,
   *   "net_revenue": 14725000,
   *   "average_order_value": 12917,
   *   "payment_success_rate": "94.40%",
   *   "period": {
   *     "start_date": "2026-03-09",
   *     "end_date": "2026-04-08",
   *     "days": 30
   *   }
   * }
   *
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Invalid date format. Use YYYY-MM-DD",
   *   "error": "Bad Request"
   * }
   */
  @Get('summary')
  async getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @GetTenant() tenantId?: string,
  ) {
    try {
      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = this.parseDate(startDate);
        if (!start) throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD');
      }

      if (endDate) {
        end = this.parseDate(endDate);
        if (!end) throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD');
      }

      const summary = await this.financialReportingService.getSummary(
        tenantId,
        start,
        end,
      );

      // Add period info
      const actualEnd = end || new Date();
      const actualStart = start || new Date(actualEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

      return {
        ...summary,
        period: {
          start_date: actualStart.toISOString().split('T')[0],
          end_date: actualEnd.toISOString().split('T')[0],
          days: Math.ceil(
            (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24),
          ),
        },
      };
    } catch (error: any) {
      if (error.isBadRequest) throw error;
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get daily revenue breakdown
   *
   * GET /financial-analytics/daily-revenue
   *
   * Returns daily revenue trends with breakdown by payment method.
   * Useful for:
   * - Revenue trend visualization
   * - Daily performance tracking
   * - Identifying peak days
   * - Payment method tracking by day
   *
   * Query Parameters:
   * - days (optional, default: 30, max: 365): Number of days to include
   *
   * Response (200):
   * {
   *   "period_days": 30,
   *   "total_days_with_orders": 28,
   *   "data": [
   *     {
   *       "date": "2026-04-08",
   *       "total_orders": 45,
   *       "total_revenue": 580000,
   *       "cash_revenue": 120000,
   *       "momo_revenue": 460000,
   *       "commission": 29000,
   *       "net_revenue": 551000,
   *       "average_order_value": 12889
   *     },
   *     {
   *       "date": "2026-04-07",
   *       "total_orders": 52,
   *       "total_revenue": 680000,
   *       "cash_revenue": 150000,
   *       "momo_revenue": 530000,
   *       "commission": 34000,
   *       "net_revenue": 646000,
   *       "average_order_value": 13077
   *     }
   *   ],
   *   "summary": {
   *     "total_revenue": 15500000,
   *     "avg_daily_revenue": 553571,
   *     "max_daily_revenue": 850000,
   *     "min_daily_revenue": 120000
   *   }
   * }
   *
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Days must be between 1 and 365",
   *   "error": "Bad Request"
   * }
   */
  @Get('daily-revenue')
  async getDailyRevenue(
    @Query('days', new ParseIntPipe({ optional: true })) days: number = 30,
    @GetTenant() tenantId?: string,
  ) {
    if (isNaN(days) || days < 1 || days > 365) {
      throw new BadRequestException('Days must be between 1 and 365');
    }

    const dailyData = await this.financialReportingService.getDailyRevenue(
      tenantId,
      days,
    );

    // Enrich with additional metrics
    const enriched = dailyData.map((day) => ({
      ...day,
      net_revenue: day.total_revenue - day.commission,
      average_order_value:
        day.total_orders > 0 ? Math.round(day.total_revenue / day.total_orders) : 0,
    }));

    // Calculate summary statistics
    const totalRevenue = enriched.reduce((sum, d) => sum + d.total_revenue, 0);
    const avgDailyRevenue = enriched.length > 0 ? totalRevenue / enriched.length : 0;
    const maxDailyRevenue = enriched.length > 0 ? Math.max(...enriched.map((d) => d.total_revenue)) : 0;
    const minDailyRevenue = enriched.length > 0 ? Math.min(...enriched.map((d) => d.total_revenue)) : 0;

    return {
      period_days: days,
      total_days_with_orders: enriched.length,
      data: enriched.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      summary: {
        total_revenue: totalRevenue,
        avg_daily_revenue: Math.round(avgDailyRevenue),
        max_daily_revenue: maxDailyRevenue,
        min_daily_revenue: minDailyRevenue,
      },
    };
  }

  /**
   * Get payment method breakdown and analysis
   *
   * GET /financial-analytics/payment-methods
   *
   * Returns detailed breakdown of revenue by payment method:
   * - Cash payments (in-store)
   * - Mobile Money (MTN)
   * - Mobile Money (Airtel)
   * - Percentages and trends
   *
   * Response (200):
   * {
   *   "summary": {
   *     "total_orders": 1200,
   *     "total_revenue": 15500000
   *   },
   *   "breakdown": {
   *     "cash": {
   *       "count": 300,
   *       "total": 3750000,
   *       "percentage": 24.19,
   *       "average_order_value": 12500
   *     },
   *     "mtn": {
   *       "count": 720,
   *       "total": 9360000,
   *       "percentage": 60.39,
   *       "average_order_value": 13000
   *     },
   *     "airtel": {
   *       "count": 180,
   *       "total": 2390000,
   *       "percentage": 15.42,
   *       "average_order_value": 13278
   *     }
   *   },
   *   "insights": {
   *     "preferred_method": "mtn",
   *     "highest_aov_method": "airtel",
   *     "cash_penetration": 0.25,
   *     "digital_penetration": 0.75
   *   }
   * }
   */
  @Get('payment-methods')
  async getPaymentMethodAnalysis(@GetTenant() tenantId?: string) {
    const breakdown = await this.financialReportingService.getPaymentMethodBreakdown(
      tenantId,
    );

    const totalOrders = breakdown.cash.count + breakdown.mtn.count + breakdown.airtel.count;
    const totalRevenue = breakdown.cash.total + breakdown.mtn.total + breakdown.airtel.total;

    const enriched = {
      summary: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
      },
      breakdown: {
        cash: {
          ...breakdown.cash,
          percentage: totalOrders > 0 ? (breakdown.cash.count / totalOrders) * 100 : 0,
          average_order_value:
            breakdown.cash.count > 0 ? Math.round(breakdown.cash.total / breakdown.cash.count) : 0,
        },
        mtn: {
          ...breakdown.mtn,
          percentage: totalOrders > 0 ? (breakdown.mtn.count / totalOrders) * 100 : 0,
          average_order_value:
            breakdown.mtn.count > 0 ? Math.round(breakdown.mtn.total / breakdown.mtn.count) : 0,
        },
        airtel: {
          ...breakdown.airtel,
          percentage: totalOrders > 0 ? (breakdown.airtel.count / totalOrders) * 100 : 0,
          average_order_value:
            breakdown.airtel.count > 0 ? Math.round(breakdown.airtel.total / breakdown.airtel.count) : 0,
        },
      },
      insights: {
        preferred_method:
          breakdown.cash.count >= breakdown.mtn.count && breakdown.cash.count >= breakdown.airtel.count
            ? 'cash'
            : breakdown.mtn.count >= breakdown.airtel.count
              ? 'mtn'
              : 'airtel',
        highest_aov_method:
          breakdown.cash.count > 0 && breakdown.cash.total / breakdown.cash.count >= Math.max(
            breakdown.mtn.count > 0 ? breakdown.mtn.total / breakdown.mtn.count : 0,
            breakdown.airtel.count > 0 ? breakdown.airtel.total / breakdown.airtel.count : 0,
          )
            ? 'cash'
            : breakdown.mtn.count > 0 && breakdown.mtn.total / breakdown.mtn.count >= (breakdown.airtel.count > 0 ? breakdown.airtel.total / breakdown.airtel.count : 0)
              ? 'mtn'
              : 'airtel',
        cash_penetration: totalOrders > 0 ? breakdown.cash.count / totalOrders : 0,
        digital_penetration: totalOrders > 0 ? (breakdown.mtn.count + breakdown.airtel.count) / totalOrders : 0,
      },
    };

    // Round percentages
    enriched.breakdown.cash.percentage = Math.round(enriched.breakdown.cash.percentage * 100) / 100;
    enriched.breakdown.mtn.percentage = Math.round(enriched.breakdown.mtn.percentage * 100) / 100;
    enriched.breakdown.airtel.percentage = Math.round(enriched.breakdown.airtel.percentage * 100) / 100;
    enriched.insights.cash_penetration = Math.round(enriched.insights.cash_penetration * 10000) / 10000;
    enriched.insights.digital_penetration = Math.round(enriched.insights.digital_penetration * 10000) / 10000;

    return enriched;
  }

  /**
   * Get key performance metrics and KPIs
   *
   * GET /financial-analytics/metrics
   *
   * Returns comprehensive KPIs for business health monitoring:
   * - Revenue per order
   * - Commission rates
   * - Payment success metrics
   * - Order completion rates
   *
   * Query Parameters:
   * - startDate (optional, YYYY-MM-DD): Period start date
   * - endDate (optional, YYYY-MM-DD): Period end date
   *
   * Response (200):
   * {
   *   "revenue_metrics": {
   *     "total_revenue": 15500000,
   *     "net_revenue": 14725000,
   *     "platform_commission": 775000,
   *     "commission_rate": 5.0
   *   },
   *   "order_metrics": {
   *     "total_orders": 1250,
   *     "completed_orders": 1200,
   *     "completion_rate": 96.0,
   *     "paid_orders": 1180,
   *     "payment_success_rate": 98.33,
   *     "average_order_value": 12917,
   *     "revenue_per_order": 12400
   *   },
   *   "efficiency_metrics": {
   *     "failed_orders": 70,
   *     "failure_rate": 5.6,
   *     "average_commission_per_order": 620
   *   }
   * }
   */
  @Get('metrics')
  async getKeyMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @GetTenant() tenantId?: string,
  ) {
    try {
      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = this.parseDate(startDate);
        if (!start) throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD');
      }

      if (endDate) {
        end = this.parseDate(endDate);
        if (!end) throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD');
      }

      const summary = await this.financialReportingService.getSummary(
        tenantId,
        start,
        end,
      );

      return {
        revenue_metrics: {
          total_revenue: summary.total_revenue,
          net_revenue: summary.net_revenue,
          platform_commission: summary.platform_commission,
          commission_rate:
            summary.total_revenue > 0
              ? Math.round((summary.platform_commission / summary.total_revenue) * 100 * 100) / 100
              : 0,
        },
        order_metrics: {
          total_orders: summary.total_orders,
          completed_orders: summary.completed_orders,
          completion_rate:
            summary.total_orders > 0
              ? Math.round((summary.completed_orders / summary.total_orders) * 100 * 100) / 100
              : 0,
          paid_orders: summary.paid_orders,
          payment_success_rate: parseFloat(summary.payment_success_rate),
          average_order_value: summary.average_order_value,
          revenue_per_order:
            summary.total_orders > 0
              ? Math.round(summary.total_revenue / summary.total_orders)
              : 0,
        },
        efficiency_metrics: {
          failed_orders: summary.failed_orders,
          failure_rate:
            summary.total_orders > 0
              ? Math.round((summary.failed_orders / summary.total_orders) * 100 * 100) / 100
              : 0,
          average_commission_per_order:
            summary.total_orders > 0
              ? Math.round(summary.platform_commission / summary.total_orders)
              : 0,
        },
      };
    } catch (error: any) {
      if (error.isBadRequest) throw error;
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Compare financial performance between two periods
   *
   * GET /financial-analytics/comparison
   *
   * Returns period-over-period comparison for trend analysis:
   * - Revenue growth/decline
   * - Order volume changes
   * - Success rate movements
   * - Method mix shifts
   *
   * Query Parameters:
   * - period1_start (required, YYYY-MM-DD): First period start
   * - period1_end (required, YYYY-MM-DD): First period end
   * - period2_start (required, YYYY-MM-DD): Second period start
   * - period2_end (required, YYYY-MM-DD): Second period end
   *
   * Response (200):
   * {
   *   "period_1": {
   *     "label": "2026-03-01 to 2026-03-31",
   *     "total_revenue": 14000000,
   *     "total_orders": 1100
   *   },
   *   "period_2": {
   *     "label": "2026-04-01 to 2026-04-08",
   *     "total_revenue": 3500000,
   *     "total_orders": 250
   *   },
   *   "comparison": {
   *     "revenue_change": {
   *       "absolute": -500000,
   *       "percentage": -3.57
   *     },
   *     "order_change": {
   *       "absolute": -50,
   *       "percentage": -4.55
   *     },
   *     "aov_change": {
   *       "absolute": 82,
   *       "percentage": 0.63
   *     },
   *     "trend": "declining"
   *   }
   * }
   */
  @Get('comparison')
  async getComparison(
    @Query('period1_start') period1Start?: string,
    @Query('period1_end') period1End?: string,
    @Query('period2_start') period2Start?: string,
    @Query('period2_end') period2End?: string,
    @GetTenant() tenantId?: string,
  ) {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      throw new BadRequestException(
        'All parameters required: period1_start, period1_end, period2_start, period2_end (YYYY-MM-DD)',
      );
    }

    const p1Start = this.parseDate(period1Start);
    const p1End = this.parseDate(period1End);
    const p2Start = this.parseDate(period2Start);
    const p2End = this.parseDate(period2End);

    if (!p1Start || !p1End || !p2Start || !p2End) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const period1 = await this.financialReportingService.getSummary(
      tenantId,
      p1Start,
      p1End,
    );

    const period2 = await this.financialReportingService.getSummary(
      tenantId,
      p2Start,
      p2End,
    );

    const revenueChange = period2.total_revenue - period1.total_revenue;
    const orderChange = period2.total_orders - period1.total_orders;
    const aovChange = period2.average_order_value - period1.average_order_value;

    return {
      period_1: {
        label: `${p1Start.toISOString().split('T')[0]} to ${p1End.toISOString().split('T')[0]}`,
        total_revenue: period1.total_revenue,
        total_orders: period1.total_orders,
        average_order_value: period1.average_order_value,
      },
      period_2: {
        label: `${p2Start.toISOString().split('T')[0]} to ${p2End.toISOString().split('T')[0]}`,
        total_revenue: period2.total_revenue,
        total_orders: period2.total_orders,
        average_order_value: period2.average_order_value,
      },
      comparison: {
        revenue_change: {
          absolute: revenueChange,
          percentage:
            period1.total_revenue > 0
              ? Math.round((revenueChange / period1.total_revenue) * 100 * 100) / 100
              : 0,
        },
        order_change: {
          absolute: orderChange,
          percentage:
            period1.total_orders > 0
              ? Math.round((orderChange / period1.total_orders) * 100 * 100) / 100
              : 0,
        },
        aov_change: {
          absolute: aovChange,
          percentage:
            period1.average_order_value > 0
              ? Math.round((aovChange / period1.average_order_value) * 100 * 100) / 100
              : 0,
        },
        trend:
          revenueChange > 0 ? 'growing' : revenueChange < 0 ? 'declining' : 'stable',
      },
    };
  }

  /**
   * Helper: Parse date string to Date object
   * @private
   */
  private parseDate(dateStr: string): Date | null {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return null;

    const date = new Date(dateStr + 'T00:00:00Z');
    return isNaN(date.getTime()) ? null : date;
  }
}
