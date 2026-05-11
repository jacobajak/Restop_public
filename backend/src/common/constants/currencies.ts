/**
 * Currency metadata for all supported African currencies
 * Includes decimal places, formatting rules, and ISO standards
 */

export interface CurrencyMetadata {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  symbolPosition: 'before' | 'after'; // e.g., $100 vs 100€
  decimalSeparator: '.' | ',';
  thousandsSeparator: ',' | '.';
}

/**
 * Complete currency metadata for all African currencies
 */
export const CURRENCIES: Record<string, CurrencyMetadata> = {
  // East Africa
  RWF: {
    code: 'RWF',
    symbol: 'FRw',
    name: 'Rwandan Franc',
    decimalPlaces: 0,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  KES: {
    code: 'KES',
    symbol: 'KSh',
    name: 'Kenyan Shilling',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  TZS: {
    code: 'TZS',
    symbol: 'TSh',
    name: 'Tanzanian Shilling',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  UGX: {
    code: 'UGX',
    symbol: 'USh',
    name: 'Ugandan Shilling',
    decimalPlaces: 0,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ETB: {
    code: 'ETB',
    symbol: 'Br',
    name: 'Ethiopian Birr',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  DJF: {
    code: 'DJF',
    symbol: 'Fdj',
    name: 'Djiboutian Franc',
    decimalPlaces: 0,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  SSP: {
    code: 'SSP',
    symbol: '£',
    name: 'South Sudanese Pound',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },

  // Central Africa
  XAF: {
    code: 'XAF',
    symbol: 'FCFA',
    name: 'CFA Franc (Central Africa)',
    decimalPlaces: 0,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  CDF: {
    code: 'CDF',
    symbol: 'FC',
    name: 'Congolese Franc',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },

  // West Africa
  GHS: {
    code: 'GHS',
    symbol: '₵',
    name: 'Ghanaian Cedi',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  NGN: {
    code: 'NGN',
    symbol: '₦',
    name: 'Nigerian Naira',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  XOF: {
    code: 'XOF',
    symbol: 'CFA',
    name: 'CFA Franc (West Africa)',
    decimalPlaces: 0,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  LRD: {
    code: 'LRD',
    symbol: '$L',
    name: 'Liberian Dollar',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  SLL: {
    code: 'SLL',
    symbol: 'Le',
    name: 'Sierra Leonean Leone',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  GMD: {
    code: 'GMD',
    symbol: 'D',
    name: 'Gambian Dalasi',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },

  // Southern Africa
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  BWP: {
    code: 'BWP',
    symbol: 'P',
    name: 'Botswanan Pula',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ZMW: {
    code: 'ZMW',
    symbol: 'ZK',
    name: 'Zambian Kwacha',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ZWL: {
    code: 'ZWL',
    symbol: '$',
    name: 'Zimbabwean Dollar',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  MWK: {
    code: 'MWK',
    symbol: 'MK',
    name: 'Malawian Kwacha',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  MZN: {
    code: 'MZN',
    symbol: 'MT',
    name: 'Mozambican Metical',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  SZL: {
    code: 'SZL',
    symbol: 'E',
    name: 'Swati Lilangeni',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  LSL: {
    code: 'LSL',
    symbol: 'L',
    name: 'Lesotho Loti',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },

  // North Africa
  EGP: {
    code: 'EGP',
    symbol: '£',
    name: 'Egyptian Pound',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  DZD: {
    code: 'DZD',
    symbol: 'د.ج',
    name: 'Algerian Dinar',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  MAD: {
    code: 'MAD',
    symbol: 'د.م.',
    name: 'Moroccan Dirham',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  TND: {
    code: 'TND',
    symbol: 'د.ت',
    name: 'Tunisian Dinar',
    decimalPlaces: 3,
    symbolPosition: 'after',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  LYD: {
    code: 'LYD',
    symbol: 'ل.د',
    name: 'Libyan Dinar',
    decimalPlaces: 3,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  SDG: {
    code: 'SDG',
    symbol: '£',
    name: 'Sudanese Pound',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },

  // Island Nations
  MUR: {
    code: 'MUR',
    symbol: '₨',
    name: 'Mauritian Rupee',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  SCR: {
    code: 'SCR',
    symbol: '₨',
    name: 'Seychellois Rupee',
    decimalPlaces: 2,
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  CVE: {
    code: 'CVE',
    symbol: '$',
    name: 'Cape Verdean Escudo',
    decimalPlaces: 2,
    symbolPosition: 'after',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
};

/**
 * Get currency metadata by code
 */
export function getCurrencyMetadata(code: string): CurrencyMetadata | undefined {
  return CURRENCIES[code];
}

/**
 * Format amount in specified currency
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = CURRENCIES[currencyCode];
  if (!currency) return `${amount} ${currencyCode}`;

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });

  if (currency.symbolPosition === 'before') {
    return `${currency.symbol}${formatted}`;
  } else {
    return `${formatted} ${currency.symbol}`;
  }
}

/**
 * Parse amount string to number
 */
export function parseCurrency(value: string, currencyCode: string): number {
  const currency = CURRENCIES[currencyCode];
  if (!currency) return parseFloat(value);

  // Remove currency symbol and whitespace
  let cleaned = value.replace(currency.symbol, '').trim();

  // Replace decimal and thousands separators based on locale
  if (currency.decimalSeparator === ',') {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  return parseFloat(cleaned);
}

/**
 * Convert amount to minor units (cents for 2 decimal currencies, etc.)
 * Useful for payment processing that requires integer amounts
 */
export function toMinorUnits(amount: number, currencyCode: string): number {
  const currency = CURRENCIES[currencyCode];
  const multiplier = Math.pow(10, currency?.decimalPlaces ?? 2);
  return Math.round(amount * multiplier);
}

/**
 * Convert from minor units back to currency amount
 */
export function fromMinorUnits(minorAmount: number, currencyCode: string): number {
  const currency = CURRENCIES[currencyCode];
  const divisor = Math.pow(10, currency?.decimalPlaces ?? 2);
  return minorAmount / divisor;
}

/**
 * Validate currency code
 */
export function isValidCurrency(code: string): boolean {
  return code in CURRENCIES;
}

/**
 * Get all supported currency codes
 */
export function getAllCurrencyCodes(): string[] {
  return Object.keys(CURRENCIES);
}

/**
 * Round amount according to currency decimal places
 */
export function roundCurrency(amount: number, currencyCode: string, roundingMode: 'round' | 'floor' | 'ceil' = 'round'): number {
  const currency = CURRENCIES[currencyCode];
  const factor = Math.pow(10, currency?.decimalPlaces ?? 2);

  switch (roundingMode) {
    case 'floor':
      return Math.floor(amount * factor) / factor;
    case 'ceil':
      return Math.ceil(amount * factor) / factor;
    case 'round':
    default:
      return Math.round(amount * factor) / factor;
  }
}
