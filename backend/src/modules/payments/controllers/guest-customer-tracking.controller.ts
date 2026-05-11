import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { GuestCustomerTrackingService, GuestCustomerProfile, CustomerStatistics } from '../services/guest-customer-tracking.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetTenant } from '../../../common/decorators/get-tenant.decorator';

/**
 * GuestCustomerTrackingController
 * 
 * REST API endpoints for guest customer analytics and tracking:
 * - GET /guest-customers/profile/:phone - Get guest customer profile by phone
 * - GET /guest-customers/order-history/:phone - Get customer order history
 * - GET /guest-customers/is-returning/:phone - Check if customer is returning
 * - GET /guest-customers/stats - Get tenant's customer statistics
 * - GET /guest-customers/top-spending - Get top spending customers
 * - GET /guest-customers/vip-customers - Identify VIP customers
 * - GET /guest-customers/acquisition-cohort - Get customer acquisition metrics
 * 
 * All endpoints require:
 * - JWT authentication
 * - Tenant context (X-Tenant-ID header or verified via JWT)
 * 
 * Data is scoped to the requesting tenant only
 */
@Controller('guest-customers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class GuestCustomerTrackingController {
  constructor(
    private readonly guestCustomerTrackingService: GuestCustomerTrackingService,
  ) {}

  /**
   * Get guest customer profile by phone
   * 
   * GET /guest-customers/profile/:phone
   * 
   * Shows customer history and preferences at this restaurant:
   * - Total orders and spending
   * - First and last order dates
   * - Favorite items
   * - Average order value
   * - Customer lifetime value
   * 
   * Query Parameters:
   * - phone (required): Customer phone number (e.g., 0788123456 or +250788123456)
   * 
   * Response (200):
   * {
   *   "customer_phone": "0788123456",
   *   "total_orders": 5,
   *   "total_spent": 45000,
   *   "first_order_at": "2024-01-01T14:30:00Z",
   *   "last_order_at": "2024-01-15T18:45:00Z",
   *   "preferred_restaurants": [],
   *   "favorite_items": [
   *     { "item_name": "Pizza Margherita", "frequency": 3 },
   *     { "item_name": "Caesar Salad", "frequency": 2 }
   *   ],
   *   "average_order_value": 9000,
   *   "is_returning_customer": true,
   *   "customer_lifetime_value": 45000
   * }
   * 
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Phone number is required"
   * }
   */
  @Get('profile/:phone')
  async getCustomerProfile(
    @Param('phone') phone: string,
    @GetTenant() tenantId: string,
  ): Promise<GuestCustomerProfile> {
    if (!phone || phone.trim().length === 0) {
      throw new BadRequestException('Phone number is required');
    }

    return this.guestCustomerTrackingService.getCustomerProfile(phone, tenantId);
  }

  /**
   * Get customer order history at this restaurant
   * 
   * GET /guest-customers/order-history/:phone
   * 
   * Shows all orders placed by customer at this tenant
   * 
   * Path Parameters:
   * - phone (required): Customer phone number
   * 
   * Query Parameters:
   * - limit (optional, default: 20): Number of orders to return (max: 100)
   * 
   * Response (200):
   * {
   *   "phone": "0788123456",
   *   "orders": [
   *     {
   *       "order_id": "uuid",
   *       "amount": 15000,
   *       "status": "PAID",
   *       "created_at": "2024-01-15T18:45:00Z",
   *       "items": 3
   *     },
   *     {
   *       "order_id": "uuid",
   *       "amount": 12000,
   *       "status": "PAID",
   *       "created_at": "2024-01-14T12:30:00Z",
   *       "items": 2
   *     }
   *   ],
   *   "total": 2
   * }
   * 
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Phone number is required"
   * }
   */
  @Get('order-history/:phone')
  async getCustomerOrderHistory(
    @Param('phone') phone: string,
    @Query('limit') limit?: string,
    @GetTenant() tenantId?: string,
  ) {
    if (!phone || phone.trim().length === 0) {
      throw new BadRequestException('Phone number is required');
    }

    const parsedLimit = limit ? Math.min(parseInt(limit), 100) : 20;

    if (isNaN(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException('Limit must be a positive number');
    }

    const orders = await this.guestCustomerTrackingService.getCustomerOrderHistory(
      phone,
      tenantId,
      parsedLimit,
    );

    return {
      phone,
      orders,
      total: orders.length,
    };
  }

  /**
   * Check if customer is a returning customer
   * 
   * GET /guest-customers/is-returning/:phone
   * 
   * Determines if customer has placed previous orders at this restaurant
   * 
   * Path Parameters:
   * - phone (required): Customer phone number
   * 
   * Response (200):
   * {
   *   "phone": "0788123456",
   *   "is_returning_customer": true,
   *   "previous_order_count": 5
   * }
   * 
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Phone number is required"
   * }
   */
  @Get('is-returning/:phone')
  async checkIfReturningCustomer(
    @Param('phone') phone: string,
    @GetTenant() tenantId: string,
  ) {
    if (!phone || phone.trim().length === 0) {
      throw new BadRequestException('Phone number is required');
    }

    const isReturning = await this.guestCustomerTrackingService.isReturningCustomer(
      phone,
      tenantId,
    );

    return {
      phone,
      is_returning_customer: isReturning,
    };
  }

  /**
   * Get tenant's customer statistics
   * 
   * GET /guest-customers/stats
   * 
   * Shows aggregate customer metrics for the tenant's dashboard:
   * - Total unique customers
   * - New customers today
   * - Returning customers (2+ orders)
   * - Average customer lifetime value
   * - Top 10 most active customers
   * 
   * Response (200):
   * {
   *   "total_unique_customers": 1250,
   *   "new_customers_today": 45,
   *   "returning_customers": 380,
   *   "avg_customer_lifetime_value": 35000,
   *   "most_active_customers": [
   *     {
   *       "phone": "0788123456",
   *       "orders": 52,
   *       "spent": 450000
   *     },
   *     {
   *       "phone": "0789654321",
   *       "orders": 48,
   *       "spent": 420000
   *     }
   *   ]
   * }
   */
  @Get('stats')
  async getTenantCustomerStats(@GetTenant() tenantId: string): Promise<CustomerStatistics> {
    return this.guestCustomerTrackingService.getTenantCustomerStats(tenantId);
  }

  /**
   * Get top spending customers (for loyalty offers)
   * 
   * GET /guest-customers/top-spending
   * 
   * Identifies customers with highest lifetime value for:
   * - Loyalty program targeting
   * - VIP offers and discounts
   * - Special promotions
   * 
   * Query Parameters:
   * - limit (optional, default: 20): Number of customers to return (max: 100)
   * 
   * Response (200):
   * [
   *   {
   *     "customer_phone": "0788123456",
   *     "total_orders": 52,
   *     "total_spent": 450000,
   *     "first_order_at": "2023-01-15T14:30:00Z",
   *     "last_order_at": "2024-01-15T18:45:00Z",
   *     "favorite_items": [
   *       { "item_name": "Premium Steak", "frequency": 15 },
   *       { "item_name": "House Wine", "frequency": 12 }
   *     ],
   *     "average_order_value": 8654,
   *     "is_returning_customer": true,
   *     "customer_lifetime_value": 450000
   *   }
   * ]
   * 
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Limit must be between 1 and 100"
   * }
   */
  @Get('top-spending')
  async getTopSpendingCustomers(
    @Query('limit') limit?: string,
    @GetTenant() tenantId?: string,
  ): Promise<GuestCustomerProfile[]> {
    const parsedLimit = limit ? Math.min(parseInt(limit), 100) : 20;

    if (isNaN(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException('Limit must be a positive number between 1 and 100');
    }

    return this.guestCustomerTrackingService.getTopSpendingCustomers(tenantId, parsedLimit);
  }

  /**
   * Identify VIP customers
   * 
   * GET /guest-customers/vip-customers
   * 
   * Identifies customers who meet VIP criteria:
   * - Customer lifetime value >= threshold
   * - Used for loyalty programs, special treatment, promotions
   * 
   * Query Parameters:
   * - min_lifetime_value (optional, default: 100000): Minimum lifetime value to be VIP
   * 
   * Response (200):
   * {
   *   "vip_customers": [
   *     "0788123456",
   *     "0789654321",
   *     "0788999999"
   *   ],
   *   "total_vips": 3,
   *   "min_lifetime_value": 100000
   * }
   */
  @Get('vip-customers')
  async identifyVIPCustomers(
    @Query('min_lifetime_value') minLifetimeValue?: string,
    @GetTenant() tenantId?: string,
  ) {
    const parsedMinValue = minLifetimeValue ? parseInt(minLifetimeValue) : 100000;

    if (isNaN(parsedMinValue) || parsedMinValue < 0) {
      throw new BadRequestException('min_lifetime_value must be a non-negative number');
    }

    const vipCustomers = await this.guestCustomerTrackingService.identifyVIPCustomers(
      tenantId,
      parsedMinValue,
    );

    return {
      vip_customers: vipCustomers,
      total_vips: vipCustomers.length,
      min_lifetime_value: parsedMinValue,
    };
  }

  /**
   * Get customer acquisition metrics and cohort analysis
   * 
   * GET /guest-customers/acquisition-cohort
   * 
   * Analyzes customer acquisition trends:
   * - New customers acquired in the period
   * - Returning customers (retained from before)
   * - Churn rate (customers lost)
   * 
   * Query Parameters:
   * - days (optional, default: 30): Number of days to analyze
   * 
   * Response (200):
   * {
   *   "period_days": 30,
   *   "new_customers": 125,
   *   "returning_from_previous": 450,
   *   "churn_rate": 0.15,
   *   "retention_rate": 0.85,
   *   "total_active": 575
   * }
   * 
   * Response (400):
   * {
   *   "statusCode": 400,
   *   "message": "Days must be between 1 and 365"
   * }
   */
  @Get('acquisition-cohort')
  async getCustomerAcquisitionCohort(
    @Query('days') days?: string,
    @GetTenant() tenantId?: string,
  ) {
    const parsedDays = days ? parseInt(days) : 30;

    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      throw new BadRequestException('Days must be between 1 and 365');
    }

    const cohortData = await this.guestCustomerTrackingService.getCustomerAcquisitionCohort(
      tenantId,
      parsedDays,
    );

    return {
      period_days: parsedDays,
      ...cohortData,
      retention_rate: 1 - cohortData.churn_rate,
      total_active: cohortData.new_customers + cohortData.returning_from_previous,
    };
  }
}
