'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { QRCodeDisplay } from '@/components/dashboard/QRCodeDisplay';
import { useAuth } from '@/context/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import apiClient from '@/services/apiClient';

export default function QRCodePage() {
  const { user, isLoading: authLoading, updateUser } = useAuth();
  const { hasPageAccess } = useRoleAccess();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Step 1: Wait for auth to complete
    if (authLoading) {
      return; // Still loading auth, keep isLoading as true
    }

    // Step 2: If user is not loaded, try to fetch it first before checking access
    if (!user) {
      console.log('User not in context, fetching from backend...');
      const fetchUser = async () => {
        try {
          const response = await apiClient.get('/tenants/me/profile');
          if (response.data.data) {
            const tenantData = response.data.data;
            // Reconstruct user object with tenant_id and role
            const userData = {
              ...tenantData,
              tenant_id: tenantData.id,
              role: 'TENANT_OWNER', // Default role for authenticated users accessing tenant profile
            } as any;
            updateUser(userData);
            console.log('Fetched and updated user context:', userData);
          }
        } catch (err) {
          console.error('Failed to fetch user from backend:', err);
          setIsLoading(false);
          setError('Not authenticated. Please log in.');
        }
      };
      fetchUser();
      return; // Don't proceed until user is fetched
    }

    // Step 3: Check access and exit if not authorized
    if (!hasPageAccess('qrcode')) {
      setIsLoading(false);
      return;
    }

    // Step 4: Check if we have a user with tenant_id
    if (!user?.id) {
      setIsLoading(false);
      setError('Not authenticated. Please log in.');
      return;
    }

    const loadQRCode = async () => {
      try {
        // Get user - either from context or fetch from backend
        let currentUser = user;
        
        // If tenant_id is missing, fetch full user profile from backend
        if (!currentUser?.tenant_id) {
          console.log('tenant_id missing from user object, fetching from backend...');
          try {
            const response = await apiClient.get('/tenants/me/profile');
            if (response.data.data) {
              const tenantData = response.data.data;
              // For TENANT_OWNER, merge tenant data while preserving user fields
              currentUser = {
                ...currentUser,  // Keep existing user fields (id, email, role)
                ...tenantData,   // Add tenant fields (name, slug, etc)
                tenant_id: tenantData.id,  // Map tenant id to tenant_id
                role: currentUser?.role || 'TENANT_OWNER',  // Ensure role is preserved
              };
              if (typeof window !== 'undefined') {
                localStorage.setItem('user', JSON.stringify(currentUser));
              }
              // Update React context so hasPageAccess check works
              updateUser(currentUser as any);
              console.log('Fetched full user from backend:', currentUser);
            }
          } catch (err) {
            console.error('Failed to fetch user profile from backend:', err);
          }
        }

        // If still no tenant_id, show error
        if (!currentUser?.tenant_id) {
          setError('Not authenticated. Please log in.');
          setIsLoading(false);
          return;
        }

        let slug = currentUser.slug;

        // If slug is missing, try to fetch it from backend
        if (!slug) {
          console.log('Slug missing from user object, fetching from backend...');
          try {
            const response = await apiClient.get(`/tenants/${currentUser.tenant_id}/info`);
            slug = response.data.data?.slug;
            console.log('Fetched slug from backend:', slug);
            
            if (slug) {
              const updatedUser = { ...currentUser, slug };
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          } catch (err) {
            console.error('Failed to fetch tenant slug:', err);
          }
        }

        console.log('User data loaded:', { name: currentUser.name, slug });

        if (!slug) {
          console.error('Could not get slug for user:', currentUser);
          setError('Unable to retrieve restaurant slug. Please refresh the page or log out and log back in.');
          setQrUrl('');
          setIsLoading(false);
          return;
        }
        
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        
        const menuUrl = `${protocol}//${hostname}${port}/menu/${slug}`;
        console.log('Generated QR URL:', menuUrl);
        
        setQrUrl(menuUrl);
        setError('');
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load QR code:', err);
        setError(`Failed to generate QR code: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setQrUrl('');
        setIsLoading(false);
      }
    };

    loadQRCode();
    // Only depend on authLoading and user's tenant_id - primitive values only
  }, [authLoading, user?.tenant_id]);

  // Check access - after hooks
  if (!hasPageAccess('qrcode')) {
    return (
      <DashboardLayout>
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Only Managers and Owners can manage QR codes.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600 text-lg">Loading QR code...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !qrUrl) {
    const handleRetry = () => {
      setError('');
      setQrUrl('');
      setIsLoading(true);
    };

    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-red-900 mb-2">Error</h3>
            <p className="text-red-700 mb-4">{error || 'Failed to generate QR code'}</p>
            
            {/* Debug Info */}
            <div className="bg-red-100 p-3 rounded text-sm text-red-800 font-mono mb-4">
              <p><strong>User:</strong> {user?.name || 'Not loaded'}</p>
              <p><strong>Slug:</strong> {user?.slug || 'Not available'}</p>
              <p><strong>Tenant ID:</strong> {user?.tenant_id || 'Not available'}</p>
            </div>

            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-900 mb-2">Try these steps:</h4>
            <ol className="space-y-2 text-blue-800 list-decimal list-inside text-sm">
              <li>Click "Try Again" above</li>
              <li>Refresh the page (F5)</li>
              <li>Make sure you're logged in</li>
              <li>If the problem persists, log out and log back in</li>
              <li>Check the browser console (F12) for detailed error messages</li>
            </ol>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <QRCodeDisplay
        qrUrl={qrUrl}
        restaurantName={user?.name || 'Restaurant'}
        restaurantSlug={user?.slug || 'restaurant'}
      />
    </DashboardLayout>
  );
}
