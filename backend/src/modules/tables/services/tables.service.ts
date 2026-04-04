import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from '../entities/table.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CreateTableDto, UpdateTableDto } from '../dto/table.dto';
import { QRCodeService } from './qrcode.service';
import { v4 as uuid } from 'uuid';

/**
 * Tables Service
 * 
 * Handles all table-related business logic:
 * - Create and manage dining tables
 * - Generate QR codes for table ordering
 * - Associate QR codes with menu URLs
 * - Retrieve tables per restaurant
 * 
 * Each restaurant can have multiple tables.
 * Each table has a unique QR code for customers to scan and order.
 * 
 * @class TablesService
 * @injectable
 */
@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private readonly qrCodeService: QRCodeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new table for a restaurant
   * 
   * Generates a simplified QR code identifier based on table number.
   * QR code format: {2-digit table number}{4 hex chars}
   * Examples: 05DC4, 10A2F, etc.
   * 
   * QR code URL points directly to the menu with table pre-filled:
   * Format: /menu/{restaurant-slug}?table={table_number}&tableId={table_uuid}
   * 
   * @async
   * @param {string} tenantId - Restaurant/tenant ID
   * @param {CreateTableDto} dto - Table data
   * @returns {Promise<Table>} Created table
   * @throws {BadRequestException} If table number already exists for this tenant
   * 
   * @example
   * const table = await tablesService.createTable(
   *   'tenant-123',
   *   { table_number: 5 }
   * );
   * // Returns: { 
   * //   id: 'uuid', 
   * //   table_number: 5, 
   * //   qr_code: '05DC4',
   * //   qr_url: '/menu/my-restaurant?table=5&tableId=uuid',
   * //   ... 
   * // }
   */
  async createTable(tenantId: string, dto: CreateTableDto): Promise<Table> {
    // Check if table number already exists for this tenant
    const existingTable = await this.tableRepository.findOne({
      where: {
        tenant_id: tenantId,
        table_number: dto.table_number,
      },
    });

    if (existingTable) {
      throw new BadRequestException(
        `Table ${dto.table_number} already exists for this restaurant`,
      );
    }

    // Get tenant for restaurant slug
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Generate table ID (UUID)
    const tableId = uuid();
    
    // Generate simplified QR code ID: {2-digit table number}{4 hex chars}
    // Example: "05DC4" for table 5, "10A2F" for table 10
    const randomHex = uuid().substring(0, 4).toUpperCase();
    const paddedTableNum = dto.table_number.toString().padStart(2, '0');
    const qrCode = `${paddedTableNum}${randomHex}`;

    // Generate QR URL that points to the menu with table info
    // Must be a full URL so QR codes work when scanned from mobile devices
    // Format: {FRONTEND_URL}/menu/{slug}?table={number}&tableId={id}
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const qrUrl = `${frontendUrl}/menu/${tenant.slug}?table=${dto.table_number}&tableId=${tableId}`;

    const table = this.tableRepository.create({
      id: tableId,
      tenant_id: tenantId,
      table_number: dto.table_number,
      qr_code: qrCode,
      qr_url: qrUrl,
      is_active: dto.is_active ?? true,
    });

    return this.tableRepository.save(table);
  }

  /**
   * Get all tables for a restaurant
   * 
   * @async
   * @param {string} tenantId - Restaurant/tenant ID
   * @returns {Promise<Table[]>} Array of tables
   */
  async getTablesByTenant(tenantId: string): Promise<Table[]> {
    return this.tableRepository.find({
      where: { tenant_id: tenantId },
      order: { table_number: 'ASC' },
    });
  }

  /**
   * Get a single table by ID
   * 
   * @async
   * @param {string} id - Table ID
   * @returns {Promise<Table>} Table data
   * @throws {NotFoundException} If table not found
   */
  async getTable(id: string): Promise<Table> {
    const table = await this.tableRepository.findOne({ where: { id } });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  /**
   * Get a table by QR code
   * 
   * Used when customer scans the QR code.
   * Allows retrieving table information from the QR code identifier.
   * 
   * @async
   * @param {string} qrCode - QR code identifier
   * @returns {Promise<Table>} Table data
   * @throws {NotFoundException} If table not found
   */
  async getTableByQRCode(qrCode: string): Promise<Table> {
    const table = await this.tableRepository.findOne({ where: { qr_code: qrCode } });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  /**
   * Update a table
   * 
   * @async
   * @param {string} tenantId - Restaurant/tenant ID (for permission check)
   * @param {string} id - Table ID
   * @param {UpdateTableDto} dto - Updated table data
   * @returns {Promise<Table>} Updated table
   * @throws {NotFoundException} If table not found
   * @throws {BadRequestException} If table number already exists
   */
  async updateTable(
    tenantId: string,
    id: string,
    dto: UpdateTableDto,
  ): Promise<Table> {
    const table = await this.getTable(id);

    // Verify table belongs to the tenant
    if (table.tenant_id !== tenantId) {
      throw new BadRequestException('Unauthorized: Table does not belong to this restaurant');
    }

    // Check if new table number already exists
    if (dto.table_number && dto.table_number !== table.table_number) {
      const existingTable = await this.tableRepository.findOne({
        where: {
          tenant_id: tenantId,
          table_number: dto.table_number,
        },
      });

      if (existingTable) {
        throw new BadRequestException(
          `Table ${dto.table_number} already exists for this restaurant`,
        );
      }
    }

    Object.assign(table, dto);
    return this.tableRepository.save(table);
  }

  /**
   * Delete a table
   * 
   * @async
   * @param {string} tenantId - Restaurant/tenant ID (for permission check)
   * @param {string} id - Table ID
   * @throws {NotFoundException} If table not found
   * @throws {BadRequestException} If unauthorized
   */
  async deleteTable(tenantId: string, id: string): Promise<void> {
    const table = await this.getTable(id);

    // Verify table belongs to the tenant
    if (table.tenant_id !== tenantId) {
      throw new BadRequestException('Unauthorized: Table does not belong to this restaurant');
    }

    await this.tableRepository.remove(table);
  }

  /**
   * Set QR code URL for a table
   * 
   * Called when generating the full menu URL for the QR code.
   * Format: /menu/{restaurant-slug}?table={table_number}
   * 
   * @async
   * @param {string} id - Table ID
   * @param {string} qrUrl - Full QR code URL
   * @returns {Promise<Table>} Updated table
   */
  async setQRCodeUrl(id: string, qrUrl: string): Promise<Table> {
    const table = await this.getTable(id);
    table.qr_url = qrUrl;
    return this.tableRepository.save(table);
  }

  /**
   * Get QR code as PNG buffer
   * 
   * Generates a QR code image from the table's full menu URL.
   * When scanned, it directs to: /menu/{slug}?table={number}&tableId={id}
   * 
   * @async
   * @param {string} tableId - Table ID
   * @param {number} size - Size of QR code in pixels (default: 500)
   * @returns {Promise<Buffer>} QR code PNG image
   * @throws {NotFoundException} If table not found
   */
  async getQRCodeImage(tableId: string, size: number = 500): Promise<Buffer> {
    const table = await this.getTable(tableId);
    const qrData = table.qr_url || table.qr_code; // Fallback to qr_code if qr_url not set
    if (!qrData) {
      throw new BadRequestException('QR code data not available for this table');
    }
    return this.qrCodeService.generateQRCodePNG(qrData, size);
  }

  /**
   * Get QR code as SVG string
   * 
   * Generates a QR code image in SVG format (scalable).
   * Encodes the full menu URL so scanning takes directly to ordering.
   * 
   * @async
   * @param {string} tableId - Table ID
   * @param {number} size - Size of QR code in pixels (default: 500)
   * @returns {Promise<string>} QR code SVG string
   * @throws {NotFoundException} If table not found
   */
  async getQRCodeSVG(tableId: string, size: number = 500): Promise<string> {
    const table = await this.getTable(tableId);
    const qrData = table.qr_url || table.qr_code; // Fallback to qr_code if qr_url not set
    if (!qrData) {
      throw new BadRequestException('QR code data not available for this table');
    }
    return this.qrCodeService.generateQRCodeSVG(qrData, size);
  }

  /**
   * Get QR code as Data URL (for embedding in HTML/frontend)
   * 
   * Returns a data URL with the full menu link encoded in the QR code.
   * 
   * @async
   * @param {string} tableId - Table ID
   * @param {number} size - Size of QR code in pixels (default: 500)
   * @returns {Promise<string>} Data URL
   * @throws {NotFoundException} If table not found
   */
  async getQRCodeDataURL(tableId: string, size: number = 500): Promise<string> {
    const table = await this.getTable(tableId);
    const qrData = table.qr_url || table.qr_code; // Fallback to qr_code if qr_url not set
    if (!qrData) {
      throw new BadRequestException('QR code data not available for this table');
    }
    return this.qrCodeService.generateQRCodeDataURL(qrData, size);
  }

  /**
   * Generate printable HTML for table QR code
   * 
   * Creates an HTML document with the QR code that points to the menu URL.
   * Includes table number and instructions for customers.
   * 
   * @async
   * @param {string} tableId - Table ID
   * @param {string} restaurantName - Restaurant name for display
   * @returns {Promise<string>} HTML document
   * @throws {NotFoundException} If table not found
   */
  async getPrintableQRCode(tableId: string, restaurantName: string): Promise<string> {
    const table = await this.getTable(tableId);
    const qrCodeDataURL = await this.getQRCodeDataURL(tableId, 400);
    return this.qrCodeService.generatePrintableHTML(
      qrCodeDataURL,
      table.table_number,
      restaurantName,
    );
  }}