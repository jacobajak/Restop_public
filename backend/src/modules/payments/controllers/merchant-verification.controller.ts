import {
  Controller,
  Get,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MerchantVerificationService } from '../services/merchant-verification.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetTenant } from '../../../common/decorators/get-tenant.decorator';

/**
 * MerchantVerificationController
 * 
 * REST API endpoints for merchant account verification:
 * - GET /verification/status - Current verification status
 * - GET /verification/info - Verification requirements and next steps
 * 
 * All endpoints require authentication and tenant context.
 * 
 * @controller verification
 */
@Controller('verification')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MerchantVerificationController {
  constructor(private readonly verificationService: MerchantVerificationService) {}

  /**
   * Get merchant verification status
   * 
   * Returns detailed verification status including:
   * - Current status (UNVERIFIED, PENDING, VERIFIED, SUSPENDED)
   * - Number of verified payment accounts
   * - Requirements still needed
   * - Whether merchant can receive payouts
   * - User-friendly status message
   * 
   * GET /verification/status
   * 
   * @param tenantId - Merchant ID from tenant context decorator
   * @returns Verification status details
   * @throws BadRequestException if tenantId is missing
   * @throws NotFoundException if tenant not found
   * 
   * @example
   * GET /api/v1/verification/status
   * Authorization: Bearer eyJhbG...
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": {
   *     "verification_status": "VERIFIED",
   *     "verified_accounts_count": 1,
   *     "total_accounts_count": 2,
   *     "requirements": [],
   *     "can_receive_payouts": true,
   *     "message": "Account fully verified! You can now receive payouts for all transactions."
   *   }
   * }
   */
  @Get('status')
  async getVerificationStatus(@GetTenant() tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    try {
      const data = await this.verificationService.getMerchantVerificationStatus(tenantId);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to fetch verification status');
    }
  }

  /**
   * Get user-friendly verification information
   * 
   * Returns merchant-friendly verification info with:
   * - Current verification status
   * - Clear message about what's needed
   * - Next steps to complete verification
   * - Support contact information
   * 
   * GET /verification/info
   * 
   * @param tenantId - Merchant ID from tenant context decorator
   * @returns User-friendly verification information
   * @throws BadRequestException if tenantId is missing
   * @throws NotFoundException if tenant not found
   * 
   * @example
   * GET /api/v1/verification/info
   * Authorization: Bearer eyJhbG...
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": {
   *     "verification_status": "PENDING",
   *     "message": "Account partially verified. Complete all requirements to fully enable payouts.",
   *     "next_steps": [
   *       "Complete restaurant name in tenant profile",
   *       "Add valid phone number for support"
   *     ],
   *     "support_email": "support@dineflow.app",
   *     "can_receive_payouts": false,
   *     "requirements": [
   *       "Complete restaurant name in tenant profile",
   *       "Add valid phone number for support"
   *     ]
   *   }
   * }
   */
  @Get('info')
  async getVerificationInfo(@GetTenant() tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    try {
      const data = await this.verificationService.getVerificationInfo(tenantId);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to fetch verification information');
    }
  }
}
