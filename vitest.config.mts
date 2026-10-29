import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") } },
  test: {
    environment: "node",
    // DB suites share one throwaway database and reset it between tests.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    // DB-backed suites run via `npm run test:db`, which sets TEST_DATABASE_URL.
    testTimeout: 20_000,
  },
});
