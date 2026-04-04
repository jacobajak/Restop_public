'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, AlertTriangle, Mail, Phone, Calendar } from 'lucide-react';
import axios from 'axios';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  suspended_reason?: string;
  suspended_by_admin_id?: string;
  archived_at?: string;
  archived_by_admin_id?: string;
  created_at: string;
}

interface ActionModal {
  isOpen: boolean;
  restaurantId: string | null;
  restaurantName: string | null;
  action: 'suspend' | 'activate' | null;
  reason: string;
  isSubmitting: boolean;
}

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [modal, setModal] = useState<ActionModal>({
    isOpen: false,
    restaurantId: null,
    restaurantName: null,
    action: null,
    reason: '',
    isSubmitting: false,
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  // Fetch restaurants
  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiUrl}/admin/restaurants`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit: 100,
          offset: 0,
        },
      });

      if (response.data.success) {
        setRestaurants(response.data.data.restaurants);
        setError(null);
      } else {
        setError('Failed to load restaurants');
      }
    } catch (err) {
      console.error('Error fetching restaurants:', err);
      setError(err instanceof Error ? err.message : 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  // Filter restaurants based on search
  useEffect(() => {
    const filtered = restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.slug.toLowerCase().includes(search.toLowerCase()) ||
        r.email?.toLowerCase().includes(search.toLowerCase()),
    );
    setFilteredRestaurants(filtered);
  }, [search, restaurants]);

  // Handle suspend action
  const openSuspendModal = (restaurant: Restaurant) => {
    setModal({
      isOpen: true,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      action: 'suspend',
      reason: '',
      isSubmitting: false,
    });
  };

  // Handle activate action
  const openActivateModal = (restaurant: Restaurant) => {
    setModal({
      isOpen: true,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      action: 'activate',
      reason: '',
      isSubmitting: false,
    });
  };

  // Close modal
  const closeModal = () => {    console.log('[Restaurant Management] Closing modal and resetting state');    setError(null);
    setModal({
      isOpen: false,
      restaurantId: null,
      restaurantName: null,
      action: null,
      reason: '',
      isSubmitting: false,
    });
  };

  // Submit status update
  const handleSubmitAction = async () => {
    if (!modal.restaurantId || !modal.action) {
      setError('Invalid action parameters');
      return;
    }

    if (modal.action === 'suspend' && !modal.reason.trim()) {
      setError('Suspension reason is required');
      return;
    }

    setModal((prev) => ({ ...prev, isSubmitting: true }));
    setError(null); // Clear previous errors

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }

      const newStatus = modal.action === 'suspend' ? 'SUSPENDED' : 'ACTIVE';

      console.log(`[Restaurant Management] Attempting to ${modal.action}:`, {
        restaurantId: modal.restaurantId,
        restaurantName: modal.restaurantName,
        newStatus,
        reason: modal.reason || 'N/A',
      });

      const response = await axios.patch(
        `${apiUrl}/admin/restaurants/${modal.restaurantId}/status`,
        {
          status: newStatus,
          reason: modal.reason || '',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        },
      );

      console.log(`[Restaurant Management] Response received:`, response.data);

      if (response.data && response.data.success) {
        const successMsg = `Restaurant ${modal.restaurantName} ${modal.action === 'suspend' ? 'suspended' : 'activated'} successfully`;
        setSuccess(successMsg);
        setError(null);
        
        // Refresh the list
        console.log('[Restaurant Management] Refreshing restaurant list...');
        await fetchRestaurants();
        
        // Close modal after a short delay to show success
        setTimeout(() => {
          closeModal();
          // Clear success message after modal closes
          setTimeout(() => setSuccess(null), 500);
        }, 800);
      } else {
        const errorMsg = response.data?.error || `Failed to ${modal.action} restaurant`;
        console.error(`[Restaurant Management] API returned error:`, errorMsg);
        setError(errorMsg);
        setModal((prev) => ({ ...prev, isSubmitting: false }));
      }
    } catch (err: any) {
      console.error(`[Restaurant Management] Error ${modal.action}ing restaurant:`, err);
      
      // Extract detailed error message
      let errorMessage = `Failed to ${modal.action} restaurant`;
      
      // Handle timeout errors
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Server is not responding. Please try again.';
      } else if (err.message === 'Network Error') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Permission denied. You must be an admin to perform this action.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Restaurant not found.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.error || 'Invalid request. Please check your input.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.statusText) {
        errorMessage = `${err.response.statusText} (${err.response.status})`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.log(`[Restaurant Management] Final error message:`, errorMessage);
      setError(errorMessage);
      setModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Handle archive action
  const handleArchiveRestaurant = async (restaurant: Restaurant) => {
    if (!window.confirm(`Are you sure you want to archive "${restaurant.name}"? This action cannot be undone immediately. All historical data will be preserved.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }

      console.log(`[Restaurant Management] Attempting to archive restaurant:`, {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      });

      const response = await axios.delete(
        `${apiUrl}/admin/restaurants/${restaurant.id}/archive`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        },
      );

      console.log(`[Restaurant Management] Archive response:`, response.data);

      if (response.data && response.data.success) {
        setSuccess(`Restaurant "${restaurant.name}" has been archived successfully. All historical data is preserved.`);
        setError(null);
        
        // Refresh the list
        console.log('[Restaurant Management] Refreshing restaurant list...');
        await fetchRestaurants();
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorMsg = response.data?.error || 'Failed to archive restaurant';
        console.error(`[Restaurant Management] API returned error:`, errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error(`[Restaurant Management] Error archiving restaurant:`, err);
      
      // Extract detailed error message
      let errorMessage = 'Failed to archive restaurant';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Server is not responding. Please try again.';
      } else if (err.message === 'Network Error') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Permission denied. You must be an admin to perform this action.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Restaurant not found.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.error || 'Invalid request.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle size={18} />;
      case 'SUSPENDED':
        return <XCircle size={18} />;
      case 'PENDING':
        return <AlertTriangle size={18} />;
      default:
        return <AlertCircle size={18} />;
    }
  };

  const activeCount = restaurants.filter((r) => r.status === 'ACTIVE').length;
  const suspendedCount = restaurants.filter((r) => r.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">🏢 Restaurants Management</h2>
        <p className="text-gray-600">Manage all restaurants on the RESTOP platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Total Restaurants</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{restaurants.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">🟢 Active</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{activeCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">🔴 Suspended</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{suspendedCount}</p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-600" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search restaurants by name, email, or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Restaurants List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading restaurants...</p>
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No restaurants found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className={`border rounded-lg p-6 ${
                restaurant.status === 'SUSPENDED' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{restaurant.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(restaurant.status)}`}>
                      {getStatusIcon(restaurant.status)}
                      {restaurant.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Slug:</span> {restaurant.slug}
                  </p>

                  {/* Restaurant Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail size={16} className="text-blue-500" />
                      <a href={`mailto:${restaurant.email}`} className="hover:text-blue-600 underline">
                        {restaurant.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={16} className="text-blue-500" />
                      {restaurant.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={16} className="text-blue-500" />
                      Created {new Date(restaurant.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Suspension Reason */}
                  {restaurant.status === 'SUSPENDED' && restaurant.suspended_reason && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-1">Suspension Reason:</p>
                      <p className="text-sm text-red-700">{restaurant.suspended_reason}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 ml-4 flex-wrap justify-end">
                  {restaurant.status === 'ACTIVE' ? (
                    <button
                      onClick={() => openSuspendModal(restaurant)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => openActivateModal(restaurant)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => handleArchiveRestaurant(restaurant)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm whitespace-nowrap"
                    title="Archive this restaurant (soft delete). All data is preserved."
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            {/* Modal Header */}
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {modal.action === 'suspend' ? '🚫 Suspend Restaurant' : '✅ Activate Restaurant'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{modal.restaurantName}</p>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 mb-6">
              {modal.action === 'suspend' ? (
                <>
                  <p className="text-sm text-gray-700">
                    Are you sure you want to suspend this restaurant? This action will prevent them from receiving new orders.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Suspension *
                    </label>
                    <textarea
                      value={modal.reason}
                      onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                      placeholder="e.g., Non-payment, policy violation, quality issues..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">This reason will be visible in audit logs</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700">
                    Are you sure you want to activate this restaurant? They will be able to receive orders again.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> You can optionally add a note about the reactivation.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reactivation Note (Optional)
                    </label>
                    <textarea
                      value={modal.reason}
                      onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                      placeholder="e.g., Issue resolved, issues corrected..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={modal.isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                disabled={modal.isSubmitting}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  modal.action === 'suspend'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {modal.isSubmitting
                  ? 'Processing...'
                  : modal.action === 'suspend'
                    ? 'Suspend Restaurant'
                    : 'Activate Restaurant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
