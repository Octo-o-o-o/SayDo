import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-tmp-cleanup.ts"],
    setupFiles: ["./test/setup.ts"],
    maxWorkers: 4,
    testTimeout: 15_000
  }
});
