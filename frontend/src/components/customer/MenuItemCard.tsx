'use client';

import React from 'react';
import { MenuItem } from '@/types';
import { Plus, Minus, Info } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface MenuItemCardProps {
  item: MenuItem;
  onAddClick?: () => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onAddClick }) => {
  const [quantity, setQuantity] = React.useState(1);
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem({
      menu_item_id: item.id,
      name: item.name,
      quantity,
      price: item.price,
      subtotal: item.price * quantity,
    });
    setQuantity(1);
    onAddClick?.();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('rw-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full">
      {/* Item Image - 16:9 aspect ratio */}
      <div className="relative w-full bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden aspect-video">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
            <Info size={40} className="text-orange-300" />
          </div>
        )}
        
        {!item.is_available && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-red-500 px-4 py-2 rounded-lg">
              <span className="text-white font-bold text-lg">Out of Stock</span>
            </div>
          </div>
        )}
      </div>

      {/* Item Details - Flex grow to push buttons down */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Name */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">{item.name}</h3>
        
        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow leading-relaxed">{item.description}</p>

        {/* Price - Always visible and prominent */}
        <div className="flex items-baseline gap-2 mb-5 pb-4 border-b border-gray-100">
          <span className="text-2xl font-bold text-green-600">{formatPrice(item.price)}</span>
          <span className="text-xs text-gray-500 font-medium">per item</span>
        </div>

        {/* Quantity & Add Button - Always pushed to bottom */}
        {item.is_available ? (
          <div className="flex gap-3 items-center mt-auto">
            {/* Quantity Controls */}
            <div className="flex items-center border-2 border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 text-gray-600 hover:bg-orange-100 hover:text-orange-700 transition-colors font-semibold"
                title="Decrease quantity"
              >
                <Minus size={20} />
              </button>
              <span className="px-4 py-2 text-center font-bold min-w-[44px] bg-white text-gray-900 text-lg">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-2 text-gray-600 hover:bg-orange-100 hover:text-orange-700 transition-colors font-semibold"
                title="Increase quantity"
              >
                <Plus size={20} />
              </button>
            </div>
            
            {/* Add Button */}
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-4 rounded-lg active:scale-95 transition-all font-bold text-base shadow-md hover:shadow-lg"
            >
              Add
            </button>
          </div>
        ) : (
          <button 
            disabled 
            className="w-full bg-gray-200 text-gray-500 py-3 px-4 rounded-lg cursor-not-allowed font-semibold text-base"
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
};
