/** @type {import('tailwindcss').Config} */
module.exports = {
  // Enable class‑based dark mode
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Semantic token utilities that map to CSS custom properties
        "bg-page": "var(--bg-page)",
        "bg-surface": "var(--bg-surface)",
        "bg-sidebar": "var(--bg-sidebar)",
        "bg-header": "var(--bg-header)",
        "bg-input": "var(--bg-input)",
        "bg-hover": "var(--bg-hover)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
        "shadow-sm": "var(--shadow-sm)",
        "shadow-md": "var(--shadow-md)",
      },
    },
  },
  plugins: [],
};
