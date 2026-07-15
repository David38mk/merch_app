/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: "#f1efff",
          100: "#e5e1ff",
          200: "#cdc6ff",
          300: "#ab9dff",
          400: "#8b78fb",
          500: "#6d5efc",
          600: "#5b45ef",
          700: "#4c37cf",
          800: "#3f30a6",
          900: "#372d83",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        pop: "0 8px 24px -6px rgb(16 24 40 / 0.12)",
      },
    },
  },
  plugins: [],
};
