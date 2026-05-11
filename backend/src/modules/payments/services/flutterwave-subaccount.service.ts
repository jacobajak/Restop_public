import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { TenantPaymentAccount } from '../entities/tenant-payment-account.entity';

/**
 * FlutterwaveSubaccountService
 * 
 * Manages Flutterwave subaccounts for payment splits.
 * 
 * Architecture: "Split at payment time"
 * - Each tenant gets a Flutterwave subaccount
 * - Payments are split automatically by Flutterwave
 * - Platform: 10%, Tenant: 90%
 * - No manual payout required
 */
@Injectable()
export class FlutterwaveSubaccountService {
  private readonly logger = new Logger(FlutterwaveSubaccountService.name);
  private readonly flutterwaveClient: AxiosInstance;
  private readonly baseURL = 'https://api.flutterwave.com/v3';
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get('FLUTTERWAVE_SECRET_KEY');

    if (!this.secretKey) {
      throw new Error('FLUTTERWAVE_SECRET_KEY not configured');
    }

    this.flutterwaveClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create Flutterwave subaccount for tenant
   * Called when tenant registers payment account
   * 
   * @param tenantPaymentAccount - Tenant's payment account with mobile number
   * @param tenantName - Business name
   * @param tenantEmail - Contact email
   * @returns Subaccount ID from Flutterwave
   */
  async createSubaccount(
    tenantPaymentAccount: TenantPaymentAccount,
    tenantName: string,
    tenantEmail: string,
  ): Promise<string> {
    try {
      const payload = {
        account_bank: this.getAccountBank(tenantPaymentAccount.network),
        account_number: this.formatPhoneNumber(tenantPaymentAccount.momo_number),
        business_name: tenantName,
        business_email: tenantEmail,
        split_type: 'percentage',
        split_value: 90, // Tenant gets 90%
        country: 'RW',
        // Subaccount will be used for receiving split payments
      };

      this.logger.debug(
        `Creating Flutterwave subaccount for tenant: ${tenantName}`,
      );

      const response = await this.flutterwaveClient.post('/subaccounts', payload);

      if (response.data.status !== 'success') {
        throw new InternalServerErrorException(
          `Flutterwave error: ${response.data.message}`,
        );
      }

      const subaccountId = response.data.data.subaccount_id;

      this.logger.log(
        `✅ Flutterwave subaccount created: ${subaccountId} for tenant ${tenantName}`,
      );

      return subaccountId;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to create Flutterwave subaccount: ${error.message}`,
        error.response?.data || {},
      );

      throw new InternalServerErrorException(
        `Failed to create Flutterwave subaccount: ${error.message}`,
      );
    }
  }

  /**
   * Get subaccount details from Flutterwave
   */
  async getSubaccountDetails(subaccountId: string): Promise<any> {
    try {
      const response = await this.flutterwaveClient.get(
        `/subaccounts/${subaccountId}`,
      );

      if (response.data.status !== 'success') {
        throw new InternalServerErrorException(
          `Flutterwave error: ${response.data.message}`,
        );
      }

      return response.data.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to get subaccount details: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Update subaccount details
   */
  async updateSubaccount(
    subaccountId: string,
    updates: {
      business_name?: string;
      business_email?: string;
      account_number?: string;
    },
  ): Promise<void> {
    try {
      const payload: any = {};

      if (updates.business_name) {
        payload.business_name = updates.business_name;
      }
      if (updates.business_email) {
        payload.business_email = updates.business_email;
      }
      if (updates.account_number) {
        payload.account_number = this.formatPhoneNumber(updates.account_number);
      }

      const response = await this.flutterwaveClient.put(
        `/subaccounts/${subaccountId}`,
        payload,
      );

      if (response.data.status !== 'success') {
        throw new InternalServerErrorException(
          `Flutterwave error: ${response.data.message}`,
        );
      }

      this.logger.log(`✅ Subaccount ${subaccountId} updated`);
    } catch (error: any) {
      this.logger.error(`Failed to update subaccount: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete subaccount (optional)
   */
  async deleteSubaccount(subaccountId: string): Promise<void> {
    try {
      const response = await this.flutterwaveClient.delete(
        `/subaccounts/${subaccountId}`,
      );

      if (response.data.status !== 'success') {
        throw new InternalServerErrorException(
          `Flutterwave error: ${response.data.message}`,
        );
      }

      this.logger.log(`✅ Subaccount ${subaccountId} deleted`);
    } catch (error: any) {
      this.logger.error(`Failed to delete subaccount: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get account bank code from network
   * Maps MTN/Airtel to Flutterwave codes
   */
  private getAccountBank(network: string): string {
    const bankMap: Record<string, string> = {
      MTN: 'MOMO',
      AIRTEL: 'AIRTEL',
    };

    return bankMap[network] || 'MOMO';
  }

  /**
   * Format phone number for Flutterwave
   * Removes +250 prefix if present, leaves only digits
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If it starts with 250, keep as-is
    // If it starts with 0, replace with 250
    if (cleaned.startsWith('0')) {
      cleaned = '250' + cleaned.substring(1);
    }

    return cleaned;
  }
}
