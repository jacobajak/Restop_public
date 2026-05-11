'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface PaymentAccountVerification {
  id: string;
  account_number: string;
  bank_name: string;
  account_holder_name: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  tenant_id: string;
  submitted_at: string;
  verified_at?: string;
  rejection_reason?: string;
  documents?: string[];
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    VERIFIED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-orange-100 text-orange-800',
  };

  const icons = {
    PENDING: <Clock className="w-4 h-4" />,
    VERIFIED: <CheckCircle className="w-4 h-4" />,
    REJECTED: <XCircle className="w-4 h-4" />,
    SUSPENDED: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit ${styles[status as keyof typeof styles]}`}>
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  );
};

export default function AdminVerificationPage() {
  const [accounts, setAccounts] = useState<PaymentAccountVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccountVerification | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('PENDING');

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await axios.get(
        `${apiUrl}/admin/verification/payment-accounts?status=${filterStatus}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setAccounts(response.data.data.accounts || []);
        setError(null);
      } else {
        setError('Failed to load accounts');
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [filterStatus]);

  const handleVerify = async (accountId: string) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      await axios.patch(
        `${apiUrl}/admin/verification/payment-accounts/${accountId}/verify`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setAccounts(accounts.filter((acc) => acc.id !== accountId));
      setSelectedAccount(null);
    } catch (err) {
      console.error('Error verifying account:', err);
    }
  };

  const handleReject = async (accountId: string) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      await axios.patch(
        `${apiUrl}/admin/verification/payment-accounts/${accountId}/reject`,
        { rejection_reason: rejectionReason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setAccounts(accounts.filter((acc) => acc.id !== accountId));
      setSelectedAccount(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Error rejecting account:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading payment accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Merchant Verification</h2>
          <p className="text-gray-600 mt-1">Verify merchant payment account details</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Status Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex gap-4 flex-wrap">
          {['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterStatus === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {accounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Account Holder</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Bank</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Account Number</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {account.account_holder_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{account.bank_name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      ••••{account.account_number.slice(-4)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={account.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(account.submitted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No accounts found with status: {filterStatus}</p>
          </div>
        )}
      </div>

      {/* Account Detail Modal */}
      {selectedAccount && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedAccount(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Account Details</h3>
              <button
                onClick={() => setSelectedAccount(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Account Holder Name</label>
                <p className="mt-1 text-gray-900 font-semibold">{selectedAccount.account_holder_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank Name</label>
                  <p className="mt-1 text-gray-600">{selectedAccount.bank_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Account Number</label>
                  <p className="mt-1 text-gray-600 font-mono">{selectedAccount.account_number}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedAccount.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Submitted</label>
                  <p className="mt-1 text-gray-600">{new Date(selectedAccount.submitted_at).toLocaleString()}</p>
                </div>
                {selectedAccount.verified_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Verified</label>
                    <p className="mt-1 text-gray-600">
                      {new Date(selectedAccount.verified_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedAccount.rejection_reason && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Rejection Reason</label>
                  <p className="mt-1 text-red-600 bg-red-50 p-3 rounded-lg">
                    {selectedAccount.rejection_reason}
                  </p>
                </div>
              )}

              {selectedAccount.status === 'PENDING' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Rejection Reason (if rejecting)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-200 flex gap-3">
                    <button
                      onClick={() => handleVerify(selectedAccount.id)}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Verify Account
                    </button>
                    <button
                      onClick={() => handleReject(selectedAccount.id)}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Account
                    </button>
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
