import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetTenant } from '../../common/decorators/get-tenant.decorator';

/**
 * PaymentController
 * 
 * REST API endpoints for payment operations:
 * - POST /payments/initiate-mobile-money - Start mobile money payment
 * - POST /payments/confirm-cash - Confirm cash receipt
 * - POST /payments/webhook - Handle provider callbacks
 * - GET /payments/:id - Get payment details
 * - GET /orders/:orderId/payments - Get payments for order
 * 
 * @controller payments
 */
@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Initiate mobile money payment
   * 
   * POST /payments/initiate-mobile-money
   * 
   * Request body:
   * {
   *   "order_id": "uuid",
   *   "customer_phone": "+250787123456"
   * }
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "order_id": "uuid",
   *   "method": "MOBILE_MONEY",
   *   "provider": "MTN" | "AIRTEL",
   *   "customer_phone": "+250787123456",
   *   "status": "PENDING",
   *   "created_at": "2024-01-15T10:30:00Z"
   * }
   */
  @Post('initiate-mobile-money')
  async initiateMobileMoneyPayment(
    @Body() body: { order_id: string; customer_phone: string },
    @GetTenant() tenantId: string,
  ) {
    if (!body.order_id) {
      throw new BadRequestException('order_id is required');
    }
    if (!body.customer_phone) {
      throw new BadRequestException('customer_phone is required');
    }

    return this.paymentService.initiateMobileMoneyPayment(
      body.order_id,
      body.customer_phone,
      tenantId,
    );
  }

  /**
   * Confirm cash payment
   * 
   * POST /payments/confirm-cash
   * 
   * Called by restaurant staff to confirm customer has paid cash
   * 
   * Request body:
   * {
   *   "order_id": "uuid"
   * }
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "order_id": "uuid",
   *   "method": "CASH",
   *   "provider": "MANUAL",
   *   "status": "COMPLETED",
   *   "created_at": "2024-01-15T10:30:00Z"
   * }
   */
  @Post('confirm-cash')
  async confirmCashPayment(
    @Body() body: { order_id: string },
    @GetTenant() tenantId: string,
  ) {
    if (!body.order_id) {
      throw new BadRequestException('order_id is required');
    }

    return this.paymentService.confirmCashPayment(body.order_id, tenantId);
  }

  /**
   * Handle mobile money provider webhook
   * 
   * POST /payments/webhook
   * 
   * Called by mobile money providers (MTN, Airtel) to notify of payment status
   * 
   * Header:
   *   X-Payment-Provider: MTN | AIRTEL
   *   X-Signature: webhook-signature
   * 
   * Body (provider specific):
   * {
   *   "transaction_id": "provider-transaction-id",
   *   "status": "0",  // Provider-specific status code
   *   "amount": 5000,
   *   "phone": "+250787123456",
   *   ...provider-specific-fields
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Payment processed"
   * }
   */
  @Post('webhook')
  async handleWebhook(
    @Body() payload: any,
  ) {
    // Extract provider and signature from headers
    // This is handled differently because webhooks may not use JWT auth
    const provider = payload.provider || 'UNKNOWN';
    const signature = payload.signature || '';

    try {
      await this.paymentService.handleWebhookCallback(
        provider,
        payload,
        signature,
      );

      return {
        success: true,
        message: 'Payment processed',
      };
    } catch (error: any) {
      // Log webhook error for debugging
      console.error('Webhook processing error:', error?.message);

      return {
        success: false,
        message: error?.message || 'Unknown error',
      };
    }
  }

  /**
   * Get payment details
   * 
   * GET /payments/:id
   * 
   * Response:
   * {
   *   "id": "uuid",
   *   "order_id": "uuid",
   *   "method": "MOBILE_MONEY" | "CASH",
   *   "provider": "MTN" | "AIRTEL" | "MANUAL",
   *   "customer_phone": "+250787123456",
   *   "transaction_reference": "provider-transaction-id",
   *   "status": "PENDING" | "COMPLETED" | "FAILED",
   *   "error_message": null,
   *   "webhook_payload": "{ ...payload... }",
   *   "created_at": "2024-01-15T10:30:00Z",
   *   "updated_at": "2024-01-15T10:35:00Z"
   * }
   */
  @Get(':id')
  async getPayment(@Param('id') id: string, @GetTenant() tenantId: string) {
    return this.paymentService.getPayment(id, tenantId);
  }

  /**
   * Get all payments for an order
   * 
   * GET /orders/:orderId/payments
   * 
   * Response:
   * [
   *   {
   *     "id": "uuid",
   *     "order_id": "uuid",
   *     "method": "MOBILE_MONEY" | "CASH",
   *     "status": "PENDING" | "COMPLETED" | "FAILED",
   *     ...
   *   }
   * ]
   */
  @Get('orders/:orderId/payments')
  async getOrderPayments(
    @Param('orderId') orderId: string,
    @GetTenant() tenantId: string,
  ) {
    return this.paymentService.getOrderPayments(orderId, tenantId);
  }
}
