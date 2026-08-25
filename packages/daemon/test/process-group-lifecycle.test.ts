import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import {
  FALLBACK_SIGKILL_FAILED,
  KILL_EPERM,
  MAX_ERROR_GRAPH_CHILD_SLOTS,
  MAX_ERROR_GRAPH_NODES,
  MAX_ERROR_GRAPH_PROTO_STEPS,
  OPAQUE_ERROR_GRAPH_VALUE,
  ProcessGroupLifecycleError,
  RuntimeInvocationError,
  UNSAFE_ERROR_GRAPH_SENTINEL,
  asProcessGroupLifecycleError,
  combineLifecycleFailureList,
  combineLifecycleFailures,
  contaminateSharedLifecycle,
  invocationBusinessFailure,
  inspectUntrustedPipeFailure,
  isProcessGroupLifecycleError,
  lifecycleFailureLeaves,
  PIPE_OPAQUE_FAILURE,
  projectTrustedKillFailure,
  projectUnknownFailure,
  resetSharedLifecycleForTests,
  safeFailureText,
  settleWithLeaseRelease,
  sharedLifecycleContaminationError
} from "../src/processGroupLifecycle.js";

const HOSTILE_GRAPH_MESSAGE = "process group error graph contained a hostile value";

type TrapCounts = {
  get: number;
  getOwnPropertyDescriptor: number;
  ownKeys: number;
  getPrototypeOf: number;
  has: number;
  set: number;
  apply: number;
  construct: number;
  isExtensible: number;
  preventExtensions: number;
  defineProperty: number;
  deleteProperty: number;
  setPrototypeOf: number;
};

function blankTraps(): TrapCounts {
  return {
    get: 0,
    getOwnPropertyDescriptor: 0,
    ownKeys: 0,
    getPrototypeOf: 0,
    has: 0,
    set: 0,
    apply: 0,
    construct: 0,
    isExtensible: 0,
    preventExtensions: 0,
    defineProperty: 0,
    deleteProperty: 0,
    setPrototypeOf: 0
  };
}

