import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { TablesService } from '../services/tables.service';
import { CreateTableDto, UpdateTableDto } from '../dto/table.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';

/**
 * Tables Controller
 * 
 * Handles HTTP requests for table management:
 * - Create, read, update, delete tables
 * - Retrieve QR codes for tables
 * 
 * All endpoints require authentication and are tenant-scoped.
 * 
 * @controller api/v1/tables
 */
@Controller('tables')
export class TablesController {
  private readonly logger = new Logger(TablesController.name);

  constructor(private readonly tablesService: TablesService) {}

  /**
   * GET /tables
   * Get all tables for the authenticated restaurant
   */
  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getTables(@GetUser() user: JwtPayload) {
    try {
      this.logger.log(`Fetching tables for tenant: ${user.tenantId}`);
      const tables = await this.tablesService.getTablesByTenant(user.tenantId);
      this.logger.log(`Found ${tables.length} tables`);
      return {
        success: true,
        data: tables,
      };
    } catch (error) {
      this.logger.error(`Error fetching tables: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /tables
   * Create a new table
   */
  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async createTable(
    @GetUser() user: JwtPayload,
    @Body() dto: CreateTableDto,
  ) {
    try {
      this.logger.log(`Creating table: ${JSON.stringify(dto)} for tenant: ${user.tenantId}`);
      const table = await this.tablesService.createTable(user.tenantId, dto);
      this.logger.log(`Table created successfully: ${table.id}`);
      return {
        success: true,
        data: table,
        message: `Table ${table.table_number} created successfully`,
      };
    } catch (error) {
      this.logger.error(`Error creating table: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /tables/:id
   * Get a specific table by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getTable(@Param('id') id: string) {
    const table = await this.tablesService.getTable(id);
    return {
      success: true,
      data: table,
    };
  }

  /**
   * PUT /tables/:id
   * Update a table
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async updateTable(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    const table = await this.tablesService.updateTable(user.tenantId, id, dto);
    return {
      success: true,
      data: table,
      message: 'Table updated successfully',
    };
  }

  /**
   * DELETE /tables/:id
   * Delete a table
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async deleteTable(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.tablesService.deleteTable(user.tenantId, id);
    return {
      success: true,
      message: 'Table deleted successfully',
    };
  }

  /**
   * GET /tables/:id/qr-code/download
   * Download table QR code as PNG image
   * 
   * Protected endpoint - requires authentication
   * Staff can download the QR code to print it
   */
  @Get(':id/qr-code/download')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async downloadQRCode(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const qrCodeBuffer = await this.tablesService.getQRCodeImage(id, 500);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="table-${id}-qr.png"`,
      'Content-Length': qrCodeBuffer.length,
    });
    res.send(qrCodeBuffer);
  }

  /**
   * GET /tables/:id/qr-code/data-url
   * Get table QR code as Data URL for embedding in HTML
   * 
   * Protected endpoint - requires authentication
   * Frontend can fetch this to display the QR code
   */
  @Get(':id/qr-code/data-url')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getQRCodeDataURL(
    @Param('id') id: string,
  ) {
    const dataURL = await this.tablesService.getQRCodeDataURL(id, 400);
    return {
      success: true,
      data: {
        dataURL,
        size: 400,
      },
    };
  }

  /**
   * GET /tables/:id/qr-code/print
   * Get printable HTML for table QR code
   * 
   * Protected endpoint - requires authentication
   * Returns HTML that can be printed directly
   */
  @Get(':id/qr-code/print')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getPrintableQRCode(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Get tenant info for restaurant name
    const table = await this.tablesService.getTable(id);
    const html = await this.tablesService.getPrintableQRCode(
      id,
      table.tenant?.name || 'Restaurant',
    );
    
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * GET /tables/:id/qr-code/svg
   * Get table QR code as SVG string
   * 
   * Protected endpoint - requires authentication
   * SVG format is scalable and resolution-independent
   */
  @Get(':id/qr-code/svg')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getQRCodeSVG(
    @Param('id') id: string,
  ) {
    const svg = await this.tablesService.getQRCodeSVG(id, 400);
    return {
      success: true,
      data: {
        svg,
        size: 400,
      },
    };
  }

  /**
   * GET /tables/qr/:qrCode
   * Public endpoint - Get table by QR code
   * Used by customers scanning the QR code
   */
  @Get('qr/:qrCode')
  async getTableByQRCode(@Param('qrCode') qrCode: string) {
    const table = await this.tablesService.getTableByQRCode(qrCode);
    return {
      success: true,
      data: table,
    };
  }
}
