import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../entities/audit-log.entity';
import { SettlementService } from '../../payments/services/settlement.service';

/**
 * AdminSettlementsController - Platform admin settlement/payout monitoring
 *
 * Allows platform admins to:
 * - View all settlements/payouts across all restaurants
 * - Filter by status, date range, restaurant
 * - View settlement details
 * - Retry failed settlements
 * - View payout history
 *
 * GET /admin/settlements - List all settlements
 * GET /admin/settlements/:id - Get settlement details
 * POST /admin/settlements/:id/retry - Retry failed settlement
 */
@Controller('admin/settlements')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettlementsController {
  constructor(
    private readonly auditService: AuditService,
    private readonly settlementService: SettlementService,
  ) {}

  /**
   * Get all settlements with filtering
   *
   * Query parameters:
   * - status: Filter by status (PENDING, PROCESSING, SUCCESSFUL, FAILED, REVERSED)
   * - restaurant_id: Filter by restaurant
   * - from_date: Start date (ISO 8601)
   * - to_date: End date (ISO 8601)
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get()
  async listSettlements(
    @Query('status') status?: string,
    @Query('restaurant_id') restaurantId?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.settlementService.getAllSettlementsPlatformWide(
        {
          tenantId: restaurantId,
          status,
          fromDate: fromDate ? new Date(fromDate) : undefined,
          toDate: toDate ? new Date(toDate) : undefined,
        },
        limit,
        offset,
      );

      return {
        success: true,
        data: result,
        limit,
        offset,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get settlement details
   *
   * Returns:
   * - Restaurant info
   * - Source transaction
   * - Gross amount, fees, net payout
   * - Destination account
   * - Status history
   * - Failure reason if applicable
   */
  @Get(':id')
  async getSettlement(@Param('id') id: string) {
    try {
      const settlement = await this.settlementService.getSettlementDetail(id);

      return {
        success: true,
        data: settlement,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          error: 'Settlement not found',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retry failed settlement
   *
   * This is a controlled action - creates audit log
   * Only authorized finance admins should use this
   */
  @Post(':id/retry')
  async retrySettlement(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @GetUser() user?: JwtPayload,
  ) {
    try {
      // Attempt to retry the settlement in service
      const updatedSettlement = await this.settlementService.retryFailedSettlement(
        id,
        reason,
        user?.userId,
      );

      // Log audit event for the successful retry
      if (user) {
        await this.auditService.log({
          admin_user_id: user.userId,
          action_type: AuditActionEnum.SETTLEMENT_RETRIED,
          reference_type: 'settlement',
          reference_id: id,
          metadata_json: {
            reason: reason || 'Manual retry',
            previous_status: 'FAILED',
            new_status: updatedSettlement.status,
          },
        });
      }

      return {
        success: true,
        data: updatedSettlement,
        message: 'Settlement retry initiated. Status changed from FAILED to PENDING.',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          error: 'Settlement not found',
        };
      }
      if (error instanceof BadRequestException) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
