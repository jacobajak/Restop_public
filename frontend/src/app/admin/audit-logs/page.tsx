'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import axios from 'axios';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  admin_id: string;
  admin_email: string;
  changes: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

const ActionBadge = ({ action }: { action: string }) => {
  const styles: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    APPROVE: 'bg-green-100 text-green-800',
    REJECT: 'bg-red-100 text-red-800',
    ASSIGN: 'bg-purple-100 text-purple-800',
    VERIFY: 'bg-green-100 text-green-800',
  };

  const style = styles[action] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${style}`}>
      {action}
    </span>
  );
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    admin_email: '',
    date_from: '',
    date_to: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const params = new URLSearchParams({
        limit: '100',
        offset: '0',
        ...(filters.action && { action: filters.action }),
        ...(filters.entity_type && { entity_type: filters.entity_type }),
        ...(filters.admin_email && { admin_email: filters.admin_email }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
      });

      const response = await axios.get(`${apiUrl}/admin/audit-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setLogs(response.data.data.data || response.data.data.logs || []);
        setError(null);
      } else {
        setError('Failed to load audit logs');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      action: '',
      entity_type: '',
      admin_email: '',
      date_from: '',
      date_to: '',
    });
  };

  const entityTypes = Array.from(new Set(logs.map((log) => log.entity_type))).sort();
  const actions = Array.from(new Set(logs.map((log) => log.action))).sort();

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-600 mt-1">Comprehensive audit trail of all admin actions</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          {Object.values(filters).some((v) => v) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
            <select
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Entities</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Email</label>
            <input
              type="email"
              value={filters.admin_email}
              onChange={(e) => setFilters({ ...filters, admin_email: e.target.value })}
              placeholder="Search email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {logs.length > 0 ? (
          <>
            <div className="text-sm text-gray-600 bg-gray-50 px-6 py-3 border-b border-gray-200">
              Showing {logs.length} log entries
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Entity ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.admin_email}</td>
                      <td className="px-6 py-4 text-sm">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.entity_type}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 text-xs">
                        {log.entity_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No audit logs found</p>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Audit Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Timestamp</label>
                  <p className="mt-1 text-gray-900">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Admin</label>
                  <p className="mt-1 text-gray-900">{selectedLog.admin_email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Action</label>
                  <div className="mt-1">
                    <ActionBadge action={selectedLog.action} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Entity Type</label>
                  <p className="mt-1 text-gray-900">{selectedLog.entity_type}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Entity ID</label>
                <p className="mt-1 text-gray-900 font-mono text-sm">{selectedLog.entity_id}</p>
              </div>

              {selectedLog.ip_address && (
                <div>
                  <label className="text-sm font-medium text-gray-700">IP Address</label>
                  <p className="mt-1 text-gray-900 font-mono text-sm">{selectedLog.ip_address}</p>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <label className="text-sm font-medium text-gray-700">User Agent</label>
                  <p className="mt-1 text-gray-600 text-xs bg-gray-50 p-3 rounded-lg break-words font-mono">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}

              {Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Changes</label>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-xs overflow-x-auto font-mono">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
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
