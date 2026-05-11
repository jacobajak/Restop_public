import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TenantPaymentAccountService } from '../services/tenant-payment-account.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetTenant } from '../../../common/decorators/get-tenant.decorator';
import { MobileNetworkEnum } from '../entities/tenant-payment-account.entity';

/**
 * TenantPaymentAccountsController
 * 
 * Endpoints for tenants to manage their mobile money payment accounts
 * - Add new account (MTN/AIRTEL)
 * - Update account details
 * - List accounts
 * - Delete account
 * - Set default account
 * 
 * All endpoints require JWT authentication
 */
@Controller('payment-accounts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantPaymentAccountsController {
  constructor(private readonly accountService: TenantPaymentAccountService) {}

  /**
   * Add new payment account for tenant
   * 
   * POST /api/v1/payment-accounts
   * 
   * Request:
   * {
   *   "network": "MTN" | "AIRTEL",
   *   "momo_number": "0788123456",
   *   "account_name": "My Business Name"
   * }
   * 
   * Response (201):
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid",
   *     "tenant_id": "uuid",
   *     "network": "MTN",
   *     "momo_number": "0788123456",
   *     "account_name": "My Business Name",
   *     "is_verified": false,
   *     "is_default": true,
   *     "created_at": "2026-04-11T..."
   *   }
   * }
   */
  @Post()
  async addPaymentAccount(
    @GetTenant() tenantId: string,
    @Body()
    body: {
      network: 'MTN' | 'AIRTEL';
      momo_number: string;
      account_name?: string;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    if (!body.network || !body.momo_number) {
      throw new BadRequestException('network and momo_number are required');
    }

    if (!['MTN', 'AIRTEL'].includes(body.network)) {
      throw new BadRequestException('network must be MTN or AIRTEL');
    }

    const account = await this.accountService.createPaymentAccount(
      tenantId,
      body.network as MobileNetworkEnum,
      body.momo_number,
      body.account_name,
    );

    return {
      success: true,
      data: account,
    };
  }

  /**
   * Get all payment accounts for tenant
   * 
   * GET /api/v1/payment-accounts
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "uuid",
   *       "network": "MTN",
   *       "momo_number": "0788123456",
   *       "is_verified": false,
   *       "is_default": true,
   *       "account_name": "My Business"
   *     }
   *   ]
   * }
   */
  @Get()
  async listPaymentAccounts(@GetTenant() tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const accounts = await this.accountService.getPaymentAccounts(tenantId);

    return {
      success: true,
      data: accounts,
    };
  }

  /**
   * Get default payment account for tenant
   * 
   * GET /api/v1/payment-accounts/default
   * 
   * Returns the account marked as default for payouts
   */
  @Get('default')
  async getDefaultAccount(@GetTenant() tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const account = await this.accountService.getDefaultPaymentAccount(tenantId);

    return {
      success: true,
      data: account || null,
    };
  }

  /**
   * Update payment account details
   * 
   * PATCH /api/v1/payment-accounts/:id
   * 
   * Request:
   * {
   *   "momo_number": "0788999999",
   *   "account_name": "Updated Name"
   * }
   */
  @Patch(':accountId')
  async updatePaymentAccount(
    @GetTenant() tenantId: string,
    @Param('accountId') accountId: string,
    @Body() body: { momo_number?: string; account_name?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const account = await this.accountService.updatePaymentAccount(
      tenantId,
      accountId,
      body,
    );

    return {
      success: true,
      data: account,
    };
  }

  /**
   * Delete payment account
   * 
   * DELETE /api/v1/payment-accounts/:id
   */
  @Delete(':accountId')
  async deletePaymentAccount(
    @GetTenant() tenantId: string,
    @Param('accountId') accountId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    await this.accountService.deletePaymentAccount(tenantId, accountId);

    return {
      success: true,
      message: 'Payment account deleted successfully',
    };
  }

  /**
   * Set payment account as default
   * 
   * PATCH /api/v1/payment-accounts/:id/set-default
   */
  @Patch(':accountId/set-default')
  async setDefaultAccount(
    @GetTenant() tenantId: string,
    @Param('accountId') accountId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const account = await this.accountService.setDefaultPaymentAccount(
      tenantId,
      accountId,
    );

    return {
      success: true,
      message: 'Account set as default',
      data: account,
    };
  }

  /**
   * Get verification status
   * 
   * GET /api/v1/payment-accounts/:id/verification-status
   */
  @Get(':accountId/verification-status')
  async getVerificationStatus(
    @GetTenant() tenantId: string,
    @Param('accountId') accountId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const account = await this.accountService.getPaymentAccountById(
      tenantId,
      accountId,
    );

    return {
      success: true,
      data: {
        is_verified: account.is_verified,
        rejection_reason: account.rejection_reason,
        rejected_at: account.rejected_at,
        message: account.is_verified
          ? 'Account is verified and can receive payouts'
          : 'Account is pending verification',
      },
    };
  }
}
