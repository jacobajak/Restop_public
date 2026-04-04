import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEvent, PaymentEventTypeEnum } from '../entities/payment-event.entity';

/**
 * PaymentEventService
 * 
 * Logs all payment-related events to create an audit trail.
 * 
 * Used by:
 * - PaymentService: logs INITIATED events
 * - WebhookService: logs WEBHOOK_RECEIVED events
 * - TransactionVerificationService: logs VERIFIED, CONFIRMED, FAILED events
 * - PayoutService: logs PAYOUT_TRIGGERED, PAYOUT_SUCCESS, PAYOUT_FAILED events
 * 
 * Useful for:
 * - Debugging payment issues
 * - User support (what happened to my payment?)
 * - Audit trail for compliance
 * - Reconciliation with payment provider
 */
@Injectable()
export class PaymentEventService {
  private readonly logger = new Logger(PaymentEventService.name);

  constructor(
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepository: Repository<PaymentEvent>,
  ) {}

  /**
   * Log a payment event
   */
  async logEvent(
    orderId: string,
    eventType: PaymentEventTypeEnum,
    data?: {
      payload?: Record<string, any>;
      description?: string;
      error?: string;
    },
  ): Promise<PaymentEvent> {
    try {
      const event = this.paymentEventRepository.create({
        order_id: orderId,
        event_type: eventType,
        event_payload: data?.payload,
        description: data?.description,
        error_message: data?.error,
      });

      const savedEvent = await this.paymentEventRepository.save(event);

      this.logger.debug(
        `📝 Event logged: order=${orderId}, type=${eventType}, description=${data?.description}`,
      );

      return savedEvent;
    } catch (error: any) {
      this.logger.error(
        `Failed to log payment event: ${error.message}`,
      );
      // Don't throw - logging failures should not crash payment processing
      return null;
    }
  }

  /**
   * Get event history for an order
   */
  async getEventHistory(orderId: string): Promise<PaymentEvent[]> {
    return this.paymentEventRepository.find({
      where: { order_id: orderId },
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Get latest event for an order
   */
  async getLatestEvent(orderId: string): Promise<PaymentEvent | null> {
    return this.paymentEventRepository.findOne({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Search events by type
   */
  async getEventsByType(
    orderId: string,
    eventType: PaymentEventTypeEnum,
  ): Promise<PaymentEvent[]> {
    return this.paymentEventRepository.find({
      where: {
        order_id: orderId,
        event_type: eventType,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get all failed payment events
   */
  async getFailedEvents(
    limit: number = 10,
  ): Promise<PaymentEvent[]> {
    return this.paymentEventRepository.find({
      where: [
        { event_type: PaymentEventTypeEnum.FAILED },
        { event_type: PaymentEventTypeEnum.PAYOUT_FAILED },
      ],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
