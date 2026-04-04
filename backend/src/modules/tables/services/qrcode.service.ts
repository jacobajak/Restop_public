import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

/**
 * QR Code Service
 * 
 * Handles QR code generation for tables and menu access.
 * Generates QR code images in various formats (PNG, JPEG, SVG).
 * 
 * @class QRCodeService
 * @injectable
 */
@Injectable()
export class QRCodeService {
  /**
   * Generate QR code as PNG buffer
   * 
   * @param {string} data - Data to encode in QR code
   * @param {number} size - Size of the QR code image in pixels (default: 500)
   * @returns {Promise<Buffer>} QR code as PNG buffer
   */
  async generateQRCodePNG(data: string, size: number = 500): Promise<Buffer> {
    try {
      return await QRCode.toBuffer(data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code as SVG string
   * 
   * @param {string} data - Data to encode in QR code
   * @param {number} size - Size of the QR code image in pixels (default: 500)
   * @returns {Promise<string>} QR code as SVG string
   */
  async generateQRCodeSVG(data: string, size: number = 500): Promise<string> {
    try {
      return await QRCode.toString(data, {
        type: 'svg',
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code as Data URL (for embedding in HTML)
   * 
   * @param {string} data - Data to encode in QR code
   * @param {string} type - Image type: 'image/png' or 'image/jpeg'
   * @param {number} size - Size of the QR code image in pixels (default: 500)
   * @returns {Promise<string>} Data URL
   */
  async generateQRCodeDataURL(
    data: string,
    size: number = 500,
  ): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate printable HTML for table QR code
   * 
   * Creates an HTML document that can be printed directly
   * Used for printing table QR codes with labels
   * 
   * @param {string} qrCodeData - QR code data URL or SVG
   * @param {number} tableNumber - Table number for display
   * @param {string} restaurantName - Restaurant name
   * @returns {string} HTML document
   */
  generatePrintableHTML(
    qrCodeData: string,
    tableNumber: number,
    restaurantName: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Table ${tableNumber} - QR Code</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: white;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .qr-container {
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 40px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .restaurant-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
          }
          .table-label {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #666;
          }
          .qr-code {
            margin: 30px 0;
            display: flex;
            justify-content: center;
          }
          .qr-code img {
            max-width: 100%;
            height: auto;
          }
          .instructions {
            font-size: 14px;
            color: #666;
            margin-top: 30px;
            line-height: 1.6;
          }
          .table-number-large {
            font-size: 48px;
            font-weight: bold;
            color: #007bff;
            margin-top: 20px;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .qr-container {
              box-shadow: none;
              border: none;
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="restaurant-name">${restaurantName}</div>
          <div class="table-label">TABLE NUMBER</div>
          <div class="table-number-large">${tableNumber}</div>
          <div class="qr-code">
            <img src="${qrCodeData}" alt="Table QR Code" />
          </div>
          <div class="instructions">
            <p><strong>Scan QR Code to Order</strong></p>
            <p>Customers can scan this QR code with their smartphone to access the menu and place an order.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build table QR code URL
   * 
   * Creates the URL that will be encoded in the QR code
   * Format: {baseURL}/menu/{restaurantSlug}?table={tableNumber}&tableId={tableId}
   * 
   * @param {string} baseURL - Base URL of the application (e.g., http://localhost:3000)
   * @param {string} restaurantSlug - Restaurant slug
   * @param {number} tableNumber - Table number
   * @param {string} tableId - Table UUID
   * @returns {string} Full URL to encode in QR code
   */
  buildTableQRCodeURL(
    baseURL: string,
    restaurantSlug: string,
    tableNumber: number,
    tableId: string,
  ): string {
    return `${baseURL}/menu/${restaurantSlug}?table=${tableNumber}&tableId=${tableId}`;
  }
}
