import type { Metadata, Viewport } from 'next';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/common';
import { ErrorHandler } from '@/components/common/ErrorHandler';
import { ThemeProvider } from '@/providers/ThemeProvider';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'RESTOP - Restaurant Ordering Platform',
  description: 'QR-Based Multi-Tenant Restaurant Ordering Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        <ThemeProvider>
          <AuthProvider>
            <ErrorHandler>
              <ToastProvider>
                <CartProvider>
                  {children}
                </CartProvider>
              </ToastProvider>
            </ErrorHandler>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
