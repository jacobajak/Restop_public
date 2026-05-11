import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyService } from '../services/idempotency.service';
import { OperationTypeEnum, IdempotencyStatusEnum } from '../entities/idempotency-key.entity';

/**
 * IdempotencyMiddleware
 * 
 * Extracts Idempotency-Key header and attaches idempotency context to request
 * Handles retry logic for duplicate requests:
 * - If status=SUCCESS: Return cached response immediately
 * - If status=PROCESSING: Return 409 Conflict (operation in progress)
 * - If status=FAILED: Return cached error response
 * 
 * Usage:
 * Add to module: app.use(IdempotencyMiddleware) or configure in PaymentsModule
 * 
 * Header: Idempotency-Key
 * Operation-Type: PAYMENT_INITIATION | PAYMENT_VERIFICATION | etc.
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Only apply to POST/PATCH requests that modify state
    if (!['POST', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Only apply to payment endpoints
    if (!this.isPaymentEndpoint(req.path)) {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;
    const operationType = this.getOperationTypeFromRequest(req);

    // If no idempotency key provided, continue (not all operations require it)
    if (!idempotencyKey) {
      return next();
    }

    // Validate idempotency key format (UUID or alphanumeric string)
    if (!this.isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException(
        'Invalid Idempotency-Key header. Must be a valid UUID or alphanumeric string.',
      );
    }

    try {
      // Check if operation with this key already exists
      const existingKey = await this.idempotencyService.getByKey(idempotencyKey);

      if (existingKey) {
        // Operation already exists - check status
        if (existingKey.status === IdempotencyStatusEnum.PROCESSING) {
          // Operation is still processing - return 409 Conflict
          res.status(409).json({
            ok: false,
            error: 'Operation in progress',
            message: 'An operation with this idempotency key is already being processed',
            retryAfter: 5, // seconds
          });
          return;
        }

        if (existingKey.status === IdempotencyStatusEnum.SUCCESS) {
          // Return cached success response
          this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
          res.status(200).json({
            ok: true,
            message: 'Cached response (duplicate request)',
            data: existingKey.response_snapshot,
            cached: true,
          });
          return;
        }

        if (existingKey.status === IdempotencyStatusEnum.FAILED) {
          // Return cached error response
          this.logger.log(`Returning cached error for idempotency key: ${idempotencyKey}`);
          res.status(422).json({
            ok: false,
            error: 'Operation previously failed',
            message: existingKey.error_message,
            cached: true,
          });
          return;
        }
      }

      // Attach idempotency context to request for use in controllers/services
      (req as any).idempotency = {
        key: idempotencyKey,
        operationType: operationType || OperationTypeEnum.PAYMENT_INITIATION,
      };

      next();
    } catch (error) {
      this.logger.error(
        `Error in idempotency middleware: ${error.message}`,
        error.stack,
      );
      // Don't block the request on middleware errors, just log
      next();
    }
  }

  /**
   * Determine if this is a payment endpoint that requires idempotency
   */
  private isPaymentEndpoint(path: string): boolean {
    const paymentPaths = [
      '/orders',
      '/pay',
      '/mark-paid',
      '/webhooks/flutterwave',
      '/cashout',
      '/refund',
    ];
    return paymentPaths.some((p) => path.includes(p));
  }

  /**
   * Determine operation type from request path
   */
  private getOperationTypeFromRequest(req: Request): OperationTypeEnum {
    const path = req.path;

    if (path.includes('/pay')) return OperationTypeEnum.PAYMENT_INITIATION;
    if (path.includes('/mark-paid')) return OperationTypeEnum.PAYMENT_VERIFICATION;
    if (path.includes('/refund')) return OperationTypeEnum.REFUND_CREATION;
    if (path.includes('/settlement')) return OperationTypeEnum.SETTLEMENT_TRIGGER;
    if (path.includes('/webhooks')) return OperationTypeEnum.WEBHOOK_PROCESSING;
    if (path.includes('/cashout')) return OperationTypeEnum.PAYOUT_CREATION;

    return OperationTypeEnum.PAYMENT_INITIATION; // Default
  }

  /**
   * Validate idempotency key format
   * Accepts: UUID v4, UUID v1, or alphanumeric strings (min 16 chars)
   */
  private isValidIdempotencyKey(key: string): boolean {
    if (!key || typeof key !== 'string') return false;

    // UUID pattern (v1 and v4)
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(key)) return true;

    // Alphanumeric pattern (min 16 chars)
    const alphanumericPattern = /^[a-zA-Z0-9_-]{16,255}$/;
    if (alphanumericPattern.test(key)) return true;

    return false;
  }
}
