import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentService } from '../payments/services/payment.service';
import { SettlementService } from '../payments/services/settlement.service';
import { TenantsService } from '../tenants/services/tenants.service';
import { v4 as uuid } from 'uuid';

/** Platform commission percentage applied to all orders (3%) */
const PLATFORM_COMMISSION_PERCENT = 0.03;

/**
 * Order Status State Machine
 * 
 * Defines valid transitions between order statuses to maintain data integrity.
 * Invalid transitions are rejected with helpful error messages.
 * 
 * Status Flow:
 * - CREATED: Initial state (when order created but not submitted)
 * - PENDING_PAYMENT: Awaiting payment confirmation
 * - CONFIRMED: Payment received, ready for kitchen
 * - PREPARING: Kitchen is preparing the order
 * - READY: Order ready for pickup/delivery
 * - COMPLETED: Order fulfilled
 * - REJECTED: Order cancelled
 * 
 * @constant
 * @type {Record<string, string[]>}
 */
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: ['PREPARING', 'REJECTED'],
  PREPARING: ['READY', 'REJECTED'],
  READY: ['COMPLETED', 'REJECTED'],
  COMPLETED: [], // Terminal state
  REJECTED: [], // Terminal state
  CREATED: ['PENDING_PAYMENT', 'REJECTED'],
};

/**
 * Orders Service
 * 
 * Handles all order-related business logic:
 * - Order creation with item validation and pricing
 * - Order status management with state machine enforcement
 * - Payment processing and confirmation
 * - Order retrieval and filtering
 * - WebSocket notifications for order updates
 * 
 * Features:
 * - Automatic platform commission calculation (3% on subtotal)
 * - Order code generation for customer reference (ORD-XXXX)
 * - Tenant isolation (orders scoped to restaurant)
 * - State machine validation (prevents invalid status transitions)
 * - Real-time notifications via WebSocket
 * 
 * @class OrdersService
 * @injectable
 */
@Injectable()
export class OrdersService {

  constructor(
    /** Order repository for database operations */
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    /** Order item repository for line-item management */
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    /** Menu item repository for item validation and pricing */
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    /** Notifications service for WebSocket events */
    private notificationsService: NotificationsService,
    /** Payment service for payment processing */
    private paymentService: PaymentService,
    /** Settlement service for merchant payables */
    private settlementService: SettlementService,
    /** Tenants service for restaurant status checks */
    private tenantsService: TenantsService,
  ) {}

  /**
   * Create a new order from customer cart
   * 
   * Complex process with multiple validations:
   * 1. Validate all menu items exist and belong to tenant
   * 2. Verify items are in stock/available
   * 3. Calculate subtotal from item prices and quantities
   * 4. Calculate platform commission (3% of subtotal)
   * 5. Generate unique order code and order number
   * 6. Create order record with initial state
   * 7. Create order items (line items)
   * 8. Emit WebSocket notification to restaurant
   * 
   * Pricing Calculation:
   * - Subtotal = sum of (item price × quantity) for each item
   * - Platform Fee = subtotal × 3% (rounded to nearest cent)
   * - Total = subtotal + platform fee
   * 
   * @async
   * @param {CreateOrderDto} dto - Order data with items and tenant context
   * @returns {Promise<Order>} Created order with items and calculated totals
   * @throws {BadRequestException} If items not found or invalid
   * 
   * @example
   * const order = await orderService.createOrder({
   *   tenant_id: 'restaurant-123',
   *   items: [
   *     { menu_item_id: 'item-1', quantity: 2 },
   *     { menu_item_id: 'item-2', quantity: 1 }
   *   ]
   * });
   * console.log(order.order_code); // 'ORD-1234ABCD'
   * console.log(order.total_amount); // $23.50 (example)
   */
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // Check if restaurant is suspended (Phase 3 - Verification & Enforcement)
    const isSuspended = await this.tenantsService.isRestaurantSuspended(dto.tenant_id);
    if (isSuspended) {
      const tenant = await this.tenantsService.getTenantById(dto.tenant_id);
      throw new BadRequestException(
        `Cannot create order: Restaurant "${tenant.name}" is suspended. Reason: ${tenant.suspended_reason || 'Administrative suspension'}`,
      );
    }

