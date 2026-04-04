import { Controller, Get, Param, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { OrdersService } from '../../orders/orders.service';

/**
 * AdminOrdersController - Platform admin order monitoring
 *
 * Allows platform admins to:
 * - View all orders across all restaurants
 * - Filter orders by restaurant, status, date range
 * - View order details
 *
 * GET /admin/orders - List all orders with filters
 * GET /admin/orders/:id - Get order details
 */
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Get all orders with filtering
   *
   * Query parameters:
   * - restaurant_id: Filter by restaurant
   * - status: Filter by order status
   * - payment_status: Filter by payment status
   * - from_date: Start date (ISO 8601)
   * - to_date: End date (ISO 8601)
   * - search: Search by order ID or customer name
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get()
  async listOrders(
    @Query('restaurant_id') restaurantId?: string,
    @Query('status') status?: string,
    @Query('payment_status') paymentStatus?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('search') search?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result = await this.ordersService.getAllOrdersPlatformWide(
        {
          tenantId: restaurantId,
          status,
          paymentStatus,
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
   * Get order details
   */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    try {
      const order = await this.ordersService.getOrderByIdPlatformWide(id);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          error: 'Order not found',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
