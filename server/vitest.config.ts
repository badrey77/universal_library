import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Runs once, before any worker starts: makes sure the test DB exists,
    // is empty of stale data from a previous run, and is fully migrated.
    globalSetup: ["./test/globalSetup.ts"],
    // Runs inside each worker before that file's imports resolve app code
    // (which needs JWT_SECRET/DATABASE_URL/CORS_ORIGIN set already).
    setupFiles: ["./test/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
