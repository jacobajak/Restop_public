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
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={onAddItem}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-orange-600 transition font-medium"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Price</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600 line-clamp-1">{item.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-primary">{formatPrice(item.price)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onToggleAvailability?.(item.id, !item.is_available)}
                      className="flex items-center gap-2 px-3 py-1 rounded-full font-medium transition"
                    >
                      {item.is_available ? (
                        <>
                          <ToggleRight className="text-green-600" size={20} />
                          <span className="text-green-600">Available</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="text-gray-400" size={20} />
                          <span className="text-gray-400">Out of Stock</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditItem?.(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => onDeleteItem?.(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 text-lg">No menu items found</p>
        </div>
      )}
    </div>
  );
};
