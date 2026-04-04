import { Controller, Get, Param, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { PaymentService } from '../../payments/payments.service';

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
  constructor(private readonly paymentService: PaymentService) {}

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
      const result = await this.paymentService.getAllPaymentsPlatformWide(
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
      const payment = await this.paymentService.getPaymentDetailsByIdPlatformWide(id);

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
}
