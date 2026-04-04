import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { SupportIssueService } from '../services/support-issue.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../entities/audit-log.entity';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';

/**
 * AdminSupportController - Manage support issues and operational problems
 *
 * Allows platform admins to:
 * - View all support issues
 * - Filter by status, severity, restaurant, assigned admin
 * - View issue details with related order/payment/settlement
 * - Assign issues to admins
 * - Resolve issues
 *
 * GET /admin/support/issues - List support issues
 * GET /admin/support/issues/:id - Get issue details
 * PATCH /admin/support/issues/:id/assign - Assign to admin
 * PATCH /admin/support/issues/:id/resolve - Mark as resolved
 */
@Controller('admin/support')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSupportController {
  constructor(
    private readonly supportIssueService: SupportIssueService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get all support issues with filtering
   *
   * Query parameters:
   * - status: Filter by status (OPEN, ASSIGNED, INVESTIGATING, RESOLVED, CLOSED)
   * - severity: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
   * - restaurant_id: Filter by affected restaurant
   * - assigned_admin_id: Filter by assigned admin
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get('issues')
  async listIssues(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('restaurant_id') restaurant_id?: string,
    @Query('assigned_admin_id') assigned_admin_id?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.supportIssueService.listIssues({
        tenant_id: restaurant_id,
        status: status as any,
        severity: severity as any,
        assigned_admin_id,
        limit,
        offset,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get support issue details
   */
  @Get('issues/:id')
  async getIssue(@Param('id') id: string) {
    try {
      const issue = await this.supportIssueService.getIssue(id);
      if (!issue) {
        throw new BadRequestException('Issue not found');
      }

      return {
        success: true,
        data: issue,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Assign support issue to admin
   */
  @Patch('issues/:id/assign')
  async assignIssue(
    @Param('id') id: string,
    @Body('admin_id') admin_id: string,
    @GetUser() user: JwtPayload,
  ) {
    try {
      const issue = await this.supportIssueService.assignIssue(id, admin_id);

      // Log audit event
      await this.auditService.log({
        admin_user_id: user.userId,
        action_type: AuditActionEnum.SUPPORT_ISSUE_ASSIGNED,
        reference_type: 'support_issue',
        reference_id: id,
        metadata_json: { assigned_to: admin_id },
      });

      return {
        success: true,
        data: issue,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resolve support issue
   */
  @Patch('issues/:id/resolve')
  async resolveIssue(
    @Param('id') id: string,
    @Body('resolution_notes') resolution_notes: string,
    @GetUser() user: JwtPayload,
  ) {
    try {
      const issue = await this.supportIssueService.resolveIssue(
        id,
        resolution_notes,
      );

      // Log audit event
      await this.auditService.log({
        admin_user_id: user.userId,
        action_type: AuditActionEnum.SUPPORT_ISSUE_RESOLVED,
        reference_type: 'support_issue',
        reference_id: id,
        metadata_json: { resolution_notes },
      });

      return {
        success: true,
        data: issue,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get open issues summary
   */
  @Get('summary/open')
  async getOpenIssuesSummary() {
    try {
      const total = await this.supportIssueService.getOpenIssuesCount();
      const critical =
        await this.supportIssueService.getOpenIssuesCount('CRITICAL' as any);
      const high = await this.supportIssueService.getOpenIssuesCount('HIGH' as any);

      return {
        success: true,
        data: {
          total_open: total,
          critical: critical,
          high: high,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
