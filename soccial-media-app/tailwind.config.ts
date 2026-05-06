import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0052ce",
          light: "#789dff",
          dark: "#003d9a",
        },
        background: "#f3f5f8",
        surface: "#ffffff",
        surfaceSecondary: "#f5f6f7",
        text: "#1f2733",
        textSecondary: "#58606e",
        textMuted: "#7e8592",
        border: "#dbe0e6",
        borderLight: "#e5e7eb",
        danger: "#dc2626",
        success: "#16a34a",
        warning: "#d97706",
      },
    },
  },
  plugins: [],
} satisfies Config;
