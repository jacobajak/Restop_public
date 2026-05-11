import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { WebhookService } from '../services/webhook.service';
import { CommissionService } from '../services/commission.service';
import { PaymentMethodEnum } from '../../orders/entities/order.entity';

/**
 * PaymentController
 * 
 * Implements Flutterwave payment design (Paypack removed):
 * 1. POST /orders - Create order
 * 2. POST /orders/{orderId}/pay - Start MoMo payment (cashin)
 * 3. PATCH /orders/{orderId}/mark-paid - Mark cash order as paid
 * 4. POST /webhooks/flutterwave - Flutterwave webhook callback
 */
@Controller()
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly webhookService: WebhookService,
    private readonly commissionService: CommissionService,
  ) {}

  /**
   * Create order
   * 
   * Spec: Section 7 — Create order endpoint
   * 
   * POST /orders
   */
  @Post('/orders')
  async createOrder(
    @Body()
    body: {
      tenant_id: string;
      total_amount: number;
      payment_method: PaymentMethodEnum;
      table_id?: string;
      table_number?: number;
    },
  ) {
    const { tenant_id, total_amount, payment_method, table_id, table_number } =
      body;

    // Validate inputs
    if (!tenant_id || !total_amount || !payment_method) {
      throw new BadRequestException(
        'tenant_id, total_amount, and payment_method are required',
      );
    }

    if (total_amount <= 0) {
      throw new BadRequestException('total_amount must be greater than 0');
    }

    if (![PaymentMethodEnum.CASH, PaymentMethodEnum.MTN, PaymentMethodEnum.AIRTEL].includes(
      payment_method,
    )) {
      throw new BadRequestException(
        'payment_method must be CASH, MTN, or AIRTEL',
      );
    }

    // Create order
    const order = await this.paymentService.createOrder(
      tenant_id,
      total_amount,
      payment_method,
      table_id,
      table_number,
    );

    return {
      ok: true,
      order: {
        id: order.id,
        tx_ref: order.tx_ref,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total_amount: order.total_amount,
        created_at: order.created_at,
      },
    };
  }

  /**
   * Start payment
   * 
   * Spec: Section 7 — Start payment endpoint
   * 
   * POST /orders/{orderId}/pay
   * 
   * Initiates Paypack cashin for MTN/AIRTEL orders
   * 
   * Headers:
   * - Idempotency-Key (optional): UUID or alphanumeric string for request deduplication
   * 
   * Request:
   * {
   *   "customer_phone": "0788123456"
   * }
   */
  @Post('/orders/:orderId/pay')
  async startPayment(
    @Param('orderId') orderId: string,
    @Body() body: { customer_phone?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const { customer_phone } = body;

    if (!customer_phone) {
      throw new BadRequestException('customer_phone is required');
    }

    // Initiate Mobile Money payment
    const result = await this.paymentService.startMobileMoneyPayment(
      orderId,
      customer_phone,
      undefined,
      undefined,
      idempotencyKey,
    );

    return {
      ok: true,
      message: 'Payment initiated',
      data: result,
    };
  }

  /**
   * Mark cash order as paid
   * 
   * Spec: Section 7 — Manual cash confirmation endpoint
   * 
   * PATCH /orders/{orderId}/mark-paid
   * 
   * Only tenant staff can call this endpoint.
   * Records commission when cash is confirmed.
   * 
   * Headers:
   * - Idempotency-Key (optional): UUID or alphanumeric string for request deduplication
   * 
   * Request:
   * {
   *   "tenant_id": "tenant-uuid"
   * }
   */
  @Patch('/orders/:orderId/mark-paid')
  async markCashOrderPaid(
    @Param('orderId') orderId: string,
    @Body() body: { tenant_id: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const { tenant_id } = body;

    if (!tenant_id) {
      throw new BadRequestException('tenant_id is required');
    }

    // Mark order as paid
    const order = await this.paymentService.markCashOrderPaid(orderId, idempotencyKey);

    if (order.tenant_id !== tenant_id) {
      throw new BadRequestException('Unauthorized: Order does not belong to this tenant');
    }

    // Record commission
    const commission = await this.commissionService.recordCommission(orderId, tenant_id);

    return {
      ok: true,
      message: 'Cash order marked as paid and commission recorded',
      order: {
        id: order.id,
        payment_status: order.payment_status,
        total_amount: order.total_amount,
      },
      commission: {
        id: commission.id,
        amount: commission.amount,
        status: commission.status,
      },
    };
  }

  /**
   * REMOVED: Paypack webhook endpoint (using Flutterwave exclusively)
   * @deprecated Use Flutterwave webhooks instead

  /**
   * Flutterwave webhook callback
   * 
   * Spec: Flutterwave charge.completed event
   * 
   * POST /webhooks/flutterwave
   * 
   * Flutterwave sends charge.completed events here.
   * Validates HMAC-SHA256 signature with FLUTTERWAVE_SECRET_HASH.
   * Triggers transaction verification (never trust webhook alone).
   * 
   * Headers:
   * - x-verif-hash: HMAC-SHA256(raw_body, FLUTTERWAVE_SECRET_HASH) as hex string
   */
  @Post('/webhooks/flutterwave')
  async handleFlutterwaveWebhook(
    @Headers('x-verif-hash') verificationHash: string,
    @Req() request: any,
  ) {
    if (!verificationHash) {
      throw new BadRequestException('x-verif-hash header is missing');
    }

    try {
      // Get raw body as string
      let rawBody: string;
      if (typeof request.rawBody === 'string') {
        rawBody = request.rawBody;
      } else if (Buffer.isBuffer(request.rawBody)) {
        rawBody = request.rawBody.toString('utf-8');
      } else {
        rawBody = JSON.stringify(request.body);
      }

      const parsedBody = JSON.parse(rawBody);

      const result = await this.webhookService.handleWebhookCallback(
        rawBody,
        { 'x-verif-hash': verificationHash },
        parsedBody,
      );

      return {
        ok: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error(`Flutterwave webhook processing error: ${error.message}`, error.stack);

      // Always return 200 to Flutterwave to prevent retries, but log the error
      return {
        ok: false,
        error: error.message,
      };
    }
  }
}
