/**
 * Orders Controller
 * 
 * Handles HTTP endpoints for order management:
 * - Order creation (public - for QR menu ordering)
 * - Order retrieval (public for customer status, authenticated for staff)
 * - Order status updates (authenticated only)
 * - Payment confirmation (authenticated only)
 * - Order rejection (authenticated only)
 * 
 * Security:
 * - Public endpoints: Create and get single order
 * - Protected endpoints: List, update, confirm, reject (require JWT + tenant context)
 * - Tenant Guard: Ensures operations scoped to user's restaurant
 * 
 * @controller /orders
 * @module OrdersModule
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../common/strategies/jwt.strategy';

/**
 * Orders controller
 * 
 * @class OrdersController
 * @route /api/v1/orders (with API prefix)
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders
   * 
   * Create a new order from customer cart
   * 
   * Public endpoint for QR-menu based ordering:
   * - Customers scan QR code
   * - Place order via public endpoint
   * - Receive order ID and code
   * 
   * @async
   * @param {CreateOrderDto} dto - Order items and tenant context
   * @returns {Object} { success: true, data: Order }
   * @status 201 - Order created
   * @status 400 - Validation error or items not found
   * 
   * @example
   * POST /api/v1/orders
   * {
   *   "tenant_id": "restaurant-123",
   *   "items": [
   *     { "menu_item_id": "item-1", "quantity": 2 },
   *     { "menu_item_id": "item-2", "quantity": 1 }
   *   ]
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "order-123",
   *     "order_code": "ORD-1234ABCD",
   *     "status": "PENDING_PAYMENT",
   *     "total_amount": 25.50,
   *     ...
   *   }
   * }
   */
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(dto);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * GET /orders/:id
   * 
   * Get single order by ID (public for customer tracking)
   * 
   * Allows customers to check order status by ID
   * without authentication. Useful for:
   * - Order status page
   * - Pickup notification
   * - Digital receipt
   * 
   * @async
   * @param {string} id - Order ID
   * @returns {Object} { success: true, data: Order }
   * @status 200 - Order found
   * @status 404 - Order not found
   * 
   * @example
   * GET /api/v1/orders/order-123
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": { "id": "order-123", "status": "READY", ... }
   * }
   */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const order = await this.ordersService.getOrder(id);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * GET /orders
   * 
   * Get all orders for a restaurant (paginated)
   * 
   * Authenticated endpoint for restaurant staff/owner:
   * - View order history
   * - Filter by status
   * - Pagination support
   * 
   * Requires:
   * - Valid JWT token
   * - User must have access to the restaurant
   * 
   * @async
   * @param {JwtPayload} user - User info from JWT (tenant context)
   * @param {string} [status] - Optional status filter
   * @param {number} [limit=20] - Results per page
   * @param {number} [offset=0] - Pagination offset
   * @returns {Object} { success: true, data: Order[], total: number }
   * @status 200 - Orders retrieved
   * @status 401 - Not authenticated
   * 
   * @guard JwtAuthGuard - Verify JWT
   * @guard TenantGuard - Verify tenant access
   * 
   * @example
   * GET /api/v1/orders?status=PENDING_PAYMENT&limit=10&offset=0
   * Authorization: Bearer eyJhbG...
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [ { "id": "order-1", ... }, ... ],
   *   "total": 42
   * }
   */
  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getOrders(
    @GetUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Convert query parameters to numbers with defaults
    const parsedLimit = limit ? Number(limit) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    const { data, total } = await this.ordersService.getOrdersByTenant(
      user.tenantId,
      status,
      parsedLimit,
      parsedOffset,
    );

    return {
      success: true,
      data,
      total,
    };
  }

  /**
   * PATCH /orders/:id/status
   * 
   * Update order status with state machine validation
   * 
   * Transitions order through workflow:
   * PENDING_PAYMENT → CONFIRMED → PREPARING → READY → COMPLETED
   * 
   * Can transition to REJECTED from most states
   * 
   * @async
   * @param {JwtPayload} user - User for tenant context
   * @param {string} id - Order ID
   * @param {UpdateOrderStatusDto} dto - New status
   * @returns {Object} { success: true, data: Order }
   * @status 200 - Status updated
   * @status 400 - Invalid status transition
   * @status 401 - Not authenticated
   * @status 404 - Order not found
   * 
   * @guard JwtAuthGuard, TenantGuard
   * 
   * @example
   * PATCH /api/v1/orders/order-123/status
   * {
   *   "status": "PREPARING"
   * }
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async updateOrderStatus(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const order = await this.ordersService.updateOrderStatus(id, user.tenantId, dto);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * PATCH /orders/:id/confirm
   * 
   * Confirm payment for pending order
   * 
   * Marks order as CONFIRMED after payment received.
   * Signals to kitchen to start preparation.
   * 
   * @async
   * @param {JwtPayload} user - User for tenant context
   * @param {string} id - Order ID
   * @returns {Object} { success: true, data: Order }
   * @status 200 - Payment confirmed
   * @status 400 - Order not in PENDING_PAYMENT status
   * @status 401 - Not authenticated
   * @status 404 - Order not found
   * 
   * @guard JwtAuthGuard, TenantGuard
   * 
   * @example
   * PATCH /api/v1/orders/order-123/confirm
   * Authorization: Bearer eyJhbG...
   */
  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async confirmPayment(@GetUser() user: JwtPayload, @Param('id') id: string) {
    const order = await this.ordersService.confirmPayment(id, user.tenantId);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * PATCH /orders/:id/reject
   * 
   * Reject/cancel an order
   * 
   * Transitions order to REJECTED (terminal state).
   * Used for:
   * - Customer cancellation
   * - Restaurant cannot fulfill
   * - Stock/availability issues
   * 
   * @async
   * @param {JwtPayload} user - User for tenant context
   * @param {string} id - Order ID
   * @param {Object} body - Optional cancellation reason
   * @returns {Object} { success: true, data: Order }
   * @status 200 - Order rejected
   * @status 401 - Not authenticated
   * @status 404 - Order not found
   * 
   * @guard JwtAuthGuard, TenantGuard
   * 
   * @example
   * PATCH /api/v1/orders/order-123/reject
   * {
   *   "reason": "Out of stock"
   * }
   */
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async rejectOrder(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const order = await this.ordersService.rejectOrder(id, user.tenantId, body.reason);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * POST /orders/:id/pay
   * 
   * Initiate payment for an order via Paypack
   * 
   * Public endpoint to start payment flow:
   * - Validates order exists and payment is pending
   * - For Mobile Money: calls Paypack to collect payment
   * - For Cash: no external action needed
   * 
   * Mobile Money Flow:
   * - Customer confirms order with phone number
   * - Frontend calls this endpoint
   * - Paypack sends USSD push to phone
   * - Customer enters PIN to complete
   * - Webhook notifies backend of payment status
   * 
   * Cash Flow:
   * - No Paypack call needed
   * - Just returns success (payment confirmed manually by staff)
   * 
   * @async
   * @param {string} id - Order ID
   * @returns {Object} { success: true, data: { paymentRef?: string } }
   * @status 200 - Payment initiated or confirmed
   * @status 400 - Order not in PENDING_PAYMENT status
   * @status 404 - Order not found
   * 
   * @example
   * POST /api/v1/orders/order-123/pay
   * 
   * Response (Mobile Money):
   * {
   *   "success": true,
   *   "data": {
   *     "paymentRef": "PAYPACK-REF-12345",
   *     "payment_method": "MTN",
   *     "message": "Check your phone for payment prompt"
   *   }
   * }
   * 
   * Response (Cash):
   * {
   *   "success": true,
   *   "data": {
   *     "payment_method": "CASH",
   *     "message": "Show your order to the cashier"
   *   }
   * }
   */
  @Post(':id/pay')
  async initiatePayment(
    @Param('id') id: string,
    @Body() body?: { phone_number?: string },
  ) {
    const result = await this.ordersService.initiatePayment(id, body?.phone_number);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * PATCH /orders/:id/confirm-cash
   * 
   * Mark a cash order as paid by staff
   * 
   * Authenticated endpoint for restaurant staff to confirm:
   * - Customer has paid cash to cashier
   * - Order should transition to CONFIRMED status
   * - Kitchen should start preparing order
   * 
   * Only valid for CASH payment method orders.
   * 
   * @async
   * @param {JwtPayload} user - User for tenant context
   * @param {string} id - Order ID
   * @returns {Object} { success: true, data: Order }
   * @status 200 - Cash payment confirmed
   * @status 400 - Order not in CASH payment method or PENDING_PAYMENT status
   * @status 401 - Not authenticated
   * @status 404 - Order not found
   * 
   * @guard JwtAuthGuard, TenantGuard
   * 
   * @example
   * PATCH /api/v1/orders/order-123/confirm-cash
   * Authorization: Bearer eyJhbG...
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "order-123",
   *     "status": "CONFIRMED",
   *     "payment_status": "PAID",
   *     "payment_method": "CASH",
   *     ...
   *   }
   * }
   */
  @Patch(':id/confirm-cash')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async confirmCashPayment(@GetUser() user: JwtPayload, @Param('id') id: string) {
    const order = await this.ordersService.confirmCashPayment(id, user.tenantId);
    return {
      success: true,
      data: order,
    };
  }
}
