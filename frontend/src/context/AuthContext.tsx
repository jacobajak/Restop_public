'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types';
import apiClient from '@/services/apiClient';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshToken: () => Promise<boolean>;
  clearAuth: () => void; // Safe way to clear auth without API call
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage and cookies
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      // Also check if token exists in cookies
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      const token = savedToken || cookieToken;

      console.log('[AuthContext] Initializing from storage - token:', !!token, 'user:', !!savedUser);

      if (token) {
        setToken(token);
        // Sync token to localStorage if it was in cookies
        if (!savedToken && cookieToken) {
          localStorage.setItem('token', cookieToken);
        }
      }
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Failed to parse saved user:', e);
          localStorage.removeItem('user');
        }
      }
    }
    console.log('[AuthContext] Initialization complete, setting isLoading to false');
    setIsLoading(false);
  }, []);

  const storeToken = (newToken: string) => {
    localStorage.setItem('token', newToken);
    document.cookie = `token=${newToken}; path=/; max-age=${7 * 24 * 60 * 60}`;
    setToken(newToken);
  };

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('[AuthContext] Attempting login for:', email);
      const response = await apiClient.post('/auth/login', { email, password });
      
      console.log('[AuthContext] Full login response:', response);
      console.log('[AuthContext] Response data:', response.data);
      console.log('[AuthContext] Response data.data:', response.data.data);
      
      if (response.data.data?.access_token && response.data.data?.user) {
        console.log('[AuthContext] Login successful, storing token and user');
        console.log('[AuthContext] Token:', response.data.data.access_token);
        console.log('[AuthContext] User:', response.data.data.user);
        storeToken(response.data.data.access_token);
        setUser(response.data.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        console.log('[AuthContext] Login complete - token stored, user set');
        return true;
      }
      console.log('[AuthContext] Login failed - missing token or user in response');
      console.log('[AuthContext] Response structure:', { hasData: !!response.data.data, hasToken: !!response.data.data?.access_token, hasUser: !!response.data.data?.user });
      return false;
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      if (error instanceof Error) {
        console.error('[AuthContext] Error message:', error.message);
      }
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Optional: Call logout endpoint to invalidate token on backend
      await apiClient.post('/auth/logout').catch(() => {
        // Ignore logout API errors
      });
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.cookie = 'token=; path=/; max-age=0';
      // Clear apiClient default auth header
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.post('/auth/refresh');
      
      if (response.data.data?.access_token) {
        storeToken(response.data.data.access_token);
        if (response.data.data.user) {
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  }, [logout]);

  const clearAuth = useCallback(() => {
    // Clear auth without making API calls (use when backend is unreachable)
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; max-age=0';
    delete apiClient.defaults.headers.common['Authorization'];
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        updateUser,
        refreshToken,
        clearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
