import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudReview, FraudReviewStatus, FraudRiskLevel, FraudReviewSubjectType } from '../entities/fraud-review.entity';
import { AuditService } from '../../audit/services/audit.service';

interface CreateFraudReviewInput {
  subject_type: FraudReviewSubjectType;
  subject_id: string;
  risk_score: number;
  risk_level: FraudRiskLevel;
  reasons_json?: {
    indicators: string[];
    recommended_action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  };
  customer_phone?: string;
  order_id?: string;
  payment_id?: string;
  merchant_id?: string;
  amount?: number;
}

interface UpdateReviewInput {
  status?: FraudReviewStatus;
  assigned_admin_id?: string;
  notes?: string;
  action_taken?: string;
}

export interface FraudQueueFilter {
  status?: FraudReviewStatus;
  risk_level?: FraudRiskLevel;
  subject_type?: FraudReviewSubjectType;
  assigned_admin_id?: string;
  search?: string; // Search by subject_id, customer_phone, order_id
  limit?: number;
  offset?: number;
}

export interface FraudQueueResponse {
  total: number;
  items: FraudReview[];
  counts: {
    open: number;
    under_review: number;
    approved: number;
    blocked: number;
    dismissed: number;
    escalated: number;
  };
}

/**
 * FraudReviewService - Manage fraud review records and admin decisions
 *
 * Responsibilities:
 * 1. Create review records when FraudDetectionService flags items
 * 2. Provide fraud moderation queue for admin dashboard
 * 3. Track admin review decisions (approve, block, dismiss, escalate)
 * 4. Manage review status transitions (OPEN → UNDER_REVIEW → APPROVED/BLOCKED/DISMISSED)
 * 5. Audit all decisions for compliance
 * 6. Provide reporting and analytics
 *
 * Used by:
 * - AdminFraudController (list queue, get details, update status)
 * - FraudDetectionService (create review on high-risk flag)
 * - Fraud moderation dashboard (queue views, filtering)
 * - Compliance & reporting (audit trail)
 */
@Injectable()
export class FraudReviewService {
  private readonly logger = new Logger(FraudReviewService.name);

