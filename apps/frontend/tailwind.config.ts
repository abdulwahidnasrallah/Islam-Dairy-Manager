import type { Config } from "tailwindcss";

/**
 * Design tokens for IDM.
 * Colors are centralized here — components must reference these tokens
 * (bg-primary, text-danger, ...) rather than hardcoding hex values.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        arabic: ["Cairo", "Tajawal", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#0F6E5C",
          50: "#E6F4F1",
          100: "#C1E4DC",
          500: "#0F6E5C",
          600: "#0C5A4B",
          700: "#09453A",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F8FA",
          dark: "#111827",
        },
        success: "#1E8E5A",
        warning: "#C77A1F",
        danger: "#C33C3C",
        info: "#2563A8",
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
