#!/usr/bin/env node
// 跨 OS 三进程入口:先 daemon health,再 pipeline 与 console。
// Windows 只杀本脚本 spawn 的直接子进程,禁止 taskkill /T 与 killOwnedTree。
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env["SAYDO_DAEMON_PORT"] ?? "47100";
const children = [];
let shuttingDown = false;

function resolvePe(name) {
  if (process.platform !== "win32") return { file: name, prefix: [], options: {} };
  const pathext = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean);
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const suffix of pathext) {
      const candidate = join(dir, `${name}${suffix}`);
      if (!existsSync(candidate)) continue;
      const ext = extname(candidate).toLowerCase();
      if (ext === ".exe" || ext === ".com") {
        return { file: candidate, prefix: [], options: { windowsHide: true } };
      }
    }
  }
  return { file: name, prefix: [], options: { windowsHide: true } };
}

function resolvePnpm() {
  const corepack = join(dirname(process.execPath), "node_modules", "corepack", "dist", "pnpm.js");
  if (existsSync(corepack)) {
    return { file: process.execPath, prefix: [corepack], options: { windowsHide: true } };
  }
  return resolvePe("pnpm");
}

function spawnOne(command, args, cwd) {
  const resolved = command === "pnpm" ? resolvePnpm() : resolvePe(command);
  const child = spawn(resolved.file, [...resolved.prefix, ...args], {
    cwd,
    env: process.env,
    stdio: "inherit",
    ...resolved.options
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
      process.stderr.write(`[fail] ${command} ${args.join(" ")} exited ${String(code ?? signal)}\n`);
    }
  });
  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // 已退出
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function waitHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return;
    } catch {
      // 还没起来
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("daemon /health timeout");
}

spawnOne("pnpm", ["--filter", "@saydo/daemon", "dev"], ROOT);
try {
  await waitHealth();
} catch (err) {
  process.stderr.write(`[fail] ${String(err)}\n`);
  shutdown();
  process.exit(1);
}
spawnOne("uv", ["run", "python", "-m", "saydo_pipeline"], join(ROOT, "pipeline"));
spawnOne("pnpm", ["--filter", "@saydo/console", "dev"], ROOT);

const codes = await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on("exit", (code) => resolve(code ?? 1));
      })
  )
);
process.exit(codes.some((c) => c !== 0 && c !== null) ? 1 : 0);
