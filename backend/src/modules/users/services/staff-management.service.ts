import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffMember, StaffRole } from '../entities/staff-member.entity';
import { User, UserRole } from '../entities/user.entity';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

export interface CreateStaffDto {
  name: string;
  email: string;
  role: StaffRole;
  phone?: string;
}

export interface UpdateStaffDto {
  name?: string;
  role?: StaffRole;
  phone?: string;
  is_active?: boolean;
}

@Injectable()
export class StaffManagementService {
  private mailTransporter: any;

  constructor(
    @InjectRepository(StaffMember)
    private staffRepository: Repository<StaffMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    // Initialize email transporter (you should use environment variables for credentials)
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Get all staff members for a tenant
   */
  async getStaffByTenant(tenantId: string): Promise<StaffMember[]> {
    return this.staffRepository.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Create a new staff member and send invitation email
   */
  async inviteStaffMember(
    tenantId: string,
    createdBy: string,
    data: CreateStaffDto,
  ): Promise<StaffMember> {
    // Check if email already exists
    const existingStaff = await this.staffRepository.findOne({
      where: [
        { email: data.email, tenant_id: tenantId },
      ],
    });

    if (existingStaff) {
      throw new BadRequestException(`Staff with email ${data.email} already exists`);
    }

    // Create staff member record with invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date();
    invitationExpiresAt.setDate(invitationExpiresAt.getDate() + 7); // Valid for 7 days

    const staff = this.staffRepository.create({
      tenant_id: tenantId,
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone,
      invitation_token: invitationToken,
      invitation_expires_at: invitationExpiresAt,
      invited_by: createdBy,
    });

    const savedStaff = await this.staffRepository.save(staff);

    // Send invitation email
    await this.sendInvitationEmail(
      data.email,
      data.name,
      invitationToken,
      tenantId,
    );

    return savedStaff;
  }

  /**
   * Update staff member details
   */
  async updateStaffMember(
    staffId: string,
    tenantId: string,
    data: UpdateStaffDto,
  ): Promise<StaffMember> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId, tenant_id: tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    Object.assign(staff, data);
    return this.staffRepository.save(staff);
  }

  /**
   * Deactivate staff member
   */
  async deactivateStaff(staffId: string, tenantId: string): Promise<StaffMember> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId, tenant_id: tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    staff.is_active = false;
    return this.staffRepository.save(staff);
  }

  /**
   * Accept staff invitation and create user account
   */
  async acceptInvitation(
    invitationToken: string,
    password: string,
    tenantId: string,
  ): Promise<{ staff: StaffMember; user: User }> {
    const staff = await this.staffRepository.findOne({
      where: {
        invitation_token: invitationToken,
        tenant_id: tenantId,
      },
    });

    if (!staff) {
      throw new BadRequestException('Invalid invitation token');
    }

    if (new Date() > staff.invitation_expires_at) {
      throw new BadRequestException('Invitation has expired');
    }

    // Map StaffRole to UserRole
    const userRole = this.mapStaffRoleToUserRole(staff.role);

    // Create user account
    const user = this.userRepository.create({
      name: staff.name,
      email: staff.email,
      tenant_id: tenantId,
      role: userRole,
      password_hash: password, // Should be hashed in auth service
    });

    const savedUser = await this.userRepository.save(user);

    // Update staff member with user_id
    staff.user_id = savedUser.id;
    staff.invitation_token = null;
    staff.invitation_expires_at = null;

    const updatedStaff = await this.staffRepository.save(staff);

    return { staff: updatedStaff, user: savedUser };
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(staffId: string, tenantId: string): Promise<StaffMember> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId, tenant_id: tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  /**
   * Delete staff member
   */
  async deleteStaffMember(staffId: string, tenantId: string): Promise<void> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId, tenant_id: tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    await this.staffRepository.remove(staff);
  }

  /**
   * Get staff member by email
   */
  async getStaffByEmail(email: string, tenantId: string): Promise<StaffMember | null> {
    return this.staffRepository.findOne({
      where: { email, tenant_id: tenantId },
    });
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    email: string,
    name: string,
    invitationToken: string,
    tenantId: string,
  ): Promise<void> {
    try {
      const invitationLink = `${process.env.FRONTEND_URL}/staff/accept-invitation?token=${invitationToken}&tenant=${tenantId}`;

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@restop.com',
        to: email,
        subject: 'RESTOP Staff Invitation',
        html: `
          <h2>Welcome to RESTOP, ${name}!</h2>
          <p>You've been invited to join as a staff member.</p>
          <p><a href="${invitationLink}">Click here to accept your invitation</a></p>
          <p>This link will expire in 7 days.</p>
        `,
      };

      await this.mailTransporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't throw - staff was created even if email fails
    }
  }

  /**
   * Map StaffRole to UserRole
   */
  private mapStaffRoleToUserRole(staffRole: StaffRole): UserRole {
    switch (staffRole) {
      case StaffRole.MANAGER:
        return UserRole.TENANT_MANAGER;
      case StaffRole.KITCHEN_STAFF:
        return UserRole.KITCHEN_STAFF;
      case StaffRole.CASHIER:
        return UserRole.CASHIER;
      default:
        return UserRole.KITCHEN_STAFF;
    }
  }
}
