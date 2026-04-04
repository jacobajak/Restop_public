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
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

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
}
