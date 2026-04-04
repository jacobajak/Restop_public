'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DineFlow</h1>
          <p className="text-gray-600 mt-2">Restaurant Dashboard Login</p>
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

        {/* Info Box - How to Login */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 font-medium mb-2">👤 How to Login</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>🏢 Restaurant Owners:</strong> Use your registration email</li>
            <li><strong>💼 Staff Members:</strong> Use the email from your invitation</li>
          </ul>
          <p className="text-xs text-blue-700 mt-3">
            New staff? <Link href="/staff-invitation" className="underline hover:text-blue-600">Accept your invitation here →</Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              isLoading
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Register now
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-xs text-gray-500">
            DineFlow © 2026 | QR-Based Restaurant Ordering
          </p>
        </div>
      </div>
    </div>
  );
}
