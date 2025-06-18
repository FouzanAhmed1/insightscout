/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a" },
        dark: {
          50:  "rgb(var(--c-dark-50)  / <alpha-value>)",
          100: "rgb(var(--c-dark-100) / <alpha-value>)",
          200: "rgb(var(--c-dark-200) / <alpha-value>)",
          300: "rgb(var(--c-dark-300) / <alpha-value>)",
          400: "rgb(var(--c-dark-400) / <alpha-value>)",
          500: "rgb(var(--c-dark-500) / <alpha-value>)",
          600: "rgb(var(--c-dark-600) / <alpha-value>)",
          700: "rgb(var(--c-dark-700) / <alpha-value>)",
          800: "rgb(var(--c-dark-800) / <alpha-value>)",
          900: "rgb(var(--c-dark-900) / <alpha-value>)",
          950: "rgb(var(--c-dark-950) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
