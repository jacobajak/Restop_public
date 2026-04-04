'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { MenuManagement } from '@/components/dashboard/MenuManagement';
import { MenuItem } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import apiClient from '@/services/apiClient';

export default function MenuPage() {
  const { user } = useAuth();
  const { hasPageAccess } = useRoleAccess();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Other',
    image_url: '',
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load menu items
  useEffect(() => {
    const loadMenuItems = async () => {
      if (!user?.tenant_id) return;
      
      try {
        setIsLoading(true);
        const response = await apiClient.get('/menu');
        setItems(response.data.data || []);
      } catch (error) {
        console.error('Failed to load menu items:', error);
        setMessage({ type: 'error', text: 'Failed to load menu items' });
      } finally {
        setIsLoading(false);
      }
    };

    loadMenuItems();
  }, [user?.tenant_id]);

  // Check access - must be after all hooks
  if (!hasPageAccess('menu')) {
    return (
      <DashboardLayout>
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Only Managers and Owners can manage the menu.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({ name: '', description: '', price: '', category: 'Other', image_url: '' });
    setImagePreview(null);
    setShowModal(true);
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category_id || 'Other',
      image_url: item.image_url || '',
    });
    setImagePreview(item.image_url || null);
    setShowModal(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await apiClient.delete(`/menu/items/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMessage({ type: 'success', text: 'Item deleted successfully' });
    } catch (error) {
      console.error('Failed to delete item:', error);
      setMessage({ type: 'error', text: 'Failed to delete item' });
    }
  };

  const handleToggleAvailability = async (id: string, available: boolean) => {
    try {
      await apiClient.patch(`/menu/items/${id}/availability`, { is_available: available });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_available: available } : item
        )
      );
    } catch (error) {
      console.error('Failed to toggle availability:', error);
      setMessage({ type: 'error', text: 'Failed to update item' });
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setFormData((prev) => ({ ...prev, image_url: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        ...(formData.image_url && { image_url: formData.image_url }),
      };

      if (editingItem) {
        // Update existing item
        const response = await apiClient.put(`/menu/items/${editingItem.id}`, payload);
        setItems((prev) =>
          prev.map((item) => (item.id === editingItem.id ? response.data.data : item))
        );
        setMessage({ type: 'success', text: 'Item updated successfully' });
      } else {
        // Create new item
        const response = await apiClient.post('/menu/items', payload);
        setItems((prev) => [...prev, response.data.data]);
        setMessage({ type: 'success', text: 'Item added successfully' });
      }

      setShowModal(false);
      setFormData({ name: '', description: '', price: '', category: 'Other', image_url: '' });
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to save item';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <MenuManagement
        items={items}
        onAddItem={handleAddItem}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
        onToggleAvailability={handleToggleAvailability}
      />

      {/* Add/Edit Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="e.g., Margherita Pizza"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Item description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (RWF) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleFormChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option>Pizza</option>
                    <option>Burger</option>
                    <option>Pasta</option>
                    <option>Salad</option>
                    <option>Drink</option>
                    <option>Dessert</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image (Optional)
              </label>
              <div className="space-y-3">
                {/* Image Preview */}
                {imagePreview && (
                  <div className="mb-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setFormData((prev) => ({ ...prev, image_url: '' }));
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-800"
                    >
                      Remove Image
                    </button>
                  </div>
                )}

                {/* File Upload */}
                <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-orange-500 transition">
                  <label className="flex flex-col items-center cursor-pointer w-full">
                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-600">Click to upload or drag & drop</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG, GIF (max 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* URL Option */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 text-xs">or</span>
                  </div>
                  <input
                    type="text"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleFormChange}
                    placeholder="Paste image URL here"
                    className="w-full px-3 py-2 pl-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : (editingItem ? 'Update' : 'Add')} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
