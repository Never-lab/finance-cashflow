import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:5174" },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
