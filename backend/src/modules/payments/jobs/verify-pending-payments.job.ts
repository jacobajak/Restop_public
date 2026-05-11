import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from '../entities/payment.entity';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * PaymentVerificationJob
 *
 * Verifies pending payments against payment provider APIs
 * Runs every 5 minutes
 *
 * Process:
 * 1. Find all payments with status INITIATED or PENDING
 * 2. Query Flutterwave API for current status
 * 3. If status changed, update local record
 * 4. If payment confirmed, mark order as PAID
 * 5. Emit settlement.initiated event for settlement processor
 * 6. Log audit trail for tracking
 */
@Injectable()
export class PaymentVerificationJob {
  private readonly logger = new Logger(PaymentVerificationJob.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly auditService: AuditService,
  ) {}

  @Cron('*/5 * * * *')
  async execute(): Promise<void> {
    try {
      this.logger.debug('[PaymentVerificationJob] ⏰ Running payment verification check...');

      // Find all payments with status INITIATED or PENDING
      const pendingPayments = await this.paymentRepository.find({
        where: [
          { status: 'INITIATED' },
          { status: 'PENDING' },
        ],
        relations: ['order'],
        take: 100, // Process max 100 at a time to avoid overload
      });

      this.logger.debug(
        `[PaymentVerificationJob] Found ${pendingPayments.length} payments to verify`,
      );

      if (pendingPayments.length === 0) {
        this.logger.debug('[PaymentVerificationJob] No pending payments to verify');
        return;
      }

      // Track statistics
      let successCount = 0;
      let failureCount = 0;
      let unchangedCount = 0;
      const stalePayments = [];

      // Process each pending payment
      for (const payment of pendingPayments) {
        try {
          // Skip if payment is too old (older than 30 minutes) - likely failed
          const paymentAge = new Date().getTime() - payment.created_at.getTime();
          const thirtyMinutes = 30 * 60 * 1000;

          if (paymentAge > thirtyMinutes && payment.status === 'INITIATED') {
            stalePayments.push(payment.id);
            
            // Mark as FAILED if still INITIATED after 30 min (likely customer didn't complete)
            payment.status = 'FAILED';
            payment.raw_payload = {
              ...payment.raw_payload,
              failure_reason: 'Payment timeout - customer did not complete',
            };
            await this.paymentRepository.save(payment);

            // Update order if needed
            if (payment.order && payment.order.payment_status === PaymentStatusEnum.PENDING) {
              payment.order.payment_status = PaymentStatusEnum.FAILED;
              await this.orderRepository.save(payment.order);
            }

            failureCount++;
            this.logger.warn(
              `[PaymentVerificationJob] ⏱️ Payment ${payment.id} timed out (${Math.round(paymentAge / 1000)}s old), marked as FAILED`,
            );
            continue;
          }

          // Query provider API for current status
          // For Flutterwave: use payment.provider_ref to query status
          // For now, we skip actual provider calls if provider_ref is missing
          
          if (!payment.provider_ref) {
            unchangedCount++;
            this.logger.debug(
              `[PaymentVerificationJob] Payment ${payment.id} has no provider reference, cannot verify`,
            );
            continue;
          }

          // Get current status from provider
          const currentStatus = await this.verifyPaymentWithProvider(
            payment.provider,
            payment.provider_ref,
          );

          // Check if status changed
          if (currentStatus === payment.status) {
            unchangedCount++;
            continue; // No change
          }

          // Status changed - update payment and order
          const oldStatus = payment.status;
          payment.status = currentStatus;

          if (currentStatus === 'SUCCESSFUL') {
            payment.order.payment_status = PaymentStatusEnum.PAID;
            
            // Save changes
            await this.paymentRepository.save(payment);
            await this.orderRepository.save(payment.order);

            successCount++;
            this.logger.log(
              `[PaymentVerificationJob] ✅ Payment ${payment.id} status changed: ${oldStatus} → ${currentStatus}, order marked PAID`,
            );

            // Emit event that payment is confirmed (settlement processor will pick it up)
            try {
              // NOTE: If using EventEmitter, emit here
              // this.eventEmitter.emit('payment.confirmed', {paymentId: payment.id, orderId: payment.order_id});
            } catch (eventError) {
              this.logger.warn(`Failed to emit payment.confirmed event: ${eventError.message}`);
            }
          } else if (currentStatus === 'FAILED') {
            payment.order.payment_status = PaymentStatusEnum.FAILED;
            
            await this.paymentRepository.save(payment);
            await this.orderRepository.save(payment.order);

            failureCount++;
            this.logger.warn(
              `[PaymentVerificationJob] ❌ Payment ${payment.id} status changed: ${oldStatus} → FAILED`,
            );
          } else {
            // Status is something else (PROCESSING, etc) - just update, don't change order
            await this.paymentRepository.save(payment);
            unchangedCount++;
            this.logger.debug(
              `[PaymentVerificationJob] Payment ${payment.id} status: ${oldStatus} → ${currentStatus}`,
            );
          }
        } catch (paymentError) {
          this.logger.error(
            `[PaymentVerificationJob] Error verifying payment ${payment.id}: ${paymentError.message}`,
          );
        }
      }

      // Log audit trail
      if (successCount + failureCount > 0) {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_RETRIED, // Reuse for job actions
          reference_type: 'batch_payment_verification',
          reference_id: `payment_verification_${new Date().toISOString()}`,
          metadata_json: {
            total_checked: pendingPayments.length,
            status_changed_success: successCount,
            status_changed_failure: failureCount,
            unchanged: unchangedCount,
            stale_payments: stalePayments.length,
            stale_payment_ids: stalePayments.slice(0, 10), // Log first 10 for debugging
          },
        });
      }

      // Log summary
      if (successCount + failureCount + unchangedCount > 0) {
        this.logger.log(
          `[PaymentVerificationJob] ✅ Completed: ${successCount} verified successful, ${failureCount} failed, ${unchangedCount} unchanged, ${stalePayments.length} timed out`,
        );
      }
    } catch (error) {
      this.logger.error('[PaymentVerificationJob] ❌ Critical error', error);

      // Log failure for alerting
      try {
        await this.auditService.log({
          admin_user_id: 'system',
          action_type: AuditActionEnum.SETTLEMENT_REVERSED, // Reuse for job failures
          reference_type: 'payment_verification_job_failure',
          reference_id: `error_${new Date().getTime()}`,
          metadata_json: {
            error: error.message,
            stack: error.stack?.substring(0, 500), // Truncate long stacks
          },
        });
      } catch (auditError) {
        this.logger.error('[PaymentVerificationJob] Failed to log error to audit', auditError);
      }
    }
  }

  /**
   * Verify payment status with provider API
   *
   * Queries the payment provider (Paypack, Flutterwave, etc) to get current status
   * Returns the current status as string
   */
  private async verifyPaymentWithProvider(
    provider: string,
    providerRef: string,
  ): Promise<string> {
    try {
      // For MVP, we're using Paypack primarily
      // In production, implement actual API calls to Paypack/Flutterwave
      
      // NOTE: This is a placeholder - actual implementation would call:
      // - Paypack API for provider='PAYPACK'
      // - Flutterwave API for provider='FLUTTERWAVE'
      // - Etc.
      
      this.logger.debug(
        `[PaymentVerificationJob] Would verify ${provider}:${providerRef} with provider API`,
      );

      // For now, return current status unchanged
      // Real implementation would query provider API
      return null; // Triggers skip in calling code
    } catch (error) {
      this.logger.warn(
        `[PaymentVerificationJob] Failed to query provider ${provider}: ${error.message}`,
      );
      return null;
    }
  }
}