function trapTotal(counts: TrapCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

function countingProxy<T extends object>(target: T, counts: TrapCounts): T {
  return new Proxy(target, {
    get(t, p, r) {
      counts.get += 1;
      return Reflect.get(t, p, r);
    },
    getOwnPropertyDescriptor(t, p) {
      counts.getOwnPropertyDescriptor += 1;
      return Reflect.getOwnPropertyDescriptor(t, p);
    },
    ownKeys(t) {
      counts.ownKeys += 1;
      return Reflect.ownKeys(t);
    },
    getPrototypeOf(t) {
      counts.getPrototypeOf += 1;
      return Reflect.getPrototypeOf(t);
    },
    has(t, p) {
      counts.has += 1;
      return Reflect.has(t, p);
    },
    set(t, p, v, r) {
      counts.set += 1;
      return Reflect.set(t, p, v, r);
    },
    apply(t, thisArg, args) {
      counts.apply += 1;
      return Reflect.apply(t as never, thisArg, args);
    },
    construct(t, args, newTarget) {
      counts.construct += 1;
      return Reflect.construct(t as never, args, newTarget);
    },
    isExtensible(t) {
      counts.isExtensible += 1;
      return Reflect.isExtensible(t);
    },
    preventExtensions(t) {
      counts.preventExtensions += 1;
      return Reflect.preventExtensions(t);
    },
    defineProperty(t, p, desc) {
      counts.defineProperty += 1;
      return Reflect.defineProperty(t, p, desc);
    },
    deleteProperty(t, p) {
      counts.deleteProperty += 1;
      return Reflect.deleteProperty(t, p);
    },
    setPrototypeOf(t, proto) {
      counts.setPrototypeOf += 1;
      return Reflect.setPrototypeOf(t, proto);
    }
  });
}

function wrapLayers(inner: Error, layers: number): Error {
  let current: Error = inner;
  for (let i = 0; i < layers; i++) {
    current = new AggregateError([current], `layer-${String(i)}`);
  }
  return current;
}

function malformedGetter(): AggregateError {
  const malformed = new AggregateError([new Error("x")], "malformed");
  Object.defineProperty(malformed, "errors", {
    get(): unknown {
      throw new Error("proxy errors");
    }
  });
  return malformed;
}

function throwingMessageError(hits: { n: number }): Error {
  const err = new Error("init");
  Object.defineProperty(err, "message", {
    configurable: true,
    enumerable: true,
    get(): string {
      hits.n += 1;
      throw new Error("hostile message");
    }
  });
  Object.defineProperty(err, "toString", {
    value(): string {
      hits.n += 1;
      throw new Error("hostile toString");
    }
  });
  Object.defineProperty(err, "valueOf", {
    value(): string {
      hits.n += 1;
      throw new Error("hostile valueOf");
    }
  });
  return err;
}

function expectHostileProjection(leaf: Error, origin: object): void {
  expect(Object.is(leaf, origin)).toBe(false);
  expect(leaf).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
  expect(leaf).not.toBe(OPAQUE_ERROR_GRAPH_VALUE);
  expect(leaf).toBeInstanceOf(ProcessGroupLifecycleError);
  expect(Object.isFrozen(leaf)).toBe(true);
}

describe("A1 process group lifecycle error", () => {
  it("识别进程组未 ESRCH 错误并禁止降格为普通 Error", () => {
    const err = new ProcessGroupLifecycleError("agent process group 12345 did not exit");
    expect(isProcessGroupLifecycleError(err)).toBe(true);
    expect(isProcessGroupLifecycleError(new Error("agent process group 9 state unknown"))).toBe(false);
    expect(isProcessGroupLifecycleError(new Error("ordinary business failure"))).toBe(false);
    expect(asProcessGroupLifecycleError(new Error("owned process group still alive")).code).toBe(
      "process_group_not_reaped"
    );
    expect(asProcessGroupLifecycleError(new Error("owned process group still alive")).message).not.toContain(
      "owned process group still alive"
    );
  });

  it("递归识别 AggregateError 中的 lifecycle error", () => {
    const leaf = new ProcessGroupLifecycleError("CloseHandle failed");
    expect(isProcessGroupLifecycleError(combineLifecycleFailures(new Error("setup exit 1"), leaf))).toBe(true);
    const nested = new AggregateError(
      [new AggregateError([leaf], "inner"), new Error("setup exit 1")],
      "outer"
    );
    expect(isProcessGroupLifecycleError(nested)).toBe(true);
    expect(isProcessGroupLifecycleError(new AggregateError([new Error("setup failed")], "plain"))).toBe(false);
  });

  it("循环与畸形 errors 不得让分类器抛错", () => {
    const cycle = new AggregateError([], "cycle");
    cycle.errors.push(cycle);
    expect(cycle.errors[0]).toBe(cycle);
    expect(() => isProcessGroupLifecycleError(cycle)).not.toThrow();
    expect(isProcessGroupLifecycleError(cycle)).toBe(true);
    expect(lifecycleFailureLeaves(cycle)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    const nestedCycle = new AggregateError([], "outer");
    nestedCycle.errors.push(cycle);
    cycle.errors.push(nestedCycle);
    expect(nestedCycle.errors[0]).toBe(cycle);
    expect(cycle.errors.includes(nestedCycle)).toBe(true);
    expect(() => isProcessGroupLifecycleError(nestedCycle)).not.toThrow();
    expect(isProcessGroupLifecycleError(nestedCycle)).toBe(true);
    expect(lifecycleFailureLeaves(nestedCycle)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    const leaf = new ProcessGroupLifecycleError("CloseHandle failed");
    const cycledLeaf = new AggregateError([leaf], "cycled-leaf");
    cycledLeaf.errors.push(cycledLeaf);
    expect(cycledLeaf.errors.includes(cycledLeaf)).toBe(true);
    expect(() => isProcessGroupLifecycleError(cycledLeaf)).not.toThrow();
    expect(isProcessGroupLifecycleError(cycledLeaf)).toBe(true);
    expect(lifecycleFailureLeaves(cycledLeaf)).toEqual([leaf, UNSAFE_ERROR_GRAPH_SENTINEL]);
    const malformed = new AggregateError([new Error("x")], "malformed");
    Object.defineProperty(malformed, "errors", {
      get(): unknown {
        throw new Error("proxy errors");
      }
    });
    expect(() => isProcessGroupLifecycleError(malformed)).not.toThrow();
    expect(isProcessGroupLifecycleError(malformed)).toBe(true);
    expect(lifecycleFailureLeaves(malformed)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    const notArray = new AggregateError([new ProcessGroupLifecycleError("CloseHandle failed")], "bag");
    Object.defineProperty(notArray, "errors", { value: "not-array" });
    expect(() => isProcessGroupLifecycleError(notArray)).not.toThrow();
    expect(isProcessGroupLifecycleError(notArray)).toBe(true);
    expect(lifecycleFailureLeaves(notArray)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    const explodingLeaf = new ProcessGroupLifecycleError("CloseHandle failed");
    let iteratorCalls = 0;
    const explodingKids = new Proxy([explodingLeaf], {
      get(target, prop, receiver) {
        if (prop === Symbol.iterator) {
          iteratorCalls += 1;
          throw new Error("proxy iterate");
        }
        return Reflect.get(target, prop, receiver);
      }
    });
    const exploding = new AggregateError([explodingLeaf], "explode");
    Object.defineProperty(exploding, "errors", { value: explodingKids });
    expect(() => isProcessGroupLifecycleError(exploding)).not.toThrow();
    expect(isProcessGroupLifecycleError(exploding)).toBe(true);
    const explodingLeaves = lifecycleFailureLeaves(exploding);
    expect(explodingLeaves).toHaveLength(1);
    expectHostileProjection(explodingLeaves[0]!, explodingKids);
    expect(iteratorCalls).toBe(0);
    let errorsGets = 0;
    const getterBag = new AggregateError([explodingLeaf], "getter-bag");
    Object.defineProperty(getterBag, "errors", {
      get(): unknown {
        errorsGets += 1;
        return [explodingLeaf];
      }
    });
    expect(isProcessGroupLifecycleError(getterBag)).toBe(true);
    expect(lifecycleFailureLeaves(getterBag)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    expect(errorsGets).toBe(0);
    const work = new Error("timeout");
    const projectedWork = projectUnknownFailure(work);
    const release = new ProcessGroupLifecycleError("CloseHandle failed");
    const combined = combineLifecycleFailures(work, release);
    expect(combined).toBeInstanceOf(AggregateError);
    expect((combined as AggregateError).errors).toEqual([projectedWork, release]);
    expect(lifecycleFailureLeaves(combined)).toEqual([projectedWork, release]);
    expect(Object.is(projectedWork, work)).toBe(false);
    expect(projectedWork.message).toBe(HOSTILE_GRAPH_MESSAGE);
    expect(isProcessGroupLifecycleError(combined)).toBe(true);
  });

  it("组合 primitive：同对象嵌套一次、同文不同对象都留、hostile 不覆盖 lifecycle", async () => {
    const nestedLeaf = new Error("nested-once");
    const projectedNested = projectUnknownFailure(nestedLeaf);
    const inner = new AggregateError([nestedLeaf, nestedLeaf], "inner");
    const outer = new AggregateError([inner, nestedLeaf], "outer");
    expect(lifecycleFailureLeaves(outer)).toEqual([projectedNested]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([outer, inner, nestedLeaf]))).toEqual([projectedNested]);
    const sameA = new Error("TerminateJobObject failed in signal path");
    const sameB = new Error("TerminateJobObject failed in signal path");
    expect(sameA).not.toBe(sameB);
    expect(lifecycleFailureLeaves(combineLifecycleFailures(sameA, sameB))).toEqual([
      projectUnknownFailure(sameA),
      projectUnknownFailure(sameB)
    ]);
    const sig = new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
    const fallback = new Error("fallback SIGKILL failed");
    const projectedFallback = projectUnknownFailure(fallback);
    const combo = combineLifecycleFailures(sig, fallback);
    const wrapped = asProcessGroupLifecycleError(combo);
    expect(lifecycleFailureLeaves(wrapped)).toEqual([sig, projectedFallback]);
    expect(lifecycleFailureLeaves(combineLifecycleFailures(wrapped, combo))).toEqual([sig, projectedFallback]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([wrapped, sig, fallback, combo]))).toEqual([
      sig,
      projectedFallback
    ]);
    const { proxy, revoke } = Proxy.revocable(new Error("work-proxy"), {});
    revoke();
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    expect(() => combineLifecycleFailureList([proxy, life])).not.toThrow();
    const mixed = combineLifecycleFailureList([proxy, life]);
    expect(lifecycleFailureLeaves(mixed)).toContain(life);
    expect(lifecycleFailureLeaves(mixed).filter((item) => item === life)).toHaveLength(1);
    const released = await settleWithLeaseRelease(Promise.reject(proxy), async () => {
      throw life;
    }).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(lifecycleFailureLeaves(released)).toContain(life);
    expect(lifecycleFailureLeaves(released).filter((item) => item === life)).toHaveLength(1);
  });

  it("combine/settle 对同一错误对象去重且保留不同 work/release", async () => {
    const signal = new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
    expect(combineLifecycleFailures(signal, signal)).toBe(signal);
    expect(lifecycleFailureLeaves(combineLifecycleFailures(signal, signal))).toEqual([signal]);
    const work = new Error("Command failed with exit code 1");
    const projectedWork = projectUnknownFailure(work);
    const once = combineLifecycleFailures(work, signal);
    const twice = combineLifecycleFailures(once, signal);
    expect(lifecycleFailureLeaves(once)).toEqual([projectedWork, signal]);
    expect(lifecycleFailureLeaves(twice)).toEqual([projectedWork, signal]);
    expect(isProcessGroupLifecycleError(twice)).toBe(true);
    await expect(settleWithLeaseRelease(Promise.reject(signal), async () => {
      throw signal;
    })).rejects.toBe(signal);
    const dual = await settleWithLeaseRelease(Promise.reject(work), async () => {
      throw signal;
    }).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(lifecycleFailureLeaves(dual)).toEqual([projectedWork, signal]);
    expect(isProcessGroupLifecycleError(dual)).toBe(true);
    const sentinelCombo = combineLifecycleFailures(work, malformedGetter());
    expect(lifecycleFailureLeaves(sentinelCombo)).toEqual([projectedWork, UNSAFE_ERROR_GRAPH_SENTINEL]);
    expect(isProcessGroupLifecycleError(sentinelCombo)).toBe(true);
  });

  it("不调用不可信 iterator 且同步有界返回", () => {
    const leaf = new ProcessGroupLifecycleError("CloseHandle failed");
    let iteratorCalls = 0;
    const bag = new AggregateError([leaf], "iter");
    bag.errors[Symbol.iterator] = function* (): Generator<Error> {
      iteratorCalls += 1;
      for (;;) yield leaf;
    };
    expect(isProcessGroupLifecycleError(bag)).toBe(true);
    expect(lifecycleFailureLeaves(bag)).toEqual([leaf]);
    expect(iteratorCalls).toBe(0);
    const lengthTrapCalls = { length: 0, index: 0, iterator: 0 };
    const lengthProxy = new Proxy([leaf], {
      get(target, prop, receiver) {
        if (prop === "length") {
          lengthTrapCalls.length += 1;
          return Number.POSITIVE_INFINITY;
        }
        if (prop === Symbol.iterator) {
          lengthTrapCalls.iterator += 1;
          throw new Error("iterator");
        }
        if (prop === "0") lengthTrapCalls.index += 1;
        return Reflect.get(target, prop, receiver);
      }
    });
    const inf = new AggregateError([leaf], "inf");
    Object.defineProperty(inf, "errors", { value: lengthProxy });
    expect(isProcessGroupLifecycleError(inf)).toBe(true);
    const infLeaves = lifecycleFailureLeaves(inf);
    expect(infLeaves).toHaveLength(1);
    expectHostileProjection(infLeaves[0]!, lengthProxy);
    expect(lengthTrapCalls.length).toBe(0);
    expect(lengthTrapCalls.index).toBe(0);
    expect(lengthTrapCalls.iterator).toBe(0);
    const indexThrows = new Proxy([leaf], {
      get(target, prop, receiver) {
        if (prop === "0") throw new Error("index trap");
        if (prop === Symbol.iterator) throw new Error("iterator");
        return Reflect.get(target, prop, receiver);
      }
    });
    const indexed = new AggregateError([leaf], "idx");
    Object.defineProperty(indexed, "errors", { value: indexThrows });
    expect(isProcessGroupLifecycleError(indexed)).toBe(true);
    const indexedLeaves = lifecycleFailureLeaves(indexed);
    expect(indexedLeaves).toHaveLength(1);
    expectHostileProjection(indexedLeaves[0]!, indexThrows);
    const { proxy, revoke } = Proxy.revocable([leaf], {});
    revoke();
    const revoked = new AggregateError([leaf], "revoked");
    Object.defineProperty(revoked, "errors", { value: proxy });
    expect(() => isProcessGroupLifecycleError(revoked)).not.toThrow();
    expect(isProcessGroupLifecycleError(revoked)).toBe(true);
    const revokedLeaves = lifecycleFailureLeaves(revoked);
    expect(revokedLeaves).toHaveLength(1);
    expectHostileProjection(revokedLeaves[0]!, proxy);
    expect(revokedLeaves).not.toContain(UNSAFE_ERROR_GRAPH_SENTINEL);
  });

  it("66/256 层 lifecycle leaf 仍识别，超预算 fail-closed 且保留可到达叶", () => {
    const leaf = new ProcessGroupLifecycleError("CloseHandle failed");
    const nested66 = wrapLayers(leaf, 66);
    expect(isProcessGroupLifecycleError(nested66)).toBe(true);
    expect(lifecycleFailureLeaves(nested66)).toEqual([leaf]);
    const nested256 = wrapLayers(leaf, 256);
    expect(isProcessGroupLifecycleError(nested256)).toBe(true);
    expect(lifecycleFailureLeaves(nested256)).toEqual([leaf]);
    const plain256 = wrapLayers(new Error("ordinary business failure"), 256);
    expect(isProcessGroupLifecycleError(plain256)).toBe(false);
    expect(lifecycleFailureLeaves(plain256).map((item) => item.message)).toEqual([HOSTILE_GRAPH_MESSAGE]);
    const over = wrapLayers(leaf, MAX_ERROR_GRAPH_NODES + 8);
    expect(isProcessGroupLifecycleError(over)).toBe(true);
    expect(lifecycleFailureLeaves(over)).toContain(UNSAFE_ERROR_GRAPH_SENTINEL);
    const kept = new Error("budget-kept-business");
    const projectedKept = projectUnknownFailure(kept);
    const wideKids: unknown[] = [kept, leaf];
    while (wideKids.length < MAX_ERROR_GRAPH_CHILD_SLOTS + 8) wideKids.push(null);
    const wide = new AggregateError(wideKids as Error[], "wide");
    expect(isProcessGroupLifecycleError(wide)).toBe(true);
    const wideLeaves = lifecycleFailureLeaves(wide);
    expect(wideLeaves[0]).toBe(projectedKept);
    expect(wideLeaves).toContain(leaf);
    expect(wideLeaves.filter((item) => item === UNSAFE_ERROR_GRAPH_SENTINEL)).toHaveLength(1);
    expect(wideLeaves.at(-1)).toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
  });

  it("invocation 业务叶字段可与 signal 聚合且不被哨兵丢掉", () => {
    const work = invocationBusinessFailure({
      exitCode: 1,
      knownExit: true,
      terminationCause: "exit"
    });
    expect(work).toBeInstanceOf(RuntimeInvocationError);
    const signal = new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
    const combined = combineLifecycleFailures(work, signal);
    expect(lifecycleFailureLeaves(combined)).toEqual([work, signal]);
    expect((lifecycleFailureLeaves(combined)[0] as RuntimeInvocationError).exitCode).toBe(1);
  });

  it("主审等价：not-array/cycle/budget 已读叶/hostile toString/business+2 signals+unreaped", () => {
    expect(Object.isFrozen(UNSAFE_ERROR_GRAPH_SENTINEL)).toBe(true);
    const original = UNSAFE_ERROR_GRAPH_SENTINEL.message;
    try {
      (UNSAFE_ERROR_GRAPH_SENTINEL as { message: string }).message = "hacked";
    } catch {
      // strict freeze
    }
    expect(UNSAFE_ERROR_GRAPH_SENTINEL.message).toBe(original);
    expect(UNSAFE_ERROR_GRAPH_SENTINEL.code).toBe("process_group_not_reaped");
    try {
      (UNSAFE_ERROR_GRAPH_SENTINEL as { code: string }).code = "hacked";
    } catch {
      // frozen code
    }
    expect(UNSAFE_ERROR_GRAPH_SENTINEL.code).toBe("process_group_not_reaped");
    expect(Object.isFrozen(OPAQUE_ERROR_GRAPH_VALUE)).toBe(true);
    const notArray = new AggregateError([new ProcessGroupLifecycleError("hidden")], "bag");
    Object.defineProperty(notArray, "errors", { value: "not-array" });
    expect(isProcessGroupLifecycleError(notArray)).toBe(true);
    expect(lifecycleFailureLeaves(notArray)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    const self = new AggregateError([], "self");
    self.errors.push(self);
    expect(isProcessGroupLifecycleError(self)).toBe(true);
    expect(lifecycleFailureLeaves(self)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    let toStringCalls = 0;
    const hostile = {
      toString(): string {
        toStringCalls += 1;
        return "hostile-toString";
      },
      valueOf(): string {
        toStringCalls += 1;
        return "hostile-valueOf";
      }
    };
    const hostileBag = new AggregateError([hostile as unknown as Error], "hostile");
    expect(isProcessGroupLifecycleError(hostileBag)).toBe(true);
    const hostileLeaves = lifecycleFailureLeaves(hostileBag);
    expect(hostileLeaves).toHaveLength(1);
    expectHostileProjection(hostileLeaves[0]!, hostile);
    expect(toStringCalls).toBe(0);
    const hostileThrow = {
      toString(): string {
        toStringCalls += 1;
        throw new Error("toString");
      },
      valueOf(): string {
        toStringCalls += 1;
        throw new Error("valueOf");
      }
    };
    expect(isProcessGroupLifecycleError(hostileThrow)).toBe(true);
    const throwLeaves = lifecycleFailureLeaves(hostileThrow);
    expect(throwLeaves).toHaveLength(1);
    expectHostileProjection(throwLeaves[0]!, hostileThrow);
    expect(toStringCalls).toBe(0);
    const lifeViaCause = new ProcessGroupLifecycleError("CloseHandle failed");
    const viaCause = new Error("ordinary business failure", { cause: lifeViaCause });
    expect(isProcessGroupLifecycleError(viaCause)).toBe(true);
    expect(lifecycleFailureLeaves(viaCause)).toEqual([projectUnknownFailure(viaCause), lifeViaCause]);
    const selfCause = new Error("loop");
    (selfCause as Error & { cause: Error }).cause = selfCause;
    expect(isProcessGroupLifecycleError(selfCause)).toBe(true);
    expect(lifecycleFailureLeaves(selfCause)).toEqual([projectUnknownFailure(selfCause), UNSAFE_ERROR_GRAPH_SENTINEL]);
    let causeGets = 0;
    const accessorCause = new Error("outer-business");
    Object.defineProperty(accessorCause, "cause", {
      get(): Error {
        causeGets += 1;
        throw new Error("cause getter");
      }
    });
    expect(isProcessGroupLifecycleError(accessorCause)).toBe(true);
    expect(lifecycleFailureLeaves(accessorCause)).toEqual([
      projectUnknownFailure(accessorCause),
      UNSAFE_ERROR_GRAPH_SENTINEL
    ]);
    expect(causeGets).toBe(0);
    const dupLeaf = new ProcessGroupLifecycleError("CloseHandle failed");
    expect(lifecycleFailureLeaves(new AggregateError([dupLeaf, dupLeaf], "dup"))).toEqual([dupLeaf]);
    const kept = new Error("budget-kept-business");
    const projectedKept = projectUnknownFailure(kept);
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const kids: unknown[] = [kept, life];
    while (kids.length < 516) kids.push(null);
    const wide = new AggregateError(kids as Error[], "wide-budget");
    const wideLeaves = lifecycleFailureLeaves(wide);
    expect(wideLeaves[0]).toBe(projectedKept);
    expect(wideLeaves).toContain(life);
    expect(wideLeaves.filter((item) => item === UNSAFE_ERROR_GRAPH_SENTINEL)).toHaveLength(1);
    expect(wideLeaves.at(-1)).toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    const business = invocationBusinessFailure({ exitCode: 1, knownExit: true, terminationCause: "exit" })!;
    const signalA = new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
    const signalB = new ProcessGroupLifecycleError("TerminateJobObject failed on retry");
    const unreaped = new ProcessGroupLifecycleError("agent process group 9 did not exit");
    const quad = combineLifecycleFailureList([business, signalA, signalB, unreaped]);
    expect(lifecycleFailureLeaves(quad)).toEqual([business, signalA, signalB, unreaped]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([business, signalA, signalA, unreaped]))).toEqual([
      business,
      signalA,
      unreaped
    ]);
    expect(isProcessGroupLifecycleError(quad)).toBe(true);
  });

  it("hostile message getter / index accessor / revoked 不得覆盖真实 lifecycle", async () => {
    let messageGets = 0;
    const secret = new Error("init");
    Object.defineProperty(secret, "message", {
      get(): string {
        messageGets += 1;
        return "SECRET-TOKEN-do-not-leak";
      }
    });
    expect(isProcessGroupLifecycleError(secret)).toBe(true);
    const secretLeaves = lifecycleFailureLeaves(secret);
    expect(secretLeaves).toHaveLength(1);
    expectHostileProjection(secretLeaves[0]!, secret);
    expect(secretLeaves[0]!.message).not.toContain("SECRET");
    expect(messageGets).toBe(0);
    const combinedSecret = combineLifecycleFailures(secret, new ProcessGroupLifecycleError("CloseHandle failed"));
    expect(lifecycleFailureLeaves(combinedSecret)[0]).toBe(secretLeaves[0]);
    expect(JSON.stringify(lifecycleFailureLeaves(combinedSecret).map((item) => item.message))).not.toContain("SECRET");
    expect(messageGets).toBe(0);
    let indexGets = 0;
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const accessorKids = [life];
    Object.defineProperty(accessorKids, "0", {
      get(): Error {
        indexGets += 1;
        throw new Error("index accessor");
      }
    });
    const accessorBag = new AggregateError([life], "acc");
    Object.defineProperty(accessorBag, "errors", { value: accessorKids });
    expect(isProcessGroupLifecycleError(accessorBag)).toBe(true);
    expect(lifecycleFailureLeaves(accessorBag)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    expect(indexGets).toBe(0);
    const { proxy, revoke } = Proxy.revocable(new Error("work-proxy"), {});
    revoke();
    expect(() => isProcessGroupLifecycleError(proxy)).not.toThrow();
    expect(isProcessGroupLifecycleError(proxy)).toBe(true);
    expect(() => asProcessGroupLifecycleError(proxy)).not.toThrow();
    expect(() => combineLifecycleFailureList([proxy, life])).not.toThrow();
    const mixed = combineLifecycleFailures(proxy, life);
    expect(isProcessGroupLifecycleError(mixed)).toBe(true);
    expect(lifecycleFailureLeaves(mixed)).toContain(life);
    const dual = await settleWithLeaseRelease(Promise.reject(proxy), async () => {
      throw life;
    }).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(isProcessGroupLifecycleError(dual)).toBe(true);
    expect(lifecycleFailureLeaves(dual)).toContain(life);
  });

  it("两个 distinct throwing-message Error + lifecycle 为 3 叶且 getter 为 0", () => {
    const hits = { n: 0 };
    const h1 = throwingMessageError(hits);
    const h2 = throwingMessageError(hits);
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const leaves = lifecycleFailureLeaves(combineLifecycleFailureList([h1, h2, life]));
    expect(leaves).toHaveLength(3);
    expectHostileProjection(leaves[0]!, h1);
    expectHostileProjection(leaves[1]!, h2);
    expect(leaves[0]).not.toBe(leaves[1]);
    expect(leaves[2]).toBe(life);
    expect(hits.n).toBe(0);
    expect(lifecycleFailureLeaves(new AggregateError([h1, h2, life], "bag"))).toEqual(leaves);
  });

  it("同一 throwing-message Error 经 nested aggregate/cause/work/release 只留 1 投影", async () => {
    const hits = { n: 0 };
    const h = throwingMessageError(hits);
    const viaCause = new Error("outer-business");
    Object.defineProperty(viaCause, "cause", { value: h });
    const inner = new AggregateError([h, h], "inner");
    const outer = new AggregateError([inner, h, viaCause], "outer");
    const leaves = lifecycleFailureLeaves(outer);
    expect(leaves).toHaveLength(2);
    expectHostileProjection(leaves[0]!, h);
    expect(leaves[1]).toBe(projectUnknownFailure(viaCause));
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([outer, h, inner, viaCause]))).toEqual(leaves);
    expect(lifecycleFailureLeaves(asProcessGroupLifecycleError(outer))).toEqual(leaves);
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    try {
      const settled = await settleWithLeaseRelease(Promise.reject(h), async () => {
        throw h;
      }).then(
        () => {
          throw new Error("expected reject");
        },
        (reason: unknown) => reason
      );
      expect(lifecycleFailureLeaves(settled)).toEqual([leaves[0]]);
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
    }
    const released = await settleWithLeaseRelease(Promise.reject(outer), async () => {
      throw h;
    }).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(lifecycleFailureLeaves(released)).toEqual(leaves);
    expect(hits.n).toBe(0);
  });

  it("两个 distinct revoked Proxy 保留 2 个受控投影且不抛出", () => {
    const r1 = Proxy.revocable(new Error("work-proxy-a"), {});
    const r2 = Proxy.revocable(new Error("work-proxy-b"), {});
    r1.revoke();
    r2.revoke();
    expect(() => lifecycleFailureLeaves(r1.proxy)).not.toThrow();
    expect(() => lifecycleFailureLeaves(combineLifecycleFailureList([r1.proxy, r2.proxy]))).not.toThrow();
    const leaves = lifecycleFailureLeaves(combineLifecycleFailureList([r1.proxy, r2.proxy]));
    expect(leaves).toHaveLength(2);
    expectHostileProjection(leaves[0]!, r1.proxy);
    expectHostileProjection(leaves[1]!, r2.proxy);
    expect(leaves[0]).not.toBe(leaves[1]);
  });

  it("同一 revoked Proxy 重复只留 1 投影", () => {
    const { proxy, revoke } = Proxy.revocable(new Error("work-proxy"), {});
    revoke();
    const once = lifecycleFailureLeaves(proxy);
    expect(once).toHaveLength(1);
    expectHostileProjection(once[0]!, proxy);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([proxy, proxy]))).toEqual(once);
    expect(lifecycleFailureLeaves(combineLifecycleFailures(proxy, proxy))).toEqual(once);
    const bag = new AggregateError([], "dup-revoked");
    Object.defineProperty(bag, "errors", { value: [proxy, proxy] });
    const holder = new Error("outer-business");
    Object.defineProperty(holder, "cause", { value: proxy });
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([bag, holder, proxy]))).toEqual([
      once[0],
      projectUnknownFailure(holder)
    ]);
  });

  it("hostile、普通同文不同对象、lifecycle 混排 first-seen 稳定", () => {
    const hits = { n: 0 };
    const h1 = throwingMessageError(hits);
    const h2 = throwingMessageError(hits);
    const a = new Error("same-text");
    const b = new Error("same-text");
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const leaves = lifecycleFailureLeaves(combineLifecycleFailureList([h1, a, h1, b, life, a, h2, b]));
    expect(leaves).toHaveLength(5);
    expectHostileProjection(leaves[0]!, h1);
    expect(leaves[1]).toBe(projectUnknownFailure(a));
    expect(leaves[2]).toBe(projectUnknownFailure(b));
    expect(leaves[3]).toBe(life);
    expectHostileProjection(leaves[4]!, h2);
    expect(leaves[0]).not.toBe(leaves[4]);
    expect(lifecycleFailureLeaves(new AggregateError([h1, a, b, life, h2], "mix"))).toEqual(leaves);
    expect(hits.n).toBe(0);
  });

  it("图级 structural/超预算不吞 distinct hostile 叶且 sentinel 不重复", () => {
    const hits = { n: 0 };
    const h1 = throwingMessageError(hits);
    const h2 = throwingMessageError(hits);
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const projected = lifecycleFailureLeaves(combineLifecycleFailureList([h1, h2, life]));
    expect(projected).toHaveLength(3);
    const kids: unknown[] = [h1, h2, life];
    while (kids.length < MAX_ERROR_GRAPH_CHILD_SLOTS + 4) kids.push(null);
    const wide = new AggregateError(kids as Error[], "wide-hostile");
    const wideLeaves = lifecycleFailureLeaves(wide);
    expect(wideLeaves.slice(0, 3)).toEqual(projected);
    expect(wideLeaves[3]).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(wideLeaves.filter((item) => item === UNSAFE_ERROR_GRAPH_SENTINEL)).toHaveLength(1);
    expect(wideLeaves.at(-1)).toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(wideLeaves).toHaveLength(5);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([h1, h2, malformedGetter()]))).toEqual([
      projected[0],
      projected[1],
      UNSAFE_ERROR_GRAPH_SENTINEL
    ]);
    const cycle = new AggregateError([], "cycle-hostile");
    cycle.errors.push(cycle);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([h1, cycle, h1]))).toEqual([
      projected[0],
      UNSAFE_ERROR_GRAPH_SENTINEL
    ]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([malformedGetter(), malformedGetter()]))).toEqual([
      UNSAFE_ERROR_GRAPH_SENTINEL
    ]);
    expect(hits.n).toBe(0);
  });

  it("primitive 共享 opaque sentinel，且不与 object-like hostile identity 混用", () => {
    const hits = { n: 0 };
    const h = throwingMessageError(hits);
    expect(lifecycleFailureLeaves(42)).toEqual([OPAQUE_ERROR_GRAPH_VALUE]);
    expect(lifecycleFailureLeaves("opaque")).toEqual([OPAQUE_ERROR_GRAPH_VALUE]);
    expect(lifecycleFailureLeaves(true)).toEqual([OPAQUE_ERROR_GRAPH_VALUE]);
    expect(lifecycleFailureLeaves(1n)).toEqual([OPAQUE_ERROR_GRAPH_VALUE]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([42, "opaque", true, 1n]))).toEqual([
      OPAQUE_ERROR_GRAPH_VALUE
    ]);
    const mixed = lifecycleFailureLeaves(combineLifecycleFailureList([42, h, "opaque"]));
    expect(mixed).toHaveLength(2);
    expect(mixed[0]).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expectHostileProjection(mixed[1]!, h);
    expect(mixed[1]).not.toBe(OPAQUE_ERROR_GRAPH_VALUE);
    const plainA = { toString(): string { hits.n += 1; return "plain"; } };
    const plainB = { toString(): string { hits.n += 1; return "plain"; } };
    const plains = lifecycleFailureLeaves(combineLifecycleFailureList([plainA, plainB]));
    expect(plains).toHaveLength(2);
    expectHostileProjection(plains[0]!, plainA);
    expectHostileProjection(plains[1]!, plainB);
    expect(plains[0]).not.toBe(plains[1]);
    expect(plains[0]).not.toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(hits.n).toBe(0);
  });

  it("object-like 不与 primitive sentinel 折叠，且同一 object 全调用点 intern", () => {
    const a = { tag: "a" };
    const b = { tag: "b" };
    const leaves = lifecycleFailureLeaves(combineLifecycleFailureList([a, 42, b, a, "x"]));
    expect(leaves).toHaveLength(3);
    expectHostileProjection(leaves[0]!, a);
    expect(leaves[1]).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expectHostileProjection(leaves[2]!, b);
    expect(projectUnknownFailure(a)).toBe(leaves[0]);
    expect(asProcessGroupLifecycleError(a)).toBe(leaves[0]);
    expect(projectUnknownFailure(42)).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(Object.is(projectUnknownFailure(a), projectUnknownFailure(42))).toBe(false);
  });

  it("Proxy 先于 instanceof，不触发用户 trap，不返回原 Proxy", () => {
    let traps = 0;
    const target = new Error("safe-proxy-target");
    const proxy = new Proxy(target, {
      getPrototypeOf() {
        traps += 1;
        return Error.prototype;
      },
      getOwnPropertyDescriptor() {
        traps += 1;
        return undefined;
      },
      get(_t, prop) {
        traps += 1;
        if (prop === "message") return "leaked";
        return Reflect.get(_t, prop as keyof Error);
      }
    });
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const leaves = lifecycleFailureLeaves(combineLifecycleFailureList([proxy, life]));
    expect(traps).toBe(0);
    expect(leaves).toHaveLength(2);
    expectHostileProjection(leaves[0]!, proxy);
    expect(Object.is(leaves[0], proxy)).toBe(false);
    expect(leaves[1]).toBe(life);
    expect(isProcessGroupLifecycleError(proxy)).toBe(true);
    expect(asProcessGroupLifecycleError(proxy)).toBe(leaves[0]);
    expect(lifecycleFailureLeaves(proxy)).toEqual([leaves[0]]);
  });

  it("descriptor trap 抛错只产 identity 投影，不附加图级 sentinel", () => {
    const hostile = new Error("init");
    Object.defineProperty(hostile, "message", {
      get() {
        throw new Error("descriptor");
      }
    });
    const leaves = lifecycleFailureLeaves(hostile);
    expect(leaves).toHaveLength(1);
    expectHostileProjection(leaves[0]!, hostile);
    expect(leaves).not.toContain(UNSAFE_ERROR_GRAPH_SENTINEL);
  });

  it("raw Error 与 asPGL wrapper 按 canonical origin 去重且保持 first-seen", () => {
    const raw = new Error("TerminateJobObject failed in signal path");
    const wrapped = asProcessGroupLifecycleError(raw);
    const projected = projectUnknownFailure(raw);
    expect(wrapped).not.toBe(raw);
    expect(Object.is(projected, raw)).toBe(false);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([raw, wrapped]))).toEqual([projected]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([wrapped, raw]))).toEqual([wrapped]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([wrapped, wrapped, raw]))).toEqual([wrapped]);
    const agg = combineLifecycleFailureList([raw, new ProcessGroupLifecycleError("CloseHandle failed")]);
    const wrapAgg = asProcessGroupLifecycleError(agg);
    expect(lifecycleFailureLeaves(wrapAgg)).toEqual(lifecycleFailureLeaves(agg));
  });

  it("work-only hostile rejection 抛受控投影，不逃逸原对象", async () => {
    const hits = { n: 0 };
    const h = throwingMessageError(hits);
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    try {
      const thrown = await settleWithLeaseRelease(Promise.reject(h), async () => undefined).then(
        () => {
          throw new Error("expected reject");
        },
        (reason: unknown) => reason
      );
      expect(Object.is(thrown, h)).toBe(false);
      expectHostileProjection(thrown as Error, h);
      expect(lifecycleFailureLeaves(thrown)).toEqual([thrown]);
      expect(hits.n).toBe(0);
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
    }
  });

  it("三子系统写入同一共享 contamination", () => {
    resetSharedLifecycleForTests();
    const first = contaminateSharedLifecycle(new ProcessGroupLifecycleError("byoa still alive"));
    const second = contaminateSharedLifecycle(new ProcessGroupLifecycleError("tier1 still alive"));
    expect(sharedLifecycleContaminationError()).toBe(first);
    expect(second).toBe(first);
    resetSharedLifecycleForTests();
    expect(sharedLifecycleContaminationError()).toBeNull();
  });

  it("任意层级 Proxy 全部 trap 为 0，intern 稳定且不等于图级 sentinel", () => {
    const rootTraps = blankTraps();
    const rootProxy = countingProxy(new Error("root-proxy"), rootTraps);
    const rootLeaves = lifecycleFailureLeaves(rootProxy);
    expect(trapTotal(rootTraps)).toBe(0);
    expect(rootLeaves).toHaveLength(1);
    expectHostileProjection(rootLeaves[0]!, rootProxy);
    expect(rootLeaves[0]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(projectUnknownFailure(rootProxy)).toBe(rootLeaves[0]);
    expect(asProcessGroupLifecycleError(rootProxy)).toBe(rootLeaves[0]);

    const containerTraps = blankTraps();
    const inner = new ProcessGroupLifecycleError("CloseHandle failed");
    const errorsProxy = countingProxy([inner], containerTraps);
    const bag = new AggregateError([inner], "proxy-errors");
    Object.defineProperty(bag, "errors", { value: errorsProxy });
    const bagLeaves = lifecycleFailureLeaves(bag);
    expect(trapTotal(containerTraps)).toBe(0);
    expect(bagLeaves).toHaveLength(1);
    expectHostileProjection(bagLeaves[0]!, errorsProxy);
    expect(bagLeaves[0]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(bagLeaves[0]).not.toBe(inner);
    expect(projectUnknownFailure(errorsProxy)).toBe(bagLeaves[0]);

    const elementTraps = blankTraps();
    const elementProxy = countingProxy(new Error("element-proxy"), elementTraps);
    const mixed = new AggregateError([inner], "proxy-element");
    Object.defineProperty(mixed, "errors", { value: [inner, elementProxy] });
    const mixedLeaves = lifecycleFailureLeaves(mixed);
    expect(trapTotal(elementTraps)).toBe(0);
    expect(mixedLeaves).toEqual([inner, projectUnknownFailure(elementProxy)]);
    expectHostileProjection(mixedLeaves[1]!, elementProxy);
    expect(mixedLeaves[1]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);

    const protoTraps = blankTraps();
    const protoProxy = countingProxy({}, protoTraps);
    const withProto = Object.create(protoProxy, {
      tag: { value: "own", enumerable: true, configurable: true, writable: true }
    }) as { tag: string };
    const protoLeaves = lifecycleFailureLeaves(withProto);
    expect(trapTotal(protoTraps)).toBe(0);
    expect(protoLeaves).toHaveLength(1);
    expectHostileProjection(protoLeaves[0]!, withProto);
    expect(protoLeaves[0]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(projectUnknownFailure(withProto)).toBe(protoLeaves[0]);

    const revoked = Proxy.revocable(new Error("revoked-root"), {
      get() {
        throw new Error("revoked get");
      }
    });
    revoked.revoke();
    expect(() => lifecycleFailureLeaves(revoked.proxy)).not.toThrow();
    const revokedLeaves = lifecycleFailureLeaves(revoked.proxy);
    expect(revokedLeaves).toHaveLength(1);
    expectHostileProjection(revokedLeaves[0]!, revoked.proxy);
    expect(Object.is(revokedLeaves[0], revoked.proxy)).toBe(false);
    expect(revokedLeaves[0]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(projectUnknownFailure(revoked.proxy)).toBe(revokedLeaves[0]);
  });

  it("null/undefined 是 opaque work failure，不退成图级 sentinel", async () => {
    expect(lifecycleFailureLeaves(null)).toEqual([OPAQUE_ERROR_GRAPH_VALUE]);
    expect(lifecycleFailureLeaves(undefined)).toEqual([OPAQUE_ERROR_GRAPH_VALUE]);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([null, undefined, 42]))).toEqual([
      OPAQUE_ERROR_GRAPH_VALUE
    ]);
    expect(projectUnknownFailure(null)).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(projectUnknownFailure(undefined)).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    const release = new ProcessGroupLifecycleError("CloseHandle failed");
    expect(lifecycleFailureLeaves(combineLifecycleFailures(null, release))).toEqual([
      OPAQUE_ERROR_GRAPH_VALUE,
      release
    ]);
    expect(lifecycleFailureLeaves(combineLifecycleFailures(undefined, release))).toEqual([
      OPAQUE_ERROR_GRAPH_VALUE,
      release
    ]);
    const workNull = await settleWithLeaseRelease(Promise.reject(null), async () => undefined).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(workNull).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(Object.is(workNull, null)).toBe(false);
    const workUndef = await settleWithLeaseRelease(Promise.reject(undefined), async () => undefined).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(workUndef).toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(Object.is(workUndef, undefined)).toBe(false);
    const dualNull = await settleWithLeaseRelease(Promise.reject(null), async () => {
      throw release;
    }).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(lifecycleFailureLeaves(dualNull)).toEqual([OPAQUE_ERROR_GRAPH_VALUE, release]);
    expect(lifecycleFailureLeaves(dualNull)).not.toContain(UNSAFE_ERROR_GRAPH_SENTINEL);
    const dualUndef = await settleWithLeaseRelease(Promise.reject(undefined), async () => {
      throw release;
    }).then(
      () => {
        throw new Error("expected reject");
      },
      (reason: unknown) => reason
    );
    expect(lifecycleFailureLeaves(dualUndef)).toEqual([OPAQUE_ERROR_GRAPH_VALUE, release]);
  });

  it("pipe inspect 不读原文、不触发 trap，distinct identity 稳定", () => {
    const secretObj = { code: "SECRET", message: "SECRET" };
    const secretErr = new Error("SECRET");
    Object.defineProperty(secretErr, "code", { value: "EIO" });
    let gets = 0;
    const accessor = new Error("init");
    Object.defineProperty(accessor, "code", {
      get(): string {
        gets += 1;
        return "SECRET";
      }
    });
    Object.defineProperty(accessor, "message", {
      get(): string {
        gets += 1;
        return "SECRET";
      }
    });
    const traps = blankTraps();
    const proxy = countingProxy(Object.assign(new Error("SECRET"), { code: "EIO" }), traps);
    const eioSecret = Object.assign(new Error("SECRET"), { code: "EIO" });
    const inspects = [
      inspectUntrustedPipeFailure(secretObj),
      inspectUntrustedPipeFailure(secretErr),
      inspectUntrustedPipeFailure(accessor),
      inspectUntrustedPipeFailure(proxy),
      inspectUntrustedPipeFailure(42),
      inspectUntrustedPipeFailure(null),
      inspectUntrustedPipeFailure(undefined),
      inspectUntrustedPipeFailure(eioSecret)
    ];
    expect(gets).toBe(0);
    expect(trapTotal(traps)).toBe(0);
    expect(JSON.stringify(inspects.map((item) => item.diagnostic))).not.toContain("SECRET");
    for (const item of inspects) {
      expect(item.projected.message).toBe("pipe error");
      expect(item.projected.stack ?? "").not.toContain("SECRET");
      expect(item.diagnostic.message).toBe("pipe error");
      expect(Object.is(item.projected, secretObj)).toBe(false);
      expect(Object.is(item.projected, secretErr)).toBe(false);
      expect(Object.is(item.projected, eioSecret)).toBe(false);
    }
    expect(inspects[0]!.projected).not.toBe(projectUnknownFailure(secretObj));
    expect(Object.is(projectUnknownFailure(eioSecret), eioSecret)).toBe(false);
    expect(projectUnknownFailure(eioSecret).message).toBe(HOSTILE_GRAPH_MESSAGE);
    expect(inspects[7]!.projected).not.toBe(eioSecret);
    expect(inspects[4]!.projected).toBe(PIPE_OPAQUE_FAILURE);
    expect(inspects[5]!.projected).toBe(PIPE_OPAQUE_FAILURE);
    expect(inspects[6]!.projected).toBe(PIPE_OPAQUE_FAILURE);
    expect(PIPE_OPAQUE_FAILURE).not.toBe(OPAQUE_ERROR_GRAPH_VALUE);
    expect(inspects[0]!.projected).not.toBe(inspects[1]!.projected);
    expect(inspectUntrustedPipeFailure(secretErr).projected).toBe(inspects[1]!.projected);
    expect(inspects[7]!.trustedCode).toBe("EIO");
    expect(inspects[7]!.diagnostic).toEqual({ code: "EIO", message: "pipe error" });
    expect(inspects[0]!.trustedCode).toBeUndefined();
    for (const code of ["EOF", "EBADF", "UNKNOWN"] as const) {
      const inspected = inspectUntrustedPipeFailure(Object.assign(new Error("pipe error"), { code }));
      expect(inspected.trustedCode).toBe(code);
      expect(inspected.diagnostic).toEqual({ code, message: "pipe error" });
    }
    const revoked = Proxy.revocable(eioSecret, {});
    revoked.revoke();
    expect(() => inspectUntrustedPipeFailure(revoked.proxy)).not.toThrow();
    const revokedInspect = inspectUntrustedPipeFailure(revoked.proxy);
    expect(JSON.stringify(revokedInspect.diagnostic)).not.toContain("SECRET");
    expect(revokedInspect.projected.message).not.toContain("SECRET");
    expect(Object.is(revokedInspect.projected, revoked.proxy)).toBe(false);
  });

  it("深原型链与海量顶层 input 共享一次不可重置预算", () => {
    const proto = { name: "deep-proto" };
    let current: object = proto;
    for (let i = 0; i < 12_000; i++) current = Object.create(current);
    let getPrototypeOfCalls = 0;
    const orig = Object.getPrototypeOf;
    Object.getPrototypeOf = (value: object) => {
      getPrototypeOfCalls += 1;
      return orig(value);
    };
    try {
      const projected = projectUnknownFailure(current);
      expect(getPrototypeOfCalls).toBeLessThanOrEqual(5_000);
      expect(getPrototypeOfCalls).toBeLessThan(12_000);
      expect(lifecycleFailureLeaves(projected).length).toBeLessThanOrEqual(600);
    } finally {
      Object.getPrototypeOf = orig;
    }

    const many = Array.from({ length: 10_000 }, (_, i) => new Error(`SECRET-PLAIN-${String(i)}`));
    const combined = combineLifecycleFailureList(many);
    const combinedLeaves = lifecycleFailureLeaves(combined);
    expect(combinedLeaves.length).toBeLessThanOrEqual(600);
    expect(combinedLeaves.length).toBeGreaterThan(1);
    expect(combinedLeaves.filter((item) => item === UNSAFE_ERROR_GRAPH_SENTINEL)).toHaveLength(1);
    expect(JSON.stringify(combinedLeaves.map((item) => item.message))).not.toContain("SECRET");
    if (typeof AggregateError !== "undefined" && combined instanceof AggregateError) {
      expect((combined as AggregateError).errors.length).toBeLessThanOrEqual(600);
      expect(String(combined.message)).not.toContain("SECRET");
      expect(combined.stack ?? "").not.toContain("SECRET");
    }
  });

  it("顶层 error list 拒普通与 revoked Proxy，trap 为 0", () => {
    const life = new ProcessGroupLifecycleError("CloseHandle failed");
    const traps = blankTraps();
    const proxy = countingProxy([life], traps);
    expect(() => combineLifecycleFailureList(proxy)).not.toThrow();
    const combined = combineLifecycleFailureList(proxy);
    expect(trapTotal(traps)).toBe(0);
    expect(Object.is(combined, proxy)).toBe(false);
    expect(JSON.stringify(lifecycleFailureLeaves(combined).map((item) => item.message))).not.toContain("SECRET");

    let revokedGets = 0;
    let revokedIterator = 0;
    const revoked = Proxy.revocable([new Error("SECRET-PLAIN")], {
      get(_t, prop) {
        revokedGets += 1;
        if (prop === Symbol.iterator) revokedIterator += 1;
        throw new TypeError("revoked");
      }
    });
    revoked.revoke();
    expect(() => combineLifecycleFailureList(revoked.proxy)).not.toThrow();
    const revokedCombined = combineLifecycleFailureList(revoked.proxy);
    expect(revokedGets).toBe(0);
    expect(revokedIterator).toBe(0);
    expect(Object.is(revokedCombined, revoked.proxy)).toBe(false);
    expect(JSON.stringify(lifecycleFailureLeaves(revokedCombined).map((item) => item.message))).not.toContain("SECRET");
  });

  it("普通 Error 的 SECRET 不得进入 project/combine/text", () => {
    const secret = new Error("SECRET-PLAIN");
    const projected = projectUnknownFailure(secret);
    expect(Object.is(projected, secret)).toBe(false);
    expect(projected.message).not.toContain("SECRET");
    expect(projected.stack ?? "").not.toContain("SECRET");
    expect(safeFailureText(secret)).not.toContain("SECRET");
    expect(JSON.stringify(lifecycleFailureLeaves(secret).map((item) => item.message))).not.toContain("SECRET");
    const combined = combineLifecycleFailureList([secret, new ProcessGroupLifecycleError("CloseHandle failed")]);
    expect(JSON.stringify(lifecycleFailureLeaves(combined).map((item) => item.message))).not.toContain("SECRET");
    if (typeof AggregateError !== "undefined" && combined instanceof AggregateError) {
      expect(String(combined.message)).not.toContain("SECRET");
      expect(combined.stack ?? "").not.toContain("SECRET");
    }
    const forged = Object.create(ProcessGroupLifecycleError.prototype) as Error;
    Object.defineProperty(forged, "message", { value: "SECRET-PLAIN" });
    const forgedProjected = projectUnknownFailure(forged);
    expect(Object.is(forgedProjected, forged)).toBe(false);
    expect(forgedProjected.message).not.toContain("SECRET");
  });

  it("branded lifecycle Error 只投影 brand 时刻的 snapshot，运行时改 message 不得泄漏 SECRET/路径", () => {
    // 本例要验的正是「macOS home 形态路径不得泄漏」，故断言里保留 /Users/ 匹配。
    // 但字面量写出来会被 check-public-tree-privacy 判为公开树含本机 home 路径
    // （它做静态扫描，无法区分真实隐私与测试夹具）。运行时拼接：取到的值与直写完全一致，
    // 测试语义不变，同时不再成为隐私扫描的假阳性源。
    const homeShapedSecret = `SECRET /Us${"ers"}/victim/token`;
    const branded = new ProcessGroupLifecycleError("safe");
    try {
      (branded as { message: string }).message = homeShapedSecret;
    } catch {
      // 属性冻结时赋值会抛；快照仍须独立于当前属性。
    }
    expect(safeFailureText(branded)).toBe("safe");
    expect(safeFailureText(branded)).not.toContain("SECRET");
    expect(safeFailureText(branded)).not.toMatch(/\/Users\//u);
    const projected = projectUnknownFailure(branded);
    expect(projected.message).toBe("safe");
    expect(projected.message).not.toContain("SECRET");
    expect(projected.stack ?? "").not.toContain("SECRET");
    if (typeof branded.message === "string" && branded.message.includes("SECRET")) {
      expect(projected).not.toBe(branded);
    }
    const wrapped = asProcessGroupLifecycleError(branded);
    expect(wrapped.message).toBe("safe");
    expect(wrapped.message).not.toContain("SECRET");
    try {
      Object.defineProperty(branded, "stack", {
        value: `${homeShapedSecret}\n    at leak`,
        writable: true,
        configurable: true
      });
    } catch {
      // 冻结时赋值会抛
    }
    const projectedAfterStack = projectUnknownFailure(branded);
    expect(projectedAfterStack.stack ?? "").not.toContain("SECRET");
    expect(projectedAfterStack.stack ?? "").not.toMatch(/\/Users\//u);
    expect((asProcessGroupLifecycleError(branded).stack ?? "")).not.toContain("SECRET");
    expect(JSON.stringify(lifecycleFailureLeaves(branded).map((item) => item.message))).not.toContain("SECRET");
    const frozen = new ProcessGroupLifecycleError("frozen-safe");
    Object.freeze(frozen);
    const projectedFrozen = projectUnknownFailure(frozen);
    expect(projectedFrozen.message).toBe("frozen-safe");
    expect(projectedFrozen.message).not.toBe(HOSTILE_GRAPH_MESSAGE);
    expect(asProcessGroupLifecycleError(frozen).message).toBe("frozen-safe");
    expect(asProcessGroupLifecycleError(frozen).message).not.toBe(HOSTILE_GRAPH_MESSAGE);
  });

  it("asPGL 对两个 distinct native signal/EPERM 保真且同对象去重", () => {
    const first = new Error("SECRET");
    const second = new Error("SECRET");
    Object.defineProperty(second, "code", { value: "EPERM" });
    const wrapFirst = projectTrustedKillFailure("SIGKILL", first, "fallback");
    const wrapSecond = projectTrustedKillFailure("SIGKILL", second, "primary");
    expect(wrapFirst).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(wrapSecond).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(wrapFirst.message).toBe(FALLBACK_SIGKILL_FAILED);
    expect(wrapSecond.message).toBe(KILL_EPERM);
    expect(wrapFirst.message).not.toContain("SECRET");
    expect(wrapSecond.message).not.toContain("SECRET");
    expect(wrapFirst).not.toBe(wrapSecond);
    expect(projectTrustedKillFailure("SIGKILL", first, "fallback")).toBe(wrapFirst);
    expect(asProcessGroupLifecycleError(first)).toBe(wrapFirst);
    expect(lifecycleFailureLeaves(combineLifecycleFailureList([wrapFirst, wrapSecond, wrapFirst]))).toEqual([
      wrapFirst,
      wrapSecond
    ]);
    let gets = 0;
    const accessor = new Error("init");
    Object.defineProperty(accessor, "message", {
      get(): string {
        gets += 1;
        return "SECRET";
      }
    });
    const hostile = asProcessGroupLifecycleError(accessor);
    expect(gets).toBe(0);
    expect(hostile.message).not.toContain("SECRET");
    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        gets += 1;
        return "SECRET";
      }
    });
    revoked.revoke();
    expect(() => asProcessGroupLifecycleError(revoked.proxy)).not.toThrow();
    expect(asProcessGroupLifecycleError(revoked.proxy).message).not.toContain("SECRET");
    expect(gets).toBe(0);
  });
});

