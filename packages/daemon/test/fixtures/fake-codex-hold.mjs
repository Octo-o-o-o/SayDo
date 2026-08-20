#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const marker = join(dirname(fileURLToPath(import.meta.url)), "fake-codex-hold.marker");

if (args[0] === "--grandchild") {
  const role = args[1] ?? "unknown";
  appendFileSync(marker, `${role}-started:${process.pid}\n`, "utf8");
  process.on("SIGTERM", () => {
    appendFileSync(marker, `${role}-SIGTERM\n`, "utf8");
    process.exit(0);
  });
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

  writeFileSync(marker, `started:${process.pid}\n`, "utf8");
  const self = fileURLToPath(import.meta.url);
  spawn(process.execPath, [self, "--grandchild", "inherit"], { stdio: "inherit" }).unref();
  spawn(process.execPath, [self, "--grandchild", "ignore"], { stdio: "ignore" }).unref();
  process.on("SIGTERM", () => {
    appendFileSync(marker, "parent-SIGTERM\n", "utf8");
    process.exit(0);
  });
  setInterval(() => {}, 1000);
}
