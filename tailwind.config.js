/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Geist',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        background: 'var(--bg-primary)',
        surface: 'var(--bg-surface)',
        'surface-muted': 'var(--bg-surface-muted)',
        foreground: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        border: 'var(--border-subtle)',
        brand: {
          DEFAULT: 'var(--brand-emerald)',
          hover: 'var(--brand-emerald-hover)',
          foreground: 'var(--brand-foreground)',
          soft: 'var(--brand-soft)',
          'soft-foreground': 'var(--brand-soft-foreground)',
        },
        semantic: {
          income: 'var(--semantic-income)',
          'income-soft': 'var(--semantic-income-soft)',
          expense: 'var(--semantic-expense)',
          'expense-soft': 'var(--semantic-expense-soft)',
          warning: 'var(--semantic-warning)',
          'warning-soft': 'var(--semantic-warning-soft)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(34, 40, 36, 0.04)',
        card: '0 1px 3px 0 rgba(34, 40, 36, 0.06), 0 1px 2px -1px rgba(34, 40, 36, 0.04)',
      },
    },
  },
  plugins: [],
};