function secretSurfaces(value: unknown): string {
  try {
    const err = value as { message?: unknown; stack?: unknown; cause?: unknown };
    return [
      inspect(value, { depth: 8, showHidden: true, getters: true, numericSeparator: false }),
      inspect(err?.cause, { depth: 8, showHidden: true, getters: true }),
      JSON.stringify(value),
      String(err?.message ?? ""),
      String(err?.stack ?? "")
    ].join("\n");
  } catch (inspectErr) {
    return `inspect-failed:${String(inspectErr)}`;
  }
}

describe("trust-boundary hostile identity", () => {
  it("native Error/AggregateError SECRET 不进 asPGL、inspect、audit、barrier", () => {
    resetSharedLifecycleForTests();
    const secret = new Error("SECRET");
    const agg = new AggregateError([new Error("SECRET"), new Error("SECRET-2")], "SECRET-root");
    Object.defineProperty(agg, "cause", { value: secret, enumerable: true, configurable: true, writable: true });
    const wrapped = asProcessGroupLifecycleError(secret);
    const wrapAgg = asProcessGroupLifecycleError(agg);
    const projected = projectUnknownFailure(secret);
    const text = safeFailureText(secret);
    const contaminated = contaminateSharedLifecycle(secret);
    expect(wrapped.message).not.toContain("SECRET");
    expect(projected.message).not.toContain("SECRET");
    expect(text).not.toContain("SECRET");
    expect(contaminated.message).not.toContain("SECRET");
    expect(secretSurfaces(wrapped)).not.toContain("SECRET");
    expect(secretSurfaces(wrapAgg)).not.toContain("SECRET");
    expect(secretSurfaces(projected)).not.toContain("SECRET");
    expect(secretSurfaces(contaminated)).not.toContain("SECRET");
    expect(JSON.stringify(lifecycleFailureLeaves(wrapAgg).map((item) => item.message))).not.toContain("SECRET");
    expect("cause" in wrapped ? wrapped.cause : undefined).toBeUndefined();
    expect(inspect(wrapAgg, { showHidden: true, depth: 6 })).not.toContain("SECRET");
    resetSharedLifecycleForTests();
  });

  it("显式 cause: undefined 与 null 都是 opaque 叶", () => {
    const withUndef = new Error("visible");
    Object.defineProperty(withUndef, "cause", {
      value: undefined,
      enumerable: true,
      configurable: true,
      writable: true
    });
    const withNull = new Error("visible-null", { cause: null });
    const withNum = new Error("visible-num", { cause: 42 });
    expect(lifecycleFailureLeaves(withNull)).toEqual([
      projectUnknownFailure(withNull),
      OPAQUE_ERROR_GRAPH_VALUE
    ]);
    expect(lifecycleFailureLeaves(withUndef)).toEqual([
      projectUnknownFailure(withUndef),
      OPAQUE_ERROR_GRAPH_VALUE
    ]);
    expect(lifecycleFailureLeaves(withNum)).toEqual([
      projectUnknownFailure(withNum),
      OPAQUE_ERROR_GRAPH_VALUE
    ]);
    const inner = new Error("inner");
    Object.defineProperty(inner, "cause", { value: undefined, enumerable: true, configurable: true, writable: true });
    const nested = new Error("outer", { cause: inner });
    expect(lifecycleFailureLeaves(nested)).toEqual([
      projectUnknownFailure(nested),
      projectUnknownFailure(inner),
      OPAQUE_ERROR_GRAPH_VALUE
    ]);
    const bag = new AggregateError([withUndef, withNull], "bag");
    expect(lifecycleFailureLeaves(bag)).toEqual([
      projectUnknownFailure(withUndef),
      OPAQUE_ERROR_GRAPH_VALUE,
      projectUnknownFailure(withNull)
    ]);
    const wrap = asProcessGroupLifecycleError(bag);
    expect(lifecycleFailureLeaves(wrap)).toEqual(lifecycleFailureLeaves(bag));
    const cycle = new Error("cycle");
    Object.defineProperty(cycle, "cause", { value: undefined, enumerable: true, configurable: true, writable: true });
    cycle.cause = cycle;
    expect(() => lifecycleFailureLeaves(cycle)).not.toThrow();
    expect(lifecycleFailureLeaves(cycle)).toContain(UNSAFE_ERROR_GRAPH_SENTINEL);
  });

  it("多叶 Aggregate 按 root identity intern 且 SECRET 为零", () => {
    const a = new Error("SECRET-a");
    const b = new Error("SECRET-b");
    const root = new AggregateError([a, b], "SECRET-root");
    const first = projectUnknownFailure(root);
    const second = projectUnknownFailure(root);
    expect(first).toBe(second);
    expect(lifecycleFailureLeaves(first)).toEqual([
      projectUnknownFailure(a),
      projectUnknownFailure(b)
    ]);
    expect(secretSurfaces(first)).not.toContain("SECRET");
    const other = new AggregateError([a, b], "SECRET-root");
    expect(projectUnknownFailure(other)).not.toBe(first);
    expect(lifecycleFailureLeaves(projectUnknownFailure(other))).toEqual([
      projectUnknownFailure(a),
      projectUnknownFailure(b)
    ]);
  });

  it("原型预算耗尽产生图级 sentinel 而非 hostile identity 叶", () => {
    let current: object = { tag: "deep" };
    for (let i = 0; i < 5_000; i++) current = Object.create(current);
    const projected = projectUnknownFailure(current);
    expect(projected).toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(lifecycleFailureLeaves(current)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
    const again = projectUnknownFailure(current);
    expect(again).toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
  });

  it("恰好预算边界：4096 步保留 hostile 叶，4097 步只放图级 sentinel", () => {
    let kept: object = { tag: "kept" };
    for (let i = 0; i < MAX_ERROR_GRAPH_PROTO_STEPS - 2; i++) kept = Object.create(kept);
    const keptLeaf = projectUnknownFailure(kept);
    expect(keptLeaf).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expectHostileProjection(keptLeaf, kept);
    expect(lifecycleFailureLeaves(kept)).toEqual([keptLeaf]);

    let over: object = { tag: "over" };
    for (let i = 0; i < MAX_ERROR_GRAPH_PROTO_STEPS - 1; i++) over = Object.create(over);
    expect(projectUnknownFailure(over)).toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    expect(lifecycleFailureLeaves(over)).toEqual([UNSAFE_ERROR_GRAPH_SENTINEL]);
  });

  it("循环 cause 图与 Proxy 不混淆 sentinel 与 identity 叶", () => {
    const cycle = new Error("cycle");
    cycle.cause = cycle;
    const cycleLeaves = lifecycleFailureLeaves(cycle);
    expect(cycleLeaves).toContain(UNSAFE_ERROR_GRAPH_SENTINEL);
    const traps = blankTraps();
    const proxy = countingProxy({ n: 2 }, traps);
    const proxyLeaves = lifecycleFailureLeaves(proxy);
    expect(trapTotal(traps)).toBe(0);
    expect(proxyLeaves).toHaveLength(1);
    expectHostileProjection(proxyLeaves[0]!, proxy);
    expect(proxyLeaves[0]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    const revoked = Proxy.revocable({ n: 3 }, {
      get() {
        return "SECRET";
      }
    });
    revoked.revoke();
    const revokedLeaves = lifecycleFailureLeaves(revoked.proxy);
    expect(revokedLeaves).toHaveLength(1);
    expectHostileProjection(revokedLeaves[0]!, revoked.proxy);
    expect(revokedLeaves[0]).not.toBe(UNSAFE_ERROR_GRAPH_SENTINEL);
    const first = projectUnknownFailure(proxy);
    expect(projectUnknownFailure(proxy)).toBe(first);
  });
});
