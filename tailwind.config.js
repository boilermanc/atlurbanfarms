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
          light: 'var(--color-brand-light)',
        },
        theme: {
          'text-primary': 'var(--color-text-primary)',
          'text-secondary': 'var(--color-text-secondary)',
          'text-muted': 'var(--color-text-muted)',
          'bg-page': 'var(--bg-color)',
          'bg-surface': 'var(--bg-secondary)',
          'bg-muted': 'var(--color-bg-muted)',
          'bg-dark': 'var(--color-bg-dark)',
          'border': 'var(--color-border-default)',
          'border-light': 'var(--color-border-light)',
          'success': 'var(--color-success)',
          'success-light': 'var(--color-success-light)',
          'error': 'var(--color-error)',
          'error-light': 'var(--color-error-light)',
          'warning': 'var(--color-warning)',
          'warning-light': 'var(--color-warning-light)',
          'info': 'var(--color-info)',
          'info-light': 'var(--color-info-light)',
          'sale': 'var(--color-sale)',
          'link': 'var(--color-link)',
        },
      },
      borderRadius: {
        'button': 'var(--radius-button)',
        'card': 'var(--radius-card)',
        'input-field': 'var(--radius-input)',
      },
    },
  },
  plugins: [],
}
