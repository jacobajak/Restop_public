'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Menu as MenuIcon, X, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { ThemeToggle } from '@/components/common/ThemeToggle';

interface HeaderProps {
  restaurantName: string;
  onCartClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ restaurantName, onCartClick }) => {
  const { cart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-lg border-b border-gray-100 dark:border-gray-800 transition-colors">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
              R
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{restaurantName}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Order Now</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 mx-auto">
            <a href="#menu" className="text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 font-semibold transition duration-200">
              Menu
            </a>
            <a href="#about" className="text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 font-semibold transition duration-200">
              About
            </a>
          </nav>

          {/* Theme Toggle + Cart Button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ThemeToggle />
            <button
              onClick={onCartClick}
              className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 dark:from-orange-600 dark:to-orange-700 text-white rounded-lg transition-all font-semibold shadow-md hover:shadow-lg active:scale-95 flex-shrink-0"
            >
              <ShoppingCart size={20} />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg">
                  {itemCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-lg transition font-semibold"
          >
            {mobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 flex flex-col gap-4">
            <a href="#menu" className="text-gray-600 hover:text-primary font-medium transition">
              Menu
            </a>
            <a href="#about" className="text-gray-600 hover:text-primary font-medium transition">
              About
            </a>
          </nav>
        )}
      </div>
    </header>
  );
};
