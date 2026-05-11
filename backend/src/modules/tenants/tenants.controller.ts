import { Controller, Get, Post, Param, UseGuards, Body, Patch, Delete, BadRequestException } from '@nestjs/common';
import { TenantsService } from './services/tenants.service';
import { TenantPaymentAccountService } from './services/tenant-payment-account.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../common/strategies/jwt.strategy';
import { AFRICAN_COUNTRIES } from '../../common/constants/african-countries';
import { SupportIssueService } from '../admin/services/support-issue.service';
import { CreateSupportIssueFromTenantDto } from '../admin/dtos/create-support-issue.dto';
import { SupportIssueSeverityEnum } from '../admin/entities/support-issue.entity';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly paymentAccountService: TenantPaymentAccountService,
    private readonly supportIssueService: SupportIssueService,
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
        country_code: tenant.country_code,
        country_name: tenant.country_name,
        phone: tenant.phone,
        email: tenant.email,
        qr_code_url: tenant.qr_code_url,
        created_at: tenant.created_at,
      },
    };
  }

  /**
   * Update current user's tenant profile (authenticated)
   * Only TENANT_OWNER and TENANT_MANAGER can update their tenant profile
   */
  @Post('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async updateCurrentTenant(
    @GetUser() user: JwtPayload,
    @Body() body: { name?: string; phone?: string; email?: string; currency?: string; country_code?: string; country_name?: string },
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
        country_code: updatedTenant.country_code,
        country_name: updatedTenant.country_name,
      },
    };
  }

  /**
   * Get list of African countries with their currencies (public endpoint)
   * Used by frontend to populate country/currency selection dropdown
   */
  @Get('countries/africa')
  async getAfricanCountries() {
    return {
      success: true,
      data: AFRICAN_COUNTRIES,
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

  // ====== Support Issue Reporting ======

  /**
   * Report a technical error or issue to platform admin
   * 
   * Allows tenants and staff to report problems they encounter:
   * - Payment processing issues
   * - Order synchronization problems
   * - Settlement issues
   * - System errors
   * - Any other technical problems
   * 
   * POST /tenants/me/support/report
   * 
   * Request:
   * {
   *   "issue_type": "PAYMENT_ISSUE" | "ORDER_ISSUE" | "SYSTEM_ISSUE" | etc,
   *   "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
   *   "subject": "Orders not syncing to dashboard",
   *   "description": "When I place an order, it doesn't appear in the dashboard...",
   *   "error_details": "Error code: 500, message: ...",
   *   "related_order_id": "uuid (optional)",
   *   "related_payment_id": "uuid (optional)",
   *   "related_settlement_id": "uuid (optional)"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "issue_id": "uuid",
   *     "status": "OPEN",
   *     "created_at": "2026-04-05T..."
   *   }
   * }
   */
  @Post('me/support/report')
  @UseGuards(JwtAuthGuard)
  async reportTechnicalIssue(
    @GetUser() user: JwtPayload,
    @Body() body: CreateSupportIssueFromTenantDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Only tenant users can report issues');
    }

    // Validate severity - tenants can report LOW to HIGH, but not CRITICAL
    if (body.severity === SupportIssueSeverityEnum.CRITICAL) {
      throw new BadRequestException('Tenants cannot report CRITICAL severity issues');
    }

    const issueObject = {
      tenant_id: user.tenantId,
      issue_type: body.issue_type,
      severity: body.severity || SupportIssueSeverityEnum.MEDIUM,
      subject: body.subject,
      description: `${body.description}\n\n**Reported by:** User ID ${user.userId}\n**Tenant ID:** ${user.tenantId}${body.error_details ? `\n**Error Details:**\n${body.error_details}` : ''}`,
      related_order_id: body.related_order_id,
      related_payment_id: body.related_payment_id,
      related_settlement_id: body.related_settlement_id,
    };

    try {
      const issue = await this.supportIssueService.createIssue(issueObject);

      return {
        success: true,
        message: 'Issue reported successfully. Our support team will investigate and get back to you soon.',
        data: {
          issue_id: issue.id,
          status: issue.status,
          created_at: issue.created_at,
        },
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to create support issue: ${error.message}`);
    }
  }

  /**
   * Get list of reported issues for the current tenant
   * 
   * Tenants can see the status of their own reported issues
   * 
   * GET /tenants/me/support/issues
   * 
   * Query parameters:
   * - status: Filter by status (OPEN, ASSIGNED, INVESTIGATING, RESOLVED, CLOSED)
   * - severity: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
   * - limit: Page size (default 20)
   * - offset: Pagination offset (default 0)
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "issues": [...],
   *     "total": 5,
   *     "limit": 20,
   *     "offset": 0
   *   }
   * }
   */
  @Get('me/support/issues')
  @UseGuards(JwtAuthGuard)
  async getTenantIssues(
    @GetUser() user: JwtPayload,
    @Body() filters?: { status?: string; severity?: string; limit?: number; offset?: number },
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Only tenant users can view their issues');
    }

    try {
      const result = await this.supportIssueService.listIssues({
        tenant_id: user.tenantId,
        status: filters?.status as any,
        severity: filters?.severity as any,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to fetch issues: ${error.message}`);
    }
  }

  /**
   * Get details of a specific reported issue
   * 
   * Tenants can only see their own issues
   * 
   * GET /tenants/me/support/issues/:issueId
   */
  @Get('me/support/issues/:issueId')
  @UseGuards(JwtAuthGuard)
  async getTenantIssueDetails(
    @GetUser() user: JwtPayload,
    @Param('issueId') issueId: string,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Only tenant users can view issues');
    }

    try {
      const issue = await this.supportIssueService.getIssue(issueId);

      if (!issue) {
        throw new BadRequestException('Issue not found');
      }

      // Verify the issue belongs to the user's tenant
      if (issue.tenant_id !== user.tenantId) {
        throw new BadRequestException('You do not have access to this issue');
      }

      return {
        success: true,
        data: {
          id: issue.id,
          issue_type: issue.issue_type,
          severity: issue.severity,
          status: issue.status,
          subject: issue.subject,
          description: issue.description,
          related_order_id: issue.related_order_id,
          related_payment_id: issue.related_payment_id,
          related_settlement_id: issue.related_settlement_id,
          assigned_admin_id: issue.assigned_admin_id,
          resolution_notes: issue.resolution_notes,
          created_at: issue.created_at,
          resolved_at: issue.resolved_at,
        },
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to fetch issue: ${error.message}`);
    }
  }
}
