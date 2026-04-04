/**
 * Order Settings
 * 
 * Configure order behavior and acceptance modes
 */

'use client';

import React, { useState } from 'react';
import { Button, Card, Radio, Input, Checkbox } from '@/components/common';
import { useToast } from '@/components/common';

export const OrderSettings: React.FC = () => {
  const { success } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    confirmationMode: 'auto', // 'auto' or 'manual'
    prepTime: 20, // minutes
    enableDineIn: true,
    enableTakeaway: true,
    enableDelivery: false,
    pauseOrders: false,
  });

  const handleRadioChange = (value: string) => {
    setFormData(prev => ({ ...prev, confirmationMode: value }));
  };

  const handleCheckboxChange = (field: keyof typeof formData) => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePrepTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(e.target.value) || 0);
    setFormData(prev => ({ ...prev, prepTime: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save to backend
      // await axios.put('/api/v1/tenants/order-settings', formData);
      success('Order settings updated successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
          📋 Order Settings
        </h1>
        <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
          Configure how orders are processed and what order types you accept.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Confirmation Mode */}
        <Card>
          <div className="space-y-4">
            <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text">
              Order Confirmation
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              How should orders be accepted?
            </p>

            <div className="space-y-3">
              <Radio
                label="Auto Accept Orders"
                name="confirmationMode"
                value="auto"
                checked={formData.confirmationMode === 'auto'}
                onChange={() => handleRadioChange('auto')}
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 ml-7">
                Orders are automatically confirmed and sent to the kitchen
              </p>

              <Radio
                label="Manually Accept Orders"
                name="confirmationMode"
                value="manual"
                checked={formData.confirmationMode === 'manual'}
                onChange={() => handleRadioChange('manual')}
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 ml-7">
                You review each order before it goes to the kitchen
              </p>
            </div>
          </div>
        </Card>

        {/* Preparation Time */}
        <Card>
          <div className="space-y-4">
            <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text">
              Preparation Time
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Estimated time customers should expect to wait
            </p>

            <div className="flex items-center gap-4">
              <Input
                type="number"
                min="1"
                max="120"
                value={formData.prepTime}
                onChange={handlePrepTimeChange}
                className="w-32"
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                minutes
              </span>
            </div>
          </div>
        </Card>

        {/* Order Types */}
        <Card>
          <div className="space-y-4">
            <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text">
              Order Types
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Which order types does your restaurant accept?
            </p>

            <div className="space-y-3">
              <Checkbox
                label="🍽️ Dine-in"
                checked={formData.enableDineIn}
                onChange={() => handleCheckboxChange('enableDineIn')}
              />

              <Checkbox
                label="🥡 Takeaway"
                checked={formData.enableTakeaway}
                onChange={() => handleCheckboxChange('enableTakeaway')}
              />

              <Checkbox
                label="🚗 Delivery"
                checked={formData.enableDelivery}
                onChange={() => handleCheckboxChange('enableDelivery')}
                disabled
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 ml-7">
                Coming soon
              </p>
            </div>
          </div>
        </Card>

        {/* Pause Orders */}
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={formData.pauseOrders}
                onChange={() => handleCheckboxChange('pauseOrders')}
              />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  ⏸️ Pause Orders Temporarily
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  Stop accepting new orders when you&apos;re busy. Customers
                  will see &quot;Temporarily Closed&quot;
                </p>
              </div>
            </label>
          </div>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={loading}>
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OrderSettings;
