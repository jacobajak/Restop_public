'use client';

import React, { useState, useEffect } from 'react';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/context/CartContext';
import { Header } from '@/components/customer/Header';
import { MenuDisplay } from '@/components/customer/MenuDisplay';
import { CartSidebar } from '@/components/customer/CartSidebar';
import { PaymentConfirmationModal } from '@/components/customer/PaymentConfirmationModal';
import { useSearchParams } from 'next/navigation';
import { Loader } from 'lucide-react';

interface MenuPageProps {
  params: {
    slug: string;
  };
}

export default function MenuPage({ params }: MenuPageProps) {
  const { menu, loading, error } = useMenu(params.slug);
  const { cart, setTableNumber, setTableId } = useCart();
  const searchParams = useSearchParams();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tableId, setTableIdState] = useState<string | null>(null);

  // Extract table number and table ID from URL query parameters
  useEffect(() => {
    const tableParam = searchParams?.get('table');
    if (tableParam) {
      const tableNumber = parseInt(tableParam, 10);
      if (!isNaN(tableNumber)) {
        setTableNumber(tableNumber);
      }
    }

    const tableIdParam = searchParams?.get('tableId');
    if (tableIdParam) {
      setTableId(tableIdParam);
      setTableIdState(tableIdParam);
    }
  }, [searchParams, setTableNumber, setTableId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={40} />
          <p className="text-gray-600 text-lg">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-xl font-bold mb-4">Failed to load menu</p>
          <p className="text-gray-600">{error || 'Restaurant not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-orange-50 to-white">
      <Header
        restaurantName={menu.tenant.name}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Hero/Info Section */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-8 shadow-lg">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Welcome to {menu.tenant.name}</h2>
          <p className="text-orange-100 text-lg font-medium">Browse and order your favorite dishes</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <section id="menu">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"></div>
              <h2 className="text-4xl font-bold text-gray-900">Our Menu</h2>
            </div>
            <p className="text-gray-600 text-lg font-medium">Delicious options waiting for you</p>
          </div>
          <MenuDisplay
            categories={menu.categories}
            items={menu.items}
            onItemAdded={() => setIsCartOpen(true)}
          />
        </section>
      </div>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Payment Confirmation Modal */}
      <PaymentConfirmationModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setOrderId(null);
        }}
        cart={cart}
        tenantId={menu.tenant.id}
        onOrderSuccess={(id) => {
          setOrderId(id);
        }}
      />
    </main>
  );
}
