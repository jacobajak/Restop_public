import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { TenantPaymentAccount } from '../entities/tenant-payment-account.entity';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { PaymentTransaction, TransactionKindEnum } from '../entities/payment.entity';
import { PaypackIntegrationService } from './paypack-integration.service';
import * as crypto from 'crypto';

/**
 * PayoutService - Triggers instant cashout to tenant after successful cashin
 * 
 * Spec: Section 10 — Instant Payout Logic
 * 
 * Triggered only after successful cashin confirmed by webhook.
 * 
 * Flow:
 * 1. Load tenant and verified payment account
 * 2. Create payout record with PENDING status
 * 3. Call Paypack cashout
 * 4. Update payout with Paypack reference
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(TenantPaymentAccount)
    private readonly tenantPaymentAccountRepository: Repository<TenantPaymentAccount>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    private readonly paypackService: PaypackIntegrationService,
  ) {}

  /**
   * Generate idempotency key for Paypack cashout call
   */
  private generateIdempotencyKey(txRef: string, kind: string): string {
    return `${txRef}-${kind}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get tenant's verified default payment account for a specific network
   * 
   * @param tenantId Tenant ID
   * @param network MTN or AIRTEL
   */
  private async getVerifiedPaymentAccount(
    tenantId: string,
    network: string,
  ): Promise<TenantPaymentAccount | null> {
    return this.tenantPaymentAccountRepository.findOne({
      where: {
        tenant_id: tenantId,
        network: network as any,
        is_verified: true,
        is_default: true,
      },
    });
  }

  /**
   * Create a failed payout record with reason
   */
  private async createFailedPayout(
    orderId: string,
    tenantId: string,
    reason: string,
    amount: number,
  ): Promise<Payout> {
    this.logger.warn(`Creating failed payout for order ${orderId}: ${reason}`);

    const payout = this.payoutRepository.create({
      order_id: orderId,
      tenant_id: tenantId,
      tenant_payment_account_id: null,
      amount,
      status: PayoutStatusEnum.FAILED,
      raw_payload: { error: reason },
    });

    return this.payoutRepository.save(payout);
  }

  /**
   * Trigger instant payout to tenant
   * 
   * Spec: Section 10 — Pseudo-flow
   * 
   * Called immediately after successful cashin webhook.
   * Must NOT fail the order if payout fails.
   * 
   * @param orderId Order ID to trigger payout for
   */
  async triggerInstantPayout(orderId: string): Promise<Payout | null> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Only payout if order is marked PAID
    if (order.payment_status !== PaymentStatusEnum.PAID) {
      throw new BadRequestException(
        `Order must be PAID to trigger payout (current: ${order.payment_status})`,
      );
    }

    // Determine network from order payment method
    if (!['MTN', 'AIRTEL'].includes(order.payment_method)) {
      this.logger.debug(
        `Order ${orderId} is ${order.payment_method}, no payout needed`,
      );
      return null;
    }

    // Get tenant's verified payment account for the network
    const tenantAccount = await this.getVerifiedPaymentAccount(
      order.tenant_id,
      order.payment_method,
    );

    if (!tenantAccount) {
      const payout = await this.createFailedPayout(
        orderId,
        order.tenant_id,
        'NO_VERIFIED_ACCOUNT',
        order.total_amount,
      );

      this.logger.error(
        `No verified ${order.payment_method} account for tenant ${order.tenant_id}`,
      );
      // TODO: Alert operations
      return payout;
    }

    // Create payout record
    const payout = this.payoutRepository.create({
      order_id: orderId,
      tenant_id: order.tenant_id,
      tenant_payment_account_id: tenantAccount.id,
      amount: order.total_amount,
      status: PayoutStatusEnum.PENDING,
    });

    await this.payoutRepository.save(payout);

    try {
      // Create idempotency key
      const idempotencyKey = this.generateIdempotencyKey(order.tx_ref, 'cashout');

      // Call Paypack cashout
      const paypackResponse = await this.paypackService.initiateCashout({
        amount: order.total_amount,
        phone_number: tenantAccount.momo_number,
        order_id: orderId,
        idempotency_key: idempotencyKey,
      });

      // Update payout with Paypack reference
      payout.provider_ref = paypackResponse.ref;
      payout.status = this.mapCashoutStatus(paypackResponse.status);
      payout.raw_payload = paypackResponse;
      await this.payoutRepository.save(payout);

      // Record payment transaction for cashout
      const paymentTransaction = this.paymentTransactionRepository.create({
        order_id: orderId,
        tenant_id: order.tenant_id,
        provider: 'PAYPACK',
        kind: TransactionKindEnum.CASHOUT,
        provider_ref: paypackResponse.ref,
        amount: order.total_amount,
        status: paypackResponse.status,
        raw_payload: paypackResponse,
      });
      await this.paymentTransactionRepository.save(paymentTransaction);

      this.logger.log(
        `Instant payout initiated for order ${orderId}: ref=${paypackResponse.ref}`,
      );

      return payout;
    } catch (error) {
      this.logger.error(
        `Error initiating cashout for order ${orderId}: ${error.message}`,
        error.stack,
      );

      // Mark payout as failed
      payout.status = PayoutStatusEnum.FAILED;
      payout.raw_payload = { error: error.message };
      await this.payoutRepository.save(payout);

      // TODO: Alert operations
      return payout;
    }
  }

  /**
   * Map Paypack status to payout status
   */
  private mapCashoutStatus(paypackStatus: string): PayoutStatusEnum {
    if (paypackStatus === 'successful') {
      return PayoutStatusEnum.SUCCESSFUL;
    }
    if (paypackStatus === 'failed') {
      return PayoutStatusEnum.FAILED;
    }
    return PayoutStatusEnum.PENDING;
  }

  /**
   * Retry a failed payout
   * 
   * @param payoutId Payout ID to retry
   */
  async retryPayout(payoutId: string): Promise<Payout> {
    const payout = await this.payoutRepository.findOne({
      where: { id: payoutId },
      relations: ['order', 'tenant_payment_account'],
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (!payout.order || !payout.tenant_payment_account) {
      throw new BadRequestException('Payout is missing required relations');
    }

    if (payout.status !== PayoutStatusEnum.FAILED) {
      throw new BadRequestException(
        `Payout must be FAILED to retry (current: ${payout.status})`,
      );
    }

    try {
      payout.status = PayoutStatusEnum.PENDING;

      // Create new idempotency key
      const idempotencyKey = this.generateIdempotencyKey(
        payout.order.tx_ref,
        'cashout-retry',
      );

      // Call Paypack cashout
      const paypackResponse = await this.paypackService.initiateCashout({
        amount: payout.amount,
        phone_number: payout.tenant_payment_account.momo_number,
        order_id: payout.order_id,
        idempotency_key: idempotencyKey,
      });

      // Update payout
      payout.provider_ref = paypackResponse.ref;
      payout.status = this.mapCashoutStatus(paypackResponse.status);
      payout.raw_payload = paypackResponse;
      await this.payoutRepository.save(payout);

      this.logger.log(`Payout ${payoutId} retried: ref=${paypackResponse.ref}`);

      return payout;
    } catch (error) {
      this.logger.error(
        `Error retrying payout ${payoutId}: ${error.message}`,
        error.stack,
      );
      payout.status = PayoutStatusEnum.FAILED;
      payout.raw_payload = { error: error.message };
      await this.payoutRepository.save(payout);

      throw error;
    }
  }

  /**
   * Get payout status
   */
  async getPayoutStatus(payoutId: string): Promise<Payout> {
    const payout = await this.payoutRepository.findOne({ where: { id: payoutId } });
    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }
    return payout;
  }

  /**
   * Find payouts by order ID
   */
  async findPayoutsByOrderId(orderId: string): Promise<Payout[]> {
    return this.payoutRepository.find({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });
  }
}
