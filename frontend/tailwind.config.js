/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DineFlow Primary Brand
        primary: {
          500: '#F97316',  // DineFlow Orange
          600: '#EA580C',  // Darker shade
        },
        // Semantic Status Colors
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        // Neutral Grays
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          700: '#334155',
          900: '#0F172A',
        },
        // Dark Mode Support
        dark: {
          bg: '#0F172A',
          card: '#1E293B',
          text: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['24px', { fontWeight: '600', lineHeight: '1.2' }],
        'section-title': ['18px', { fontWeight: '600', lineHeight: '1.3' }],
        'metric': ['28px', { fontWeight: '700', lineHeight: '1.1' }],
        'body': ['14px', { fontWeight: '400', lineHeight: '1.5' }],
        'label': ['12px', { fontWeight: '500', lineHeight: '1.4' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
      },
      minHeight: {
        'touch': '44px',  // WCAG minimum touch target
      },
      borderRadius: {
        'xl': '12px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.05)',
        'md': '0 4px 6px rgba(0,0,0,0.1)',
      },
      gridTemplateColumns: {
        '12': 'repeat(12, minmax(0, 1fr))',
      },
      animation: {
        'scale': 'scale 0.2s ease-in-out',
        'fade': 'fade 0.2s ease-in-out',
      },
      keyframes: {
        scale: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
