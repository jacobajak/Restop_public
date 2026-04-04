import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
  Body,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantsService } from '../../tenants/services/tenants.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditActionEnum } from '../../audit/entities/audit-log.entity';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { UpdateRestaurantStatusDto } from '../dtos/update-restaurant-status.dto';

/**
 * AdminRestaurantsController - Platform admin restaurant management
 *
 * Allows platform admins to:
 * - View all restaurants
 * - View restaurant details
 * - Suspend/activate restaurants
 * - Verify restaurants
 *
 * GET /admin/restaurants - List all restaurants
 * GET /admin/restaurants/:id - Get restaurant details
 * PATCH /admin/restaurants/:id/status - Change restaurant status
 * PATCH /admin/restaurants/:id/verify - Mark restaurant as verified
 */
@Controller('admin/restaurants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminRestaurantsController {
  private readonly logger = new Logger(AdminRestaurantsController.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get all restaurants with optional filtering
   */
  @Get()
  async listRestaurants(
    @Query('search') search?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
    @Query('includeArchived') includeArchived: boolean = false,
  ) {
    try {
      let query = this.tenantRepository.createQueryBuilder('tenant');

      // Exclude archived restaurants by default
      if (!includeArchived) {
        query = query.where('tenant.archived_at IS NULL');
      }

      const restaurants = await query.getMany();

      let filtered = restaurants;

      if (search) {
        filtered = filtered.filter(
          (r) =>
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.slug.toLowerCase().includes(search.toLowerCase()) ||
            (r.email && r.email.toLowerCase().includes(search.toLowerCase())),
        );
      }

      // Apply pagination
      const paginated = filtered.slice(offset, offset + limit);

      return {
        success: true,
        data: {
          restaurants: paginated,
          total: filtered.length,
          limit,
          offset,
          includeArchived,
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
   * Get restaurant details
   */
  @Get(':id')
  async getRestaurant(@Param('id') id: string) {
    try {
      const restaurant = await this.tenantRepository.findOne({ where: { id } });
      if (!restaurant) {
        throw new BadRequestException('Restaurant not found');
      }

      return {
        success: true,
        data: restaurant,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update restaurant status (suspend/activate)
   *Admin can suspend restaurants for non-compliance or violations.
   * Suspended restaurants cannot receive new orders.
   */
  @Patch(':id/status')
  async updateRestaurantStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateRestaurantStatusDto,
    @GetUser() user: JwtPayload,
  ) {
    try {
      this.logger.log(`Admin ${user.userId} attempting to update restaurant ${id} status to ${updateStatusDto.status}`);

      const restaurant = await this.tenantsService.getTenantById(id);
      const oldStatus = restaurant.status || 'ACTIVE';

      let updated: Tenant;

      if (updateStatusDto.status === 'SUSPENDED') {
        if (!updateStatusDto.reason || updateStatusDto.reason.trim().length === 0) {
          throw new BadRequestException('Suspension reason is required');
        }
        this.logger.log(`Suspending restaurant ${id}: ${updateStatusDto.reason}`);
        updated = await this.tenantsService.suspendRestaurant(id, updateStatusDto.reason, user.userId);
      } else if (updateStatusDto.status === 'ACTIVE') {
        this.logger.log(`Activating restaurant ${id}`);
        updated = await this.tenantsService.activateRestaurant(id, user.userId);
      } else {
        throw new BadRequestException(`Invalid status: ${updateStatusDto.status}`);
      }

      // Log the actual status change
      await this.auditService.log({
        admin_user_id: user.userId,
        action_type:
          updateStatusDto.status === 'SUSPENDED'
            ? AuditActionEnum.RESTAURANT_SUSPENDED
            : AuditActionEnum.RESTAURANT_ACTIVATED,
        reference_type: 'restaurant',
        reference_id: id,
        before_state_json: { status: oldStatus, name: restaurant.name },
        after_state_json: { status: updateStatusDto.status, name: restaurant.name },
        metadata_json: {
          reason: updateStatusDto.reason,
          suspended_by_admin_id: updateStatusDto.status === 'SUSPENDED' ? user.userId : null,
        },
      });

      this.logger.log(`Restaurant ${id} status successfully updated to ${updateStatusDto.status}`);

      return {
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          suspended_reason: updated.suspended_reason,
          message: `Restaurant status updated to ${updateStatusDto.status}`,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update restaurant status: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify restaurant
   *
   * Future: Implement verification logic
   */
  @Patch(':id/verify')
  async verifyRestaurant(
    @Param('id') id: string,
    @GetUser() user: JwtPayload,
  ) {
    try {
      const restaurant = await this.tenantRepository.findOne({ where: { id } });
      if (!restaurant) {
        throw new BadRequestException('Restaurant not found');
      }

      // Log audit event
      await this.auditService.log({
        admin_user_id: user.userId,
        action_type: AuditActionEnum.RESTAURANT_VERIFIED,
        reference_type: 'restaurant',
        reference_id: id,
        metadata_json: { action: 'admin_verification' },
      });

      return {
        success: true,
        data: {
          id,
          verified: true,
          message: 'Restaurant verified successfully',
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
   * Archive (soft delete) a restaurant
   *
   * Archives the restaurant instead of permanently deleting it.
   * Archived restaurants are hidden from normal views but can be restored.
   * All historical data is preserved for compliance and auditing.
   */
  @Delete(':id/archive')
  async archiveRestaurant(
    @Param('id') id: string,
    @GetUser() user: JwtPayload,
  ) {
    try {
      this.logger.log(`Admin ${user.userId} attempting to archive restaurant ${id}`);

      const restaurant = await this.tenantRepository.findOne({ where: { id } });
      if (!restaurant) {
        throw new BadRequestException('Restaurant not found');
      }

      if (restaurant.archived_at) {
        throw new BadRequestException('Restaurant is already archived');
      }

      // Update restaurant with archive timestamp
      restaurant.archived_at = new Date();
      restaurant.archived_by_admin_id = user.userId;
      const archived = await this.tenantRepository.save(restaurant);

      // Log audit event
      await this.auditService.log({
        admin_user_id: user.userId,
        action_type: AuditActionEnum.RESTAURANT_ARCHIVED,
        reference_type: 'restaurant',
        reference_id: id,
        before_state_json: { name: restaurant.name, status: restaurant.status, archived_at: null },
        after_state_json: { name: restaurant.name, status: restaurant.status, archived_at: archived.archived_at },
        metadata_json: {
          archived_by_admin_id: user.userId,
          action: 'soft_delete_archive',
        },
      });

      this.logger.log(`Restaurant ${id} archived successfully by admin ${user.userId}`);

      return {
        success: true,
        data: {
          id: archived.id,
          name: archived.name,
          archived_at: archived.archived_at,
          archived_by_admin_id: archived.archived_by_admin_id,
          message: 'Restaurant archived successfully. Historical data is preserved.',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to archive restaurant: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
