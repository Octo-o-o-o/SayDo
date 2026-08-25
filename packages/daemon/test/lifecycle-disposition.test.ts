import { afterEach, describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import {
  LifecycleDisposition,
  RESTART_OVERRIDE_GRACE_MS,
  afterClientGone,
  setLifecycleDispositionClock,
  shutdownReasonOf,
  yieldForPendingSignals
} from "../src/lifecycleDisposition.js";
import {
  raceWithMonotonicDeadline,
  setShutdownDeadlineTestHooks
} from "../src/shutdownDeadline.js";

afterEach(() => {
  setLifecycleDispositionClock(null);
  setShutdownDeadlineTestHooks(null);
});

function installVirtualClock(start = 0) {
  let now = start;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  let nextId = 1;
  setLifecycleDispositionClock({
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout: (timer) => {
      const index = timers.findIndex((item) => item.id === timer);
      if (index >= 0) timers.splice(index, 1);
    }
  });
  return {
    get now() {
      return now;
    },
    advance(ms: number) {
      now += ms;
      timers.sort((a, b) => a.at - b.at);
      while (timers[0] && timers[0].at <= now) {
        const due = timers.shift();
        due?.fn();
      }
    }
  };
}

describe("lifecycle disposition 优先级与冻结边界", () => {
  it("freeze 前 signal 覆盖 restart", () => {
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 1 })).toBe(true);
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    expect(life.freeze()).toEqual({ kind: "signal", reason: "supervisor_stop" });
    expect(shutdownReasonOf(life.freeze())).toBe("supervisor_stop");
  });

  it("signal 已 claim 则 restart 不得抢占", () => {
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    expect(life.claim({ kind: "restart", generation: 1 })).toBe(false);
    expect(life.peek()).toEqual({ kind: "signal", reason: "supervisor_stop" });
    expect(life.freeze()).toEqual({ kind: "signal", reason: "supervisor_stop" });
  });

  it("freeze 后 signal 不得覆盖 restart", () => {
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 2 })).toBe(true);
    expect(life.freeze()).toEqual({ kind: "restart", generation: 2 });
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(false);
    expect(life.peek()).toEqual({ kind: "restart", generation: 2 });
  });

  it("fatal 覆盖 restart 与 signal，且不被降级", () => {
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 3 })).toBe(true);
    expect(life.claim({ kind: "fatal", code: "x", message: "boom" })).toBe(true);
    expect(life.claim({ kind: "signal", reason: "cli_sigint" })).toBe(false);
    expect(life.claim({ kind: "restart", generation: 4 })).toBe(false);
    expect(life.freeze()).toMatchObject({ kind: "fatal", code: "x" });
  });

  it("drain 进行中到达的 signal 在 freeze 时胜出", async () => {
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 5 })).toBe(true);
    let releaseDrain!: () => void;
    const drain = new Promise<void>((resolve) => {
      releaseDrain = resolve;
    });
    const committed = drain.then(() => life.freeze());
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    releaseDrain();
    await expect(committed).resolves.toEqual({ kind: "signal", reason: "supervisor_stop" });
  });

  it("client gone 之后才跑 restart 续体，期间 signal 可抢占", async () => {
    const life = new LifecycleDisposition();
    const socket = new EventEmitter() as EventEmitter & { destroyed: boolean };
    socket.destroyed = false;
    let ran = 0;
    expect(life.claim({ kind: "restart", generation: 6 })).toBe(true);
    afterClientGone(socket, () => {
      if (life.peek()?.kind !== "restart") return;
      ran += 1;
      life.freeze();
    });
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    socket.emit("close");
    await yieldForPendingSignals();
    await yieldForPendingSignals();
    expect(ran).toBe(0);
    expect(life.freeze()).toEqual({ kind: "signal", reason: "supervisor_stop" });
  });

  it("grace 内 signal 可升级，到期 freeze 后不可改", async () => {
    const clock = installVirtualClock();
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 7 })).toBe(true);
    life.armRestartOverrideGrace();
    const waiting = life.waitRestartOverrideGrace();
    clock.advance(RESTART_OVERRIDE_GRACE_MS - 1);
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    await waiting;
    expect(life.freeze()).toEqual({ kind: "signal", reason: "supervisor_stop" });

    const frozen = new LifecycleDisposition();
    expect(frozen.claim({ kind: "restart", generation: 8 })).toBe(true);
    frozen.armRestartOverrideGrace();
    const untilFreeze = frozen.waitRestartOverrideGrace();
    clock.advance(RESTART_OVERRIDE_GRACE_MS);
    await untilFreeze;
    expect(frozen.freeze()).toEqual({ kind: "restart", generation: 8 });
    expect(frozen.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(false);
    expect(frozen.claim({ kind: "fatal", code: "late" })).toBe(false);
  });

  it("grace 从武装时刻起算，drain 结束不重置窗口", async () => {
    const clock = installVirtualClock();
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 9 })).toBe(true);
    life.armRestartOverrideGrace();
    clock.advance(RESTART_OVERRIDE_GRACE_MS - 10);
    const waiting = life.waitRestartOverrideGrace();
    clock.advance(10);
    await waiting;
    expect(life.freeze()).toEqual({ kind: "restart", generation: 9 });
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(false);
  });

  it("grace 内 fatal 可升级且不被 signal 降级", async () => {
    const clock = installVirtualClock();
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 13 })).toBe(true);
    life.armRestartOverrideGrace();
    const waiting = life.waitRestartOverrideGrace();
    clock.advance(1);
    expect(life.claim({ kind: "fatal", code: "x" })).toBe(true);
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(false);
    await waiting;
    expect(life.freeze()).toMatchObject({ kind: "fatal", code: "x" });
  });

  it("signal/fatal 发起的 shutdown 不等待 grace", async () => {
    const clock = installVirtualClock();
    const signalLife = new LifecycleDisposition();
    expect(signalLife.claim({ kind: "signal", reason: "cli_sigint" })).toBe(true);
    signalLife.armRestartOverrideGrace();
    await signalLife.waitRestartOverrideGrace();
    expect(clock.now).toBe(0);
    expect(signalLife.freeze()).toEqual({ kind: "signal", reason: "cli_sigint" });

    const fatalLife = new LifecycleDisposition();
    expect(fatalLife.claim({ kind: "fatal", code: "boom" })).toBe(true);
    await fatalLife.waitRestartOverrideGrace();
    expect(clock.now).toBe(0);
    expect(fatalLife.freeze()).toMatchObject({ kind: "fatal", code: "boom" });
  });

  it("wall clock 冻结时 grace 仍由单调 timer 结束", async () => {
    let timerFn: (() => void) | undefined;
    setLifecycleDispositionClock({
      now: () => 0,
      setTimeout: (fn, ms) => {
        expect(ms).toBe(RESTART_OVERRIDE_GRACE_MS);
        timerFn = fn;
        return {};
      },
      clearTimeout: () => undefined
    });
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 10 })).toBe(true);
    life.armRestartOverrideGrace();
    let settled = false;
    const waiting = life.waitRestartOverrideGrace().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(timerFn).toEqual(expect.any(Function));
    timerFn?.();
    await waiting;
    expect(settled).toBe(true);
    expect(life.freeze()).toEqual({ kind: "restart", generation: 10 });
  });

  it("单调时钟回拨时 grace 立即结束，不无限延长", async () => {
    let now = 100;
    setLifecycleDispositionClock({
      now: () => now,
      setTimeout: () => ({}),
      clearTimeout: () => undefined
    });
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 11 })).toBe(true);
    life.armRestartOverrideGrace();
    now = 40;
    await life.waitRestartOverrideGrace();
    expect(life.freeze()).toEqual({ kind: "restart", generation: 11 });
  });

  it("grace 到期不冻结，drain 结束前 fatal 仍可升级", async () => {
    const clock = installVirtualClock();
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 20 })).toBe(true);
    life.armRestartOverrideGrace();
    const waiting = life.waitRestartOverrideGrace();
    const drain = new Promise<void>(() => undefined);
    void drain;
    clock.advance(RESTART_OVERRIDE_GRACE_MS);
    await waiting;
    expect(life.isFrozen).toBe(false);
    expect(life.claim({ kind: "fatal", code: "late" })).toBe(true);
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(false);
    expect(life.freeze()).toMatchObject({ kind: "fatal", code: "late" });
  });

  it("grace 边界前 signal 胜出但不冻结，后到 fatal 仍升级", async () => {
    const clock = installVirtualClock();
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 21 })).toBe(true);
    life.armRestartOverrideGrace();
    const waiting = life.waitRestartOverrideGrace();
    clock.advance(RESTART_OVERRIDE_GRACE_MS - 1);
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    expect(life.isFrozen).toBe(false);
    expect(life.claim({ kind: "fatal", code: "x" })).toBe(true);
    await waiting;
    clock.advance(1);
    expect(life.freeze()).toMatchObject({ kind: "fatal", code: "x" });
  });

  it("grace 边界前 fatal 胜出，signal 不得降级，terminal freeze 才提交", async () => {
    const clock = installVirtualClock();
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 22 })).toBe(true);
    life.armRestartOverrideGrace();
    const waiting = life.waitRestartOverrideGrace();
    clock.advance(RESTART_OVERRIDE_GRACE_MS - 1);
    expect(life.claim({ kind: "fatal", code: "boom" })).toBe(true);
    expect(life.isFrozen).toBe(false);
    await waiting;
    clock.advance(1);
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(false);
    expect(life.freeze()).toMatchObject({ kind: "fatal", code: "boom" });
  });

  it("signal 后 gate/cleanup fatal 升级为唯一 fatal", () => {
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "signal", reason: "supervisor_stop" })).toBe(true);
    expect(life.isFrozen).toBe(false);
    expect(life.claim({ kind: "fatal", code: "gate_failed" })).toBe(true);
    expect(life.claim({ kind: "signal", reason: "cli_sigint" })).toBe(false);
    expect(life.freeze()).toMatchObject({ kind: "fatal", code: "gate_failed" });
  });

  it("grace 等待纳入单一 shutdown 总截止", async () => {
    setLifecycleDispositionClock({
      now: () => 0,
      setTimeout: () => ({}),
      clearTimeout: () => undefined
    });
    setShutdownDeadlineTestHooks({
      setTimeout: (fn) => {
        queueMicrotask(fn);
        return {};
      },
      clearTimeout: () => undefined
    });
    const life = new LifecycleDisposition();
    expect(life.claim({ kind: "restart", generation: 12 })).toBe(true);
    life.armRestartOverrideGrace();
    await expect(raceWithMonotonicDeadline(life.waitRestartOverrideGrace(), "restart"))
      .rejects.toThrow(/shutdown deadline exceeded:restart/u);
  });
});
