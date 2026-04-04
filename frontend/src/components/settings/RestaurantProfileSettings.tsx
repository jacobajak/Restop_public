/**
 * Restaurant Profile Settings
 * 
 * Configure restaurant identity and contact information
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea, Card } from '@/components/common';
import { useToast } from '@/components/common';
import apiClient from '@/services/apiClient';

export const RestaurantProfileSettings: React.FC = () => {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    description: '',
  });

  useEffect(() => {
    // Load tenant data
    const loadTenantData = async () => {
      try {
        const response = await apiClient.get('/tenants/me/profile');

        if (response.data.data) {
          setFormData({
            name: response.data.data.name || '',
            phone: response.data.data.phone || '',
            email: response.data.data.email || '',
            address: response.data.data.address || '',
            city: response.data.data.city || '',
            country: response.data.data.country || '',
            description: response.data.data.description || '',
          });
        }
      } catch (err) {
        console.error('Failed to load tenant data:', err);
      }
    };

    loadTenantData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post('/tenants/me/profile', formData);
      success('Restaurant profile updated successfully!');
    } catch (err: any) {
      console.error('Failed to update restaurant profile:', err);
      const errorMsg = err.response?.data?.message || 'Failed to update restaurant profile';
      error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
          🏪 Restaurant Profile
        </h1>
        <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
          Update your restaurant&apos;s basic information used across the platform.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="space-y-4">
            <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text">
              Basic Information
            </h2>

            <Input
              label="Restaurant Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Kigali Bites"
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+250 788 000 000"
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@restaurant.com"
              />
            </div>

            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your restaurant..."
              rows={3}
            />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text">
              Location
            </h2>

            <Input
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street address"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g., Kigali"
              />
              <Input
                label="Country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="e.g., Rwanda"
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RestaurantProfileSettings;
