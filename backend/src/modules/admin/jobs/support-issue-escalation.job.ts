import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SupportIssue, SupportIssueStatusEnum } from '../entities/support-issue.entity';
import { SupportIssueService } from '../services/support-issue.service';

/**
 * SupportIssueEscalationJob
 *
 * Automatically escalates old unresolved support issues:
 * - Issues OPEN without assignment for 24h → escalate to CRITICAL
 * - Issues ASSIGNED without progress for 48h → escalate to CRITICAL
 * - Notify admins of escalated issues
 *
 * Runs every 6 hours
 */
@Injectable()
export class SupportIssueEscalationJob {
  private readonly logger = new Logger(SupportIssueEscalationJob.name);

  constructor(
    @InjectRepository(SupportIssue)
    private issueRepository: Repository<SupportIssue>,
    private supportIssueService: SupportIssueService,
  ) {}

  /**
   * Run escalation job every 6 hours
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleEscalation() {
    try {
      this.logger.log('🚨 Starting support issue escalation job');

      // Escalate OPEN issues older than 24 hours
      const openThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldOpenIssues = await this.issueRepository.find({
        where: {
          status: SupportIssueStatusEnum.OPEN,
          created_at: LessThan(openThreshold),
        },
      });

      for (const issue of oldOpenIssues) {
        try {
          await this.supportIssueService.escalateIssue(
            issue.id,
            'Unresolved for 24+ hours',
          );
          this.logger.log(
            `⬆️ Escalated OPEN issue ${issue.id} to CRITICAL after 24h`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to escalate issue ${issue.id}: ${error.message}`,
          );
        }
      }

      // Escalate ASSIGNED issues older than 48 hours without progress
      const assignedThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const oldAssignedIssues = await this.issueRepository.find({
        where: {
          status: SupportIssueStatusEnum.ASSIGNED,
          created_at: LessThan(assignedThreshold),
        },
      });

      for (const issue of oldAssignedIssues) {
        try {
          await this.supportIssueService.escalateIssue(
            issue.id,
            'No progress for 48+ hours',
          );
          this.logger.log(
            `⬆️ Escalated ASSIGNED issue ${issue.id} to CRITICAL after 48h`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to escalate issue ${issue.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Support issue escalation complete: ${oldOpenIssues.length} OPEN + ${oldAssignedIssues.length} ASSIGNED issues escalated`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Support issue escalation job failed: ${error.message}`,
      );
    }
  }
}
