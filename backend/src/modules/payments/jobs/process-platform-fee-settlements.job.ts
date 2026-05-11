import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { PlatformFeeSettlementService } from '../services/platform-fee-settlement.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * Platform Fee Settlement Processing Job
 *
 * Background job that:
 * 1. Processes confirmed settlements (CONFIRMED → SETTLED)
 * 2. Resets platform fee counters on tenants
 * 3. Updates payment accounting records
 * 4. Logs all actions for audit trail
 *
 * Runs on schedule:
 * - Every hour during business hours (6 AM - 10 PM)
 * - Processes batches of 50 confirmations at a time
 * - Can be triggered manually via admin endpoint
 */
@Injectable()
export class ProcessPlatformFeeSettlementsJob {
  private readonly logger = new Logger(ProcessPlatformFeeSettlementsJob.name);

  constructor(
    private readonly settlementService: PlatformFeeSettlementService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Main scheduled job - runs hourly during business hours
   * Processes batches of confirmed settlements
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processSettlements(): Promise<void> {
    this.logger.debug('Starting platform fee settlement processing job...');

    try {
      const result = await this.settlementService.processConfirmedSettlements();

      if (result.processed > 0) {
        this.logger.log(
          `Successfully processed ${result.processed} settlements. ` +
          `Total amount: ${result.total_amount}. ` +
          `Failed: ${result.failed}`
        );

        // Log to audit trail
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.PLATFORM_FEE_SETTLEMENT_SETTLED,
          reference_type: 'PlatformFeeSettlement',
          reference_id: 'batch-processing-' + Date.now(),
          metadata_json: {
            processed: result.processed,
            total_amount: result.total_amount,
            failed: result.failed,
          },
        });
      } else {
        this.logger.debug('No confirmed settlements to process');
      }
    } catch (error) {
      this.logger.error(
        `Failed to process platform fee settlements: ${error.message}`,
        error.stack
      );

      // Log error to audit trail
      try {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.PLATFORM_FEE_SETTLEMENT_SETTLED,
          reference_type: 'PlatformFeeSettlement',
          reference_id: 'batch-processing-error',
          metadata_json: {
            error_message: error.message,
            error_stack: error.stack,
          },
        });
      } catch (auditError) {
        this.logger.error('Failed to log error to audit trail', auditError);
      }
    }
  }

  /**
   * Manual trigger endpoint - allows admins to force settlement processing
   * Useful if job fails or needs to be run outside normal schedule
   */
  async forceProcess(): Promise<any> {
    this.logger.log('Manual force processing of platform fee settlements initiated');

    try {
      const result = await this.settlementService.processConfirmedSettlements();

      await this.auditService.log({
        admin_user_id: 'manual-trigger',
        action_type: AuditActionEnum.PLATFORM_FEE_SETTLEMENT_SETTLED,
        reference_type: 'PlatformFeeSettlement',
        reference_id: 'batch-processing-manual-' + Date.now(),
        metadata_json: {
          processed: result.processed,
          total_amount: result.total_amount,
          failed: result.failed,
          reason: 'Manual force trigger by admin',
        },
      });

      return {
        success: true,
        message: 'Settlement processing completed',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Manual settlement processing failed: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check endpoint - shows job status
   */
  async getJobStatus(): Promise<any> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();

      try {
        await queryRunner.connect();
        await queryRunner.query('SELECT 1');

        // Get stats on pending processing
        const confirmedCount = await queryRunner.query(
          `SELECT COUNT(*) as count FROM "platform_fee_settlement" 
           WHERE status = 'CONFIRMED'`
        );

        const lastProcessed = await queryRunner.query(
          `SELECT confirmed_at, COUNT(*) as count 
           FROM "platform_fee_settlement"
           WHERE status = 'SETTLED'
           GROUP BY confirmed_at
           ORDER BY confirmed_at DESC
           LIMIT 1`
        );

        return {
          success: true,
          job_name: 'ProcessPlatformFeeSettlementsJob',
          status: 'healthy',
          awaiting_processing: confirmedCount[0]?.count || 0,
          last_batch_processed: lastProcessed[0] || null,
          last_run: new Date().toISOString(),
          schedule: 'Every hour during business hours',
          database_connection: 'healthy',
        };
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return {
        success: false,
        job_name: 'ProcessPlatformFeeSettlementsJob',
        status: 'error',
        error_message: error.message,
        database_connection: 'failed',
      };
    }
  }
}
