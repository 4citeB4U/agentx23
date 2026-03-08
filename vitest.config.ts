// LEEWAY HEADER BLOCK
// File: vitest.config.ts
// Purpose: Agent Lee OS Vitest configuration
// Security: LEEWAY-CORE-2026 compliant
// Performance: Optimized for sovereign agentic testing
// Discovery: Part of Agent Lee OS test pipeline

import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: path.resolve(__dirname, "."),
    include: [
      "tests/unit/**/*.test.ts",
      "tests/components/**/*.test.ts",
      "tests/contracts/**/*.test.ts",
      "tests/property/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["core/**", "backend/src/**"],
      exclude: ["**/node_modules/**", "**/*.d.ts"],
    },
    // timeout: 30_000, // Removed: not a valid property for InlineConfig
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "core"),
      "@backend": path.resolve(__dirname, "backend/src"),
      // "@ports": "6000-6020", // Removed invalid alias; port discipline handled elsewhere
    },
  },
});
