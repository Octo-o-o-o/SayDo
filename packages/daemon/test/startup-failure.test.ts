import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inspect } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { formatSayDoJobName } from "@saydo/platform";
import { parseConfigText } from "../src/config/load.js";
import { validateConfig } from "../src/config/validate.js";
import {
  BOOT_ACTIVATION_FAILED,
  BOOT_ACTIVATION_ROLLBACK_FAILED,
  DAEMON_FATAL_MESSAGE,
  DAEMON_INSTANCE_LOCK_FAILED,
  DAEMON_LISTEN_FAILED,
  DAEMON_SHUTDOWN_FAILED,
  DATABASE_CLOSE_FAILED,
  TIER1_EMERGENCY_CLEANUP_DEADLINE,
  TIER1_EMERGENCY_CLEANUP_FAILED,
  TIER1_EXECUTOR_STARTUP_FAILED,
  captureStartupFatalProjection,
  isOwnEexist,
  listenFatalCode,
  listenFatalMessage,
  projectBootActivationFailure,
  projectBootActivationRollbackFailure,
  projectDaemonFatalMessage,
  projectDaemonLockFailure,
  projectDaemonShutdownFailureText,
  projectDatabaseCloseFailure,
  projectTier1StartupFailureText,
  settleTier1StartupFailure
} from "../src/startupFailure.js";

function countingProxy(target: object): { proxy: object; gets: { n: number } } {
  const gets = { n: 0 };
  const proxy = new Proxy(target, {
    get(t, p, r) {
      gets.n += 1;
      return Reflect.get(t, p, r);
    },
    getOwnPropertyDescriptor(t, p) {
      gets.n += 1;
      return Reflect.getOwnPropertyDescriptor(t, p);
    },
    getPrototypeOf(t) {
      gets.n += 1;
      return Reflect.getPrototypeOf(t);
    }
  });
  return { proxy, gets };
}

