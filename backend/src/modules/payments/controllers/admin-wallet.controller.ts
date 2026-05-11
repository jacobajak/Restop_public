import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { AdminWalletService } from '../services/admin-wallet.service';
import { AdminWalletTypeEnum, AdminLedgerSourceEnum, AdminLedgerStatusEnum } from '../entities/admin-wallet.entity';

/**
 * Admin Wallet Controller
 *
 * Platform admin controls for managing revenue collection and payouts.
 * Enables admins to:
 * - View platform revenue across all merchants
 * - Track fee collections in real-time
 * - Analyze multi-tenant aggregated fees
 * - Process payouts and transfers
 * - Maintain audit trail
 *
 * Endpoints:
 * GET  /api/v1/admin/wallet/all - View all wallet balances
 * GET  /api/v1/admin/wallet/dashboard - Admin dashboard summary
 * GET  /api/v1/admin/wallet/ledger - Full transaction history
 * GET  /api/v1/admin/wallet/daily-collections - Daily fee trends
 * GET  /api/v1/admin/wallet/tenant-fees - Multi-tenant fee aggregation
 * POST /api/v1/admin/wallet/transfer - Transfer between wallets
 */
@Controller('admin/wallet')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminWalletController {
  constructor(private readonly adminWalletService: AdminWalletService) {}

  /**
   * Get all admin wallet balances
   * Returns current state of all revenue streams
   *
   * GET /api/v1/admin/wallet/all
   *
   * @returns Object with all wallet types and totals
   * @status 200 - Success
   * @status 401 - Not authenticated
   * @status 403 - Not authorized (not admin)
   *
   * @example
   * GET /api/v1/admin/wallet/all
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "wallets": [
   *       {
   *         "wallet_type": "PLATFORM_FEES",
   *         "available_balance": 5000000,
   *         "pending_balance": 500000,
   *         "total_accumulated": 50000000,
   *         "total_paid_out": 45000000,
   *         "net_balance": 5500000,
   *         "updated_at": "2025-01-15T10:30:00Z"
   *       },
   *       {
   *         "wallet_type": "PROVIDER_FEES",
   *         "available_balance": 1000000,
   *         "pending_balance": 100000,
   *         ...
   *       }
   *     ],
   *     "total_available": 6000000,
   *     "total_pending": 600000,
   *     "grand_total": 6600000
   *   }
   * }
   */
  @Get('all')
  async getAllWallets() {
    return await this.adminWalletService.getAllWallets();
  }

  /**
   * Get admin dashboard summary
   * High-level overview of financial metrics and recent activity
   *
   * GET /api/v1/admin/wallet/dashboard?days=30
   *
   * Query Parameters:
   * - days (number, default: 30) - Number of days to include in summary
   *
   * @returns Dashboard data with wallet summary, collections, and recent transactions
   * @status 200 - Success
   *
   * @example
   * GET /api/v1/admin/wallet/dashboard?days=30
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "period": {
   *       "days": 30,
   *       "start": "2024-12-16T10:30:00Z",
   *       "end": "2025-01-15T10:30:00Z"
   *     },
   *     "wallet_summary": {
   *       "total_available": 5000000,
   *       "total_pending": 500000,
   *       "grand_total": 5500000,
   *       "by_type": [...]
   *     },
   *     "collection_summary": {
   *       "total_fees": 10000000,
   *       "total_transactions": 5000,
   *       "collection_days": 30,
   *       "average_daily_fees": 333333
   *     },
   *     "recent_transactions": [...]
   *   }
   * }
   */
  @Get('dashboard')
  async getDashboard(@Query('days') daysStr?: string) {
    const days = daysStr ? Math.max(1, Math.min(365, parseInt(daysStr))) : 30;
    return await this.adminWalletService.getAdminDashboardSummary(days);
  }

  /**
   * Get admin ledger entries with optional filtering
   * Full audit trail of all wallet transactions
   *
   * GET /api/v1/admin/wallet/ledger?walletType=PLATFORM_FEES&source=COLLECTION&limit=50&offset=0
   *
   * Query Parameters:
   * - walletType (enum) - Filter by wallet type
   * - source (enum) - Filter by source (COLLECTION, TRANSFER, PAYOUT, REVERSAL, MANUAL_ADJUSTMENT)
   * - status (enum) - Filter by status (PENDING, COMPLETED, FAILED, CANCELLED)
   * - limit (number, default: 50) - Results per page
   * - offset (number, default: 0) - Pagination offset
   * - reference (string) - Filter by reference ID
   * - startDate (ISO string) - Filter from date
   * - endDate (ISO string) - Filter to date
   *
   * @returns Paginated ledger entries with statistics
   * @status 200 - Success
   *
   * @example
   * GET /api/v1/admin/wallet/ledger?walletType=PLATFORM_FEES&limit=20
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "entries": [
   *       {
   *         "id": "ledger-123",
   *         "wallet_type": "PLATFORM_FEES",
   *         "source": "COLLECTION",
   *         "amount": 150000,
   *         "reference": "settlement-456",
   *         "secondary_reference": "tenant-789",
   *         "status": "COMPLETED",
   *         "description": "Platform fee: Order #ORD-001",
   *         "created_at": "2025-01-15T10:30:00Z"
   *       }
   *     ],
   *     "total": 1500,
   *     "limit": 20,
   *     "offset": 0
   *   }
   * }
   */
  @Get('ledger')
  async getAdminLedger(
    @Query('walletType') walletType?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('reference') reference?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('limit') limitStr: string = '50',
    @Query('offset') offsetStr: string = '0',
  ) {
    const filters: any = {
      limit: Math.max(1, Math.min(100, parseInt(limitStr))),
      offset: Math.max(0, parseInt(offsetStr)),
    };

    if (walletType) {
      filters.walletType = walletType as AdminWalletTypeEnum;
    }
    if (source) {
      filters.source = source as AdminLedgerSourceEnum;
    }
    if (status) {
      filters.status = status as AdminLedgerStatusEnum;
    }
    if (reference) {
      filters.reference = reference;
    }
    if (startDateStr) {
      filters.startDate = new Date(startDateStr);
    }
    if (endDateStr) {
      filters.endDate = new Date(endDateStr);
    }

    return await this.adminWalletService.getAdminLedger(filters);
  }

  /**
   * Get daily fee collection history
   * Shows fee collection trends over time
   *
   * GET /api/v1/admin/wallet/daily-collections?days=30&status=PENDING
   *
   * Query Parameters:
   * - days (number, default: 30) - Number of days to include
   * - status (string) - Filter by status (PENDING, SETTLED)
   *
   * @returns Daily collection records with trend analysis
   * @status 200 - Success
   *
   * @example
   * GET /api/v1/admin/wallet/daily-collections?days=7
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "collections": [
   *       {
   *         "id": "daily-123",
   *         "collection_date": "2025-01-15",
   *         "total_fees": 500000,
   *         "total_provider_fees": 50000,
   *         "transaction_count": 100,
   *         "unique_tenant_count": 25,
   *         "status": "PENDING"
   *       }
   *     ],
   *     "summary": {
   *       "days_in_range": 7,
   *       "total_fees": 3500000,
   *       "total_provider_fees": 350000,
   *       "total_transactions": 700,
   *       "unique_tenants": 50,
   *       "average_daily_fees": 500000,
   *       "average_transaction_value": 5500
   *     }
   *   }
   * }
   */
  @Get('daily-collections')
  async getDailyCollectionHistory(
    @Query('days') daysStr: string = '30',
    @Query('status') status?: string,
  ) {
    const days = Math.max(1, Math.min(365, parseInt(daysStr)));
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const endDate = now;

    return await this.adminWalletService.getDailyCollectionHistory(
      startDate,
      endDate,
      status,
    );
  }

  /**
   * Get multi-tenant fee aggregation report
   * Shows fees collected from each tenant for a period
   *
   * GET /api/v1/admin/wallet/tenant-fees?days=30&limit=50&offset=0
   *
   * Query Parameters:
   * - days (number, default: 30) - Number of days to include
   * - limit (number, default: 100) - Results per page
   * - offset (number, default: 0) - Pagination offset
   *
   * Returns tenants sorted by gross sales (descending)
   *
   * @returns Tenant fee breakdown with aggregated statistics
   * @status 200 - Success
   *
   * @example
   * GET /api/v1/admin/wallet/tenant-fees?days=30&limit=10
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "period": {
   *       "start": "2024-12-16T10:30:00Z",
   *       "end": "2025-01-15T10:30:00Z"
   *     },
   *     "breakdowns": [
   *       {
   *         "tent_id": "tenant-123",
   *         "period_start": "2024-12-16",
   *         "period_end": "2025-01-15",
   *         "gross_sales": 10000000,
   *         "platform_fee": 300000,
   *         "provider_fee": 100000,
   *         "net_payable": 9600000,
   *         "transaction_count": 500
   *       }
   *     ],
   *     "aggregated_summary": {
   *       "total_tenants": 50,
   *       "total_gross_sales": 500000000,
   *       "total_platform_fees": 15000000,
   *       "total_provider_fees": 5000000,
   *       "total_payable_to_tenants": 480000000,
   *       "total_transactions": 25000,
   *       "average_transaction_value": 800,
   *       "platform_fee_percentage": "3.00"
   *     },
   *     "pagination": {
   *       "limit": 10,
   *       "offset": 0,
   *       "total": 50
   *     }
   *   }
   * }
   */
  @Get('tenant-fees')
  async getTenantFeeAggregation(
    @Query('days') daysStr: string = '30',
    @Query('limit') limitStr: string = '100',
    @Query('offset') offsetStr: string = '0',
  ) {
    const days = Math.max(1, Math.min(365, parseInt(daysStr)));
    const limit = Math.max(1, Math.min(500, parseInt(limitStr)));
    const offset = Math.max(0, parseInt(offsetStr));

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const endDate = now;

    return await this.adminWalletService.getTenantFeeAggregation(
      startDate,
      endDate,
      limit,
      offset,
    );
  }

  /**
   * Transfer funds between admin wallets
   * Used to consolidate or split revenue streams
   *
   * POST /api/v1/admin/wallet/transfer
   * Authorization: Bearer eyJhbG...
   *
   * Body:
   * {
   *   "from_wallet": "PLATFORM_FEES",
   *   "to_wallet": "OPERATIONAL_RESERVE",
   *   "amount": 1000000,
   *   "reference": "monthly-reserve-transfer",
   *   "notes": "Monthly operational reserve transfer"
   * }
   *
   * @param body Transfer details
   * @returns Transfer result with new balances
   * @status 200 - Transfer successful
   * @status 400 - Invalid request or insufficient balance
   * @status 404 - Wallet not found
   *
   * @example
   * Response:
   * {
   *   "success": true,
   *   "from_balance": 4000000,
   *   "to_balance": 2000000,
   *   "reference": "monthly-reserve-transfer"
   * }
   */
  @Post('transfer')
  async transferBetweenWallets(
    @Body()
    body: {
      from_wallet: string;
      to_wallet: string;
      amount: number;
      reference: string;
      notes?: string;
    },
  ) {
    const { from_wallet, to_wallet, amount, reference, notes } = body;

    return await this.adminWalletService.transferBetweenWallets(
      from_wallet as AdminWalletTypeEnum,
      to_wallet as AdminWalletTypeEnum,
      amount,
      reference,
      notes,
    );
  }

  /**
   * Initialize admin wallets (admin setup only)
   * Called once during platform setup to create empty wallets
   *
   * POST /api/v1/admin/wallet/initialize
   * Authorization: Bearer eyJhbG...
   *
   * @status 200 - Wallets initialized
   * @status 409 - Already initialized
   *
   * @example
   * Response:
   * {
   *   "success": true,
   *   "message": "Admin wallets initialized"
   * }
   */
  @Post('initialize')
  async initializeWallets() {
    return await this.adminWalletService.initializeWallets();
  }
}
