/**
 * Currency Formatting Utility
 * 
 * Provides consistent currency formatting across the application using RWF (Rwandan Franc).
 * Uses en-US locale with RWF currency to ensure proper display of "RWF" instead of symbols.
 * 
 * @module currency
 */

/**
 * Format a numeric price value as Rwandan Franc (RWF)
 * 
 * Formats numbers with:
 * - Currency: RWF (Rwandan Franc)
 * - No decimal places (minimumFractionDigits: 0)
 * - Locale: en-US (ensures "RWF" displays correctly)
 * 
 * @function
 * @param {number} price - The price value to format
 * @returns {string} Formatted price string (e.g., "RWF 21,000")
 * 
 * @example
 * formatPrice(21000) → "RWF 21,000"
 * formatPrice(500) → "RWF 500"
 * formatPrice(0) → "RWF 0"
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};
