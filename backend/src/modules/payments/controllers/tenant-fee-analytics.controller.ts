import {
  Controller,
  Get,
  UseGuards,
  Param,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { PlatformFeeSettlementService } from '../services/platform-fee-settlement.service';
import { SettlementStatusEnum } from '../entities/platform-fee-settlement.entity';

/**
 * Tenant Platform Fee Analytics Controller
 *
 * Provides restaurants with visibility into their platform fee charges
 * and settlement status. Allows tenants to:
 * - View their current pending fees awaiting settlement
 * - Check settlement status and history
 * - See fee breakdown and analytics
 * - Track payment confirmations
 *
 * GET /api/v1/tenants/fee-analytics/summary - Fee overview
 * GET /api/v1/tenants/fee-analytics/pending - Pending fees
 * GET /api/v1/tenants/fee-analytics/history - Settlement history
 * GET /api/v1/tenants/fee-analytics/current-month - Current month analytics
 */
@Controller('tenants/fee-analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantFeeAnalyticsController {
  constructor(
    private readonly settlementService: PlatformFeeSettlementService,
  ) {}

  /**
   * Get fee analytics summary for current tenant
   * Shows current balances and recent activity
   */
  @Get('summary')
  async getFeeSummary(@GetUser() user: JwtPayload) {
    try {
      const tenantId = user.tenantId;

      // Get pending and recent settled settlements
      const history = await this.settlementService.getSettlementHistory(
        tenantId,
        undefined,
        100,
        0
      );

      // Calculate summary metrics
      const pending = history.settlements.filter((s) => s.status === 'PENDING');
      const confirmed = history.settlements.filter((s) => s.status === 'CONFIRMED');
      const settled = history.settlements.filter((s) => s.status === 'SETTLED');

      const summary = {
        tenant_id: tenantId,
        pending_fees: {
          count: pending.length,
          total_amount: pending.reduce((sum, s) => sum + s.settlement_amount, 0),
        },
        awaiting_admin_confirmation: {
          count: confirmed.length,
          total_amount: confirmed.reduce((sum, s) => sum + s.settlement_amount, 0),
        },
        recently_settled: {
          count: settled.slice(0, 5).length,
          total_amount: settled.slice(0, 5).reduce((sum, s) => sum + s.settlement_amount, 0),
        },
        last_settlement: settled.length > 0 ? settled[0] : null,
      };

      return {
        success: true,
        data: summary,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get pending fee settlements for tenant
   */
  @Get('pending')
  async getPendingFees(
    @GetUser() user: JwtPayload,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const tenantId = user.tenantId;

      const result = await this.settlementService.getSettlementHistory(
        tenantId,
        SettlementStatusEnum.PENDING,
        limit,
        offset
      );

      return {
        success: true,
        data: {
          ...result,
          message: `You have ${result.settlements.length} pending settlement awaiting platform confirmation`,
          items: result.settlements,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get settlement history for tenant
   */
  @Get('history')
  async getSettlementHistory(
    @GetUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const tenantId = user.tenantId;

      const result = await this.settlementService.getSettlementHistory(
        tenantId,
        status as any,
        limit,
        offset
      );

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get detailed analytics for current month
   */
  @Get('current-month')
  async getCurrentMonthAnalytics(@GetUser() user: JwtPayload) {
    try {
      const tenantId = user.tenantId;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get all settlements this month
      const history = await this.settlementService.getSettlementHistory(
        tenantId,
        undefined,
        1000,
        0
      );

      const thisMonth = history.settlements.filter(
        (s) =>
          new Date(s.period_end) >= monthStart &&
          new Date(s.period_start) <= monthEnd
      );

      // Group by status
      const pending = thisMonth.filter((s) => s.status === 'PENDING');
      const confirmed = thisMonth.filter((s) => s.status === 'CONFIRMED');
      const settled = thisMonth.filter((s) => s.status === 'SETTLED');

      return {
        success: true,
        data: {
          month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
          period_start: monthStart,
          period_end: monthEnd,
          pending: {
            count: pending.length,
            total_amount: pending.reduce((sum, s) => sum + s.settlement_amount, 0),
            settlements: pending,
          },
          confirmed: {
            count: confirmed.length,
            total_amount: confirmed.reduce((sum, s) => sum + s.settlement_amount, 0),
            settlements: confirmed,
          },
          settled: {
            count: settled.length,
            total_amount: settled.reduce((sum, s) => sum + s.settlement_amount, 0),
            settlements: settled,
          },
          total_this_month: {
            amount: thisMonth.reduce((sum, s) => sum + s.settlement_amount, 0),
            transaction_count: thisMonth.reduce((sum, s) => sum + (s.transaction_count || 0), 0),
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get settlement details (transaction breakdown)
   * Allows tenant to review what fees they're being charged for
   */
  @Get('settlement/:settlementId')
  async getSettlementDetails(
    @GetUser() user: JwtPayload,
    @Param('settlementId') settlementId: string,
  ) {
    try {
      const result = await this.settlementService.getSettlementDetails(settlementId);

      // Verify tenant owns this settlement
      if (result.tenant_id !== user.tenantId) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
