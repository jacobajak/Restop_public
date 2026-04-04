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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DineFlow</h1>
          <p className="text-gray-600 mt-2">Verify Your Identity</p>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            We've sent a 6-digit verification code to <strong>{userEmail}</strong>
          </p>
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
        <form onSubmit={handleVerify} className="space-y-4">
          {/* OTP Input */}
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              disabled={isLoading || resendLoading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || resendLoading || otp.length !== 6}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              isLoading || resendLoading || otp.length !== 6
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        {/* Resend Button */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Didn't receive the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || isLoading || countdown > 0}
            className={`text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors ${
              resendLoading || isLoading || countdown > 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
          </button>
        </div>

        {/* Back to Login */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Back to Login
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-center text-xs text-gray-500">
            DineFlow © 2026 | QR-Based Restaurant Ordering
          </p>
        </div>
      </div>
    </div>
  );
}
