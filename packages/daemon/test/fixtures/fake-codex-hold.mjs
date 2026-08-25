#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const marker = join(dirname(fileURLToPath(import.meta.url)), "fake-codex-hold.marker");

if (args[0] === "--grandchild") {
  const role = args[1] ?? "unknown";
  process.on("SIGTERM", () => {
    appendFileSync(marker, `${role}-SIGTERM\n`, "utf8");
    process.exit(0);
  });
  appendFileSync(marker, `${role}-started:${process.pid}\n`, "utf8");
  setInterval(() => {}, 1000);
} else {
  if (args.includes("--version")) {
    process.stdout.write("codex-cli 1.0.0\n");
    process.exit(0);
  }
  if (args[0] === "login" && args[1] === "status") {
    process.stdout.write("Logged in\n");
    process.exit(0);
  }

  const self = fileURLToPath(import.meta.url);
  const inherit = spawn(process.execPath, [self, "--grandchild", "inherit"], { stdio: "inherit" });
  const ignore = spawn(process.execPath, [self, "--grandchild", "ignore"], { stdio: "ignore" });
  process.on("SIGTERM", () => {
    appendFileSync(marker, "parent-SIGTERM\n", "utf8");
    try { inherit.kill("SIGTERM"); } catch { /* 已退 */ }
    try { ignore.kill("SIGTERM"); } catch { /* 已退 */ }
    process.exit(0);
  });
  writeFileSync(marker, `started:${process.pid}\n`, "utf8");
  setInterval(() => {}, 1000);
}
