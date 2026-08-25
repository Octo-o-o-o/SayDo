import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import { FIRST_RUN_OPENING } from "../src/api/firstRun.js";
import { loadCliRuntimeRegistry, registerCliSelfTest } from "../src/config/cliRuntime.js";
import { parseConfigText } from "../src/config/load.js";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { reservePort, startDaemonProcess } from "./helpers/daemonProcess.js";

const PROJECT_ID = "prj_01RECOVERY000000000000000A";
const SESSION_ID = "ses_01W1RE0000000000000000000A";
const HOLD_CODEX_FIXTURE = join(import.meta.dirname, "fixtures", "fake-codex-hold.mjs");

function validConfig(): string {
  return `
[models]
profile = "default"
dialog = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }
thinking = { provider = "api", via = "openrouter", model = "deepseek/deepseek-r1" }
cheap = { provider = "api", via = "openrouter", model = "google/gemini-3.1-flash-lite" }
evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }

[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key = "env:OPENROUTER_API_KEY"

[privacy]
store_audio = false
store_transcript = true
audio_retention_days = 0
`;
}

function validConfigPayload(): Record<string, unknown> {
  return {
    providers: {
      api: {
        openrouter: {
          base_url: "https://openrouter.ai/api/v1",
          api_key: "env:OPENROUTER_API_KEY"
        }
      }
    },
    models: {
      dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
      thinking: { provider: "api", via: "openrouter", model: "deepseek/deepseek-r1" },
      cheap: { provider: "api", via: "openrouter", model: "google/gemini-3.1-flash-lite" },
      evaluator: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-5" }
    }
  };
}

