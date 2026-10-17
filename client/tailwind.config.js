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
          lightest: "#FFF6E5",
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
        green: {
          DEFAULT: "#91B381",
        },
        red: {
          DEFAULT: "#FF6262",
        },
        neutral: {
          white: "#FFFFFF",
          offwhite: "#FAFAFA",
          lightgray: "#F0F0F0",
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
      // Slides an oversized gradient (e.g. bg-[length:300%_300%]) corner to corner
      // and back, so its colours drift around — the adopter AI button's hover.
      keyframes: {
        "gradient-drift": {
          "0%, 100%": { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
        },
      },
      animation: {
        "gradient-drift": "gradient-drift 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
