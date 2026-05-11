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
        // DineFlow Primary Brand - Enhanced Modern Palette
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',  // DineFlow Orange (Main)
          600: '#EA580C',  // Darker shade
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Semantic Status Colors - Updated for better contrast
        success: {
          50: '#F0FDF4',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#F0F9FF',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        // Neutral Grays - Professional gradient
        neutral: {
          0: '#FFFFFF',
          25: '#FAFBFC',
          50: '#F8FAFC',
          100: '#F1F5F9',
          150: '#E8EEF4',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        // Dark Mode Support - Enhanced
        dark: {
          bg: '#0F172A',
          card: '#1E293B',
          text: '#E2E8F0',
          border: '#475569',
        },
        // Brand gradients
        gradient: {
          warm: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
          cool: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
          success: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Standard typography scale
        'xxs': ['10px', { lineHeight: '1.2' }],
        'xs': ['12px', { lineHeight: '1.4' }],
        'sm': ['14px', { lineHeight: '1.43' }],
        'base': ['16px', { lineHeight: '1.5' }],
        'lg': ['18px', { lineHeight: '1.56' }],
        'xl': ['20px', { lineHeight: '1.6' }],
        '2xl': ['24px', { lineHeight: '1.33' }],
        '3xl': ['30px', { lineHeight: '1.2' }],
        '4xl': ['36px', { lineHeight: '1.11' }],
        '5xl': ['48px', { lineHeight: '1' }],
        // Semantic typography for KitchenLink design system
        'page-title': ['36px', { fontWeight: '700', lineHeight: '1.11' }],
        'section-title': ['24px', { fontWeight: '600', lineHeight: '1.33' }],
        'card-title': ['18px', { fontWeight: '600', lineHeight: '1.33' }],
        'metric': ['28px', { fontWeight: '700', lineHeight: '1.1' }],
        'body': ['14px', { fontWeight: '400', lineHeight: '1.5' }],
        'label': ['12px', { fontWeight: '500', lineHeight: '1.4' }],
        'caption': ['11px', { fontWeight: '400', lineHeight: '1.45' }],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      lineHeight: {
        'none': '1',
        'tight': '1.25',
        'snug': '1.375',
        'normal': '1.5',
        'relaxed': '1.625',
        'loose': '2',
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
        '2xl': '16px',
      },
      boxShadow: {
        // Modern shadow system inspired by leading apps
        'none': 'none',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        // Hover effect shadows
        'hover': '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
        // Card shadows
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-lg': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      gridTemplateColumns: {
        '12': 'repeat(12, minmax(0, 1fr))',
      },
      animation: {
        'scale': 'scale 0.2s ease-in-out',
        'fade': 'fade 0.2s ease-in-out',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'bounce-soft': 'bounce-soft 1s infinite',
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
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [],
};
