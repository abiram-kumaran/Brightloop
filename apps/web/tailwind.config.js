/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          cream: "#F3EBE0",
          creamSoft: "#F7F2EA",
          creamDeep: "#EDE4D7",
          forest: "#48584B",
          forestDark: "#303D33",
          ink: "#323429",
          taupe: "#C3B9B3",
          stone: "#B7B0A9",
          coffee: "#795F4E",
          coffeeDark: "#553A2E",
        },
        semantic: {
          success: "#3F7658",
          successBg: "#E6EFE7",
          warning: "#A87532",
          warningBg: "#F5EBDD",
          danger: "#A34F45",
          dangerBg: "#F4E6E2",
          info: "#536E80",
          infoBg: "#E8EEF0",
        },
        surface: {
          page: "#F3EBE0",
          card: "#F7F2EA",
          muted: "#EDE4D7",
          dark: "#303D33",
        },
        text: {
          primary: "#323429",
          secondary: "#716D64",
          muted: "#918A80",
          inverse: "#F7F2EA",
        },
        border: {
          default: "#D8CEC1",
          subtle: "#E7DED2",
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"SFMono-Regular"', "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(50, 52, 41, 0.045)",
        popover: "0 8px 28px rgba(50, 52, 41, 0.10)",
        modal: "0 18px 48px rgba(50, 52, 41, 0.14)",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};
