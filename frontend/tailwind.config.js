/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette
        brand: {
          50:  '#f3f0ff',
          100: '#e9e0ff',
          200: '#d4c0ff',
          300: '#b894ff',
          400: '#9b5cff',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b0764',
          950: '#1e0338',
        },
        surface: {
          DEFAULT: '#0c0c14',
          50:  '#f8f8fc',
          100: '#eeedf5',
          200: '#d5d4e0',
          300: '#b0afbf',
          400: '#85849a',
          500: '#65647a',
          600: '#4e4d62',
          700: '#3a3950',
          800: '#1e1d30',
          850: '#161525',
          900: '#10101c',
          950: '#0a0a12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(124, 58, 237, 0.25)',
        'glow':    '0 0 25px -5px rgba(124, 58, 237, 0.35)',
        'glow-lg': '0 0 50px -12px rgba(124, 58, 237, 0.45)',
        'glow-xl': '0 0 80px -20px rgba(124, 58, 237, 0.5)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
        'card':    '0 8px 32px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 16px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
        'elevated': '0 24px 64px -16px rgba(0,0,0,0.7)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'mesh-rotate': 'mesh-rotate 20s linear infinite',
        'countdown-ring': 'countdown-ring 1s linear',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(124, 58, 237, 0.3)' },
          '50%': { boxShadow: '0 0 40px -5px rgba(124, 58, 237, 0.6)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'mesh-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'countdown-ring': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '283' },
        },
      },
    },
  },
  plugins: [
    // Enables `landscape:` and `portrait:` variants for orientation-based layouts
    function ({ addVariant }) {
      addVariant('landscape', '@media (orientation: landscape)');
      addVariant('portrait', '@media (orientation: portrait)');
    },
  ],
}
