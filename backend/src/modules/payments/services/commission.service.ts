import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commission, CommissionStatusEnum } from '../entities/commission.entity';
import { Order } from '../../orders/entities/order.entity';

/**
 * CommissionService
 * 
 * Spec: Section 11 — Commission Logic
 * 
 * For MVP: Tenant receives full order amount, DineFlow only records commission internally.
 * Commission is a ledger entry (not deducted from payout).
 * 
 * Example:
 * - Order amount: 10,000 RWF
 * - Commission rate: 10% (1,000 RWF)
 * - Instant payout to tenant: 10,000 RWF (full amount)
 * - Commission ledger: 1,000 RWF owed to DineFlow
 * 
 * Future: Commission can be settled later via invoice or different payment split.
 */
@Injectable()
export class CommissionService {
  // Commission rate: 10% (configurable)
  private readonly COMMISSION_RATE = 0.10;

  constructor(
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Record commission for completed order
   * 
   * Called after payment is confirmed (MoMo webhook successful or cash staff confirms paid).
   * 
   * Spec: Section 11 — Commission Logic
   * 
   * Calculates commission as percentage of order total.
   * Tenant still receives full payout amount (commission not deducted).
   * Commission is only recorded in ledger for future settlement.
   * 
   * @param orderId Order ID
   * @param tenantId Tenant ID for authorization
   * @returns Commission record created
   */
  async recordCommission(orderId: string, tenantId: string): Promise<Commission> {
    // Find order
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if commission already recorded (idempotency)
    const existingCommission = await this.commissionRepository.findOne({
      where: { order_id: orderId },
    });

    if (existingCommission) {
      return existingCommission; // Return existing record instead of creating duplicate
    }

    // Calculate commission as percentage of order total
    const commissionAmount = Math.round(order.total_amount * this.COMMISSION_RATE);
    const commissionRate = this.COMMISSION_RATE;

    // Create commission ledger entry
    const commission = this.commissionRepository.create({
      tenant_id: tenantId,
      order_id: orderId,
      commission_rate: commissionRate,
      amount: commissionAmount,
      status: CommissionStatusEnum.PENDING,
    });

    return this.commissionRepository.save(commission);
  }

  /**
   * Get commission for order
   * 
   * @async
   * @param {string} orderId - Order ID
   * @returns {Promise<Commission>} Commission record or null
   */
  async getCommissionForOrder(orderId: string): Promise<Commission | null> {
    return this.commissionRepository.findOne({
      where: { order_id: orderId },
    });
  }

  /**
   * Get pending commissions for tenant
   * 
   * Useful for dashboard showing unsettled commissions
   * 
   * @async
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Commission[]>} List of pending commissions
   */
  async getPendingCommissions(tenantId: string): Promise<Commission[]> {
    return this.commissionRepository.find({
      where: {
        tenant_id: tenantId,
        status: CommissionStatusEnum.PENDING,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Calculate total pending commission for tenant
   * 
   * @async
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<number>} Total pending amount
   */
  async getTotalPendingCommission(tenantId: string): Promise<number> {
    const result = await this.commissionRepository
      .createQueryBuilder('commission')
      .where('commission.tenant_id = :tenantId', { tenantId })
      .andWhere('commission.status = :status', { status: CommissionStatusEnum.PENDING })
      .select('SUM(commission.amount)', 'total')
      .getRawOne();

    return result?.total || 0;
  }
}
