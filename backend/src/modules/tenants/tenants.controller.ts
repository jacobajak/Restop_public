import { Controller, Get, Post, Param, UseGuards, Body, Patch, Delete, BadRequestException } from '@nestjs/common';
import { TenantsService } from './services/tenants.service';
import { TenantPaymentAccountService } from './services/tenant-payment-account.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../common/strategies/jwt.strategy';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly paymentAccountService: TenantPaymentAccountService,
  ) {}

  /**
   * Create a new tenant (public endpoint for registration)
   */
  @Post()
  async createTenant(
    @Body()
    body: {
      name: string;
      slug: string;
      email?: string;
      currency?: string;
    },
  ) {
    const tenant = await this.tenantsService.createTenant({
      name: body.name,
      slug: body.slug,
      email: body.email || '',
      currency: body.currency || 'USD',
    });

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        qr_code_url: tenant.qr_code_url,
      },
    };
  }

  /**
   * Get current user's tenant (authenticated)
   * Returns tenant data for the logged-in user
   * MUST come before :slug routes to be matched correctly
   */
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  async getCurrentTenant(@GetUser() user: JwtPayload) {
    // Platform admins don't have a tenant
    if (!user.tenantId) {
      return {
        success: true,
        data: {
          id: null,
          name: 'Platform Admin',
          slug: null,
        },
      };
    }

    const tenant = await this.tenantsService.getTenantById(user.tenantId);
    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        currency: tenant.currency,
        phone: tenant.phone,
        email: tenant.email,
        qr_code_url: tenant.qr_code_url,
        created_at: tenant.created_at,
      },
    };
  }

  /**
   * Update current user's tenant profile (authenticated)
   */
  @Post('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateCurrentTenant(
    @GetUser() user: JwtPayload,
    @Body() body: { name?: string; phone?: string; email?: string; currency?: string },
  ) {
    if (!user.tenantId) {
      throw new Error('User does not have a tenant');
    }

    const updatedTenant = await this.tenantsService.updateTenant(user.tenantId, body);
    return {
      success: true,
      data: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        slug: updatedTenant.slug,
        phone: updatedTenant.phone,
        email: updatedTenant.email,
        currency: updatedTenant.currency,
      },
    };
  }

  /**
   * Get QR code for a tenant (public)
   * Used by customers to see QR code for restaurant
   */
  @Get(':slug/qrcode')
  async getQRCodeBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.getTenantBySlug(slug);
    return {
      success: true,
      data: {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        qr_code_url: tenant.qr_code_url,
        qr_code_data: tenant.qr_code_data,
        menu_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/menu/${slug}`,
      },
    };
  }

  /**
   * Get tenant by slug (public)
   */
  @Get(':slug')
  async getTenantBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.getTenantBySlug(slug);
    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        currency: tenant.currency,
        phone: tenant.phone,
        qr_code_url: tenant.qr_code_url,
      },
    };
  }

  /**
   * Regenerate QR code for tenant (authenticated, tenant owner only)
   */
  @Post(':id/regenerate-qrcode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.PLATFORM_ADMIN)
  async regenerateQRCode(@GetUser() user: JwtPayload, @Param('id') tenantId: string) {
    // Only tenant owner can regenerate their own QR code
    if (user.role === UserRole.TENANT_OWNER && user.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const tenant = await this.tenantsService.regenerateQRCode(tenantId);
    return {
      success: true,
      data: {
        qr_code_url: tenant.qr_code_url,
        qr_code_data: tenant.qr_code_data,
      },
    };
  }

  /**
   * Get tenant info (authenticated)
   */
  @Get(':id/info')
  @UseGuards(JwtAuthGuard)
  async getTenantInfo(@GetUser() user: JwtPayload, @Param('id') tenantId: string) {
    // User can only get info about their own tenant (if owner/staff)
    if (user.role !== UserRole.PLATFORM_ADMIN && user.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const tenant = await this.tenantsService.getTenantById(tenantId);
    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        currency: tenant.currency,
        phone: tenant.phone,
        email: tenant.email,
        qr_code_url: tenant.qr_code_url,
        created_at: tenant.created_at,
      },
    };
  }

  // ====== Payment Account Management ======

  /**
   * Create or update tenant payment account
   * 
   * Spec: Section 4 — Payment Setup Flow (Step 3-5)
   * 
   * POST /tenants/:tenantId/payment-accounts
   * 
   * Request:
   * {
   *   "momo_number": "0788111111",
   *   "account_name": "John Doe" (optional)
   * }
   */
  @Post(':tenantId/payment-accounts')
  @UseGuards(JwtAuthGuard)
  async createPaymentAccount(
    @Param('tenantId') tenantId: string,
    @GetUser() user: JwtPayload,
    @Body() body: { momo_number: string; account_name?: string },
  ) {
    // Tenant owner can only set their own account
    if (
      user.role === UserRole.TENANT_OWNER &&
      user.tenantId !== tenantId
    ) {
      throw new BadRequestException('Unauthorized: Can only manage own tenant payment accounts');
    }

    const account = await this.paymentAccountService.createOrUpdatePaymentAccount(
      tenantId,
      body.momo_number,
      body.account_name,
    );

    return {
      success: true,
      message: 'Payment account saved. Awaiting admin verification.',
      data: {
        id: account.id,
        network: account.network,
        momo_number: account.momo_number,
        account_name: account.account_name,
        is_verified: account.is_verified,
        is_default: account.is_default,
        created_at: account.created_at,
      },
    };
  }

  /**
   * Get all payment accounts for a tenant
   * 
   * GET /tenants/:tenantId/payment-accounts
   */
  @Get(':tenantId/payment-accounts')
  @UseGuards(JwtAuthGuard)
  async getPaymentAccounts(
    @Param('tenantId') tenantId: string,
    @GetUser() user: JwtPayload,
  ) {
    // Tenant owner can only view their own accounts
    if (
      user.role === UserRole.TENANT_OWNER &&
      user.tenantId !== tenantId
    ) {
      throw new BadRequestException('Unauthorized');
    }

    const accounts = await this.paymentAccountService.getPaymentAccounts(tenantId);

    return {
      success: true,
      data: accounts.map((account) => ({
        id: account.id,
        network: account.network,
        momo_number: account.momo_number,
        account_name: account.account_name,
        is_verified: account.is_verified,
        is_default: account.is_default,
        created_at: account.created_at,
      })),
    };
  }

  /**
   * Get a specific payment account
   * 
   * GET /tenants/:tenantId/payment-accounts/:accountId
   */
  @Get(':tenantId/payment-accounts/:accountId')
  @UseGuards(JwtAuthGuard)
  async getPaymentAccount(
    @Param('tenantId') tenantId: string,
    @Param('accountId') accountId: string,
    @GetUser() user: JwtPayload,
  ) {
    // Tenant owner can only view their own accounts
    if (
      user.role === UserRole.TENANT_OWNER &&
      user.tenantId !== tenantId
    ) {
      throw new BadRequestException('Unauthorized');
    }

    const account = await this.paymentAccountService.getPaymentAccount(accountId);

    if (account.tenant_id !== tenantId) {
      throw new BadRequestException('Account does not belong to this tenant');
    }

    return {
      success: true,
      data: {
        id: account.id,
        network: account.network,
        momo_number: account.momo_number,
        account_name: account.account_name,
        is_verified: account.is_verified,
        is_default: account.is_default,
        created_at: account.created_at,
      },
    };
  }

  /**
   * Set payment account as default
   * 
   * PATCH /tenants/:tenantId/payment-accounts/:accountId/default
   */
  @Patch(':tenantId/payment-accounts/:accountId/default')
  @UseGuards(JwtAuthGuard)
  async setDefaultPaymentAccount(
    @Param('tenantId') tenantId: string,
    @Param('accountId') accountId: string,
    @GetUser() user: JwtPayload,
  ) {
    if (
      user.role === UserRole.TENANT_OWNER &&
      user.tenantId !== tenantId
    ) {
      throw new BadRequestException('Unauthorized');
    }

    const account = await this.paymentAccountService.setDefaultAccount(accountId, tenantId);

    return {
      success: true,
      message: 'Payment account set as default',
      data: {
        id: account.id,
        is_default: account.is_default,
      },
    };
  }

  /**
   * Verify payment account (admin only)
   * 
   * Spec: Section 5 — Verification (MVP Option)
   * 
   * PATCH /tenants/:tenantId/payment-accounts/:accountId/verify
   * 
   * Admin manually verifies after calling tenant and confirming number ownership.
   */
  @Patch(':tenantId/payment-accounts/:accountId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  async verifyPaymentAccount(
    @Param('tenantId') tenantId: string,
    @Param('accountId') accountId: string,
  ) {
    const account = await this.paymentAccountService.verifyPaymentAccount(accountId, tenantId);

    return {
      success: true,
      message: 'Payment account verified and ready for payouts',
      data: {
        id: account.id,
        network: account.network,
        is_verified: account.is_verified,
      },
    };
  }

  /**
   * Delete payment account
   * 
   * DELETE /tenants/:tenantId/payment-accounts/:accountId
   */
  @Delete(':tenantId/payment-accounts/:accountId')
  @UseGuards(JwtAuthGuard)
  async deletePaymentAccount(
    @Param('tenantId') tenantId: string,
    @Param('accountId') accountId: string,
    @GetUser() user: JwtPayload,
  ) {
    if (
      user.role === UserRole.TENANT_OWNER &&
      user.tenantId !== tenantId
    ) {
      throw new BadRequestException('Unauthorized');
    }

    await this.paymentAccountService.deletePaymentAccount(accountId, tenantId);

    return {
      success: true,
      message: 'Payment account deleted',
    };
  }
}
