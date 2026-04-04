import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { TenantPaymentAccount } from '../../payments/entities/tenant-payment-account.entity';
import { TenantPaymentAccountService } from '../../tenants/services/tenant-payment-account.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';

/**
 * AdminVerificationController - Manage merchant payment account verification
 *
 * Allows platform admins to:
 * - View unverified payment accounts queue
 * - Review account details and verification status
 * - Verify accounts (approve for payout)
 * - Reject accounts with feedback
 * - Request corrections from merchants
 *
 * GET /admin/verification/payment-accounts - Queue of accounts needing verification
 * GET /admin/verification/payment-accounts/:id - Account details
 * PATCH /admin/verification/payment-accounts/:id/verify - Approve account
 * PATCH /admin/verification/payment-accounts/:id/reject - Reject account
 */
@Controller('admin/verification')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminVerificationController {
  constructor(
    @InjectRepository(TenantPaymentAccount)
    private readonly paymentAccountRepository: Repository<TenantPaymentAccount>,
    private readonly tenantPaymentAccountService: TenantPaymentAccountService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get payment accounts needing verification
   *
   * Query parameters:
   * - verified: Filter by verification status (true/false)
   * - network: Filter by network (MTN/AIRTEL)
   * - restaurant_id: Filter by restaurant
   * - limit: Page size (default 50)
   * - offset: Pagination offset (default 0)
   */
  @Get('payment-accounts')
  async listPaymentAccounts(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      // Get list of pending verification accounts
      const pendingAccounts = await this.tenantPaymentAccountService.listPendingVerificationAccounts();

      return {
        success: true,
        data: {
          accounts: pendingAccounts.slice(offset, offset + limit),
          total: pendingAccounts.length,
          limit,
          offset,
          unverified_count: pendingAccounts.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get payment account details
   *
   * Returns:
   * - Restaurant info
   * - Account number/wallet
   * - Network (MTN/AIRTEL)
   * - Account holder name
   * - Verification status
   * - Submitted date
   */
  @Get('payment-accounts/:id')
  async getPaymentAccount(@Param('id') id: string) {
    try {
      const account = await this.paymentAccountRepository.findOne({ where: { id } });
      if (!account) {
        throw new BadRequestException('Payment account not found');
      }

      return {
        success: true,
        data: account,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify (approve) payment account
   *
   * This is a critical action - logs every verification decision
   * Only FINANCE_ADMIN or SUPER_ADMIN should perform this in production
   */
  @Patch('payment-accounts/:id/verify')
  async verifyPaymentAccount(
    @Param('id') id: string,
    @Body('notes') notes?: string,
    @GetUser() user?: JwtPayload,
  ) {
    try {
      const account = await this.tenantPaymentAccountService.getPaymentAccount(id);

      // Verify the account
      const verified = await this.tenantPaymentAccountService.verifyPaymentAccount(
        id,
        account.tenant_id,
      );

      // Log critical audit event
      if (user) {
        await this.auditService.log({
          admin_user_id: user.userId,
          action_type: AuditActionEnum.PAYMENT_ACCOUNT_VERIFIED,
          reference_type: 'payment_account',
          reference_id: id,
          before_state_json: { is_verified: false },
          after_state_json: { is_verified: true, network: account.network },
          metadata_json: {
            notes,
            admin_user: user.userId,
            tenant_id: account.tenant_id,
          },
        });
      }

      return {
        success: true,
        data: {
          id: verified.id,
          is_verified: verified.is_verified,
          network: verified.network,
          message: 'Payment account verified successfully',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reject payment account
   *
   * Critical action - requires detailed rejection reason
   * Merchant will be notified to correct/resubmit
   */
  @Patch('payment-accounts/:id/reject')
  async rejectPaymentAccount(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @GetUser() user?: JwtPayload,
  ) {
    try {
      if (!reason) {
        throw new BadRequestException('Rejection reason is required');
      }

      const account = await this.tenantPaymentAccountService.getPaymentAccount(id);

      // Reject the account with reason
      const rejected = await this.tenantPaymentAccountService.rejectPaymentAccount(
        id,
        account.tenant_id,
        reason,
      );

      // Log critical audit event
      if (user) {
        await this.auditService.log({
          admin_user_id: user.userId,
          action_type: AuditActionEnum.PAYMENT_ACCOUNT_REJECTED,
          reference_type: 'payment_account',
          reference_id: id,
          before_state_json: { is_verified: false },
          after_state_json: {
            is_verified: false,
            rejection_reason: reason,
          },
          metadata_json: {
            reason,
            admin_user: user.userId,
            tenant_id: account.tenant_id,
          },
        });
      }

      return {
        success: true,
        data: {
          id: rejected.id,
          is_verified: rejected.is_verified,
          rejection_reason: rejected.rejection_reason,
          message: 'Payment account rejected. Merchant will be notified.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get verification queue summary
   */
  @Get('summary/queue')
  async getVerificationQueueSummary() {
    try {
      // TODO: Implement queue statistics
      // Should return count of pending, verified, rejected accounts

      return {
        success: true,
        data: {
          pending_approval: 0,
          verified: 0,
          rejected: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
