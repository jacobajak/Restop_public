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
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-info-600 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse-soft"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-br from-primary-500 to-info-600 mb-4 mx-auto">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!token || !tenantId || error === 'Invalid invitation link. Missing token or tenant ID.') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-info-600 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse-soft"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔗</div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Invalid Invitation</h1>
          </div>

          <div className="mb-6 p-4 bg-error-50 dark:bg-error-950 border border-error-200 dark:border-error-800 rounded-xl">
            <p className="text-error-700 dark:text-error-300 text-sm font-medium">
              This invitation link is missing required information. Please check your email and try again.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="block w-full text-center px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all duration-250 shadow-md hover:shadow-lg font-semibold"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-info-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse-soft"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }}></div>
      
      {/* Main card */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-8 backdrop-blur-sm border border-white/20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-info-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">👤</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-info-600 bg-clip-text text-transparent">RESTOPI</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2 text-lg font-medium">Complete Your Staff Setup</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-error-950 border border-error-200 dark:border-error-800 rounded-xl animate-slide-in">
            <p className="text-error-700 dark:text-error-300 font-medium flex items-center gap-2">
              <span className="text-lg">⚠️</span> {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-success-50 dark:bg-success-950 border border-success-200 dark:border-success-800 rounded-xl animate-slide-in">
            <p className="text-success-700 dark:text-success-300 font-medium flex items-center gap-2">
              <span className="text-lg">✅</span> {success}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Set Your Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Password Requirements */}
          <div className="bg-gradient-to-br from-info-50 to-info-100 dark:from-info-950 dark:to-info-900 p-4 rounded-xl border border-info-200 dark:border-info-800">
            <p className="text-xs font-semibold text-info-900 dark:text-info-200 mb-3">✓ Password Requirements:</p>
            <ul className="text-xs text-info-800 dark:text-info-300 space-y-2">
              <li className={`flex items-center gap-2 ${password.length >= 6 ? 'text-success-600 dark:text-success-400 font-semibold' : ''}`}>
                <span className="text-lg">✓</span> At least 6 characters
              </li>
              <li className={`flex items-center gap-2 ${password === confirmPassword && password.length > 0 ? 'text-success-600 dark:text-success-400 font-semibold' : ''}`}>
                <span className="text-lg">✓</span> Passwords match
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="w-full px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all duration-250 disabled:from-neutral-300 disabled:to-neutral-400 disabled:text-neutral-500 disabled:cursor-not-allowed shadow-md hover:shadow-lg font-semibold active:scale-95"
          >
            {isLoading ? 'Setting up account...' : 'Complete Setup'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700 text-center">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
