import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SettlementService } from '../services/settlement.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetTenant } from '../../../common/decorators/get-tenant.decorator';

/**
 * SettlementController
 *
 * REST API endpoints for payment settlement and merchant payables:
 * - GET /settlement/summary - Wallet balance and payout status
 * - GET /settlement/transactions - Transaction history with filtering
 * - GET /settlement/records - Past payout records
 * - GET /settlement/daily-summary - Daily revenue aggregates
 *
 * All endpoints require authentication and tenant context.
 *
 * @controller settlement
 */
@Controller('settlement')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * Get settlement summary for merchant
   *
   * Returns wallet balance and payout status breakdown:
   * - Wallet balance: Available for withdrawal
   * - Pending: Payouts in progress
   * - Settled: Successfully completed payouts
   * - Failed: Payouts that need attention
   *
   * GET /settlement/summary
   *
   * @param {string} tenantId - Merchant ID from tenant context
   * @returns {Object} Wallet balance and payout totals
   * @status 200 - Summary retrieved
   * @status 401 - Not authenticated
   *
   * @example
   * GET /api/v1/settlement/summary
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "wallet_balance": 150000,
   *     "pending": 50000,
   *     "settled": 500000,
   *     "failed": 0
   *   }
   * }
   */
  @Get('summary')
  async getSettlementSummary(@GetTenant() tenantId: string) {
    const summary = await this.settlementService.getSettlementSummary(tenantId);
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get transaction history for merchant
   *
   * Returns paginated list of transactions with optional filtering
   *
   * GET /settlement/transactions?limit=20&offset=0&method=MTN&status=COMPLETED
   *
   * Query Parameters:
   * - limit (number, default: 20) - Results per page
   * - offset (number, default: 0) - Pagination offset
   * - method (string) - Filter by payment method (MTN, AIRTEL, CASH)
   * - status (string) - Filter by status (PENDING, COMPLETED, FAILED)
   * - startDate (string, YYYY-MM-DD) - Filter by start date
   * - endDate (string, YYYY-MM-DD) - Filter by end date
   *
   * @param {string} tenantId - Merchant ID from tenant context
   * @param {number} [limit] - Results per page
   * @param {number} [offset] - Pagination offset
   * @param {string} [method] - Payment method filter
   * @param {string} [status] - Status filter
   * @param {string} [startDate] - Start date filter
   * @param {string} [endDate] - End date filter
   * @returns {Object} Array of transactions and total count
   * @status 200 - Transactions retrieved
   * @status 401 - Not authenticated
   *
   * @example
   * GET /api/v1/settlement/transactions?limit=10&offset=0&status=COMPLETED
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "tx-123",
   *       "order_id": "order-456",
   *       "amount": 5000,
   *       "platform_fee": 150,
   *       "provider_fee": 50,
   *       "net_payable": 4800,
   *       "payment_method": "MTN",
   *       "status": "COMPLETED",
   *       "created_at": "2024-01-15T10:30:00Z"
   *     }
   *   ],
   *   "total": 42
   * }
   */
  @Get('transactions')
  async getTransactionHistory(
    @GetTenant() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      throw new BadRequestException('limit and offset must be valid numbers');
    }

    // Parse date strings to Date objects
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
    }
    
    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
    }

    const result = await this.settlementService.getTransactionHistory(
      tenantId,
      {
        limit: parsedLimit,
        offset: parsedOffset,
        method,
        status,
        startDate,
        endDate,
      },
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
    };
  }

  /**
   * Get settlement/payout records
   *
   * Returns list of past payouts sent to merchant accounts
   *
   * GET /settlement/records?limit=20&offset=0
   *
   * Query Parameters:
   * - limit (number, default: 20) - Results per page
   * - offset (number, default: 0) - Pagination offset
   *
   * @param {string} tenantId - Merchant ID from tenant context
   * @param {number} [limit] - Results per page
   * @param {number} [offset] - Pagination offset
   * @returns {Object} Array of payouts and total count
   * @status 200 - Records retrieved
   * @status 401 - Not authenticated
   *
   * @example
   * GET /api/v1/settlement/records?limit=10&offset=0
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "payout-123",
   *       "amount": 100000,
   *       "status": "COMPLETED",
   *       "bank_account": "1234567890",
   *       "reference": "PAYOUT-2024-01-001",
   *       "created_at": "2024-01-15T10:30:00Z",
   *       "updated_at": "2024-01-15T10:35:00Z"
   *     }
   *   ],
   *   "total": 5
   * }
   */
  @Get('records')
  async getSettlementRecords(
    @GetTenant() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 20;
    const parsedOffset = offset ? Number(offset) : 0;

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      throw new BadRequestException('limit and offset must be valid numbers');
    }

    const result = await this.settlementService.getSettlementRecords(
      tenantId,
      parsedLimit,
      parsedOffset,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
    };
  }

  /**
   * Get daily revenue summary
   *
   * Returns aggregated revenue by date for last N days
   * Breaks down by cash vs mobile money
   *
   * GET /settlement/daily-summary?days=30
   *
   * Query Parameters:
   * - days (number, default: 30) - Number of days to summarize
   *
   * @param {string} tenantId - Merchant ID from tenant context
   * @param {number} [days] - Number of days
   * @returns {Array} Daily summaries (cash_revenue, mobile_money_revenue, total_orders, total_fees)
   * @status 200 - Summary retrieved
   * @status 401 - Not authenticated
   *
   * @example
   * GET /api/v1/settlement/daily-summary?days=7
   * Authorization: Bearer eyJhbG...
   *
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "date": "2024-01-15",
   *       "cash_revenue": 50000,
   *       "mobile_money_revenue": 75000,
   *       "total_orders": 25,
   *       "total_fees": 3750
   *     }
   *   ]
   * }
   */
  @Get('daily-summary')
  async getDailySummary(
    @GetTenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? Number(days) : 30;

    if (isNaN(parsedDays) || parsedDays < 1) {
      throw new BadRequestException('days must be a positive number');
    }

    const summary = await this.settlementService.getDailySummary(
      tenantId,
      parsedDays,
    );

    return {
      success: true,
      data: summary,
    };
  }
}
