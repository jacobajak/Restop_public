import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PlatformFeeSettlement, SettlementStatusEnum } from '../entities/platform-fee-settlement.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PaymentTransaction } from '../entities/payment.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';

/**
 * PlatformFeeSettlementService
 *
 * Manages platform fee settlement workflow:
 * 1. Create pending settlements from collected fees
 * 2. Admin confirms settlements (PENDING → CONFIRMED)
 * 3. Background job processes and resets (CONFIRMED → SETTLED)
 * 4. Maintains audit trail of all operations
 *
 * Business Logic:
 * - Platform fees collected during period tracked in running counter
 * - Admin reviews pending fees and confirms payment received
 * - Settlement confirmed = fees moved to "pending settlement" state
 * - Background job settles fees = counter reset to 0, amount archived
 */
@Injectable()
export class PlatformFeeSettlementService {
  private readonly logger = new Logger(PlatformFeeSettlementService.name);

  constructor(
    @InjectRepository(PlatformFeeSettlement)
    private readonly settlementRepository: Repository<PlatformFeeSettlement>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get all pending settlements (awaiting admin confirmation)
   * Returns settlements with summary data ready for admin review
   */
  async getPendingSettlements(limit = 50, offset = 0) {
    const q = this.settlementRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tenant', 'tenant')
      .where('s.status = :status', { status: SettlementStatusEnum.PENDING })
      .orderBy('s.created_at', 'DESC')
      .limit(limit)
      .offset(offset);

    const [settlements, total] = await q.getManyAndCount();

    return {
      settlements: settlements.map(s => this.formatSettlementResponse(s)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get settlement details including transaction breakdown
   */
  async getSettlementDetails(settlementId: string) {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
      relations: ['tenant', 'confirmed_by_admin'],
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement ${settlementId} not found`);
    }

    // Get transaction details based on references
    let transactions: any[] = [];
    if (settlement.transaction_references && settlement.transaction_references.length > 0) {
      transactions = await this.paymentRepository
        .createQueryBuilder('p')
        .whereInIds(settlement.transaction_references)
        .orderBy('p.created_at', 'DESC')
        .getMany();
    }

    return {
      ...this.formatSettlementResponse(settlement),
      transactions: transactions.map(t => ({
        id: t.id,
        order_id: t.order_id,
        customer_amount: t.amount,
        platform_fee: t.platform_fee,
        payment_method: t.payment_method,
        status: t.status,
        created_at: t.created_at,
      })),
    };
  }

  /**
   * Confirm a single settlement as paid
   * Moves settlement from PENDING → CONFIRMED
   * Records admin confirmation and triggers background processing
   */
  async confirmSettlement(
    settlementId: string,
    adminId: string,
    notes?: string,
  ) {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
      relations: ['tenant'],
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement ${settlementId} not found`);
    }

    if (settlement.status !== SettlementStatusEnum.PENDING) {
      throw new BadRequestException(
        `Settlement ${settlementId} is already ${settlement.status}. Cannot confirm.`,
      );
    }

    // Update settlement
    settlement.status = SettlementStatusEnum.CONFIRMED;
    settlement.confirmed_by_admin_id = adminId;
    settlement.confirmed_at = new Date();
    settlement.admin_notes = notes || '';

    const updated = await this.settlementRepository.save(settlement);

    // Log audit trail
    await this.auditService.log({
      admin_user_id: adminId,
      action_type: AuditActionEnum.PLATFORM_FEE_SETTLEMENT_CONFIRMED,
      reference_type: 'PlatformFeeSettlement',
      reference_id: settlementId,
      after_state_json: {
        status: SettlementStatusEnum.CONFIRMED,
        tenant_id: settlement.tenant_id,
        amount: settlement.settlement_amount,
        notes,
      },
    });

    this.logger.log(
      `Settlement ${settlementId} confirmed by admin ${adminId}. Amount: ${settlement.settlement_amount}`,
    );

    return this.formatSettlementResponse(updated);
  }

  /**
   * Confirm multiple settlements in batch
   * Moves all from PENDING → CONFIRMED in single operation
   */
  async confirmBatchSettlements(
    settlementIds: string[],
    adminId: string,
    notes?: string,
  ) {
    // Verify all settlements exist and are PENDING
    const settlements = await this.settlementRepository.find({
      where: { id: In(settlementIds) },
    });

    if (settlements.length !== settlementIds.length) {
      throw new BadRequestException(
        `Some settlements not found. Expected ${settlementIds.length}, found ${settlements.length}`,
      );
    }

    const nonPending = settlements.filter(s => s.status !== SettlementStatusEnum.PENDING);
    if (nonPending.length > 0) {
      throw new BadRequestException(
        `${nonPending.length} settlements are not in PENDING status`,
      );
    }

    // Update all
    const now = new Date();
    const updatedSettlements = settlements.map(s => ({
      ...s,
      status: SettlementStatusEnum.CONFIRMED,
      confirmed_by_admin_id: adminId,
      confirmed_at: now,
      admin_notes: notes || '',
    }));

    await this.settlementRepository.save(updatedSettlements);

    // Log batch audit
    const totalAmount = settlements.reduce((sum, s) => sum + s.settlement_amount, 0);
    await this.auditService.log({
      admin_user_id: adminId,
      action_type: AuditActionEnum.PLATFORM_FEE_SETTLEMENT_CONFIRMED,
      reference_type: 'PlatformFeeSettlement',
      reference_id: `batch_${settlementIds.length}`,
      after_state_json: {
        status: 'BATCH_CONFIRMED',
        settlement_count: settlementIds.length,
        total_amount: totalAmount,
        settlement_ids: settlementIds,
        notes,
      },
    });

    this.logger.log(
      `Batch confirmed: ${settlementIds.length} settlements by admin ${adminId}. Total: ${totalAmount}`,
    );

    const updated = await this.settlementRepository.find({
      where: { id: In(settlementIds) },
      relations: ['tenant'],
    });

    return {
      count: updated.length,
      settlements: updated.map(s => this.formatSettlementResponse(s)),
      total_amount: totalAmount,
    };
  }

  /**
   * Get settlement history (all confirmed/settled settlements)
   * Used for audit trail and reporting
   */
  async getSettlementHistory(
    tenantId?: string,
    status?: SettlementStatusEnum,
    limit = 50,
    offset = 0,
  ) {
    let query = this.settlementRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tenant', 'tenant')
      .leftJoinAndSelect('s.confirmed_by_admin', 'admin');

    if (tenantId) {
      query = query.andWhere('s.tenant_id = :tenantId', { tenantId });
    }

    if (status) {
      query = query.andWhere('s.status = :status', { status });
    }

    const [settlements, total] = await query
      .orderBy('s.confirmed_at', 'DESC')
      .addOrderBy('s.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return {
      settlements: settlements.map(s => this.formatSettlementResponse(s)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get current settlement statistics
   */
  async getSettlementStats() {
    const stats = await this.settlementRepository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(s.id)', 'count')
      .addSelect('SUM(s.settlement_amount)', 'total_amount')
      .groupBy('s.status')
      .getRawMany();

    const pending = stats.find(s => s.status === SettlementStatusEnum.PENDING) || { count: '0', total_amount: '0' };
    const confirmed = stats.find(s => s.status === SettlementStatusEnum.CONFIRMED) || { count: '0', total_amount: '0' };
    const settled = stats.find(s => s.status === SettlementStatusEnum.SETTLED) || { count: '0', total_amount: '0' };

    return {
      pending: {
        count: parseInt(pending.count || '0'),
        total_amount: parseFloat(pending.total_amount || '0'),
      },
      confirmed: {
        count: parseInt(confirmed.count || '0'),
        total_amount: parseFloat(confirmed.total_amount || '0'),
      },
      settled: {
        count: parseInt(settled.count || '0'),
        total_amount: parseFloat(settled.total_amount || '0'),
      },
      total_settlements: (parseInt(pending.count || '0') + parseInt(confirmed.count || '0') + parseInt(settled.count || '0')),
    };
  }

  /**
   * Background Job: Process confirmed settlements
   * Moves CONFIRMED → SETTLED and resets tenant fee counters
   * Should be called daily via scheduled job
   */
  async processConfirmedSettlements() {
    const confirmedSettlements = await this.settlementRepository.find({
      where: { status: SettlementStatusEnum.CONFIRMED },
      relations: ['tenant'],
    });

    if (confirmedSettlements.length === 0) {
      this.logger.debug('No confirmed settlements to process');
      return { processed: 0, failed: 0, total_amount: 0 };
    }

    let processed = 0;
    let failed = 0;
    let totalAmount = 0;

    for (const settlement of confirmedSettlements) {
      try {
        // Mark as SETTLED
        settlement.status = SettlementStatusEnum.SETTLED;
        await this.settlementRepository.save(settlement);

        // Track total amount processed
        totalAmount += settlement.settlement_amount;

        // Reset tenant's platform fee counter
        // This would need a TenantFinancials service or similar to actually update
        // For now, just logging the transaction
        this.logger.log(
          `Processed settlement ${settlement.id} for tenant ${settlement.tenant_id}. Amount: ${settlement.settlement_amount}`,
        );

        // Audit log
        await this.auditService.log({
          admin_user_id: 'system', // System process
          action_type: AuditActionEnum.PLATFORM_FEE_SETTLEMENT_SETTLED,
          reference_type: 'PlatformFeeSettlement',
          reference_id: settlement.id,
          after_state_json: {
            status: SettlementStatusEnum.SETTLED,
            system_processed: true,
          },
        });

        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process settlement ${settlement.id}: ${error.message}`,
        );
        failed++;
      }
    }

    this.logger.log(
      `Settlement processing complete. Processed: ${processed}, Failed: ${failed}, Total: ${totalAmount}`,
    );

    return { processed, failed, total_amount: totalAmount };
  }

  /**
   * Create pending settlement for a tenant
   * Called when generating settlements for a period
   * Should be called by settlement generation job
   */
  async createPendingSettlement(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    totalFeesCollected: number,
    transactionReferences: string[],
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Check if settlement already exists for this period
    const existing = await this.settlementRepository.findOne({
      where: {
        tenant_id: tenantId,
        settlement_period_start: periodStart,
        settlement_period_end: periodEnd,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Settlement already exists for tenant ${tenantId} for period ${periodStart} to ${periodEnd}`,
      );
    }

    const settlement = new PlatformFeeSettlement();
    settlement.tenant_id = tenantId;
    settlement.settlement_period_start = periodStart;
    settlement.settlement_period_end = periodEnd;
    settlement.total_fees_collected = totalFeesCollected;
    settlement.settlement_amount = totalFeesCollected;
    settlement.transaction_count = transactionReferences.length;
    settlement.transaction_references = transactionReferences;
    settlement.status = SettlementStatusEnum.PENDING;

    const created = await this.settlementRepository.save(settlement);

    this.logger.log(
      `Created pending settlement for tenant ${tenantId}. Amount: ${totalFeesCollected}`,
    );

    return this.formatSettlementResponse(created);
  }

  /**
   * Helper: Format settlement response
   */
  private formatSettlementResponse(settlement: PlatformFeeSettlement) {
    return {
      id: settlement.id,
      tenant_id: settlement.tenant_id,
      tenant_name: settlement.tenant?.name,
      period_start: settlement.settlement_period_start,
      period_end: settlement.settlement_period_end,
      total_fees: settlement.total_fees_collected,
      settlement_amount: settlement.settlement_amount,
      transaction_count: settlement.transaction_count,
      status: settlement.status,
      confirmed_by_admin_id: settlement.confirmed_by_admin_id,
      confirmed_by_admin_name: settlement.confirmed_by_admin?.email,
      confirmed_at: settlement.confirmed_at,
      admin_notes: settlement.admin_notes,
      created_at: settlement.created_at,
      updated_at: settlement.updated_at,
    };
  }
}
