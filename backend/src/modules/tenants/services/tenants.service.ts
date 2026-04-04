import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { QrCodeService } from './qrcode.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private qrCodeService: QrCodeService,
    private configService: ConfigService,
  ) {}

  /**
   * Create a new tenant with QR code
   */
  async createTenant(data: {
    name: string;
    slug: string;
    email: string;
    phone?: string;
    logo_url?: string;
    currency?: string;
  }): Promise<Tenant> {
    try {
      // Check if slug already exists
      const existingTenant = await this.tenantRepository.findOne({
        where: { slug: data.slug },
      });

      if (existingTenant) {
        throw new BadRequestException(
          `Restaurant slug "${data.slug}" is already in use. Please choose a different slug.`,
        );
      }

      // Generate QR code for menu ordering
      const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
      const menuUrl = this.qrCodeService.generateMenuUrl(data.slug, baseUrl);
      
      let qrCodeData: string;
      try {
        qrCodeData = await this.qrCodeService.generateQRCode(menuUrl);
      } catch (qrError) {
        this.logger.error(
          `Failed to generate QR code for tenant ${data.slug}: ${qrError.message}`,
          qrError.stack,
        );
        throw new BadRequestException(`Failed to generate QR code: ${qrError.message}`);
      }

      // Create tenant with QR code
      const tenant = this.tenantRepository.create({
        ...data,
        currency: data.currency || 'USD',
        qr_code_url: menuUrl,
        qr_code_data: qrCodeData,
      });

      const savedTenant = await this.tenantRepository.save(tenant);
      this.logger.log(`Tenant created successfully: ${savedTenant.slug} (ID: ${savedTenant.id})`);
      return savedTenant;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to create tenant ${data.slug}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to create tenant: ${error.message}`);
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Get tenant by slug (public lookup)
   * Excludes archived restaurants to prevent access to deleted restaurants
   */
  async getTenantBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug, archived_at: null },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant not found');
    }

    return tenant;
  }

  /**
   * Update tenant
   */
  async updateTenant(
    id: string,
    data: Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at' | 'qr_code_url' | 'qr_code_data'>>,
  ): Promise<Tenant> {
    const tenant = await this.getTenantById(id);

    Object.assign(tenant, data);

    return this.tenantRepository.save(tenant);
  }

  /**
   * Regenerate QR code for tenant
   */
  async regenerateQRCode(id: string): Promise<Tenant> {
    const tenant = await this.getTenantById(id);

    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const menuUrl = this.qrCodeService.generateMenuUrl(tenant.slug, baseUrl);
    const qrCodeData = await this.qrCodeService.generateQRCode(menuUrl);

    tenant.qr_code_url = menuUrl;
    tenant.qr_code_data = qrCodeData;

    return this.tenantRepository.save(tenant);
  }

  /**
   * Get QR code data URL for tenant
   */
  async getQRCode(id: string): Promise<{ qr_code_url: string; qr_code_data: string; menu_url: string }> {
    const tenant = await this.getTenantById(id);

    return {
      qr_code_url: tenant.qr_code_url,
      qr_code_data: tenant.qr_code_data,
      menu_url: this.qrCodeService.generateMenuUrl(tenant.slug),
    };
  }

  /**
   * Get count of restaurants with activity today
   */
  async getActiveRestaurantsToday(): Promise<number> {
    // Import Order entity for this query
    const result = await this.tenantRepository
      .createQueryBuilder('tenant')
      .innerJoin(
        'orders',
        'order',
        'order.tenant_id = tenant.id AND DATE(order.created_at) = CURRENT_DATE',
      )
      .select('DISTINCT tenant.id')
      .getRawMany();

    return result.length;
  }

  /**
   * Get all restaurants with activity on a given date
   */
  async getRestaurantsWithActivity(date: Date): Promise<Tenant[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.tenantRepository
      .createQueryBuilder('tenant')
      .innerJoin(
        'orders',
        'order',
        'order.tenant_id = tenant.id AND order.created_at >= :start AND order.created_at <= :end',
      )
      .select('DISTINCT tenant.*')
      .setParameters({ start: startOfDay, end: endOfDay })
      .getRawMany()
      .then((rows) => rows.map((row) => Object.assign(new Tenant(), row)));
  }

  /**
   * Suspend a restaurant (admin action)
   * Prevents the restaurant from receiving new orders
   */
  async suspendRestaurant(
    id: string,
    reason: string,
    adminUserId: string,
  ): Promise<Tenant> {
    const tenant = await this.getTenantById(id);

    tenant.status = 'SUSPENDED';
    tenant.suspended_reason = reason;
    tenant.suspended_at = new Date();
    tenant.suspended_by_admin_id = adminUserId;

    const updated = await this.tenantRepository.save(tenant);

    this.logger.log(
      `Restaurant ${tenant.name} (${id}) suspended by admin ${adminUserId}. Reason: ${reason}`,
    );

    return updated;
  }

  /**
   * Activate a suspended restaurant
   */
  async activateRestaurant(
    id: string,
    adminUserId: string,
  ): Promise<Tenant> {
    const tenant = await this.getTenantById(id);

    const previousStatus = tenant.status;
    tenant.status = 'ACTIVE';
    tenant.suspended_reason = null;
    tenant.suspended_at = null;
    tenant.suspended_by_admin_id = null;

    const updated = await this.tenantRepository.save(tenant);

    this.logger.log(
      `Restaurant ${tenant.name} (${id}) activated by admin ${adminUserId} (was ${previousStatus})`,
    );

    return updated;
  }

  /**
   * Check if a restaurant is suspended
   */
  async isRestaurantSuspended(id: string): Promise<boolean> {
    const tenant = await this.getTenantById(id);
    return tenant.status === 'SUSPENDED';
  }

  /**
   * Get count of active (non-suspended) restaurants
   */
  async getActiveRestaurantCount(): Promise<number> {
    return this.tenantRepository
      .createQueryBuilder('tenant')
      .where('tenant.status = :status', { status: 'ACTIVE' })
      .orWhere('tenant.status IS NULL')
      .getCount();
  }
}
