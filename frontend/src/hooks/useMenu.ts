import { useState, useEffect } from 'react';
import { Menu } from '@/types';
import { menuService } from '@/services/menuService';

export const useMenu = (tenantSlug: string) => {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const data = await menuService.getMenu(tenantSlug);
        setMenu(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch menu');
        setMenu(null);
      } finally {
        setLoading(false);
      }
    };

    if (tenantSlug) {
      fetchMenu();
    }
  }, [tenantSlug]);

  return { menu, loading, error };
};
