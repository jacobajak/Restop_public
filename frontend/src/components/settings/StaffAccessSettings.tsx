/**
 * Staff Access Settings
 * 
 * Manage team members and their roles with backend integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Select, Modal } from '@/components/common';
import { useToast } from '@/components/common';
import { useAuth } from '@/context/AuthContext';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'kitchen' | 'cashier';
  phone?: string;
  is_active: boolean;
  user_id?: string;
}

const ROLES = [
  {
    value: 'manager',
    label: '📊 Manager',
    description: 'Orders, Menu, Analytics, Staff Management',
    color: 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100',
    backendRole: 'MANAGER',
  },
  {
    value: 'kitchen',
    label: '👨‍🍳 Kitchen Staff',
    description: 'View and update order status',
    color: 'bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-100',
    backendRole: 'KITCHEN_STAFF',
  },
  {
    value: 'cashier',
    label: '💰 Cashier',
    description: 'Process payments and receipts',
    color: 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100',
    backendRole: 'CASHIER',
  },
];

export const StaffAccessSettings: React.FC = () => {
  const { success, error } = useToast();
  const authContext = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'kitchen' as const,
  });

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const tenantId = authContext?.user?.tenant_id;
  const token = authContext?.token;

  // Fetch staff members on component mount
  useEffect(() => {
    if (tenantId && token) {
      fetchStaffMembers();
    }
  }, [tenantId, token]);

  const fetchStaffMembers = async () => {
    try {
      setFetching(true);
      const response = await fetch(`${apiBaseUrl}/staff`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Transform backend staff format to frontend format
        const transformedStaff = data.map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          is_active: s.is_active,
          user_id: s.user_id,
          role: mapBackendRoleToFrontend(s.role),
        }));
        setStaff(transformedStaff);
      } else {
        throw new Error('Failed to fetch staff members');
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      error('Failed to load staff members');
    } finally {
      setFetching(false);
    }
  };

  const mapBackendRoleToFrontend = (backendRole: string): 'manager' | 'kitchen' | 'cashier' => {
    switch (backendRole) {
      case 'MANAGER':
        return 'manager';
      case 'KITCHEN_STAFF':
        return 'kitchen';
      case 'CASHIER':
        return 'cashier';
      default:
        return 'kitchen';
    }
  };

  const mapFrontendRoleToBackend = (frontendRole: string): string => {
    const role = ROLES.find(r => r.value === frontendRole);
    return role?.backendRole || 'KITCHEN_STAFF';
  };

  const handleAddStaff = async () => {
    if (!token) {
      error('Authentication required. Please log in again.');
      return;
    }

    if (!newStaff.name.trim() || !newStaff.email.trim()) {
      error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newStaff.name,
          email: newStaff.email,
          phone: newStaff.phone,
          role: mapFrontendRoleToBackend(newStaff.role),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setStaff([...staff, {
          id: result.staff.id,
          name: result.staff.name,
          email: result.staff.email,
          phone: result.staff.phone,
          is_active: result.staff.is_active,
          user_id: result.staff.user_id,
          role: mapBackendRoleToFrontend(result.staff.role),
        }]);
        
        setNewStaff({ name: '', email: '', phone: '', role: 'kitchen' });
        setShowAddModal(false);
        success(`Invitation sent to ${newStaff.email}`);
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add staff member');
      }
    } catch (err) {
      console.error('Error adding staff:', err);
      error(err instanceof Error ? err.message : 'Failed to add staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStaff = async (staffId: string, updates: any) => {
    if (!token) {
      error('Authentication required. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...updates,
          role: mapFrontendRoleToBackend(updates.role),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setStaff(staff.map(s => 
          s.id === staffId 
            ? {
                ...s,
                ...updates,
                role: mapBackendRoleToFrontend(result.role),
              }
            : s
        ));
        success('Staff member updated successfully');
      } else {
        throw new Error('Failed to update staff member');
      }
    } catch (err) {
      console.error('Error updating staff:', err);
      error('Failed to update staff member');
    } finally {
      setLoading(false);
      setEditingStaff(null);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!token) {
      error('Authentication required. Please log in again.');
      return;
    }

    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      setLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/staff/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setStaff(staff.filter(s => s.id !== id));
        success('Staff member removed successfully');
      } else {
        throw new Error('Failed to remove staff member');
      }
    } catch (err) {
      console.error('Error deleting staff:', err);
      error('Failed to remove staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateStaff = async (id: string) => {
    if (!token) {
      error('Authentication required. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/staff/${id}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setStaff(staff.map(s => 
          s.id === id ? { ...s, is_active: false } : s
        ));
        success('Staff member deactivated');
      } else {
        throw new Error('Failed to deactivate staff member');
      }
    } catch (err) {
      console.error('Error deactivating staff:', err);
      error('Failed to deactivate staff member');
    } finally {
      setLoading(false);
    }
  };

  const getRoleInfo = (role: string) => {
    return ROLES.find(r => r.value === role);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
          👥 Staff Access
        </h1>
        <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
          Manage your team members and control what they can access in the system.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          className="gap-2"
          disabled={loading}
        >
          + Invite Staff Member
        </Button>
      </div>

      {/* Staff List */}
      {fetching ? (
        <Card className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">Loading staff members...</p>
        </Card>
      ) : staff.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">
            No staff members yet. Invite your team to get started.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {staff.map(member => {
            const roleInfo = getRoleInfo(member.role);
            const statusBadge = member.is_active ? (
              <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100 rounded-full">
                ✓ Active
              </span>
            ) : (
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-full">
                • Inactive
              </span>
            );
            
            const activationStatus = member.user_id ? (
              <span className="text-xs text-green-600 dark:text-green-400">✓ Accepted</span>
            ) : (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">⏳ Pending</span>
            );

            return (
              <Card key={member.id} className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
                          {member.name}
                        </p>
                        {activationStatus}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {member.email}
                      </p>
                      {member.phone && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {member.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {roleInfo && (
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${roleInfo.color}`}>
                        {roleInfo.label}
                      </div>
                    )}
                    {statusBadge}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingStaff(member)}
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteStaff(member.id)}
                      disabled={loading}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Role Permissions */}
      <Card>
        <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text mb-4">
          Role Permissions
        </h2>

        <div className="grid gap-3">
          {ROLES.map(role => (
            <div
              key={role.value}
              className={`p-4 rounded-lg border ${role.color}`}
            >
              <p className="font-semibold text-sm mb-1">{role.label}</p>
              <p className="text-xs">{role.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Invite Staff Member"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={newStaff.name}
            onChange={e => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., John Doe"
            autoFocus
          />

          <Input
            label="Email Address"
            type="email"
            value={newStaff.email}
            onChange={e => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
            placeholder="john@restaurant.com"
          />

          <Input
            label="Phone (Optional)"
            value={newStaff.phone}
            onChange={e => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="e.g., +250 7xx xxx xxx"
          />

          <Select
            label="Role"
            value={newStaff.role}
            onChange={e => setNewStaff(prev => ({ ...prev, role: e.target.value as any }))}
            options={ROLES.map(r => ({
              value: r.value,
              label: r.label,
            }))}
          />

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddStaff}
              isLoading={loading}
            >
              Send Invitation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Staff Modal */}
      {editingStaff && (
        <Modal
          isOpen={!!editingStaff}
          onClose={() => setEditingStaff(null)}
          title="Edit Staff Member"
          size="sm"
        >
          <div className="space-y-4">
            <Input
              label="Full Name"
              value={editingStaff.name}
              onChange={e => setEditingStaff(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder="e.g., John Doe"
            />

            <Input
              label="Phone"
              value={editingStaff.phone || ''}
              onChange={e => setEditingStaff(prev => prev ? { ...prev, phone: e.target.value } : null)}
              placeholder="e.g., +250 7xx xxx xxx"
            />

            <Select
              label="Role"
              value={editingStaff.role}
              onChange={e => setEditingStaff(prev => prev ? { ...prev, role: e.target.value as any } : null)}
              options={ROLES.map(r => ({
                value: r.value,
                label: r.label,
              }))}
            />

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setEditingStaff(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (editingStaff) {
                    handleUpdateStaff(editingStaff.id, {
                      name: editingStaff.name,
                      phone: editingStaff.phone,
                      role: editingStaff.role,
                    });
                  }
                }}
                isLoading={loading}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <div className="text-xl">ℹ️</div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Security & Access Control
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              • Each team member gets their own secure login
              <br />
              • They only see features allowed by their role
              <br />
              • Managers can invite new staff members
              <br />
              • You can modify or revoke access at any time
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StaffAccessSettings;
