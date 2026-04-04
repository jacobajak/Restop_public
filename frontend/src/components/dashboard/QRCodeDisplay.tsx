'use client';

import React from 'react';
import QRCode from 'qrcode.react';
import { Download, Printer } from 'lucide-react';

interface QRCodeDisplayProps {
  qrUrl: string;
  restaurantName: string;
  restaurantSlug: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  qrUrl,
  restaurantName,
  restaurantSlug,
}) => {
  const qrRef = React.useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const qrElement = qrRef.current?.querySelector('canvas') as HTMLCanvasElement;
    if (qrElement) {
      const url = qrElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${restaurantSlug}-qrcode.png`;
      link.click();
    }
  };

  const handlePrint = () => {
    const qrElement = qrRef.current?.querySelector('canvas') as HTMLCanvasElement;
    if (qrElement) {
      const url = qrElement.toDataURL('image/png');
      const printWindow = window.open('', '', 'height=400,width=400');
      printWindow?.document.write(`
        <html><head><title>${restaurantName} - QR Code</title></head><body>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
          <img src="${url}" style="width: 400px; height: 400px;" />
          <h2 style="text-align: center; margin-top: 20px;">${restaurantName}</h2>
          <p style="text-align: center; color: #666;">Scan to order online</p>
        </div>
        </body></html>
      `);
      printWindow?.document.close();
      printWindow?.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold mb-2">{restaurantName}</h2>
        <p className="text-gray-600 mb-6">Share this QR code for customers to order</p>

        {/* QR Code Display */}
        <div className="flex flex-col items-center space-y-6">
          <div ref={qrRef} className="bg-white p-8 border-2 border-gray-200 rounded-lg">
            <QRCode value={qrUrl} size={300} level="H" includeMargin={true} />
          </div>

          {/* QR Code URL */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrUrl}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <button
                onClick={() => navigator.clipboard.writeText(qrUrl)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 w-full">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition font-medium"
            >
              <Download size={20} />
              Download
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Printer size={20} />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">How to Use</h3>
        <ol className="space-y-2 text-blue-800 list-decimal list-inside">
          <li>Download or print the QR code</li>
          <li>Place it on your tables or counter</li>
          <li>Customers scan with their phones</li>
          <li>They access the digital menu and place orders</li>
          <li>You receive orders in real-time on your dashboard</li>
        </ol>
      </div>

      {/* Testing Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-amber-900 mb-3">Testing Information</h3>
        <p className="text-amber-800 mb-3">
          <strong>Current URL in QR Code:</strong> <code className="bg-white px-2 py-1 rounded">{qrUrl}</code>
        </p>
        <ul className="space-y-2 text-amber-800 text-sm">
          <li>
            <strong>Testing on same PC:</strong> This QR code will work when scanned from a QR code reader on your computer
          </li>
          <li>
            <strong>Testing on phone (same network):</strong> If you want to test from a phone on your network, replace <code className="bg-white px-2 py-1 rounded">localhost</code> with your computer's IP address (e.g., <code className="bg-white px-2 py-1 rounded">192.168.x.x</code>)
          </li>
          <li>
            <strong>Find your IP:</strong> Open Command Prompt and type <code className="bg-white px-2 py-1 rounded">ipconfig</code>, look for "IPv4 Address"
          </li>
        </ul>
      </div>
    </div>
  );
};
