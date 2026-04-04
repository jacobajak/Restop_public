/**
 * Menu Service
 * 
 * Handles all menu-related API operations:
 * - Fetching restaurant menus by tenant
 * - Managing menu items (add, update, delete)
 * - Toggling item availability
 * 
 * All requests are automatically authenticated via apiClient interceptor
 * 
 * @module menuService
 */

import apiClient from './apiClient';
import { Menu, MenuItem, MenuCategory } from '@/types';

/**
 * Menu Service Object
 * Provides methods for menu operations
 */
export const menuService = {
  /**
   * Fetch a restaurant's complete menu
   * 
   * Retrieves all menu data for a specific restaurant including:
   * - Menu categories
   * - Menu items with pricing and availability
   * - Item descriptions and images
   * 
   * @async
   * @param {string} tenantSlug - The restaurant's unique slug identifier
   * @returns {Promise<Menu>} Complete menu object with categories and items
   * @throws {Error} If tenant not found or API error
   * 
   * @example
   * const menu = await menuService.getMenu('best-pizza-co');
   * menu.categories.forEach(cat => console.log(cat.name));
   */
  getMenu: async (tenantSlug: string): Promise<Menu> => {
    const response = await apiClient.get(`/menu/${tenantSlug}`);
    return response.data.data;
  },

  /**
   * Add a new item to restaurant menu
   * 
   * Creates a new menu item with:
   * - Basic info (name, description, price)
   * - Category assignment
   * - Availability status
   * - Optional images/tags
   * 
   * @async
   * @param {Partial<MenuItem>} menuItem - New menu item data
   * @returns {Promise<MenuItem>} Created menu item with server-generated ID
   * @throws {BadRequestException} If data invalid or duplicate item
   * 
   * @example
   * const newItem = await menuService.addMenuItem({
   *   name: 'Margherita Pizza',
   *   price: 12.99,
   *   category_id: 'cat-001',
   *   description: 'Classic Italian pizza'
   * });
   */
  addMenuItem: async (menuItem: Partial<MenuItem>): Promise<MenuItem> => {
    const response = await apiClient.post('/menu/items', menuItem);
    return response.data.data;
  },

  /**
   * Update an existing menu item
   * 
   * Modifies item properties:
   * - Name, description, price
   * - Category (move item between categories)
   * - Availability and visibility
   * 
   * @async
   * @param {string} id - Menu item ID to update
   * @param {Partial<MenuItem>} updates - Fields to update (partial object)
   * @returns {Promise<MenuItem>} Updated menu item
   * @throws {NotFoundException} If item not found
   * 
   * @example
   * const updated = await menuService.updateMenuItem('item-123', {
   *   price: 13.99,
   *   description: 'Classic Italian pizza with fresh basil'
   * });
   */
  updateMenuItem: async (id: string, updates: Partial<MenuItem>): Promise<MenuItem> => {
    const response = await apiClient.put(`/menu/items/${id}`, updates);
    return response.data.data;
  },

  /**
   * Delete a menu item
   * 
   * Removes an item from the restaurant menu.
   * Deleted items are no longer available for orders.
   * 
   * @async
   * @param {string} id - Menu item ID to delete
   * @returns {Promise<void>}
   * @throws {NotFoundException} If item not found
   * 
   * @example
   * await menuService.deleteMenuItem('item-123');
   */
  deleteMenuItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/menu/items/${id}`);
  },

  /**
   * Toggle menu item availability
   * 
   * Available items appear in menu; unavailable items are hidden but not deleted.
   * Useful for temporarily removing items (e.g., out of stock).
   * 
   * @async
   * @param {string} id - Menu item ID
   * @param {boolean} isAvailable - New availability status
   * @returns {Promise<MenuItem>} Updated item with new availability status
   * @throws {NotFoundException} If item not found
   * 
   * @example
   * // Mark item as temporarily unavailable
   * await menuService.toggleAvailability('item-123', false);
   * 
   * // Mark item as available again
   * await menuService.toggleAvailability('item-123', true);
   */
  toggleAvailability: async (id: string, isAvailable: boolean): Promise<MenuItem> => {
    const response = await apiClient.patch(`/menu/items/${id}/availability`, {
      is_available: isAvailable,
    });
    return response.data.data;
  },
};
