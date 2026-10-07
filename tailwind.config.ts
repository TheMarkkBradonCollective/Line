import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff",
        card: "#ffffff",
        ink: "#2f2f2f",
        muted: "#6b6b6b",
        rule: "#e4e4e4",
        pine: "#00bf8f",
        "pine-deep": "#009e78",
        stamp: "#00bf8f",
        "stamp-deep": "#009e78",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "ui-serif", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(47, 47, 47, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
