import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  AdminWallet,
  AdminWalletTypeEnum,
  AdminLedger,
  AdminLedgerSourceEnum,
  AdminLedgerStatusEnum,
  PlatformFeeCollectionDaily,
  TenantFeeBreakdown,
} from '../entities/admin-wallet.entity';

/**
 * AdminWalletService
 *
 * Manages platform admin wallet and ledger operations.
 *
 * Responsibilities:
 * 1. Maintain separate wallets for different revenue streams
 * 2. Record all fee collections and transfers
 * 3. Generate daily/monthly admin settlement reports
 * 4. Enable admin payouts and transfers
 * 5. Provide audit trail for financial compliance
 *
 * Fee Collection Flow:
 * - Transaction created → Platform fee calculated (3%)
 * - Payment confirmed → Admin wallet credited (PENDING → COMPLETED)
 * - Daily settlement → Daily totals recorded
 * - Admin review → Ready for payout
 */
@Injectable()
export class AdminWalletService {
  private readonly logger = new Logger(AdminWalletService.name);

  constructor(
    @InjectRepository(AdminWallet)
    private readonly adminWalletRepository: Repository<AdminWallet>,
    @InjectRepository(AdminLedger)
    private readonly adminLedgerRepository: Repository<AdminLedger>,
    @InjectRepository(PlatformFeeCollectionDaily)
    private readonly dailyCollectionRepository: Repository<PlatformFeeCollectionDaily>,
    @InjectRepository(TenantFeeBreakdown)
    private readonly tenantFeeBreakdownRepository: Repository<TenantFeeBreakdown>,
  ) {}

  /**
   * Initialize admin wallets on first run
   * Creates empty wallets for each revenue stream
   */
  async initializeWallets(): Promise<any> {
    const walletTypes = Object.values(AdminWalletTypeEnum);

    for (const type of walletTypes) {
      const existing = await this.adminWalletRepository.findOne({
        where: { wallet_type: type },
      });

      if (!existing) {
        const wallet = this.adminWalletRepository.create({
          wallet_type: type,
          available_balance: 0,
          pending_balance: 0,
          total_accumulated: 0,
          total_paid_out: 0,
        });

        await this.adminWalletRepository.save(wallet);
        this.logger.log(`Initialized admin wallet: ${type}`);
      }
    }

    return {
      success: true,
      message: 'Admin wallets initialized',
    };
  }

  /**
   * Get all admin wallet balances
   * Returns current state of all revenue streams
   */
  async getAllWallets(): Promise<any> {
    const wallets = await this.adminWalletRepository.find();

    return {
      success: true,
      data: {
        wallets: wallets.map(w => ({
          wallet_type: w.wallet_type,
          available_balance: w.available_balance,
          pending_balance: w.pending_balance,
          total_accumulated: w.total_accumulated,
          total_paid_out: w.total_paid_out,
          net_balance: w.available_balance + w.pending_balance,
          updated_at: w.updated_at,
        })),
        total_available: wallets.reduce((sum, w) => sum + w.available_balance, 0),
        total_pending: wallets.reduce((sum, w) => sum + w.pending_balance, 0),
        grand_total: wallets.reduce((sum, w) => sum + (w.available_balance + w.pending_balance), 0),
      },
    };
  }

