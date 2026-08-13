import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Neutral dark theme with a You.com blue accent. Swap these tokens for the
// official brand palette in one place; every component reads from here.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0B0E14",
        panel: "#121724",
        edge: "#1F2637",
        ink: "#E7EBF4",
        muted: "#939DB3",
        accent: "#4D6BFF",
        accent2: "#8B6BFF",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [typography],
} satisfies Config;
