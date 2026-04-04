import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantWallet,
  LedgerEntry,
  LedgerEntryTypeEnum,
  LedgerSourceEnum,
  LedgerStatusEnum,
} from '../entities/wallet.entity';

/**
 * WalletService
 * 
 * Manages tenant financial accounts.
 * 
 * 2-level balance system:
 * - available_balance: ready for payout
 * - pending_balance: awaiting confirmation
 * 
 * Every transaction flows through ledger (immutable audit log).
 * 
 * Cash flow examples:
 * 1. Payment succeeds → CREDIT wallet + LEDGER entry
 * 2. Refund issued → DEBIT wallet + reverse LEDGER entry
 * 3. Payout sent → DEBIT wallet + LEDGER entry
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(TenantWallet)
    private readonly walletRepository: Repository<TenantWallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
  ) {}

  /**
   * Get or create wallet for tenant
   */
  async getOrCreateWallet(tenantId: string): Promise<TenantWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { tenant_id: tenantId },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        tenant_id: tenantId,
        available_balance: 0,
        pending_balance: 0,
      });
      wallet = await this.walletRepository.save(wallet);
      this.logger.log(`✨ Wallet created for tenant ${tenantId}`);
    }

    return wallet;
  }

  /**
   * Credit wallet (money in)
   * 
   * Used for:
   * - Successful payment
   * - Commission reversal
   */
  async credit(
    tenantId: string,
    amount: number,
    source: LedgerSourceEnum,
    reference: string,
    description: string,
  ): Promise<{ wallet: TenantWallet; ledger: LedgerEntry }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    try {
      // Ensure wallet exists
      const wallet = await this.getOrCreateWallet(tenantId);

      // Create ledger entry (immutable audit log)
      const ledger = this.ledgerRepository.create({
        tenant_id: tenantId,
        type: LedgerEntryTypeEnum.CREDIT,
        amount,
        source,
        reference,
        status: LedgerStatusEnum.COMPLETED,
        description,
      });
      const savedLedger = await this.ledgerRepository.save(ledger);

      // Update wallet available_balance
      wallet.available_balance += amount;
      const savedWallet = await this.walletRepository.save(wallet);

      this.logger.log(
        `💵 Credit: tenant=${tenantId}, amount=${amount}, source=${source}, balance=${savedWallet.available_balance}`,
      );

      return {
        wallet: savedWallet,
        ledger: savedLedger,
      };
    } catch (error: any) {
      this.logger.error(`Failed to credit wallet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Debit wallet (money out)
   * 
   * Used for:
   * - Refunds
   * - Payouts
   */
  async debit(
    tenantId: string,
    amount: number,
    source: LedgerSourceEnum,
    reference: string,
    description: string,
  ): Promise<{ wallet: TenantWallet; ledger: LedgerEntry }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    try {
      const wallet = await this.getOrCreateWallet(tenantId);

      // Validate sufficient balance
      if (wallet.available_balance < amount) {
        throw new BadRequestException(
          `Insufficient balance. Available: ${wallet.available_balance}, requested: ${amount}`,
        );
      }

      // Create ledger entry
      const ledger = this.ledgerRepository.create({
        tenant_id: tenantId,
        type: LedgerEntryTypeEnum.DEBIT,
        amount,
        source,
        reference,
        status: LedgerStatusEnum.COMPLETED,
        description,
      });
      const savedLedger = await this.ledgerRepository.save(ledger);

      // Update wallet
      wallet.available_balance -= amount;
      const savedWallet = await this.walletRepository.save(wallet);

      this.logger.log(
        `💸 Debit: tenant=${tenantId}, amount=${amount}, source=${source}, balance=${savedWallet.available_balance}`,
      );

      return {
        wallet: savedWallet,
        ledger: savedLedger,
      };
    } catch (error: any) {
      this.logger.error(`Failed to debit wallet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reverse a ledger entry (e.g., if transaction failed)
   * 
   * Creates a new REVERSAL entry and adjusts wallet
   */
  async reverse(
    tenantId: string,
    originalLedgerId: string,
    reason: string,
  ): Promise<{ wallet: TenantWallet; reversal: LedgerEntry }> {
    try {
      // Get original entry
      const original = await this.ledgerRepository.findOne({
        where: { id: originalLedgerId },
      });

      if (!original) {
        throw new Error(`Ledger entry ${originalLedgerId} not found`);
      }

      // Create reversal entry (opposite direction)
      const reverseType =
        original.type === LedgerEntryTypeEnum.CREDIT
          ? LedgerEntryTypeEnum.DEBIT
          : LedgerEntryTypeEnum.CREDIT;

      const reversal = this.ledgerRepository.create({
        tenant_id: tenantId,
        type: reverseType,
        amount: original.amount,
        source: LedgerSourceEnum.REVERSAL,
        reference: `REVERSE-${original.reference}`,
        status: LedgerStatusEnum.COMPLETED,
        description: `Reversal of ${original.reference}: ${reason}`,
        reversed_entry_id: originalLedgerId,
      });
      const savedReversal = await this.ledgerRepository.save(reversal);

      // Update wallet
      const wallet = await this.getOrCreateWallet(tenantId);

      if (reverseType === LedgerEntryTypeEnum.CREDIT) {
        wallet.available_balance += original.amount;
      } else {
        wallet.available_balance -= original.amount;
      }

      const savedWallet = await this.walletRepository.save(wallet);

      this.logger.log(
        `↩️  Reversal: tenant=${tenantId}, original=${originalLedgerId}, amount=${original.amount}, reason=${reason}`,
      );

      return {
        wallet: savedWallet,
        reversal: savedReversal,
      };
    } catch (error: any) {
      this.logger.error(`Failed to reverse entry: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(tenantId: string): Promise<TenantWallet> {
    return this.getOrCreateWallet(tenantId);
  }

  /**
   * Get ledger history for tenant
   */
  async getLedgerHistory(
    tenantId: string,
    limit: number = 100,
  ): Promise<LedgerEntry[]> {
    return this.ledgerRepository.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get ledger entries by source
   */
  async getLedgerBySource(
    tenantId: string,
    source: LedgerSourceEnum,
  ): Promise<LedgerEntry[]> {
    return this.ledgerRepository.find({
      where: { tenant_id: tenantId, source },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Calculate total credits/debits for accounting
   */
  async getAccountingSummary(tenantId: string): Promise<{
    totalCredits: number;
    totalDebits: number;
    netBalance: number;
    creditsBySource: Record<string, number>;
  }> {
    const entries = await this.getLedgerHistory(tenantId, 10000); // Get all

    let totalCredits = 0;
    let totalDebits = 0;
    const creditsBySource: Record<string, number> = {};

    for (const entry of entries) {
      if (entry.status !== LedgerStatusEnum.COMPLETED) {
        continue; // Only count completed entries
      }

      if (entry.type === LedgerEntryTypeEnum.CREDIT) {
        totalCredits += entry.amount;
        creditsBySource[entry.source] = (creditsBySource[entry.source] || 0) + entry.amount;
      } else {
        totalDebits += entry.amount;
      }
    }

    return {
      totalCredits,
      totalDebits,
      netBalance: totalCredits - totalDebits,
      creditsBySource,
    };
  }
}
