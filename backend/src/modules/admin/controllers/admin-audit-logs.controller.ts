import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * AdminAuditLogsController - View comprehensive audit trail
 *
 * Allows platform admins to:
 * - View audit logs for all platform actions
 * - Filter by action type, reference, admin user, date range
 * - View entity state changes
 * - Track sensitive operations
 *
 * GET /admin/audit-logs - List audit logs
 * GET /admin/audit-logs/:id - Get audit log detail
 */
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Get audit logs with filtering
   *
   * Query parameters:
   * - action_type: Filter by action (see AuditActionEnum)
   * - reference_type: Filter by entity type
   * - reference_id: Filter by entity ID
   * - admin_user_id: Filter by admin who performed action
   * - from_date: Start date (ISO 8601)
   * - to_date: End date (ISO 8601)
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get()
  async listAuditLogs(
    @Query('action_type') action_type?: AuditActionEnum,
    @Query('reference_type') reference_type?: string,
    @Query('reference_id') reference_id?: string,
    @Query('admin_user_id') admin_user_id?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.auditService.getAuditLogs({
        action_type,
        reference_type,
        reference_id,
        admin_user_id,
        start_date: fromDate ? new Date(fromDate) : undefined,
        end_date: toDate ? new Date(toDate) : undefined,
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
   * Get audit logs for a specific entity
   *
   * Shows complete audit trail of an entity (before/after states)
   */
  @Get(':reference_type/:reference_id')
  async getEntityAuditTrail(
    @Param('reference_type') reference_type: string,
    @Param('reference_id') reference_id: string,
    @Query('limit') limit: number = 20,
  ) {
    try {
      const logs = await this.auditService.getAuditLogsForEntity(
        reference_type,
        reference_id,
        limit,
      );

      return {
        success: true,
        data: {
          reference_type,
          reference_id,
          audit_trail: logs,
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
