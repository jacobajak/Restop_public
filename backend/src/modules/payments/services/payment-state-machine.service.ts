import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatusEnum } from '../../orders/entities/order.entity';

/**
 * PaymentStateMachine
 * 
 * Enforces strict payment state lifecycle.
 * 
 * Valid transitions:
 * - PENDING → INITIATED (payment API call made)
 * - INITIATED → PENDING (retry after failure)
 * - PENDING → PAID (webhook confirmed + API verified)
 * - PENDING/INITIATED → FAILED (verification failed)
 * - PAID → PAID (idempotent)
 * - FAILED → PAID (retry and succeed)
 * - FAILED → PENDING (retry reset)
 * 
 * Invalid transitions throw errors:
 * - Cannot go from PAID to anything else
 * - Cannot skip states (must go through proper progression)
 */
@Injectable()
export class PaymentStateMachine {
  private readonly logger = new Logger(PaymentStateMachine.name);

  /**
   * Check if transition is allowed
   */
  isTransitionAllowed(
    currentState: PaymentStatusEnum,
    targetState: PaymentStatusEnum,
  ): boolean {
    // Idempotent - same state is always allowed
    if (currentState === targetState) {
      return true;
    }

    // Define allowed transitions
    const allowedTransitions: Record<PaymentStatusEnum, PaymentStatusEnum[]> = {
      [PaymentStatusEnum.PENDING]: [
        PaymentStatusEnum.PENDING, // Idempotent
        PaymentStatusEnum.PAID, // Successful payment
        PaymentStatusEnum.FAILED, // Payment failed verification
        PaymentStatusEnum.CANCELLED, // Cancelled
      ],
      [PaymentStatusEnum.PAID]: [
        PaymentStatusEnum.PAID, // Idempotent
        PaymentStatusEnum.CANCELLED, // Cancelled after payment
      ],
      [PaymentStatusEnum.FAILED]: [
        PaymentStatusEnum.FAILED, // Idempotent
        PaymentStatusEnum.PENDING, // Retry reset
        PaymentStatusEnum.PAID, // Retry succeeded
      ],
      [PaymentStatusEnum.CANCELLED]: [
        PaymentStatusEnum.CANCELLED, // Idempotent
      ],
    };

    const allowed = allowedTransitions[currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Validate and perform state transition
   * 
   * Returns true if transition is allowed and performed.
   * Throws error if transition is invalid.
   */
  validateTransition(
    currentState: PaymentStatusEnum,
    targetState: PaymentStatusEnum,
    context?: string,
  ): void {
    const allowed = this.isTransitionAllowed(currentState, targetState);

    if (!allowed) {
      const error = `Invalid payment state transition: ${currentState} → ${targetState}${
        context ? ` (${context})` : ''
      }`;
      this.logger.error(error);
      throw new Error(error);
    }

    this.logger.debug(
      `✅ State transition allowed: ${currentState} → ${targetState}${
        context ? ` (${context})` : ''
      }`,
    );
  }

  /**
   * Get description of state for user-facing messages
   */
  getStateDescription(state: PaymentStatusEnum): string {
    const descriptions: Record<PaymentStatusEnum, string> = {
      [PaymentStatusEnum.PENDING]: 'Payment awaiting confirmation',
      [PaymentStatusEnum.PAID]: 'Payment confirmed',
      [PaymentStatusEnum.FAILED]: 'Payment failed - please try again',
      [PaymentStatusEnum.CANCELLED]: 'Payment cancelled',
    };

    return descriptions[state] || 'Unknown state';
  }

  /**
   * Get ordinal position of state in lifecycle
   * 
   * Used for UI progress indicators.
   * - PENDING: Step 1 (initial)
   * - INITIATED: Step 2 (in progress)
   * - PAID: Step 3 (complete)
   * - FAILED: Special state (error)
   * - CANCELLED: Special state (cancelled)
   */
  getStateOrdinal(state: PaymentStatusEnum): number {
    const ordinals: Record<PaymentStatusEnum, number> = {
      [PaymentStatusEnum.PENDING]: 1,
      [PaymentStatusEnum.PAID]: 3,
      [PaymentStatusEnum.FAILED]: -1, // Error state
      [PaymentStatusEnum.CANCELLED]: -2, // Cancelled state
    };

    return ordinals[state] || 0;
  }

  /**
   * Check if state is terminal (no further transitions possible)
   * 
   * PAID is terminal (payment complete)
   * Other states allow retries
   */
  isTerminal(state: PaymentStatusEnum): boolean {
    return state === PaymentStatusEnum.PAID;
  }

  /**
   * Check if state is error
   */
  isError(state: PaymentStatusEnum): boolean {
    return state === PaymentStatusEnum.FAILED;
  }

  /**
   * Check if state is pending completion
   */
  isPending(state: PaymentStatusEnum): boolean {
    return state === PaymentStatusEnum.PENDING;
  }
}
