import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NotificationTypeEnum } from '../entities/notification-history.entity';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationHistoryService } from './notification-history.service';

/**
 * Notification Email Service
 * 
 * High-level email delivery service for notifications.
 * Combines:
 * - EmailService for SMTP/Nodemailer
 * - NotificationTemplateService for template rendering
 * - NotificationHistoryService for deduplication and retry
 *
 * Features:
 * - Template-based emails with variables
 * - Automatic deduplication (idempotency)
 * - Retry scheduling with exponential backoff
 * - Complete audit trail
 * - Non-blocking (fire-and-forget)
 * 
 * Usage:
 * await emailService.sendOrderCreatedEmail(
 *   'customer@example.com',
 *   tenantId,
 *   orderId,
 *   { customerName: 'John', ... }
 * );
 */
@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private templateService: NotificationTemplateService,
    private historyService: NotificationHistoryService,
  ) {
    this.initializeTransport();
  }

  /**
   * Initialize email transport (Nodemailer)
   */
  private async initializeTransport() {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');

    if (nodeEnv === 'production') {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT', 587),
        secure: this.configService.get('SMTP_SECURE', false),
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });

      this.logger.log('Notification email service initialized with production SMTP');
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        this.logger.log(
          `Notification email service initialized with Ethereal (${testAccount.user})`,
        );
      } catch (error) {
        this.logger.error('Failed to create Ethereal account, using fallback');
        this.transporter = nodemailer.createTransport({
          host: 'localhost',
          port: 1025,
        });
      }
    }
  }

  /**
   * Send order created notification (customer)
   */
  async sendOrderCreatedEmail(
    customerEmail: string,
    customerId: string | null,
    tenantId: string,
    orderId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      customerEmail,
      customerId,
      tenantId,
      NotificationTypeEnum.ORDER_CREATED,
      orderId,
      'order',
      'customer',
      context,
    );
  }

  /**
   * Send order ready notification (customer)
   */
  async sendOrderReadyEmail(
    customerEmail: string,
    customerId: string | null,
    tenantId: string,
    orderId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      customerEmail,
      customerId,
      tenantId,
      NotificationTypeEnum.ORDER_READY,
      orderId,
      'order',
      'customer',
      context,
    );
  }

  /**
   * Send payment completed notification (customer)
   */
  async sendPaymentCompletedEmail(
    customerEmail: string,
    customerId: string | null,
    tenantId: string,
    orderId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      customerEmail,
      customerId,
      tenantId,
      NotificationTypeEnum.PAYMENT_COMPLETED,
      orderId,
      'payment',
      'customer',
      context,
    );
  }

  /**
   * Send refund approved notification (customer)
   */
  async sendRefundApprovedEmail(
    customerEmail: string,
    customerId: string | null,
    tenantId: string,
    refundId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      customerEmail,
      customerId,
      tenantId,
      NotificationTypeEnum.REFUND_APPROVED,
      refundId,
      'refund',
      'customer',
      context,
    );
  }

  /**
   * Send new order notification (merchant)
   */
  async sendNewOrderMerchantEmail(
    merchantEmail: string,
    merchantId: string,
    tenantId: string,
    orderId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      merchantEmail,
      merchantId,
      tenantId,
      NotificationTypeEnum.ORDER_CREATED,
      orderId,
      'order',
      'merchant',
      context,
    );
  }

  /**
   * Send settlement completed notification (merchant)
   */
  async sendSettlementCompletedEmail(
    merchantEmail: string,
    merchantId: string,
    tenantId: string,
    settlementId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      merchantEmail,
      merchantId,
      tenantId,
      NotificationTypeEnum.SETTLEMENT_COMPLETED,
      settlementId,
      'settlement',
      'merchant',
      context,
    );
  }

  /**
   * Send support escalation notification (admin)
   */
  async sendSupportEscalatedEmail(
    adminEmail: string,
    adminId: string,
    tenantId: string,
    ticketId: string,
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    return this.sendEmailNotification(
      adminEmail,
      adminId,
      tenantId,
      NotificationTypeEnum.SUPPORT_ESCALATED,
      ticketId,
      'ticket',
      'admin',
      context,
    );
  }

  /**
   * Core email sending logic
   * Handles deduplication, template rendering, and delivery
   */
  private async sendEmailNotification(
    recipientEmail: string,
    userId: string | null,
    tenantId: string,
    notificationType: NotificationTypeEnum,
    relatedEntityId: string,
    relatedEntityType: string,
    recipientType: 'customer' | 'merchant' | 'admin',
    context: Record<string, any>,
  ): Promise<{ notificationId: string; sent: boolean }> {
    try {
      // Step 1: Generate idempotency key
      const idempotencyKey = this.templateService.generateIdempotencyKey(
        tenantId,
        relatedEntityId,
        notificationType,
        recipientEmail,
      );

      // Step 2: Check if already sent (deduplication)
      const { id: notificationId, isDuplicate } =
        await this.historyService.createNotification(
          tenantId,
          userId,
          recipientEmail,
          notificationType,
          relatedEntityId,
          relatedEntityType,
          idempotencyKey,
          null, // subject
          null, // htmlContent
          context,
        );

      if (isDuplicate) {
        this.logger.log(
          `Skipping duplicate notification: ${idempotencyKey}`,
        );
        return { notificationId, sent: false };
      }

      // Step 3: Render template
      const { subject, html } = await this.templateService.renderTemplate(
        notificationType,
        recipientType,
        context,
      );

      // Step 4: Send email (non-blocking)
      this.sendEmailAsync(
        notificationId,
        recipientEmail,
        subject,
        html,
      ).catch((error) => {
        // Log but don't throw - async operation
        this.logger.error(
          `Failed to send email notification ${notificationId}: ${error.message}`,
        );
      });

      return { notificationId, sent: true };
    } catch (error) {
      this.logger.error(
        `Failed to send email notification: ${error.message}`,
      );
      return { notificationId: '', sent: false };
    }
  }

  /**
   * Async email delivery (fire-and-forget)
   * Does not block the main request
   */
  private async sendEmailAsync(
    notificationId: string,
    recipientEmail: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      // Send email. via Nodemailer
      const result = await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM', 'noreply@dineflow.app'),
        to: recipientEmail,
        subject,
        html,
        text: this.stripHtml(html),
      });

      // Mark as sent in database
      await this.historyService.markAsSent(notificationId, {
        messageId: result.messageId,
      });

      this.logger.log(
        `Email sent successfully: ${notificationId} to ${recipientEmail}`,
      );
    } catch (error) {
      // Mark as failed and schedule retry
      const { shouldRetry, nextRetryAt } =
        await this.historyService.markAsFailed(
          notificationId,
          error instanceof Error ? error.message : 'Unknown error',
        );

      if (shouldRetry) {
        this.logger.warn(
          `Email delivery failed for ${notificationId}, scheduled retry at ${nextRetryAt}`,
        );
      } else {
        this.logger.error(
          `Email delivery failed for ${notificationId}, max retries exceeded`,
        );
      }
    }
  }

  /**
   * Convert HTML to plain text for email fallback
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Retry failed emails
   * Called by background job
   */
  async retryFailedEmails(): Promise<number> {
    try {
      const pending = await this.historyService.getPendingRetries(50);

      if (pending.length === 0) {
        return 0;
      }

      this.logger.log(`Retrying ${pending.length} failed emails`);

      let successCount = 0;
      for (const notification of pending) {
        try {
          if (notification.html_content && notification.template_variables) {
            await this.sendEmailAsync(
              notification.id,
              notification.recipient_email,
              notification.subject || 'Notification from DineFlow',
              notification.html_content,
            );
            successCount++;
          }
        } catch (error) {
          this.logger.error(
            `Retry failed for ${notification.id}: ${error}`,
          );
        }
      }

      this.logger.log(`Email retry batch complete: ${successCount}/${pending.length} successful`);
      return successCount;
    } catch (error) {
      this.logger.error(`Failed to retry emails: ${error.message}`);
      return 0;
    }
  }
}
