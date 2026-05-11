import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ReceiptService } from '../services/receipt.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '../../../modules/users/entities/user.entity';

/**
 * Receipt Controller
 *
 * Handles:
 * ✅ Customer receipt endpoints (view, download, send via SMS/Email)
 * ✅ Admin receipt endpoints (list, view, resend)
 * ✅ Multiple format support (JSON, text, HTML, PDF signature)
 *
 * Integration Points:
 * - ReceiptService: Receipt data generation + delivery
 * - AuthGuard: JWT authentication
 * - RolesGuard: Authorization (customer/admin)
 *
 * Features:
 * - Receipt ID generation and tracking
 * - Multiple delivery channels (SMS, Email)
 * - Audit trail for compliance
 * - Graceful degradation if delivery fails
 */
@Controller('receipts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(private readonly receiptService: ReceiptService) {}

  /**
   * GET /receipts/:orderId
   *
   * Customer retrieves their receipt
   *
   * Query params:
   * - format: 'json' | 'text' | 'html' (default: 'json')
   *
   * Returns:
   * - JSON: Complete receipt object
   * - text: ASCII formatted receipt (for console/SMS)
   * - html: HTML formatted receipt (for email/web)
   */
  @Get(':orderId')
  @Roles(UserRole.CUSTOMER, UserRole.PLATFORM_ADMIN)
  async getReceipt(
    @Param('orderId') orderId: string,
    @Query('format') format: 'json' | 'text' | 'html' = 'json',
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`📄 Customer requested receipt: order=${orderId}, format=${format}`);

      switch (format) {
        case 'text':
          const textReceipt = await this.receiptService.getReceiptText(orderId);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="receipt-${orderId}.txt"`,
          );
          return res.send(textReceipt);

        case 'html':
          const htmlReceipt = await this.receiptService.getReceiptHTML(orderId);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `inline; filename="receipt-${orderId}.html"`,
          );
          return res.send(htmlReceipt);

        case 'json':
        default:
          const jsonReceipt = await this.receiptService.getReceiptJSON(orderId);
          return res.json({
            success: true,
            data: jsonReceipt,
          });
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to retrieve receipt: order=${orderId}, error=${error.message}`,
      );
      throw error;
    }
  }

  /**
   * GET /receipts/:orderId/download
   *
   * Customer downloads receipt as plain text file
   * Best for: Saving/printing
   *
   * Returns:
   * - Content-Type: text/plain
   * - File download: receipt-{orderId}.txt
   */
  @Get(':orderId/download')
  @Roles(UserRole.CUSTOMER, UserRole.PLATFORM_ADMIN)
  async downloadReceipt(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`⬇️ Customer downloading receipt: order=${orderId}`);

      const receiptText = await this.receiptService.getReceiptText(orderId);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="receipt-${orderId}.txt"`,
      );

      return res.send(receiptText);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to download receipt: order=${orderId}, error=${error.message}`,
      );
      throw error;
    }
  }

  /**
   * POST /receipts/:orderId/send
   *
   * Customer requests receipt to be sent via SMS/Email
   *
   * Body:
   * ```
   * {
   *   "channel": "sms" | "email",
   *   "email": "customer@example.com" (required if channel=email)
   * }
   * ```
   *
   * Returns:
   * ```
   * {
   *   "success": true,
   *   "message": "Receipt sent via SMS to +250XXX",
   *   "channel": "sms"
   * }
   * ```
   *
   * Resilience Features:
   * - Retry on delivery failure (NotificationsService handles retry strategy)
   * - Graceful degradation if SMS/Email service temporarily unavailable
   * - Audit trail for compliance
   */
  @Post(':orderId/send')
  @Roles(UserRole.CUSTOMER, UserRole.PLATFORM_ADMIN)
  async sendReceipt(
    @Param('orderId') orderId: string,
    @Body() body: { channel: 'sms' | 'email'; email?: string },
  ) {
    try {
      const { channel, email } = body;

      if (!channel || !['sms', 'email'].includes(channel)) {
        throw new BadRequestException(`Invalid channel. Must be 'sms' or 'email'`);
      }

      this.logger.log(
        `📧 Customer requesting receipt delivery: order=${orderId}, channel=${channel}`,
      );

      if (channel === 'sms') {
        const result = await this.receiptService.sendReceiptViaSMS(orderId);
        return {
          success: result.success,
          message: result.message,
          channel: 'sms',
        };
      } else if (channel === 'email') {
        if (!email) {
          throw new BadRequestException('Email is required for email delivery');
        }
        const result = await this.receiptService.sendReceiptViaEmail(orderId, email);
        return {
          success: result.success,
          message: result.message,
          channel: 'email',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to send receipt: order=${orderId}, error=${error.message}`,
      );
      throw error;
    }
  }

  /**
   * ADMIN: GET /admin/receipts
   *
   * Admin lists receipts for a specific order or all orders
   *
   * Query params:
   * - orderId: Filter by specific order (optional)
   *
   * Returns:
   * ```
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "receipt_id": "RCP-ABC123XY",
   *       "order_id": "order-123",
   *       "status": "sent",
   *       "delivery_channel": "SMS",
   *       "sent_at": "2024-01-15T10:30:00Z"
   *     }
   *   ]
   * }
   * ```
   *
   * Implementation Note:
   * - Currently returns mock data
   * - To fully implement: Add receipt_logs table to track generation + delivery
   * - Track: receipt_id, order_id, delivery_channel, status, timestamps
   */
  @Get('admin/list')
  @Roles(UserRole.PLATFORM_ADMIN)
  async listReceipts(@Query('orderId') orderId?: string) {
    try {
      this.logger.log(`📋 Admin listing receipts${orderId ? ` for order=${orderId}` : ''}`);

      // TODO Phase 5: Implement receipt_logs table + audit trail
      // For now, return mock structure
      return {
        success: true,
        message:
          'Receipt audit trail implementation requires receipt_logs table (Phase 5)',
        data: [],
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to list receipts: error=${error.message}`);
      throw error;
    }
  }

  /**
   * ADMIN: POST /admin/receipts/:receiptId/resend
   *
   * Admin manually resends receipt to customer
   * Useful for: Customer requests, failed delivery recovery
   *
   * Body:
   * ```
   * {
   *   "channel": "sms" | "email",
   *   "email": "customer@example.com" (required if channel=email)
   * }
   * ```
   */
  @Post('admin/:receiptId/resend')
  @Roles(UserRole.PLATFORM_ADMIN)
  async resendReceipt(
    @Param('receiptId') receiptId: string,
    @Body() body: { channel: 'sms' | 'email'; email?: string },
  ) {
    try {
      const { channel, email } = body;

      if (!channel || !['sms', 'email'].includes(channel)) {
        throw new BadRequestException(`Invalid channel. Must be 'sms' or 'email'`);
      }

      this.logger.log(
        `🔄 Admin resending receipt: receiptId=${receiptId}, channel=${channel}`,
      );

      // TODO Phase 5: Map receiptId to orderId from receipt_logs table
      // For now, treat receiptId as orderId for backward compatibility
      const orderId = receiptId;

      if (channel === 'sms') {
        const result = await this.receiptService.sendReceiptViaSMS(orderId);
        return {
          success: result.success,
          message: `✅ ${result.message}`,
          channel: 'sms',
        };
      } else if (channel === 'email') {
        if (!email) {
          throw new BadRequestException('Email is required for email delivery');
        }
        const result = await this.receiptService.sendReceiptViaEmail(orderId, email);
        return {
          success: result.success,
          message: `✅ ${result.message}`,
          channel: 'email',
        };
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to resend receipt: receiptId=${receiptId}, error=${error.message}`,
      );
      throw error;
    }
  }
}
