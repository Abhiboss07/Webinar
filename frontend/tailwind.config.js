/** Tailwind config — the Youngness design system.
 *  Compiles to css/main.css (see package.json → build:css). The `content`
 *  globs scan the HTML AND the JS template strings (sections/, js/, config/),
 *  so every utility class used at runtime — including arbitrary values like
 *  h-[52px] and bg-[radial-gradient(...)] — is generated. */
module.exports = {
  content: [
    "./index.html",
    "./thank-you.html",
    "./js/**/*.js",
    "./sections/**/*.js",
    "./config/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        navy:   { light: "#2f5a78", DEFAULT: "#1e3d52", deep: "#0f2433" },
        terra:  { DEFAULT: "#c45c3e", dark: "#a34a31", deep: "#6d3220" },
        clinic: { DEFAULT: "#0f766e", dark: "#0d9488", deep: "#115e59" },
        gold:   { DEFAULT: "#b8952f", dark: "#9a7d26", deep: "#6b5618" },
        cream: "#faf6ef", paper: "#fffcf8", sand: "#f3ebe1", dune: "#e8dfd2", edge: "#ddd2c4",
        ink:    { DEFAULT: "#171412", light: "#5a534c", muted: "#7a7268" },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ['"DM Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      boxShadow: {
        sm: "0 2px 8px rgba(23,20,18,0.06)", md: "0 8px 24px rgba(23,20,18,0.08)",
        card: "0 16px 48px rgba(15,36,51,0.10)", lg: "0 28px 64px rgba(15,36,51,0.14)",
        gold: "0 0 48px rgba(184,149,47,0.18)",
      },
      borderRadius: { sm: "10px", DEFAULT: "14px", lg: "22px", xl: "32px" },
      maxWidth: { container: "1180px" },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
