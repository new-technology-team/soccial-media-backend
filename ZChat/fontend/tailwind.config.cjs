/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff9f2",
          100: "#d9f2e0",
          500: "#2f9e5b",
          700: "#1f6f3f",
          900: "#123a23"
        }
      }
    }
  },
  plugins: []
};
