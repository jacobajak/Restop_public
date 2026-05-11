import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RateLimiterService } from '../services/rate-limiter.service';
import { Request, Response } from 'express';

/**
 * Payment Rate Limiting Guard
 * 
 * Limits payment endpoint requests to 100 per minute per tenant
 * Applied to: initiate payment, confirm payment endpoints
 */
@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get tenant from request (set by TenantGuard)
    const tenantId = request['tenantId'] || request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new HttpException(
        'Tenant ID not found',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.rateLimiter.checkPaymentLimit(tenantId as string);

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', '100');
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many payment requests. Please try again later.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

/**
 * Payment Initiation Rate Limiting Guard (Fraud Prevention)
 * 
 * Limits payment initiation attempts to 30 per hour per tenant
 * Prevents spam and potential fraud attempts
 * Applied to: initiate-mobile-money endpoint
 */
@Injectable()
export class PaymentInitiationFraudGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const tenantId = request['tenantId'] || request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new HttpException(
        'Tenant ID not found',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.rateLimiter.checkPaymentInitiationLimit(
      tenantId as string,
    );

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', '30');
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many payment initiation attempts. Try again in 1 hour.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

/**
 * Webhook Rate Limiting Guard (DOS Protection)
 * 
 * Protects webhook endpoints from DOS attacks:
 * - Per-IP: max 1000 webhooks per hour
 * - Per-provider: max 500 webhooks per minute
 * 
 * Applied to: /payments/webhook endpoint
 */
@Injectable()
export class WebhookRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  private getClientIP(request: Request): string {
    // Check various headers for client IP (handles proxies/load balancers)
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const clientIP = this.getClientIP(request);
    const payload = request.body;
    const provider = payload?.provider || 'UNKNOWN';

    // Check IP-based rate limit (DOS protection)
    const ipLimit = await this.rateLimiter.checkWebhookLimitByIP(clientIP);

    // Check provider-based rate limit (prevent single provider from flooding)
    const providerLimit = await this.rateLimiter.checkWebhookLimitByProvider(provider);

    // Add rate limit headers
    response.setHeader('X-RateLimit-IP-Limit', '1000');
    response.setHeader('X-RateLimit-IP-Remaining', ipLimit.remaining);
    response.setHeader('X-RateLimit-Provider-Limit', '500');
    response.setHeader('X-RateLimit-Provider-Remaining', providerLimit.remaining);

    if (!ipLimit.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Webhook rate limit exceeded (IP-based). Check back later.',
          retryAfter: Math.ceil((ipLimit.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!providerLimit.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Provider ${provider} webhook rate limit exceeded.`,
          retryAfter: Math.ceil((providerLimit.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check for burst (unusual spike)
    const burstDetected = await this.rateLimiter.detectBurst(
      `webhook:ip:${clientIP}`,
      100, // normal rate
      60,
    );

    if (burstDetected) {
      // Log the burst for security monitoring
      console.warn(`SECURITY: Potential webhook DOS from IP ${clientIP}`);
      // You can implement additional actions here (e.g., temp ban, alert)
    }

    return true;
  }
}

/**
 * Admin Endpoint Rate Limiting Guard
 * 
 * Limits admin endpoint requests to 200 per minute per user
 * Applied to: admin endpoints
 */
@Injectable()
export class AdminRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get user ID from JWT (set by JwtAuthGuard)
    const userId = request['userId'] || (request['user'] as any)?.id;

    if (!userId) {
      throw new HttpException(
        'User ID not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const result = await this.rateLimiter.checkAdminLimit(userId);

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', '200');
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Admin rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

/**
 * Refund Request Rate Limiting Guard
 * 
 * Limits refund requests to 5 per hour per user
 * Prevents abuse/spam of refund system
 * Applied to: POST /refunds/request
 */
@Injectable()
export class RefundRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const userId = request['userId'] || (request['user'] as any)?.id;

    if (!userId) {
      throw new HttpException(
        'User ID not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const result = await this.rateLimiter.checkRefundLimit(userId);

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', '5');
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many refund requests. Maximum 5 per hour.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

/**
 * Generic Rate Limiting Guard
 * 
 * Configurable rate limiter for custom endpoints
 * Used by @RateLimit() decorator
 */
@Injectable()
export class CustomRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get rate limit config from metadata (set by @RateLimit() decorator)
    const metadata = Reflect.getMetadata('rateLimit', context.getHandler());

    if (!metadata) {
      return true; // No rate limit configured
    }

    const { identifier, limit, windowSeconds, key } = metadata;

    if (!identifier) {
      return true;
    }

    // Build identifier
    let finalIdentifier = identifier;
    if (typeof identifier === 'function') {
      finalIdentifier = identifier(request);
    }

    const result = await this.rateLimiter.checkCustomLimit(
      finalIdentifier,
      limit,
      windowSeconds,
    );

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded: max ${limit} requests per ${windowSeconds} seconds`,
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
