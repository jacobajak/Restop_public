import { Injectable, Logger } from '@nestjs/common';
import { EMAIL_TEMPLATES } from '../email-templates/email-templates.constant';
import { NotificationTypeEnum } from '../entities/notification-history.entity';

/**
 * Notification Template Service
 * 
 * Responsible for:
 * - Loading email templates
 * - Rendering templates with variable substitution
 * - Handling template variations (customer, merchant, admin)
 * - Supporting fallback templates
 * 
 * Usage:
 * const { subject, html } = await templateService.renderTemplate(
 *   NotificationTypeEnum.ORDER_CREATED,
 *   'customer',  // or 'merchant', 'admin'
 *   { customerName: 'John', restaurantName: 'Pizza', ... }
 * );
 */
@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor() {
    this.logger.log('NotificationTemplateService initialized');
  }

  /**
   * Get template for notification type and recipient
   * 
   * @param notificationType - Type of notification (order.created, payment.completed, etc.)
   * @param recipientType - Who's receiving ('customer', 'merchant', 'admin')
   * @returns Template object with subject and html
   */
  private getTemplate(notificationType: NotificationTypeEnum, recipientType: 'customer' | 'merchant' | 'admin') {
    const templateKey = `${notificationType.toUpperCase()}_${recipientType.toUpperCase()}`;
    
    // @ts-ignore - TypeScript doesn't know about dynamic keys, but we do
    return EMAIL_TEMPLATES[templateKey] || null;
  }

  /**
   * Render template with variables
   * 
   * Replaces {{variable}} with actual values from context
   * Supports nested variables like {{customer.name}}
   * 
   * @param notificationType - Type of notification
   * @param recipientType - customer/merchant/admin
   * @param context - Variables to fill template with
   * @returns { subject, html } with variables replaced
   */
  async renderTemplate(
    notificationType: NotificationTypeEnum,
    recipientType: 'customer' | 'merchant' | 'admin',
    context: Record<string, any> = {},
  ): Promise<{ subject: string; html: string }> {
    try {
      const template = this.getTemplate(notificationType, recipientType);
      
      if (!template) {
        this.logger.warn(
          `Template not found for ${notificationType} (${recipientType}), using fallback`,
        );
        // Return minimal fallback
        return {
          subject: `Notification from DineFlow: ${notificationType}`,
          html: `<p>Your notification about ${notificationType}</p>`,
        };
      }

      // Replace all {{variable}} placeholders with context values
      const subject = this.interpolate(template.subject, context);
      const html = this.interpolate(template.html, context);

      return { subject, html };
    } catch (error) {
      this.logger.error(
        `Failed to render template ${notificationType}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Interpolate template string with context variables
   * 
   * Supports:
   * - Simple: {{name}} → context.name
   * - Nested: {{customer.name}} → context.customer.name
   * - HTML escaping: Variables are NOT escaped (for HTML content)
   * - Fallback: {{undefined}} → (remains unchanged)
   * 
   * @param template - Template string with {{variables}}
   * @param context - Object with variables
   * @returns Interpolated string
   */
  private interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const keys = path.split('.');
      let value = context;

      // Navigate through nested keys
      for (const key of keys) {
        value = value?.[key];
        if (value === undefined) {
          // Don't replace if value not found
          return match;
        }
      }

      // Convert value to string
      if (value === null || value === undefined) {
        return '';
      }

      if (typeof value === 'object') {
        // For objects/arrays, convert to JSON
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  /**
   * Get available templates for a notification type
   * Returns which recipient types have templates
   */
  getAvailableRecipients(notificationType: NotificationTypeEnum): string[] {
    const recipients = [];
    
    if (this.getTemplate(notificationType, 'customer')) {
      recipients.push('customer');
    }
    if (this.getTemplate(notificationType, 'merchant')) {
      recipients.push('merchant');
    }
    if (this.getTemplate(notificationType, 'admin')) {
      recipients.push('admin');
    }

    return recipients;
  }

  /**
   * Generate idempotency key for notification
   * Prevents duplicate sends for same event + recipient
   * 
   * Format: {tenantId}:{relatedEntityId}:{notificationType}:{recipientEmail}
   */
  generateIdempotencyKey(
    tenantId: string,
    relatedEntityId: string,
    notificationType: NotificationTypeEnum,
    recipientEmail: string,
  ): string {
    return `${tenantId}:${relatedEntityId}:${notificationType}:${recipientEmail}`.toLowerCase();
  }
}
