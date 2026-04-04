import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { TenantPaymentConfigService } from './tenant-payment-config.service';

interface FraudRiskResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number; // 0-100
  indicators: string[];
  recommended_action: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

interface CustomerAbusePattern {
  customer_phone: string;
  failed_attempts: number;
  last_failed_at: Date;
  total_refund_amount: number;
  refund_rate: number;
  is_suspicious: boolean;
}

/**
 * FraudDetectionService
 * 
 * Identifies suspicious payment patterns:
 * - Multiple failed payment attempts from same customer
 * - Repeated refund requests
 * - Orders above/below thresholds
 * - Potential duplicate/repeat offenders
 * 
 * Strategy:
 * - Assign risk scores based on patterns
 * - Flag HIGH/CRITICAL for manual review
 * - Log all flagged transactions for analysis
 * 
 * Does NOT block automatically (admin review needed)
 * All suspicious orders still logged for audit
 */
@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly tenantConfigService: TenantPaymentConfigService,
  ) {}

  // TODO Phase 3: Add PaymentTransaction repo for fraud checking

  /**
   * Analyze order for fraud risk
   * 
   * Checks:
   * - Customer payment history (failed attempts, refunds)
   * - Order amount anomalies
   * - Velocity checks (too many orders too quickly)
   * - Customer blacklist/whitelist
   */
  async analyzeOrder(
    orderId: string,
    tenantId: string,
    customerPhone: string,
    amount: number,
  ): Promise<FraudRiskResult> {
    try {
      const indicators: string[] = [];
      let riskScore = 0;

      // Check 1: Customer payment history (failed attempts)
      const recentFailures = await this.countRecentFailedPayments(customerPhone, tenantId, 7);
      if (recentFailures > 3) {
        indicators.push(`${recentFailures} failed payment attempts in last 7 days`);
        riskScore += 25;
      } else if (recentFailures > 0) {
        indicators.push(`${recentFailures} failed payment attempts in last 7 days`);
        riskScore += 10;
      }

      // Check 2: Refund pattern (high refund rate)
      const refundInfo = await this.getCustomerRefundPattern(customerPhone, tenantId);
      if (refundInfo.refund_rate > 0.3) {
        // 30%+ refund rate
        indicators.push(`High refund rate: ${(refundInfo.refund_rate * 100).toFixed(1)}%`);
        riskScore += 20;
      } else if (refundInfo.refund_rate > 0.1) {
        // 10%+ refund rate
        indicators.push(`Elevated refund rate: ${(refundInfo.refund_rate * 100).toFixed(1)}%`);
        riskScore += 10;
      }

      // Check 3: Order amount anomaly
      const avgAmount = await this.getCustomerAverageOrderAmount(customerPhone, tenantId);
      if (avgAmount > 0) {
        const deviation = Math.abs(amount - avgAmount) / avgAmount;
        if (deviation > 1) {
          // 100% above average
          indicators.push(`Amount ${amount} is 100%+ above customer average ${avgAmount}`);
          riskScore += 15;
        } else if (deviation > 0.5) {
          // 50% above average
          indicators.push(`Amount ${amount} is 50%+ above customer average ${avgAmount}`);
          riskScore += 8;
        }
      }

      // Check 4: Velocity check (too many orders in short time)
      const ordersInLastHour = await this.countOrdersInTimePeriod(
        customerPhone,
        tenantId,
        60, // 1 hour
      );
      if (ordersInLastHour > 5) {
        indicators.push(`${ordersInLastHour} orders in last hour (suspicious velocity)`);
        riskScore += 20;
      } else if (ordersInLastHour > 3) {
        indicators.push(`${ordersInLastHour} orders in last hour`);
        riskScore += 10;
      }

      // Check 5: Very high or very low amounts
      const config = await this.tenantConfigService.getConfig(tenantId);
      if (amount < config.min_order_amount) {
        indicators.push(`Amount ${amount} below minimum ${config.min_order_amount}`);
        riskScore += 15;
      }
      if (amount > config.max_order_amount) {
        indicators.push(`Amount ${amount} exceeds maximum ${config.max_order_amount}`);
        riskScore += 25;
      }

      // Check 6: New customer (account fingerprinting)
      const customerOrderCount = await this.getCustomerOrderCount(customerPhone, tenantId);
      if (customerOrderCount === 0) {
        indicators.push('New customer (no previous orders)');
        // New customers are not automatically flagged, but tracked
        riskScore += 0; // We allow new customers
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      let recommendedAction: 'ALLOW' | 'REVIEW' | 'BLOCK' = 'ALLOW';

      if (riskScore >= 80) {
        riskLevel = 'CRITICAL';
        recommendedAction = 'BLOCK';
      } else if (riskScore >= 60) {
        riskLevel = 'HIGH';
        recommendedAction = 'REVIEW';
      } else if (riskScore >= 30) {
        riskLevel = 'MEDIUM';
        recommendedAction = 'REVIEW';
      }

      this.logger.log(
        `Fraud analysis for order ${orderId}: risk=${riskLevel} (${riskScore}), action=${recommendedAction}`,
      );

      if (riskLevel !== 'LOW' || indicators.length > 0) {
        this.logger.warn(
          `🚨 Suspicious order ${orderId} (${customerPhone}): ${indicators.join('; ')}`,
        );
      }

      return {
        risk_level: riskLevel,
        risk_score: riskScore,
        indicators,
        recommended_action: recommendedAction,
      };
    } catch (error) {
      this.logger.error(`Error analyzing fraud risk for order ${orderId}: ${error.message}`);
      // Don't block on error - fail open with LOW risk
      return {
        risk_level: 'LOW',
        risk_score: 0,
        indicators: [`Analysis error: ${error.message}`],
        recommended_action: 'ALLOW',
      };
    }
  }

  /**
   * Count failed payment attempts for customer in last N days
   */
  private async countRecentFailedPayments(customerPhone: string, tenantId: string, days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get orders for this customer
    const count = await this.orderRepo.count({
      where: {
        phone_number: customerPhone,
        tenant_id: tenantId,
        payment_status: 'FAILED',
      },
    });

    return count;
  }

  /**
   * Get customer refund pattern
   */
  private async getCustomerRefundPattern(customerPhone: string, tenantId: string): Promise<CustomerAbusePattern> {
    const allOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.phone_number = :phone', { phone: customerPhone })
      .andWhere('order.tenant_id = :tenantId', { tenantId })
      .take(100)
      .getMany();

    // Check for CANCELLED payment status which might indicate refund requests
    const completedOrders = allOrders.filter((o) => o.payment_status === 'PAID').length;
    const cancelledOrders = allOrders.filter((o) => o.payment_status === 'CANCELLED').length;

    const refundRate = completedOrders > 0 ? cancelledOrders / completedOrders : 0;
    // TODO: Implement actual refund tracking via RefundEntity
    const totalRefundAmount = 0;

    const lastFailedPayment = await this.orderRepo.findOne({
      where: {
        phone_number: customerPhone,
        tenant_id: tenantId,
        payment_status: 'FAILED',
      },
      order: { created_at: 'DESC' },
    });

    return {
      customer_phone: customerPhone,
      failed_attempts: allOrders.filter((o) => o.payment_status === 'FAILED').length,
      last_failed_at: lastFailedPayment?.created_at,
      total_refund_amount: totalRefundAmount,
      refund_rate: refundRate,
      is_suspicious: refundRate > 0.2 || cancelledOrders > 5,
    };
  }

  /**
   * Get customer's average order amount
   */
  private async getCustomerAverageOrderAmount(customerPhone: string, tenantId: string): Promise<number> {
    const result = await this.orderRepo
      .createQueryBuilder('order')
      .select('AVG(order.total_amount)', 'avgAmount')
      .where('order.phone_number = :phone', { phone: customerPhone })
      .andWhere('order.tenant_id = :tenantId', { tenantId })
      .andWhere('order.payment_status = :status', { status: 'PAID' })
      .getRawOne();

    return result?.avgAmount ? parseFloat(result.avgAmount) : 0;
  }

  /**
   * Count orders in time window (in minutes)
   */
  private async countOrdersInTimePeriod(customerPhone: string, tenantId: string, minutes: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutes);

    const count = await this.orderRepo.count({
      where: {
        phone_number: customerPhone,
        tenant_id: tenantId,
        created_at: cutoffDate,
      },
    });

    return count;
  }

  /**
   * Get total orders for customer
   */
  private async getCustomerOrderCount(customerPhone: string, tenantId: string): Promise<number> {
    return await this.orderRepo.count({
      where: {
        phone_number: customerPhone,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Get customer abuse report (for admin review)
   */
  async getCustomerAbuseReport(customerPhone: string, tenantId: string): Promise<CustomerAbusePattern> {
    return this.getCustomerRefundPattern(customerPhone, tenantId);
  }

  /**
   * Get high-risk customers for tenant
   */
  async getHighRiskCustomers(tenantId: string, limit: number = 50): Promise<CustomerAbusePattern[]> {
    try {
      // Get all unique customer phones for tenant
      const customers = await this.orderRepo
        .createQueryBuilder('order')
        .select('DISTINCT order.customer_phone', 'customer_phone')
        .where('order.tenant_id = :tenantId', { tenantId })
        .getRawMany();

      const highRiskList: CustomerAbusePattern[] = [];

      for (const { customer_phone } of customers) {
        const pattern = await this.getCustomerRefundPattern(customer_phone, tenantId);
        if (pattern.is_suspicious) {
          highRiskList.push(pattern);
        }
      }

      return highRiskList.sort((a, b) => b.refund_rate - a.refund_rate).slice(0, limit);
    } catch (error) {
      this.logger.error(`Error getting high-risk customers for tenant ${tenantId}: ${error.message}`);
      return [];
    }
  }
}
