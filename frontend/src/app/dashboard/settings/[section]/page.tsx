/**
 * Settings Main Page
 * Dynamic routing for settings sections
 */

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { SettingsLayout } from '@/components/settings';
import { RestaurantProfileSettings } from '@/components/settings/RestaurantProfileSettings';
import { OperatingHoursSettings } from '@/components/settings/OperatingHoursSettings';
import { OrderSettings } from '@/components/settings/OrderSettings';
import { TablesSettings } from '@/components/settings/TablesSettings';
import { PaymentSettings } from '@/components/settings/PaymentSettings';
import { StaffAccessSettings } from '@/components/settings/StaffAccessSettings';
import { StaffManagementSettings } from '@/components/settings/StaffManagementSettings';
import { CountryCurrencySettings } from '@/components/settings/CountryCurrencySettings';

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  profile: RestaurantProfileSettings,
  country: CountryCurrencySettings,
  hours: OperatingHoursSettings,
  orders: OrderSettings,
  tables: TablesSettings,
  payment: PaymentSettings,
  staff: StaffManagementSettings,
};

export default function SettingsPage() {
  const params = useParams();
  const section = (params?.section as string) || 'profile';

  const Component = SECTION_COMPONENTS[section];

  if (!Component) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg">
        <div className="mx-auto max-w-7xl p-8">
          <p className="text-neutral-600 dark:text-neutral-400">
            Section not found. Please select a valid settings section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-4">
          <SettingsLayout activeSection={section} />
          <main className="lg:col-span-3 p-6 lg:p-8">
            <div className="bg-white dark:bg-dark-card rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 lg:p-8">
              <Component />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
