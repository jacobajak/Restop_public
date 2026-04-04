import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Order,
  OrderStatusEnum,
  PaymentStatusEnum,
} from '../entities/order.entity';
import { RefundService } from '../../payments/services/refund.service';
import { RefundReasonEnum } from '../../payments/entities/refund.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentEventService } from '../../payments/services/payment-event.service';
import { PaymentEventTypeEnum } from '../../payments/entities/payment-event.entity';

/**
 * OrderCancellationService
 * 
 * Handles order cancellation with proper state management.
 * 
 * Rules:
 * - PENDING_PAYMENT: Cancel payment, refund if needed
 * - CONFIRMED: Restrict cancellation (in progress)
 * - PREPARING: No cancellation allowed
 * - READY: No cancellation allowed
 * - COMPLETED: Cannot cancel
 * 
 * When cancelling:
 * 1. If order is PAID → trigger refund
 * 2. If order is PENDING → release payment lock
 * 3. Mark order as CANCELLED
 * 4. Notify customer + tenant
 */
@Injectable()
export class OrderCancellationService {
  private readonly logger = new Logger(OrderCancellationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly refundService: RefundService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentEventService: PaymentEventService,
  ) {}

  /**
   * Cancel an order
   * 
   * Rules:
   * - Only certain statuses can be cancelled
   * - If paid, triggers refund
   * - Notifies customer and tenant
   */
  async cancelOrder(
    orderId: string,
    cancellationReason: string,
    cancelledBy: string, // user ID or 'system' or 'customer'
  ): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Validate order can be cancelled
      const restrictedStatuses = [
        OrderStatusEnum.PREPARING,
        OrderStatusEnum.READY,
        OrderStatusEnum.COMPLETED,
        OrderStatusEnum.REJECTED,
      ];

      if (restrictedStatuses.includes(order.status as OrderStatusEnum)) {
        throw new BadRequestException(
          `Cannot cancel order with status=${order.status}. Only PENDING_PAYMENT and CONFIRMED can be cancelled.`,
        );
      }

      this.logger.log(
        `📋 Cancelling order ${orderId}: reason=${cancellationReason}, by=${cancelledBy}`,
      );

      // Handle payment refund if order was paid
      if (order.payment_status === PaymentStatusEnum.PAID) {
        this.logger.log(`💰 Order was paid - initiating refund...`);

        try {
          // Request refund (will be PENDING admin approval)
          const refund = await this.refundService.requestRefund(
            orderId,
            RefundReasonEnum.ORDER_CANCELLED,
            order.total_amount,
          );

          // Auto-approve refund for cancellations (immediate action)
          await this.refundService.approveRefund(
            refund.id,
            'system',
            `Auto-approved refund for order cancellation: ${cancellationReason}`,
          );

          await this.paymentEventService.logEvent(
            orderId,
            PaymentEventTypeEnum.CANCELLED,
            {
              description: 'Order cancelled - refund initiated',
              payload: { refund_id: refund.id },
            },
          );
        } catch (refundError: any) {
          this.logger.error(
            `Warning: Refund processing failed: ${refundError.message}. Order cancelled but refund may need manual approval.`,
          );
          // Continue with cancellation even if refund fails
          // Refund will be marked as FAILED and flagged for manual review
        }
      } else if (order.payment_status === PaymentStatusEnum.PENDING) {
        // Release payment lock for pending payments
        order.payment_locked = false;
        await this.paymentEventService.logEvent(
          orderId,
          PaymentEventTypeEnum.CANCELLED,
          {
            description: 'Order cancelled - payment was pending',
          },
        );
      }

      // Mark order as CANCELLED
      order.status = OrderStatusEnum.CANCELLED;
      order.cancelled_at = new Date();
      order.cancelled_by = cancelledBy;
      order.cancellation_reason = cancellationReason;

      const savedOrder = await this.orderRepository.save(order);

      this.logger.log(
        `✅ Order cancelled: ${orderId}, status=${savedOrder.status}`,
      );

      // Notify customer (fire and forget)
      try {
        await this.notificationsService.notifyOrderUpdated(
          order.tenant_id,
          orderId,
          savedOrder,
        );
      } catch (err: any) {
        this.logger.error(`Failed to notify customer of cancellation: ${err.message}`);
      }

      return savedOrder;
    } catch (error: any) {
      this.logger.error(`Failed to cancel order ${orderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get orders that were cancelled (for reporting)
   */
  async getCancelledOrders(tenantId: string, limit: number = 50): Promise<Order[]> {
    return this.orderRepository.find({
      where: { tenant_id: tenantId, status: OrderStatusEnum.CANCELLED },
      order: { cancelled_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get cancellation statistics for tenant
   */
  async getCancellationStats(tenantId: string): Promise<{
    total_cancelled: number;
    total_refunded: number;
    total_refund_amount: number;
  }> {
    const cancelled = await this.orderRepository.count({
      where: { tenant_id: tenantId, status: OrderStatusEnum.CANCELLED },
    });

    // This would typically join with refunds table
    // For now, returning basic stats
    return {
      total_cancelled: cancelled,
      total_refunded: 0, // TODO: Count from Refund entity
      total_refund_amount: 0, // TODO: Sum from Refund entity
    };
  }
}