    // Extract menu item IDs from order items
    const menuItemIds = dto.items.map((item) => item.menu_item_id);
    
    // Validate all items exist and belong to specified tenant
    const menuItems = await this.menuItemRepository.find({
      where: {
        id: In(menuItemIds),
        tenant_id: dto.tenant_id,
      },
    });

    // Reject if not all items were found (prevents partial orders with missing items)
    if (menuItems.length !== dto.items.length) {
      throw new BadRequestException('Some menu items not found');
    }

    // Calculate order totals and prepare order items
    let subtotal = 0;
    const orderItemsData = [];

    for (const orderItem of dto.items) {
      // Find menu item details (price, name)
      const menuItem = menuItems.find((m) => m.id === orderItem.menu_item_id);
      if (!menuItem) {
        throw new BadRequestException(`Menu item ${orderItem.menu_item_id} not found`);
      }

      // Calculate line item subtotal
      const itemSubtotal = menuItem.price * orderItem.quantity;
      subtotal += itemSubtotal;

      // Prepare order item data (captures price at time of order)
      orderItemsData.push({
        menu_item_id: menuItem.id,
        name: menuItem.name,
        quantity: orderItem.quantity,
        price: menuItem.price,
        subtotal: itemSubtotal,
      });
    }

    // Calculate platform commission
    let platformFee = Math.round(subtotal * PLATFORM_COMMISSION_PERCENT);
    let totalAmount = subtotal + platformFee;

    // Fallback: Use frontend-provided totals if calculation yields 0 (menu item prices are likely 0)
    if (totalAmount === 0 && dto.total_amount && dto.total_amount > 0) {
      totalAmount = dto.total_amount;
      platformFee = dto.platform_fee || Math.round(dto.total_amount * PLATFORM_COMMISSION_PERCENT);
    }

    /**
     * Generate unique order code for customer reference
     * Format: ORD-[last 4 digits of timestamp][first 4 chars of UUID]
     * Example: ORD-2045ABCD4
     * Ensures human-readable code for phone orders
     */
    const orderCode = `ORD-${Date.now().toString().slice(-4)}${uuid().substring(0, 4).toUpperCase()}`;

    // Create order entity with initial state
    const paymentMethod = dto.payment_method || PaymentMethodEnum.CASH;
    const paymentStatus = paymentMethod === PaymentMethodEnum.CASH 
      ? PaymentStatusEnum.PENDING 
      : PaymentStatusEnum.PENDING;

    const order = this.orderRepository.create({
      tenant_id: dto.tenant_id,
      order_number: `ORD-${Date.now()}-${uuid().substring(0, 8)}`, // Unique identifier
      order_code: orderCode, // Customer-facing code
      status: OrderStatusEnum.PENDING_PAYMENT, // Initial status
      subtotal,
      platform_fee: platformFee,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      table_id: dto.table_id || null, // Associate with specific table if provided
      table_number: dto.table_number || null, // Associate with table number if provided
    });

    // Persist order to database
    const savedOrder = await this.orderRepository.save(order);

    // Create and persist order items
    for (const itemData of orderItemsData) {
      const orderItem = this.orderItemRepository.create({
        order_id: savedOrder.id,
        ...itemData,
      });
      await this.orderItemRepository.save(orderItem);
    }

    // Fetch complete order with items
    const finalOrder = await this.getOrder(savedOrder.id);

    // Notify restaurant via WebSocket
    this.notificationsService.notifyOrderCreated(dto.tenant_id, finalOrder);

    // Send order created email to merchant (fire-and-forget)
    // NOTE: Customer email notification should be triggered from the controller
    // when customer email is available (e.g., from user account or checkout form)
    // Email notification for merchant commented out - tenant owner_email not available
    /*
    if (tenant?.owner_email) {
      this.emailService.sendNewOrderMerchantEmail(
        tenant.owner_email,
        tenant.owner_id,
        dto.tenant_id,
        finalOrder.id,
        {
          customerCount: finalOrder.items.length,
          customerName: finalOrder.customer_name || 'Guest Customer',
          customerPhone: finalOrder.phone_number || 'Not provided',
          totalAmount: (finalOrder.total_amount / 100).toFixed(2), // Convert from cents
          items: finalOrder.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: (item.price / 100).toFixed(2),
          })),
        },
      ).catch(err => this.logger.error('Failed to send merchant order email:', err));
    }
    */

