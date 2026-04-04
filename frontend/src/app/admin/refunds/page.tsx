'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Refund {
  id: string;
  order_id: string;
  tenant_id: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'FAILED' | 'REJECTED';
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  success: boolean;
  data?: {
    data: Refund[];
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PROCESSED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
      {status}
    </span>
  );
};

export default function AdminRefundsPage() {
  const router = useRouter();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approving, setApproving] = useState(false);

  // Rejection modal
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchRefunds = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((pageNum - 1) * limit).toString(),
      });

      if (statusFilter) params.append('status', statusFilter);
      if (tenantFilter) params.append('tenant_id', tenantFilter);
      if (minAmount) params.append('min_amount', minAmount);
      if (maxAmount) params.append('max_amount', maxAmount);

      const response = await fetch(`/api/admin/refunds?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data: ListResponse = await response.json();
      if (data.success && data.data) {
        setRefunds(data.data.data);
        setTotal(data.data.total);
        setPage(pageNum);
      } else {
        setError(data.error || 'Failed to load refunds');
      }
    } catch (err) {
      setError('Error loading refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds(1);
  }, [statusFilter, tenantFilter, minAmount, maxAmount]);

  const handleApprove = async () => {
    if (!selectedRefund) return;

    try {
      setApproving(true);
      const response = await fetch(`/api/admin/refunds/${selectedRefund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ notes: approvalNotes }),
      });

      if (response.ok) {
        setShowApprovalModal(false);
        setApprovalNotes('');
        fetchRefunds(page);
      } else {
        setError('Failed to approve refund');
      }
    } catch (err) {
      setError('Error approving refund');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRefund || !rejectionNotes) {
      setError('Rejection notes are required');
      return;
    }

    try {
      setRejecting(true);
      const response = await fetch(`/api/admin/refunds/${selectedRefund.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ notes: rejectionNotes }),
      });

      if (response.ok) {
        setShowRejectionModal(false);
        setRejectionNotes('');
        fetchRefunds(page);
      } else {
        setError('Failed to reject refund');
      }
    } catch (err) {
      setError('Error rejecting refund');
    } finally {
      setRejecting(false);
    }
  };

  const pageCount = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Refund Management</h1>
          <p className="text-gray-600 mt-2">Review and process refund requests</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PROCESSED">Processed</option>
                <option value="REJECTED">Rejected</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Amount
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Amount
              </label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="999999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant ID
              </label>
              <input
                type="text"
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                placeholder="Filter by tenant"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Refunds Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading refunds...</div>
          ) : refunds.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No refunds found</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Refund ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {refund.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {refund.order_id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {(refund.amount / 100).toFixed(2)} RWF
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {refund.reason.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <StatusBadge status={refund.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(refund.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {refund.status === 'PENDING' && (
                          <div className="space-x-2">
                            <button
                              onClick={() => {
                                setSelectedRefund(refund);
                                setShowApprovalModal(true);
                              }}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRefund(refund);
                                setShowRejectionModal(true);
                              }}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {refund.status !== 'PENDING' && (
                          <span className="text-gray-500 text-sm">{refund.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchRefunds(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, pageCount) }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => fetchRefunds(pageNum)}
                        className={`px-3 py-2 rounded ${
                          page === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchRefunds(page + 1)}
                    disabled={page === pageCount}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Approval Modal */}
        {showApprovalModal && selectedRefund && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Approve Refund</h3>
              <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-700">
                  Order: {selectedRefund.order_id.slice(0, 8)}...
                </p>
                <p className="text-sm text-blue-700 font-semibold">
                  Amount: {(selectedRefund.amount / 100).toFixed(2)} RWF
                </p>
              </div>

              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Optional notes (e.g., reason for approval)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4 h-32"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setApprovalNotes('');
                    setSelectedRefund(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {approving ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectionModal && selectedRefund && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Reject Refund</h3>
              <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-sm text-red-700">
                  Order: {selectedRefund.order_id.slice(0, 8)}...
                </p>
                <p className="text-sm text-red-700 font-semibold">
                  Amount: {(selectedRefund.amount / 100).toFixed(2)} RWF
                </p>
              </div>

              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Rejection reason (required)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 h-32"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionNotes('');
                    setSelectedRefund(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting || !rejectionNotes}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
