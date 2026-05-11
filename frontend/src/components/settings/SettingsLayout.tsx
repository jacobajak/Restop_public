/**
 * Settings Layout
 * 
 * Sidebar navigation for settings sections with role-based access
 */

'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: string;
  requiredRoles: string[];
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'profile',
    label: 'Restaurant Profile',
    description: 'Update your restaurant information',
    icon: '🏪',
    requiredRoles: ['TENANT_OWNER', 'TENANT_MANAGER'],
  },
  {
    id: 'country',
    label: 'Country & Currency',
    description: 'Select operating country and currency',
    icon: '🌍',
    requiredRoles: ['TENANT_OWNER'],
  },
  {
    id: 'hours',
    label: 'Operating Hours',
    description: 'Manage when you accept orders',
    icon: '🕐',
    requiredRoles: ['TENANT_OWNER', 'TENANT_MANAGER'],
  },
  {
    id: 'orders',
    label: 'Order Settings',
    description: 'Configure order behavior',
    icon: '📋',
    requiredRoles: ['TENANT_OWNER', 'TENANT_MANAGER'],
  },
  {
    id: 'tables',
    label: 'Tables',
    description: 'Manage QR codes and tables',
    icon: '📊',
    requiredRoles: ['TENANT_OWNER', 'TENANT_MANAGER'],
  },
  {
    id: 'payment',
    label: 'Payment Methods',
    description: 'Configure payment options',
    icon: '💳',
    requiredRoles: ['TENANT_OWNER'],
  },
  {
    id: 'staff',
    label: 'Staff Access',
    description: 'Manage team members',
    icon: '👥',
    requiredRoles: ['TENANT_OWNER', 'TENANT_MANAGER'],
  },
];

interface SettingsLayoutProps {
  activeSection?: string;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  activeSection = 'profile',
}) => {
  const { userRole } = useRoleAccess();

  // Filter sections based on user role
  const visibleSections = useMemo(() => {
    return SETTINGS_SECTIONS.filter(section =>
      section.requiredRoles.includes(userRole as string)
    );
  }, [userRole]);

  return (
    <aside className="border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-dark-card">
      <div className="sticky top-0 p-6">
        <h2 className="text-sectionTitle font-bold text-neutral-900 dark:text-dark-text mb-6">
          Settings
        </h2>

        <nav className="space-y-2">
          {visibleSections.map(section => {
            const isActive = activeSection === section.id;

            return (
              <Link
                key={section.id}
                href={`/dashboard/settings/${section.id}`}
                className={`
                  block px-4 py-3 rounded-lg transition-colors
                  ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-950 border-l-4 border-primary-500'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{section.icon}</span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        isActive
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-neutral-900 dark:text-neutral-300'
                      }`}
                    >
                      {section.label}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {section.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {visibleSections.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-neutral-500">
              No settings available for your role
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
