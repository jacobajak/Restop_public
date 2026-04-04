'use client';

/**
 * MenuDisplay Component
 * 
 * Displays a restaurant's menu with category filtering and item cards.
 * 
 * Features:
 * - Category navigation (horizontal scrollable tabs)
 * - Items filtered by selected category
 * - Responsive grid layout (1-3 columns based on screen size)
 * - Empty state handling
 * 
 * Usage:
 * ```tsx
 * <MenuDisplay
 *   categories={menuData.categories}
 *   items={menuData.items}
 *   onItemAdded={() => refetch()}
 * />
 * ```
 * 
 * @module MenuDisplay
 */

import React from 'react';
import { MenuCategory, MenuItem as MenuItemType } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { Info } from 'lucide-react';

/**
 * Props for MenuDisplay component
 * @interface MenuDisplayProps
 */
interface MenuDisplayProps {
  /** List of menu categories for tab navigation */
  categories: MenuCategory[];
  
  /** List of menu items to display */
  items: MenuItemType[];
  
  /** Callback fired when user adds item to cart (optional) */
  onItemAdded?: () => void;
}

/**
 * MenuDisplay Component
 * 
 * Renders interactive menu with category filtering and item grid.
 * 
 * @component
 * @param {MenuDisplayProps} props - Component props
 * @returns {React.ReactElement} Rendered menu interface
 * 
 * @example
 * const { data } = await menuService.getMenu('restaurant-slug');
 * return <MenuDisplay categories={data.categories} items={data.items} />;
 */
export const MenuDisplay: React.FC<MenuDisplayProps> = ({ categories, items, onItemAdded }) => {
  // Track currently selected category; default to first category
  const [activeCategory, setActiveCategory] = React.useState<string | null>(
    categories.length > 0 ? categories[0].id : null
  );

  // Filter items to show only those in the active category
  const filteredItems = activeCategory
    ? items.filter((item) => item.category_id === activeCategory)
    : items;

  return (
    <div className="w-full">
      {/* 
        Category Navigation Tabs
        - Horizontal scrollable layout
        - Highlights active category
        - Smooth scroll behavior with snap points
      */}
      <div className="mb-8">
        <div className="flex gap-2.5 overflow-x-auto pb-4 mb-2 scroll-smooth snap-x snap-mandatory -mx-4 px-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-5 py-2.5 rounded-full font-semibold whitespace-nowrap transition-all snap-center flex-shrink-0 ${
                activeCategory === category.id
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
        {/* Scroll hint for mobile */}
        <div className="text-xs text-gray-400 text-center md:hidden">Swipe to see more categories</div>
      </div>

      {/* 
        Menu Items Grid
        - Responsive: 1 col (mobile), 2 cols (tablet), 3 cols (desktop)
        - Better spacing and card alignment
        - Shows empty state if no items in category
      */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onAddClick={onItemAdded}
            />
          ))}
        </div>
      ) : (
        // Empty state when no items available in selected category
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No items available in this category</p>
        </div>
      )}
    </div>
  );
};