function insertProject(db: Db): void {
  db.prepare(
    `INSERT INTO projects(
       id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at
     ) VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    PROJECT_ID,
    "recovery fixture",
    "pending",
    "draft",
    JSON.stringify({ kind: "managed", path: `/tmp/${PROJECT_ID}` }),
    "step_confirm",
    "2026-08-11T00:00:00.000Z",
    "2026-08-11T00:00:00.000Z"
  );
}

function logicalSnapshot(db: Db): Record<string, unknown> {
  const targetTables = [
    "audit_log",
    "callback_outbox",
    "confirmation_ledger",
    "decision_packages",
    "pending_confirmations",
    "session_task_context"
  ];
  const rows = Object.fromEntries(
    targetTables.map((table) => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])
  );
  const counts = Object.fromEntries(
    (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as { name: string }[]
    ).map(({ name }) => [name, (db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get() as { c: number }).c])
  );
  return { rows, counts };
}

async function listenTrap(port: number): Promise<{ server: Server; calls: () => number }> {
  let callCount = 0;
  const server = createServer((_req, res) => {
    callCount++;
    res.writeHead(200);
    res.end("ok");
  });
  server.on("connection", (socket) => {
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, calls: () => callCount };
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function expectWsRejected(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("recovery-only unexpectedly kept WS upgrade pending"));
    }, 1500);
    ws.once("open", () => {
      clearTimeout(timer);
      ws.terminate();
      reject(new Error("recovery-only unexpectedly opened WS"));
    });
    const rejected = () => {
      clearTimeout(timer);
      resolve();
    };
    ws.once("error", rejected);
    ws.once("unexpected-response", (_request, response) => {
      response.resume();
      rejected();
    });
    ws.once("close", rejected);
  });
}

async function waitForFileText(path: string, expected: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    last = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (last.includes(expected)) return last;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`等待进程证据超时:${expected} got=${JSON.stringify(last).slice(0, 400)}`);
}

function installHoldingCodex(home: string): { binDir: string; binaryPath: string; marker: string } {
  const binDir = join(home, "fake-bin");
  mkdirSync(binDir, { recursive: true });
  const scriptPath = join(binDir, "codex.mjs");
  copyFileSync(HOLD_CODEX_FIXTURE, scriptPath);
  if (process.platform === "win32") {
    writeFileSync(join(binDir, "codex.cmd"), `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`);
  } else {
    const binaryPath = join(binDir, "codex");
    copyFileSync(HOLD_CODEX_FIXTURE, binaryPath);
    chmodSync(binaryPath, 0o755);
    return { binDir, binaryPath, marker: join(binDir, "fake-codex-hold.marker") };
  }
  return { binDir, binaryPath: scriptPath, marker: join(binDir, "fake-codex-hold.marker") };
}

function cliCandidateConfig(): string {
  return `
[models]
profile = "default"
dialog = { provider = "api", model = "openai/gpt-5.6-luna" }
thinking = { provider = "codex_cli", model = "gpt-5.6-luna" }
cheap = { provider = "api", model = "google/gemini-3.1-flash-lite" }
evaluator = { provider = "api", model = "anthropic/claude-sonnet-5" }
`;
}

describe("recovery-only 真实进程组合根", () => {
  it("手写 runtime registry 缺不可变 self-test audit receipt 时进程投影保持 unarmed", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-cli-registry-forge-")));
    const installed = installHoldingCodex(home);
    writeFileSync(join(home, "config.toml"), cliCandidateConfig(), { mode: 0o600 });
    const cfg = parseConfigText(cliCandidateConfig());
    const digest = createHash("sha256").update(readFileSync(installed.binaryPath)).digest("hex");
    registerCliSelfTest(home, cfg.models.thinking, {
      slot: "thinking",
      provider: "codex_cli",
      binaryPath: installed.binaryPath,
      binaryDigest: digest,
      expectedFamily: "gpt",
      requestedModel: "gpt-5.6-luna",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, { record: () => ({ id: "aud_manual" }) });
    expect(Object.values(loadCliRuntimeRegistry(home).registrations)).toHaveLength(1);

    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      env: { OPENAI_API_KEY: "process-test-key", PATH: `${installed.binDir}${delimiter}${process.env["PATH"] ?? ""}` }
    });
    try {
      const probe = (await (await daemon.api("/api/setup/probe")).json()) as {
        config: { slots: { thinking: { effective: string; reason?: string } } };
      };
      expect(probe.config.slots.thinking).toMatchObject({
        effective: "fallback_dialog",
        reason: "cli_self_test_required"
      });
    } finally {
      await daemon.stop();
    }
  }, 15_000);

  // win32:该例断言 POSIX SIGTERM 对 inherit/ignore 孙进程可捕获。Windows 进程树回收走具名 Job
  // (emergency-reaper / runtime-child / executor setup-hang),不把 SIGTERM handler 当合同。
  it.skipIf(process.platform === "win32").each(["restart", "SIGINT", "SIGTERM"] as const)(
    "活跃 CLI self-test 下 %s 先 drain 整个进程组再退出",
    async (mode) => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), `saydo-recovery-drain-${mode.toLowerCase()}-`)));
    writeFileSync(join(home, "config.toml"), "[models\ninvalid =", { mode: 0o600 });
    const installed = installHoldingCodex(home);
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      env: { PATH: `${installed.binDir}${delimiter}${process.env["PATH"] ?? ""}` }
    });
    try {
      writeFileSync(join(home, "config.toml.pending"), cliCandidateConfig(), { mode: 0o600 });
      if (mode === "restart") {
        const pendingConfig = parseConfigText(cliCandidateConfig());
        const activation = {
          configDigest: createHash("sha256").update(readFileSync(join(home, "config.toml.pending"))).digest("hex")
        };
        const db = openDb(join(home, "saydo.db"));
        registerCliSelfTest(
          home,
          pendingConfig.models.thinking,
          {
            slot: "thinking",
            provider: "codex_cli",
            binaryPath: installed.binaryPath,
            binaryDigest: createHash("sha256").update(readFileSync(installed.binaryPath)).digest("hex"),
            expectedFamily: "gpt",
            requestedModel: "gpt-5.6-luna",
            observedModelSource: "verified_binary_default",
            observedModelExempted: true,
            testedAt: "2026-08-12T00:00:00.000Z"
          },
          createSqliteAuditSink(db, () => new Date("2026-08-12T00:00:00.000Z")),
          "pending",
          activation
        );
        db.close();
      }
      const selfTest = daemon.api("/api/setup/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      }).catch(() => null);
      await waitForFileText(installed.marker, "started:");
      await waitForFileText(installed.marker, "inherit-started");
      await waitForFileText(installed.marker, "ignore-started");
      const before = await daemon.health();
      if (mode === "restart") {
        const responses = await Promise.all(
          [1, 2].map(() =>
            daemon.api("/api/setup/restart", { method: "POST", body: "{}" }).catch(() => null)
          )
        );
        expect(responses.filter((response) => response?.status === 200)).toHaveLength(1);
        expect(responses.filter((response) => response?.status === 503 || response === null)).toHaveLength(1);
        try {
          await daemon.waitForRestart(before.pid);
        } catch (err) {
          throw new Error(`${String(err)}\n${daemon.output()}`);
        }
      } else {
        const exited = new Promise<void>((resolve) => daemon.child.once("exit", () => resolve()));
        daemon.child.kill(mode);
        await exited;
      }
      await selfTest;
      const startedMarker = readFileSync(installed.marker, "utf8");
      const processPids = [...startedMarker.matchAll(/(?:^|\n)(?:started|inherit-started|ignore-started):(\d+)/g)]
        .map((match) => Number(match[1]));
      expect(processPids).toHaveLength(3);
      if (process.platform !== "win32") {
        const marker = await waitForFileText(installed.marker, "ignore-SIGTERM");
        await waitForFileText(installed.marker, "parent-SIGTERM");
        await waitForFileText(installed.marker, "inherit-SIGTERM");
        expect(marker).toContain("ignore-SIGTERM");
      }
      // 重并发下(pnpm test 全 workspace)整组进程退出与随后的 audit 落库都会明显变慢：
      // 默认 1s 与原先的 8s 都不够,实测曾在 9986ms 处以 "audit missing" 假失败。
      await vi.waitFor(
        () => {
          for (const pid of processPids) expect(() => process.kill(pid, 0)).toThrow();
        },
        { timeout: 8_000, interval: 50 }
      );
      await vi.waitFor(() => {
        const auditDb = openDb(join(home, "saydo.db"));
        try {
          const shutdownAudit = auditDb
            .prepare("SELECT meta_json FROM audit_log WHERE action='runtime.prepare_shutdown' ORDER BY ts DESC LIMIT 1")
            .get() as { meta_json: string } | undefined;
          if (!shutdownAudit) throw new Error("runtime.prepare_shutdown audit missing");
          expect(JSON.parse(shutdownAudit.meta_json)).toMatchObject({
            recoverableTier1: 0,
            abortedUnrecoverable: 1
          });
        } finally {
          auditDb.close();
        }
      }, { timeout: 15_000, interval: 50 });
      const auditDb = openDb(join(home, "saydo.db"));
      expect(
        (auditDb.prepare("SELECT COUNT(*) AS c FROM tier1_runs WHERE restart_pending_at IS NOT NULL").get() as { c: number }).c
      ).toBe(0);
      auditDb.close();
    } finally {
      if (mode === "restart") await daemon.stop();
    }
  }, 40_000);

  it("restart 后同步 signal：drain/close 各一次、spawn=0、signal 优先", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-recovery-restart-signal-")));
    writeFileSync(join(home, "config.toml"), "[models\ninvalid =", { mode: 0o600 });
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort()
    });
    try {
      writeFileSync(join(home, "config.toml.pending"), cliCandidateConfig(), { mode: 0o600 });
      const pendingConfig = parseConfigText(cliCandidateConfig());
      const activation = {
        configDigest: createHash("sha256").update(readFileSync(join(home, "config.toml.pending"))).digest("hex")
      };
      const binDir = join(home, "fake-bin");
      mkdirSync(binDir, { recursive: true });
      const binaryPath = join(binDir, "codex.mjs");
      writeFileSync(binaryPath, "console.log('ok')\n");
      const db = openDb(join(home, "saydo.db"));
      registerCliSelfTest(
        home,
        pendingConfig.models.thinking,
        {
          slot: "thinking",
          provider: "codex_cli",
          binaryPath,
          binaryDigest: createHash("sha256").update(readFileSync(binaryPath)).digest("hex"),
          expectedFamily: "gpt",
          requestedModel: "gpt-5.6-luna",
          observedModelSource: "verified_binary_default",
          observedModelExempted: true,
          testedAt: "2026-08-12T00:00:00.000Z"
        },
        createSqliteAuditSink(db, () => new Date("2026-08-12T00:00:00.000Z")),
        "pending",
        activation
      );
      db.close();
      const before = await daemon.health();
      const exited = new Promise<{ code: number | null }>((resolve) => {
        daemon.child.once("exit", (code) => resolve({ code }));
      });
      const restart = await daemon.api("/api/setup/restart", { method: "POST", body: "{}" });
      expect(restart.status).toBe(200);
      daemon.child.kill("SIGTERM");
      const exit = await exited;
      expect(exit.code).toBe(0);
      const logs = daemon.output();
      expect([...logs.matchAll(/recovery lifecycle drain/g)]).toHaveLength(1);
      expect([...logs.matchAll(/recovery lifecycle close/g)]).toHaveLength(1);
      expect(logs).not.toMatch(/self-restart spawned/u);
      try {
        process.kill(before.pid, 0);
        throw new Error("restart 后仍残留原 daemon");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
      }
      await expect(
        fetch(`http://127.0.0.1:${daemon.port}/health`, { signal: AbortSignal.timeout(500) })
      ).rejects.toThrow();
      const auditDb = openDb(join(home, "saydo.db"));
      const shutdowns = auditDb
        .prepare("SELECT meta_json FROM audit_log WHERE action='runtime.prepare_shutdown'")
        .all() as { meta_json: string }[];
      expect(shutdowns).toHaveLength(1);
      expect(JSON.parse(shutdowns[0]?.meta_json ?? "{}")).toMatchObject({
        reason: "supervisor_stop",
        recoveryOnly: true
      });
      auditDb.close();
    } finally {
      try { daemon.child.kill("SIGKILL"); } catch { /* 已退 */ }
    }
  }, 20_000);

  it("supervised restart 后同步 prepareShutdown：唯一 lifecycle、无 restartRequested、signal 优先", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-recovery-sup-signal-")));
    writeFileSync(join(home, "config.toml"), "[models\ninvalid =", { mode: 0o600 });
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true
    });
    try {
      writeFileSync(join(home, "config.toml.pending"), cliCandidateConfig(), { mode: 0o600 });
      const pendingConfig = parseConfigText(cliCandidateConfig());
      const activation = {
        configDigest: createHash("sha256").update(readFileSync(join(home, "config.toml.pending"))).digest("hex")
      };
      const binDir = join(home, "fake-bin");
      mkdirSync(binDir, { recursive: true });
      const binaryPath = join(binDir, "codex.mjs");
      writeFileSync(binaryPath, "console.log('ok')\n");
      const db = openDb(join(home, "saydo.db"));
      registerCliSelfTest(
        home,
        pendingConfig.models.thinking,
        {
          slot: "thinking",
          provider: "codex_cli",
          binaryPath,
          binaryDigest: createHash("sha256").update(readFileSync(binaryPath)).digest("hex"),
          expectedFamily: "gpt",
          requestedModel: "gpt-5.6-luna",
          observedModelSource: "verified_binary_default",
          observedModelExempted: true,
          testedAt: "2026-08-12T00:00:00.000Z"
        },
        createSqliteAuditSink(db, () => new Date("2026-08-12T00:00:00.000Z")),
        "pending",
        activation
      );
      db.close();
      const exited = new Promise<{ code: number | null }>((resolve) => {
        daemon.child.once("exit", (code) => resolve({ code }));
      });
      const restart = await daemon.api("/api/setup/restart", { method: "POST", body: "{}" });
      expect(restart.status).toBe(200);
      daemon.sendSupervisor({ v: 1, t: "prepareShutdown", reason: "supervisor_stop" });
      const exit = await exited;
      expect(exit.code).toBe(0);
      const types = daemon.frames.map((frame) => (frame as { t?: string }).t);
      expect(types).not.toContain("restartRequested");
      expect(types.filter((type) => type === "stopped")).toHaveLength(1);
      expect(daemon.frames.some((frame) => {
        const item = frame as { t?: string; reason?: string };
        return item.t === "stopped" && item.reason === "supervisor_stop";
      })).toBe(true);
      const logs = daemon.output();
      expect([...logs.matchAll(/recovery lifecycle drain/g)]).toHaveLength(1);
      expect(logs).not.toMatch(/self-restart spawned/u);
      const auditDb = openDb(join(home, "saydo.db"));
      const shutdowns = auditDb
        .prepare("SELECT meta_json FROM audit_log WHERE action='runtime.prepare_shutdown'")
        .all() as { meta_json: string }[];
      expect(shutdowns).toHaveLength(1);
      expect(JSON.parse(shutdowns[0]?.meta_json ?? "{}")).toMatchObject({ reason: "supervisor_stop" });
      expect(
        (auditDb.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='setup.self_restart'").get() as { c: number }).c
      ).toBe(0);
      auditDb.close();
    } finally {
      try { daemon.child.kill("SIGKILL"); } catch { /* 已退 */ }
    }
  }, 20_000);

  it("supervised restart 胜出：唯一 restartRequested 与 stopped(restart)，不 spawn", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-recovery-sup-restart-")));
    writeFileSync(join(home, "config.toml"), "[models\ninvalid =", { mode: 0o600 });
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true
    });
    try {
      writeFileSync(join(home, "config.toml.pending"), cliCandidateConfig(), { mode: 0o600 });
      const pendingConfig = parseConfigText(cliCandidateConfig());
      const activation = {
        configDigest: createHash("sha256").update(readFileSync(join(home, "config.toml.pending"))).digest("hex")
      };
      const binDir = join(home, "fake-bin");
      mkdirSync(binDir, { recursive: true });
      const binaryPath = join(binDir, "codex.mjs");
      writeFileSync(binaryPath, "console.log('ok')\n");
      const db = openDb(join(home, "saydo.db"));
      registerCliSelfTest(
        home,
        pendingConfig.models.thinking,
        {
          slot: "thinking",
          provider: "codex_cli",
          binaryPath,
          binaryDigest: createHash("sha256").update(readFileSync(binaryPath)).digest("hex"),
          expectedFamily: "gpt",
          requestedModel: "gpt-5.6-luna",
          observedModelSource: "verified_binary_default",
          observedModelExempted: true,
          testedAt: "2026-08-12T00:00:00.000Z"
        },
        createSqliteAuditSink(db, () => new Date("2026-08-12T00:00:00.000Z")),
        "pending",
        activation
      );
      db.close();
      const exited = new Promise<{ code: number | null }>((resolve) => {
        daemon.child.once("exit", (code) => resolve({ code }));
      });
      const restart = await daemon.api("/api/setup/restart", { method: "POST", body: "{}" });
      expect(restart.status).toBe(200);
      const exit = await exited;
      expect(exit.code).toBe(0);
      const types = daemon.frames.map((frame) => (frame as { t?: string }).t);
      expect(types.filter((type) => type === "restartRequested")).toHaveLength(1);
      expect(types.filter((type) => type === "stopped")).toHaveLength(1);
      expect(daemon.frames.some((frame) => {
        const item = frame as { t?: string; reason?: string };
        return item.t === "stopped" && item.reason === "restart";
      })).toBe(true);
      expect(daemon.output()).not.toMatch(/self-restart spawned/u);
      const auditDb = openDb(join(home, "saydo.db"));
      expect(
        (auditDb.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='setup.self_restart'").get() as { c: number }).c
      ).toBe(1);
      auditDb.close();
    } finally {
      try { daemon.child.kill("SIGKILL"); } catch { /* 已退 */ }
    }
  }, 20_000);

  it("主 daemon unsupervised restart 后同步 SIGTERM：signal 优先、spawn=0", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-main-restart-signal-")));
    writeFileSync(join(home, "config.toml"), validConfig(), { mode: 0o600 });
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    try {
      const exited = new Promise<{ code: number | null }>((resolve) => {
        daemon.child.once("exit", (code) => resolve({ code }));
      });
      const restart = await daemon.api("/api/setup/restart", { method: "POST", body: "{}" });
      expect(restart.status).toBe(200);
      daemon.child.kill("SIGTERM");
      const exit = await exited;
      expect(exit.code).toBe(0);
      const logs = daemon.output();
      expect([...logs.matchAll(/daemon lifecycle drain/g)]).toHaveLength(1);
      expect(logs).not.toMatch(/self-restart spawned/u);
      const auditDb = openDb(join(home, "saydo.db"));
      const shutdowns = auditDb
        .prepare("SELECT meta_json FROM audit_log WHERE action='runtime.prepare_shutdown'")
        .all() as { meta_json: string }[];
      expect(shutdowns).toHaveLength(1);
      expect(JSON.parse(shutdowns[0]?.meta_json ?? "{}")).toMatchObject({ reason: "supervisor_stop" });
      auditDb.close();
    } finally {
      try { daemon.child.kill("SIGKILL"); } catch { /* 已退 */ }
    }
  }, 20_000);

  it("可控调度器下不初始化业务、不改六类 durable 状态且不产生网络外呼", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-recovery-inert-")));
    writeFileSync(join(home, "config.toml"), validConfig(), { mode: 0o600 });
    const db = openDb(join(home, "saydo.db"));
    insertProject(db);
    db.prepare(
      "INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at) VALUES (?,?,?,?,?,?)"
    ).run(SESSION_ID, PROJECT_ID, "talking", "cascade", join(home, "sessions", `${SESSION_ID}.jsonl`), "2026-08-11T00:00:00.000Z");
    db.prepare(
      "INSERT INTO session_task_context(session_id,ref_kind,ref_id,nonce,set_at) VALUES (?,?,?,?,?)"
    ).run(SESSION_ID, "task", "tsk_recovery", "nonce_recovery", "2026-08-11T00:00:00.000Z");
    db.prepare(
      `INSERT INTO callback_outbox(
         id,task_id,trigger,occurrence_key,dedupe_key,state,created_at,updated_at
       ) VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      "out_recovery",
      "tsk_recovery",
      "blocked",
      "occ_recovery",
      "dedupe_recovery",
      "pending",
      "2026-08-11T00:00:00.000Z",
      "2026-08-11T00:00:00.000Z"
    );
    db.prepare(
      `INSERT INTO decision_packages(
         id,revision,digest,project_id,body_json,status,proposed_at,expires_at,created_at
       ) VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(
      "pkg_recovery",
      1,
      "digest_recovery",
      PROJECT_ID,
      "{}",
      "proposed",
      "2020-01-01T00:00:00.000Z",
      "2020-01-02T00:00:00.000Z",
      "2020-01-01T00:00:00.000Z"
    );
    db.prepare(
      `INSERT INTO confirmation_ledger(
         receipt_id,kind,payload_summary_json,payload_digest,session_id,presented_at,downgrade_status
       ) VALUES (?,?,?,?,?,?,?)`
    ).run("rcp_recovery", "expectation", "{}", "digest_confirm", SESSION_ID, "2020-01-01T00:00:00.000Z", "n/a");
    db.prepare(
      `INSERT INTO pending_confirmations(
         session_id,receipt_id,kind,prompt_text,payload_json,digest,digest_version,
         sentence_id,attempt,presented_at,expires_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      SESSION_ID,
      "rcp_recovery",
      "expectation",
      "expired confirmation",
      "{}",
      "digest_confirm",
      1,
      "sentence_recovery",
      1,
      "2020-01-01T00:00:00.000Z",
      "2020-01-02T00:00:00.000Z"
    );
    db.prepare("INSERT INTO project_settings(project_id,overrides_json,updated_at) VALUES (?,?,?)").run(
      PROJECT_ID,
      "not-json",
      "2026-08-11T00:00:00.000Z"
    );
    const before = logicalSnapshot(db);
    db.close();

    const intervalEvidence = join(home, "interval-evidence.txt");
    const fetchEvidence = join(home, "fetch-evidence.txt");
    const trapPort = await reservePort();
    const trap = await listenTrap(trapPort);
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      importAfterTsxLoader: [join(import.meta.dirname, "fixtures", "controlled-runtime.mjs")],
      env: {
        OPENROUTER_API_KEY: "process-test-key",
        NTFY_SERVER: `http://127.0.0.1:${trapPort}`,
        NTFY_TOPIC: "recovery-must-not-send",
        SAYDO_MOBILE_LAN: "1",
        SAYDO_TEST_INTERVAL_EVIDENCE: intervalEvidence,
        SAYDO_TEST_FETCH_EVIDENCE: fetchEvidence
      }
    });
    try {
      await new Promise((done) => setTimeout(done, 200));
      const afterDb = openDb(join(home, "saydo.db"));
      expect(logicalSnapshot(afterDb)).toEqual(before);
      afterDb.close();
      expect(existsSync(intervalEvidence) ? readFileSync(intervalEvidence, "utf8") : "").toBe("");
      expect(existsSync(fetchEvidence) ? readFileSync(fetchEvidence, "utf8") : "").toBe("");
      expect(existsSync(join(home, "projects"))).toBe(false);
      expect(trap.calls()).toBe(0);
      expect(daemon.output()).toContain('listen="127.0.0.1"');
      expect(daemon.output()).not.toContain('listen="0.0.0.0"');

      const businessRead = await daemon.api("/api/overview");
      expect(businessRead.status).toBe(503);
      await expectWsRejected(`ws://127.0.0.1:${daemon.port}/ws/voice?token=${daemon.token}`);
    } finally {
      await daemon.stop();
      await closeServer(trap.server);
    }
  }, 15_000);

  it("损坏 active 与非法 override 可依次自救；recovery 拒收不消费 marker，重启后仍真投", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-recovery-rescue-")));
    writeFileSync(join(home, "config.toml"), "[models\ndialog =", { mode: 0o600 });
    const db = openDb(join(home, "saydo.db"));
    insertProject(db);
    db.prepare("INSERT INTO project_settings(project_id,overrides_json,updated_at) VALUES (?,?,?)").run(
      PROJECT_ID,
      JSON.stringify({
        models: { dialog: { provider: "codex_cli" } },
        budget: { maxCost: 10, maxTurns: 20 }
      }),
      "2026-08-11T00:00:00.000Z"
    );
    db.close();
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    try {
      const beforeRestart = await daemon.health();
      expect(JSON.parse(readFileSync(join(home, "first-run-onboarding.json"), "utf8"))).toMatchObject({ state: "eligible" });
      const rejectedFirstRun = await daemon.api("/api/setup/first-run/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID })
      });
      expect(rejectedFirstRun.status).toBe(503);
      expect(JSON.parse(readFileSync(join(home, "first-run-onboarding.json"), "utf8"))).toMatchObject({ state: "eligible" });

      const stageConfig = await daemon.api("/api/setup/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validConfigPayload())
      });
      expect(stageConfig.status, await stageConfig.text()).toBe(200);
      const activateConfig = await daemon.api("/api/setup/restart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(activateConfig.status, await activateConfig.text()).toBe(200);
      const afterConfigRestart = await daemon.waitForRestart(beforeRestart.pid);

      const listed = await daemon.api("/api/setup/project-overrides/invalid");
      const listing = (await listed.json()) as {
        receipt: string;
        issues: { projectId: string; affectedKeys: string[] }[];
      };
      expect(listing).toMatchObject({
        ok: true,
        deleteWholeOverride: true,
        issues: [{
          projectId: PROJECT_ID,
          violations: [{ code: "project_override_cli_rejected" }],
          affectedKeys: ["budget", "models"]
        }]
      });
      expect(listing.receipt).toEqual(expect.any(String));
      const bypassListing = await daemon.api("/api/setup/project-overrides/clear-invalid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectIds: [PROJECT_ID], deleteWholeOverride: true })
      });
      expect(bypassListing.status).toBe(422);
      const unconfirmedWholeDelete = await daemon.api("/api/setup/project-overrides/clear-invalid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt: listing.receipt, projectIds: [PROJECT_ID] })
      });
      expect(unconfirmedWholeDelete.status).toBe(422);
      const changedDb = openDb(join(home, "saydo.db"));
      changedDb.prepare("UPDATE project_settings SET overrides_json=? WHERE project_id=?").run(
        JSON.stringify({
          models: { dialog: { provider: "codex_cli" } },
          budget: { maxCost: 11, maxTurns: 20 }
        }),
        PROJECT_ID
      );
      changedDb.close();
      const staleClear = await daemon.api("/api/setup/project-overrides/clear-invalid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          receipt: listing.receipt,
          projectIds: [PROJECT_ID],
          deleteWholeOverride: true
        })
      });
      expect(staleClear.status).toBe(409);
      const refreshedListing = (await (await daemon.api("/api/setup/project-overrides/invalid")).json()) as {
        receipt: string;
      };
      const clear = await daemon.api("/api/setup/project-overrides/clear-invalid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          receipt: refreshedListing.receipt,
          projectIds: [PROJECT_ID],
          deleteWholeOverride: true
        })
      });
      expect(clear.status).toBe(200);
      await expect(clear.json()).resolves.toEqual({
        ok: true,
        cleared: [PROJECT_ID],
        deletedWholeOverride: true
      });
      const afterClearDb = openDb(join(home, "saydo.db"));
      expect(afterClearDb.prepare("SELECT 1 FROM project_settings WHERE project_id=?").get(PROJECT_ID)).toBeUndefined();
      afterClearDb.close();

      const restart = await daemon.api("/api/setup/restart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(restart.status, await restart.text()).toBe(200);
      await daemon.waitForRestart(afterConfigRestart.pid);
      const firstRun = await daemon.api("/api/setup/first-run/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID })
      });
      await expect(firstRun.json()).resolves.toMatchObject({
        state: "presented",
        delivered: true,
        message: FIRST_RUN_OPENING
      });
    } finally {
      await daemon.stop();
    }
  }, 20_000);
});
