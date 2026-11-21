/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', '"Courier New"', 'Courier', 'monospace'],
        hand: ['"Caveat"', '"Segoe Print"', '"Comic Sans MS"', 'cursive'],
        condensed: ['"Oswald"', '"Arial Narrow"', 'Impact', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
