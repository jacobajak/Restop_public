'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/common';
import { Trash2, Mail, Plus, Loader } from 'lucide-react';
import apiClient from '@/services/apiClient';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'KITCHEN_STAFF' | 'CASHIER';
  phone?: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  invitation_token?: string;
  invitation_expires_at?: Date;
}

export const StaffManagementSettings: React.FC = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'KITCHEN_STAFF' as const,
    phone: '',
  });

  // Load staff members
  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/staff');
      setStaff(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load staff:', err);
      setError(err.response?.data?.message || 'Failed to load staff members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);

    try {
      // Validate form
      if (!formData.name.trim() || !formData.email.trim() || !formData.role) {
        setError('Please fill in all required fields');
        setIsInviting(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Please enter a valid email address');
        setIsInviting(false);
        return;
      }

      // Send invitation
      const response = await apiClient.post('/staff', {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone || undefined,
      });

      // Add new staff to list
      setStaff((prev) => [response.data.staff, ...prev]);

      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'KITCHEN_STAFF',
        phone: '',
      });
      setShowInviteForm(false);
      setError(null);

      // Show success message
      alert(`Invitation sent to ${formData.email}!`);
    } catch (err: any) {
      console.error('Failed to invite staff:', err);
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) {
      return;
    }

    try {
      await apiClient.delete(`/staff/${staffId}`);
      setStaff((prev) => prev.filter((s) => s.id !== staffId));
    } catch (err: any) {
      console.error('Failed to delete staff:', err);
      setError(err.response?.data?.message || 'Failed to remove staff member');
    }
  };

  const handleDeactivateStaff = async (staffId: string) => {
    try {
      const response = await apiClient.post(`/staff/${staffId}/deactivate`);
      setStaff((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, is_active: response.data.is_active } : s))
      );
    } catch (err: any) {
      console.error('Failed to deactivate staff:', err);
      setError(err.response?.data?.message || 'Failed to deactivate staff member');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'KITCHEN_STAFF':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
      case 'CASHIER':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  };

  const isAccountSetup = (member: StaffMember) => !!member.user_id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">👥 Staff Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your restaurant staff and assign roles
          </p>
        </div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={18} />
          Invite Staff
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-900/50">
          <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Invite New Staff Member
          </h3>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  disabled={isInviting}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  disabled={isInviting}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  disabled={isInviting}
                >
                  <option value="KITCHEN_STAFF">Kitchen Staff</option>
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +250 7XX XXX XXX"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  disabled={isInviting}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isInviting}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {isInviting && <Loader size={16} className="animate-spin" />}
                {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false);
                  setFormData({ name: '', email: '', role: 'KITCHEN_STAFF', phone: '' });
                  setError(null);
                }}
                disabled={isInviting}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Staff List */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading staff members...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Staff Members Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Click "Invite Staff" to add your first team member
            </p>
            <button
              onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={18} />
              Invite First Staff Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{member.name}</span>
                        {member.phone && <span className="text-sm text-gray-500 dark:text-gray-400">{member.phone}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{member.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-sm ${member.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {member.is_active ? '✓ Active' : '✗ Inactive'}
                        </span>
                        {isAccountSetup(member) ? (
                          <span className="text-xs text-blue-600 dark:text-blue-400">📝 Account Created</span>
                        ) : (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">📮 Pending Invitation</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isAccountSetup(member) && (
                          <button
                            title="Resend invitation email"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                          >
                            <Mail size={18} />
                          </button>
                        )}
                        {member.is_active ? (
                          <button
                            onClick={() => handleDeactivateStaff(member.id)}
                            title="Deactivate this staff member"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-orange-600 dark:text-orange-400"
                          >
                            🔒
                          </button>
                        ) : (
                          <button
                            title="This staff member is inactive"
                            className="p-2 opacity-50 cursor-not-allowed text-gray-400"
                          >
                            🔒
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteStaff(member.id)}
                          title="Remove this staff member"
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Information Box */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50 p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 How Staff Onboarding Works</h3>
        <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-2 list-decimal list-inside">
          <li>You invite a staff member with their name and email</li>
          <li>They receive an email invitation with a link</li>
          <li>They click the link and set their password</li>
          <li>They can then login to the dashboard with their email and password</li>
          <li>You can deactivate or remove staff anytime from this page</li>
        </ol>
      </Card>
    </div>
  );
};
