#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  GUARD_HTTP,
  INVENTORY_REL,
  REPO_ROOT,
  SOURCE_ROOTS,
  checkRemoteSurfaceInventory
} from "./check-remote-surface-inventory.mjs";

const REQUIRED = Object.freeze([INVENTORY_REL, ...Object.values(SOURCE_ROOTS)]);

let pass = 0;
let fail = 0;

function record(ok, label, detail = "") {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

function withTempTree(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "pg01b-remote-"));
  try {
    for (const rel of REQUIRED) {
      const dest = join(dir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(REPO_ROOT, rel), dest);
    }
    mutate(dir);
    return checkRemoteSurfaceInventory(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function loadInventory(dir) {
  const abs = join(dir, INVENTORY_REL);
  return { abs, inventory: JSON.parse(readFileSync(abs, "utf8")) };
}

function abandonEntry(inventory) {
  return inventory.entries.find(
    (entry) => entry.composition_root === "main" && entry.path === "/api/focuses/:id/abandon"
  );
}

record(checkRemoteSurfaceInventory(REPO_ROOT).length === 0, "live tree inventory matches four composition roots");

const missingPath = withTempTree((dir) => {
  const { abs, inventory } = loadInventory(dir);
  inventory.entries = inventory.entries.filter(
    (entry) => !(entry.composition_root === "main" && entry.path === "/api/focuses/:id/abandon")
  );
  writeFileSync(abs, `${JSON.stringify(inventory, null, 2)}\n`);
});
record(
  missingPath.some((error) => error.includes("unregistered main HTTP method+path:POST /api/focuses/:id/abandon")),
  "dropping an inventory route turns the checker red",
  missingPath.join("; ")
);

const extraRoute = withTempTree((dir) => {
  const abs = join(dir, SOURCE_ROOTS.main);
  const text = readFileSync(abs, "utf8");
  writeFileSync(abs, text.replace('if (pathname === "/health")', 'if (pathname === "/api/pg01b-unlisted" || pathname === "/health")'));
});
record(
  extraRoute.some(
    (error) =>
      error.includes("unregistered main HTTP method+path:GET /api/pg01b-unlisted") ||
      error.includes("unscoped HTTP handler without method:/api/pg01b-unlisted")
  ),
  "unlisted HTTP handler in a composition root turns the checker red",
  extraRoute.join("; ")
);

const bypassGuard = withTempTree((dir) => {
  const abs = join(dir, SOURCE_ROOTS.main);
  const text = readFileSync(abs, "utf8");
  const idx = text.lastIndexOf(GUARD_HTTP);
  if (idx === -1) throw new Error("live main missing HTTP guard to mutate");
  writeFileSync(abs, `${text.slice(0, idx)}disabledRemoteGuard${text.slice(idx + GUARD_HTTP.length)}`);
});
record(
  bypassGuard.some((error) => error.includes("bypasses remote HTTP guard") || error.includes(`main missing ${GUARD_HTTP}`)),
  "removing the main remote HTTP guard turns the checker red",
  bypassGuard.join("; ")
);

const extraWs = withTempTree((dir) => {
  const abs = join(dir, SOURCE_ROOTS.voice);
  const text = readFileSync(abs, "utf8");
  if (!text.includes("switch (msg.t)")) throw new Error("voice switch missing");
  writeFileSync(abs, text.replace("switch (msg.t) {", 'switch (msg.t) {\n      case "pg01b.mutate":\n        break;'));
});
record(
  extraWs.some((error) => error.includes("unregistered voice WS message:pg01b.mutate")),
  "unlisted WS business message turns the checker red",
  extraWs.join("; ")
);

const methodMutation = withTempTree((dir) => {
  const { abs, inventory } = loadInventory(dir);
  const entry = abandonEntry(inventory);
  if (!entry) throw new Error("live inventory missing POST /api/focuses/:id/abandon");
  entry.method = "GET";
  writeFileSync(abs, `${JSON.stringify(inventory, null, 2)}\n`);
});
record(
  methodMutation.some(
    (error) =>
      error.includes("unregistered main HTTP method+path:POST /api/focuses/:id/abandon") ||
      error.includes("inventory HTTP method+path missing in main source:GET /api/focuses/:id/abandon")
  ),
  "mutating inventory HTTP method turns the checker red",
  methodMutation.join("; ")
);

const viaMutation = withTempTree((dir) => {
  const { abs, inventory } = loadInventory(dir);
  const unix = inventory.entries.find((entry) => entry.protocol === "Unix" && entry.path === "/gate");
  if (!unix) throw new Error("live inventory missing unix /gate");
  unix.via = ["tailnet"];
  unix.outcome = { tailnet: "allow" };
  writeFileSync(abs, `${JSON.stringify(inventory, null, 2)}\n`);
});
record(
  viaMutation.some((error) => error.includes("tier1/unix via must be not_applicable:/gate")),
  "mutating inventory via turns the checker red",
  viaMutation.join("; ")
);

const outcomeMutation = withTempTree((dir) => {
  const { abs, inventory } = loadInventory(dir);
  const entry = abandonEntry(inventory);
  if (!entry) throw new Error("live inventory missing POST /api/focuses/:id/abandon");
  entry.outcome = { ...entry.outcome, local: "remote_business_403" };
  writeFileSync(abs, `${JSON.stringify(inventory, null, 2)}\n`);
});
record(
  outcomeMutation.some((error) =>
    error.includes("outcome mismatch main HTTP POST /api/focuses/:id/abandon via=local")
  ),
  "mutating inventory outcome turns the checker red",
  outcomeMutation.join("; ")
);

if (fail > 0) {
  process.stderr.write(`[fail] remote-surface-inventory self-test ${fail} failed, ${pass} passed\n`);
  process.exit(1);
}
process.stdout.write(`[ok] remote-surface-inventory self-test ${pass} passed\n`);
