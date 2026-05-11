import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RefundService } from '../services/refund.service';
import { RetryStrategyService } from '../services/retry-strategy.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { GracefulDegradationService, DegradationLevel } from '../services/graceful-degradation.service';
import { RefundRateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { RefundStatusEnum, RefundReasonEnum } from '../entities/refund.entity';

/**
 * RefundController
 * 
 * Exposes refund request, approval, rejection, and listing endpoints.
 * 
 * Customer endpoints:
 * - POST /refunds/request - Request refund for order
 * - GET /refunds/:id - View own refund status
 * 
 * Admin endpoints:
 * - GET /admin/refunds - List refunds with filtering
 * - GET /admin/refunds/:id - View specific refund
 * - POST /admin/refunds/:id/approve - Approve refund
 * - POST /admin/refunds/:id/reject - Reject refund
 * 
 * Integrates resilience patterns:
 * - Retry strategy for Flutterwave refund API calls
 * - Circuit breaker to fail fast if Flutterwave is degraded
 * - Degradation level checks to prevent refunds during outages
 */
@Controller()
export class RefundController {
  private readonly logger = new Logger(RefundController.name);

  constructor(
    private readonly refundService: RefundService,
    private readonly retryStrategy: RetryStrategyService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly degradation: GracefulDegradationService,
  ) {}

  /**
   * Customer: Request refund for an order
   * 
   * POST /refunds/request
   * 
   * Creates a PENDING refund record. Admin must approve to process.
   * 
   * Rate Limiting:
   * - 5 refund requests per hour per user (prevents abuse/spam)
   * 
   * Request Body:
   * {
   *   "order_id": "uuid",
   *   "reason": "CUSTOMER_REQUEST|ORDER_CANCELLED|DUPLICATE_PAYMENT|WRONG_AMOUNT|MERCHANT_ERROR|PAYMENT_FAILED",
   *   "amount"?: number (optional - defaults to order total)
   * }
   * 
   * Response:
   * {
   *   "ok": true,
   *   "refund": {
   *     "id": "uuid",
   *     "order_id": "uuid",
   *     "amount": 50000,
   *     "reason": "CUSTOMER_REQUEST",
   *     "status": "PENDING",
   *     "created_at": "2024-01-15T10:30:00Z"
   *   }
   * }
   */
  @Post('/refunds/request')
  @UseGuards(RefundRateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  async requestRefund(
    @Body()
    body: {
      order_id: string;
      reason: RefundReasonEnum;
      amount?: number;
    },
  ) {
    try {
      const { order_id, reason, amount } = body;

      // Validate inputs
      if (!order_id) {
        throw new BadRequestException('order_id is required');
      }

      if (!reason || !Object.values(RefundReasonEnum).includes(reason)) {
        throw new BadRequestException(
          `reason must be one of: ${Object.values(RefundReasonEnum).join(', ')}`,
        );
      }

      if (amount !== undefined && (amount <= 0 || !Number.isFinite(amount))) {
        throw new BadRequestException('amount must be a positive number');
      }

      // Check degradation level - allow requests even in degraded state
      // (refunds are user-initiated, not critical system operations)
      const degradationLevel = await this.degradation.evaluateDegradationLevel();
      if (degradationLevel === DegradationLevel.OFFLINE) {
        throw new BadRequestException(
          'Refund service is temporarily offline. Please try again later.',
        );
      }

      // Request refund (no retry needed - just database operation)
      const refund = await this.refundService.requestRefund(order_id, reason, amount);

      this.logger.log(
        `✅ Refund request created: id=${refund.id}, order=${order_id}, amount=${refund.amount}`,
      );

      return {
        ok: true,
        refund: {
          id: refund.id,
          order_id: refund.order_id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          created_at: refund.created_at,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to request refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Customer: View own refund status
   * 
   * GET /refunds/:id
   * 
   * Response:
   * {
   *   "ok": true,
   *   "refund": {
   *     "id": "uuid",
   *     "order_id": "uuid",
   *     "amount": 50000,
   *     "reason": "CUSTOMER_REQUEST",
   *     "status": "PENDING|APPROVED|PROCESSED|FAILED|REJECTED",
   *     "notes"?: "Admin notes",
   *     "error_message"?: "If status is FAILED",
   *     "created_at": "2024-01-15T10:30:00Z",
   *     "approved_at"?: "2024-01-15T11:00:00Z",
   *     "processed_at"?: "2024-01-15T11:05:00Z"
   *   }
   * }
   */
  @Get('/refunds/:id')
  async getRefund(@Param('id') refundId: string) {
    try {
      if (!refundId) {
        throw new BadRequestException('refund id is required');
      }

      const refund = await this.refundService.getRefund(refundId);

      if (!refund) {
        throw new NotFoundException(`Refund ${refundId} not found`);
      }

      return {
        ok: true,
        refund: {
          id: refund.id,
          order_id: refund.order_id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          notes: refund.notes,
          error_message: refund.error_message,
          flutterwave_refund_id: refund.flutterwave_refund_id,
          created_at: refund.created_at,
          approved_at: refund.approved_at,
          processed_at: refund.processed_at,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to get refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Admin: List refunds with filtering
   * 
   * GET /admin/refunds?status=PENDING&tenant_id=uuid&limit=50&offset=0
   * 
   * Query Parameters:
   * - status?: RefundStatusEnum (filter by status)
   * - tenant_id?: string (filter by tenant)
   * - order_id?: string (filter by order)
   * - min_amount?: number (minimum amount)
   * - max_amount?: number (maximum amount)
   * - limit?: number (default 50, max 200)
   * - offset?: number (pagination offset, default 0)
   * 
   * Response:
   * {
   *   "ok": true,
   *   "refunds": [...],
   *   "total": 150,
   *   "limit": 50,
   *   "offset": 0
   * }
   */
  @Get('/admin/refunds')
  async listRefunds(
    @Query('status') status?: RefundStatusEnum,
    @Query('tenant_id') tenantId?: string,
    @Query('order_id') orderId?: string,
    @Query('min_amount') minAmount?: number,
    @Query('max_amount') maxAmount?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      // Validate pagination
      const pageLimit = Math.min(limit || 50, 200);
      const pageOffset = offset || 0;

      if (pageLimit <= 0 || pageOffset < 0) {
        throw new BadRequestException('limit must be > 0 and offset must be >= 0');
      }

      // Call service with filters
      const result = await this.refundService.listRefunds({
        status,
        tenant_id: tenantId,
        order_id: orderId,
        min_amount: minAmount ? parseInt(minAmount as any) : undefined,
        max_amount: maxAmount ? parseInt(maxAmount as any) : undefined,
        limit: pageLimit,
        offset: pageOffset,
      });

      this.logger.log(`✅ Listed ${result.data.length} refunds`);

      return {
        ok: true,
        refunds: result.data.map((refund) => ({
          id: refund.id,
          order_id: refund.order_id,
          tenant_id: refund.tenant_id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          notes: refund.notes,
          approved_by: refund.approved_by,
          approved_at: refund.approved_at,
          processed_at: refund.processed_at,
          created_at: refund.created_at,
        })),
        total: result.total,
        limit: pageLimit,
        offset: pageOffset,
      };
    } catch (error: any) {
      this.logger.error(`Failed to list refunds: ${error.message}`);
      throw error;
    }
  }

  /**
   * Admin: View specific refund
   * 
   * GET /admin/refunds/:id
   * 
   * Response:
   * {
   *   "ok": true,
   *   "refund": {...}
   * }
   */
  @Get('/admin/refunds/:id')
  async getRefundAdmin(@Param('id') refundId: string) {
    try {
      if (!refundId) {
        throw new BadRequestException('refund id is required');
      }

      const refund = await this.refundService.getRefund(refundId);

      if (!refund) {
        throw new NotFoundException(`Refund ${refundId} not found`);
      }

      return {
        ok: true,
        refund: {
          id: refund.id,
          order_id: refund.order_id,
          tenant_id: refund.tenant_id,
          payment_id: refund.payment_id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          notes: refund.notes,
          error_message: refund.error_message,
          flutterwave_refund_id: refund.flutterwave_refund_id,
          approved_by: refund.approved_by,
          approved_at: refund.approved_at,
          processed_at: refund.processed_at,
          created_at: refund.created_at,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to get refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Admin: Approve refund
   * 
   * Transitions: PENDING → APPROVED
   * Async: Triggers processRefundAsync() in background
   * 
   * POST /admin/refunds/:id/approve
   * 
   * Request Body:
   * {
   *   "approved_by": "admin_user_id",
   *   "admin_tenant_id": "tenant_uuid",
   *   "notes"?: "Approval notes"
   * }
   * 
   * Response:
   * {
   *   "ok": true,
   *   "refund": {
   *     "id": "uuid",
   *     "status": "APPROVED",
   *     "approved_at": "2024-01-15T11:00:00Z",
   *     "approved_by": "admin_user_id"
   *   }
   * }
   */
  @Post('/admin/refunds/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveRefund(
    @Param('id') refundId: string,
    @Body()
    body: {
      approved_by: string;
      admin_tenant_id: string;
      notes?: string;
    },
  ) {
    try {
      const { approved_by, admin_tenant_id, notes } = body;

      // Validate inputs
      if (!refundId) {
        throw new BadRequestException('refund id is required');
      }

      if (!approved_by) {
        throw new BadRequestException('approved_by (admin user id) is required');
      }

      if (!admin_tenant_id) {
        throw new BadRequestException('admin_tenant_id is required');
      }

      // Check degradation level
      const degradationLevel = await this.degradation.evaluateDegradationLevel();
      if (degradationLevel === DegradationLevel.OFFLINE) {
        throw new BadRequestException(
          'Refund service is temporarily offline. Please try again later.',
        );
      }

      // Check circuit breaker before proceeding with async refund processing
      const circuitState = await this.circuitBreaker.getState('flutterwave-refund');
      if (circuitState === 'OPEN') {
        this.logger.warn(
          `⚠️ Circuit breaker OPEN for Flutterwave refunds - approval may fail at processing stage`,
        );
      }

      // Approve refund (transitions PENDING → APPROVED)
      // The actual Flutterwave call will happen asynchronously via processRefundAsync()
      const refund = await this.refundService.approveRefund(refundId, approved_by, notes);

      this.logger.log(
        `✅ Refund approved: id=${refund.id}, approved_by=${approved_by}, status=${refund.status}`,
      );

      // Trigger async processing with resilience patterns
      this.processRefundWithResilience(refundId)
        .catch((error) => {
          this.logger.error(
            `Failed to process refund asynchronously: ${error.message}`,
            error.stack,
          );
        });

      return {
        ok: true,
        refund: {
          id: refund.id,
          status: refund.status,
          approved_at: refund.approved_at,
          approved_by: refund.approved_by,
          amount: refund.amount,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to approve refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Admin: Reject refund
   * 
   * Transitions: PENDING → REJECTED
   * Cancels the refund completely.
   * 
   * POST /admin/refunds/:id/reject
   * 
   * Request Body:
   * {
   *   "approved_by": "admin_user_id",
   *   "admin_tenant_id": "tenant_uuid",
   *   "notes"?: "Rejection reason"
   * }
   * 
   * Response:
   * {
   *   "ok": true,
   *   "refund": {
   *     "id": "uuid",
   *     "status": "REJECTED",
   *     "approved_by": "admin_user_id",
   *     "notes": "Rejection reason"
   *   }
   * }
   */
  @Post('/admin/refunds/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectRefund(
    @Param('id') refundId: string,
    @Body()
    body: {
      approved_by: string;
      admin_tenant_id: string;
      notes?: string;
    },
  ) {
    try {
      const { approved_by, admin_tenant_id, notes } = body;

      // Validate inputs
      if (!refundId) {
        throw new BadRequestException('refund id is required');
      }

      if (!approved_by) {
        throw new BadRequestException('approved_by (admin user id) is required');
      }

      if (!admin_tenant_id) {
        throw new BadRequestException('admin_tenant_id is required');
      }

      // Reject refund (transitions PENDING → REJECTED)
      const refund = await this.refundService.rejectRefund(refundId, approved_by, notes);

      this.logger.log(`✅ Refund rejected: id=${refund.id}, approved_by=${approved_by}`);

      return {
        ok: true,
        refund: {
          id: refund.id,
          status: refund.status,
          approved_by: refund.approved_by,
          notes: refund.notes,
          amount: refund.amount,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to reject refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Internal: Process refund with resilience patterns
   * 
   * Called asynchronously after approval to:
   * 1. Call Flutterwave refund API (with retry strategy - 3 attempts)
   * 2. Check circuit breaker before each attempt
   * 3. Handle failures gracefully
   * 4. Record health metrics
   * 
   * Note: This is NOT exposed as an endpoint, called internally
   */
  private async processRefundWithResilience(refundId: string): Promise<void> {
    try {
      this.logger.log(`Processing refund with resilience: ${refundId}`);

      // Step 1: Check circuit breaker
      const circuitState = this.circuitBreaker.getState('flutterwave-refund');
      if (circuitState === 'OPEN') {
        throw new Error(
          'Circuit breaker OPEN for Flutterwave refunds - backing off to prevent cascading failure',
        );
      }

      // Step 2: Check degradation level
      const degradationLevel = await this.degradation.evaluateDegradationLevel();
      if (degradationLevel === DegradationLevel.OFFLINE) {
        throw new Error('System is OFFLINE - cannot process refunds');
      }

      // Step 3: Call processRefundAsync with retry strategy (3 attempts, exponential backoff)
      try {
        await this.retryStrategy.executeWithRetry(
          'flutterwave-refund',
          async () => {
            await this.refundService.processRefundAsync(refundId);
          },
        );
        
        // Record success for circuit breaker
        this.circuitBreaker.recordSuccess('flutterwave-refund');
        this.logger.log(`✅ Refund processed successfully: ${refundId}`);
      } catch (error: any) {
        // Record failure for circuit breaker
        this.circuitBreaker.recordFailure('flutterwave-refund', error);
        throw error;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process refund after retries: ${refundId} - ${error.message}`,
        error.stack,
      );
      // Error already recorded in refund service's processRefundAsync error handling
    }
  }
}
