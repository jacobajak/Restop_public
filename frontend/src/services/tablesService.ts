/**
 * Tables Service
 * 
 * API client for table management operations.
 * 
 * @module services/tablesService
 */

import apiClient from './apiClient';

export interface TableData {
  id: string;
  table_number: number;
  qr_code: string;
  qr_url?: string;
  is_active: boolean;
  created_at: Date;
}

export interface CreateTableInput {
  table_number: number;
}

/**
 * Tables Service
 * 
 * Handles all table-related API calls:
 * - Create, retrieve, update, delete tables
 * - Generate QR codes
 * 
 * @class
 */
class TablesService {
  /**
   * Create a new table
   * 
   * @async
   * @param {CreateTableInput} data - Table data with table number
   * @returns {Promise<TableData>} Created table with QR code
   */
  async createTable(data: CreateTableInput): Promise<TableData> {
    const response = await apiClient.post('/tables', data);
    return response.data.data;
  }

  /**
   * Get all tables for the authenticated restaurant
   * 
   * @async
   * @returns {Promise<TableData[]>} Array of all tables
   */
  async getTables(): Promise<TableData[]> {
    const response = await apiClient.get('/tables');
    return response.data.data;
  }

  /**
   * Get a specific table by ID
   * 
   * @async
   * @param {string} id - Table ID
   * @returns {Promise<TableData>} Table data
   */
  async getTable(id: string): Promise<TableData> {
    const response = await apiClient.get(`/tables/${id}`);
    return response.data.data;
  }

  /**
   * Update a table
   * 
   * @async
   * @param {string} id - Table ID
   * @param {Partial<CreateTableInput>} data - Updated table data
   * @returns {Promise<TableData>} Updated table
   */
  async updateTable(id: string, data: Partial<CreateTableInput>): Promise<TableData> {
    const response = await apiClient.put(`/tables/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete a table
   * 
   * @async
   * @param {string} id - Table ID
   * @returns {Promise<void>}
   */
  async deleteTable(id: string): Promise<void> {
    await apiClient.delete(`/tables/${id}`);
  }

  /**
   * Get table by QR code (public endpoint)
   * Used when customer scans the QR code
   * 
   * @async
   * @param {string} qrCode - QR code identifier
   * @returns {Promise<TableData>} Table data
   */
  async getTableByQRCode(qrCode: string): Promise<TableData> {
    const response = await apiClient.get(`/tables/qr/${qrCode}`);
    return response.data.data;
  }
}

export const tablesService = new TablesService();
