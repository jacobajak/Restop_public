import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CreateMenuItemDto, UpdateMenuItemDto, CreateMenuCategoryDto } from './dto/menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    @InjectRepository(MenuCategory)
    private categoryRepository: Repository<MenuCategory>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  // Menu Item Methods
  async createMenuItem(tenantId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    let categoryId = dto.category_id;

    // If category string is provided instead of ID, find or create it
    if (!categoryId && dto.category) {
      let category = await this.categoryRepository.findOne({
        where: { name: dto.category, tenant_id: tenantId },
      });

      if (!category) {
        // Create category if it doesn't exist
        category = this.categoryRepository.create({
          tenant_id: tenantId,
          name: dto.category,
          sort_order: 0,
        });
        category = await this.categoryRepository.save(category);
      }

      categoryId = category.id;
    }

    if (!categoryId) {
      throw new Error('category_id or category must be provided');
    }

    // Verify category exists and belongs to tenant
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    const item = this.menuItemRepository.create({
      tenant_id: tenantId,
      category_id: categoryId,
      name: dto.name,
      description: dto.description || '',
      price: dto.price,
      image_url: dto.image_url,
      is_available: dto.is_available !== false, // Default to true
    });

    return this.menuItemRepository.save(item);
  }

  async updateMenuItem(
    tenantId: string,
    id: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const item = await this.menuItemRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    Object.assign(item, dto);
    return this.menuItemRepository.save(item);
  }

  async deleteMenuItem(tenantId: string, id: string): Promise<void> {
    const result = await this.menuItemRepository.delete({
      id,
      tenant_id: tenantId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Menu item not found');
    }
  }

  async toggleAvailability(
    tenantId: string,
    id: string,
    isAvailable: boolean,
  ): Promise<MenuItem> {
    const item = await this.menuItemRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    item.is_available = isAvailable;
    return this.menuItemRepository.save(item);
  }

  async getMenuItemsByTenant(tenantId: string): Promise<MenuItem[]> {
    return this.menuItemRepository.find({
      where: { tenant_id: tenantId },
      relations: ['category'],
      order: { created_at: 'DESC' },
    });
  }

  async getMenuByTenantSlug(slug: string) {
    // Fetch tenant by slug
    const tenant = await this.tenantRepository.findOne({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Fetch all categories for this tenant (sorted by sort_order)
    const categories = await this.categoryRepository.find({
      where: { tenant_id: tenant.id },
      order: { sort_order: 'ASC' },
    });

    // Fetch all menu items for this tenant
    const items = await this.menuItemRepository.find({
      where: { tenant_id: tenant.id },
      relations: ['category'],
      order: { created_at: 'DESC' },
    });

    // Generate QR code URL for customer ordering
    const qrCodeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/menu/${slug}`;

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        currency: tenant.currency,
        qr_code_url: qrCodeUrl,
      },
      categories,
      items,
    };
  }

  // Category Methods
  async createCategory(tenantId: string, dto: CreateMenuCategoryDto): Promise<MenuCategory> {
    const category = this.categoryRepository.create({
      tenant_id: tenantId,
      ...dto,
    });

    return this.categoryRepository.save(category);
  }

  async getCategoriesByTenant(tenantId: string): Promise<MenuCategory[]> {
    return this.categoryRepository.find({
      where: { tenant_id: tenantId },
      order: { sort_order: 'ASC' },
    });
  }
}
