import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { WebhookService } from '../services/webhook.service';
import { WebhookRateLimitGuard } from '../../../common/guards/rate-limit.guard';

/**
 * Payment Webhook Controller
 * 
 * Handles incoming webhooks from payment providers
 * Public endpoint - does NOT require authentication
 * 
 * Rate Limiting (DOS Protection):
 * - IP-based: 1000 webhooks/hour per IP (prevents flooding)
 * - Provider-based: 500 webhooks/minute per provider (prevents single provider from overwhelming)
 * - Burst detection: alerts on 2x+ normal rate
 * 
 * Supported providers:
 * - MTN Mobile Money
 * - Airtel Mobile Money
 * - Other payment providers
 */
@Controller('payments')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Handle mobile money provider webhook
   * 
   * POST /payments/webhook
   * 
   * Called by mobile money providers (MTN, Airtel) to notify of payment status changes
   * 
   * Rate Limiting (DOS Protection):
   * - 1000 webhooks/hour per IP (prevents DDoS attacks)
   * - 500 webhooks/minute per provider (prevents provider flooding)
   * - Automatic burst detection for anomalies
   * 
   * Headers:
   *   X-Payment-Provider: MTN | AIRTEL | custom-provider
   *   X-Signature: HMAC signature for verification
   *   X-Forwarded-For: Client IP (if behind proxy)
   * 
   * Request body (provider specific):
   * {
   *   "provider": "MTN" | "AIRTEL",
   *   "transaction_id": "provider-transaction-id",
   *   "status": "0",  // Provider-specific status code
   *   "amount": 5000,
   *   "phone": "+250787123456",
   *   "signature": "hmac-signature",
   *   ...provider-specific-fields
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Payment processed"
   * }
   * 
   * HTTP Status Codes:
   * - 200: Webhook received and processed successfully
   * - 429: Rate limit exceeded (webhook flooded)
   * - 400: Invalid webhook payload
   * - 500: Server error processing webhook
   * 
   * Rate Limit Headers:
   * - X-RateLimit-IP-Limit: 1000 (total IP limit per hour)
   * - X-RateLimit-IP-Remaining: Number of remaining requests
   * - X-RateLimit-Provider-Limit: 500 (per-provider limit per minute)
   * - X-RateLimit-Provider-Remaining: Number of remaining requests
   * - X-RateLimit-Reset: Unix timestamp when limit resets
   */
  @Post('webhook')
  @UseGuards(WebhookRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any, @Request() req: any) {
    const provider = payload?.provider || 'UNKNOWN';
    const transactionId = payload?.transaction_id || 'unknown';

    this.logger.log(
      `Webhook received from ${provider} (txn: ${transactionId})`,
    );

    try {
      // Validate webhook payload has required fields
      if (!payload) {
        throw new Error('Webhook payload is empty');
      }

      if (!provider || provider === 'UNKNOWN') {
        this.logger.warn('Webhook missing provider information');
      }

      // Get raw body from request (for signature verification)
      const rawBody = typeof req.rawBody === 'string' 
        ? req.rawBody 
        : JSON.stringify(payload);

      // Process webhook through webhook service
      const result = await this.webhookService.handleWebhookCallback(
        rawBody,
        req.headers,
        payload,
      );

      this.logger.log(
        `Webhook processed successfully from ${provider} (txn: ${transactionId})`,
      );

      return {
        ...result,
        transaction_id: transactionId,
      };
    } catch (error: any) {
      this.logger.error(
        `Webhook processing error from ${provider} (txn: ${transactionId}):`,
        error?.message,
      );

      // Always return 200 to providers to avoid retries on our end
      // But log the error for monitoring
      return {
        success: false,
        message: error?.message || 'Webhook processing failed',
        transaction_id: transactionId,
        error: error?.code || 'WEBHOOK_ERROR',
      };
    }
  }

  /**
   * Health check endpoint for webhook delivery testing
   * 
   * GET /payments/webhook/health
   * 
   * Used by payment providers to verify webhook endpoint is available
   * Not rate-limited since it's a health check
   */
  @Post('webhook/health')
  @HttpCode(HttpStatus.OK)
  webhookHealth() {
    return {
      status: 'ok',
      message: 'Webhook endpoint is ready',
      timestamp: new Date().toISOString(),
    };
  }
}
