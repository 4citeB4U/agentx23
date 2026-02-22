/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // System font stack — offline safe, Pi friendly, zero network requests
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif'
        ],
        mono: [
          'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Cascadia Code',
          'Consolas', 'Liberation Mono', 'Courier New', 'monospace'
        ],
      },
    },
  },
  plugins: [],
}
