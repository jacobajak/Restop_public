import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantPaymentAccount, MobileNetworkEnum, MobileNetwork } from '../../payments/entities/tenant-payment-account.entity';
import { Tenant } from '../entities/tenant.entity';

/**
 * TenantPaymentAccountService
 * 
 * Manages tenant Mobile Money payment accounts for instant payout.
 * 
 * Spec: Section 3 — Data Model & Section 4 — Onboarding Flow
 */
@Injectable()
export class TenantPaymentAccountService {
  private readonly logger = new Logger(TenantPaymentAccountService.name);

  constructor(
    @InjectRepository(TenantPaymentAccount)
    private readonly accountRepository: Repository<TenantPaymentAccount>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Validate phone number format (basic validation)
   * Supports Rwandan numbers: 0788111111, +250788111111, etc.
   */
  private validatePhoneNumber(phoneNumber: string): boolean {
    // Remove any formatting
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Should be 12 digits (250788111111) or 10 digits (0788111111)
    return cleaned.length === 10 || cleaned.length === 12;
  }

  /**
   * Detect mobile network from phone number prefix
   * MTN: 078, 079
   * AIRTEL: 073, 074
   */
  private detectNetwork(phoneNumber: string): MobileNetwork {
    const digit3 = phoneNumber.substring(0, 3);
    
    // Handle both 0788... and 250788... formats
    if (['078', '079'].includes(digit3)) {
      return MobileNetworkEnum.MTN;
    }
    
    if (['073', '074'].includes(digit3)) {
      return MobileNetworkEnum.AIRTEL;
    }

    // Try with country code
    if (phoneNumber.includes('250')) {
      const idx = phoneNumber.indexOf('250') + 3;
      const nextDigits = phoneNumber.substring(idx, idx + 3);
      
      if (['078', '079'].includes(nextDigits)) {
        return MobileNetworkEnum.MTN;
      }
      
      if (['073', '074'].includes(nextDigits)) {
        return MobileNetworkEnum.AIRTEL;
      }
    }

    throw new BadRequestException('Unable to detect mobile network from phone number');
  }

  /**
   * Normalize phone number to standard format (0XXXXXXXXX)
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If it's 12 digits starting with 250 (country code), convert to 0
    if (cleaned.length === 12 && cleaned.startsWith('250')) {
      return '0' + cleaned.substring(3);
    }
    
    // If it's 10 digits and doesn't start with 0, add 0
    if (cleaned.length === 10 && !cleaned.startsWith('0')) {
      return '0' + cleaned;
    }
    
    // Return as-is if already normalized or 10 digits starting with 0
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return cleaned;
    }

    throw new BadRequestException('Unable to normalize phone number');
  }

  /**
   * Create or update a payment account for a tenant
   * 
   * Spec: Section 4 — Payment Setup (Steps 3-5)
   * 
   * @param tenantId Tenant ID
   * @param momo_number Mobile money number
   * @param account_name Optional account holder name
   */
  async createOrUpdatePaymentAccount(
    tenantId: string,
    momo_number: string,
    account_name?: string,
  ): Promise<TenantPaymentAccount> {
    // Verify tenant exists
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Validate phone number
    if (!momo_number) {
      throw new BadRequestException('momo_number is required');
    }

    if (!this.validatePhoneNumber(momo_number)) {
      throw new BadRequestException(
        'Invalid phone number format. Use format like 0788111111 or +250788111111',
      );
    }

    // Normalize phone number
    const normalizedNumber = this.normalizePhoneNumber(momo_number);

    // Detect network
    const network = this.detectNetwork(normalizedNumber);

    // Check if network mismatch (if user provided a network-specific number)
    this.logger.debug(`Creating account for tenant ${tenantId}: ${network} - ${normalizedNumber}`);

    // Check if account already exists for this network
    let account = await this.accountRepository.findOne({
      where: {
        tenant_id: tenantId,
        network,
      },
    });

    if (account) {
      // Update existing account
      account.momo_number = normalizedNumber;
      account.account_name = account_name || account.account_name;
      account.is_verified = false; // Reset verification when updating
      account.is_default = true;
    } else {
      // Create new account
      // If this is first account, set as default
      const existingCount = await this.accountRepository.count({
        where: { tenant_id: tenantId },
      });

      account = this.accountRepository.create({
        tenant_id: tenantId,
        network,
        momo_number: normalizedNumber,
        account_name: account_name || undefined,
        is_verified: false,
        is_default: existingCount === 0, // First account is default
      });
    }

    const savedAccount = await this.accountRepository.save(account);

    this.logger.log(
      `Payment account created/updated for tenant ${tenantId}: ${network}`,
    );

    return savedAccount;
  }

  /**
   * Get all payment accounts for a tenant
   */
  async getPaymentAccounts(tenantId: string): Promise<TenantPaymentAccount[]> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    return this.accountRepository.find({
      where: { tenant_id: tenantId },
      order: { is_default: 'DESC', created_at: 'ASC' },
    });
  }

