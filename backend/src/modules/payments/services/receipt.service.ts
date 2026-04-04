import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

/**
 * ReceiptService
 * 
 * Generates proof of payment receipts.
 * 
 * Can be:
 * - Displayed on customer phone
 * - Printed at restaurant
 * - Emailed to customer
 */
@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  // TODO Phase 3: Add PaymentTransaction repository for detailed receipt generation

  /**
   * Generate receipt for payment
   */
  async generateReceipt(orderId: string): Promise<{
    receipt_id: string;
    order_number: string;
    order_code: string;
    amount: number;
    currency: string;
    status: string;
    transaction_ref: string;
    payment_method: string;
    date: Date;
    restaurant_name: string;
  }> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['tenant'],
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      return {
        receipt_id: `RCP-${order.id.substring(0, 8).toUpperCase()}`,
        order_number: order.order_number,
        order_code: order.order_code,
        amount: order.total_amount,
        currency: 'RWF',
        status: order.payment_status,
        transaction_ref: order.tx_ref || order.flutterwave_id || 'N/A',
        payment_method: order.payment_method,
        date: order.created_at,
        restaurant_name: order.tenant?.name || 'Restaurant',
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate receipt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get receipt as formatted text (for printing)
   */
  async getReceiptText(orderId: string): Promise<string> {
    const receipt = await this.generateReceipt(orderId);

    return `
═══════════════════════════════
${receipt.restaurant_name}
═══════════════════════════════

Order #${receipt.order_number}
Code: ${receipt.order_code}

Amount: ${receipt.amount.toLocaleString()} ${receipt.currency}
Payment: ${receipt.payment_method}
Status: ${receipt.status}

Reference: ${receipt.transaction_ref}

Date: ${receipt.date.toLocaleString()}

Thank you for your order!

═══════════════════════════════
    `;
  }
}
