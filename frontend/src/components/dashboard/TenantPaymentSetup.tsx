'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Phone } from 'lucide-react';
import {
  validateAndNormalizePhone,
  formatPhoneNumber,
  getNetworkEmoji,
  MobileNetwork,
} from '@/utils/phoneValidation';

interface PaymentAccount {
  id: string;
  network: string;
  momo_number: string;
  account_name?: string;
  is_verified: boolean;
  is_default: boolean;
}

interface TenantPaymentSetupProps {
  tenantId: string;
  onComplete?: (accounts: PaymentAccount[]) => void;
  onSkip?: () => void;
}

/**
 * TenantPaymentSetup Component
 * 
 * Spec: Section 4 — Tenant Onboarding Flow (Steps 3-5)
 * 
 * Captures tenant's Mobile Money account(s) for instant payout.
 * Displays verification status and admin approval requirements.
 */
export default function TenantPaymentSetup({
  tenantId,
  onComplete,
  onSkip,
}: TenantPaymentSetupProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  
  const [mtnNumber, setMtnNumber] = useState('');
  const [airtelNumber, setAirtelNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);

  // Load existing accounts on component mount
  useEffect(() => {
    loadPaymentAccounts();
  }, [tenantId]);

  const loadPaymentAccounts = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${apiUrl}/tenants/${tenantId}/payment-accounts`, {
        method: 'GET',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load payment accounts:', err);
    }
  };

  const handleAddMTN = async () => {
    if (!mtnNumber.trim()) {
      setError('Please enter an MTN number');
      return;
    }

    const validation = validateAndNormalizePhone(mtnNumber);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid phone number');
      return;
    }

    if (validation.network !== MobileNetwork.MTN) {
      setError('This number does not appear to be an MTN number');
      return;
    }

    await addPaymentAccount(validation.normalized || mtnNumber);
  };

  const handleAddAirtel = async () => {
    if (!airtelNumber.trim()) {
      setError('Please enter an Airtel number');
      return;
    }

    const validation = validateAndNormalizePhone(airtelNumber);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid phone number');
      return;
    }

    if (validation.network !== MobileNetwork.AIRTEL) {
      setError('This number does not appear to be an Airtel number');
      return;
    }

    await addPaymentAccount(validation.normalized || airtelNumber);
  };

  const addPaymentAccount = async (phoneNumber: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${apiUrl}/tenants/${tenantId}/payment-accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          momo_number: phoneNumber,
          account_name: accountName || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Payment account added successfully');
        setMtnNumber('');
        setAirtelNumber('');
        setAccountName('');
        await loadPaymentAccounts();

        // Auto-complete if at least one account is added
        if (onComplete) {
          setTimeout(() => onComplete(data.data ? [data.data] : []), 1000);
        }
      } else {
        setError(data.message || 'Failed to add payment account');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Error adding payment account:', err);
    } finally {
      setLoading(false);
    }
  };

  const isMTNExists = accounts.some((acc) => acc.network === 'MTN');
  const isAirtelExists = accounts.some((acc) => acc.network === 'AIRTEL');

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">💰 Payment Setup</h2>
        <p className="text-gray-600">
          Add your Mobile Money accounts to receive instant payouts from customer orders
        </p>
      </div>

      {/* Important Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Verification Required</p>
            <p>
              Our admin team will contact you to verify your account ownership before payments can
              be processed. This is to ensure your security.
            </p>
          </div>
        </div>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </p>
        </div>
      )}

      {/* Existing Accounts */}
      {accounts.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Your Payment Accounts</h3>
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`p-3 rounded-lg border ${
                  account.is_verified
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {getNetworkEmoji(account.network as MobileNetwork)}{' '}
                        {formatPhoneNumber(account.momo_number)}
                      </p>
                      {account.account_name && (
                        <p className="text-xs text-gray-600">{account.account_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {account.is_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-200 text-green-800 text-xs font-semibold rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded-full">
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Payment Account Form */}
      <div className="space-y-6 mb-6">
        {/* MTN Section */}
        {!isMTNExists && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              📱 MTN Mobile Money
            </label>
            <input
              type="tel"
              placeholder="0788123456 or +250788123456"
              value={mtnNumber}
              onChange={(e) => setMtnNumber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none mb-3"
            />
            <button
              onClick={handleAddMTN}
              disabled={loading || !mtnNumber.trim()}
              className="w-full px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Adding...' : 'Add MTN Account'}
            </button>
          </div>
        )}

        {/* Airtel Section */}
        {!isAirtelExists && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              📲 Airtel Mobile Money
            </label>
            <input
              type="tel"
              placeholder="0733123456 or +250733123456"
              value={airtelNumber}
              onChange={(e) => setAirtelNumber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none mb-3"
            />
            <button
              onClick={handleAddAirtel}
              disabled={loading || !airtelNumber.trim()}
              className="w-full px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Adding...' : 'Add Airtel Account'}
            </button>
          </div>
        )}

        {/* Optional Account Name Field */}
        {(!isMTNExists || !isAirtelExists) && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Account Holder Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., John Doe"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Helps our admin team verify account ownership
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        {onSkip && (
          <button
            onClick={onSkip}
            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Skip for Now
          </button>
        )}
        {accounts.length > 0 && onComplete && (
          <button
            onClick={() => onComplete(accounts)}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
          >
            Continue
          </button>
        )}
      </div>

      {/* Info Message */}
      {accounts.length === 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 text-center">
            ✨ Add at least one payment account to start receiving customer payments
          </p>
        </div>
      )}
    </div>
  );
}
