import { SetMetadata } from '@nestjs/common';

/**
 * Rate Limit Decorator
 * 
 * Applies rate limiting to an endpoint with custom configuration
 * Works with CustomRateLimitGuard
 * 
 * Usage:
 * @RateLimit({ limit: 10, windowSeconds: 60, identifier: 'user:123' })
 * async someEndpoint() { ... }
 * 
 * Or with dynamic identifier:
 * @RateLimit({
 *   limit: 10,
 *   windowSeconds: 60,
 *   identifier: (req) => `user:${req.user.id}`
 * })
 */
export const RateLimit = (config: {
  limit: number;
  windowSeconds: number;
  identifier: string | ((req: any) => string);
}) => SetMetadata('rateLimit', config);

/**
 * Payment Rate Limit Decorator
 * 
 * Applies payment endpoint rate limiting (100 req/min per tenant)
 * Works with PaymentRateLimitGuard
 * 
 * Usage:
 * @PaymentRateLimit()
 * async initiatePayment() { ... }
 */
export const PaymentRateLimit = () =>
  SetMetadata('paymentRateLimit', true);

/**
 * Payment Initiation Fraud Prevention Decorator
 * 
 * Applies fraud prevention rate limiting (30 initiations per hour)
 * Works with PaymentInitiationFraudGuard
 * 
 * Usage:
 * @PaymentInitiationFraudLimit()
 * async initiateMobileMoneyPayment() { ... }
 */
export const PaymentInitiationFraudLimit = () =>
  SetMetadata('paymentInitiationFraud', true);

/**
 * Webhook Rate Limit Decorator
 * 
 * Applies webhook DOS protection rate limiting
 * Works with WebhookRateLimitGuard
 * 
 * Usage:
 * @WebhookRateLimit()
 * async handleWebhook() { ... }
 */
export const WebhookRateLimit = () =>
  SetMetadata('webhookRateLimit', true);

/**
 * Admin Rate Limit Decorator
 * 
 * Applies admin endpoint rate limiting (200 req/min per user)
 * Works with AdminRateLimitGuard
 * 
 * Usage:
 * @AdminRateLimit()
 * async adminEndpoint() { ... }
 */
export const AdminRateLimit = () =>
  SetMetadata('adminRateLimit', true);

/**
 * Refund Rate Limit Decorator
 * 
 * Applies refund endpoint rate limiting (5 per hour)
 * Works with RefundRateLimitGuard
 * 
 * Usage:
 * @RefundRateLimit()
 * async requestRefund() { ... }
 */
export const RefundRateLimit = () =>
  SetMetadata('refundRateLimit', true);
