/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F5F5",
        surface: "#FFFFFF",
        ink: "#11110F",
        muted: "#73736F",
        orange: "#FF5A00"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
        display: ["Arial Narrow", "Roboto Condensed", "Impact", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      boxShadow: {
        float: "0 24px 60px rgba(17, 17, 15, 0.08)"
      }
    }
  },
  plugins: []
};
