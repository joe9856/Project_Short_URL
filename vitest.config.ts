import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    include: ["gateway/tests/**/*.test.ts", "services/*/tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 15000,
    fileParallelism: false,
  },
});
