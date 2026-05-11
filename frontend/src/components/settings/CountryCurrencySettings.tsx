/**
 * Country and Currency Settings
 * 
 * Allow restaurants in Africa to select their operating country and currency
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/common';
import { useToast } from '@/components/common';
import apiClient from '@/services/apiClient';
import { MapPin, DollarSign } from 'lucide-react';

interface AfricanCountry {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  currencyName: string;
}

interface TenantData {
  id: string;
  name: string;
  country_code: string | null;
  country_name: string | null;
  currency: string;
}

export const CountryCurrencySettings: React.FC = () => {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<AfricanCountry[]>([]);
  const [formData, setFormData] = useState({
    country_code: '',
    country_name: '',
    currency: '',
  });
  const [loadingCountries, setLoadingCountries] = useState(true);

  // Load African countries list and tenant data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch African countries
        const countriesResponse = await apiClient.get('/tenants/countries/africa');
        if (countriesResponse.data.data) {
          setCountries(countriesResponse.data.data);
        }

        // Fetch tenant profile
        const profileResponse = await apiClient.get('/tenants/me/profile');
        if (profileResponse.data.data) {
          const tenantData = profileResponse.data.data as TenantData;
          setFormData({
            country_code: tenantData.country_code || '',
            country_name: tenantData.country_name || '',
            currency: tenantData.currency || '',
          });
        }
      } catch (err) {
        console.error('Failed to load country/currency data:', err);
        error('Failed to load available countries');
      } finally {
        setLoadingCountries(false);
      }
    };

    loadData();
  }, []);

  const handleCountryChange = (code: string) => {
    const selectedCountry = countries.find(c => c.code === code);
    if (selectedCountry) {
      setFormData({
        country_code: selectedCountry.code,
        country_name: selectedCountry.name,
        currency: selectedCountry.currency,
      });
    }
  };

  const handleCurrencyChange = (currency: string) => {
    setFormData(prev => ({
      ...prev,
      currency,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.country_code) {
      error('Please select a country');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/tenants/me/profile', {
        country_code: formData.country_code,
        country_name: formData.country_name,
        currency: formData.currency,
      });
      success('Country and currency updated successfully!');
    } catch (err: any) {
      console.error('Failed to update country/currency:', err);
      const errorMsg = err.response?.data?.message || 'Failed to update country and currency';
      error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingCountries) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
            🌍 Country & Currency
          </h1>
          <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
            Loading available countries...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
          🌍 Country & Currency
        </h1>
        <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
          Select your restaurant&apos;s operating country and currency. All transactions will use the selected currency.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5" />
                Operating Country
              </h2>

              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                Select your country *
              </label>
              
              <select
                value={formData.country_code}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                required
              >
                <option value="">-- Select a country --</option>
                {countries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>

              {formData.country_name && (
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  Selected: <span className="font-semibold text-neutral-900 dark:text-white">{formData.country_name}</span>
                </p>
              )}
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
              <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5" />
                Currency
              </h2>

              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                Transaction currency *
              </label>

              {formData.country_code ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                          Selected Currency
                        </p>
                        <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
                          {formData.currency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {countries.find(c => c.code === formData.country_code)?.currencySymbol}
                        </p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          {countries.find(c => c.code === formData.country_code)?.currencyName}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    💡 Currency is automatically set based on your selected country. You can change it if needed:
                  </p>

                  <select
                    value={formData.currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    {countries.map(country => (
                      <option key={country.currency} value={country.currency}>
                        {country.currency} - {country.currencyName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Please select a country first to set the currency.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !formData.country_code}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white font-medium rounded-lg transition"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="space-y-3">
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            📌 Why is this important?
          </h3>
          <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2">
            <li>✓ All transactions will be in your selected currency</li>
            <li>✓ Payment settlements will reflect your local currency</li>
            <li>✓ Reports and analytics will display amounts in your currency</li>
            <li>✓ You can update this at any time</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
