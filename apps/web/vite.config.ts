import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  publicDir: path.resolve(repoRoot, "public"),
  resolve: {
    alias: {
      "@shared": path.resolve(repoRoot, "packages/shared"),
    },
  },
  build: {
    outDir: path.resolve(repoRoot, "dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: { "/api": "http://localhost:5174" },
    fs: { allow: [repoRoot] },
  },
  test: {
    globals: true,
    environment: "node",
    root: repoRoot,
    include: [
      "apps/web/**/*.test.ts",
      "apps/api/**/*.test.ts",
      "packages/shared/**/*.test.ts",
    ],
  },
});
