import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { PlatformFeeSettlementService } from '../services/platform-fee-settlement.service';

/**
 * Admin Platform Fee Settlements Controller
 *
 * Platform admin controls for managing platform fee settlements
 * Enables admins to:
 * - View pending settlements (fees awaiting confirmation)
 * - Confirm individual or batch settlements
 * - Review settlement history and details
 * - Manage audit trail
 *
 * GET /api/v1/admin/platform-fee-settlements/pending - List pending settlements
 * GET /api/v1/admin/platform-fee-settlements/:id/details - View settlement details
 * PATCH /api/v1/admin/platform-fee-settlements/:id/confirm - Confirm single settlement
 * POST /api/v1/admin/platform-fee-settlements/batch-confirm - Confirm multiple settlements
 * GET /api/v1/admin/platform-fee-settlements/history - View historical settlements
 * GET /api/v1/admin/platform-fee-settlements/stats - Get settlement statistics
 */
@Controller('admin/platform-fee-settlements')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPlatformFeeSettlementsController {
  constructor(
    private readonly settlementService: PlatformFeeSettlementService,
  ) {}

  /**
   * Get all pending settlements
   * Admin reviews these to confirm which restaurants have paid their fees
   */
  @Get('pending')
  async getPendingSettlements(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.settlementService.getPendingSettlements(limit, offset);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get settlement details including transaction breakdown
   */
  @Get(':settlementId/details')
  async getSettlementDetails(@Param('settlementId') settlementId: string) {
    try {
      const result = await this.settlementService.getSettlementDetails(settlementId);

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
   * Confirm a single settlement
   * Admin marks this settlement as "payment received"
   */
  @Patch(':settlementId/confirm')
  async confirmSettlement(
    @Param('settlementId') settlementId: string,
    @GetUser() user: JwtPayload,
    @Body() body?: { notes?: string },
  ) {
    try {
      const result = await this.settlementService.confirmSettlement(
        settlementId,
        user.userId,
        body?.notes,
      );

      return {
        success: true,
        message: 'Settlement confirmed successfully',
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
   * Confirm multiple settlements in a batch
   */
  @Post('batch-confirm')
  async confirmBatchSettlements(
    @GetUser() user: JwtPayload,
    @Body() body: { settlement_ids: string[]; notes?: string },
  ) {
    try {
      if (!body.settlement_ids || body.settlement_ids.length === 0) {
        return {
          success: false,
          error: 'settlement_ids array is required and cannot be empty',
        };
      }

      const result = await this.settlementService.confirmBatchSettlements(
        body.settlement_ids,
        user.userId,
        body.notes,
      );

      return {
        success: true,
        message: `${result.count} settlements confirmed successfully`,
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
   * Get settlement history
   */
  @Get('history')
  async getSettlementHistory(
    @Query('tenant_id') tenantId?: string,
    @Query('status') status?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.settlementService.getSettlementHistory(
        tenantId,
        status as any,
        limit,
        offset,
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
   * Get settlement statistics
   */
  @Get('stats')
  async getSettlementStats() {
    try {
      const stats = await this.settlementService.getSettlementStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
