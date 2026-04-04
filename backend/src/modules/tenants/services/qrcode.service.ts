import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  /**
   * Generate QR code data URL for a given text/URL
   * @param text - Text or URL to encode in QR code
   * @returns QR code data URL (base64 encoded PNG)
   */
  async generateQRCode(text: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 300,
      });
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code as a file buffer
   * @param text - Text or URL to encode
   * @returns PNG buffer
   */
  async generateQRCodeBuffer(text: string): Promise<Buffer> {
    try {
      const buffer = await QRCode.toBuffer(text, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 300,
      });
      return buffer;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate menu ordering URL for a tenant
   * @param tenantSlug - Restaurant slug
   * @param baseUrl - Frontend base URL
   * @returns Full URL to restaurant's menu
   */
  generateMenuUrl(tenantSlug: string, baseUrl: string = 'http://localhost:3000'): string {
    return `${baseUrl}/menu/${tenantSlug}`;
  }
}