describe("daemon 启动 unknown 投影", () => {
  it("instance-lock 只认 own-data EEXIST，其余受控且零 trap", () => {
    const own = new Error("x");
    Object.defineProperty(own, "code", { value: "EEXIST" });
    expect(isOwnEexist(own)).toBe(true);

    const inherited = Object.create({ code: "EEXIST" }) as Error;
    Object.defineProperty(inherited, "message", { value: "SECRET" });
    expect(isOwnEexist(inherited)).toBe(false);

    const accessor = new Error("x");
    Object.defineProperty(accessor, "code", {
      get(): string {
        return "EEXIST";
      }
    });
    expect(isOwnEexist(accessor)).toBe(false);

    const { proxy, gets } = countingProxy(own);
    expect(isOwnEexist(proxy)).toBe(false);
    expect(gets.n).toBe(0);
    const projected = projectDaemonLockFailure(proxy);
    expect(projected.message).toBe(DAEMON_INSTANCE_LOCK_FAILED);
    expect(projected.message).not.toContain("SECRET");
    expect(Object.is(projected, proxy)).toBe(false);
    expect(gets.n).toBe(0);

    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        gets.n += 1;
        return "EEXIST";
      }
    });
    revoked.revoke();
    expect(() => isOwnEexist(revoked.proxy)).not.toThrow();
    expect(isOwnEexist(revoked.proxy)).toBe(false);
    expect(() => projectDaemonLockFailure(revoked.proxy)).not.toThrow();
    expect(projectDaemonLockFailure(revoked.proxy).message).toBe(DAEMON_INSTANCE_LOCK_FAILED);
    expect(gets.n).toBe(0);

    expect(projectDaemonLockFailure("SECRET").message).toBe(DAEMON_INSTANCE_LOCK_FAILED);
    expect(projectDaemonLockFailure(new Error("SECRET")).message).not.toContain("SECRET");
  });

  it("listen 只认 own-data EADDRINUSE，其余消息受控且零 trap", () => {
    const own = new Error("SECRET");
    Object.defineProperty(own, "code", { value: "EADDRINUSE" });
    expect(listenFatalCode(own)).toBe("port_conflict");
    expect(listenFatalMessage(own)).toBe("port_conflict");
    expect(listenFatalMessage(own)).not.toContain("SECRET");

    const accessor = new Error("SECRET");
    Object.defineProperty(accessor, "code", {
      get(): string {
        return "EADDRINUSE";
      }
    });
    expect(listenFatalCode(accessor)).toBe("listen_failed");
    expect(listenFatalMessage(accessor)).toBe(DAEMON_LISTEN_FAILED);

    const { proxy, gets } = countingProxy(own);
    expect(listenFatalCode(proxy)).toBe("listen_failed");
    expect(listenFatalMessage(proxy)).toBe(DAEMON_LISTEN_FAILED);
    expect(gets.n).toBe(0);

    const revoked = Proxy.revocable(own, {
      get() {
        gets.n += 1;
        return "EADDRINUSE";
      }
    });
    revoked.revoke();
    expect(() => listenFatalCode(revoked.proxy)).not.toThrow();
    expect(listenFatalCode(revoked.proxy)).toBe("listen_failed");
    expect(listenFatalMessage(revoked.proxy)).not.toContain("SECRET");
    expect(gets.n).toBe(0);

    expect(listenFatalMessage(new Error("SECRET"))).toBe(DAEMON_LISTEN_FAILED);
    expect(listenFatalMessage("SECRET")).toBe(DAEMON_LISTEN_FAILED);
  });

  it("startup/fatal 对 Error/Proxy/revoked/accessor/function/primitive 零原文", () => {
    const accessor = new Error("init");
    Object.defineProperty(accessor, "message", {
      get(): string {
        return "SECRET";
      }
    });
    const { proxy, gets } = countingProxy(new Error("SECRET"));
    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        throw new TypeError("revoked");
      }
    });
    revoked.revoke();
    const samples: unknown[] = [
      new Error("SECRET"),
      accessor,
      proxy,
      revoked.proxy,
      () => "SECRET",
      Symbol("SECRET"),
      1n,
      42,
      "SECRET",
      null,
      undefined
    ];
    for (const sample of samples) {
      expect(() => captureStartupFatalProjection(sample)).not.toThrow();
      const out = captureStartupFatalProjection(sample);
      expect(out).toEqual({
        startup: TIER1_EXECUTOR_STARTUP_FAILED,
        fatal: DAEMON_FATAL_MESSAGE,
        shutdown: DAEMON_SHUTDOWN_FAILED
      });
      expect(inspect(out)).not.toContain("SECRET");
      expect(projectTier1StartupFailureText(sample)).not.toContain("SECRET");
      expect(projectDaemonFatalMessage(sample)).not.toContain("SECRET");
      expect(projectDaemonShutdownFailureText(sample)).not.toContain("SECRET");
    }
    expect(gets.n).toBe(0);
  });

  it("activation/rollback/database-close 对 hostile 零原文且 catch 不抛", () => {
    const samples: unknown[] = [
      new Error("SECRET"),
      new AggregateError([new Error("SECRET")], "SECRET"),
      () => "SECRET",
      Symbol("SECRET"),
      1n,
      "SECRET",
      null,
      undefined
    ];
    const accessor = new Error("init");
    Object.defineProperty(accessor, "message", { get(): string { return "SECRET"; } });
    samples.push(accessor);
    const { proxy, gets } = countingProxy(new Error("SECRET"));
    samples.push(proxy);
    const revoked = Proxy.revocable(new Error("SECRET"), { get() { throw new TypeError("revoked"); } });
    revoked.revoke();
    samples.push(revoked.proxy);
    for (const sample of samples) {
      expect(() => projectBootActivationFailure(sample)).not.toThrow();
      expect(() => projectBootActivationRollbackFailure(sample)).not.toThrow();
      expect(() => projectDatabaseCloseFailure(sample)).not.toThrow();
      expect(projectBootActivationFailure(sample)).toBe(BOOT_ACTIVATION_FAILED);
      expect(projectBootActivationRollbackFailure(sample)).toBe(BOOT_ACTIVATION_ROLLBACK_FAILED);
      expect(projectDatabaseCloseFailure(sample)).toBe(DATABASE_CLOSE_FAILED);
      expect(projectBootActivationFailure(sample)).not.toContain("SECRET");
    }
    expect(gets.n).toBe(0);
  });
});

describe("supervisor IPC settle", () => {
  it("publishSupervisorReady 必须等到 send 完成才 settle", async () => {
    const { publishSupervisorReady } = await import("../src/supervisorIpc.js");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let settled = false;
    const done = publishSupervisorReady({ t: "ready" }, async () => {
      await gate;
    }).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await done;
    expect(settled).toBe(true);
  });

  it("callback/catch 对 SECRET/Proxy/revoked 零原文且始终 settle", async () => {
    const { sendSupervisorFrameAndWait, SUPERVISOR_IPC_FAILED } = await import("../src/supervisorIpc.js");
    const logs: string[] = [];
    const samples: unknown[] = [
      new Error("SECRET"),
      new AggregateError([new Error("SECRET")], "SECRET"),
      "SECRET",
      42n,
      Symbol("SECRET")
    ];
    for (const sample of samples) {
      let calls = 0;
      await expect(sendSupervisorFrameAndWait({ t: "fatal" }, {
        send: (_frame, cb) => {
          calls += 1;
          cb?.(sample as Error);
          return true;
        },
        log: (_msg, fields) => {
          logs.push(JSON.stringify(fields));
        }
      })).rejects.toMatchObject({ name: "SupervisorIpcError" });
      expect(calls).toBe(1);
    }
    const accessor = new Error("init");
    Object.defineProperty(accessor, "message", { get(): string { return "SECRET"; } });
    await expect(sendSupervisorFrameAndWait({ t: "fatal" }, {
      send: () => {
        throw accessor;
      },
      log: (_msg, fields) => {
        logs.push(JSON.stringify(fields));
      }
    })).rejects.toMatchObject({ name: "SupervisorIpcError" });
    const revoked = Proxy.revocable(new Error("SECRET"), { get() { throw new TypeError("revoked"); } });
    revoked.revoke();
    await expect(sendSupervisorFrameAndWait({ t: "fatal" }, {
      send: () => {
        throw revoked.proxy;
      },
      log: (_msg, fields) => {
        logs.push(JSON.stringify(fields));
      }
    })).rejects.toMatchObject({ name: "SupervisorIpcError" });
    expect(logs.join("\n")).not.toContain("SECRET");
    expect(logs.some((line) => line.includes(SUPERVISOR_IPC_FAILED))).toBe(true);
  });
});