  /**
   * Credit admin wallet with fees (called when payment confirmed)
   *
   * Moves amount from PENDING to available balance
   * Records in ledger for audit trail
   */
  async creditPlatformFee(
    amount: number,
    tenantId: string,
    reference: string,
    description: string,
    walletType: AdminWalletTypeEnum = AdminWalletTypeEnum.PLATFORM_FEES,
  ): Promise<any> {
    const wallet = await this.adminWalletRepository.findOne({
      where: { wallet_type: walletType },
    });

    if (!wallet) {
      throw new NotFoundException(`Admin wallet ${walletType} not found`);
    }

    // Credit the wallet
    wallet.available_balance += amount;
    wallet.pending_balance += amount;
    wallet.total_accumulated += amount;

    const updated = await this.adminWalletRepository.save(wallet);

    // Record ledger entry
    const ledger = this.adminLedgerRepository.create({
      wallet_type: walletType,
      source: AdminLedgerSourceEnum.COLLECTION,
      amount,
      reference,
      secondary_reference: tenantId,
      status: AdminLedgerStatusEnum.COMPLETED,
      description,
    });

    await this.adminLedgerRepository.save(ledger);

    this.logger.log(
      `✅ Platform fee credited: ${amount} to ${walletType} wallet (${reference})`,
    );

    return {
      success: true,
      wallet_balance: updated.available_balance,
      ledger_id: ledger.id,
    };
  }

  /**
   * Transfer amount between admin wallets
   * Used when consolidating or splitting revenue streams
   */
  async transferBetweenWallets(
    fromType: AdminWalletTypeEnum,
    toType: AdminWalletTypeEnum,
    amount: number,
    reference: string,
    notes?: string,
  ): Promise<any> {
    const fromWallet = await this.adminWalletRepository.findOne({
      where: { wallet_type: fromType },
    });

    const toWallet = await this.adminWalletRepository.findOne({
      where: { wallet_type: toType },
    });

    if (!fromWallet || !toWallet) {
      throw new NotFoundException('One or both wallets not found');
    }

    if (fromWallet.available_balance < amount) {
      throw new BadRequestException(
        `Insufficient balance in ${fromType}. Available: ${fromWallet.available_balance}`,
      );
    }

    // Perform transfer
    fromWallet.available_balance -= amount;
    toWallet.available_balance += amount;

    await this.adminWalletRepository.save([fromWallet, toWallet]);

    // Record ledger entries
    const description = notes || `Transfer from ${fromType} to ${toType}`;

    const fromLedger = this.adminLedgerRepository.create({
      wallet_type: fromType,
      source: AdminLedgerSourceEnum.TRANSFER,
      amount: -amount,
      reference,
      description: `OUT: ${description}`,
      status: AdminLedgerStatusEnum.COMPLETED,
    });

    const toLedger = this.adminLedgerRepository.create({
      wallet_type: toType,
      source: AdminLedgerSourceEnum.TRANSFER,
      amount,
      reference,
      description: `IN: ${description}`,
      status: AdminLedgerStatusEnum.COMPLETED,
    });

    await this.adminLedgerRepository.save([fromLedger, toLedger]);

    this.logger.log(`💸 Transfer: ${amount} from ${fromType} to ${toType}`);

    return {
      success: true,
      from_balance: fromWallet.available_balance,
      to_balance: toWallet.available_balance,
      reference,
    };
  }

  /**
   * Record daily fee collection snapshot
   * Called daily to create a summary of all fees collected
   */
  async recordDailyCollection(
    collectionDate: Date,
    totalFees: number,
    totalProviderFees: number,
    transactionCount: number,
    uniqueTenantCount: number,
  ): Promise<any> {
    // Check if already recorded
    const existing = await this.dailyCollectionRepository.findOne({
      where: { collection_date: collectionDate },
    });

    if (existing) {
      // Update existing record
      existing.total_fees = totalFees;
      existing.total_provider_fees = totalProviderFees;
      existing.transaction_count = transactionCount;
      existing.unique_tenant_count = uniqueTenantCount;

      const updated = await this.dailyCollectionRepository.save(existing);
      return {
        success: true,
        data: updated,
        message: 'Daily collection updated',
      };
    }

    // Create new record
    const daily = this.dailyCollectionRepository.create({
      collection_date: collectionDate,
      total_fees: totalFees,
      total_provider_fees: totalProviderFees,
      transaction_count: transactionCount,
      unique_tenant_count: uniqueTenantCount,
      status: 'PENDING',
    });

    const saved = await this.dailyCollectionRepository.save(daily);

    this.logger.log(
      `📊 Daily collection recorded: ${collectionDate.toISOString()} - Fees: ${totalFees}, Txns: ${transactionCount}`,
    );

    return {
      success: true,
      data: saved,
      message: 'Daily collection recorded',
    };
  }

