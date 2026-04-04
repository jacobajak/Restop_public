import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { FraudReviewService } from '../../payments/services/fraud-review.service';
import { FraudReviewStatus, FraudRiskLevel, FraudReviewSubjectType } from '../../payments/entities/fraud-review.entity';

/**
 * AdminFraudController - Fraud detection & moderation API
 *
 * Exposes:
 * 1. Fraud moderation queue - List flagged items
 * 2. Detail view - Risk breakdown, reasons, history
 * 3. Admin actions - Review, dismiss, block, escalate
 * 4. Risk assessment - Get risk score for any order/customer
 * 5. Statistics & reporting
 *
 * Protected by @AdminGuard - Platform admins only
 */
@Controller('admin/fraud')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminFraudController {
  constructor(
    private readonly fraudReviewService: FraudReviewService,
  ) {}

  /**
   * GET /admin/fraud/queue
   * Get fraud moderation queue with filters
   *
   * Query parameters:
   * - status: OPEN, UNDER_REVIEW, APPROVED, BLOCKED, DISMISSED, ESCALATED
   * - risk_level: LOW, MEDIUM, HIGH, CRITICAL
   * - subject_type: ORDER, CUSTOMER, PAYMENT, REFUND, MERCHANT
   * - assigned_admin_id: Filter by assigned admin
   * - search: Search by subject_id, customer, order
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   *
   * Response:
   * {
   *   total: 150,
   *   items: [ { id, subject_type, risk_score, risk_level, status, ... } ],
   *   counts: { open: 50, under_review: 30, approved: 40, ... }
   * }
   */
  @Get('queue')
  async getFraudQueue(
    @Query('status') status?: FraudReviewStatus,
    @Query('risk_level') riskLevel?: FraudRiskLevel,
    @Query('subject_type') subjectType?: FraudReviewSubjectType,
    @Query('assigned_admin_id') assignedAdminId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      return await this.fraudReviewService.getFraudQueue({
        status,
        risk_level: riskLevel,
        subject_type: subjectType,
        assigned_admin_id: assignedAdminId,
        search,
        limit,
        offset,
      });
    } catch (error) {
      throw new HttpException(
        `Failed to fetch fraud queue: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /admin/fraud/:id
   * Get fraud review details with full breakdown
   *
   * Response:
   * {
   *   id, subject_type, subject_id, risk_score, risk_level,
   *   reasons_json: { indicators: [], recommended_action },
   *   status, assigned_admin, notes, action_taken,
   *   customer_phone, order_id, amount,
   *   created_at, updated_at, reviewed_at
   * }
   */
  @Get(':id')
  async getReviewDetails(@Param('id') reviewId: string) {
    try {
      return await this.fraudReviewService.getReviewDetails(reviewId);
    } catch (error) {
      throw new HttpException(
        `Failed to fetch fraud review: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * GET /admin/fraud/subject/:type/:id
   * Get all reviews for a subject (e.g., all reviews for a customer)
   *
   * Path params:
   * - type: ORDER, CUSTOMER, PAYMENT, REFUND, MERCHANT
   * - id: Subject ID
   *
   * Response: [ { review1 }, { review2 }, ... ]
   */
  @Get('subject/:type/:id')
  async getReviewsForSubject(
    @Param('type') subjectType: FraudReviewSubjectType,
    @Param('id') subjectId: string,
  ) {
    try {
      return await this.fraudReviewService.getReviewsForSubject(subjectType, subjectId);
    } catch (error) {
      throw new HttpException(
        `Failed to fetch reviews: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /admin/fraud/:id/assign
   * Assign review to admin for review
   *
   * Body: { admin_id: "uuid" }
   * Response: Updated review record
   */
  @Post(':id/assign')
  async assignReview(
    @Param('id') reviewId: string,
    @Body('admin_id') adminId: string,
    @Req() req: any,
  ) {
    try {
      return await this.fraudReviewService.assignReview(reviewId, adminId, req.user.id);
    } catch (error) {
      throw new HttpException(
        `Failed to assign review: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /admin/fraud/:id/dismiss
   * Dismiss fraud alert (mark as false positive)
   *
   * Body: { reason: "string" }
   * Response: Updated review record with status=DISMISSED
   */
  @Post(':id/dismiss')
  async dismissReview(
    @Param('id') reviewId: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    try {
      if (!reason) {
        throw new HttpException(
          'Reason is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.fraudReviewService.dismissReview(reviewId, reason, req.user.id);
    } catch (error) {
      throw new HttpException(
        `Failed to dismiss review: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /admin/fraud/:id/approve
   * Approve review (customer safe, allow transaction)
   *
   * Body: { reason: "string" }
   * Response: Updated review record with status=APPROVED
   */
  @Post(':id/approve')
  async approveReview(
    @Param('id') reviewId: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    try {
      if (!reason) {
        throw new HttpException(
          'Reason is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.fraudReviewService.approveReview(reviewId, reason, req.user.id);
    } catch (error) {
      throw new HttpException(
        `Failed to approve review: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /admin/fraud/:id/block
   * Block customer/transaction (fraud confirmed)
   *
   * Body: { reason: "string" }
   * Response: Updated review record with status=BLOCKED
   *
   * Effect:
   * - Blocks future transactions from customer
   * - May cancel pending orders/refunds
   * - Triggers escalation workflow
   */
  @Post(':id/block')
  async blockReview(
    @Param('id') reviewId: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    try {
      if (!reason) {
        throw new HttpException(
          'Reason is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.fraudReviewService.blockReview(reviewId, reason, req.user.id);
    } catch (error) {
      throw new HttpException(
        `Failed to block review: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /admin/fraud/:id/escalate
   * Escalate for manual investigation
   *
   * Body: { reason: "string" }
   * Response: Updated review record with status=ESCALATED
   *
   * Effect:
   * - Moves to investigation team backlog
   * - Holds transactions pending investigation
   * - Creates forensics task
   */
  @Post(':id/escalate')
  async escalateReview(
    @Param('id') reviewId: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    try {
      if (!reason) {
        throw new HttpException(
          'Reason is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.fraudReviewService.escalateReview(reviewId, reason, req.user.id);
    } catch (error) {
      throw new HttpException(
        `Failed to escalate review: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /admin/fraud/assess/order/:orderId
   * Get risk assessment for a specific order
   *
   * Response:
   * {
   *   risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
   *   risk_score: 0-100,
   *   indicators: [ "reason1", "reason2", ... ],
   *   recommended_action: "ALLOW" | "REVIEW" | "BLOCK"
   * }
   */
  @Get('assess/order/:orderId')
  async assessOrderRisk(
    @Param('orderId') orderId: string,
  ) {
    try {
      // NOTE: This would require Order service to get order context
      // For now, return a placeholder - would be implemented with order details
      return {
        order_id: orderId,
        error: 'Assessment endpoint requires order context - integrate with OrderService',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to assess order risk: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /admin/fraud/stats
   * Get fraud statistics and metrics
   *
   * Query parameters:
   * - days: Number of days to analyze (default 7)
   *
   * Response:
   * {
   *   period_days: 7,
   *   total_reviewed: 150,
   *   by_risk_level: { LOW: 50, MEDIUM: 60, HIGH: 30, CRITICAL: 10 },
   *   by_subject_type: { ORDER: 100, CUSTOMER: 30, ... },
   *   by_status: { OPEN: 20, APPROVED: 80, BLOCKED: 30, ... },
   *   avg_review_time_minutes: 45
   * }
   */
  @Get('stats')
  async getStatistics(@Query('days') days?: number) {
    try {
      return await this.fraudReviewService.getStatistics(days || 7);
    } catch (error) {
      throw new HttpException(
        `Failed to fetch statistics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
