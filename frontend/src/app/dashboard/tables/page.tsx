'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/services/apiClient';
import Link from 'next/link';

interface Table {
  id: string;
  table_number: number;
  qr_code: string;
  qr_url: string;
  is_active: boolean;
  created_at: string;
}

export default function TablesManagementPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeData, setQRCodeData] = useState<{ [key: string]: string }>({});
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch tables on mount
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchTables();
    }
  }, [isAuthenticated, isLoading]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tables');
      const tablesData = response.data.data || [];
      setTables(tablesData);
      
      // Fetch QR code data for all tables
      const qrData: { [key: string]: string } = {};
      for (const table of tablesData) {
        try {
          const qrResponse = await apiClient.get(`/tables/${table.id}/qr-code/data-url`);
          qrData[table.id] = qrResponse.data.data.dataURL;
        } catch (err) {
          console.error(`Failed to fetch QR code for table ${table.id}:`, err);
        }
      }
      setQRCodeData(qrData);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch tables');
      console.error('Error fetching tables:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;

    try {
      const response = await apiClient.post('/tables', {
        table_number: parseInt(newTableNumber),
      });
      const newTable = response.data.data;
      
      // Fetch QR code for the newly created table
      try {
        const qrResponse = await apiClient.get(`/tables/${newTable.id}/qr-code/data-url`);
        setQRCodeData({
          ...qrCodeData,
          [newTable.id]: qrResponse.data.data.dataURL,
        });
      } catch (err) {
        console.error('Failed to fetch QR code for new table:', err);
      }
      
      setTables([...tables, newTable]);
      setNewTableNumber('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create table');
      console.error('Error creating table:', err);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;

    try {
      await apiClient.delete(`/tables/${tableId}`);
      setTables(tables.filter((t) => t.id !== tableId));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete table');
      console.error('Error deleting table:', err);
    }
  };

  const handleDownloadQRCode = async (table: Table) => {
    try {
      const response = await apiClient.get(`/tables/${table.id}/qr-code/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `table-${table.table_number}-qr.png`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download QR code');
      console.error('Error downloading QR code:', err);
    }
  };

  const handlePrintQRCode = async (table: Table) => {
    try {
      const response = await apiClient.get(`/tables/${table.id}/qr-code/print`);
      
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
        printWindow.document.write(response.data);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (err) {
      setError('Failed to generate printable QR code');
      console.error('Error printing QR code:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to manage tables</p>
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Table Management</h1>
              <p className="text-gray-600 mt-1">Create and manage restaurant tables with QR codes</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
              >
                + Add Table
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Create Table Form - Conditional Display */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Create New Table</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTable} className="flex gap-4">
              <input
                type="number"
                min="1"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="Table Number (e.g., 1, 2, 3...)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
              >
                Create Table
              </button>
            </form>
            <p className="text-sm text-gray-600 mt-2">
              💡 Each table will automatically get a unique QR code for customers to scan and order.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-600 hover:text-red-800 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tables List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading tables...</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No tables created yet</p>
            <p className="text-gray-500 text-sm">Create your first table above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table) => (
              <div
                key={table.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
              >
                {/* Table Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
                  <div className="text-3xl font-bold">Table {table.table_number}</div>
                  <div className="text-blue-100 text-sm mt-1">
                    QR: {table.qr_code}
                  </div>
                </div>

                {/* QR Code Display - Always Visible */}
                <div className="p-4 flex flex-col items-center">
                  {qrCodeData[table.id] ? (
                    <div className="text-center">
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 inline-block">
                        <img
                          src={qrCodeData[table.id]}
                          alt={`Table ${table.table_number} QR Code`}
                          className="w-48 h-48"
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-2 font-medium">Scan to order from Table {table.table_number}</p>
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500 text-sm">Loading QR Code...</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="w-full space-y-2 mt-4">

                    <button
                      onClick={() => handleDownloadQRCode(table)}
                      className="w-full px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition text-sm"
                    >
                      ⬇️ Download QR Code
                    </button>

                    <button
                      onClick={() => handlePrintQRCode(table)}
                      className="w-full px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition text-sm"
                    >
                      🖨️ Print QR Code
                    </button>

                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      className="w-full px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition text-sm"
                    >
                      🗑️ Delete Table
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-4 py-3 text-xs text-gray-500">
                  Created {new Date(table.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">📋 How Table QR Codes Work</h3>
          <ul className="space-y-2 text-blue-800">
            <li>✓ Each table automatically gets a unique QR code</li>
            <li>✓ QR code displays immediately on the table card</li>
            <li>✓ Staff can download the QR code as a PNG image file</li>
            <li>✓ Staff can print the QR code directly to paper</li>
            <li>✓ Attach the QR code sticker to each physical table</li>
            <li>✓ When customers scan the code, they see the menu with table pre-filled</li>
            <li>✓ Orders from table QR codes automatically show table number to staff</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