  /**
   * Get daily collection history
   * Returns fee collection trends over time
   */
  async getDailyCollectionHistory(
    startDate: Date,
    endDate: Date,
    status?: string,
  ): Promise<any> {
    let query = this.dailyCollectionRepository
      .createQueryBuilder('d')
      .where('d.collection_date >= :startDate', { startDate })
      .andWhere('d.collection_date <= :endDate', { endDate });

    if (status) {
      query = query.andWhere('d.status = :status', { status });
    }

    const collections = await query
      .orderBy('d.collection_date', 'DESC')
      .getMany();

    // Calculate summary statistics
    const totalFees = collections.reduce((sum, c) => sum + c.total_fees, 0);
    const totalProviderFees = collections.reduce(
      (sum, c) => sum + c.total_provider_fees,
      0,
    );
    const totalTransactions = collections.reduce(
      (sum, c) => sum + c.transaction_count,
      0,
    );
    const totalTenants = new Set(
      collections.flatMap(c => Array(c.unique_tenant_count).fill(true))
    ).size;

    return {
      success: true,
      data: {
        collections,
        summary: {
          days_in_range: collections.length,
          total_fees: totalFees,
          total_provider_fees: totalProviderFees,
          total_transactions: totalTransactions,
          unique_tenants: totalTenants,
          average_daily_fees:
            collections.length > 0
              ? Math.round(totalFees / collections.length)
              : 0,
          average_transaction_value:
            totalTransactions > 0
              ? Math.round((totalFees + totalProviderFees) / totalTransactions)
              : 0,
        },
      },
    };
  }

