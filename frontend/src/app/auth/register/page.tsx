'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/services/apiClient';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    slug: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Auto-generate slug from restaurant name
    if (name === 'restaurantName') {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormData((prev) => ({
        ...prev,
        slug: autoSlug,
      }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Full name is required');
      return false;
    }

    if (formData.name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return false;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (!formData.restaurantName.trim()) {
      setError('Restaurant name is required');
      return false;
    }

    if (!formData.slug.trim()) {
      setError('Restaurant slug is required');
      return false;
    }

    if (formData.slug.length < 3) {
      setError('Slug must be at least 3 characters');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      // Register user with TENANT_OWNER role (creates new tenant)
      const response = await apiClient.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'TENANT_OWNER',
        tenant_name: formData.restaurantName,
        tenant_slug: formData.slug,
      });

      // Registration successful - redirect to login with pre-filled email
      // The response structure is { success: true, data: { success: true, email, requiresLogin } }
      const registrationData = response.data.data || response.data;
      if (registrationData.requiresLogin || registrationData.success) {
        console.log('[Register] Registration successful, redirecting to login');
        router.push('/auth/login?email=' + encodeURIComponent(formData.email) + '&message=reg_success');
      } else {
        // Fallback: redirect to login if response structure is unexpected
        console.log('[Register] Unexpected response structure, redirecting to login');
        router.push('/auth/login?email=' + encodeURIComponent(formData.email) + '&message=reg_success');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Registration failed';
      setError(errorMessage);
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-info-600 bg-clip-text text-transparent">RESTOPI</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2 text-lg font-medium">Create Your Restaurant</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-error-50 dark:bg-error-950 border border-error-200 dark:border-error-800 rounded-xl animate-slide-in">
            <p className="text-error-700 dark:text-error-300 font-medium flex items-center gap-2">
              <span className="text-lg">⚠️</span> {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="John Restaurant Owner"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Restaurant Name */}
          <div>
            <label htmlFor="restaurantName" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Restaurant Name
            </label>
            <input
              id="restaurantName"
              type="text"
              name="restaurantName"
              value={formData.restaurantName}
              onChange={handleInputChange}
              placeholder="Your Restaurant Name"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="slug" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Restaurant URL Slug
            </label>
            <input
              id="slug"
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              placeholder="restaurant-name"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Used in your restaurant URL: app.restopi.io/menu/{formData.slug}</p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="owner@restaurant.com"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              className="w-full px-4 py-3 border-b-2 border-b-neutral-200 dark:border-b-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-b-primary-500 focus:shadow-lg focus:shadow-primary-100/50 dark:focus:shadow-primary-900/20 transition-all duration-250 focus:outline-none"
              disabled={isLoading}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">At least 8 characters recommended</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
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
            {isLoading ? 'Creating Account...' : 'Create Account'}
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

        {/* Login Link */}
        <div className="mt-8 text-center">
          <p className="text-neutral-700 dark:text-neutral-300 text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold transition-colors">
              Login here
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            RESTOPI © 2026 | QR-Based Restaurant Ordering Platform
          </p>
        </div>
      </div>
    </div>
  );
}
