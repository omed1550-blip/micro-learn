import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#252523",
        surface: "#2f2f2d",
        "surface-hover": "#3a3a37",
        primary: "#6366F1",
        "primary-hover": "#818CF8",
        "primary-glow": "rgba(99, 102, 241, 0.3)",
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",
        "text-primary": "#F5F5F4",
        "text-secondary": "#A8A8A3",
        "text-muted": "#6B6B66",
        border: "#3a3a37",
      },
    },
  },
  plugins: [],
};
export default config;
