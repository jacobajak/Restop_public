import React, { ReactNode } from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import { redirect } from 'next/navigation';

interface ProtectedContentProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ProtectedContent - Conditionally renders content based on user role
 * If user doesn't have access, shows fallback or nothing
 */
export const ProtectedContent: React.FC<ProtectedContentProps> = ({
  featureKey,
  children,
  fallback,
}) => {
  const { hasFeatureAccess } = useRoleAccess();

  if (!hasFeatureAccess(featureKey)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

interface ProtectedPageProps {
  pageKey: string;
  children: ReactNode;
}

/**
 * ProtectedPage - Wrapper for pages that checks access before rendering
 * Redirects to dashboard if user doesn't have access
 */
export const ProtectedPage: React.FC<ProtectedPageProps> = ({
  pageKey,
  children,
}) => {
  const { hasPageAccess } = useRoleAccess();

  // This component should be used in client components
  // For server-side page protection, handle in page.tsx directly
  if (!hasPageAccess(pageKey)) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg">
        <div className="mx-auto max-w-7xl p-8">
          <Card className="text-center py-12">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
              Access Denied
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              You don't have permission to access this page.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </a>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

interface RoleBasedProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * RoleBased - Generic component for role-based rendering
 */
export const RoleBased: React.FC<RoleBasedProps> = ({
  allowedRoles,
  children,
  fallback,
}) => {
  const { userRole } = useRoleAccess();

  if (!userRole || !allowedRoles.includes(userRole)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};
