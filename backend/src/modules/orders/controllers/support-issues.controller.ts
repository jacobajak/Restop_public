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
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { SupportIssueService } from '../../admin/services/support-issue.service';
import { SupportIssueTypeEnum, SupportIssueSeverityEnum } from '../../admin/entities/support-issue.entity';

/**
 * SupportIssuesController - Customer-facing support ticket management
 *
 * Allows customers (merchants) to:
 * - Create support tickets for orders, payments, settlements
 * - View their own support tickets
 * - View ticket status and resolution
 *
 * POST /support/issues - Create new support ticket
 * GET /support/issues - List tenant's support tickets
 * GET /support/issues/:id - Get ticket details
 */
@Controller('support/issues')
@UseGuards(JwtAuthGuard)
export class SupportIssuesController {
  constructor(
    private readonly supportIssueService: SupportIssueService,
  ) {}

  /**
   * Create a new support issue for tenant
   *
   * Body:
   * - issue_type: PAYMENT_ISSUE, SETTLEMENT_ISSUE, ORDER_ISSUE, etc.
   * - severity: LOW, MEDIUM, HIGH, CRITICAL
   * - subject: Brief title
   * - description: Detailed description
   * - related_order_id?: Order ID (if applicable)
   * - related_payment_id?: Payment ID (if applicable)
   * - related_settlement_id?: Settlement ID (if applicable)
   */
  @Post()
  async createSupportIssue(
    @GetUser() user: JwtPayload,
    @Body()
    body: {
      issue_type: SupportIssueTypeEnum;
      severity: SupportIssueSeverityEnum;
      subject: string;
      description: string;
      related_order_id?: string;
      related_payment_id?: string;
      related_settlement_id?: string;
    },
  ) {
    try {
      // Validate required fields
      if (!body.issue_type || !body.severity || !body.subject || !body.description) {
        throw new BadRequestException(
          'Missing required fields: issue_type, severity, subject, description',
        );
      }

      // Validate severity levels
      if (!Object.values(SupportIssueSeverityEnum).includes(body.severity)) {
        throw new BadRequestException('Invalid severity level');
      }

      if (!Object.values(SupportIssueTypeEnum).includes(body.issue_type)) {
        throw new BadRequestException('Invalid issue type');
      }

      const issue = await this.supportIssueService.createIssue({
        tenant_id: user.tenantId,
        issue_type: body.issue_type,
        severity: body.severity,
        subject: body.subject,
        description: body.description,
        related_order_id: body.related_order_id,
        related_payment_id: body.related_payment_id,
        related_settlement_id: body.related_settlement_id,
      });

      return {
        success: true,
        data: {
          id: issue.id,
          status: issue.status,
          severity: issue.severity,
          subject: issue.subject,
          created_at: issue.created_at,
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
   * List support issues for tenant
   *
   * Query parameters:
   * - status: Filter by status (OPEN, ASSIGNED, INVESTIGATING, RESOLVED, CLOSED)
   * - severity: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get()
  async listSupportIssues(
    @GetUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.supportIssueService.listIssues({
        tenant_id: user.tenantId,
        status: status as any,
        severity: severity as any,
        limit,
        offset,
      });

      return {
        success: true,
        data: {
          issues: result.data.map((issue) => ({
            id: issue.id,
            issue_type: issue.issue_type,
            severity: issue.severity,
            status: issue.status,
            subject: issue.subject,
            description: issue.description,
            assigned_admin_id: issue.assigned_admin_id,
            resolution_notes: issue.resolution_notes,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            resolved_at: issue.resolved_at,
          })),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
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
   * Get support issue details
   */
  @Get(':id')
  async getSupportIssue(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    try {
      const issue = await this.supportIssueService.getIssue(id);

      if (!issue) {
        throw new BadRequestException('Issue not found');
      }

      // Ensure tenant can only view their own issues
      if (issue.tenant_id !== user.tenantId) {
        throw new BadRequestException('Access denied');
      }

      return {
        success: true,
        data: {
          id: issue.id,
          issue_type: issue.issue_type,
          severity: issue.severity,
          status: issue.status,
          subject: issue.subject,
          description: issue.description,
          related_order_id: issue.related_order_id,
          related_payment_id: issue.related_payment_id,
          related_settlement_id: issue.related_settlement_id,
          assigned_admin_id: issue.assigned_admin_id,
          resolution_notes: issue.resolution_notes,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          resolved_at: issue.resolved_at,
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
