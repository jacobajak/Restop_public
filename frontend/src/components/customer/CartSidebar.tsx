'use client';

import React from 'react';
import { X, Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/currency';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, onCheckout }) => {
  const { cart, removeItem, updateItemQuantity } = useCart();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Cart Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 transition-transform duration-300 overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full bg-gradient-to-b from-white to-gray-50">
          {/* Header - Enhanced with gradient background */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold leading-tight">Your Order</h2>
                <p className="text-orange-100 text-sm font-medium mt-1">{cart.items.length} item{cart.items.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition font-semibold"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="text-5xl mb-4">🛒</div>
                <p className="text-gray-500 text-lg font-medium">Your cart is empty</p>
                <p className="text-gray-400 text-sm mt-2">Add some delicious items to get started</p>
              </div>
            ) : (
              cart.items.map((item) => (
                <div key={item.menu_item_id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-base">{item.name}</h4>
                      <p className="text-sm text-gray-500 mb-3 font-medium">{formatPrice(item.price)} each</p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg w-fit border border-gray-200">
                        <button
                          onClick={() => updateItemQuantity(item.menu_item_id, Math.max(1, item.quantity - 1))}
                          className="p-1 text-gray-600 hover:bg-orange-100 hover:text-orange-700 rounded transition font-semibold"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="px-2.5 py-0.5 bg-white rounded text-center w-10 font-bold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateItemQuantity(item.menu_item_id, item.quantity + 1)}
                          className="p-1 text-gray-600 hover:bg-orange-100 hover:text-orange-700 rounded transition font-semibold"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <p className="font-bold text-lg text-orange-600">
                        {formatPrice(item.subtotal)}
                      </p>
                      <button
                        onClick={() => removeItem(item.menu_item_id)}
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition font-semibold"
                        title="Remove item"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary & Action - Enhanced */}
          {cart.items.length > 0 && (
            <div className="border-t border-gray-200 p-5 space-y-4 bg-white">
              <div className="space-y-2.5">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-semibold">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span className="font-medium">Platform Fee (3%):</span>
                  <span className="font-semibold">{formatPrice(cart.platform_fee)}</span>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3.5 border border-orange-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-orange-600">{formatPrice(cart.total)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={onCheckout}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 px-4 rounded-lg active:scale-95 transition-all font-bold text-base shadow-lg hover:shadow-xl"
              >
                💳 Proceed to Pay
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
