import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessGroupLifecycleError } from "../src/processGroupLifecycle.js";
import { contaminateByoaLifecycle, resetByoaLifecycleForTests } from "../src/providers/byoa/runner.js";
import {
  assertShutdownExactEmpty,
  isIndependentDeadlineError,
  performEmergencyCleanup,
  raceWithMonotonicDeadline,
  setShutdownDeadlineTestHooks,
  TIER1_EMERGENCY_CLEANUP_DEADLINE_MS
} from "../src/shutdownDeadline.js";
import { resetRuntimeChildLifecycleForTests } from "../src/runtimeChildRegistry.js";

afterEach(() => {
  setShutdownDeadlineTestHooks(null);
  try {
    resetRuntimeChildLifecycleForTests();
  } catch {
    // contamination 用例由断言覆盖；reset 仍清空共享状态
  }
  resetByoaLifecycleForTests();
});

describe("shutdown 一次性单调 deadline", () => {
  it("wall clock 冻结时永不 settle 的 drain 仍硬上界", async () => {
    const frozenNow = Date.now();
    const realNow = Date.now;
    Date.now = () => frozenNow;
    let fired = false;
    setShutdownDeadlineTestHooks({
      setTimeout: (fn) => {
        queueMicrotask(() => {
          fired = true;
          fn();
        });
        return {};
      },
      clearTimeout: () => undefined
    });
    try {
      await expect(raceWithMonotonicDeadline(new Promise(() => undefined), "restart", 25_000))
        .rejects.toThrow(/shutdown deadline exceeded:restart/u);
      expect(fired).toBe(true);
    } finally {
      Date.now = realNow;
      setShutdownDeadlineTestHooks(null);
    }
  });

  it("work 先完成时清 timer", async () => {
    let cleared = 0;
    setShutdownDeadlineTestHooks({
      setTimeout: (fn) => {
        return { fn };
      },
      clearTimeout: () => {
        cleared += 1;
      }
    });
    try {
      await expect(raceWithMonotonicDeadline(Promise.resolve("ok"), "shutdown", 25_000)).resolves.toBe("ok");
      expect(cleared).toBe(1);
    } finally {
      setShutdownDeadlineTestHooks(null);
    }
  });

  it("recovery-only restart: drain 永不 settle 时 fatal、不 stopped、不 spawn", async () => {
    let spawned = 0;
    let stopped = 0;
    setShutdownDeadlineTestHooks({
      setTimeout: (fn) => {
        queueMicrotask(fn);
        return {};
      },
      clearTimeout: () => undefined
    });
    const drain = new Promise<never>(() => undefined);
    await expect(
      raceWithMonotonicDeadline(
        drain.then(() => {
          stopped += 1;
          spawned += 1;
        }),
        "restart"
      )
    ).rejects.toThrow(/shutdown deadline exceeded:restart/u);
    expect(stopped).toBe(0);
    expect(spawned).toBe(0);
  });

  it("contamination 使 exact-empty 关卡拒绝 stopped", () => {
    contaminateByoaLifecycle(new ProcessGroupLifecycleError("byoa still alive"));
    expect(() => assertShutdownExactEmpty("/tmp/saydo-shutdown-exact-absent")).toThrow(ProcessGroupLifecycleError);
  });

  it("永不 settle 的 emergency cleanup 有独立硬截止且零 unhandled rejection", async () => {
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    let rejectLate!: (err: unknown) => void;
    const hanging = new Promise<void>((_resolve, reject) => {
      rejectLate = reject;
    });
    setShutdownDeadlineTestHooks({
      setTimeout: (fn) => {
        queueMicrotask(fn);
        return {};
      },
      clearTimeout: () => undefined
    });
    try {
      await expect(raceWithMonotonicDeadline(hanging, "tier1-emergency-shutdown", TIER1_EMERGENCY_CLEANUP_DEADLINE_MS))
        .rejects.toSatisfy((err: unknown) => isIndependentDeadlineError(err));
      rejectLate(new Error("SECRET"));
      await Promise.resolve();
      await Promise.resolve();
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
      setShutdownDeadlineTestHooks(null);
    }
  });

  it("deadline 后 late resolve 不改写已失败的 race", async () => {
    let resolveLate!: (value: string) => void;
    const work = new Promise<string>((resolve) => {
      resolveLate = resolve;
    });
    setShutdownDeadlineTestHooks({
      setTimeout: (fn) => {
        queueMicrotask(fn);
        return {};
      },
      clearTimeout: () => undefined
    });
    try {
      const raced = raceWithMonotonicDeadline(work, "tier1-emergency-shutdown", 1);
      await expect(raced).rejects.toSatisfy((err: unknown) => isIndependentDeadlineError(err));
      resolveLate("late-ok");
      await Promise.resolve();
      await expect(raced).rejects.toSatisfy((err: unknown) => isIndependentDeadlineError(err));
    } finally {
      setShutdownDeadlineTestHooks(null);
    }
  });

  it("emergency cleanup 非 deadline rejection 也失败且消费 late reject", async () => {
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    let rejectLate!: (err: unknown) => void;
    const hanging = new Promise<void>((_, reject) => {
      rejectLate = reject;
    });
    try {
      await expect(performEmergencyCleanup(Promise.reject(new Error("SECRET")), "tier1-emergency-shutdown", 1_000))
        .resolves.toEqual({ ok: false, deadline: false });
      const deadline = await performEmergencyCleanup(hanging, "tier1-emergency-shutdown", 20);
      expect(deadline).toEqual({ ok: false, deadline: true });
      rejectLate(new Error("SECRET"));
      await Promise.resolve();
      await Promise.resolve();
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
    }
  });

  it("真实短 deadline 有界", async () => {
    const started = Date.now();
    await expect(raceWithMonotonicDeadline(new Promise(() => undefined), "tier1-emergency-shutdown", 20))
      .rejects.toSatisfy((err: unknown) => isIndependentDeadlineError(err));
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("独立 child 无其它 handle 时仍等到 deadline 非零退出", async () => {
    const tsx = resolve(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
    const fixture = resolve(import.meta.dirname, "fixtures/deadline-hang.ts");
    const started = Date.now();
    const child = spawn(process.execPath, [tsx, fixture], {
      env: { ...process.env, SAYDO_DEADLINE_MS: "80" },
      stdio: "ignore"
    });
    const code = await new Promise<number>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
    });
    expect(code).toBe(7);
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
  });
});
