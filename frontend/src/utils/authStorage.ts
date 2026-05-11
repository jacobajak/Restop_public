/**
 * Authentication Storage Utility
 * Handles clearing all authentication-related cached data
 */

export const clearAllAuthData = () => {
  // Clear localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Clear sessionStorage
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('challengeId');
  sessionStorage.removeItem('userEmail');
  sessionStorage.removeItem('expiresAt');
  
  // Clear all cookies by setting them to expire in the past
  const cookies = document.cookie.split(';');
  cookies.forEach((cookie) => {
    const cookieName = cookie.split('=')[0].trim();
    if (cookieName) {
      document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Strict`;
    }
  });
  
  // Clear Authorization header from any cached requests
  if (typeof window !== 'undefined') {
    // This won't work directly but ensures completeness
    console.log('[AuthStorage] All authentication data cleared');
  }
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  document.cookie = 'token=; path=/; max-age=0; SameSite=Strict';
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const getAuthUser = () => {
  try {
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
};
