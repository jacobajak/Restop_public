import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantPaymentAccount, MobileNetworkEnum } from '../entities/tenant-payment-account.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { FlutterwaveSubaccountService } from './flutterwave-subaccount.service';

/**
 * TenantPaymentAccountService
 * 
 * Manages tenant's mobile money payment accounts for payouts
 * - Create/read/update/delete accounts
 * - Validate phone numbers
 * - Manage default account selection
 * - Verify account ownership
 */
@Injectable()
export class TenantPaymentAccountService {
  private readonly logger = new Logger(TenantPaymentAccountService.name);

  constructor(
    @InjectRepository(TenantPaymentAccount)
    private readonly accountRepository: Repository<TenantPaymentAccount>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly flutterwaveSubaccountService: FlutterwaveSubaccountService,
  ) {}

  /**
   * Validate mobile phone number format
   * Supports Rwanda format: +250788123456 or 0788123456
   */
  private validatePhoneNumber(momo_number: string): boolean {
    // Remove spaces and common non-digits
    const cleaned = momo_number.replace(/[\s\-\(\)]/g, '');

    // Accept: 0788123456 (10 digits starting with 0)
    // Accept: +250788123456 (12 digits with +250)
    // Accept: 250788123456 (12 digits with 250)
    const regex = /^(?:\+250|250|0)(?:7|2)?\d{8}$/;

    return regex.test(cleaned);
  }

  /**
   * Normalize phone number to standard format for Flutterwave
   * Converts all formats to +250XXXXXXXXX
   */
  private normalizePhoneNumber(momo_number: string): string {
    let cleaned = momo_number.replace(/[\s\-\(\)]/g, '');

    // Remove leading 0 if present (Rwanda domestic)
    if (cleaned.startsWith('0')) {
      cleaned = '250' + cleaned.substring(1);
    }

    // Remove leading + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Ensure 250 prefix
    if (!cleaned.startsWith('250')) {
      cleaned = '250' + cleaned;
    }

    return '+' + cleaned;
  }

