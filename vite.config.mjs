import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "dashboard",
  plugins: [react()],
  base: "./",
  // SITE_ENV / SITE_REF (set by the stage workflow) drive the environment label in the dashboard.
  // SITE_ORIGIN is exposed too; all three are public, non-secret values.
  envPrefix: ["VITE_", "SITE_"],
  build: {
    outDir: "../site/dashboard",
    emptyOutDir: true
  }
});

