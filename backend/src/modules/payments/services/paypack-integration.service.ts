import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * PaypackIntegrationService
 * 
 * Spec: Paypack integration for cashin and cashout
 * 
 * DineFlow payment flow:
 * 1. Customer → Paypack cashin (collection)
 * 2. Paypack → DineFlow webhook (confirmation)
 * 3. DineFlow → Paypack cashout (instant payout to tenant)
 * 
 * Paypack API: https://developer.paypack.rw
 */
@Injectable()
export class PaypackIntegrationService {
  private readonly logger = new Logger(PaypackIntegrationService.name);
  private readonly httpClient: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBaseUrl: string;
  private readonly mockMode: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get('PAYPACK_CLIENT_ID');
    this.clientSecret = this.configService.get('PAYPACK_CLIENT_SECRET');
    this.apiBaseUrl = this.configService.get(
      'PAYPACK_API_URL',
      'https://api.paypack.rw',
    );
    this.mockMode = this.configService.get('PAYPACK_MOCK_MODE') === 'true';

    if (this.mockMode) {
      this.logger.warn('⚠️ PAYPACK_MOCK_MODE is ENABLED - Using mock responses for testing');
    }

    if (!this.mockMode && (!this.clientId || !this.clientSecret)) {
      this.logger.error('❌ PAYPACK_CLIENT_ID or PAYPACK_CLIENT_SECRET not configured');
    }

    this.httpClient = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get access token from Paypack OAuth
   * Tokens are cached until expiry
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      this.logger.log('🔐 Requesting Paypack access token...');
      
