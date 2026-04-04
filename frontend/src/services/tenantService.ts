import apiClient from './apiClient';
import { QRCode, Tenant } from '@/types';

export const tenantService = {
  getTenant: async (slug: string): Promise<Tenant> => {
    const response = await apiClient.get(`/tenants/${slug}`);
    return response.data.data;
  },

  getQRCode: async (tenantId: string): Promise<QRCode> => {
    const response = await apiClient.get(`/tenants/${tenantId}/qrcode`);
    return response.data.data;
  },

  generateQRCode: async (tenantId: string) => {
    const response = await apiClient.post(`/tenants/${tenantId}/qrcode/generate`);
    return response.data.data;
  },
};
