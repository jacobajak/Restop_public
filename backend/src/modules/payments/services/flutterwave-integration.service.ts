import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

/**
 * FlutterwaveIntegrationService
 * 
 * Encapsulates all Flutterwave API communication for:
 * - Mobile Money payment initiation (MTN, Airtel)
 * - Transaction verification
 * - Subaccount management for tenant payouts
 * - Payout initiation
 * 
 * Supports both test and production environments.
 */
@Injectable()
export class FlutterwaveIntegrationService {
  private readonly logger = new Logger(FlutterwaveIntegrationService.name);
  private readonly httpClient: AxiosInstance;
  private readonly secretKey: string;
  private readonly secretHash: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY');
    this.secretHash = this.configService.get<string>('FLUTTERWAVE_SECRET_HASH');
    const env = this.configService.get<string>('NODE_ENV', 'development');
    
    this.baseUrl = env === 'production' 
      ? 'https://api.flutterwave.com/v3'
      : 'https://api.staging.flutterwave.com/v3';

    if (!this.secretKey || !this.secretHash) {
      this.logger.error('❌ FLUTTERWAVE_SECRET_KEY or FLUTTERWAVE_SECRET_HASH not configured');
    }

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.secretKey}`,
      },
    });
  }

  /**
   * Normalize phone number to Flutterwave format
   * 
   * Acceptable: 0788111111, 256788111111, +256788111111
   * Converts to: +256788111111 (with country code)
   */
  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/[\s\-]/g, '');

    // Add country code if missing
    if (normalized.startsWith('0')) {
      // 0788... → 256788...
      normalized = '256' + normalized.substring(1);
    }

    // Ensure plus sign
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  }

  /**
   * Detect mobile network from phone number
   * 
   * Rwanda:
   * - MTN: starts with 078, 079
   * - Airtel: starts with 073, 074
   */
  private detectNetwork(phoneNumber: string): 'mtn' | 'airtel' {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const prefix = cleaned.substring(3, 6); // Get digits 4-6 after country code

    if (['078', '079'].includes(prefix)) return 'mtn';
    if (['073', '074'].includes(prefix)) return 'airtel';

    return 'mtn'; // Default fallback
  }

  /**
   * Create a payment via Flutterwave
   * 
   * Initiates a mobile money payment request.
   * Flutterwave will send USSD prompt to customer's phone.
   * 
   * Returns: Flutterwave transaction ID and status
   */
  async createPayment(data: {
    tx_ref: string; // Unique reference for idempotency
    amount: number; // Amount in RWF
    phone_number: string; // Customer phone
    email: string; // Customer email
    name: string; // Customer name
    subaccount_id?: string; // Tenant's subaccount for split
    order_id: string; // Reference to order
  }): Promise<{
    flutterwave_id: string;
    tx_ref: string;
    status: string;
    amount: number;
    [key: string]: any;
  }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(data.phone_number);
      const network = this.detectNetwork(normalizedPhone);

      this.logger.log(
        `🌊 Creating Flutterwave payment: amount=${data.amount}, phone=${normalizedPhone}, network=${network}`,
      );

      const payload = {
        tx_ref: data.tx_ref,
        amount: data.amount,
        currency: 'RWF',
        payment_options: 'mobilemoneyrwanda',
        customer: {
          email: data.email,
          phonenumber: normalizedPhone,
          name: data.name,
        },
        customizations: {
          title: 'Restaurant Order Payment',
          description: `Payment for order ${data.order_id}`,
        },
      };

      // Add subaccount if tenant has one (for automatic split)
      if (data.subaccount_id) {
        payload['subaccounts'] = [{ id: data.subaccount_id }];
      }

      const response = await this.httpClient.post('/payments', payload);

      const result = response.data;

      if (!result.status || result.status !== 'success') {
        throw new Error(
          `Flutterwave creation failed: ${result.message || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `✅ Payment created: tx_ref=${data.tx_ref}, flutterwave_id=${result.data.id}, status=${result.data.status}`,
      );

      return {
        flutterwave_id: result.data.id.toString(),
        tx_ref: result.data.tx_ref,
        status: result.data.status,
        amount: result.data.amount,
        ...result.data,
      };
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      };

      this.logger.error(
        `❌ Payment creation failed: ${error.message}`,
        JSON.stringify(errorDetails, null, 2),
      );

      throw new InternalServerErrorException(
        `Failed to initiate Flutterwave payment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Verify a transaction with Flutterwave
   * 
   * Called after webhook to ensure amount, status, and reference match.
   * This prevents fraud and confirms payment actually succeeded.
   */
  async verifyTransaction(flutterwaveId: number | string): Promise<{
    id: string;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    [key: string]: any;
  }> {
    try {
      this.logger.log(`🔍 Verifying transaction: ${flutterwaveId}`);

      const response = await this.httpClient.get(
        `/transactions/${flutterwaveId}/verify`,
      );

      const result = response.data;

      if (!result.status || result.status !== 'success') {
        throw new Error(
          `Verification failed: ${result.message || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `✅ Transaction verified: id=${result.data.id}, status=${result.data.status}`,
      );

      return {
        id: result.data.id.toString(),
        tx_ref: result.data.tx_ref,
        status: result.data.status,
        amount: result.data.amount,
        currency: result.data.currency,
        ...result.data,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Transaction verification failed: ${error.message}`,
      );

      throw new InternalServerErrorException(
        `Failed to verify transaction: ${error.message}`,
      );
    }
  }

  /**
   * Create a subaccount for a tenant
   * 
   * Flutterwave subaccounts allow automatic fund split.
   * Configure once per tenant, then all payments automatically split.
   */
  async createSubaccount(data: {
    business_name: string;
    account_bank: string; // Bank code (e.g., "001" for MTN Mobile Money)
    account_number: string; // Mobile money account
    currency: string; // RWF
  }): Promise<{
    subaccount_id: string;
    [key: string]: any;
  }> {
    try {
      this.logger.log(`🏢 Creating subaccount for ${data.business_name}`);

      const response = await this.httpClient.post('/subaccounts', {
        business_name: data.business_name,
        account_bank: data.account_bank,
        account_number: data.account_number,
        currency: data.currency,
        meta: {
          tenant_type: 'restaurant',
        },
      });

      const result = response.data;

      if (!result.status || result.status !== 'success') {
        throw new Error(
          `Subaccount creation failed: ${result.message || 'Unknown error'}`,
        );
      }

      this.logger.log(`✅ Subaccount created: ${result.data.subaccount_id}`);

      return {
        subaccount_id: result.data.subaccount_id.toString(),
        ...result.data,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Subaccount creation failed: ${error.message}`,
      );

      throw new InternalServerErrorException(
        `Failed to create subaccount: ${error.message}`,
      );
    }
  }

  /**
   * Initiate a payout to tenant's mobile money account
   * 
   * Called after successful payment to transfer funds to tenant.
   */
  async initiatePayout(data: {
    reference: string; // Unique reference for idempotency
    amount: number; // Amount in RWF
    beneficiary_name: string;
    beneficiary_account: string; // Tenant's mobile money number
    currency: string; // RWF
  }): Promise<{
    payout_id: string;
    reference: string;
    status: string;
    [key: string]: any;
  }> {
    try {
      this.logger.log(
        `💰 Initiating payout: amount=${data.amount}, reference=${data.reference}`,
      );

      const response = await this.httpClient.post('/transfers', {
        reference: data.reference,
        amount: data.amount,
        beneficiary_name: data.beneficiary_name,
        beneficiary_account: data.beneficiary_account,
        currency: data.currency,
      });

      const result = response.data;

      if (!result.status || result.status !== 'success') {
        throw new Error(
          `Payout creation failed: ${result.message || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `✅ Payout initiated: ${result.data.id}, reference=${data.reference}`,
      );

      return {
        payout_id: result.data.id.toString(),
        reference: result.data.reference,
        status: result.data.status,
        ...result.data,
      };
    } catch (error: any) {
      this.logger.error(`❌ Payout initiation failed: ${error.message}`);

      throw new InternalServerErrorException(
        `Failed to initiate payout: ${error.message}`,
      );
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   * 
   * Flutterwave includes x-verif-hash header with HMAC of request body.
   * We hash the body with our secret and compare.
   */
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
  ): boolean {
    try {
      const computed = crypto
        .createHmac('sha256', this.secretHash)
        .update(rawBody)
        .digest('hex');

      const verified = computed === signatureHeader;

      if (!verified) {
        this.logger.warn('❌ Webhook signature verification failed');
      } else {
        this.logger.log('✅ Webhook signature verified');
      }

      return verified;
    } catch (error) {
      this.logger.error(`Error verifying webhook signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Refund a transaction to customer
   * 
   * Called after admin approves refund.
   * Money returned to customer's mobile money account.
   */
  async refundTransaction(
    flutterwaveTransactionId: string,
    amount: number,
  ): Promise<{
    refund_id: string;
    status: string;
    [key: string]: any;
  }> {
    try {
      this.logger.log(
        `💰 Initiating refund: transaction_id=${flutterwaveTransactionId}, amount=${amount}`,
      );

      const response = await this.httpClient.post(
        `/transactions/${flutterwaveTransactionId}/refund`,
        {
          amount,
        },
      );

      const result = response.data;

      if (!result.status || result.status !== 'success') {
        throw new Error(
          `Refund failed: ${result.message || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `✅ Refund initiated: refund_id=${result.data.refund_id}, status=${result.data.status}`,
      );

      return {
        refund_id: result.data.refund_id.toString(),
        status: result.data.status,
        ...result.data,
      };
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      };

      this.logger.error(
        `❌ Refund failed: ${error.message}`,
        JSON.stringify(errorDetails, null, 2),
      );

      throw new InternalServerErrorException(
        `Failed to process refund: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
