/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0D0D11",
        violet: { neon: "#8B5CF6" },
        pink: { neon: "#EC4899" },
        cyan: { neon: "#06B6D4" },
      },
      fontFamily: {
        display: ["Orbitron", "Rajdhani", "sans-serif"],
        body: ["Rajdhani", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
