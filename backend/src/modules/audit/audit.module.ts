import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './services/audit.service';

/**
 * AuditModule - Independent audit logging system
 *
 * This module is completely independent and has no dependencies on other app modules.
 * It provides AuditService for comprehensive action logging across the platform.
 *
 * Features:
 * - Centralized audit trail
 * - Compliance tracking
 * - Action logging with before/after state
 * - Request context capture (IP, user agent)
 * - Query and filtering of audit logs
 *
 * Used by:
 * - AdminModule (for admin actions)
 * - PaymentsModule (for financial operations)
 * - Any other module needing audit trails
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
