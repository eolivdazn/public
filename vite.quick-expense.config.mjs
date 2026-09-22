import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "dashboard",
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  build: {
    outDir: "../site/vendor",
    emptyOutDir: false,
    lib: {
      entry: "src/quick-expense-widget.jsx",
      formats: ["es"],
      fileName: "quick-expense"
    }
  }
});
