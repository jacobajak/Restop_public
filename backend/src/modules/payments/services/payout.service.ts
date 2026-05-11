import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PaymentStatusEnum } from '../../orders/entities/order.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantPaymentAccount } from '../entities/tenant-payment-account.entity';
import { Payout, PayoutStatusEnum } from '../entities/payout.entity';
import { PaymentTransaction, TransactionKindEnum } from '../entities/payment.entity';
import { FlutterwaveIntegrationService } from './flutterwave-integration.service';
import { AdminWalletService } from './admin-wallet.service';
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
 * 3. Call Flutterwave payout
 * 4. Update payout with Flutterwave reference
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantPaymentAccount)
    private readonly tenantPaymentAccountRepository: Repository<TenantPaymentAccount>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    private readonly flutterwaveService: FlutterwaveIntegrationService,
    private readonly adminWalletService: AdminWalletService,
  ) {}

  /**
   * Generate reference key for Flutterwave payout call
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

    // Calculate commission (10% of order total)
    const COMMISSION_RATE = 0.10;
    const commissionAmount = Math.round(order.total_amount * COMMISSION_RATE);
    const payoutAmount = order.total_amount - commissionAmount;

    // Create payout record with commission deducted
    const payout = this.payoutRepository.create({
      order_id: orderId,
      tenant_id: order.tenant_id,
      tenant_payment_account_id: tenantAccount.id,
      amount: payoutAmount,  // ← DEDUCTED BY COMMISSION
      status: PayoutStatusEnum.PENDING,
    });

    await this.payoutRepository.save(payout);

    try {
      // Create reference for Flutterwave call
      const reference = this.generateIdempotencyKey(order.tx_ref, 'cashout');

      // Load tenant to get business name
      const tenant = await this.tenantRepository.findOne({ where: { id: order.tenant_id } });
      const beneficiaryName = tenant?.name || 'Tenant Payout';

      // Call Flutterwave payout with REDUCED amount (commission already deducted)
      const flutterwaveResponse = await this.flutterwaveService.initiatePayout({
        reference: reference,
        amount: payoutAmount,  // ← REDUCED by commission
        beneficiary_name: beneficiaryName,
        beneficiary_account: tenantAccount.momo_number,
        currency: 'RWF',
      });

      // Update payout with Flutterwave reference
      payout.provider_ref = flutterwaveResponse.payout_id;
      payout.status = this.mapPayoutStatus(flutterwaveResponse.status);
      payout.raw_payload = flutterwaveResponse;
      await this.payoutRepository.save(payout);

      // Record payment transaction for cashout (with commission deducted)
      const paymentTransaction = this.paymentTransactionRepository.create({
        order_id: orderId,
        tenant_id: order.tenant_id,
        provider: 'FLUTTERWAVE',
        kind: TransactionKindEnum.CASHOUT,
        provider_ref: flutterwaveResponse.payout_id,
        amount: payoutAmount,  // ← REDUCED by commission
        currency: order.currency || 'RWF',
        status: flutterwaveResponse.status,
        raw_payload: flutterwaveResponse,
      });
      await this.paymentTransactionRepository.save(paymentTransaction);

      // Record platform commission to admin wallet
      try {
        await this.adminWalletService.creditPlatformFee(
          commissionAmount,
          order.tenant_id,
          `COMMISSION_${orderId}`,
          `Commission from order ${orderId}`,
        );

        this.logger.log(
          `Platform commission recorded: ${commissionAmount} RWF for order ${orderId}`,
        );
      } catch (commissionError) {
        this.logger.error(
          `Failed to record platform commission for order ${orderId}: ${commissionError.message}`,
        );
        // Don't fail the payout if commission recording fails
      }

      this.logger.log(
        `Instant payout initiated for order ${orderId}: ref=${flutterwaveResponse.payout_id}, payout=${payoutAmount}, commission=${commissionAmount}`,
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
   * Map Flutterwave status to payout status
   */
  private mapPayoutStatus(flutterwaveStatus: string): PayoutStatusEnum {
    if (flutterwaveStatus === 'success' || flutterwaveStatus === 'completed') {
      return PayoutStatusEnum.SUCCESSFUL;
    }
    if (flutterwaveStatus === 'failed') {
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

      // Call Flutterwave payout
      const payoutResult = await this.flutterwaveService.initiatePayout({
        reference: idempotencyKey,
        amount: payout.amount,
        beneficiary_name: payout.tenant.name,
        beneficiary_account: payout.tenant_payment_account.momo_number,
        currency: 'RWF',
      });

      // Update payout
      payout.provider_ref = payoutResult.payout_id;
      payout.status = this.mapPayoutStatus(payoutResult.status);
      payout.raw_payload = payoutResult;
      await this.payoutRepository.save(payout);

      this.logger.log(`Payout ${payoutId} retried: ref=${payoutResult.payout_id}`);

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
