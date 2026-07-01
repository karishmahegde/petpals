/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // PetPals design tokens — synced with Figma Brand Design Kit
      colors: {
        rose: {
          lightest: "#FFF5F5",
          light: "#F0DFDF",
          DEFAULT: "#ECC7C7",
          md: "#DFA8A8",
          dark: "#CA7D7D",
        },
        gold: {
          light: "#FFE7B9",
          DEFAULT: "#FFD78A",
          md: "#FFCA62",
          dark: "#D9A745",
        },
        teal: {
          light: "#E3EEEF",
          DEFAULT: "#D6ECEF",
          md: "#B0E5EC",
          dark: "#6BA8B0",
        },
        neutral: {
          white: "#FFFFFF",
          offwhite: "#FAFAFA",
          gray: "#8A8A8A",
          charcoal: "#454545",
          dark: "#1A1A1A",
          black: "#000000",
        },
      },
      fontFamily: {
        display: ["Benne", "serif"],
        body: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [],
};
