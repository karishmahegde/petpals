/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ] /** content tells Tailwind which files to scan for class names. It purges any unused styles from the final build, keeping your CSS tiny */,
  theme: {
    extend: {
      // PetPals design tokens — sync with Figma
      colors: {
        pink: { DEFAULT: "#F472B6", light: "#FBCFE8", dark: "#BE185D" },
        yellow: { DEFAULT: "#FBBF24", light: "#FEF3C7", dark: "#D97706" },
        teal: { DEFAULT: "#2DD4BF", light: "#CCFBF1", dark: "#0F766E" },
      },
    },
  },
  plugins: [],
};