  /**
   * Get admin ledger entries (filtered)
   * Full audit trail of all admin wallet transactions
   */
  async getAdminLedger(
    filters: {
      walletType?: AdminWalletTypeEnum;
      source?: AdminLedgerSourceEnum;
      status?: AdminLedgerStatusEnum;
      startDate?: Date;
      endDate?: Date;
      reference?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<any> {
    const {
      walletType,
      source,
      status,
      startDate,
      endDate,
      reference,
      limit = 50,
      offset = 0,
    } = filters;

    let query = this.adminLedgerRepository.createQueryBuilder('l');

    if (walletType) {
      query = query.andWhere('l.wallet_type = :walletType', { walletType });
    }

    if (source) {
      query = query.andWhere('l.source = :source', { source });
    }

    if (status) {
      query = query.andWhere('l.status = :status', { status });
    }

    if (startDate) {
      query = query.andWhere('l.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      query = query.andWhere('l.created_at <= :endDate', { endDate });
    }

    if (reference) {
      query = query.andWhere(
        '(l.reference = :reference OR l.secondary_reference = :reference)',
        { reference },
      );
    }

    const [entries, total] = await query
      .orderBy('l.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return {
      success: true,
      data: {
        entries,
        total,
        limit,
        offset,
      },
    };
  }

  /**
   * Record tenant fee breakdown
   * Creates a detailed breakdown of fees charged to a tenant
   */
  async recordTenantFeeBreakdown(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    grossSales: number,
    platformFee: number,
    providerFee: number,
    transactionCount: number,
  ): Promise<any> {
    const breakdown = this.tenantFeeBreakdownRepository.create({
      tenant_id: tenantId,
      period_start: periodStart,
      period_end: periodEnd,
      gross_sales: grossSales,
      platform_fee: platformFee,
      provider_fee: providerFee,
      net_payable: grossSales - platformFee - providerFee,
      transaction_count: transactionCount,
      status: 'OPEN',
    });

    const saved = await this.tenantFeeBreakdownRepository.save(breakdown);

    return {
      success: true,
      data: saved,
    };
  }

  /**
   * Get tenant aggregated fees for a period
   * Multi-tenant fee aggregation report
   */
  async getTenantFeeAggregation(
    periodStart: Date,
    periodEnd: Date,
    limit: number = 100,
    offset: number = 0,
  ): Promise<any> {
    const [breakdowns, total] = await this.tenantFeeBreakdownRepository.findAndCount({
      where: {
        period_start: MoreThanOrEqual(periodStart),
        period_end: LessThanOrEqual(periodEnd),
      },
      order: { gross_sales: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Calculate totals across all tenants
    const totalGrossSales = breakdowns.reduce((sum, b) => sum + b.gross_sales, 0);
    const totalPlatformFees = breakdowns.reduce(
      (sum, b) => sum + b.platform_fee,
      0,
    );
    const totalProviderFees = breakdowns.reduce(
      (sum, b) => sum + b.provider_fee,
      0,
    );
    const totalPayable = breakdowns.reduce((sum, b) => sum + b.net_payable, 0);
    const totalTransactions = breakdowns.reduce(
      (sum, b) => sum + b.transaction_count,
      0,
    );

    return {
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd,
        },
        breakdowns,
        aggregated_summary: {
          total_tenants: total,
          total_gross_sales: totalGrossSales,
          total_platform_fees: totalPlatformFees,
          total_provider_fees: totalProviderFees,
          total_payable_to_tenants: totalPayable,
          total_transactions: totalTransactions,
          average_transaction_value:
            totalTransactions > 0
              ? Math.round(
                  (totalPlatformFees + totalProviderFees) /
                    totalTransactions,
                )
              : 0,
          platform_fee_percentage:
            totalGrossSales > 0
              ? ((totalPlatformFees / totalGrossSales) * 100).toFixed(2)
              : '0',
        },
        pagination: {
          limit,
          offset,
          total,
        },
      },
    };
  }

  /**
   * Get summary report for admin dashboard
   * High-level overview of all financial metrics
   */
  async getAdminDashboardSummary(days: number = 30): Promise<any> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get wallet totals
    const wallets = await this.adminWalletRepository.find();
    const totalAvailable = wallets.reduce((sum, w) => sum + w.available_balance, 0);
    const totalPending = wallets.reduce((sum, w) => sum + w.pending_balance, 0);

    // Get daily collections
    const dailyCollections = await this.dailyCollectionRepository.find({
      where: {
        collection_date: MoreThanOrEqual(startDate),
      },
    });

    const totalFees = dailyCollections.reduce((sum, d) => sum + d.total_fees, 0);
    const totalTransactions = dailyCollections.reduce(
      (sum, d) => sum + d.transaction_count,
      0,
    );

    // Get recent transactions from ledger
    const recentLedger = await this.adminLedgerRepository.find({
      where: { created_at: MoreThanOrEqual(startDate) },
      order: { created_at: 'DESC' },
      take: 10,
    });

    return {
      success: true,
      data: {
        period: {
          days,
          start: startDate,
          end: now,
        },
        wallet_summary: {
          total_available: totalAvailable,
          total_pending: totalPending,
          grand_total: totalAvailable + totalPending,
          by_type: wallets.map(w => ({
            type: w.wallet_type,
            available: w.available_balance,
            pending: w.pending_balance,
            total_accumulated: w.total_accumulated,
          })),
        },
        collection_summary: {
          total_fees: totalFees,
          total_transactions: totalTransactions,
          collection_days: dailyCollections.length,
          average_daily_fees:
            dailyCollections.length > 0
              ? Math.round(totalFees / dailyCollections.length)
              : 0,
        },
        recent_transactions: recentLedger.map(l => ({
          id: l.id,
          wallet_type: l.wallet_type,
          source: l.source,
          amount: l.amount,
          reference: l.reference,
          status: l.status,
          created_at: l.created_at,
        })),
      },
    };
  }
}
