import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportIssue, SupportIssueStatusEnum, SupportIssueSeverityEnum } from '../entities/support-issue.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';
import { NotificationsService } from '../../notifications/notifications.service';

export interface CreateSupportIssueDto {
  tenant_id: string;
  issue_type: string;
  severity: SupportIssueSeverityEnum;
  subject: string;
  description: string;
  related_order_id?: string;
  related_payment_id?: string;
  related_settlement_id?: string;
}

export interface UpdateSupportIssueDto {
  assigned_admin_id?: string;
  status?: SupportIssueStatusEnum;
  severity?: SupportIssueSeverityEnum;
  resolution_notes?: string;
}

/**
 * SupportIssueService - Manage support tickets and operational issues
 *
 * Handles:
 * - Creating support issues for problem tracking
 * - Assigning issues to admins
 * - Tracking resolution status
 * - Audit trail of support actions
 * - WebSocket notifications to admins for new issues
 */
@Injectable()
export class SupportIssueService {
  private readonly logger = new Logger(SupportIssueService.name);

  constructor(
    @InjectRepository(SupportIssue) private issueRepository: Repository<SupportIssue>,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new support issue
   */
  async createIssue(dto: CreateSupportIssueDto): Promise<SupportIssue> {
    const issue = this.issueRepository.create({
      tenant_id: dto.tenant_id,
      issue_type: dto.issue_type,
      severity: dto.severity,
      subject: dto.subject,
      description: dto.description,
      related_order_id: dto.related_order_id,
      related_payment_id: dto.related_payment_id,
      related_settlement_id: dto.related_settlement_id,
      status: SupportIssueStatusEnum.OPEN,
    } as any);

    const createdIssue = await this.issueRepository.save(issue as any) as SupportIssue;

    // Log issue creation for audit trail
    try {
      await this.auditService.log({
        admin_user_id: dto.tenant_id, // Use tenant as creator for customer-initiated issues
        action_type: AuditActionEnum.SUPPORT_ISSUE_CREATED,
        reference_type: 'support_issue',
        reference_id: createdIssue.id,
        metadata_json: {
          issue_type: dto.issue_type,
          severity: dto.severity,
          related_order_id: dto.related_order_id,
          related_payment_id: dto.related_payment_id,
          related_settlement_id: dto.related_settlement_id,
        },
      });
    } catch (auditError: any) {
      // Log but don't fail if audit logging fails
      console.error('Failed to log support issue creation audit:', auditError.message);
    }

    // Emit WebSocket event for admins
    try {
      this.notificationsService.notifyAdminSupportCreated(createdIssue);
    } catch (wsError: any) {
      // Log but don't fail if WebSocket emit fails
      console.error('Failed to emit support issue WebSocket event:', wsError.message);
    }

    return createdIssue;
  }

  /**
   * Get issue by ID
   */
  async getIssue(id: string): Promise<SupportIssue | null> {
    return this.issueRepository.findOne({
      where: { id },
      relations: ['tenant', 'assigned_admin'],
    });
  }

  /**
   * List issues with filtering
   */
  async listIssues(filters: {
    tenant_id?: string;
    status?: SupportIssueStatusEnum;
    severity?: SupportIssueSeverityEnum;
    assigned_admin_id?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = this.issueRepository.createQueryBuilder('issue');

    if (filters.tenant_id) {
      query = query.where('issue.tenant_id = :tenant_id', {
        tenant_id: filters.tenant_id,
      });
    }

    if (filters.status) {
      query = query.andWhere('issue.status = :status', { status: filters.status });
    }

    if (filters.severity) {
      query = query.andWhere('issue.severity = :severity', {
        severity: filters.severity,
      });
    }

    if (filters.assigned_admin_id) {
      query = query.andWhere('issue.assigned_admin_id = :assigned_admin_id', {
        assigned_admin_id: filters.assigned_admin_id,
      });
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    query = query
      .orderBy('issue.severity', 'DESC')
      .addOrderBy('issue.created_at', 'DESC')
      .take(limit)
      .skip(offset);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * Update support issue
   */
  async updateIssue(id: string, dto: UpdateSupportIssueDto): Promise<SupportIssue> {
    const issue = await this.getIssue(id);
    if (!issue) {
      throw new Error('Issue not found');
    }

    if (dto.assigned_admin_id !== undefined) {
      issue.assigned_admin_id = dto.assigned_admin_id;
    }

    if (dto.status !== undefined) {
      issue.status = dto.status;

      // Set resolved_at when resolving
      if (
        dto.status === SupportIssueStatusEnum.RESOLVED ||
        dto.status === SupportIssueStatusEnum.CLOSED
      ) {
        issue.resolved_at = new Date();
      }
    }

    if (dto.severity !== undefined) {
      issue.severity = dto.severity;
    }

    if (dto.resolution_notes !== undefined) {
      issue.resolution_notes = dto.resolution_notes;
    }

    return this.issueRepository.save(issue);
  }

  /**
   * Get open issues count by severity
   */
  async getOpenIssuesCount(severity?: SupportIssueSeverityEnum) {
    let query = this.issueRepository.createQueryBuilder('issue').where(
      'issue.status IN (:...statuses)',
      {
        statuses: [
          SupportIssueStatusEnum.OPEN,
          SupportIssueStatusEnum.ASSIGNED,
          SupportIssueStatusEnum.INVESTIGATING,
        ],
      },
    );

    if (severity) {
      query = query.andWhere('issue.severity = :severity', { severity });
    }

    return query.getCount();
  }

  /**
   * Get issues by restaurant
   */
  async getIssuesByTenant(tenant_id: string, limit: number = 20) {
    return this.issueRepository.find({
      where: { tenant_id },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Assign issue to admin
   */
  async assignIssue(id: string, admin_id: string): Promise<SupportIssue> {
    return this.updateIssue(id, {
      assigned_admin_id: admin_id,
      status: SupportIssueStatusEnum.ASSIGNED,
    });
  }

  /**
   * Resolve issue
   */
  async resolveIssue(id: string, resolution_notes: string): Promise<SupportIssue> {
    return this.updateIssue(id, {
      status: SupportIssueStatusEnum.RESOLVED,
      resolution_notes,
    });
  }

  /**
   * Escalate support issue to critical and notify admins
   * 
   * Used when:
   * - Issue has been unresolved for 24+ hours (automatic escalation job)
   * - Manual escalation triggered by admin for urgent issues
   * - High-severity issues need immediate attention
   */
  async escalateIssue(id: string, reason?: string): Promise<SupportIssue> {
    const issue = await this.getIssue(id);
    if (!issue) {
      throw new Error('Issue not found');
    }

    // Update severity to CRITICAL
    const escalated = await this.updateIssue(id, {
      severity: SupportIssueSeverityEnum.CRITICAL,
      status: SupportIssueStatusEnum.INVESTIGATING,
    });

    this.logger.log(
      `🚨 Support issue escalated to CRITICAL: id=${id}, reason=${reason}`,
    );

    // Send escalated support issue email to admin (fire-and-forget)
    // NOTE: Email provides durable notification of critical support issues
    try {
      // Placeholder: In production, get admin email from configuration
      // const adminEmail = this.configService.get('ADMIN_SUPPORT_EMAIL');
      // if (adminEmail) {
      //   this.emailService.sendSupportEscalatedEmail(
      //     adminEmail,
      //     'ADMIN_SYSTEM',
      //     'PLATFORM',
      //     id,
      //     {
      //       ticketId: `TKT-${id.substring(0, 8).toUpperCase()}`,
      //       priority: 'CRITICAL',
      //       category: issue.issue_type,
      //       issueDescription: issue.description,
      //       affectedTenant: issue.tenant_id,
      //       escalationReason: reason || 'Unresolved for 24+ hours',
      //       actionRequired: 'Immediate investigation needed',
      //     },
      //   ).catch(err => this.logger.error('Failed to send escalation email:', err));
      // }
    } catch (emailError: any) {
      this.logger.error(`Failed to send escalation email: ${emailError.message}`);
    }

    // Emit WebSocket event for real-time admin notification
    try {
      // this.notificationsService.notifyAdminSupportEscalated(escalated);
    } catch (wsError: any) {
      this.logger.error(
        `Failed to emit escalation WebSocket event: ${wsError.message}`,
      );
    }

    return escalated;
  }
}