describe("listen abort 与 R6 claim", () => {
  it("AbortSignal close 与显式 close 竞态只允许 ERR_SERVER_NOT_RUNNING", async () => {
    const { createServer } = await import("node:http");
    const startupAbort = new AbortController();
    const server = createServer();
    const errors: string[] = [];
    await new Promise<void>((resolveListen, rejectListen) => {
      const onError = (err: NodeJS.ErrnoException): void => {
        server.off("error", onError);
        rejectListen(err);
      };
      server.once("error", onError);
      server.listen({ port: 0, host: "127.0.0.1", signal: startupAbort.signal }, () => {
        server.off("error", onError);
        resolveListen();
      });
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      errors.push(err.code ?? err.message);
    });
    startupAbort.abort();
    if (server.listening) {
      server.close(() => undefined);
    }
    await new Promise<void>((resolveClose) => {
      if (!server.listening) {
        resolveClose();
        return;
      }
      const timer = setTimeout(() => resolveClose(), 500);
      server.once("close", () => {
        clearTimeout(timer);
        resolveClose();
      });
    });
    expect(errors.every((code) => code === "ERR_SERVER_NOT_RUNNING")).toBe(true);
  });
});

describe("settleTier1StartupFailure 真实收口", () => {
  it("cleanup 成功则仅 disable，owner 由调用方保留", async () => {
    const logs: string[] = [];
    const audits: string[] = [];
    let exited: number | undefined;
    const outcome = await settleTier1StartupFailure(new Error("SECRET"), Promise.resolve(), {
      closeGate: async () => undefined,
      logError: (msg, fields) => {
        logs.push(`${msg}:${JSON.stringify(fields)}`);
      },
      audit: (action, meta) => {
        audits.push(`${action}:${JSON.stringify(meta)}`);
      },
      sendFatal: async () => undefined,
      exit: (code) => {
        exited = code;
      }
    });
    expect(outcome).toBe("executor-disabled");
    expect(exited).toBeUndefined();
    expect(logs.join("\n")).not.toContain("SECRET");
    expect(audits.join("\n")).not.toContain("SECRET");
    expect(logs.join("\n")).toContain(TIER1_EXECUTOR_STARTUP_FAILED);
  });

  it("active completion/proc wait/aggregate reject 一律 fatal 且消费 late reject", async () => {
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    try {
      for (const work of [
        Promise.reject(new Error("SECRET")),
        Promise.all([Promise.reject(new Error("SECRET")), Promise.resolve()]),
        Promise.all([Promise.resolve(), Promise.reject(new Error("SECRET"))]),
        Promise.reject(new AggregateError([new Error("SECRET")], "SECRET"))
      ]) {
        const logs: string[] = [];
        let exited: number | undefined;
        const fatal: string[] = [];
        const outcome = await settleTier1StartupFailure(new Error("SECRET"), work, {
          closeGate: async () => undefined,
          logError: (msg, fields) => {
            logs.push(`${msg}:${JSON.stringify(fields)}`);
          },
          audit: (action, meta) => {
            logs.push(`${action}:${JSON.stringify(meta)}`);
          },
          sendFatal: async (code, message) => {
            fatal.push(`${code}:${message}`);
          },
          exit: (code) => {
            exited = code;
          }
        }, 1_000);
        expect(outcome).toBe("fatal-exit");
        expect(exited).toBe(1);
        expect(fatal.join("\n")).toContain("tier1_emergency_cleanup_failed");
        expect(fatal.join("\n")).toContain(TIER1_EMERGENCY_CLEANUP_FAILED);
        expect(logs.join("\n")).not.toContain("SECRET");
      }
      let rejectLate!: (err: unknown) => void;
      const hanging = new Promise<void>((_resolve, reject) => {
        rejectLate = reject;
      });
      const outcome = await settleTier1StartupFailure("SECRET", hanging, {
        closeGate: async () => undefined,
        logError: () => undefined,
        audit: () => undefined,
        sendFatal: async () => undefined,
        exit: () => undefined
      }, 20);
      expect(outcome).toBe("fatal-exit");
      rejectLate(new Error("SECRET"));
      await Promise.resolve();
      await Promise.resolve();
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
    }
  });

  it("gate close hang/reject 或 executor 失败都是 fatal，late settle 已消费", async () => {
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    try {
      let exited: number | undefined;
      const hang = await settleTier1StartupFailure(new Error("SECRET"), Promise.resolve(), {
        closeGate: () => new Promise(() => undefined),
        logError: () => undefined,
        audit: () => undefined,
        sendFatal: async () => undefined,
        exit: (code) => {
          exited = code;
        }
      }, 30);
      expect(hang).toBe("fatal-exit");
      expect(exited).toBe(1);

      exited = undefined;
      const gateReject = await settleTier1StartupFailure(new Error("SECRET"), Promise.resolve(), {
        closeGate: async () => {
          throw new Error("SECRET");
        },
        logError: (msg, fields) => {
          expect(`${msg}:${JSON.stringify(fields)}`).not.toContain("SECRET");
        },
        audit: () => undefined,
        sendFatal: async () => undefined,
        exit: (code) => {
          exited = code;
        }
      }, 200);
      expect(gateReject).toBe("fatal-exit");
      expect(exited).toBe(1);

      exited = undefined;
      let resolveLate!: () => void;
      const lateGate = new Promise<void>((resolve) => {
        resolveLate = resolve;
      });
      const late = await settleTier1StartupFailure(new Error("SECRET"), Promise.resolve(), {
        closeGate: () => lateGate,
        logError: () => undefined,
        audit: () => undefined,
        sendFatal: async () => undefined,
        exit: (code) => {
          exited = code;
        }
      }, 20);
      expect(late).toBe("fatal-exit");
      resolveLate();
      await Promise.resolve();
      await Promise.resolve();
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
    }
  });
});

