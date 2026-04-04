'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  status: string;
  created_at: string;
  customer_name?: string;
}

interface Refund {
  id: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'FAILED' | 'REJECTED';
  created_at: string;
  approved_at?: string;
  notes?: string;
}

const REFUND_REASONS = [
  { value: 'CUSTOMER_REQUEST', label: 'Customer Request' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancelled' },
  { value: 'DUPLICATE_PAYMENT', label: 'Duplicate Payment' },
  { value: 'WRONG_AMOUNT', label: 'Wrong Amount' },
  { value: 'MERCHANT_ERROR', label: 'Merchant Error' },
  { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
];

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

interface OrderDetailsProps {
  params: {
    id: string;
  };
}

export default function RequestRefundPage({ params }: OrderDetailsProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [refundReason, setRefundReason] = useState('CUSTOMER_REQUEST');
  const [refundAmount, setRefundAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);

  useEffect(() => {
    fetchOrderData();
  }, [params.id]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${params.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data.data);
        fetchRefundStatus();
      } else {
        setError('Failed to load order');
      }
    } catch (err) {
      setError('Error loading order');
    } finally {
      setLoading(false);
    }
  };

  const fetchRefundStatus = async () => {
    try {
      const response = await fetch(`/api/orders/${params.id}/refund-status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.refunds) {
          setRefunds(data.data.refunds);
        }
      }
    } catch (err) {
      console.error('Error fetching refund status', err);
    }
  };

  const handleRequestRefund = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!refundReason) {
      setError('Please select a refund reason');
      return;
    }

    if (!order) {
      setError('Order not found');
      return;
    }

    // Validate refund amount if specified
    const amount = refundAmount ? parseInt(refundAmount) : undefined;
    if (amount && amount > order.total_amount) {
      setError('Refund amount cannot exceed order total');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`/api/orders/${params.id}/request-refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          reason: refundReason,
          amount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccessMessage('Refund request submitted successfully!');
          setRefundReason('CUSTOMER_REQUEST');
          setRefundAmount('');
          setShowRefundForm(false);
          fetchRefundStatus();
        } else {
          setError(data.error || 'Failed to request refund');
        }
      } else {
        setError('Failed to request refund');
      }
    } catch (err) {
      setError('Error requesting refund');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-red-500">Order not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Details & Refunds</h1>
          <p className="text-gray-600 mt-2">Order #{order.order_number}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {(order.total_amount / 100).toFixed(2)} RWF
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Status</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                <StatusBadge status={order.payment_status} />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Status</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                <StatusBadge status={order.status} />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-gray-900 mt-1">
                {new Date(order.created_at).toLocaleDateString()} at{' '}
                {new Date(order.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Refund Requests */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Refund Requests</h2>
            {order.payment_status === 'PAID' && (
              <button
                onClick={() => setShowRefundForm(!showRefundForm)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                {showRefundForm ? 'Cancel' : 'Request Refund'}
              </button>
            )}
          </div>

          {/* Refund Request Form */}
          {showRefundForm && (
            <form onSubmit={handleRequestRefund} className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Refund
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REFUND_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Amount (Optional)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Leave empty to refund full amount (${(order.total_amount / 100).toFixed(2)} RWF)`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">RWF</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Max: {(order.total_amount / 100).toFixed(2)} RWF
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRefundForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Request Refund'}
                </button>
              </div>
            </form>
          )}

          {/* Refunds List */}
          {refunds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No refund requests for this order
            </div>
          ) : (
            <div className="space-y-3">
              {refunds.map((refund) => (
                <div key={refund.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {(refund.amount / 100).toFixed(2)} RWF
                      </p>
                      <p className="text-sm text-gray-600">
                        {refund.reason.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <StatusBadge status={refund.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Requested: {new Date(refund.created_at).toLocaleDateString()}</span>
                    {refund.approved_at && (
                      <span>Processed: {new Date(refund.approved_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  {refund.notes && (
                    <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      Notes: {refund.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
