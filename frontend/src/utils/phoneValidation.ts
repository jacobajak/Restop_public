/**
 * Phone Number Validation & Formatting Utilities
 * 
 * Spec: Section 4 — Backend Validation
 */

export enum MobileNetwork {
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Validate phone number format
 * Supports Rwandan numbers: 0788111111, +250788111111, etc.
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) return false;

  // Remove any formatting
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Should be 12 digits (250788111111) or 10 digits (0788111111)
  return cleaned.length === 10 || cleaned.length === 12;
}

/**
 * Format phone number for display
 * Converts 0788111111 or 250788111111 to readable format
 */
export function formatPhoneNumber(phoneNumber: string): string {
  if (!validatePhoneNumber(phoneNumber)) {
    return phoneNumber;
  }

  const normalized = normalizePhoneNumber(phoneNumber);
  // Format as 07XX XXX XXX
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
}

/**
 * Normalize phone number to standard format (0XXXXXXXXX)
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');

  // If it's 12 digits starting with 250 (country code), convert to 0
  if (cleaned.length === 12 && cleaned.startsWith('250')) {
    return '0' + cleaned.substring(3);
  }

  // If it's 10 digits and doesn't start with 0, add 0
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }

  // Return as-is if already normalized or 10 digits starting with 0
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return cleaned;
  }

  throw new Error('Unable to normalize phone number');
}

/**
 * Detect mobile network from phone number
 * MTN: 078, 079
 * AIRTEL: 073, 074
 */
export function detectNetwork(phoneNumber: string): MobileNetwork {
  try {
    const normalized = normalizePhoneNumber(phoneNumber);
    const digit3 = normalized.substring(0, 3);

    if (['078', '079'].includes(digit3)) {
      return MobileNetwork.MTN;
    }

    if (['073', '074'].includes(digit3)) {
      return MobileNetwork.AIRTEL;
    }

    return MobileNetwork.UNKNOWN;
  } catch {
    return MobileNetwork.UNKNOWN;
  }
}

/**
 * Get network emoji for display
 */
export function getNetworkEmoji(network: MobileNetwork): string {
  switch (network) {
    case MobileNetwork.MTN:
      return '📱 MTN';
    case MobileNetwork.AIRTEL:
      return '📲 Airtel';
    default:
      return '📞';
  }
}

/**
 * Validate phone number and return normalized version with network
 */
export function validateAndNormalizePhone(
  phoneNumber: string,
): { isValid: boolean; normalized?: string; network?: MobileNetwork; error?: string } {
  if (!phoneNumber) {
    return { isValid: false, error: 'Phone number is required' };
  }

  if (!validatePhoneNumber(phoneNumber)) {
    return {
      isValid: false,
      error: 'Invalid phone number format. Use 0788123456 or +250788123456',
    };
  }

  try {
    const normalized = normalizePhoneNumber(phoneNumber);
    const network = detectNetwork(normalized);

    if (network === MobileNetwork.UNKNOWN) {
      return { isValid: false, error: 'Phone number does not match MTN or Airtel prefixes' };
    }

    return { isValid: true, normalized, network };
  } catch (error) {
    return { isValid: false, error: 'Unable to process phone number' };
  }
}
