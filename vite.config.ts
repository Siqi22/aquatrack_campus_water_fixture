import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { loadPublicSupabaseEnv } from "./src/lib/loadPublicEnv";

loadPublicSupabaseEnv();

// Vercel needs absolute asset paths (`/`); Capacitor local bundle uses relative (`./`).
const base = process.env.VERCEL ? "/" : "./";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    ...(process.env.VITE_VERCEL_APP_URL
      ? {
          proxy: {
            "/api": {
              target: process.env.VITE_VERCEL_APP_URL.replace(/\/$/, ""),
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : {}),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
