'use client';

import React, { useState } from 'react';
import { Phone, Trash2, Star, AlertCircle, CheckCircle } from 'lucide-react';
import {
  formatPhoneNumber,
  getNetworkEmoji,
  MobileNetwork,
} from '@/utils/phoneValidation';

interface PaymentAccountCardProps {
  account: {
    id: string;
    network: string;
    momo_number: string;
    account_name?: string;
    is_verified: boolean;
    is_default: boolean;
    created_at?: string;
  };
  tenantId: string;
  showDelete?: boolean;
  showDefault?: boolean;
  onDelete?: (accountId: string) => void;
  onSetDefault?: (accountId: string) => void;
  onVerify?: (accountId: string) => void;
  isAdmin?: boolean;
}

/**
 * PaymentAccountCard Component
 * 
 * Displays a single payment account with verification status,
 * default badge, and action buttons.
 */
export default function PaymentAccountCard({
  account,
  tenantId,
  showDelete = true,
  showDefault = true,
  onDelete,
  onSetDefault,
  onVerify,
  isAdmin = false,
}: PaymentAccountCardProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  
  const [deleting, setDeleting] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    if (!confirm('Are you sure you want to delete this payment account?')) return;

    setDeleting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(
        `${apiUrl}/tenants/${tenantId}/payment-accounts/${account.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        },
      );

      if (response.ok) {
        onDelete(account.id);
      } else {
        alert('Failed to delete payment account');
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('An error occurred while deleting the account');
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    if (!onSetDefault) return;

    setSettingDefault(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(
        `${apiUrl}/tenants/${tenantId}/payment-accounts/${account.id}/default`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        },
      );

      if (response.ok) {
        onSetDefault(account.id);
      } else {
        alert('Failed to set default account');
      }
    } catch (err) {
      console.error('Error setting default:', err);
      alert('An error occurred');
    } finally {
      setSettingDefault(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 transition ${
        account.is_verified
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-2xl">
            {account.network === 'MTN' || account.network === MobileNetwork.MTN ? '📱' : '📲'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">
                {getNetworkEmoji(account.network as MobileNetwork)}
              </p>
              <p className="font-mono text-lg text-gray-900">
                {formatPhoneNumber(account.momo_number)}
              </p>
            </div>
            {account.account_name && (
              <p className="text-sm text-gray-600 mt-1">{account.account_name}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="ml-2">
          {account.is_verified ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
              <CheckCircle className="w-3 h-3" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded-full">
              <AlertCircle className="w-3 h-3" />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="mb-3 text-xs text-gray-600">
        {account.is_default && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded mr-2 font-medium">
            <Star className="w-3 h-3" />
            Default Account
          </div>
        )}
        {account.created_at && (
          <span className="text-gray-500">Added {new Date(account.created_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Verification Info */}
      {!account.is_verified && (
        <div className="mb-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
          <p className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Awaiting admin verification. We will contact you shortly.
          </p>
        </div>
      )}

      {/* Actions */}
      {(showDefault || showDelete || isAdmin) && (
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          {showDefault && !account.is_default && (
            <button
              onClick={handleSetDefault}
              disabled={settingDefault || !account.is_verified}
              title={
                !account.is_verified
                  ? 'Account must be verified first'
                  : 'Set as default account'
              }
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {settingDefault ? 'Setting...' : 'Set Default'}
            </button>
          )}

          {isAdmin && !account.is_verified && (
            <button
              onClick={() => onVerify?.(account.id)}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition"
            >
              Verify Account
            </button>
          )}

          {showDelete && !account.is_default && !account.is_verified && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
