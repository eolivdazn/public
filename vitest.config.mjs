import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["dashboard/src/**/*.integration.test.jsx", "scripts/**/*.integration.test.mjs"]
  }
});
