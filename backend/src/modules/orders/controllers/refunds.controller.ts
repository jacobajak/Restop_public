import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { RefundService } from '../../payments/services/refund.service';
import { RefundReasonEnum } from '../../payments/entities/refund.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';

/**
 * RefundsController - Customer-facing refund management
 *
 * Allows merchants to:
 * - Request refunds for orders
 * - View refund status for orders
 *
 * POST /orders/:id/request-refund - Request refund for order
 * GET /orders/:id/refund-status - Check refund status
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(
    private readonly refundService: RefundService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Request refund for an order
   *
   * Body:
   * - reason: CUSTOMER_REQUEST, ORDER_CANCELLED, DUPLICATE_PAYMENT, WRONG_AMOUNT, MERCHANT_ERROR, PAYMENT_FAILED
   * - amount?: Custom refund amount (default: full order amount)
   */
  @Post(':id/request-refund')
  async requestRefund(
    @GetUser() user: JwtPayload,
    @Param('id') orderId: string,
    @Body() body: { reason: RefundReasonEnum; amount?: number },
  ) {
    try {
      // Validate reason
      if (!body.reason || !Object.values(RefundReasonEnum).includes(body.reason)) {
        throw new BadRequestException('Invalid refund reason');
      }

      // Load order
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      // Ensure tenant can only request refunds for their own orders
      if (order.tenant_id !== user.tenantId) {
        throw new BadRequestException('Access denied');
      }

      // Request refund via service
      const refund = await this.refundService.requestRefund(
        orderId,
        body.reason,
        body.amount,
      );

      return {
        success: true,
        data: {
          id: refund.id,
          order_id: refund.order_id,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          created_at: refund.created_at,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get refund status for an order
   */
  @Get(':id/refund-status')
  async getRefundStatus(
    @GetUser() user: JwtPayload,
    @Param('id') orderId: string,
  ) {
    try {
      // Load order to verify access
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      // Ensure tenant can only view refunds for their own orders
      if (order.tenant_id !== user.tenantId) {
        throw new BadRequestException('Access denied');
      }

      // Get refunds for this order
      const refunds = await this.refundService.getRefundsByOrder(orderId);

      return {
        success: true,
        data: {
          order_id: orderId,
          refunds: refunds.map((r) => ({
            id: r.id,
            amount: r.amount,
            reason: r.reason,
            status: r.status,
            created_at: r.created_at,
            approved_at: r.approved_at,
            notes: r.notes,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