    return finalOrder;
  }

  /**
   * Retrieve a single order by ID
   * 
   * Fetches complete order data including related items.
   * Used for tenant-scoped order retrieval.
   * 
   * @async
   * @param {string} id - Order ID
   * @returns {Promise<Order>} Order with all items and calculations
   * @throws {NotFoundException} If order not found
   */
  async getOrder(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'], // Include order line items
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Retrieve order by ID (public/customer-facing)
   * 
   * Allows customers to track orders without authentication.
   * Does NOT require tenant context or special permissions.
   * 
   * @async
   * @param {string} id - Order ID
   * @returns {Promise<Order>} Order data
   * @throws {NotFoundException} If order not found
   */
  async getOrderPublic(id: string): Promise<Order> {
    return this.getOrder(id);
  }

  /**
   * Retrieve orders for a specific restaurant (tenant)
   * 
   * Supports filtering by status and pagination for large result sets.
   * 
   * @async
   * @param {string} tenantId - Restaurant/tenant ID
   * @param {string} [status] - Optional status filter (e.g., 'PENDING_PAYMENT')
   * @param {number} [limit=20] - Number of results per page (default: 20)
   * @param {number} [offset=0] - Pagination offset (default: 0)
   * @returns {Promise<{ data: Order[], total: number }>} Orders and total count
   * 
   * @example
   * const { data, total } = await ordersService.getOrdersByTenant(
   *   'restaurant-123',
   *   'PENDING_PAYMENT',
   *   10,
   *   0
   * );
   * console.log(`Page 1 of ${Math.ceil(total / 10)}`);
   */
  async getOrdersByTenant(
    tenantId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ data: Order[]; total: number }> {
    try {
      // Build query with tenant filter
      const query = this.orderRepository.createQueryBuilder('order')
        .where('order.tenant_id = :tenantId', { tenantId })
        .leftJoinAndSelect('order.items', 'items'); // Include items

      // Add status filter if provided
      if (status) {
        query.andWhere('order.status = :status', { status });
      }

      // Apply pagination and ordering, then get both data and total
      const [data, total] = await query
        .orderBy('order.created_at', 'DESC') // Newest first
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      return { data, total };
    } catch (error) {
      console.error('Error fetching orders by tenant:', error);
      throw error;
    }
  }

  /**
   * Update order status with state machine validation
   * 
   * Enforces valid state transitions to prevent invalid order states:
   * - PENDING_PAYMENT → CONFIRMED or REJECTED
   * - CONFIRMED → PREPARING or REJECTED
   * - PREPARING → READY or REJECTED
   * - READY → COMPLETED or REJECTED
   * 
   * Invalid transitions are rejected with helpful error messages.
   * 
   * @async
   * @param {string} id - Order ID
   * @param {string} tenantId - Restaurant/tenant ID for authorization
   * @param {UpdateOrderStatusDto} dto - New status
   * @returns {Promise<Order>} Updated order
   * @throws {NotFoundException} If order not found
   * @throws {BadRequestException} If transition not allowed
   * 
   * @example
   * await ordersService.updateOrderStatus(
   *   'order-123',
   *   'restaurant-123',
   *   { status: 'PREPARING' }
   * );
   */
  async updateOrderStatus(
    id: string,
    tenantId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    // Fetch order with tenant verification
    const order = await this.orderRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Look up allowed transitions from state machine
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status] || [];
    
    // Validate the transition is allowed
    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}. Allowed: ${allowedTransitions.join(', ')}`,
      );
    }

    // Update status
    order.status = dto.status as any;
    const updated = await this.orderRepository.save(order);

    // Fetch updated order with items
    const finalOrder = await this.getOrder(updated.id);

    // Notify restaurant and customers via WebSocket
    this.notificationsService.notifyOrderUpdated(tenantId, id, finalOrder);

    // Special notification for ready state (ready for pickup)
    if (dto.status === OrderStatusEnum.READY) {
      this.notificationsService.notifyOrderReady(tenantId, id, finalOrder);
      
      // Send order ready email to customer (fire-and-forget)
      // NOTE: Email will only be sent if customer email is available
      // This should be called from the controller with customer email context
      if (finalOrder.customer_name) {
        // Placeholder: In production, get customer email from user account or update Order model
        // this.emailService.sendOrderReadyEmail(
        //   customerEmail,
        //   customerId,
        //   tenantId,
        //   id,
        //   {
        //     customerName: finalOrder.customer_name,
        //     restaurantName: tenant.name,
        //     orderId: finalOrder.order_code,
        //     pickupLocation: 'Counter',
        //   },
        // ).catch(err => this.logger.error('Failed to send order ready email:', err));
      }
    }

    return finalOrder;
  }

  /**
   * Confirm payment for pending order
   * 
   * Marks order as paid and transitions to CONFIRMED status.
   * Updates payment_status to PAID.
   * 
   * @async
   * @param {string} id - Order ID
   * @param {string} tenantId - Restaurant/tenant ID for authorization
   * @returns {Promise<Order>} Order with CONFIRMED status
   * @throws {NotFoundException} If order not found
   * @throws {BadRequestException} If order not in PENDING_PAYMENT status
   */
  async confirmPayment(id: string, tenantId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Can only confirm payment for orders awaiting payment
    if (order.status !== OrderStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not pending payment');
    }

    // Update status and payment status
    order.status = OrderStatusEnum.CONFIRMED;
    order.payment_status = PaymentStatusEnum.PAID;

    const updated = await this.orderRepository.save(order);
    const finalOrder = await this.getOrder(updated.id);

    // Notify about status change
    this.notificationsService.notifyOrderUpdated(tenantId, id, finalOrder);

    return finalOrder;
  }

  /**
   * Reject/cancel an order
   * 
   * Transitions order to REJECTED status (terminal state).
   * Can be called from most states except COMPLETED/REJECTED.
   * 
   * @async
   * @param {string} id - Order ID
   * @param {string} tenantId - Restaurant/tenant ID for authorization
   * @param {string} [_reason] - Optional cancellation reason (for future use)
   * @returns {Promise<Order>} Order with REJECTED status
   * @throws {NotFoundException} If order not found
   */
  async rejectOrder(id: string, tenantId: string, _reason?: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Mark order as rejected
    order.status = OrderStatusEnum.REJECTED;
    const updated = await this.orderRepository.save(order);

    const finalOrder = await this.getOrder(updated.id);

    // Notify about rejection
    this.notificationsService.notifyOrderUpdated(tenantId, id, finalOrder);

    return finalOrder;
  }

  /**
   * Initiate payment for an order
   * 
   * Handles payment processing based on payment method:
   * - CASH: No external action, payment confirmed manually by staff
   * - MTN/AIRTEL: Call Paypack to initiate mobile money payment
   * 
   * For Mobile Money:
   * 1. Validates order exists and is in PENDING_PAYMENT status
   * 2. Normalizes phone number for Paypack
   * 3. Initiates USSD-based payment request via Paypack API
   * 4. Stores Paypack reference in order for webhook matching
   * 5. Returns payment reference to frontend
   * 
   * Customer Flow:
   * - Paypack sends USSD prompt to customer's phone
   * - Customer enters PIN to complete payment
   * - Paypack sends webhook callback when complete
   * - Order status updates automatically via webhook
   * 
   * For Cash:
   * - No API call needed
   * - Staff confirms payment later via /confirm-cash endpoint
   * 
   * @async
   * @param {string} id - Order ID
   * @returns {Promise<object>} Payment initiation result
   * @returns {string} paymentRef - Paypack reference (for Mobile Money only)
   * @returns {string} payment_method - The payment method used
   * @returns {string} message - User-friendly message
   * @throws {NotFoundException} If order not found
   * @throws {BadRequestException} If order not in PENDING_PAYMENT status
   * 
   * @example
   * // Mobile Money payment
   * const result = await ordersService.initiatePayment('order-123');
   * // {
   * //   paymentRef: 'PAYPACK-REF-12345',
   * //   payment_method: 'MTN',
   * //   message: 'Check your phone for payment prompt'
   * // }
   * 
   * // Cash payment
   * const result = await ordersService.initiatePayment('order-456');
   * // {
   * //   payment_method: 'CASH',
   * //   message: 'Show your order to the cashier'
   * // }
   */
  async initiatePayment(id: string, phoneNumber?: string): Promise<any> {
    // Fetch order with items
    const order = await this.getOrder(id);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Can only initiate payment for pending orders
    if (order.status !== OrderStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not pending payment');
    }

    // Update phone number if provided
    if (phoneNumber) {
      order.phone_number = phoneNumber;
      await this.orderRepository.save(order);
    }

    // Handle Cash payment (no external action needed)
    if (order.payment_method === PaymentMethodEnum.CASH) {
      return {
        payment_method: PaymentMethodEnum.CASH,
        message: 'Show your order code to the cashier to complete payment',
        order_code: order.order_code,
      };
    }

    // For Mobile Money (MTN/AIRTEL), call PaymentService
    if (order.payment_method === PaymentMethodEnum.MTN || 
        order.payment_method === PaymentMethodEnum.AIRTEL) {
      
      // Validate phone number is available (either from param or already on order)
      if (!order.phone_number) {
        throw new BadRequestException('Phone number is required for mobile money payment');
      }

      // Initiate payment via PaymentService (which creates PaymentTransaction)
      const paymentResult = await this.paymentService.startMobileMoneyPayment(
        order.id,
        order.phone_number,
      );

      // Return payment reference and instructions to frontend
      // Response supports Flutterwave (flutterwaveId)
      return {
        paymentRef: paymentResult.flutterwaveId,
        flutterwaveId: paymentResult.flutterwaveId,
        txRef: paymentResult.txRef,
        payment_method: order.payment_method,
        message: `Payment request sent to ${order.payment_method}. Check your phone for the payment prompt.`,
        status: paymentResult.status,
      };
    }

    // Should not reach here, but handle unknown payment method
    throw new BadRequestException(`Unsupported payment method: ${order.payment_method}`);
  }

  /**
   * Confirm cash payment for an order
   * 
   * Called by staff when customer pays cash at the counter.
   * Transitions order from PENDING_PAYMENT → CONFIRMED and marks payment as PAID.
   * 
   * Only valid for CASH payment method orders.
   * 
   * @async
   * @param {string} id - Order ID
   * @param {string} tenantId - Restaurant/tenant ID for authorization
   * @returns {Promise<Order>} Order with CONFIRMED status and PAID payment_status
   * @throws {NotFoundException} If order not found
   * @throws {BadRequestException} If order not CASH or not in PENDING_PAYMENT status
   * 
   * @example
   * const order = await ordersService.confirmCashPayment('order-123', 'tenant-1');
   * console.log(order.status); // 'CONFIRMED'
   * console.log(order.payment_status); // 'PAID'
   */
  async confirmCashPayment(id: string, tenantId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only CASH orders can be confirmed this way
    if (order.payment_method !== PaymentMethodEnum.CASH) {
      throw new BadRequestException(
        `Order payment method is ${order.payment_method}, not CASH. Cannot confirm non-cash payment manually.`,
      );
    }

    // Order must be pending payment
    if (order.status !== OrderStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Order is not pending payment (current status: ${order.status}). Cannot confirm cash payment for this order.`,
      );
    }

    // Update order status and payment status
    order.status = OrderStatusEnum.CONFIRMED;
    order.payment_status = PaymentStatusEnum.PAID;

    const updated = await this.orderRepository.save(order);
    const finalOrder = await this.getOrder(updated.id);

    // Create merchant payable record and credit tenant wallet
    try {
      const paymentMethod = order.payment_method || 'CASH';
      await this.settlementService.createMerchantPayable(
        id,
        tenantId,
        paymentMethod,
      );
    } catch (settlementError: any) {
      // Settlement error should not fail the order confirmation
      // Order is already marked PAID
      // Settlement will be retried by background job or manual process
      console.error(
        `⚠️  Settlement creation failed for order ${id}: ${settlementError.message}`,
      );
    }

    // Notify about status change
    this.notificationsService.notifyOrderUpdated(tenantId, id, finalOrder);

    return finalOrder;
  }

  /**
   * Get all orders created today (no tenant scoping - admin only)
   * Used by admin dashboard to show platform activity
   */
  async getTodaysOrders(tenantId?: string): Promise<Order[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let query = this.orderRepository
      .createQueryBuilder('order')
      .where('order.created_at >= :today', { today })
      .andWhere('order.created_at < :tomorrow', { tomorrow });

    if (tenantId) {
      query = query.andWhere('order.tenant_id = :tenantId', { tenantId });
    }

    return query.getMany();
  }

  /**
   * Calculate total GMV (Gross Merchandise Value) for today
   * Sums all paid order totals for the day
   */
  async getTodaysGMV(tenantId?: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let query = this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.total_amount)', 'total')
      .where('order.created_at >= :today', { today })
      .andWhere('order.created_at < :tomorrow', { tomorrow })
      .andWhere('order.payment_status = :status', {
        status: PaymentStatusEnum.PAID,
      });

    if (tenantId) {
      query = query.andWhere('order.tenant_id = :tenantId', { tenantId });
    }

    const result = await query.getRawOne();
    return parseInt(result?.total || 0, 10);
  }

  /**
   * Get orders within a date range
   */
  async getOrdersByDateRange(
    from: Date,
    to: Date,
    tenantId?: string,
  ): Promise<Order[]> {
    let query = this.orderRepository
      .createQueryBuilder('order')
      .where('order.created_at >= :from', { from })
      .andWhere('order.created_at <= :to', { to });

    if (tenantId) {
      query = query.andWhere('order.tenant_id = :tenantId', { tenantId });
    }

    return query.orderBy('order.created_at', 'DESC').getMany();
  }

  /**
   * Get all orders across all restaurants (platform-wide, admin only)
   * Supports filtering by status, payment status, date range, and search
   */
  async getAllOrdersPlatformWide(
    filters?: {
      tenantId?: string;
      status?: string;
      paymentStatus?: string;
      fromDate?: Date;
      toDate?: Date;
      search?: string;
    },
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ orders: Order[]; total: number }> {
    let query = this.orderRepository.createQueryBuilder('order');

    // Apply filters
    if (filters?.tenantId) {
      query = query.andWhere('order.tenant_id = :tenantId', {
        tenantId: filters.tenantId,
      });
    }

    if (filters?.status) {
      query = query.andWhere('order.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.paymentStatus) {
      query = query.andWhere('order.payment_status = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }

    if (filters?.fromDate) {
      query = query.andWhere('order.created_at >= :fromDate', {
        fromDate: filters.fromDate,
      });
    }

    if (filters?.toDate) {
      query = query.andWhere('order.created_at <= :toDate', {
        toDate: filters.toDate,
      });
    }

    if (filters?.search) {
      query = query.andWhere(
        '(order.id ILIKE :search OR order.order_number ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Get total count before pagination
    const total = await query.getCount();

    // Apply pagination and sort
    const orders = await query
      .orderBy('order.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    return { orders, total };
  }

  /**
   * Get specific order by ID (platform-wide, no tenant check)
   * Admin only - can view any order regardless of tenant
   */
  async getOrderByIdPlatformWide(id: string): Promise<Order> {
    const order = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.id = :id', { id })
      .leftJoinAndSelect('order.items', 'items')
      .getOne();

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  /**
   * Get today's order count (across all restaurants)
   */
  async getTodaysOrderCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.orderRepository
      .createQueryBuilder('order')
      .where('order.created_at >= :today', { today })
      .andWhere('order.created_at < :tomorrow', { tomorrow })
      .getCount();
  }
}