/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surcante: {
          violeta: "#6E3FA3",
          violetaOscuro: "#4A2A70",
          negro: "#0A0A0C",
          gris: "#A0A0A8",
        },
      },
    },
  },
  plugins: [],
};
