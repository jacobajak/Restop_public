'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { QRCodeDisplay } from '@/components/dashboard/QRCodeDisplay';
import { useAuth } from '@/context/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Card } from '@/components/common';
import apiClient from '@/services/apiClient';

export default function QRCodePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { hasPageAccess } = useRoleAccess();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!hasPageAccess('qrcode')) {
      setIsLoading(false);
      return;
    }

    const loadQRCode = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        console.log('Auth still loading...');
        return;
      }

      // If auth finished loading but no user, redirect to login
      if (!user || !user.tenant_id) {
        console.error('No user found, redirecting to login');
        setError('Not authenticated. Please log in.');
        setIsLoading(false);
        return;
      }

      try {
        let slug = user.slug;

        // If slug is missing, try to fetch it from backend
        if (!slug) {
          console.log('Slug missing from user object, fetching from backend...');
          try {
            const response = await apiClient.get(`/tenants/${user.tenant_id}/info`);
            slug = response.data.data?.slug;
            console.log('Fetched slug from backend:', slug);
            
            // Update user object in localStorage with the slug
            if (slug) {
              const updatedUser = { ...user, slug };
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          } catch (err) {
            console.error('Failed to fetch tenant slug:', err);
          }
        }

        // Log user data for debugging
        console.log('User data loaded:', { name: user.name, slug });

        if (!slug) {
          console.error('Could not get slug for user:', user);
          setError('Unable to retrieve restaurant slug. Please refresh the page or log out and log back in.');
          setQrUrl('');
          setIsLoading(false);
          return;
        }
        
        // Generate menu URL based on current location
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
  }, [authLoading, user]);

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
