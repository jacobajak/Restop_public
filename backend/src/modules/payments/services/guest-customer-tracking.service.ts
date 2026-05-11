import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export interface GuestCustomerProfile {
  customer_phone: string;
  total_orders: number;
  total_spent: number;
  first_order_at: Date;
  last_order_at: Date;
  preferred_restaurants: Array<{ tenant_id: string; order_count: number; total_spent: number }>;
  favorite_items: Array<{ item_name: string; frequency: number }>;
  average_order_value: number;
  is_returning_customer: boolean;
  customer_lifetime_value: number;
}

export interface CustomerStatistics {
  total_unique_customers: number;
  new_customers_today: number;
  returning_customers: number;
  avg_customer_lifetime_value: number;
  most_active_customers: Array<{ phone: string; orders: number; spent: number }>;
}

/**
 * GuestCustomerTrackingService
 * 
 * Tracks guest customers (phone number based, no account required)
 * Enables:
 * - Customer history without login
 * - Repeat customer identification
 * - Building customer profiles for loyalty
 * - Business analytics (customer lifetime value)
 * 
 * Strategy:
 * - Use phone number as primary identifier
 * - Track across all orders (no account required)
 * - Enable restaurant to build customer relationship
 * - Privacy respected (phone only, no tracking beyond orders)
 */
