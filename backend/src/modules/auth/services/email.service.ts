import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Email Service
 * 
 * Handles all email delivery via nodemailer.
 * For MVP, uses Ethereal Email (test service).
 * For production, configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 * 
 * Features:
 * - Template-based email sending
 * - Error logging and resilience
 * - Non-blocking email delivery (fire and forget)
 * - Support for multiple transport types
 * 
 * @service EmailService
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    // Initialize with production SMTP or placeholder immediately
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      // Production SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT', 587),
        secure: this.configService.get('SMTP_SECURE', false),
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
      this.logger.log('Email service initialized with production SMTP');
      this.isInitialized = true;
    } else {
      // Development: Create placeholder - will be replaced in onModuleInit
      this.transporter = null;
      this.logger.log('Email service initialized, waiting for Ethereal account...');
    }
  }

  /**
   * Lifecycle hook - Initialize Ethereal test account BEFORE the app starts receiving requests
   * This runs AFTER all modules are initialized but BEFORE the app listenss on a port
   */
  async onModuleInit() {
    if (this.isInitialized) return;

    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (nodeEnv === 'development') {
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
          `✅ Email service initialized with Ethereal: ${testAccount.user}`,
        );
        this.isInitialized = true;
      } catch (error) {
        this.logger.error('❌ Failed to initialize Ethereal account:', error);
        this.isInitialized = false; // Mark as not initialization so sendEmail will retry
      }
    }
  }

  /**
   * Explicit check and initialization method for bootstrapping
   * Can be called from main.ts to ensure email service is ready
   */
  async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized && this.transporter) {
      return true;
    }

    if (this.configService.get('NODE_ENV') === 'production') {
      return true; // Production uses SMTP from constructor
    }

    // Development mode - ensure Ethereal is ready
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
      this.isInitialized = true;
      this.logger.log(`✅ Email service ensured ready with Ethereal: ${testAccount.user}`);
      return true;
    } catch (error) {
      this.logger.error('❌ Failed to ensure email service ready:', error);
      return false;
    }
  }

  /**
   * Send OTP email to user
   * 
   * @param email - Recipient email address
   * @param otp - 6-digit OTP code
   * @param expiresInMinutes - Expiration time in minutes
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendOtpEmail(
    email: string,
    otp: string,
    expiresInMinutes: number = 10,
  ): Promise<boolean> {
    try {
      // Ensure transporter is initialized before sending
      if (!this.isInitialized && this.configService.get('NODE_ENV') === 'development') {
        await this.ensureInitialized();
      }

      const html = `
        <div style="background-color: #f5f5f5; padding: 20px; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">DineFlow 2FA Verification</h2>
            
            <p style="color: #666; font-size: 16px;">
              Your one-time password (OTP) for secure login is:
            </p>
            
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="font-size: 32px; font-weight: bold; color: #333; margin: 0; letter-spacing: 4px;">
                ${otp}
              </p>
            </div>
            
            <p style="color: #999; font-size: 14px; text-align: center;">
              This code will expire in ${expiresInMinutes} minutes.
            </p>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              If you didn't request this code, please ignore this email and contact support.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2026 DineFlow. All rights reserved.
            </p>
          </div>
        </div>
      `;

      const text = `
        DineFlow 2FA Verification
        
        Your one-time password (OTP) for secure login is:
        
        ${otp}
        
        This code will expire in ${expiresInMinutes} minutes.
        
        If you didn't request this code, please ignore this email and contact support.
        
        © 2026 DineFlow
      `;

      const result = await this.sendEmail({
        to: email,
        subject: 'DineFlow 2FA Verification Code',
        text,
        html,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      // Don't throw - email failure shouldn't block authentication
      return false;
    }
  }

  /**
   * Send order confirmation email
   * 
   * @param email - Customer email
   * @param orderCode - Unique order code
   * @param total - Order total amount
   * @returns Promise<boolean>
   */
  async sendOrderConfirmationEmail(
    email: string,
    orderCode: string,
    total: number,
  ): Promise<boolean> {
    try {
      const html = `
        <div style="background-color: #f5f5f5; padding: 20px; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Order Confirmed</h2>
            
            <p style="color: #666; font-size: 16px;">
              Thank you for your order! Your order has been received and is being prepared.
            </p>
            
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #666; margin: 10px 0;">
                <strong>Order Code:</strong> ${orderCode}
              </p>
              <p style="color: #666; margin: 10px 0;">
                <strong>Total Amount:</strong> $${total.toFixed(2)}
              </p>
            </div>
            
            <p style="color: #999; font-size: 14px;">
              You can track your order status in the DineFlow app.
            </p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: email,
        subject: `Order Confirmation - ${orderCode}`,
        text: `Order Code: ${orderCode}\nTotal: $${total.toFixed(2)}\n\nYou can track your order status in the DineFlow app.`,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send order confirmation to ${email}:`, error);
      return false;
    }
  }

  /**
   * Send payment confirmation email
   * 
   * @param email - Customer email
   * @param orderCode - Order code
   * @param paymentMethod - Payment method used
   * @returns Promise<boolean>
   */
  async sendPaymentConfirmationEmail(
    email: string,
    orderCode: string,
    paymentMethod: string,
  ): Promise<boolean> {
    try {
      const html = `
        <div style="background-color: #f5f5f5; padding: 20px; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">✓ Payment Confirmed</h2>
            
            <p style="color: #666; font-size: 16px;">
              Your payment has been received. Your order is now being prepared.
            </p>
            
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #666; margin: 10px 0;">
                <strong>Order Code:</strong> ${orderCode}
              </p>
              <p style="color: #666; margin: 10px 0;">
                <strong>Payment Method:</strong> ${paymentMethod}
              </p>
            </div>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: email,
        subject: `Payment Confirmed - ${orderCode}`,
        text: `Payment confirmed for order ${orderCode} via ${paymentMethod}.\n\nYour order is being prepared.`,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation to ${email}:`, error);
      return false;
    }
  }

  /**
   * Generic email sending method
   * 
   * @param options - Email options
   * @returns Promise<boolean> - true if sent successfully
   */
  private async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // If transporter not ready, attempt one-time initialization
      if (!this.transporter) {
        this.logger.warn('⚠️  Transporter not initialized, attempting initialization...');
        const nodeEnv = this.configService.get('NODE_ENV', 'development');
        if (nodeEnv === 'development') {
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
            this.logger.log(`✅ Emergency Ethereal initialization: ${testAccount.user}`);
          } catch (err) {
            this.logger.error('❌ Emergency initialization failed:', err);
            return false; // Non-blocking failure
          }
        } else {
          this.logger.error('❌ Transporter not available in production mode');
          return false;
        }
      }

      // Double-check transporter exists
      if (!this.transporter) {
        this.logger.error('❌ Transporter is still not available after initialization attempt');
        return false;
      }

      const result = await this.transporter.sendMail({
        from: this.configService.get(
          'EMAIL_FROM',
          'noreply@dineflow.app',
        ),
        ...options,
      });

      this.logger.debug(`✉️  Email sent to ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${options.to}:`, error);
      // Non-blocking - email delivery is not critical to authentication
      return false;
    }
  }
}
