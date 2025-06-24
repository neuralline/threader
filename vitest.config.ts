// vitest.config.ts
// Test configuration for Cyre Threader

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // Global test settings
    globals: true,

    // Timeout settings
    testTimeout: 30000, // 30 seconds for threading tests
    hookTimeout: 10000, // 10 seconds for setup/teardown

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/types.ts",
        "examples/**/*",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Setup files
    setupFiles: ["./tests/setup.ts"],

    // File patterns
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],

    // Watch mode settings
    watchExclude: ["node_modules/**", "dist/**", "*.node"],

    // Parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@tests": resolve(__dirname, "tests"),
    },
  },

  // Build configuration for tests
  esbuild: {
    target: "node16",
  },
});
