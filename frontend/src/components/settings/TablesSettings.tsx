/**
 * Tables Settings Component
 * 
 * Manage restaurant tables and generate QR codes.
 * - Create and delete tables
 * - Generate table numbers
 * - Download and print QR codes inline
 * - Full backend integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Modal } from '@/components/common';
import { useToast } from '@/components/common';
import QRCode from 'qrcode.react';
import { tablesService, TableData } from '@/services/tablesService';
import { AlertCircle, Loader, Download, Printer, Trash2 } from 'lucide-react';
import apiClient from '@/services/apiClient';

interface TenantData {
  id: string;
  name: string;
  slug: string;
}

export const TablesSettings: React.FC = () => {
  const { success, error: showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableData[]>([]);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tenant and tables on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        // Fetch tenant data
        const tenantResponse = await apiClient.get('/tenants/me/profile');
        setTenant(tenantResponse.data.data);

        // Fetch tables
        const fetchedTables = await tablesService.getTables();
        setTables(fetchedTables);
      } catch (err) {
        showError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const handleAddTable = async () => {
    if (!newTableNumber.trim()) return;

    try {
      setIsSubmitting(true);
      const tableNumber = parseInt(newTableNumber, 10);
      if (isNaN(tableNumber) || tableNumber < 1) {
        showError('Please enter a valid table number');
        return;
      }

      const newTable = await tablesService.createTable({
        table_number: tableNumber,
      });

      setTables([...tables, newTable]);
      setNewTableNumber('');
      setShowAddModal(false);
      success(`Table ${tableNumber} created successfully!`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create table';
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;

    try {
      await tablesService.deleteTable(id);
      setTables(tables.filter(t => t.id !== id));
      success('Table deleted successfully!');
    } catch (err) {
      showError('Failed to delete table');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4 text-primary-600" size={40} />
          <p className="text-gray-600">Loading tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
          🪑 Tables Management
        </h1>
        <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
          Create and manage your restaurant tables. Generate QR codes for each table so customers
          can scan and order directly from their seat.
        </p>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          className="gap-2"
        >
          + Add Table
        </Button>
      </div>

      {/* Tables List */}
      {tables.length === 0 ? (
        <Card className="text-center py-12 bg-gray-50">
          <div className="flex justify-center mb-4">
            <AlertCircle size={48} className="text-gray-400" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 text-lg">
            No tables configured yet. Create your first table to get started!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {tables.map((table) => {
            const handleDownloadQR = () => {
              // Find the canvas element for this specific table
              const card = document.querySelector(`[data-table-id="${table.id}"]`);
              const canvas = card?.querySelector('canvas') as HTMLCanvasElement;
              if (canvas) {
                const url = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = url;
                link.download = `Table-${table.table_number}-QR-Code.png`;
                link.click();
              }
            };

            const handlePrintQR = () => {
              // Find the canvas element for this specific table
              const card = document.querySelector(`[data-table-id="${table.id}"]`);
              const canvas = card?.querySelector('canvas') as HTMLCanvasElement;
              if (canvas) {
                const url = canvas.toDataURL('image/png');
                const printWindow = window.open('', '', 'height=600,width=600');
                printWindow?.document.write(`
                  <html><head><title>Table ${table.table_number} - QR Code</title></head><body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <img src="${url}" style="width: 400px; height: 400px;" />
                    <h2 style="text-align: center; margin-top: 20px;">Table ${table.table_number}</h2>
                    <p style="text-align: center; color: #666; margin-top: 10px;">Scan to order</p>
                  </body></html>
                `);
                printWindow?.document.close();
                printWindow?.print();
              }
            };

            return (
            <Card
              key={table.id}
              data-table-id={table.id}
              className="hover:shadow-lg transition-shadow duration-200"
            >
              <div className="space-y-4">
                {/* Table Header */}
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 border border-primary-200">
                      <span className="text-lg font-bold text-primary-600">
                        {table.table_number}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
                        Table {table.table_number}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        QR: {table.qr_code}
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Code Display */}
                <div className="flex justify-center">
                  <div className="bg-white p-3 border-2 border-gray-200 rounded-lg">
                    <QRCode
                      value={table.qr_url || `${window.location.origin}/menu/${tenant?.slug}?table=${table.table_number}&tableId=${table.id}`}
                      size={120}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>

                {/* QR Code Info */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">QR Code URL:</p>
                  <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 break-all font-mono max-h-16 overflow-y-auto">
                    {table.qr_url}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadQR}
                    className="gap-1 text-xs"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrintQR}
                    className="gap-1 text-xs"
                  >
                    <Printer size={14} />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Delete Table ${table.table_number}?`)) return;
                      handleDeleteTable(table.id);
                    }}
                    className="gap-1 text-xs"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>

                {/* Creation Date */}
                <div className="pt-2 border-t text-xs text-gray-500">
                  Created {new Date(table.created_at || new Date()).toLocaleDateString()}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {/* Stats Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-semibold">
              Total Tables
            </p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
              {tables.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-semibold">
              Active
            </p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
              {tables.filter(t => t.is_active).length}
            </p>
          </div>
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-semibold">
              QR Ready
            </p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
              {tables.filter(t => t.qr_code).length}
            </p>
          </div>
        </div>
      </Card>

      {/* Instructions Card */}
      <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
        <div className="flex gap-4">
          <div className="text-3xl flex-shrink-0">💡</div>
          <div>
            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">
              How Table Ordering Works
            </p>
            <ol className="text-sm text-green-800 dark:text-green-200 space-y-2 list-decimal list-inside">
              <li>Create a table and generate its QR code</li>
              <li>Download or print the QR code and attach it to the table</li>
              <li>Customer scans the code with their phone</li>
              <li>Menu opens with the table number pre-filled</li>
              <li>Customer places an order (linked to Table X)</li>
              <li>Order appears in your kitchen dashboard with table number</li>
              <li>Staff prepares the order and serves it to the correct table</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Add Table Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewTableNumber('');
        }}
        title="Create New Table"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Table Number"
            type="number"
            min="1"
            max="999"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            placeholder="e.g., 5"
            autoFocus
          />
          <p className="text-sm text-gray-600">
            Enter a unique number for this dining table. For example: 1, 2, 3, VIP-1, etc.
          </p>

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                setNewTableNumber('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddTable}
              isLoading={isSubmitting}
            >
              Create Table
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TablesSettings;
