'use client';

import React, { useState } from 'react';
import { Button, Card, Input } from '@/components/common';

export default function DesignSystemShowcase() {
  const [inputValue, setInputValue] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: '🎨 Overview' },
    { id: 'buttons', label: '🔘 Buttons' },
    { id: 'cards', label: '📦 Cards' },
    { id: 'inputs', label: '📝 Inputs' },
    { id: 'colors', label: '🎭 Colors' },
    { id: 'typography', label: '✍️ Typography' },
    { id: 'shadows', label: '✨ Shadows' },
    { id: 'animations', label: '🎬 Animations' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-primary-600 to-info-600 bg-clip-text text-transparent mb-4">
            RESTOP Design System
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 font-medium">
            Modern restaurant app components inspired by Zomato, Swiggy & Uber Eats
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-12 bg-white dark:bg-neutral-900 rounded-2xl p-2 shadow-card">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-250 ${
                selectedTab === tab.id
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-2xl text-white">
                  🎨
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Color Palette</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    11 professional color shades per color with semantic variants and dark mode support
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center text-2xl text-white">
                  ✨
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Shadows & Depth</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    8 elevation levels for visual hierarchy and depth perception
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning-500 to-warning-600 flex items-center justify-center text-2xl text-white">
                  🎬
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Animations</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    Smooth micro-interactions: slide, pulse, bounce, and scale effects
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Buttons Tab */}
        {selectedTab === 'buttons' && (
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Button Variants</h2>
              
              <Card>
                <div className="space-y-8">
                  {/* Primary */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Primary (Gradient)</h3>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="primary" size="sm">Small</Button>
                      <Button variant="primary" size="md">Medium</Button>
                      <Button variant="primary" size="lg">Large</Button>
                      <Button variant="primary" size="lg" isLoading>Loading</Button>
                      <Button variant="primary" size="md" disabled>Disabled</Button>
                    </div>
                  </div>

                  {/* Secondary */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Secondary (Outline)</h3>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="secondary" size="sm">Small</Button>
                      <Button variant="secondary" size="md">Medium</Button>
                      <Button variant="secondary" size="lg">Large</Button>
                    </div>
                  </div>

                  {/* Success */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Success</h3>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="success" size="sm">Confirm</Button>
                      <Button variant="success" size="md">Approve</Button>
                      <Button variant="success" size="lg">Complete Order</Button>
                    </div>
                  </div>

                  {/* Danger */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Danger</h3>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="danger" size="sm">Delete</Button>
                      <Button variant="danger" size="md">Cancel Order</Button>
                      <Button variant="danger" size="lg">Remove</Button>
                    </div>
                  </div>

                  {/* Ghost */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Ghost (Transparent)</h3>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="ghost" size="sm">Link</Button>
                      <Button variant="ghost" size="md">More Info</Button>
                      <Button variant="ghost" size="lg">View Details</Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Cards Tab */}
        {selectedTab === 'cards' && (
          <div className="space-y-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Card Components</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card hoverable>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Metric Card</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">Hoverable card with elevation effect</p>
                  <div className="flex items-end gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Orders</p>
                      <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">$ 12,450</p>
                    </div>
                    <p className="text-sm text-success-600 dark:text-success-400 font-semibold">↑ 12%</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Info Card</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">Static card with consistent styling</p>
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-success-500"></div>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">You're all set!</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Inputs Tab */}
        {selectedTab === 'inputs' && (
          <div className="space-y-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Input Components</h2>
            
            <Card>
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="example@restaurant.com"
                    hint="We'll never share your email"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    hint="Minimum 8 characters"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    disabled
                  />
                  <Input
                    label="With Error"
                    type="text"
                    placeholder="Error state"
                    error="This field is required"
                  />
                </div>

                <div className="grid md:grid-cols-1 gap-8">
                  <div>
                    <label className="block text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
                      Focus State Example
                    </label>
                    <Input
                      label="Try focusing on this input"
                      type="text"
                      placeholder="Click to see modern focus state"
                      autoFocus
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Colors Tab */}
        {selectedTab === 'colors' && (
          <div className="space-y-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Color Palette</h2>
            
            {[
              { name: 'Primary', shades: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] },
              { name: 'Success', shades: ['50', '500', '600', '700'] },
              { name: 'Warning', shades: ['50', '500', '600', '700'] },
              { name: 'Error', shades: ['50', '500', '600', '700'] },
              { name: 'Info', shades: ['50', '500', '600', '700'] },
            ].map((colorFamily) => (
              <div key={colorFamily.name}>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">{colorFamily.name}</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
                  {colorFamily.shades.map((shade) => (
                    <Card key={`${colorFamily.name}-${shade}`} noPadding>
                      <div
                        className={`h-24 rounded-2xl flex items-end justify-center p-2 text-xs font-semibold text-white bg-${colorFamily.name.toLowerCase()}-${shade}`}
                      >
                        {shade}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Typography Tab */}
        {selectedTab === 'typography' && (
          <div className="space-y-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Typography Scale</h2>
            
            <Card>
              <div className="space-y-8">
                <div><p className="text-5xl font-bold">5xl - Display Heading (48px)</p></div>
                <div><p className="text-4xl font-bold">4xl - Large Heading (36px)</p></div>
                <div><p className="text-3xl font-bold">3xl - Section Heading (30px)</p></div>
                <div><p className="text-2xl font-semibold">2xl - Card Title (24px)</p></div>
                <div><p className="text-xl font-semibold">xl - Subheading (20px)</p></div>
                <div><p className="text-lg font-medium">lg - Body Large (18px)</p></div>
                <div><p className="text-base font-normal">base - Body Text (16px)</p></div>
                <div><p className="text-sm font-normal">sm - Body Small (14px)</p></div>
                <div><p className="text-xs font-normal">xs - Caption (12px)</p></div>
                <div><p className="text-xxs font-normal">xxs - Tiny Text (10px)</p></div>
              </div>
            </Card>
          </div>
        )}

        {/* Shadows Tab */}
        {selectedTab === 'shadows' && (
          <div className="space-y-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Shadow Elevation System</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'xs', id: 'xs' },
                { name: 'sm', id: 'sm' },
                { name: 'md', id: 'md' },
                { name: 'lg', id: 'lg' },
                { name: 'xl', id: 'xl' },
                { name: '2xl', id: '2xl' },
                { name: 'card', id: 'card' },
                { name: 'card-lg', id: 'card-lg' },
              ].map((shadow) => (
                <div key={shadow.id} className="space-y-3">
                  <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">shadow-{shadow.name}</h3>
                  <div className={`h-32 bg-white dark:bg-neutral-800 rounded-xl shadow-${shadow.id}`}></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Animations Tab */}
        {selectedTab === 'animations' && (
          <div className="space-y-12">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">Animation Effects</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Pulse Soft</h3>
                  <div className="h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl animate-pulse-soft"></div>
                </div>
              </Card>

              <Card>
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Slide In</h3>
                  <div className="h-16 bg-gradient-to-r from-success-500 to-success-600 rounded-xl animate-slide-in"></div>
                </div>
              </Card>

              <Card>
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Bounce Soft</h3>
                  <div className="h-16 bg-gradient-to-r from-warning-500 to-warning-600 rounded-xl animate-bounce-soft"></div>
                </div>
              </Card>

              <Card>
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Scale</h3>
                  <div className="h-16 bg-gradient-to-r from-error-500 to-error-600 rounded-xl animate-scale"></div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center pt-8 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            RESTOP Design System • Inspired by modern restaurant apps • Built with Tailwind CSS + React
          </p>
        </div>
      </div>
    </div>
  );
}
