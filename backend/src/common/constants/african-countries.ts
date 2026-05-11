/**
 * African Countries with their default currencies
 * Used for tenant country and currency selection
 */

export interface AfricanCountry {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  currencyName: string;
}

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  // East Africa
  { code: 'RW', name: 'Rwanda', currency: 'RWF', currencySymbol: 'FRw', currencyName: 'Rwandan Franc' },
  { code: 'KE', name: 'Kenya', currency: 'KES', currencySymbol: 'KSh', currencyName: 'Kenyan Shilling' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', currencySymbol: 'TSh', currencyName: 'Tanzanian Shilling' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', currencySymbol: 'USh', currencyName: 'Ugandan Shilling' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', currencySymbol: 'Br', currencyName: 'Ethiopian Birr' },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', currencySymbol: 'Fdj', currencyName: 'Djiboutian Franc' },
  { code: 'SS', name: 'South Sudan', currency: 'SSP', currencySymbol: '£', currencyName: 'South Sudanese Pound' },
  
  // Central Africa
  { code: 'CM', name: 'Cameroon', currency: 'XAF', currencySymbol: 'FCFA', currencyName: 'CFA Franc' },
  { code: 'CG', name: 'Congo', currency: 'XAF', currencySymbol: 'FCFA', currencyName: 'CFA Franc' },
  { code: 'CD', name: 'Democratic Republic of Congo', currency: 'CDF', currencySymbol: 'FC', currencyName: 'Congolese Franc' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', currencySymbol: 'FCFA', currencyName: 'CFA Franc' },

  // West Africa
  { code: 'GH', name: 'Ghana', currency: 'GHS', currencySymbol: '₵', currencyName: 'Ghanaian Cedi' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', currencySymbol: '₦', currencyName: 'Nigerian Naira' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'BJ', name: 'Benin', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'ML', name: 'Mali', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'NE', name: 'Niger', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'TG', name: 'Togo', currency: 'XOF', currencySymbol: 'CFA', currencyName: 'CFA Franc' },
  { code: 'LR', name: 'Liberia', currency: 'LRD', currencySymbol: '$L', currencyName: 'Liberian Dollar' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLL', currencySymbol: 'Le', currencyName: 'Sierra Leonean Leone' },
  { code: 'GM', name: 'Gambia', currency: 'GMD', currencySymbol: 'D', currencyName: 'Gambian Dalasi' },

  // Southern Africa
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', currencySymbol: 'R', currencyName: 'South African Rand' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', currencySymbol: 'P', currencyName: 'Botswanan Pula' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', currencySymbol: 'ZK', currencyName: 'Zambian Kwacha' },
  { code: 'ZW', name: 'Zimbabwe', currency: 'ZWL', currencySymbol: '$', currencyName: 'Zimbabwean Dollar' },
  { code: 'MW', name: 'Malawi', currency: 'MWK', currencySymbol: 'MK', currencyName: 'Malawian Kwacha' },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', currencySymbol: 'MT', currencyName: 'Mozambican Metical' },
  { code: 'SZ', name: 'Eswatini', currency: 'SZL', currencySymbol: 'E', currencyName: 'Swati Lilangeni' },
  { code: 'LS', name: 'Lesotho', currency: 'LSL', currencySymbol: 'L', currencyName: 'Lesotho Loti' },

  // North Africa
  { code: 'EG', name: 'Egypt', currency: 'EGP', currencySymbol: '£', currencyName: 'Egyptian Pound' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', currencySymbol: 'د.ج', currencyName: 'Algerian Dinar' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', currencySymbol: 'د.م.', currencyName: 'Moroccan Dirham' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', currencySymbol: 'د.ت', currencyName: 'Tunisian Dinar' },
  { code: 'LY', name: 'Libya', currency: 'LYD', currencySymbol: 'ل.د', currencyName: 'Libyan Dinar' },
  { code: 'SD', name: 'Sudan', currency: 'SDG', currencySymbol: '£', currencyName: 'Sudanese Pound' },

  // Island Nations
  { code: 'MU', name: 'Mauritius', currency: 'MUR', currencySymbol: '₨', currencyName: 'Mauritian Rupee' },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', currencySymbol: '₨', currencyName: 'Seychellois Rupee' },
  { code: 'CV', name: 'Cape Verde', currency: 'CVE', currencySymbol: '$', currencyName: 'Cape Verdean Escudo' },
];

/**
 * Get country by code
 */
export function getCountryByCode(code: string): AfricanCountry | undefined {
  return AFRICAN_COUNTRIES.find(c => c.code === code);
}

/**
 * Get country by name
 */
export function getCountryByName(name: string): AfricanCountry | undefined {
  return AFRICAN_COUNTRIES.find(c => c.name === name);
}

/**
 * Get currency for a country
 */
export function getCurrencyByCountryCode(code: string): string {
  const country = getCountryByCode(code);
  return country?.currency || 'RWF';
}
