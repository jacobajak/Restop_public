'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface SupportIssue {
  id: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'ASSIGNED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tenant_id?: string;
  assigned_admin_id?: string;
  created_at: string;
  updated_at: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    OPEN: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-purple-100 text-purple-800',
    INVESTIGATING: 'bg-yellow-100 text-yellow-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  };

  const icons = {
    OPEN: <AlertCircle className="w-4 h-4" />,
    ASSIGNED: <Clock className="w-4 h-4" />,
    INVESTIGATING: <AlertTriangle className="w-4 h-4" />,
    RESOLVED: <CheckCircle className="w-4 h-4" />,
    CLOSED: <CheckCircle className="w-4 h-4" />,
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit ${styles[status as keyof typeof styles]}`}>
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  );
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  const styles = {
    LOW: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[severity as keyof typeof styles]}`}>
      {severity}
    </span>
  );
};

export default function AdminSupportPage() {
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
  });
  const [selectedIssue, setSelectedIssue] = useState<SupportIssue | null>(null);

  const fetchIssues = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const params = new URLSearchParams({
        limit: '100',
        offset: '0',
        ...(filters.status && { status: filters.status }),
        ...(filters.severity && { severity: filters.severity }),
      });

      const response = await axios.get(`${apiUrl}/admin/support/issues?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setIssues(response.data.data.issues || []);
        setError(null);
      } else {
        setError('Failed to load support issues');
      }
    } catch (err) {
      console.error('Error fetching support issues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load support issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
          <p className="text-gray-600 mt-1">Manage customer and operational support issues</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {issues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Severity</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{issue.subject}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <SeverityBadge severity={issue.severity} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(issue.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No support issues found</p>
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedIssue(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{selectedIssue.subject}</h3>
              <button
                onClick={() => setSelectedIssue(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedIssue.status} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Severity</label>
                <div className="mt-1">
                  <SeverityBadge severity={selectedIssue.severity} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-gray-600 bg-gray-50 p-4 rounded-lg">{selectedIssue.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-gray-600">{new Date(selectedIssue.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Updated</label>
                  <p className="mt-1 text-gray-600">{new Date(selectedIssue.updated_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedIssue.tenant_id && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Restaurant ID</label>
                  <p className="mt-1 text-gray-600 font-mono text-xs">{selectedIssue.tenant_id}</p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Assign to Admin
                </button>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
