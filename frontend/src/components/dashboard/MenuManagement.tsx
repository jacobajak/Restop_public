'use client';

import React, { useState } from 'react';
import { MenuItem } from '@/types';
import { Edit2, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatPrice } from '@/utils/currency';

interface MenuManagementProps {
  items: MenuItem[];
  onAddItem?: () => void;
  onEditItem?: (item: MenuItem) => void;
  onDeleteItem?: (id: string) => void;
  onToggleAvailability?: (id: string, available: boolean) => void;
}

export const MenuManagement: React.FC<MenuManagementProps> = ({
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onToggleAvailability,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search menu items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <button
          onClick={onAddItem}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium shadow-md"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md overflow-hidden border border-neutral-200 dark:border-neutral-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white">Price</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{item.name}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-1">{item.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-blue-600 dark:text-blue-400">{formatPrice(item.price)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onToggleAvailability?.(item.id, !item.is_available)}
                      className="flex items-center gap-2 px-3 py-1 rounded-full font-medium transition"
                    >
                      {item.is_available ? (
                        <>
                          <ToggleRight className="text-green-600 dark:text-green-400" size={20} />
                          <span className="text-green-600 dark:text-green-400">Available</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-neutral-400 dark:text-neutral-500" size={20} />
                          <span className="text-neutral-400 dark:text-neutral-500">Out of Stock</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditItem?.(item)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => onDeleteItem?.(item.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">No menu items found</p>
        </div>
      )}
    </div>
  );
};
