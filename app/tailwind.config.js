/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="darcula"], [data-theme="github-dark"], [data-theme="nord-frost"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          app: 'var(--bg-app)',
          header: 'var(--bg-header)',
          sidebar: 'var(--bg-sidebar)',
          panel: 'var(--bg-panel)',
          subbar: 'var(--bg-subbar)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          input: 'var(--bg-input)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
          'active-text': 'var(--text-active)',
          'active-dim': 'var(--text-active-dim)',
          border: 'var(--border)',
          'border-subtle': 'var(--border-subtle)',
          'border-card': 'var(--border-card)',
          'border-active': 'var(--border-active)',
          main: 'var(--text-main)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
          accent: 'var(--accent)',
          'accent-hover': 'var(--accent-hover)',
        }
      }
    },
  },
  plugins: [],
}