  /**
   * Get a specific payment account
   */
  async getPaymentAccount(accountId: string): Promise<TenantPaymentAccount> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Payment account ${accountId} not found`);
    }

    return account;
  }

  /**
   * Set a payment account as default
   * 
   * Only one default account per network per tenant is allowed.
   */
  async setDefaultAccount(accountId: string, tenantId: string): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccount(accountId);

    if (account.tenant_id !== tenantId) {
      throw new BadRequestException('Unauthorized: Account does not belong to this tenant');
    }

    // Remove default from any other account with same network
    await this.accountRepository.update(
      {
        tenant_id: tenantId,
        network: account.network,
      },
      { is_default: false },
    );

    // Set this account as default
    account.is_default = true;
    await this.accountRepository.save(account);

    this.logger.log(
      `Payment account ${accountId} set as default for tenant ${tenantId}`,
    );

    return account;
  }

  /**
   * Verify a payment account (admin only)
   * 
   * Spec: Section 5 — Verification (MVP Option)
   * 
   * Once verified, this account can be used for instant payout.
   * Admin must manually verify account ownership.
   */
  async verifyPaymentAccount(
    accountId: string,
    tenantId: string,
  ): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccount(accountId);

    if (account.tenant_id !== tenantId) {
      throw new BadRequestException('Unauthorized: Account does not belong to this tenant');
    }

    if (account.is_verified) {
      throw new BadRequestException('Account is already verified');
    }

    account.is_verified = true;
    await this.accountRepository.save(account);

    this.logger.log(
      `Payment account ${accountId} verified for tenant ${tenantId}`,
    );

    return account;
  }

  /**
   * Reject a payment account (admin only)
   * 
   * Prevents account from being used for payouts.
   */
  async rejectPaymentAccount(
    accountId: string,
    tenantId: string,
    rejectionReason: string,
  ): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccount(accountId);

    if (account.tenant_id !== tenantId) {
      throw new BadRequestException('Unauthorized: Account does not belong to this tenant');
    }

    account.is_verified = false;
    account.rejection_reason = rejectionReason;
    account.rejected_at = new Date();

    await this.accountRepository.save(account);

    this.logger.log(
      `Payment account ${accountId} rejected for tenant ${tenantId}: ${rejectionReason}`,
    );

    return account;
  }

  /**
   * List pending verification accounts (admin view)
   */
  async listPendingVerificationAccounts(): Promise<TenantPaymentAccount[]> {
    return this.accountRepository.find({
      where: {
        is_verified: false,
        rejection_reason: null, // Not already rejected
      },
      order: { created_at: 'ASC' },
      relations: ['tenant'],
    });
  }

  /**
   * Get tenant's verified default account for a specific network
   * 
   * Used by PayoutService before triggering cashout.
   * 
   * Spec: Section 6 — Enforce Verification Rule
   */
  async getVerifiedDefaultAccount(
    tenantId: string,
    network: MobileNetwork,
  ): Promise<TenantPaymentAccount | null> {
    return this.accountRepository.findOne({
      where: {
        tenant_id: tenantId,
        network,
        is_verified: true,
        is_default: true,
      },
    });
  }

  /**
   * Delete a payment account (if not default or verified)
   */
  async deletePaymentAccount(accountId: string, tenantId: string): Promise<void> {
    const account = await this.getPaymentAccount(accountId);

    if (account.tenant_id !== tenantId) {
      throw new BadRequestException('Unauthorized: Account does not belong to this tenant');
    }

    if (account.is_default) {
      throw new BadRequestException('Cannot delete default payment account');
    }

    if (account.is_verified) {
      throw new BadRequestException('Cannot delete verified payment account');
    }

    await this.accountRepository.remove(account);

    this.logger.log(`Payment account ${accountId} deleted for tenant ${tenantId}`);
  }
}
