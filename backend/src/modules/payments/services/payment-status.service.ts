import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { PaymentTransaction } from '../entities/payment.entity';

/**
 * PaymentStatusService
 * 
 * Provides persistent payment status queries for customers.
 * 
 * Why this exists:
 * WebSockets are unreliable in African networks.
 * Customers need a simple GET endpoint to check "Is my payment confirmed?"
 * 
 * API: GET /orders/:id/payment-status
 * 
 * Returns normalized status with last update timestamp.
 * Useful for retrying/debugging payment issues.
 */
@Injectable()
export class PaymentStatusService {
  private readonly logger = new Logger(PaymentStatusService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
  ) {}

  /**
   * Get payment status for order
   * 
   * Returns:
   * - status: PENDING | SUCCESS | FAILED
   * - amount: order total
   * - reference: tx_ref or flutterwave_id
   * - last_updated: timestamp
   */
  async getPaymentStatus(orderId: string): Promise<{
    order_id: string;
    payment_status: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    amount: number;
    reference: string;
    payment_method: string;
    last_updated: Date;
    message: string;
  }> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Normalize status
      let status: 'PENDING' | 'SUCCESS' | 'FAILED' = 'PENDING';
      let message = 'Payment awaiting confirmation';

      if (order.payment_status === PaymentStatusEnum.PAID) {
        status = 'SUCCESS';
        message = 'Payment confirmed';
      } else if (order.payment_status === PaymentStatusEnum.FAILED) {
        status = 'FAILED';
        message = 'Payment failed - please retry or try different method';
      } else if (order.payment_status === PaymentStatusEnum.CANCELLED) {
        status = 'FAILED';
        message = 'Payment was cancelled';
      }

      return {
        order_id: orderId,
        payment_status: order.payment_status,
        status,
        amount: order.total_amount,
        reference: order.tx_ref || order.flutterwave_id || 'unknown',
        payment_method: order.payment_method,
        last_updated: order.updated_at,
        message,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get payment status for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get payment transaction details (for admin/support)
   */
  async getPaymentTransaction(orderId: string): Promise<PaymentTransaction | null> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order || !order.flutterwave_id) {
      return null;
    }

    return this.paymentTransactionRepository.findOne({
      where: { provider_ref: order.flutterwave_id },
    });
  }
}
