'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/services/apiClient';
import Link from 'next/link';

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  // Get challenge info from session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedChallengeId = sessionStorage.getItem('challengeId');
      const storedEmail = sessionStorage.getItem('userEmail');

      if (!storedChallengeId || !storedEmail) {
        setError('Session expired. Please login again.');
        router.push('/auth/login');
        return;
      }

      setChallengeId(storedChallengeId);
      setUserEmail(storedEmail);
    }
  }, [router]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!otp || otp.length !== 6) {
        setError('Please enter a valid 6-digit code');
        setIsLoading(false);
        return;
      }

      console.log('[VerifyOTP] Verifying OTP for challenge:', challengeId);
      const response = await apiClient.post('/auth/verify-otp', {
        challenge_id: challengeId,
        otp_code: otp,
      });

      console.log('[VerifyOTP] Full Response:', JSON.stringify(response.data, null, 2));

      // Handle both response formats
      const access_token = response.data.access_token || response.data.data?.access_token;
      const user = response.data.user || response.data.data?.user;
      
      if (access_token && user) {
        console.log('[VerifyOTP] OTP verified successfully');
        // Store token and user
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(user));
        document.cookie = `token=${access_token}; path=/; max-age=${7 * 24 * 60 * 60}`;
        
        // Clear session storage
        sessionStorage.removeItem('challengeId');
        sessionStorage.removeItem('userEmail');
        sessionStorage.removeItem('expiresAt');

        setSuccess('OTP verified! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err) {
      console.error('[VerifyOTP] Error:', err);
      if (err instanceof Error) {
        // Check if it's a specific backend error
        if (err.message.includes('expired')) {
          setError('OTP has expired. Please request a new one.');
        } else if (err.message.includes('invalid') || err.message.includes('incorrect')) {
          setError('Invalid OTP. Please try again.');
        } else {
          setError(err.message || 'Verification failed');
        }
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    setResendLoading(true);

    try {
      console.log('[VerifyOTP] Requesting new OTP');
      const response = await apiClient.post('/auth/resend-otp', {
        challenge_id: challengeId,
      });

      console.log('[VerifyOTP] Resend response:', response.data);
      setSuccess('New OTP sent to your email. Please check your inbox.');
      setOtp('');
      setCountdown(30); // 30 second cooldown
    } catch (err) {
      console.error('[VerifyOTP] Resend error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
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
            <span className="text-2xl font-bold text-white">✓</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-info-600 bg-clip-text text-transparent">RESTOPI</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2 text-lg font-medium">Verify Your Identity</p>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-gradient-to-br from-info-50 to-info-100 dark:from-info-950 dark:to-info-900 border border-info-200 dark:border-info-800 rounded-xl">
          <p className="text-sm text-info-900 dark:text-info-200 font-medium">
            We've sent a 6-digit code to <strong>{userEmail}</strong>
          </p>
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
        <form onSubmit={handleVerify} className="space-y-6">
          {/* OTP Input */}
          <div>
            <label htmlFor="otp" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              Verification Code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-4 text-center text-3xl tracking-[0.5em] font-mono border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none disabled:opacity-60"
              disabled={isLoading || resendLoading}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center">Enter the 6-digit code</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || resendLoading || otp.length !== 6}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 hover:shadow-lg disabled:from-neutral-300 disabled:to-neutral-400 disabled:text-neutral-500 disabled:cursor-not-allowed transition-all duration-250 shadow-md hover:shadow-hover active:scale-95 flex items-center justify-center gap-2"
          >
            {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        {/* Resend Button */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Didn't receive the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || isLoading || countdown > 0}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
          </button>
        </div>

        {/* Back to Login */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-center text-sm text-neutral-700 dark:text-neutral-300">
            <Link href="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold">
              Back to Login
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            RESTOPI © 2026 | QR-Based Restaurant Ordering Platform
          </p>
        </div>
      </div>
    </div>
  );
}
