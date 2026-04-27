import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        border: "hsl(var(--border))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        navy: "#07152f",
        portal: {
          red: "#ef233c",
          navy: "#07152f",
          bg: "#f5f6f8",
        },
      },
      fontFamily: {
        bengali: [
          "var(--font-bengali)",
          "Hind Siliguri",
          "Noto Sans Bengali",
          "system-ui",
          "sans-serif",
        ],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: [
          "var(--font-bengali)",
          "Hind Siliguri",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) - 2px)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
        xl: "calc(var(--radius) + 8px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "card-hover":
          "0 4px 12px 0 rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
