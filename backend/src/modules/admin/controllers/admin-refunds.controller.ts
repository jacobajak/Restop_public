import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { RefundService } from '../../payments/services/refund.service';
import { AdminPaymentManagementService } from '../services/admin-payment-management.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';
import { BulkProcessRefundsDto, BulkRejectRefundsDto } from '../dtos/admin-payment-management.dto';

/**
 * AdminRefundsController - Admin refund management
 *
 * Allows platform admins to:
 * - View pending refunds
 * - Approve/reject refunds
 * - View refund history
 * - Search by order, tenant, amount range
 *
 * GET /admin/refunds - List refunds with filters
 * POST /admin/refunds/:id/approve - Approve refund
 * POST /admin/refunds/:id/reject - Reject refund
 */
@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminRefundsController {
  constructor(
    private readonly refundService: RefundService,
    private readonly adminPaymentService: AdminPaymentManagementService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List refunds with filtering
   *
   * Query parameters:
   * - status: PENDING, APPROVED, PROCESSED, FAILED, REJECTED
   * - tenant_id: Filter by tenant
   * - order_id: Filter by order
   * - min_amount: Filter by min amount
   * - max_amount: Filter by max amount
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get()
  async listRefunds(
    @Query('status') status?: string,
    @Query('tenant_id') tenant_id?: string,
    @Query('order_id') order_id?: string,
    @Query('min_amount') min_amount?: string,
    @Query('max_amount') max_amount?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.refundService.listRefunds({
        status: status as any,
        tenant_id,
        order_id,
        min_amount: min_amount ? parseInt(min_amount) : undefined,
        max_amount: max_amount ? parseInt(max_amount) : undefined,
        limit,
        offset,
      });

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
   * Get refund details
   */
  @Get(':id')
  async getRefund(@Param('id') refundId: string) {
    try {
      const refund = await this.refundService.getRefund(refundId);

      return {
        success: true,
        data: {
          id: refund.id,
          order_id: refund.order_id,
          tenant_id: refund.tenant_id,
          payment_id: refund.payment_id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          notes: refund.notes,
          approved_by: refund.approved_by,
          approved_at: refund.approved_at,
          processed_at: refund.processed_at,
          created_at: refund.created_at,
          updated_at: refund.updated_at,
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
   * Approve refund
   *
   * Body:
   * - notes?: Optional approval notes
   */
  @Post(':id/approve')
  async approveRefund(
    @GetUser() admin: JwtPayload,
    @Param('id') refundId: string,
    @Body('notes') notes?: string,
  ) {
    try {
      const refund = await this.refundService.approveRefund(
        refundId,
        admin.userId,
        notes,
      );

      // Log audit event (audit logging already done in RefundService)
      await this.auditService.log({
        admin_user_id: admin.userId,
        action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
        reference_type: 'refund_approval',
        reference_id: refundId,
        metadata_json: {
          order_id: refund.order_id,
          amount: refund.amount,
          approval_notes: notes,
        },
      });

      return {
        success: true,
        data: {
          id: refund.id,
          order_id: refund.order_id,
          amount: refund.amount,
          status: refund.status,
          approved_by: refund.approved_by,
          approved_at: refund.approved_at,
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
   * Reject refund
   *
   * Body:
   * - notes: Rejection reason (required)
   */
  @Post(':id/reject')
  async rejectRefund(
    @GetUser() admin: JwtPayload,
    @Param('id') refundId: string,
    @Body('notes') notes: string,
  ) {
    try {
      if (!notes) {
        throw new BadRequestException('Rejection notes are required');
      }

      const refund = await this.refundService.rejectRefund(
        refundId,
        admin.userId,
        notes,
      );

      // Log audit event (audit logging already done in RefundService)
      await this.auditService.log({
        admin_user_id: admin.userId,
        action_type: AuditActionEnum.MANUAL_FINANCIAL_ADJUSTMENT,
        reference_type: 'refund_rejection',
        reference_id: refundId,
        metadata_json: {
          order_id: refund.order_id,
          amount: refund.amount,
          rejection_reason: notes,
        },
      });

      return {
        success: true,
        data: {
          id: refund.id,
          order_id: refund.order_id,
          amount: refund.amount,
          status: refund.status,
          rejected_by: refund.approved_by,
          rejected_at: refund.approved_at,
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
   * Bulk process refunds
   * 
   * POST /admin/refunds/bulk/process
   * 
   * Body:
   * - refund_ids: Array of refund UUIDs to process
   * - notes: Optional notes for all refunds
   * 
   * Response:
   * {
   *   successful: [ "id1", "id2" ],
   *   failed: [ { id: "id3", error: "reason" } ],
   *   summary: { total: 3, approved: 2, failed: 1 }
   * }
   * 
   * Audit: Each refund logged individually as MANUAL_FINANCIAL_ADJUSTMENT
   * Transactions: All-or-partial processed (failed items don't block others)
   */
  @Post('bulk/process')
  async bulkProcessRefunds(
    @GetUser() admin: JwtPayload,
    @Body() body: BulkProcessRefundsDto,
  ) {
    try {
      if (!body.refund_ids || body.refund_ids.length === 0) {
        throw new BadRequestException('refund_ids array is required and must not be empty');
      }

      const result = await this.adminPaymentService.bulkProcessRefunds(
        body.refund_ids,
        admin.userId,
        body.notes || 'Bulk processing by admin',
      );

      return {
        success: true,
        message: `Bulk refund processing complete: ${result.summary.approved} approved, ${result.summary.failed} failed`,
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
   * Bulk reject refunds
   * 
   * POST /admin/refunds/bulk/reject
   * 
   * Body:
   * - refund_ids: Array of refund UUIDs to reject
   * - rejection_reason: Reason for rejection (required, min 10 chars)
   * 
   * Response:
   * {
   *   successful: [ "id1", "id2" ],
   *   failed: [ { id: "id3", error: "reason" } ],
   *   summary: { total: 3, rejected: 2, failed: 1 }
   * }
   */
  @Post('bulk/reject')
  async bulkRejectRefunds(
    @GetUser() admin: JwtPayload,
    @Body() body: BulkRejectRefundsDto,
  ) {
    try {
      if (!body.refund_ids || body.refund_ids.length === 0) {
        throw new BadRequestException('refund_ids array is required and must not be empty');
      }

      if (!body.rejection_reason || body.rejection_reason.length < 10) {
        throw new BadRequestException('rejection_reason is required (min 10 characters)');
      }

      const result = await this.adminPaymentService.bulkRejectRefunds(
        body.refund_ids,
        admin.userId,
        body.rejection_reason,
      );

      return {
        success: true,
        message: `Bulk refund rejection complete: ${result.summary.rejected} rejected, ${result.summary.failed} failed`,
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
   * Get refund stats
   * 
   * GET /admin/refunds/stats
   * 
   * Returns overview of refund processing:
   * - Total pending refunds
   * - Total amount pending
   * - Average processing time
   * - Recent refunds by status
   */
  @Get('stats')
  async getRefundStats() {
    try {
      // This would query the refund repository for stats
      // For now, returning a placeholder
      return {
        success: true,
        data: {
          pending_count: 0,
          pending_amount: 0,
          approved_today: 0,
          rejected_today: 0,
          average_processing_hours: 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

