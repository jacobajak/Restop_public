'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useErrorReport } from '@/hooks/useErrorReport';
import dynamic from 'next/dynamic';

interface CapturedError {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
}

/**
 * Global Error Handler Component
 * Captures uncaught errors and provides option to report them to admin
 * Place this at the root of your app to enable global error capturing
 */
export const ErrorHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { reportError } = useErrorReport();

  useEffect(() => {
    // Set mounted flag to ensure client-only rendering
    setIsMounted(true);

    const isIgnoredError = (message: string): boolean => {
      // Ignore Next.js navigation errors - these are expected and handled internally
      if (message.includes('NEXT_REDIRECT')) return true;
      if (message.includes('NEXT_NOT_FOUND')) return true;
      
      return false;
    };

    const handleError = (event: any) => {
      const message = event.message || 'Unknown error';
      
      // Skip ignored errors
      if (isIgnoredError(message)) {
        return;
      }

      const error: CapturedError = {
        id: Math.random().toString(36).substring(7),
        message,
        stack: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
        timestamp: Date.now(),
      };

      setErrors((prev) => [error, ...prev].slice(0, 5)); // Keep last 5 errors
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as any;
      const message = reason?.message || String(reason);
      
      // Skip ignored errors
      if (isIgnoredError(message)) {
        return;
      }

      const error: CapturedError = {
        id: Math.random().toString(36).substring(7),
        message: `Promise rejection: ${message}`,
        stack: reason?.stack,
        timestamp: Date.now(),
      };

      setErrors((prev) => [error, ...prev].slice(0, 5));
    };

    window.addEventListener('error', handleError as EventListener);
    window.addEventListener('unhandledrejection', handleUnhandledRejection as EventListener);

    return () => {
      window.removeEventListener('error', handleError as EventListener);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection as EventListener);
    };
  }, []);

  const handleReportError = async (error: CapturedError) => {
    const result = await reportError({
      subject: error.message.substring(0, 100),
      description: error.message,
      errorDetails: error.stack,
      issueType: 'SYSTEM_ISSUE',
      severity: 'HIGH',
    });

    if (result.success) {
      setErrors((prev) => prev.filter((e) => e.id !== error.id));
    }
  };

  const handleDismiss = (errorId: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== errorId));
  };

  // Don't render error notifications until mounted (avoid hydration mismatch)
  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Error Notifications */}
      <div className="fixed bottom-4 right-4 space-y-3 z-40 max-w-sm">
        {errors.map((error) => (
          <div
            key={error.id}
            className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200 text-sm">
                  An error occurred
                </h3>
                <p className="text-xs text-red-800 dark:text-red-300 mt-1 line-clamp-2">
                  {error.message}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleReportError(error)}
                    className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition"
                  >
                    Report to Support
                  </button>
                  <button
                    onClick={() => handleDismiss(error.id)}
                    className="text-xs px-3 py-1 bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 rounded font-medium transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(error.id)}
                className="text-red-500 hover:text-red-700 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
