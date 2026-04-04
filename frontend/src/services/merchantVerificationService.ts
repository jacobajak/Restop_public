import apiClient from './apiClient';

/**
 * Merchant Verification API Service
 * 
 * Client-side service for fetching and managing merchant account verification status.
 * Provides methods to check verification status and retrieve verification requirements.
 * 
 * API Endpoints:
 * - GET /api/v1/verification/status - Get current verification status
 * - GET /api/v1/verification/info - Get user-friendly verification information
 */

export interface VerificationStatus {
  success: boolean;
  data: {
    verification_status: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'SUSPENDED';
    verified_accounts_count: number;
    total_accounts_count: number;
    requirements: string[];
    can_receive_payouts: boolean;
    message: string;
  };
}

export interface VerificationInfo {
  success: boolean;
  data: {
    verification_status: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'SUSPENDED';
    message: string;
    next_steps: string[];
    support_email: string;
    can_receive_payouts: boolean;
    requirements: string[];
  };
}

class MerchantVerificationService {
  /**
   * Get current merchant verification status
   * 
   * Returns the merchant's verification status along with account verification count,
   * requirements, and authorization to receive payouts.
   * 
   * @returns Promise<VerificationStatus> Verification status object
   * @throws Error if request fails
   * 
   * @example
   * ```typescript
   * try {
   *   const status = await merchantVerificationService.getVerificationStatus();
   *   console.log(status.data.verification_status); // 'VERIFIED' | 'PENDING' | ...
   *   console.log(status.data.can_receive_payouts); // boolean
   * } catch (error) {
   *   console.error('Failed to fetch status:', error);
   * }
   * ```
   */
  async getVerificationStatus(): Promise<VerificationStatus> {
    try {
      const response = await apiClient.get('/verification/status');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch verification status:', error);
      throw new Error(
        error?.response?.data?.message ||
        'Failed to fetch verification status'
      );
    }
  }

  /**
   * Get user-friendly verification information
   * 
   * Returns verification information formatted for user display, including
   * next steps, requirements, and contact information.
   * 
   * @returns Promise<VerificationInfo> User-friendly verification info
   * @throws Error if request fails
   * 
   * @example
   * ```typescript
   * try {
   *   const info = await merchantVerificationService.getVerificationInfo();
   *   console.log(info.data.next_steps); // ['Complete KYC form', ...]
   *   console.log(info.data.support_email); // 'support@dineflow.app'
   * } catch (error) {
   *   console.error('Failed to fetch info:', error);
   * }
   * ```
   */
  async getVerificationInfo(): Promise<VerificationInfo> {
    try {
      const response = await apiClient.get('/verification/info');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch verification info:', error);
      throw new Error(
        error?.response?.data?.message ||
        'Failed to fetch verification information'
      );
    }
  }

  /**
   * Combined method to fetch both status and info
   * 
   * Fetches both verification status and info in parallel, useful for
   * populating a detailed verification UI component.
   * 
   * @returns Promise containing both status and info objects
   * @throws Error if any request fails
   * 
   * @example
   * ```typescript
   * const [status, info] = await merchantVerificationService.getFullVerificationData();
   * ```
   */
  async getFullVerificationData(): Promise<[VerificationStatus, VerificationInfo]> {
    try {
      const [status, info] = await Promise.all([
        this.getVerificationStatus(),
        this.getVerificationInfo(),
      ]);
      return [status, info];
    } catch (error) {
      console.error('Failed to fetch full verification data:', error);
      throw error;
    }
  }

  /**
   * Check if merchant can receive payouts
   * 
   * Utility method that returns a boolean indicating whether the
   * merchant account is authorized to receive payouts.
   * 
   * @returns Promise<boolean> Whether merchant can receive payouts
   * @throws Error if request fails
   * 
   * @example
   * ```typescript
   * const canReceive = await merchantVerificationService.canReceivePayouts();
   * if (canReceive) {
   *   // Show payout settings
   * }
   * ```
   */
  async canReceivePayouts(): Promise<boolean> {
    try {
      const status = await this.getVerificationStatus();
      return status.data.can_receive_payouts;
    } catch (error) {
      console.error('Failed to verify payout authorization:', error);
      return false;
    }
  }

  /**
   * Get verification requirements for display
   * 
   * Extracts requirements list for showing to user in UI components.
   * 
   * @returns Promise<string[]> Array of requirement descriptions
   * @throws Error if request fails
   * 
   * @example
   * ```typescript
   * const requirements = await merchantVerificationService.getRequirements();
   * requirements.forEach(req => console.log(req));
   * ```
   */
  async getRequirements(): Promise<string[]> {
    try {
      const status = await this.getVerificationStatus();
      return status.data.requirements;
    } catch (error) {
      console.error('Failed to fetch requirements:', error);
      return [];
    }
  }
}

// Export singleton instance
export const merchantVerificationService = new MerchantVerificationService();

export default merchantVerificationService;
