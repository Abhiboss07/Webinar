import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The admin talks to the backend API. In dev, set VITE_API_BASE in admin/.env
// (defaults to http://localhost:4000). In production it is baked at build time.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
