'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/services/apiClient';

export default function AcceptInvitationPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [invitationData, setInvitationData] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;
  const tenantId = searchParams?.get('tenantId') ?? null;

  // Validate invitation token on mount
  useEffect(() => {
    if (!token || !tenantId) {
      setError('Invalid invitation link. Missing token or tenant ID.');
      setIsValidating(false);
      return;
    }

    // In a real app, you'd validate the token with the backend
    // For now, we'll just check it exists
    setInvitationData({ token, tenantId });
    setIsValidating(false);
  }, [token, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (!password || !confirmPassword) {
        setError('Both password fields are required');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      // Accept invitation
      console.log('[AcceptInvitation] Accepting invitation with token:', token);
      const response = await apiClient.post('/staff/accept-invitation', {
        token: token,
        password: password,
        tenantId: tenantId,
      });

      console.log('[AcceptInvitation] Success:', response.data);
      setSuccess('Invitation accepted! Redirecting to login...');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login?message=invitation_accepted');
      }, 2000);
    } catch (err: any) {
      console.error('[AcceptInvitation] Error:', err);
      const errorMessage = 
        err.response?.data?.message || 
        err.message || 
        'Failed to accept invitation';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!token || !tenantId || error === 'Invalid invitation link. Missing token or tenant ID.') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-gray-900">Invalid Invitation</h1>
          </div>

          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">
              This invitation link is missing required information. Please check the email you received and try again.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="block w-full text-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DineFlow</h1>
          <p className="text-gray-600 mt-2">Complete Your Staff Account Setup</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Set Your Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              disabled={isLoading}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              disabled={isLoading}
            />
          </div>

          {/* Password Requirements */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs font-medium text-blue-900 mb-2">Password Requirements:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li className={password.length >= 6 ? 'line-through text-green-600' : ''}>
                ✓ At least 6 characters
              </li>
              <li className={password === confirmPassword && password.length > 0 ? 'line-through text-green-600' : ''}>
                ✓ Passwords match
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Setting up account...' : 'Complete Setup'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-purple-500 hover:text-purple-600 font-medium">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
