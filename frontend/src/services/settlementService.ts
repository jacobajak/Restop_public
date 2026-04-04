import apiClient from './apiClient';

export interface SettlementSummary {
  wallet_balance: number;
  pending: number;
  settled: number;
  failed: number;
}

export interface TransactionRecord {
  id: string;
  order_id: string;
  amount: number;
  platform_fee: number;
  provider_fee: number;
  net_payable: number;
  payment_method: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  created_at: string;
}

export interface SettlementRecord {
  id: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  bank_account?: string;
  mobile_number?: string;
  reference: string;
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  date: string;
  cash_revenue: number;
  mobile_money_revenue: number;
  total_orders: number;
  total_fees: number;
}

/**
 * SettlementService
 * 
 * Handles payment settlement and merchant payables:
 * - Settlement summary (wallet balance, pending/settled amounts)
 * - Transaction history with filtering and pagination
 * - Settlement records (past payouts)
 * - Daily revenue summaries
 * 
 * All endpoints require authentication (tenant context)
 */
class SettlementService {
  private readonly baseUrl = '/settlement';

  /**
   * Get settlement summary for merchant
   * 
   * Returns wallet balance and payout status breakdown
   * 
   * GET /api/v1/settlement/summary
   * 
   * @returns {Promise<SettlementSummary>} Wallet and payout totals
   * @throws Error if request fails
   */
  async getSettlementSummary(): Promise<SettlementSummary> {
    try {
      const { data } = await apiClient.get<{ data: SettlementSummary }>(
        `${this.baseUrl}/summary`
      );
      return data.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('❌ Failed to get settlement summary:', errorMsg);
      throw error;
    }
  }

  /**
   * Get transaction history for merchant
   * 
   * Returns paginated list of transactions with filtering options
   * 
   * GET /api/v1/settlement/transactions?limit=20&offset=0&method=MTN&status=COMPLETED
   * 
   * @param {Object} options - Query options
   * @param {number} [options.limit=20] - Results per page
   * @param {number} [options.offset=0] - Pagination offset
   * @param {string} [options.method] - Filter by payment method (MTN, AIRTEL, CASH)
   * @param {string} [options.status] - Filter by status (PENDING, COMPLETED, FAILED)
   * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
   * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
   * @returns {Promise<{data: TransactionRecord[], total: number}>} Transactions and total count
   * @throws Error if request fails
   */
  async getTransactionHistory(options?: {
    limit?: number;
    offset?: number;
    method?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: TransactionRecord[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.method) params.append('method', options.method);
      if (options?.status) params.append('status', options.status);
      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);

      const url = params.toString()
        ? `${this.baseUrl}/transactions?${params.toString()}`
        : `${this.baseUrl}/transactions`;

      const { data } = await apiClient.get<{
        data: TransactionRecord[];
        total: number;
      }>(url);

      return {
        data: data.data,
        total: data.total,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('❌ Failed to get transaction history:', errorMsg);
      throw error;
    }
  }

  /**
   * Get settlement/payout records
   * 
   * Returns list of past payouts to merchant accounts
   * 
   * GET /api/v1/settlement/records?limit=20&offset=0
   * 
   * @param {Object} options - Query options
   * @param {number} [options.limit=20] - Results per page
   * @param {number} [options.offset=0] - Pagination offset
   * @returns {Promise<{data: SettlementRecord[], total: number}>} Payouts and total count
   * @throws Error if request fails
   */
  async getSettlementRecords(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: SettlementRecord[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const url = params.toString()
        ? `${this.baseUrl}/records?${params.toString()}`
        : `${this.baseUrl}/records`;

      const { data } = await apiClient.get<{
        data: SettlementRecord[];
        total: number;
      }>(url);

      return {
        data: data.data,
        total: data.total,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('❌ Failed to get settlement records:', errorMsg);
      throw error;
    }
  }

  /**
   * Get daily revenue summary
   * 
   * Returns aggregated revenue by date for last N days
   * 
   * GET /api/v1/settlement/daily-summary?days=30
   * 
   * @param {number} [days=30] - Number of days to summarize
   * @returns {Promise<DailySummary[]>} Daily summaries in descending date order
   * @throws Error if request fails
   */
  async getDailySummary(days: number = 30): Promise<DailySummary[]> {
    try {
      const { data } = await apiClient.get<{ data: DailySummary[] }>(
        `${this.baseUrl}/daily-summary?days=${days}`
      );
      return data.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('❌ Failed to get daily summary:', errorMsg);
      throw error;
    }
  }
}

export const settlementService = new SettlementService();
