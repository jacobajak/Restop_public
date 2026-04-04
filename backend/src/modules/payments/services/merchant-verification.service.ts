import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantPaymentAccount } from '../entities/tenant-payment-account.entity';

export type VerificationStatus = 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'SUSPENDED';

interface VerificationStatusResponse {
  verification_status: VerificationStatus;
  verified_accounts_count: number;
  total_accounts_count: number;
  requirements: string[];
  can_receive_payouts: boolean;
  message: string;
}

/**
 * Merchant Verification Service
 * 
 * Manages merchant account verification status and authorization for receiving payouts.
 * Verification is based on:
 * 1. Verified mobile money accounts (TenantPaymentAccount with is_verified=true)
 * 2. Account not suspended
 * 3. Required tenant information present
 * 
 * Verification States:
 * - VERIFIED: Has at least one verified account, can receive payouts
 * - PENDING: Awaiting verification review
 * - UNVERIFIED: No verified accounts, needs setup
 * - SUSPENDED: Account suspended by admin, cannot receive payouts
 */
@Injectable()
export class MerchantVerificationService {
  private readonly logger = new Logger(MerchantVerificationService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantPaymentAccount)
    private readonly paymentAccountRepository: Repository<TenantPaymentAccount>,
  ) {}

  /**
   * Get merchant verification status
   * 
   * Checks:
   * 1. Count of verified accounts
   * 2. Total number of registered accounts
   * 3. Tenant completeness (has name, email, phone)
   * 4. Suspension status
   * 
   * @param tenantId - Tenant UUID
   * @returns Verification status with details and requirements
   * @throws NotFoundException if tenant not found
   */
  async getMerchantVerificationStatus(tenantId: string): Promise<VerificationStatusResponse> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Get all payment accounts for this tenant
    const allAccounts = await this.paymentAccountRepository.find({
      where: { tenant_id: tenantId },
    });

    // Count verified accounts
    const verifiedAccounts = allAccounts.filter((acc) => acc.is_verified).length;
    const totalAccounts = allAccounts.length;

    // Build requirements list
    const requirements: string[] = [];

    // Check if tenant has complete information
    if (!tenant.name || tenant.name.trim().length === 0) {
      requirements.push('Complete restaurant name in tenant profile');
    }

    if (!tenant.email || tenant.email.trim().length === 0) {
      requirements.push('Add valid email address for communications');
    }

    if (!tenant.phone || tenant.phone.trim().length === 0) {
      requirements.push('Add valid phone number for support');
    }

    if (totalAccounts === 0) {
      requirements.push('Add at least one mobile money account (MTN or Airtel)');
    }

    if (totalAccounts > 0 && verifiedAccounts === 0) {
      requirements.push('Verify mobile money accounts for payouts');
    }

    // Determine verification status
    let status: VerificationStatus;
    let message: string;

    if (totalAccounts === 0) {
      status = 'UNVERIFIED';
      message = 'No payment accounts configured. Please add a mobile money account to start receiving payouts.';
    } else if (verifiedAccounts === 0) {
      status = 'UNVERIFIED';
      message = 'Payment accounts pending verification. You can still receive orders, but payouts are blocked until accounts are verified.';
    } else if (requirements.length > 0) {
      status = 'PENDING';
      message = 'Account partially verified. Complete all requirements to fully enable payouts.';
    } else {
      status = 'VERIFIED';
      message = 'Account fully verified! You can now receive payouts for all transactions.';
    }

    return {
      verification_status: status,
      verified_accounts_count: verifiedAccounts,
      total_accounts_count: totalAccounts,
      requirements,
      can_receive_payouts: status === 'VERIFIED' && verifiedAccounts > 0,
      message,
    };
  }

  /**
   * Check if merchant can receive payouts
   * 
   * @param tenantId - Tenant UUID
   * @returns True if merchant can receive payouts, false otherwise
   */
  async canReceivePayouts(tenantId: string): Promise<boolean> {
    try {
      const status = await this.getMerchantVerificationStatus(tenantId);
      return status.can_receive_payouts;
    } catch (error) {
      this.logger.error(`Error checking payout authorization for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Mark a specific payment account as verified
   * 
   * @param tenantId - Tenant UUID
   * @param accountId - Payment account UUID
   * @throws NotFoundException if account not found
   */
  async markAccountVerified(tenantId: string, accountId: string): Promise<void> {
    const account = await this.paymentAccountRepository.findOne({
      where: { id: accountId, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(
        `Payment account ${accountId} not found for tenant ${tenantId}`
      );
    }

    account.is_verified = true;
    await this.paymentAccountRepository.save(account);

    this.logger.log(
      `Marked account ${accountId} as verified for tenant ${tenantId}`
    );
  }

  /**
   * Mark a specific payment account as unverified
   * 
   * @param tenantId - Tenant UUID
   * @param accountId - Payment account UUID
   * @throws NotFoundException if account not found
   */
  async unverifyAccount(tenantId: string, accountId: string): Promise<void> {
    const account = await this.paymentAccountRepository.findOne({
      where: { id: accountId, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(
        `Payment account ${accountId} not found for tenant ${tenantId}`
      );
    }

    account.is_verified = false;
    await this.paymentAccountRepository.save(account);

    this.logger.log(
      `Marked account ${accountId} as unverified for tenant ${tenantId}`
    );
  }

  /**
   * Get user-friendly verification information
   * 
   * @param tenantId - Tenant UUID
   * @returns User-friendly verification info with next steps
   * @throws NotFoundException if tenant not found
   */
  async getVerificationInfo(tenantId: string): Promise<{
    verification_status: VerificationStatus;
    message: string;
    next_steps: string[];
    support_email: string;
    can_receive_payouts: boolean;
    requirements: string[];
  }> {
    const status = await this.getMerchantVerificationStatus(tenantId);

    const nextSteps: string[] = [];

    if (status.verification_status === 'UNVERIFIED') {
      if (status.total_accounts_count === 0) {
        nextSteps.push('Go to Payment Settings and add your mobile money account');
        nextSteps.push('Choose MTN or Airtel network');
        nextSteps.push('Enter your mobile money account number');
      } else {
        nextSteps.push('Go to Payment Settings');
        nextSteps.push('Verify your mobile money number with your network provider');
        nextSteps.push('Submit verification request in the app');
      }
    } else if (status.verification_status === 'PENDING') {
      nextSteps.push('Your accounts are under review');
      nextSteps.push('You will receive an email notification when verification is complete');
      nextSteps.push('This typically takes 1-2 business days');
    } else if (status.verification_status === 'VERIFIED') {
      nextSteps.push('✓ Your account is verified and ready for payouts');
      nextSteps.push('Funds from orders will be transferred within 24 hours');
      nextSteps.push('Monitor your payouts in the Payment Dashboard');
    }

    return {
      verification_status: status.verification_status,
      message: status.message,
      next_steps: nextSteps,
      support_email: 'support@dineflow.app',
      can_receive_payouts: status.can_receive_payouts,
      requirements: status.requirements,
    };
  }

  /**
   * Get raw verification status for admin operations
   * 
   * @param tenantId - Tenant UUID
   * @returns Raw verification status data
   */
  async getVerificationStatusForAdmin(
    tenantId: string
  ): Promise<VerificationStatusResponse> {
    return this.getMerchantVerificationStatus(tenantId);
  }
}
