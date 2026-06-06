import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050505",
          900: "#0a0a0a",
          800: "#101012",
          700: "#16161a",
        },
        accent: {
          DEFAULT: "#00E5FF",
          soft: "#5cf2ff",
          deep: "#0096a8",
        },
        signal: {
          success: "#00FF88",
          warning: "#FFD166",
          danger: "#FF5959",
        },
        arena: {
          line: "rgba(255,255,255,0.08)",
          lineStrong: "rgba(255,255,255,0.16)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-geist)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      animation: {
        "pulse-soft": "pulse-soft 3.2s ease-in-out infinite",
        "spin-slow": "spin 60s linear infinite",
        "drift": "drift 18s ease-in-out infinite",
        "shimmer": "shimmer 6s linear infinite",
        "flow": "flow 8s linear infinite",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "drift": {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-8px,0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "flow": {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
