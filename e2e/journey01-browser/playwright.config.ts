import "./mode-keep.js";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { assertJourneyRoundEnv, DAEMON_PORT, EVIDENCE } from "./constants.js";

assertJourneyRoundEnv();

export default defineConfig({
  testDir: ".",
  testMatch: "journey01-seven-step.spec.ts",
  timeout: 240_000,
  retries: 0,
  workers: 1,
  outputDir: join(EVIDENCE, "playwright-output"),
  globalSetup: "./global-setup.ts",
  use: {
    viewport: { width: 1440, height: 900 },
    baseURL: `http://localhost:${DAEMON_PORT}`
  },
  reporter: [["list"]]
});
