/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'heading': ['Plus Jakarta Sans', 'sans-serif'],
        'handwriting': ['Caveat', 'cursive'],
        'handwriting-alt': ['Patrick Hand', 'cursive'],
        'admin-body': ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'admin-display': ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
        },
      },
    },
  },
  plugins: [],
}
