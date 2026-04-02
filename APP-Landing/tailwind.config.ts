import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        croma: {
          primary: "#1e40af",
          secondary: "#2563eb",
          hover: "#1d4ed8",
          light: "#dbeafe",
          dark: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