      const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await this.httpClient.post('/auth/token', 
        { grant_type: 'client_credentials' },
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 3599 seconds, cache for 3500 seconds
      this.tokenExpiry = Date.now() + (response.data.expires_in - 100) * 1000;

      this.logger.log('✅ Access token obtained');
      return this.accessToken;
    } catch (error) {
      this.logger.error(`Failed to get Paypack access token: ${error.message}`);
      throw new InternalServerErrorException('Failed to authenticate with Paypack');
    }
  }

  /**
   * Normalize phone number to Paypack format
   * 
   * Acceptable: 0788111111, 256788111111, +256788111111
   * Converts to: 256788111111
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove spaces and dashes
    let normalized = phone.replace(/[\s\-]/g, '');

    // Remove leading zero for Rwanda numbers
    if (normalized.startsWith('0')) {
      normalized = '250' + normalized.substring(1);
    }

    // Ensure country code
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('256') || normalized.startsWith('250')) {
        // Already has country code
      } else {
        throw new BadRequestException(
          'Phone number must include country code (e.g., 0788111111 or 256788111111)',
        );
      }
    } else {
      normalized = normalized.substring(1);
    }

    return normalized;
  }

  /**
   * Detect network from phone number
   * 
   * Rwanda:
   * - MTN: starts with 0788, 0789, 0790, 0791,0792, 0793, 0797, 0798
   * - Airtel: starts with 0784, 0785, 0786, 0787
   */
  private detectNetwork(phoneNumber: string): 'MTN' | 'AIRTEL' {
    const normalized = this.normalizePhoneNumber(phoneNumber);

    // Rwanda prefixes
    const mtnPrefixes = ['0788', '0789', '0790', '0791', '0792', '0793', '0797', '0798'];
    const airtelPrefixes = ['0784', '0785', '0786', '0787'];

    const withZero = '0' + normalized.substring(3);

    for (const prefix of mtnPrefixes) {
      if (withZero.startsWith(prefix)) return 'MTN';
    }

    for (const prefix of airtelPrefixes) {
      if (withZero.startsWith(prefix)) return 'AIRTEL';
    }

    return 'MTN'; // Default fallback
  }

  /**
   * Initiate cashin payment
   * 
   * Spec: Section 8 — Initiate Paypack cashin
   * 
   * Sends payment collection request to Paypack.
   * Customer will receive prompt on phone.
   * 
   * Paypack returns immediately with pending status.
   * Actual payment confirmation comes via webhook (transaction:processed event).
   * 
   * @param data cashin request data
   */
  async initiateCashin(data: {
    amount: number;
    phone_number: string;
    order_id: string;
    idempotency_key: string;
  }): Promise<{
    ref: string;
    status: string;
    amount: number;
    kind: string;
    [key: string]: any;
  }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(data.phone_number);
      const network = this.detectNetwork(normalizedPhone);

      this.logger.log(
        `Initiating cashin: amount=${data.amount}, phone=${normalizedPhone}, network=${network}`,
      );

      // MOCK MODE: Return simulated response
      if (this.mockMode) {
        this.logger.warn(`🎭 MOCK MODE: Simulating Paypack cashin response`);
        const mockRef = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const mockResponse = {
          ref: mockRef,
          status: 'pending',
          amount: data.amount,
          kind: 'CASHIN',
          phone_number: '+' + normalizedPhone,
          order_id: data.order_id,
          network: network,
          created_at: new Date().toISOString(),
          message: `[MOCK] USSD prompt would be sent to +${normalizedPhone} (${network})`,
        };
        this.logger.log(`✅ Mock Cashin response: ref=${mockRef}, status=pending`);
        return mockResponse;
      }

      // REAL MODE: Call actual Paypack API
      const accessToken = await this.getAccessToken();

      const response = await this.httpClient.post('/transactions', {
        amount: data.amount,
        phone_number: '+' + normalizedPhone,
        kind: 'CASHIN',
        reference: data.order_id,
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Idempotency-Key': data.idempotency_key,
        },
      });

      const result = response.data;

      this.logger.log(`✅ Cashin initiated: ref=${result.ref}, status=${result.status}`);

      return {
        ref: result.ref,
        status: result.status || 'pending',
        amount: result.amount || data.amount,
        kind: 'CASHIN',
        ...result,
      };
    } catch (error: any) {
      // Log full error details for debugging
      const errorDetails = {
        message: error.message,
        code: error.code,
        errno: error.errno,
        systemError: error.syscall,
        address: error.address,
        port: error.port,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      };
      
      this.logger.error(
        `❌ Cashin initiation failed: ${error.message}`,
        JSON.stringify(errorDetails, null, 2),
      );
      
      // Check if it's a network connectivity error
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.syscall === 'getaddrinfo') {
        throw new InternalServerErrorException(
          `Cannot reach Paypack API (${error.message}). Please check your network connectivity or contact support.`,
        );
      }
      
      // Check if it's an API error response
      if (error.response?.data) {
        throw new InternalServerErrorException(
          `Paypack API error: ${error.response.data.message || error.response.data.error || error.message}`,
        );
      }
      
      throw new InternalServerErrorException(
        `Failed to initiate Paypack cashin: ${error.message}`,
      );
    }
  }

  /**
   * Initiate cashout payment (instant payout to tenant)
   * 
   * Spec: Section 10 — Instant Payout Logic
   * 
   * Sends payout request to Paypack for instant transfer to tenant's mobile money.
   * Uses idempotency to prevent duplicate payouts if retried.
   * 
   * @param data cashout request data
   */
  async initiateCashout(data: {
    amount: number;
    phone_number: string;
    order_id: string;
    idempotency_key: string;
  }): Promise<{
    ref: string;
    status: string;
    amount: number;
    kind: string;
    [key: string]: any;
  }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(data.phone_number);

      this.logger.log(
        `Initiating cashout: amount=${data.amount}, phone=${normalizedPhone}`,
      );

      // MOCK MODE: Return simulated response
      if (this.mockMode) {
        this.logger.warn(`🎭 MOCK MODE: Simulating Paypack cashout response`);
        const mockRef = `MOCK-PAYOUT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const mockResponse = {
          ref: mockRef,
          status: 'pending',
          amount: data.amount,
          kind: 'CASHOUT',
          phone_number: '+' + normalizedPhone,
          order_id: data.order_id,
          created_at: new Date().toISOString(),
          message: `[MOCK] Instant payout of ${data.amount} would be sent to +${normalizedPhone}`,
        };
        this.logger.log(`✅ Mock Cashout response: ref=${mockRef}, status=pending`);
        return mockResponse;
      }

      // REAL MODE: Call actual Paypack API
      const accessToken = await this.getAccessToken();

      const response = await this.httpClient.post('/transactions', {
        amount: data.amount,
        phone_number: '+' + normalizedPhone,
        kind: 'CASHOUT',
        reference: data.order_id,
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Idempotency-Key': data.idempotency_key,
        },
      });

      const result = response.data;

      this.logger.log(`✅ Cashout initiated: ref=${result.ref}, status=${result.status}`);

      return {
        ref: result.ref,
        status: result.status || 'pending',
        amount: result.amount || data.amount,
        kind: 'CASHOUT',
        ...result,
      };
    } catch (error) {
      this.logger.error(`❌ Cashout initiation failed: ${error.message}`, error);
      throw new InternalServerErrorException(
        `Failed to initiate Paypack cashout: ${error.message}`,
      );
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   * 
   * Spec: Section 9 — Webhook Signature Verification
   * 
   * Paypack sends x-paypack-signature header computed as:
   * HMAC-SHA256(raw_body, webhook_secret) encoded as base64
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const crypto = require('crypto');
    const secret = this.configService.get('PAYPACK_WEBHOOK_SECRET', '');

    if (!secret) {
      this.logger.warn('PAYPACK_WEBHOOK_SECRET not configured');
      return false;
    }

    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    return computed === signatureHeader;
  }

  /**
   * Query transaction status from Paypack
   * 
   * Used for reconciliation if needed.
   */
  async getTransactionStatus(providerRef: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await this.httpClient.get(`/transactions/${providerRef}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get transaction status ${providerRef}: ${error.message}`,
      );
      throw error;
    }
  }
}

