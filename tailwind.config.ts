import type { Config } from "tailwindcss";

/** Every color is a CSS variable with RGB channels, so light and dark mode share one set of names. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        "surface-3": token("surface-3"),
        ink: token("ink"),
        "ink-2": token("ink-2"),
        "ink-3": token("ink-3"),
        line: token("line"),
        brand: {
          DEFAULT: token("brand"),
          deep: token("brand-deep"),
          strong: token("brand-strong"),
          soft: token("brand-soft"),
          tint: token("brand-tint"),
          on: token("on-brand"),
        },
        heart: token("heart"),
        danger: token("danger"),
        // Older names used across staff screens. They now follow the tokens too.
        paper: token("bg"),
        card: token("surface"),
        muted: token("ink-2"),
        rule: token("line"),
        pine: token("brand"),
        "pine-deep": token("brand-deep"),
        stamp: token("brand"),
        "stamp-deep": token("brand-deep"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        serif: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        e1: "var(--e1)",
        e2: "var(--e2)",
        e3: "var(--e3)",
        card: "var(--e1)",
        glow: "0 10px 28px -6px rgb(var(--brand) / 0.55)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      maxWidth: {
        feed: "600px",
      },
    },
  },
  plugins: [],
};

export default config;
