import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../common/strategies/jwt.strategy';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // Get menu items for authenticated restaurant owner
  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getMenuItems(@GetUser() user: JwtPayload) {
    const items = await this.menuService.getMenuItemsByTenant(user.tenantId);
    return {
      success: true,
      data: items,
    };
  }

  // Public endpoint - no authentication required
  @Get(':slug')
  async getMenuBySlug(@Param('slug') slug: string) {
    // TODO: Get tenant by slug and return menu
    const menu = await this.menuService.getMenuByTenantSlug(slug);
    return {
      success: true,
      data: menu,
    };
  }

  @Post('items')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async createMenuItem(
    @GetUser() user: JwtPayload,
    @Body() dto: CreateMenuItemDto,
  ) {
    const item = await this.menuService.createMenuItem(user.tenantId, dto);
    return {
      success: true,
      data: item,
    };
  }

  @Put('items/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async updateMenuItem(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    const item = await this.menuService.updateMenuItem(user.tenantId, id, dto);
    return {
      success: true,
      data: item,
    };
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async deleteMenuItem(@GetUser() user: JwtPayload, @Param('id') id: string) {
    await this.menuService.deleteMenuItem(user.tenantId, id);
    return {
      success: true,
      message: 'Menu item deleted',
    };
  }

  @Patch('items/:id/availability')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async toggleAvailability(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { is_available: boolean },
  ) {
    const item = await this.menuService.toggleAvailability(
      user.tenantId,
      id,
      body.is_available,
    );
    return {
      success: true,
      data: item,
    };
  }
}