const harnessHomes = new Set<string>();
afterEach(() => {
  for (const home of harnessHomes) rmSync(home, { recursive: true, force: true });
  harnessHomes.clear();
});

describe("startup/fatal child-process harness", () => {
  const tsx = resolve(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
  const fixture = resolve(import.meta.dirname, "fixtures/startup-fatal-harness.ts");

  async function runHarness(sample: string, cleanup: string, extraEnv: Record<string, string> = {}): Promise<{
    code: number;
    logs: string;
    audit: string;
    frames: unknown[];
    ownerExists: boolean;
    home: string;
  }> {
    const home = mkdtempSync(join(tmpdir(), "saydo-startup-fatal-"));
    harnessHomes.add(home);
    const frames: unknown[] = [];
    const child = spawn(process.execPath, [tsx, fixture], {
      env: {
        ...process.env,
        SAYDO_HOME: home,
        SAYDO_SAMPLE: sample,
        SAYDO_CLEANUP: cleanup,
        SAYDO_CLEANUP_MS: "80",
        SAYDO_SUPERVISED: "1",
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    child.on("message", (message) => {
      frames.push(message);
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    const code = await new Promise<number>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
    });
    let audit = "";
    try {
      audit = readFileSync(join(home, "audit", "daemon.jsonl"), "utf8");
    } catch {
      audit = "";
    }
    let logs = output;
    try {
      const logDir = join(home, "logs");
      if (existsSync(logDir)) {
        for (const name of readdirSync(logDir)) {
          logs += readFileSync(join(logDir, name), "utf8");
        }
      }
    } catch {
      // ignore
    }
    return {
      code,
      logs,
      audit,
      frames,
      ownerExists: existsSync(join(home, "tier1", "runs", "run_keep", "agent-owner.json")),
      home
    };
  }

  const samples = [
    "error",
    "aggregate",
    "proxy",
    "revoked",
    "accessor",
    "function",
    "symbol",
    "bigint",
    "primitive"
  ];

  it("各 hostile sample 日志/audit/IPC 零 SECRET，cleanup 失败非零退出且 owner 留存", async () => {
    for (const sample of samples) {
      const result = await runHarness(sample, "reject");
      expect(result.code, sample).not.toBe(0);
      expect(result.code, sample).toBe(1);
      expect(result.logs, sample).not.toContain("SECRET");
      expect(result.audit, sample).not.toContain("SECRET");
      expect(JSON.stringify(result.frames), sample).not.toContain("SECRET");
      expect(result.ownerExists, sample).toBe(true);
      expect(result.logs, sample).toContain(TIER1_EMERGENCY_CLEANUP_FAILED);
    }
  }, 30_000);

  it("deadline hang 非零退出且 owner 留存", async () => {
    const started = Date.now();
    const result = await runHarness("error", "hang");
    expect(result.code).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
    expect(result.logs).not.toContain("SECRET");
    expect(result.audit).not.toContain("SECRET");
    expect(JSON.stringify(result.frames)).not.toContain("SECRET");
    expect(result.ownerExists).toBe(true);
    expect(result.logs).toContain(TIER1_EMERGENCY_CLEANUP_DEADLINE);
  }, 15_000);
});

describe("wiring/projection harness（非生产入口；生产 composition 见下方真实 daemon 入口）", () => {
  const tsx = resolve(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
  const entryFixture = resolve(import.meta.dirname, "fixtures/startup-entry-harness.ts");
  const gateFixture = resolve(import.meta.dirname, "fixtures/gate-bind-harness.ts");

  async function runChild(
    fixture: string,
    extraEnv: Record<string, string>
  ): Promise<{ code: number; output: string; frames: unknown[]; ownerExists: boolean; home: string }> {
    const home = mkdtempSync(join(tmpdir(), "saydo-entry-"));
    harnessHomes.add(home);
    const frames: unknown[] = [];
    const child = spawn(process.execPath, [tsx, fixture], {
      env: { ...process.env, SAYDO_HOME: home, SAYDO_SUPERVISED: "1", ...extraEnv },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    child.on("message", (message) => {
      frames.push(message);
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    const code = await new Promise<number>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
    });
    let logs = output;
    try {
      const logDir = join(home, "logs");
      if (existsSync(logDir)) {
        for (const name of readdirSync(logDir)) {
          logs += readFileSync(join(logDir, name), "utf8");
        }
      }
    } catch {
      // ignore
    }
    let audit = "";
    try {
      audit = readFileSync(join(home, "audit", "daemon.jsonl"), "utf8");
    } catch {
      audit = "";
    }
    return {
      code,
      output: `${logs}\n${audit}`,
      frames,
      ownerExists: existsSync(join(home, "tier1", "runs", "run_keep", "agent-owner.json")),
      home
    };
  }

  it("真实 gate bind + recover 失败：非零、无 stopped、owner 留存、零 SECRET", async () => {
    const result = await runChild(entryFixture, {
      SAYDO_ENTRY_SCENARIO: "gate-recover-fail",
      SAYDO_SAMPLE: "error",
      SAYDO_CLEANUP_MS: "200"
    });
    expect(result.code).toBe(3);
    expect(result.output).not.toContain("SECRET");
    expect(JSON.stringify(result.frames)).not.toContain("SECRET");
    expect(JSON.stringify(result.frames)).not.toContain("\"t\":\"stopped\"");
    expect(result.ownerExists).toBe(true);
  }, 20_000);

  it("activation hostile 投影零 SECRET 且非零退出", async () => {
    for (const sample of ["error", "aggregate", "proxy", "revoked", "accessor"]) {
      const result = await runChild(entryFixture, {
        SAYDO_ENTRY_SCENARIO: "activation",
        SAYDO_SAMPLE: sample
      });
      expect(result.code, sample).toBe(1);
      expect(result.output, sample).not.toContain("SECRET");
      expect(JSON.stringify(result.frames), sample).not.toContain("SECRET");
      expect(result.output, sample).toContain(BOOT_ACTIVATION_FAILED);
      expect(result.ownerExists, sample).toBe(true);
    }
  }, 30_000);

  it("database close failure 不发送 stopped 且非零", async () => {
    const result = await runChild(entryFixture, { SAYDO_ENTRY_SCENARIO: "db-close" });
    expect(result.code).toBe(1);
    expect(result.output).not.toContain("SECRET");
    expect(JSON.stringify(result.frames)).not.toContain("SECRET");
    expect(JSON.stringify(result.frames)).not.toContain("\"t\":\"stopped\"");
    expect(JSON.stringify(result.frames)).toContain("fatal");
    expect(result.output).toContain(DATABASE_CLOSE_FAILED);
    expect(result.ownerExists).toBe(true);
  }, 15_000);

  it("gate close hang 有界 fatal", async () => {
    const started = Date.now();
    const result = await runChild(entryFixture, {
      SAYDO_ENTRY_SCENARIO: "gate-close-hang",
      SAYDO_CLEANUP_MS: "80"
    });
    expect(result.code).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
    expect(result.output).not.toContain("SECRET");
    expect(result.ownerExists).toBe(true);
  }, 15_000);

  it.skipIf(process.platform === "win32")("真实 socket：正常 bind/rebind、EADDRINUSE、EACCES、bind-close 竞态", async () => {
    const normal = await runChild(gateFixture, { SAYDO_GATE_MODE: "normal" });
    expect(normal.code).toBe(0);

    const busy = await runChild(gateFixture, { SAYDO_GATE_MODE: "eaddrinuse" });
    expect(busy.code).toBe(1);
    expect(busy.output).toMatch(/EADDRINUSE|gate bind failed/u);

    const denied = await runChild(gateFixture, { SAYDO_GATE_MODE: "eacces" });
    expect(denied.code).toBe(1);
    expect(denied.output).toContain("EACCES");
    expect(denied.output).not.toContain("SECRET");

    const raced = await runChild(gateFixture, { SAYDO_GATE_MODE: "bind-close" });
    expect(raced.code).toBe(0);

    const delayed = await runChild(gateFixture, { SAYDO_GATE_MODE: "delay-recover" });
    expect(delayed.code).toBe(1);
    expect(delayed.output).not.toContain("SECRET");
  }, 30_000);

  function supervisorFrames(frames: unknown[], t: string): unknown[] {
    return frames.filter((frame) => typeof frame === "object" && frame !== null && (frame as { t?: string }).t === t);
  }

  function listDurableOwnerPaths(home: string): string[] {
    const found: string[] = [];
    const children = join(home, "runtime", "children");
    if (existsSync(children)) {
      for (const name of readdirSync(children)) {
        if (name.endsWith(".json")) found.push(join(children, name));
      }
    }
    const runs = join(home, "tier1", "runs");
    if (existsSync(runs)) {
      for (const runId of readdirSync(runs)) {
        const owner = join(runs, runId, "agent-owner.json");
        if (existsSync(owner)) found.push(owner);
      }
    }
    return found.sort();
  }

  function seedLockedCursorAgent(home: string): string {
    const ver = "1.0.0-test";
    const dir = join(home, "versions", ver);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const bin = join(dir, "cursor-agent");
    writeFileSync(bin, "#!/bin/sh\n[ \"$1\" = --version ] && printf '%s\\n' '1.0.0-test'\n", { mode: 0o755 });
    chmodSync(bin, 0o755);
    // 活动 config 必须是完整合法 normal-mode 形状，再叠加 pinned Tier-1。
    // 仅写 [tier1] 会被公开 validateConfig / 启动校验 fail-closed 成 RECOVERY_ONLY，
    // 生产正确地跳过 Tier1Executor.recover()。模型/供给/隐私形状对齐
    // recovery-only-process.test.ts 的 validConfig()。
    writeFileSync(join(home, "config.toml"), [
      "[models]",
      'profile = "default"',
      'dialog = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }',
      'thinking = { provider = "api", via = "openrouter", model = "deepseek/deepseek-r1" }',
      'cheap = { provider = "api", via = "openrouter", model = "google/gemini-3.1-flash-lite" }',
      'evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }',
      "",
      "[providers.api.openrouter]",
      'base_url = "https://openrouter.ai/api/v1"',
      'api_key = "env:OPENROUTER_API_KEY"',
      "",
      "[privacy]",
      "store_audio = false",
      "store_transcript = true",
      "audio_retention_days = 0",
      "",
      "[tier1]",
      `cursor_agent_bin = ${JSON.stringify(bin)}`,
      `cursor_agent_pinned_version = ${JSON.stringify(ver)}`,
      ""
    ].join("\n"), { mode: 0o600 });
    return bin;
  }

  it("seedLockedCursorAgent 写出的活动配置通过公开 validateConfig（normal mode）", () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-seed-cfg-")));
    harnessHomes.add(home);
    seedLockedCursorAgent(home);
    const config = parseConfigText(readFileSync(join(home, "config.toml"), "utf8"));
    const validation = validateConfig({
      config,
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    expect(validation.ok).toBe(true);
    expect(validation.violations).toEqual([]);
  });

  it("真实 daemon 入口：database close failure 不发送 stopped、非零、零 SECRET、owner 留存", async () => {
    const { reservePort, startDaemonProcess } = await import("./helpers/daemonProcess.js");
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-entry-db-")));
    harnessHomes.add(home);
    mkdirSync(join(home, "tier1", "runs", "run_keep"), { recursive: true, mode: 0o700 });
    const ownerPath = join(home, "tier1", "runs", "run_keep", "agent-owner.json");
    writeFileSync(ownerPath, JSON.stringify({
      version: 1,
      runId: "run_keep",
      pid: 4242,
      binary: "/bin/sleep",
      processStart: "owned-start",
      ownerInstanceId: "owner",
      ownerPid: 2,
      kind: "tier1:agent",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      jobName: formatSayDoJobName("Local", "owner", "run_keep", "01234567-89ab-cdef-0123-456789abcdef")
    }));
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true,
      importAfterTsxLoader: [resolve(import.meta.dirname, "fixtures/close-durables-reject.ts")],
      env: {
        OPENROUTER_API_KEY: "process-test-key"
      }
    });
    try {
      const exited = new Promise<number>((resolveExit) => {
        daemon.child.once("exit", (code) => resolveExit(code ?? 1));
      });
      daemon.sendSupervisor({ v: 1, t: "prepareShutdown", reason: "supervisor_stop" });
      const code = await Promise.race([
        exited,
        new Promise<number>((_, reject) => {
          setTimeout(() => reject(new Error("daemon close-durable timeout")), 15_000);
        })
      ]);
      const frames = JSON.stringify(daemon.frames);
      const output = `${daemon.output()}\n${frames}`;
      expect(code).not.toBe(0);
      expect(output).not.toContain("SECRET");
      expect(frames).not.toContain("\"t\":\"stopped\"");
      expect(frames).toContain("fatal");
      expect(output).toContain(DATABASE_CLOSE_FAILED);
      expect(existsSync(ownerPath)).toBe(true);
    } finally {
      try {
        daemon.child.kill("SIGKILL");
      } catch {
        // 已退
      }
    }
  }, 30_000);

  it("真实 daemon 入口：bind/recover hold 期间 shutdown 不 recover、受 deadline 收口", async () => {
    const { reservePort, startDaemonProcess } = await import("./helpers/daemonProcess.js");
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-entry-hold-")));
    harnessHomes.add(home);
    seedLockedCursorAgent(home);
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true,
      importAfterTsxLoader: [resolve(import.meta.dirname, "fixtures/recover-hold.ts")],
      env: {
        OPENROUTER_API_KEY: "process-test-key"
      }
    });
    try {
      const started = Date.now();
      await new Promise<void>((resolveWait, rejectWait) => {
        const timer = setTimeout(() => rejectWait(new Error("recover-entered frame timeout")), 15_000);
        const check = (): void => {
          if (supervisorFrames(daemon.frames, "recover-entered").length === 1) {
            clearTimeout(timer);
            resolveWait();
            return;
          }
          setTimeout(check, 20);
        };
        check();
      });
      const ownersAtHold = listDurableOwnerPaths(home);
      daemon.sendSupervisor({ v: 1, t: "prepareShutdown", reason: "supervisor_stop" });
      const code = await Promise.race([
        new Promise<number>((resolveExit) => {
          daemon.child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
        }),
        new Promise<number>((_, reject) => {
          setTimeout(() => reject(new Error("daemon recover-hold shutdown timeout")), 15_000);
        })
      ]);
      expect(Date.now() - started).toBeLessThan(15_000);
      expect(code).toBe(0);
      expect(supervisorFrames(daemon.frames, "recover-entered")).toHaveLength(1);
      expect(supervisorFrames(daemon.frames, "test-recover-attempt")).toEqual([]);
      expect(existsSync(join(home, "recover-attempt.marker"))).toBe(false);
      expect(listDurableOwnerPaths(home)).toEqual(ownersAtHold);
      expect(supervisorFrames(daemon.frames, "fatal")).toEqual([]);
      const stopped = supervisorFrames(daemon.frames, "stopped");
      expect(stopped).toHaveLength(1);
      expect(stopped[0]).toMatchObject({ v: 1, t: "stopped", reason: "supervisor_stop" });
      expect(daemon.output()).not.toContain("SECRET");
    } finally {
      try {
        daemon.child.kill("SIGKILL");
      } catch {
        // 已退
      }
    }
  }, 30_000);

  it("真实 src/index.ts：prebound ready IPC 失败则恰好一个 fatal、零 stopped、非零退出", async () => {
    const { reservePort, startDaemonProcess } = await import("./helpers/daemonProcess.js");
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-prebound-ready-")));
    harnessHomes.add(home);
    writeFileSync(join(home, "config.toml"), "[models\ninvalid =", { mode: 0o600 });
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true,
      waitForHealth: false,
      importAfterTsxLoader: [resolve(import.meta.dirname, "fixtures/ready-send-fail.ts")]
    });
    try {
      const code = await Promise.race([
        new Promise<number>((resolveExit) => {
          daemon.child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
        }),
        new Promise<number>((_, reject) => {
          setTimeout(() => reject(new Error(`prebound ready timeout:${JSON.stringify(daemon.frames)}`)), 15_000);
        })
      ]);
      expect(code).not.toBe(0);
      expect(supervisorFrames(daemon.frames, "fatal")).toHaveLength(1);
      expect(supervisorFrames(daemon.frames, "stopped")).toEqual([]);
      expect(() => process.kill(daemon.child.pid as number, 0)).toThrow();
    } finally {
      try {
        daemon.child.kill("SIGKILL");
      } catch {
        // 已退
      }
    }
  }, 30_000);

  it("bind 前 signal 立即 claim，restart 不得抢占", async () => {
    const { reservePort, startDaemonProcess } = await import("./helpers/daemonProcess.js");
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-listen-claim-")));
    harnessHomes.add(home);
    seedLockedCursorAgent(home);
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true,
      waitForHealth: false,
      importAfterTsxLoader: [resolve(import.meta.dirname, "fixtures/listen-hold.ts")],
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    const exited = new Promise<number>((resolveExit) => {
      if (daemon.child.exitCode != null) {
        resolveExit(daemon.child.exitCode);
        return;
      }
      if (daemon.child.signalCode != null) {
        resolveExit(1);
        return;
      }
      daemon.child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
    });
    try {
      await new Promise<void>((resolveWait, rejectWait) => {
        const timer = setTimeout(() => rejectWait(new Error("listen-entered timeout")), 15_000);
        const check = (): void => {
          if (supervisorFrames(daemon.frames, "listen-entered").length === 1) {
            clearTimeout(timer);
            resolveWait();
            return;
          }
          if (daemon.child.exitCode != null || daemon.child.signalCode != null) {
            clearTimeout(timer);
            rejectWait(new Error(
              `daemon exited before listen-entered:${String(daemon.child.exitCode)}:${JSON.stringify(daemon.frames)}\n${daemon.output()}`
            ));
            return;
          }
          setTimeout(check, 20);
        };
        check();
      });
      daemon.sendSupervisor({ v: 1, t: "prepareShutdown", reason: "supervisor_stop" });
      const code = await Promise.race([
        exited,
        new Promise<number>((_, reject) => {
          setTimeout(
            () => reject(new Error(`listen-hold shutdown timeout:${JSON.stringify(daemon.frames)}`)),
            15_000
          );
        })
      ]);
      expect(code).toBe(0);
      const steal = supervisorFrames(daemon.frames, "restart-steal")[0] as { stolen?: boolean } | undefined;
      expect(steal, `frames=${JSON.stringify(daemon.frames)}`).toMatchObject({ stolen: false });
      expect(supervisorFrames(daemon.frames, "restartRequested")).toEqual([]);
      const stopped = supervisorFrames(daemon.frames, "stopped");
      expect(stopped).toHaveLength(1);
      expect(stopped[0]).toMatchObject({ t: "stopped", reason: "supervisor_stop" });
    } finally {
      try {
        daemon.child.kill("SIGKILL");
      } catch {
        // 已退
      }
    }
  }, 30_000);

  it("真实 daemon 入口：prior-generation owner 在 ready 前回收", async () => {
    const { mkdirSync, writeFileSync, existsSync } = await import("node:fs");
    const { reservePort, startDaemonProcess } = await import("./helpers/daemonProcess.js");
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-entry-prior-")));
    harnessHomes.add(home);
    const ownerPath = join(home, "runtime", "children", "880003.json");
    mkdirSync(join(home, "runtime", "children"), { recursive: true, mode: 0o700 });
    writeFileSync(ownerPath, JSON.stringify({
      version: 1,
      pid: 880003,
      kind: "exec",
      binary: process.execPath,
      processStart: "owned-start",
      ownerPid: 2,
      ownerInstanceId: "prior-owner",
      runId: "prior-run",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      jobName: formatSayDoJobName(
        "Local",
        "prior-owner",
        "prior-run",
        "01234567-89ab-cdef-0123-456789abcdef"
      )
    }));
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true,
      env: {
        OPENROUTER_API_KEY: "process-test-key"
      }
    });
    try {
      for (let i = 0; i < 200 && existsSync(ownerPath); i += 1) {
        await new Promise((resolveWait) => {
          setTimeout(resolveWait, 20);
        });
      }
      expect(existsSync(ownerPath)).toBe(false);
    } finally {
      await daemon.stop();
    }
  }, 30_000);

  it("真实 src/index.ts：ready send 未完成时不得写 daemon.start", async () => {
    const { reservePort, startDaemonProcess } = await import("./helpers/daemonProcess.js");
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-ready-hang-")));
    harnessHomes.add(home);
    seedLockedCursorAgent(home);
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      supervised: true,
      importAfterTsxLoader: [resolve(import.meta.dirname, "fixtures/ready-send-hang.ts")],
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    try {
      await new Promise<void>((resolveWait, rejectWait) => {
        const timer = setTimeout(() => rejectWait(new Error(`ready hang timeout:${JSON.stringify(daemon.frames)}`)), 15_000);
        const check = (): void => {
          if (supervisorFrames(daemon.frames, "ready").length === 1) {
            clearTimeout(timer);
            resolveWait();
            return;
          }
          setTimeout(check, 20);
        };
        check();
      });
      await new Promise((resolveWait) => {
        setTimeout(resolveWait, 800);
      });
      const blobs: Buffer[] = [];
      for (const name of ["saydo.db", "saydo.db-wal"]) {
        const path = join(home, name);
        if (existsSync(path)) blobs.push(readFileSync(path));
      }
      expect(Buffer.concat(blobs).includes("daemon.start")).toBe(false);
      expect(supervisorFrames(daemon.frames, "fatal")).toEqual([]);
      expect(() => process.kill(daemon.child.pid as number, 0)).not.toThrow();
    } finally {
      try {
        daemon.child.kill("SIGKILL");
      } catch {
        // 已退
      }
    }
  }, 30_000);
});
