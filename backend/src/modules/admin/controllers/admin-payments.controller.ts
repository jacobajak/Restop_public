import { Controller, Get, Post, Param, UseGuards, Query, NotFoundException, Body, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { AdminPaymentManagementService } from '../services/admin-payment-management.service';
import { CreateManualPaymentDto, OverridePaymentStatusDto } from '../dtos/admin-payment-management.dto';

/**
 * AdminPaymentsController - Platform admin payment monitoring
 *
 * Allows platform admins to:
 * - View all payment transactions across all restaurants
 * - Filter by payment method, status, date range
 * - View payment details and raw provider data
 * - Search by transaction reference, order ID, phone
 *
 * GET /admin/payments - List all payments with filters
 * GET /admin/payments/:id - Get payment details
 */
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPaymentsController {
  constructor(
    private readonly adminPaymentService: AdminPaymentManagementService,
  ) {}

  /**
   * Get all payments with filtering
   *
   * Query parameters:
   * - method: Filter by method (CASH, MTN, AIRTEL)
   * - status: Filter by status (INITIATED, PENDING, SUCCESSFUL, FAILED, CANCELLED)
   * - restaurant_id: Filter by restaurant
   * - from_date: Start date (ISO 8601)
   * - to_date: End date (ISO 8601)
   * - search: Search by tx_ref, order_id, or phone
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get()
  async listPayments(
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('restaurant_id') restaurantId?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('search') search?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.adminPaymentService.getAllPaymentsPlatformWide(
        {
          tenantId: restaurantId,
          method,
          status,
          fromDate: fromDate ? new Date(fromDate) : undefined,
          toDate: toDate ? new Date(toDate) : undefined,
          search,
        },
        limit,
        offset,
      );

      return {
        success: true,
        data: result,
        limit,
        offset,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get payment details
   *
   * Returns:
   * - Order reference
   * - Restaurant info
   * - Amount and currency
   * - Payment method and status
   * - Internal and provider transaction references
   * - Raw webhook payload if available
   * - Retry history
   */
  @Get(':id')
  async getPayment(@Param('id') id: string) {
    try {
      const payment = await this.adminPaymentService.getPaymentDetailsByIdPlatformWide(id);

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          error: 'Payment not found',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create manual payment for testing/reconciliation
   * 
   * POST /admin/payments/manual
   * 
   * Body:
   * - order_id: Order to associate with payment
   * - tenant_id: Tenant the order belongs to
   * - amount: Payment amount (must match order total)
   * - currency: Currency code (KES, RWF, etc)
   * - method: Payment method (MTN, AIRTEL, CASH)
   * - reason: Optional reason (Testing, Reconciliation, etc)
   * - phone_number: Optional phone number for mobile money
   * 
   * Returns: Created payment transaction
   * 
   * Audit: Logged as MANUAL_FINANCIAL_ADJUSTMENT
   * Warning: Use only for testing/reconciliation - will mark order as PAID
   */
  @Post('manual')
  async createManualPayment(
    @GetUser() admin: JwtPayload,
    @Body() body: CreateManualPaymentDto,
  ) {
    try {
      const payment = await this.adminPaymentService.createManualPayment(
        body,
        admin.userId,
      );

      return {
        success: true,
        message: 'Manual payment created successfully',
        data: {
          id: payment.id,
          order_id: payment.order_id,
          tenant_id: payment.tenant_id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          provider_ref: payment.provider_ref,
          created_at: payment.created_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Override payment status
   * 
   * POST /admin/payments/:id/override-status
   * 
   * Body:
   * - new_status: Target status (SUCCESSFUL, FAILED, PENDING, CANCELLED)
   * - reason: Reason for override (required, min 10 chars)
   * 
   * Returns: Updated payment
   * 
   * Audit: Logged as MANUAL_FINANCIAL_ADJUSTMENT
   * Warning: Use for reconciliation/error correction only
   */
  @Post(':id/override-status')
  async overridePaymentStatus(
    @GetUser() admin: JwtPayload,
    @Param('id') payment_id: string,
    @Body() body: OverridePaymentStatusDto,
  ) {
    try {
      if (!body.new_status || !body.reason) {
        throw new BadRequestException('new_status and reason are required');
      }

      const payment = await this.adminPaymentService.overridePaymentStatus(
        payment_id,
        body.new_status,
        admin.userId,
        body.reason,
      );

      return {
        success: true,
        message: `Payment status overridden to ${body.new_status}`,
        data: {
          id: payment.id,
          order_id: payment.order_id,
          old_status: payment.raw_payload?.status_override?.old_status,
          new_status: payment.status,
          reason: body.reason,
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