  /**
   * Create new payment account for tenant
   */
  async createPaymentAccount(
    tenantId: string,
    network: MobileNetworkEnum,
    momo_number: string,
    account_name?: string,
  ): Promise<TenantPaymentAccount> {
    // Verify tenant exists
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Validate phone number
    if (!this.validatePhoneNumber(momo_number)) {
      throw new BadRequestException(
        'Invalid phone number format. Use +250788123456 or 0788123456',
      );
    }

    // Normalize phone number
    const normalized_number = this.normalizePhoneNumber(momo_number);

    // Check if account already exists for this network
    const existing = await this.accountRepository.findOne({
      where: {
        tenant_id: tenantId,
        network,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Account already exists for ${network} network. Update or delete it first.`,
      );
    }

    // Check if this is the first account (should be default)
    const existingAccounts = await this.accountRepository.find({
      where: { tenant_id: tenantId },
    });

    const is_default = existingAccounts.length === 0;

    // Create new account
    const account = this.accountRepository.create({
      tenant_id: tenantId,
      network,
      momo_number: normalized_number,
      account_name: account_name || `${network} Account`,
      is_verified: false, // Requires admin verification
      is_default,
    });

    const savedAccount = await this.accountRepository.save(account);

    // 🧠 NEW: Create Flutterwave subaccount for split payments
    // Split at payment time - no manual payout needed
    try {
      const subaccountId = await this.flutterwaveSubaccountService.createSubaccount(
        savedAccount,
        tenant.name,
        tenant.email,
      );

      // Update account with subaccount ID
      savedAccount.flutterwave_subaccount_id = subaccountId;
      await this.accountRepository.save(savedAccount);

      this.logger.log(
        `✅ Created ${network} payment account (subaccount: ${subaccountId})`,
      );
    } catch (error: any) {
      // Log error but don't fail account creation
      // Account exists but won't receive split payments until subaccount is working
      this.logger.error(
        `⚠️  Failed to create Flutterwave subaccount: ${error.message}`,
      );
    }

    return savedAccount;
  }

  /**
   * Get all payment accounts for tenant
   */
  async getPaymentAccounts(tenantId: string): Promise<TenantPaymentAccount[]> {
    return this.accountRepository.find({
      where: { tenant_id: tenantId },
      order: { is_default: 'DESC', created_at: 'DESC' },
    });
  }

  /**
   * Get payment account by ID, verify ownership
   */
  async getPaymentAccountById(
    tenantId: string,
    accountId: string,
  ): Promise<TenantPaymentAccount> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException('Payment account not found');
    }

    return account;
  }

  /**
   * Get default payment account for tenant
   * Used during payout process
   */
  async getDefaultPaymentAccount(
    tenantId: string,
  ): Promise<TenantPaymentAccount | null> {
    return this.accountRepository.findOne({
      where: {
        tenant_id: tenantId,
        is_default: true,
      },
    });
  }

  /**
   * Get verified default account for specific network
   * Used during payout (from payout.service.ts)
   */
  async getVerifiedPaymentAccount(
    tenantId: string,
    network: string,
  ): Promise<TenantPaymentAccount | null> {
    return this.accountRepository.findOne({
      where: {
        tenant_id: tenantId,
        network: network as any,
        is_verified: true,
        is_default: true,
      },
    });
  }

  /**
   * Update payment account details
   */
  async updatePaymentAccount(
    tenantId: string,
    accountId: string,
    updates: { momo_number?: string; account_name?: string },
  ): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccountById(tenantId, accountId);

    // Validate new phone if provided
    if (updates.momo_number) {
      if (!this.validatePhoneNumber(updates.momo_number)) {
        throw new BadRequestException(
          'Invalid phone number format. Use +250788123456 or 0788123456',
        );
      }

      account.momo_number = this.normalizePhoneNumber(updates.momo_number);
      // Mark as unverified when number changes
      account.is_verified = false;
      account.rejection_reason = null;
      account.rejected_at = null;
    }

    if (updates.account_name) {
      account.account_name = updates.account_name;
    }

    const updated = await this.accountRepository.save(account);

    this.logger.log(
      `Updated payment account ${accountId} for tenant ${tenantId}`,
    );

    return updated;
  }

  /**
   * Delete payment account
   * Cannot delete if it's the only account or default account with dependents
   */
  async deletePaymentAccount(tenantId: string, accountId: string): Promise<void> {
    const account = await this.getPaymentAccountById(tenantId, accountId);

    const totalAccounts = await this.accountRepository.count({
      where: { tenant_id: tenantId },
    });

    if (totalAccounts === 1) {
      throw new BadRequestException(
        'Cannot delete the only payment account. Add another account first.',
      );
    }

    if (account.is_default) {
      // Set another account as default
      const otherAccount = await this.accountRepository.findOne({
        where: { tenant_id: tenantId, is_default: false },
        order: { created_at: 'ASC' },
      });

      if (otherAccount) {
        otherAccount.is_default = true;
        await this.accountRepository.save(otherAccount);
      }
    }

    await this.accountRepository.delete(accountId);

    this.logger.log(`Deleted payment account ${accountId} for tenant ${tenantId}`);
  }

  /**
   * Set payment account as default
   */
  async setDefaultPaymentAccount(
    tenantId: string,
    accountId: string,
  ): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccountById(tenantId, accountId);

    // Unset current default
    await this.accountRepository.update(
      { tenant_id: tenantId, is_default: true },
      { is_default: false },
    );

    // Set new default
    account.is_default = true;
    const updated = await this.accountRepository.save(account);

    this.logger.log(
      `Set payment account ${accountId} as default for tenant ${tenantId}`,
    );

    return updated;
  }

  /**
   * Mark account as verified (admin only)
   */
  async verifyPaymentAccount(
    tenantId: string,
    accountId: string,
  ): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccountById(tenantId, accountId);

    account.is_verified = true;
    account.rejection_reason = null;
    account.rejected_at = null;

    const updated = await this.accountRepository.save(account);

    this.logger.log(`Verified payment account ${accountId} for tenant ${tenantId}`);

    return updated;
  }

  /**
   * Reject account with reason (admin only)
   */
  async rejectPaymentAccount(
    tenantId: string,
    accountId: string,
    reason: string,
  ): Promise<TenantPaymentAccount> {
    const account = await this.getPaymentAccountById(tenantId, accountId);

    account.is_verified = false;
    account.rejection_reason = reason;
    account.rejected_at = new Date();

    const updated = await this.accountRepository.save(account);

    this.logger.log(
      `Rejected payment account ${accountId} for tenant ${tenantId}: ${reason}`,
    );

    return updated;
  }
}
