'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center text-white max-w-2xl">
        <div className="mb-8">
          <div className="w-20 h-20 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4">
            R
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">RESTOP</h1>
        </div>
        <p className="text-xl md:text-2xl mb-4 text-gray-300">QR-Based Multi-Tenant Restaurant Ordering Platform</p>
        <p className="text-lg md:text-xl text-gray-400">
          Scan a QR code at your restaurant to order delicious food and get real-time updates.
        </p>
        <p className="text-sm md:text-base mt-8 text-gray-500">
          Platform Version 1.0 - MVP
        </p>
        
        <div className="flex gap-4 mt-12 justify-center">
          <Link href="/auth/login" className="px-8 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition">
            Sign In
          </Link>
          <Link href="/auth/register" className="px-8 py-3 bg-transparent text-white font-bold border-2 border-blue-500 rounded-lg hover:bg-blue-500/10 transition">
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