@Injectable()
export class GuestCustomerTrackingService {
  private readonly logger = new Logger(GuestCustomerTrackingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  /**
   * Get guest customer profile by phone
   * Shows customer history and preferences
   */
  async getCustomerProfile(customerPhone: string, tenantId: string): Promise<GuestCustomerProfile> {
    try {
      // Get all orders for this customer at this restaurant
      const orders = await this.orderRepo
        .createQueryBuilder('order')
        .where('order.phone_number = :phone', { phone: customerPhone })
        .andWhere('order.tenant_id = :tenantId', { tenantId })
        .leftJoinAndSelect('order.items', 'items')
        .orderBy('order.created_at', 'DESC')
        .getMany();

      if (orders.length === 0) {
        return {
          customer_phone: customerPhone,
          total_orders: 0,
          total_spent: 0,
          first_order_at: null,
          last_order_at: null,
          preferred_restaurants: [],
          favorite_items: [],
          average_order_value: 0,
          is_returning_customer: false,
          customer_lifetime_value: 0,
        };
      }

      // Calculate stats
      const totalSpent = orders
        .filter((o) => o.payment_status === 'PAID')
        .reduce((sum, order) => sum + order.total_amount, 0);
      const successfulOrders = orders.filter((o) => o.payment_status === 'PAID').length;
      const average = successfulOrders > 0 ? totalSpent / successfulOrders : 0;

      // Get favorite items (across all orders)
      const itemFrequency = new Map<string, { name: string; count: number }>();
      orders.forEach((order) => {
        if (order.items) {
          order.items.forEach((item) => {
            const key = item.name;
            if (itemFrequency.has(key)) {
              const existing = itemFrequency.get(key);
              existing.count += item.quantity;
            } else {
              itemFrequency.set(key, { name: item.name, count: item.quantity });
            }
          });
        }
      });

      const favoriteItems = Array.from(itemFrequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item) => ({ item_name: item.name, frequency: item.count }));

      return {
        customer_phone: customerPhone,
        total_orders: orders.length,
        total_spent: totalSpent,
        first_order_at: orders[orders.length - 1]?.created_at,
        last_order_at: orders[0]?.created_at,
        preferred_restaurants: [],
        favorite_items: favoriteItems,
        average_order_value: average,
        is_returning_customer: orders.length > 1,
        customer_lifetime_value: totalSpent,
      };
    } catch (error) {
      this.logger.error(`Error getting customer profile for ${customerPhone}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if customer is returning (has previous orders)
   */
  async isReturningCustomer(customerPhone: string, tenantId: string): Promise<boolean> {
    try {
      const count = await this.orderRepo.count({
        where: {
          phone_number: customerPhone,
          tenant_id: tenantId,
          payment_status: 'PAID',
        },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(`Error checking if returning customer: ${error.message}`);
      return false;
    }
  }

  /**
   * Get customer's order history at this restaurant
   */
  async getCustomerOrderHistory(
    customerPhone: string,
    tenantId: string,
    limit: number = 20,
  ): Promise<Array<{ order_id: string; amount: number; status: string; created_at: Date; items: number }>> {
    try {
      const orders = await this.orderRepo
        .createQueryBuilder('order')
        .select(['order.id', 'order.total_amount', 'order.payment_status', 'order.created_at'])
        .where('order.phone_number = :phone', { phone: customerPhone })
        .andWhere('order.tenant_id = :tenantId', { tenantId })
        .leftJoinAndSelect('order.items', 'items')
        .orderBy('order.created_at', 'DESC')
        .take(limit)
        .getMany();

      return orders.map((o) => ({
        order_id: o.id,
        amount: o.total_amount,
        status: o.payment_status,
        created_at: o.created_at,
        items: o.items?.length || 0,
      }));
    } catch (error) {
      this.logger.error(`Error getting order history for ${customerPhone}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer statistics for tenant dashboard
   * Shows: total unique customers, new today, returning, CLV
   */
  async getTenantCustomerStats(tenantId: string): Promise<CustomerStatistics> {
    try {
      // Total unique customers
      const totalCustomers = await this.orderRepo
        .createQueryBuilder('order')
        .select('COUNT(DISTINCT order.phone_number)', 'count')
        .where('order.tenant_id = :tenantId', { tenantId })
        .getRawOne();

      // New customers today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newCustomersToday = await this.orderRepo
        .createQueryBuilder('order')
        .select('COUNT(DISTINCT order.phone_number)', 'count')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.created_at >= :today', { today })
        .andWhere('order.payment_status = :status', { status: 'PAID' })
        .getRawOne();

      // Returning customers (have 2+ orders)
      const returningCustomersResult = await this.orderRepo
        .createQueryBuilder('order')
        .select('COUNT(DISTINCT order.phone_number)', 'count')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.payment_status = :status', { status: 'PAID' })
        .groupBy('order.phone_number')
        .having('COUNT(order.id) > 1')
        .getRawMany();

      const returningCount = returningCustomersResult.length;

      // Average customer lifetime value
      const clvResult = await this.orderRepo
        .createQueryBuilder('order')
        .select('AVG(totals.total)', 'avgClv')
        .from(
          (qb) =>
            qb
              .select('order.phone_number')
              .addSelect('SUM(order.total_amount)', 'total')
              .from(Order, 'order')
              .where('order.tenant_id = :tenantId', { tenantId })
              .andWhere('order.payment_status = :status', { status: 'PAID' })
              .groupBy('order.phone_number'),
          'totals',
        )
        .getRawOne();

      const avgCLV = clvResult?.avgClv ? parseFloat(clvResult.avgClv) : 0;

      // Most active customers
      const mostActive = await this.orderRepo
        .createQueryBuilder('order')
        .select('order.phone_number', 'phone')
        .addSelect('COUNT(order.id)', 'orders')
        .addSelect('SUM(order.total_amount)', 'spent')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.payment_status = :status', { status: 'PAID' })
        .groupBy('order.phone_number')
        .orderBy('spent', 'DESC')
        .take(10)
        .getRawMany();

      return {
        total_unique_customers: parseInt(totalCustomers?.count || '0'),
        new_customers_today: parseInt(newCustomersToday?.count || '0'),
        returning_customers: returningCount,
        avg_customer_lifetime_value: avgCLV,
        most_active_customers: mostActive.map((row) => ({
          phone: row.phone,
          orders: parseInt(row.orders),
          spent: parseInt(row.spent),
        })),
      };
    } catch (error) {
      this.logger.error(`Error getting customer stats for tenant ${tenantId}: ${error.message}`);
      return {
        total_unique_customers: 0,
        new_customers_today: 0,
        returning_customers: 0,
        avg_customer_lifetime_value: 0,
        most_active_customers: [],
      };
    }
  }

  /**
   * Identify top spending customers (for loyalty offers)
   */
  async getTopSpendingCustomers(tenantId: string, limit: number = 20): Promise<GuestCustomerProfile[]> {
    try {
      const customers = await this.orderRepo
        .createQueryBuilder('order')
        .select('order.phone_number', 'phone')
        .addSelect('SUM(order.total_amount)', 'total_spent')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.payment_status = :status', { status: 'PAID' })
        .groupBy('order.phone_number')
        .orderBy('total_spent', 'DESC')
        .take(limit)
        .getRawMany();

      const profiles: GuestCustomerProfile[] = [];
      for (const customer of customers) {
        const profile = await this.getCustomerProfile(customer.phone, tenantId);
        profiles.push(profile);
      }

      return profiles;
    } catch (error) {
      this.logger.error(`Error getting top spending customers for tenant ${tenantId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Mark customer as VIP (for internal tracking)
   * Could trigger loyalty offers, discounts, priority service
   */
  async identifyVIPCustomers(tenantId: string, minLifetimeValue: number = 100000): Promise<string[]> {
    try {
      const vips = await this.orderRepo
        .createQueryBuilder('order')
        .select('order.phone_number', 'phone')
        .addSelect('SUM(order.total_amount)', 'total_spent')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.payment_status = :status', { status: 'PAID' })
        .groupBy('order.phone_number')
        .having('SUM(order.total_amount) >= :minValue', { minValue: minLifetimeValue })
        .getRawMany();

      return vips.map((v) => v.phone);
    } catch (error) {
      this.logger.error(`Error identifying VIP customers for tenant ${tenantId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get customer acquisition metrics (how customers found us)
   * Via orders from same phone over time
   */
  async getCustomerAcquisitionCohort(tenantId: string, days: number = 30): Promise<{
    new_customers: number;
    returning_from_previous: number;
    churn_rate: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // New customers in period (no orders before cutoff)
      const newCustomersQuery = `
        SELECT DISTINCT o1.phone_number
        FROM "orders" o1
        WHERE o1.tenant_id = :tenantId
        AND o1.created_at >= :cutoffDate
        AND NOT EXISTS (
          SELECT 1 FROM "orders" o2
          WHERE o2.phone_number = o1.phone_number
          AND o2.tenant_id = :tenantId
          AND o2.created_at < :cutoffDate
        )
        AND o1.payment_status = 'PAID'
      `;

      // Returning customers (had orders before, still ordering)
      const returningQuery = `
        SELECT DISTINCT o1.phone_number
        FROM "orders" o1
        WHERE o1.tenant_id = :tenantId
        AND o1.created_at >= :cutoffDate
        AND EXISTS (
          SELECT 1 FROM "orders" o2
          WHERE o2.phone_number = o1.phone_number
          AND o2.tenant_id = :tenantId
          AND o2.created_at < :cutoffDate
        )
        AND o1.payment_status = 'PAID'
      `;

      const newCount = await this.orderRepo.query(newCustomersQuery, [tenantId, cutoffDate]);
      const returningCount = await this.orderRepo.query(returningQuery, [tenantId, cutoffDate]);

      // Simple churn: customers with orders before but not in period
      const priorCustomers = await this.orderRepo
        .createQueryBuilder('order')
        .select('COUNT(DISTINCT order.phone_number)', 'count')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.created_at < :cutoffDate', { cutoffDate })
        .getRawOne();

      const churnRate =
        returningCount.length > 0 && priorCustomers.count > 0
          ? (parseFloat(priorCustomers.count) - returningCount.length) / parseFloat(priorCustomers.count)
          : 0;

      return {
        new_customers: newCount.length,
        returning_from_previous: returningCount.length,
        churn_rate: Math.max(0, churnRate), // prevent negative
      };
    } catch (error) {
      this.logger.error(`Error getting acquisition cohort for tenant ${tenantId}: ${error.message}`);
      return { new_customers: 0, returning_from_previous: 0, churn_rate: 0 };
    }
  }
}