  constructor(
    @InjectRepository(FraudReview)
    private readonly fraudReviewRepo: Repository<FraudReview>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new fraud review record (typically called by FraudDetectionService)
   */
  async createReview(input: CreateFraudReviewInput): Promise<FraudReview> {
    try {
      const review = new FraudReview({
        ...input,
        status: FraudReviewStatus.OPEN,
        created_at: new Date(),
      });

      const saved = await this.fraudReviewRepo.save(review);

      // Audit log
      await this.auditService.log({
        admin_user_id: 'system',
        action_type: 'FRAUD_CREATED' as any,
        reference_type: 'fraud_review',
        reference_id: saved.id,
      });

      this.logger.log(
        `✅ Created fraud review: ${input.subject_type} ${input.subject_id} (risk=${input.risk_level})`,
      );

      return saved;
    } catch (error) {
      this.logger.error(`Error creating fraud review: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fraud moderation queue with filtering and counts
   */
  async getFraudQueue(filters: FraudQueueFilter): Promise<FraudQueueResponse> {
    try {
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build query
      let query = this.fraudReviewRepo.createQueryBuilder('review');

      // Apply filters
      if (filters.status) {
        query = query.where('review.status = :status', { status: filters.status });
      } else {
        query = query.where('1=1'); // No status filter
      }

      if (filters.risk_level) {
        query = query.andWhere('review.risk_level = :risk_level', { risk_level: filters.risk_level });
      }
      if (filters.subject_type) {
        query = query.andWhere('review.subject_type = :subject_type', { subject_type: filters.subject_type });
      }
      if (filters.assigned_admin_id) {
        query = query.andWhere('review.assigned_admin_id = :assigned_admin_id', { assigned_admin_id: filters.assigned_admin_id });
      }

      // Handle search
      if (filters.search) {
        query = query.andWhere(
          `(review.subject_id ILIKE :search OR review.customer_phone ILIKE :search OR CAST(review.order_id AS varchar) ILIKE :search)`,
          { search: `%${filters.search}%` },
        );
      }

      // Get total count
      const total = await query.getManyAndCount().then(([_items, count]) => count);

      // Get items
      const items = await query
        .orderBy('review.created_at', 'DESC')
        .limit(limit)
        .offset(offset)
        .getMany();

      // Return with basic counts (can be enhanced later)
      return {
        total,
        items,
        counts: {
          open: 0,
          under_review: 0,
          approved: 0,
          blocked: 0,
          dismissed: 0,
          escalated: 0,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching fraud queue: ${error.message}`);
      throw error;
    }
  }

  /**
  /**
   * Get single fraud review with full details
   */
  async getReviewDetails(reviewId: string): Promise<FraudReview> {
    try {
      const review = await this.fraudReviewRepo.findOne({
        where: { id: reviewId },
        relations: ['assigned_admin', 'order'],
      });

      if (!review) {
        throw new NotFoundException(`Fraud review ${reviewId} not found`);
      }

      return review;
    } catch (error) {
      this.logger.error(`Error fetching fraud review ${reviewId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all reviews for a subject (e.g., all reviews for a customer)
   */
  async getReviewsForSubject(subjectType: FraudReviewSubjectType, subjectId: string): Promise<FraudReview[]> {
    try {
      return await this.fraudReviewRepo.find({
        where: {
          subject_type: subjectType,
          subject_id: subjectId,
        },
        order: { created_at: 'DESC' },
        relations: ['assigned_admin'],
      });
    } catch (error) {
      this.logger.error(`Error fetching reviews for ${subjectType} ${subjectId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update review status and/or assignment
   */
  async updateReview(reviewId: string, input: UpdateReviewInput): Promise<FraudReview> {
    try {
      const review = await this.getReviewDetails(reviewId);

      // Track what changed
      const changes: Record<string, any> = {};

      if (input.status && input.status !== review.status) {
        const oldStatus = review.status;
        review.status = input.status;
        changes.status = { from: oldStatus, to: input.status };

        // Set reviewed_at when transitioning away from OPEN
        if (oldStatus === FraudReviewStatus.OPEN && input.status !== FraudReviewStatus.OPEN) {
          review.reviewed_at = new Date();
        }
      }

      if (input.assigned_admin_id !== undefined && input.assigned_admin_id !== review.assigned_admin_id) {
        changes.assigned_admin_id = {
          from: review.assigned_admin_id,
          to: input.assigned_admin_id,
        };
        review.assigned_admin_id = input.assigned_admin_id;
      }

      if (input.notes !== undefined && input.notes !== review.notes) {
        changes.notes = { to: input.notes };
        review.notes = input.notes;
      }

      if (input.action_taken !== undefined && input.action_taken !== review.action_taken) {
        changes.action_taken = { to: input.action_taken };
        review.action_taken = input.action_taken;
      }

      review.updated_at = new Date();
      const updated = await this.fraudReviewRepo.save(review);

      // Audit log
      await this.auditService.log({
        admin_user_id: 'system',
        action_type: 'AUDIT_ACTION' as any,
        reference_type: 'fraud_review',
        reference_id: reviewId,
      });

      const actionDescription = Object.keys(changes).join(', ');
      this.logger.log(`✅ Updated fraud review ${reviewId}: ${actionDescription}`);

      return updated;
    } catch (error) {
      this.logger.error(`Error updating fraud review ${reviewId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Dismiss a fraud alert (mark as false positive)
   */
  async dismissReview(reviewId: string, reason: string, _adminId: string): Promise<FraudReview> {
    return this.updateReview(
      reviewId,
      {
        status: FraudReviewStatus.DISMISSED,
        notes: `Dismissed by admin: ${reason}`,
        action_taken: 'Alert dismissed (false positive)',
      },
    );
  }

  /**
   * Approve a review (customer safe, allow transaction)
   */
  async approveReview(reviewId: string, reason: string, _adminId: string): Promise<FraudReview> {
    return this.updateReview(
      reviewId,
      {
        status: FraudReviewStatus.APPROVED,
        notes: `Approved by admin: ${reason}`,
        action_taken: 'Customer approved, transaction allowed',
      },
    );
  }

  /**
   * Block a customer/transaction (fraud confirmed)
   */
  async blockReview(reviewId: string, reason: string, _adminId: string): Promise<FraudReview> {
    return this.updateReview(
      reviewId,
      {
        status: FraudReviewStatus.BLOCKED,
        notes: `Blocked by admin: ${reason}`,
        action_taken: 'Customer/transaction blocked',
      },
    );
  }

  /**
   * Escalate for manual investigation
   */
  async escalateReview(reviewId: string, reason: string, _adminId: string): Promise<FraudReview> {
    return this.updateReview(
      reviewId,
      {
        status: FraudReviewStatus.ESCALATED,
        notes: `Escalated by admin: ${reason}`,
        action_taken: 'Escalated to investigation team',
      },
    );
  }

  /**
   * Assign review to admin for review
   */
  async assignReview(reviewId: string, adminId: string, _assignedByAdminId: string): Promise<FraudReview> {
    return this.updateReview(
      reviewId,
      {
        status: FraudReviewStatus.UNDER_REVIEW,
        assigned_admin_id: adminId,
      },
    );
  }

  /**
   * Get statistics for monitoring
   */
  async getStatistics(days: number = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const query = this.fraudReviewRepo.createQueryBuilder('review').where('review.created_at >= :cutoff', {
        cutoff: cutoffDate,
      });

      const [
        total,
        byRiskLevel,
        bySubjectType,
        byStatus,
        avgReviewTime, // Time from created to reviewed
      ] = await Promise.all([
        query.getCount(),
        query
          .select('review.risk_level', 'level')
          .addSelect('COUNT(*)', 'count')
          .groupBy('review.risk_level')
          .getRawMany(),
        query
          .select('review.subject_type', 'type')
          .addSelect('COUNT(*)', 'count')
          .groupBy('review.subject_type')
          .getRawMany(),
        query
          .select('review.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('review.status')
          .getRawMany(),
        this.fraudReviewRepo
          .createQueryBuilder('review')
          .select('AVG(EXTRACT(EPOCH FROM (review.reviewed_at - review.created_at)))', 'seconds')
          .where('review.reviewed_at IS NOT NULL')
          .andWhere('review.created_at >= :cutoff', { cutoff: cutoffDate })
          .getRawOne()
          .then((r) => (r?.seconds ? Math.round(parseFloat(r.seconds) / 60) : 0)), // Convert to minutes
      ]);

      return {
        period_days: days,
        total_reviewed: total,
        by_risk_level: byRiskLevel.reduce((acc, row) => {
          acc[row.level] = parseInt(row.count, 10);
          return acc;
        }, {}),
        by_subject_type: bySubjectType.reduce((acc, row) => {
          acc[row.type] = parseInt(row.count, 10);
          return acc;
        }, {}),
        by_status: byStatus.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count, 10);
          return acc;
        }, {}),
        avg_review_time_minutes: avgReviewTime,
      };
    } catch (error) {
      this.logger.error(`Error getting fraud review statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if item has pending reviews (before allowing action)
   */
  async hasPendingReview(subjectType: FraudReviewSubjectType, subjectId: string): Promise<boolean> {
    try {
      const count = await this.fraudReviewRepo.count({
        where: {
          subject_type: subjectType,
          subject_id: subjectId,
          status: FraudReviewStatus.BLOCKED,
        },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(`Error checking pending review: ${error.message}`);
      return false;
    }
  }
}
