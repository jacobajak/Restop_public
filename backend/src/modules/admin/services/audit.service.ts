import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditActionEnum } from '../entities/audit-log.entity';
import { Request } from 'express';

export interface CreateAuditLogDto {
  admin_user_id: string;
  action_type: AuditActionEnum;
  reference_type: string;
  reference_id: string;
  before_state_json?: Record<string, any>;
  after_state_json?: Record<string, any>;
  metadata_json?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * AuditService - Comprehensive audit logging for platform actions
 *
 * Logs all sensitive actions for compliance, debugging, and dispute resolution.
 *
 * Usage:
 * await auditService.log({
 *   admin_user_id: user.id,
 *   action_type: AuditActionEnum.RESTAURANT_SUSPENDED,
 *   reference_type: 'restaurant',
 *   reference_id: restaurant.id,
 *   before_state_json: { status: 'ACTIVE' },
 *   after_state_json: { status: 'SUSPENDED' },
 *   metadata_json: { reason: 'Payment account verification failed' },
 * });
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Log a sensitive platform action
   */
  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...dto,
      created_at: new Date(),
    });

    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Log action with request context (IP, user agent)
   */
  async logFromRequest(
    dto: Omit<CreateAuditLogDto, 'ip_address' | 'user_agent'>,
    request: Request,
  ): Promise<AuditLog> {
    const ipAddress = (
      request.headers['x-forwarded-for'] ||
      request.socket.remoteAddress ||
      ''
    ).toString();

    return this.log({
      ...dto,
      ip_address: ipAddress,
      user_agent: request.headers['user-agent'],
    });
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters: {
    admin_user_id?: string;
    action_type?: AuditActionEnum;
    reference_type?: string;
    reference_id?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }) {
    let query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters.admin_user_id) {
      query = query.where('audit.admin_user_id = :admin_user_id', {
        admin_user_id: filters.admin_user_id,
      });
    }

    if (filters.action_type) {
      query = query.andWhere('audit.action_type = :action_type', {
        action_type: filters.action_type,
      });
    }

    if (filters.reference_type) {
      query = query.andWhere('audit.reference_type = :reference_type', {
        reference_type: filters.reference_type,
      });
    }

    if (filters.reference_id) {
      query = query.andWhere('audit.reference_id = :reference_id', {
        reference_id: filters.reference_id,
      });
    }

    if (filters.start_date) {
      query = query.andWhere('audit.created_at >= :start_date', {
        start_date: filters.start_date,
      });
    }

    if (filters.end_date) {
      query = query.andWhere('audit.created_at <= :end_date', {
        end_date: filters.end_date,
      });
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    query = query.orderBy('audit.created_at', 'DESC').take(limit).skip(offset);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getAuditLogsForEntity(
    reference_type: string,
    reference_id: string,
    limit: number = 20,
  ) {
    return this.auditLogRepository.find({
      where: { reference_type, reference_id },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recent admin actions
   */
  async getRecentActions(limit: number = 50) {
    return this.auditLogRepository.find({
      order: { created_at: 'DESC' },
      take: limit,
      relations: ['admin_user'],
    });
  }
}
