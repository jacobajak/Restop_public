/**
 * Axios API Client with Token Management
 * 
 * This module provides a pre-configured Axios instance for all API communication:
 * - Automatically injects JWT tokens from localStorage
 * - Handles token refresh on 401 (Unauthorized) responses
 * - Implements token queue system to prevent race conditions during refresh
 * - Persists new tokens to both localStorage and cookies
 * - Redirects to login if token refresh fails
 * 
 * @module apiClient
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Configured Axios instance for API communication
 * @type {AxiosInstance}
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Include cookies in requests for credential sharing
  withCredentials: true,
});

/**
 * Flag to track if token refresh is in progress
 * Prevents multiple simultaneous refresh requests
 * @type {boolean}
 */
let isRefreshing = false;

/**
 * Queue of failed requests waiting for token refresh
 * When refresh succeeds, all queued requests are retried
 * @type {Array<{ resolve, reject }>}
 */
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

/**
 * Process queued requests after token refresh
 * @param {AxiosError} error - Error from refresh attempt, null if successful
 */
const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      // Reject failed requests with error
      prom.reject(error);
    } else {
      // Resolve successfully refreshed requests
      prom.resolve(null);
    }
  });
  // Clear queue after processing
  failedQueue = [];
};

/**
 * Request Interceptor: Attach JWT Token
 * 
 * Runs on every outgoing request:
 * - Retrieves JWT token from localStorage (set after login)
 * - Adds token to Authorization header if present
 * - Allows requests without token (for public endpoints)
 */
apiClient.interceptors.request.use((config) => {
  // Retrieve token from browser storage (client-side only)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  // Add Bearer token to Authorization header if available
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

/**
 * Response Interceptor: Handle 401 & Token Refresh
 * 
 * Handles authentication failures with automatic recovery:
 * 1. Detects 401 (Unauthorized) responses
 * 2. If already refreshing, queues request and waits
 * 3. If not refreshing, initiates token refresh
 * 4. On success: updates token, retries original request
 * 5. On failure: clears auth data, redirects to login
 * 
 * This prevents race conditions where multiple 401s trigger multiple refresh attempts
 */
apiClient.interceptors.response.use(
  // Success path: return response as-is
  (response) => response,
  
  // Error path: handle authentication failures
  async (error: AxiosError) => {
    // Get the original failed request to retry it
    const originalRequest = error.config as any;

    // Check if this is a 401 (Unauthorized) error and hasn't already been retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          // Add to queue; will retry when refresh completes
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest)) // Retry with new token
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Mark request as being retried to prevent infinite loops
      originalRequest._retry = true;
      
      // Set flag to prevent other 401s from also refreshing
      isRefreshing = true;

      try {
        /**
         * Refresh Token Flow:
         * POST /auth/refresh -> returns new JWT token
         * Server validates refresh token from httpOnly cookie
         */
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {}, // Empty body; server uses cookie for refresh token
          { withCredentials: true } // Include cookies
        );

        // Extract new token from response
        const newToken = response.data.data?.access_token;
        if (!newToken) {
          throw new Error('No token in refresh response');
        }

        // Persist new token to localStorage for subsequent requests
        localStorage.setItem('token', newToken);
        
        // Also set as cookie for server communication
        document.cookie = `token=${newToken}; path=/; max-age=${7 * 24 * 60 * 60}`;
        
        // Update default Authorization header for subsequent requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Process all queued requests with new token
        processQueue(null);

        // Retry the original failed request with new token
        return apiClient(originalRequest);
      } catch (refreshError) {
        /**
         * Token Refresh Failed:
         * - Old token is invalid and can't be refreshed
         * - User session is terminated
         * - Clear all auth data and redirect to login
         */
        if (typeof window !== 'undefined') {
          // Clear authentication data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          document.cookie = 'token=; path=/; max-age=0';
          
          // Redirect to login page
          window.location.href = '/auth/login';
        }
        
        // Reject all queued requests
        processQueue(refreshError as AxiosError);
        
        return Promise.reject(refreshError);
      } finally {
        // Allow next 401 to attempt refresh
        isRefreshing = false;
      }
    }

    // Don't handle other errors; propagate to caller
    return Promise.reject(error);
  }
);

export default apiClient;
