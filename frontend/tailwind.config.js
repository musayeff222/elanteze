/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14211b",
        mist: "#5d6b64",
        paper: "#f3f6f4",
        brand: {
          50: "#e8f6f0",
          100: "#c9eadc",
          600: "#0d7a55",
          700: "#0b6244",
          800: "#084833",
        },
        ambercta: "#e39b12",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,33,27,.06), 0 10px 30px rgba(20,33,27,.05)",
      },
      fontFamily: {
        sans: ["Noto Sans", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
