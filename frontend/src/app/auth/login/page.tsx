'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { clearAllAuthData } from '@/utils/authStorage';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    // Check if coming from registration
    const message = searchParams?.get('message');
    const emailParam = searchParams?.get('email');
    
    if (message === 'reg_success') {
      setSuccess('Account created successfully! Please sign in with your credentials.');
    }
    
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (!email || !password) {
        setError('Email and password are required');
        setIsLoading(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setIsLoading(false);
        return;
      }

      // Call login
      console.log('[Login] Attempting login with:', email);
      
      // Import apiClient directly to get the raw response
      const { default: apiClient } = await import('@/services/apiClient');
      const response = await apiClient.post('/auth/login', { email, password });
      
      console.log('[Login] Response:', response.data);
      
      // Check if JWT token is returned directly (2FA disabled)
      if (response.data.access_token || response.data.data?.access_token) {
        console.log('[Login] JWT token received directly, storing and redirecting');
        
        const token = response.data.access_token || response.data.data.access_token;
        const user = response.data.user || response.data.data.user;
        
        // Store token and user info
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // Store token in cookies for middleware authentication
        document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
        
        // Redirect based on user role
        const redirectUrl = user.role === 'PLATFORM_ADMIN' ? '/admin/overview' : '/dashboard';
        console.log('[Login] Redirecting to:', redirectUrl);
        router.push(redirectUrl);
        return;
      }
      
      // Check if 2FA is required (for future use)
      if (response.data.requires_2fa && response.data.challenge_id) {
        console.log('[Login] 2FA required, redirecting to OTP verification');
        // Store challenge info in sessionStorage for the OTP page
        sessionStorage.setItem('challengeId', response.data.challenge_id);
        sessionStorage.setItem('userEmail', response.data.email);
        sessionStorage.setItem('expiresAt', response.data.expires_at);
        router.push('/auth/verify-otp');
        return;
      }
      
      // Try the normal login flow via useAuth hook
      const success = await login(email, password);
      console.log('[Login] Login result:', success);
      
      if (success) {
        console.log('[Login] Login successful, redirecting to dashboard');
        router.push('/dashboard');
      } else {
        console.error('[Login] Login failed - check backend response or credentials');
        setError('Login failed. Check your credentials or try again.');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

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
            <span className="text-2xl font-bold text-white">R</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-info-600 bg-clip-text text-transparent">RESTOP</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2 text-lg font-medium">Restaurant Dashboard</p>
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

        {/* Info Box */}
        <div className="mb-8 p-4 bg-gradient-to-br from-info-50 to-info-100 dark:from-info-950 dark:to-info-900 border border-info-200 dark:border-info-800 rounded-xl">
          <p className="text-sm text-info-900 dark:text-info-200 font-semibold mb-3 flex items-center gap-2">
            <span className="text-lg">👤</span> How to Login
          </p>
          <ul className="text-sm text-info-800 dark:text-info-300 space-y-2">
            <li className="flex items-start gap-2"><span className="text-lg">🏢</span> <span><strong>Owners:</strong> Use registration email</span></li>
            <li className="flex items-start gap-2"><span className="text-lg">👨‍💼</span> <span><strong>Staff:</strong> Use invitation email</span></li>
          </ul>
          <p className="text-xs text-info-700 dark:text-info-400 mt-3 font-medium">
            New staff? <Link href="/staff-invitation" className="underline hover:text-info-600 dark:hover:text-info-300 font-semibold">Accept invitation →</Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 hover:shadow-lg disabled:from-neutral-300 disabled:to-neutral-400 disabled:text-neutral-500 disabled:cursor-not-allowed transition-all duration-250 shadow-md hover:shadow-hover active:scale-95 flex items-center justify-center gap-2"
          >
            {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200 dark:border-neutral-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 font-medium">or</span>
          </div>
        </div>

        {/* Register Link */}
        <div className="mt-8 text-center">
          <p className="text-neutral-700 dark:text-neutral-300 text-sm">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold transition-colors">
              Register now
            </Link>
          </p>
        </div>

        {/* Clear Cache Option */}
        <div className="mt-6 p-4 bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-950 dark:to-warning-900 border border-warning-200 dark:border-warning-800 rounded-xl">
          <p className="text-xs text-warning-900 dark:text-warning-200 mb-3 font-semibold">
            <strong>⚠️ Having login issues?</strong> Clear cache to restart fresh:
          </p>
          <button
            type="button"
            onClick={() => {
              clearAllAuthData();
              window.location.reload();
            }}
            className="w-full px-3 py-2 bg-warning-500 hover:bg-warning-600 text-white rounded-lg text-xs font-semibold transition-all duration-250 shadow-sm hover:shadow-md active:scale-95"
          >
            🔄 Clear Cache & Refresh
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            RESTOP © 2026 | QR-Based Restaurant Ordering Platform
          </p>
        </div>
      </div>
    </div>
  );
}
