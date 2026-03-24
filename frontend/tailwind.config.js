/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // Enables `landscape:` and `portrait:` variants for orientation-based layouts
    function ({ addVariant }) {
      addVariant('landscape', '@media (orientation: landscape)');
      addVariant('portrait', '@media (orientation: portrait)');
    },
  ],
}
