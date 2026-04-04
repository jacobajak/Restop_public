import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { UserRole } from '../entities/user.entity';
import { StaffMember, StaffRole } from '../entities/staff-member.entity';
import { StaffManagementService } from '../services/staff-management.service';

export interface CreateStaffRequest {
  name: string;
  email: string;
  role: StaffRole;
  phone?: string;
}

export interface UpdateStaffRequest {
  name?: string;
  role?: StaffRole;
  phone?: string;
  is_active?: boolean;
}

@Controller('staff')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StaffManagementController {
  constructor(private staffService: StaffManagementService) {}

  /**
   * GET /api/v1/staff
   * Get all staff members for the current tenant
   * Only accessible to TENANT_OWNER and TENANT_MANAGER
   */
  @Get()
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async getStaff(@Request() req: any): Promise<StaffMember[]> {
    return this.staffService.getStaffByTenant(req.user.tenant_id);
  }

  /**
   * POST /api/v1/staff
   * Invite a new staff member
   * Only accessible to TENANT_OWNER and TENANT_MANAGER
   */
  @Post()
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async inviteStaff(
    @Request() req: any,
    @Body() data: CreateStaffRequest,
  ): Promise<{ message: string; staff: StaffMember }> {
    const staff = await this.staffService.inviteStaffMember(
      req.user.tenant_id,
      req.user.id,
      data,
    );

    return {
      message: `Invitation sent to ${data.email}`,
      staff,
    };
  }

  /**
   * GET /api/v1/staff/:staffId
   * Get a specific staff member's details
   */
  @Get(':staffId')
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async getStaffMember(
    @Request() req: any,
    @Param('staffId') staffId: string,
  ): Promise<StaffMember> {
    return this.staffService.getStaffById(staffId, req.user.tenant_id);
  }

  /**
   * PUT /api/v1/staff/:staffId
   * Update staff member details
   */
  @Put(':staffId')
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async updateStaff(
    @Request() req: any,
    @Param('staffId') staffId: string,
    @Body() data: UpdateStaffRequest,
  ): Promise<StaffMember> {
    return this.staffService.updateStaffMember(staffId, req.user.tenant_id, data);
  }

  /**
   * DELETE /api/v1/staff/:staffId
   * Remove a staff member
   */
  @Delete(':staffId')
  @Roles(UserRole.TENANT_OWNER)
  async deleteStaff(
    @Request() req: any,
    @Param('staffId') staffId: string,
  ): Promise<{ message: string }> {
    await this.staffService.deleteStaffMember(staffId, req.user.tenant_id);
    return { message: 'Staff member removed' };
  }

  /**
   * POST /api/v1/staff/:staffId/deactivate
   * Deactivate a staff member
   */
  @Post(':staffId/deactivate')
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER)
  async deactivateStaff(
    @Request() req: any,
    @Param('staffId') staffId: string,
  ): Promise<StaffMember> {
    return this.staffService.deactivateStaff(staffId, req.user.tenant_id);
  }

  /**
   * POST /api/v1/staff/accept-invitation
   * Accept staff invitation (no auth required)
   */
  @Post('accept-invitation')
  async acceptInvitation(
    @Body() body: { token: string; password: string; tenantId: string },
  ): Promise<{ message: string }> {
    await this.staffService.acceptInvitation(body.token, body.password, body.tenantId);
    return { message: 'Invitation accepted successfully' };
  }
}
