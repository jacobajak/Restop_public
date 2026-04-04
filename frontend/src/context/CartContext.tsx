'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CartItem, Cart } from '@/types';

interface CartContextType {
  cart: Cart;
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string) => void;
  updateItemQuantity: (menuItemId: string, quantity: number) => void;
  setTableNumber: (tableNumber: number | undefined) => void;
  setTableId: (tableId: string | undefined) => void;
  clearCart: () => void;
  calculateTotals: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const PLATFORM_COMMISSION_PERCENT = 0.03; // 3%

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart>({
    items: [],
    subtotal: 0,
    platform_fee: 0,
    total: 0,
    table_number: undefined,
    table_id: undefined,
  });

  const calculateTotals = useCallback(() => {
    const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    const platform_fee = Math.round(subtotal * PLATFORM_COMMISSION_PERCENT);
    const total = subtotal + platform_fee;

    setCart((prev) => ({
      ...prev,
      subtotal,
      platform_fee,
      total,
    }));
  }, [cart.items]);

  const addItem = useCallback((newItem: CartItem) => {
    setCart((prev) => {
      const existingItem = prev.items.find((item) => item.menu_item_id === newItem.menu_item_id);

      let updatedItems;
      if (existingItem) {
        updatedItems = prev.items.map((item) =>
          item.menu_item_id === newItem.menu_item_id
            ? {
                ...item,
                quantity: item.quantity + newItem.quantity,
                subtotal: (item.quantity + newItem.quantity) * item.price,
              }
            : item
        );
      } else {
        updatedItems = [...prev.items, newItem];
      }

      const subtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const platform_fee = Math.round(subtotal * PLATFORM_COMMISSION_PERCENT);

      return {
        ...prev,
        items: updatedItems,
        subtotal,
        platform_fee,
        total: subtotal + platform_fee,
      };
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setCart((prev) => {
      const updatedItems = prev.items.filter((item) => item.menu_item_id !== menuItemId);
      const subtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const platform_fee = Math.round(subtotal * PLATFORM_COMMISSION_PERCENT);

      return {
        ...prev,
        items: updatedItems,
        subtotal,
        platform_fee,
        total: subtotal + platform_fee,
      };
    });
  }, []);

  const updateItemQuantity = useCallback((menuItemId: string, quantity: number) => {
    setCart((prev) => {
      const updatedItems = prev.items.map((item) =>
        item.menu_item_id === menuItemId
          ? {
              ...item,
              quantity,
              subtotal: quantity * item.price,
            }
          : item
      );

      const subtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const platform_fee = Math.round(subtotal * PLATFORM_COMMISSION_PERCENT);

      return {
        ...prev,
        items: updatedItems,
        subtotal,
        platform_fee,
        total: subtotal + platform_fee,
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      subtotal: 0,
      platform_fee: 0,
      total: 0,
      table_number: undefined,
      table_id: undefined,
    });
  }, []);

  const setTableNumber = useCallback((tableNumber: number | undefined) => {
    setCart((prev) => ({
      ...prev,
      table_number: tableNumber,
    }));
  }, []);

  const setTableId = useCallback((tableId: string | undefined) => {
    setCart((prev) => ({
      ...prev,
      table_id: tableId,
    }));
  }, []);

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateItemQuantity, setTableNumber, setTableId, clearCart, calculateTotals }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
