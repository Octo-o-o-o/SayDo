import { isNativeError, isProxy as nodeIsProxy } from "node:util/types";
import { isKillOwnedTreeError, readOwnErrnoCode } from "@saydo/platform";

/** 进程组未明确 ESRCH 时污染 daemon lifecycle，禁止降格为普通业务失败。 */

const processGroupLifecycleErrors = new WeakSet<object>();
const runtimeInvocationErrors = new WeakSet<object>();
/** brand 时刻的私有不可变 message；投影只读这里，不读对象上可变的当前属性。 */
const brandedLifecycleSnapshots = new WeakMap<object, string>();
const brandedLifecycleStacks = new WeakMap<object, string>();
const brandedBusinessSnapshots = new WeakMap<object, string>();
const brandedProjectedIntern = new WeakMap<object, Error>();

function freezeBrandedMessage(err: Error, message: string): void {
  const stack = `${err.name}: ${message}`;
  brandedLifecycleStacks.set(err, stack);
  try {
    Object.defineProperty(err, "message", {
      value: message,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch {
    // 快照仍是权威
  }
  try {
    Object.defineProperty(err, "stack", {
      value: stack,
      writable: false,
      configurable: false,
      enumerable: false
    });
  } catch {
    // 快照仍是权威
  }
}

export class ProcessGroupLifecycleError extends Error {
  readonly code = "process_group_not_reaped" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProcessGroupLifecycleError";
    processGroupLifecycleErrors.add(this);
    brandedLifecycleSnapshots.set(this, message);
    freezeBrandedMessage(this, message);
  }
}

/** 覆盖正常深层(至少 256 层)的全局预算；一次 walk/combine 共享、不可重置。 */
export const MAX_ERROR_GRAPH_NODES = 512;
export const MAX_ERROR_GRAPH_CHILD_SLOTS = 512;
/** 单对象深链在此截断；总值仍有界，供 256 层 Aggregate 的短原型走访。 */
export const MAX_ERROR_GRAPH_PROTO_STEPS = 4096;

class GraphBudget {
  nodes = 0;
  childSlots = 0;
  protoSteps = 0;
  topLevel = 0;
  nodeExhausted = false;
  childExhausted = false;
  protoExhausted = false;
  topExhausted = false;

  get exhausted(): boolean {
    return this.nodeExhausted || this.childExhausted || this.protoExhausted || this.topExhausted;
  }

  consumeNode(): boolean {
    if (this.nodeExhausted) return false;
    this.nodes += 1;
    if (this.nodes > MAX_ERROR_GRAPH_NODES) {
      this.nodeExhausted = true;
      return false;
    }
    return true;
  }

  consumeChildSlot(): boolean {
    if (this.childExhausted || this.nodeExhausted) return false;
    this.childSlots += 1;
    if (this.childSlots > MAX_ERROR_GRAPH_CHILD_SLOTS) {
      this.childExhausted = true;
      return false;
    }
    return true;
  }

  consumeProto(): boolean {
    if (this.protoExhausted) return false;
    this.protoSteps += 1;
    if (this.protoSteps > MAX_ERROR_GRAPH_PROTO_STEPS) {
      this.protoExhausted = true;
      return false;
    }
    return true;
  }

  consumeTopLevel(): boolean {
    if (this.topExhausted) return false;
    this.topLevel += 1;
    if (this.topLevel > MAX_ERROR_GRAPH_NODES) {
      this.topExhausted = true;
      return false;
    }
    return true;
  }

  markLeafCap(): void {
    this.nodeExhausted = true;
  }
}

function freezeLifecycleConstant(err: ProcessGroupLifecycleError): ProcessGroupLifecycleError {
  const stack = `${err.name}: ${err.message}`;
  Object.defineProperties(err, {
    message: { value: err.message, writable: false, configurable: false, enumerable: true },
    name: { value: err.name, writable: false, configurable: false, enumerable: false },
    code: { value: err.code, writable: false, configurable: false, enumerable: true },
    stack: { value: stack, writable: false, configurable: false, enumerable: false }
  });
  return Object.freeze(err);
}

export const UNSAFE_ERROR_GRAPH_SENTINEL = freezeLifecycleConstant(
  new ProcessGroupLifecycleError("process group error graph not safely enumerable")
);

/** 仅 primitive unknown 共用的不可变叶；object/function 不得折叠到这里。 */
export const OPAQUE_ERROR_GRAPH_VALUE = freezeLifecycleConstant(
  new ProcessGroupLifecycleError("process group error graph contained an opaque value")
);

export class RuntimeInvocationError extends Error {
  readonly exitCode: number;
  readonly terminationCause?: "exit" | "pipe_failed";
  readonly timedOut?: boolean;
  readonly pipeFailure?: boolean;
  readonly pipeStream?: "stdout" | "stderr" | "stdin";
  readonly pipeCode?: string;

  constructor(
    message: string,
    fields: {
      exitCode: number;
      terminationCause?: "exit" | "pipe_failed";
      timedOut?: boolean;
      pipeFailure?: boolean;
      pipeStream?: "stdout" | "stderr" | "stdin";
      pipeCode?: string;
    }
  ) {
    super(message);
    this.name = "RuntimeInvocationError";
    runtimeInvocationErrors.add(this);
    brandedBusinessSnapshots.set(this, message);
    freezeBrandedMessage(this, message);
    this.exitCode = fields.exitCode;
    if (fields.terminationCause) this.terminationCause = fields.terminationCause;
    if (fields.timedOut) this.timedOut = true;
    if (fields.pipeFailure) this.pipeFailure = true;
    if (fields.pipeStream) this.pipeStream = fields.pipeStream;
    if (fields.pipeCode) this.pipeCode = fields.pipeCode;
  }
}

export function invocationBusinessFailure(fields: {
  exitCode: number;
  terminationCause?: "exit" | "pipe_failed";
  timedOut?: boolean;
  pipeFailure?: boolean;
  pipeStream?: "stdout" | "stderr" | "stdin";
  pipeCode?: string;
  knownExit?: boolean;
}): RuntimeInvocationError | undefined {
  const pipe = fields.pipeFailure === true || fields.terminationCause === "pipe_failed";
  const failedExit = fields.knownExit === true && fields.exitCode !== 0;
  if (!fields.timedOut && !pipe && !failedExit) return undefined;
  const message = fields.timedOut
    ? "Command timed out"
    : pipe
      ? `${fields.pipeStream ?? "stdio"} pipe failed:${fields.pipeCode ?? "unknown"}`
      : `Command failed with exit code ${String(fields.exitCode)}`;
  return new RuntimeInvocationError(message, {
    exitCode: pipe || fields.timedOut ? (fields.exitCode === 0 ? 1 : fields.exitCode) : fields.exitCode,
    ...(fields.terminationCause ? { terminationCause: fields.terminationCause } : pipe ? { terminationCause: "pipe_failed" as const } : { terminationCause: "exit" as const }),
    ...(fields.timedOut ? { timedOut: true } : {}),
    ...(pipe ? { pipeFailure: true } : {}),
    ...(fields.pipeStream ? { pipeStream: fields.pipeStream } : {}),
    ...(fields.pipeCode ? { pipeCode: fields.pipeCode } : {})
  });
}

interface ErrorGraphWalk {
  leaves: Error[];
  sawLifecycle: boolean;
  unsafe: boolean;
}

function isObjectLike(value: unknown): value is object {
  return value != null && (typeof value === "object" || typeof value === "function");
}

function isProxyValue(value: unknown): boolean {
  try {
    return nodeIsProxy(value);
  } catch {
    return false;
  }
}

type ProtoInspect = "ok" | "match" | "proxy" | "budget" | "cycle" | "trap";

/** 在 getPrototypeOf 之前先 isProxy；预算耗尽 / cycle / trap 与 hostile Proxy 可区分。 */
function inspectProtoChain(obj: object, budget: GraphBudget, match?: object): ProtoInspect {
  let current: object | null = obj;
  const seen = new Set<object>();
  while (isObjectLike(current)) {
    if (!budget.consumeProto()) return "budget";
    if (isProxyValue(current)) return "proxy";
    if (match !== undefined && current === match) return "match";
    if (seen.has(current)) return "cycle";
    seen.add(current);
    try {
      current = Object.getPrototypeOf(current);
    } catch {
      return "trap";
    }
  }
  return "ok";
}

function protoExists(obj: object, proto: object, budget: GraphBudget): boolean {
  return inspectProtoChain(obj, budget, proto) === "match";
}

function protoChainInspect(obj: object, budget: GraphBudget): ProtoInspect {
  return inspectProtoChain(obj, budget);
}

function nativeErrorBrand(value: unknown): value is Error {
  if (!isObjectLike(value) || isProxyValue(value)) return false;
  try {
    return isNativeError(value);
  } catch {
    return false;
  }
}

/** 不走 instanceof：先 isProxy，再沿原型链比对 ctor.prototype。 */
function safeInstanceof<T>(value: unknown, ctor: new (...args: never[]) => T, budget: GraphBudget): value is T {
  if (!isObjectLike(value) || isProxyValue(value)) return false;
  return protoExists(value, ctor.prototype, budget);
}

/** 不可信 unknown 的 trap-free ctor 判别；Proxy / 原型链含 Proxy 恒为 false。 */
export function isUntrustedInstance<T>(value: unknown, ctor: new (...args: never[]) => T): value is T {
  return safeInstanceof(value, ctor, new GraphBudget());
}

/** object/function 的受控投影；按原对象 identity intern。primitive 不得进入。 */
const hostileLeafIntern = new WeakMap<object, ProcessGroupLifecycleError>();
const nativeLeafIntern = new WeakMap<object, Error>();
const internedNativeLeaves = new WeakSet<object>();
/** 多叶 Aggregate 按 root identity intern 的 canonical 容器。 */
const projectedAggregateIntern = new WeakMap<object, Error>();
/** 可信 kill catch-site 投影 intern。 */
const trustedKillIntern = new WeakMap<object, ProcessGroupLifecycleError>();
/** wrapper → canonical origin；不得读不可信 .cause。 */
const wrapOrigin = new WeakMap<object, object>();

const HOSTILE_VALUE_MESSAGE = "process group error graph contained a hostile value";
export const FALLBACK_SIGKILL_FAILED = "fallback SIGKILL failed";
export const KILL_EPERM = "kill EPERM";
export type TrustedKillRole = "primary" | "fallback";

function internHostileLeaf(origin: object): ProcessGroupLifecycleError {
  const existing = hostileLeafIntern.get(origin);
  if (existing) return existing;
  if (origin === UNSAFE_ERROR_GRAPH_SENTINEL || origin === OPAQUE_ERROR_GRAPH_VALUE) {
    return origin as ProcessGroupLifecycleError;
  }
  if (processGroupLifecycleErrors.has(origin)) {
    return retainBrandedLeaf(origin) as ProcessGroupLifecycleError;
  }
  const projected = freezeLifecycleConstant(
    new ProcessGroupLifecycleError(HOSTILE_VALUE_MESSAGE)
  );
  hostileLeafIntern.set(origin, projected);
  wrapOrigin.set(projected, origin);
  return projected;
}

function freezeInternedNative(err: Error): Error {
  Object.defineProperties(err, {
    message: { value: err.message, writable: false, configurable: false, enumerable: true },
    name: { value: err.name, writable: false, configurable: false, enumerable: false },
    stack: { value: `${err.name}: ${err.message}`, writable: false, configurable: false, enumerable: false }
  });
  internedNativeLeaves.add(err);
  return Object.freeze(err);
}

function internNativeFailure(origin: object): Error {
  const existing = nativeLeafIntern.get(origin);
  if (existing) return existing;
  if (internedNativeLeaves.has(origin)) return origin as Error;
  const projected = freezeInternedNative(new Error(HOSTILE_VALUE_MESSAGE));
  nativeLeafIntern.set(origin, projected);
  wrapOrigin.set(projected, origin);
  return projected;
}

function internProjectedAggregate(origin: object, agg: Error, leaves: Error[]): Error {
  const existing = projectedAggregateIntern.get(origin);
  if (existing) return existing;
  try {
    Object.defineProperty(agg, "errors", {
      value: Object.freeze([...leaves]),
      writable: false,
      configurable: false,
      enumerable: false
    });
  } catch {
    // 冻结失败仍 intern 受控容器。
  }
  projectedAggregateIntern.set(origin, agg);
  projectedAggregateIntern.set(agg, agg);
  return agg;
}

function trustedKillMessage(signal: string, errno: string | undefined, role: TrustedKillRole): string {
  if (errno === "EPERM") return KILL_EPERM;
  if (signal === "SIGKILL") return FALLBACK_SIGKILL_FAILED;
  return role === "fallback" ? FALLBACK_SIGKILL_FAILED : HOSTILE_VALUE_MESSAGE;
}

/**
 * 可信 catch-site：已知 signal/operation，trap-free 识别 errno 后赋受控常量。
 * 不得依据不可信 Error message 判断可信。
 */
export function projectTrustedKillFailure(
  signal: string,
  err: unknown,
  role: TrustedKillRole = "primary"
): ProcessGroupLifecycleError {
  try {
    if (isObjectLike(err) && isBrandedLifecycleLeaf(err) && isSafeRetainedLeaf(err)) {
      return err as ProcessGroupLifecycleError;
    }
    if (isObjectLike(err)) {
      const interned = trustedKillIntern.get(err);
      if (interned) return interned;
    }
    const errno = isObjectLike(err) && !isProxyValue(err) && protoChainInspect(err, new GraphBudget()) === "ok"
      ? readOwnErrnoCode(err)
      : undefined;
    const branded = freezeLifecycleConstant(
      new ProcessGroupLifecycleError(trustedKillMessage(signal, errno, role))
    );
    if (isObjectLike(err)) {
      trustedKillIntern.set(err, branded);
      wrapOrigin.set(branded, err);
    }
    return branded;
  } catch {
    return UNSAFE_ERROR_GRAPH_SENTINEL;
  }
}

function isBrandedLifecycleLeaf(leaf: object): boolean {
  return processGroupLifecycleErrors.has(leaf);
}

function isBrandedBusinessLeaf(leaf: object): boolean {
  return runtimeInvocationErrors.has(leaf);
}

function canonicalOrigin(obj: object): object {
  return wrapOrigin.get(obj) ?? obj;
}

/** 只读 own 数据描述符；Proxy / accessor / 撤销不调用 getter 或 trap。 */
function readOwnData(obj: object, key: PropertyKey): { ok: true; present: boolean; value: unknown } | { ok: false } {
  if (isProxyValue(obj)) return { ok: false };
  try {
    const own = Object.getOwnPropertyDescriptor(obj, key);
    if (!own) return { ok: true, present: false, value: undefined };
    if (own.get !== undefined || own.set !== undefined) return { ok: false };
    return { ok: true, present: true, value: own.value };
  } catch {
    return { ok: false };
  }
}

function readOwnString(obj: object, key: string): string | undefined {
  const read = readOwnData(obj, key);
  if (!read.ok || !read.present || typeof read.value !== "string") return undefined;
  return read.value;
}

/** 不可信 unknown 的 own 字符串；Proxy / primitive / accessor 恒为 undefined。 */
export function readUntrustedOwnString(err: unknown, key: string): string | undefined {
  if (!isObjectLike(err) || isProxyValue(err)) return undefined;
  return readOwnString(err, key);
}

function isLifecycleMessage(message: string): boolean {
  return /process group .+ (did not exit|state unknown)/u.test(message) ||
    message.includes("process_group_not_reaped") ||
    message.includes("owned process group still alive") ||
    message.includes("close withheld");
}

function brandedSnapshotMessage(leaf: object): string | undefined {
  if (isBrandedLifecycleLeaf(leaf)) return brandedLifecycleSnapshots.get(leaf);
  if (isBrandedBusinessLeaf(leaf)) return brandedBusinessSnapshots.get(leaf);
  return undefined;
}

function safeLeafMessage(leaf: Error): string {
  if (!isObjectLike(leaf) || isProxyValue(leaf)) return "process group error";
  const snapshot = brandedSnapshotMessage(leaf);
  if (snapshot !== undefined) return snapshot.slice(0, 300);
  if (isBrandedLifecycleLeaf(leaf) || isBrandedBusinessLeaf(leaf)) return "process group error";
  const message = readOwnString(leaf, "message");
  return message !== undefined ? message.slice(0, 300) : "process group error";
}

function isSafeRetainedLeaf(leaf: object): boolean {
  if (leaf === UNSAFE_ERROR_GRAPH_SENTINEL || leaf === OPAQUE_ERROR_GRAPH_VALUE) return true;
  if (internedNativeLeaves.has(leaf)) return true;
  if (isProxyValue(leaf)) return false;
  // brand 即保留资格；冻结 message/stack 不得把 branded 叶打成 hostile。
  if (isBrandedLifecycleLeaf(leaf) || isBrandedBusinessLeaf(leaf)) return true;
  return false;
}

function retainBrandedLeaf(origin: object): Error {
  const snap = brandedSnapshotMessage(origin) ?? "process group error";
  const current = isObjectLike(origin) ? readOwnString(origin, "message") : undefined;
  const stack = isObjectLike(origin) ? readOwnString(origin, "stack") : undefined;
  const snapStack = brandedLifecycleStacks.get(origin);
  if (current === snap && (stack === undefined || snapStack === undefined || stack === snapStack)) {
    return origin as Error;
  }
  const existing = brandedProjectedIntern.get(origin);
  if (existing) return existing;
  const projected = freezeLifecycleConstant(new ProcessGroupLifecycleError(snap));
  brandedProjectedIntern.set(origin, projected);
  brandedProjectedIntern.set(projected, projected);
  wrapOrigin.set(projected, origin);
  return projected;
}

function projectNode(node: unknown, budget: GraphBudget): Error {
  if (node === UNSAFE_ERROR_GRAPH_SENTINEL || node === OPAQUE_ERROR_GRAPH_VALUE) {
    return node as ProcessGroupLifecycleError;
  }
  if (!isObjectLike(node)) return OPAQUE_ERROR_GRAPH_VALUE;
  if (internedNativeLeaves.has(node)) return node as Error;
  if (isSafeRetainedLeaf(node) && (isBrandedLifecycleLeaf(node) || isBrandedBusinessLeaf(node))) {
    return retainBrandedLeaf(node);
  }
  if (isSafeRetainedLeaf(node)) return node as Error;
  if (isKillOwnedTreeError(node)) return asProcessGroupLifecycleError(node);
  if (isProxyValue(node)) return internHostileLeaf(node);
  const proto = protoChainInspect(node, budget);
  if (proto === "proxy") return internHostileLeaf(node);
  if (proto === "budget" || proto === "cycle" || proto === "trap") return UNSAFE_ERROR_GRAPH_SENTINEL;
  const internedNative = nativeLeafIntern.get(node);
  if (internedNative) return internedNative;
  const internedAgg = projectedAggregateIntern.get(node);
  if (internedAgg) return internedAgg;
  if (nativeErrorBrand(node)) {
    if (typeof AggregateError !== "undefined" && safeInstanceof(node, AggregateError, budget)) {
      const errorsRead = readOwnData(node, "errors");
      const nested = errorsRead.ok && errorsRead.present ? errorsRead.value : undefined;
      let isArray = false;
      try {
        isArray = isObjectLike(nested) && Array.isArray(nested);
      } catch {
        isArray = false;
      }
      const length = isArray && isObjectLike(nested) ? readOwnArrayLength(nested) : undefined;
      if (!errorsRead.ok || !errorsRead.present || length === undefined || length === 0) {
        const message = readOwnData(node, "message");
        if (message.ok && message.present && typeof message.value === "string") {
          return internNativeFailure(node);
        }
        return internHostileLeaf(node);
      }
      const walked = walkErrorGraph(node, budget);
      const leaves = capCombinedLeaves(walked.leaves, budget.exhausted || walked.unsafe);
      const projected = aggregateFromLeaves(leaves.length === 0 ? [internNativeFailure(node)] : leaves);
      if (leaves.length > 1 && isObjectLike(projected)) {
        return internProjectedAggregate(node, projected, leaves);
      }
      return projected;
    }
    const message = readOwnData(node, "message");
    if (message.ok && message.present && typeof message.value === "string") {
      return internNativeFailure(node);
    }
    return internHostileLeaf(node);
  }
  const internedHostile = hostileLeafIntern.get(node);
  if (internedHostile) return internedHostile;
  return internHostileLeaf(node);
}

/** 任何 unknown rejection 的稳定受控投影；primitive 共享 opaque，object 按 identity intern。 */
export function projectUnknownFailure(err: unknown, budget = new GraphBudget()): Error {
  return projectNode(err, budget);
}

export function safeFailureText(err: unknown, max = 200): string {
  try {
    return safeLeafMessage(projectUnknownFailure(err)).slice(0, max);
  } catch {
    return "process group error";
  }
}

function rememberOrigin(seenOrigins: Set<object>, node: object): boolean {
  const origin = canonicalOrigin(node);
  if (seenOrigins.has(origin)) return false;
  seenOrigins.add(origin);
  return true;
}

function pushLeaf(
  state: ErrorGraphWalk,
  source: unknown,
  seenLeaves: Set<Error>,
  seenOrigins: Set<object>,
  budget: GraphBudget
): void {
  if (!isObjectLike(source)) {
    if (seenLeaves.has(OPAQUE_ERROR_GRAPH_VALUE)) return;
    if (state.leaves.length >= MAX_ERROR_GRAPH_NODES) {
      markUnsafe(state);
      budget.markLeafCap();
      return;
    }
    seenLeaves.add(OPAQUE_ERROR_GRAPH_VALUE);
    state.leaves.push(OPAQUE_ERROR_GRAPH_VALUE);
    state.sawLifecycle = true;
    return;
  }
  if (!rememberOrigin(seenOrigins, source)) return;
  const projected = projectNode(source, budget);
  if (isObjectLike(projected)) rememberOrigin(seenOrigins, projected);
  if (seenLeaves.has(projected)) return;
  if (projected !== UNSAFE_ERROR_GRAPH_SENTINEL && state.leaves.length >= MAX_ERROR_GRAPH_NODES) {
    markUnsafe(state);
    budget.markLeafCap();
    return;
  }
  seenLeaves.add(projected);
  state.leaves.push(projected);
  if (isObjectLike(projected) && isBrandedLifecycleLeaf(projected)) {
    state.sawLifecycle = true;
  } else if (isLifecycleMessage(safeLeafMessage(projected))) {
    state.sawLifecycle = true;
  }
}

function markUnsafe(state: ErrorGraphWalk): void {
  state.unsafe = true;
  state.sawLifecycle = true;
}

function readOwnArrayLength(arr: object): number | undefined {
  const read = readOwnData(arr, "length");
  if (!read.ok || !read.present) return undefined;
  const len = read.value;
  if (typeof len !== "number" || !Number.isFinite(len) || !Number.isInteger(len) || len < 0) return undefined;
  return len;
}

type ErrorGraphFrame =
  | { kind: "enter"; node: unknown }
  | { kind: "leave"; node: object };

const lifecycleWrapIntern = new WeakMap<object, ProcessGroupLifecycleError>();
/** asPGL(AggregateError) 的容器 wrap：walker 不投影它，只展开 origin。 */
const transparentLifecycleWraps = new WeakSet<object>();

/** 栈安全、Proxy 先于 instanceof；图级 sentinel 只用于遍历截断。 */
function walkErrorGraph(root: unknown, budget = new GraphBudget()): ErrorGraphWalk {
  const state: ErrorGraphWalk = { leaves: [], sawLifecycle: false, unsafe: false };
  const seen = new Set<object>();
  const path = new Set<object>();
  const seenLeaves = new Set<Error>();
  const seenOrigins = new Set<object>();
  const stack: ErrorGraphFrame[] = [{ kind: "enter", node: root }];
  let expand = true;
  let sawCycle = false;
  const stopExpand = (): void => {
    expand = false;
    markUnsafe(state);
  };
  const enqueue = (node: unknown): void => {
    stack.push({ kind: "enter", node });
  };
  const emit = (source: unknown): void => {
    pushLeaf(state, source, seenLeaves, seenOrigins, budget);
  };
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.kind === "leave") {
      path.delete(frame.node);
      continue;
    }
    const current = frame.node;
    if (!isObjectLike(current)) {
      emit(current);
      continue;
    }
    const obj = current;
    if (path.has(obj)) {
      sawCycle = true;
      continue;
    }
    if (seen.has(obj)) continue;
    seen.add(obj);
    path.add(obj);
    stack.push({ kind: "leave", node: obj });
    if (!budget.consumeNode()) stopExpand();
    try {
      if (isProxyValue(obj)) {
        emit(obj);
        continue;
      }
      if (transparentLifecycleWraps.has(obj)) {
        state.sawLifecycle = true;
        if (!expand) continue;
        const origin = wrapOrigin.get(obj);
        if (origin !== undefined) {
          enqueue(origin);
          continue;
        }
        const wrapCause = readOwnData(obj, "cause");
        if (!wrapCause.ok) {
          stopExpand();
          continue;
        }
        if (wrapCause.present) enqueue(wrapCause.value);
        continue;
      }
      const origin = wrapOrigin.get(obj);
      if (origin !== undefined) {
        emit(obj);
        continue;
      }
      if (!nativeErrorBrand(obj)) {
        emit(obj);
        continue;
      }
      const errObj = obj as Error;
      const isAgg = typeof AggregateError !== "undefined" && safeInstanceof(obj, AggregateError, budget);
      if (!isAgg) emit(errObj);
      if (!expand) continue;
      const cause = readOwnData(obj, "cause");
      if (!cause.ok) stopExpand();
      const enqueueCause = (): void => {
        if (cause.ok && cause.present) enqueue(cause.value);
      };
      if (!isAgg) {
        enqueueCause();
        continue;
      }
      const errorsRead = readOwnData(obj, "errors");
      if (!errorsRead.ok || !errorsRead.present) {
        stopExpand();
        enqueueCause();
        continue;
      }
      const nested = errorsRead.value;
      if (isObjectLike(nested) && isProxyValue(nested)) {
        emit(nested);
        enqueueCause();
        continue;
      }
      let isArray = false;
      try {
        isArray = Array.isArray(nested);
      } catch {
        isArray = false;
      }
      if (!isArray || !isObjectLike(nested)) {
        stopExpand();
        enqueueCause();
        continue;
      }
      const length = readOwnArrayLength(nested);
      if (length === undefined) {
        stopExpand();
        enqueueCause();
        continue;
      }
      if (length === 0) {
        emit(obj);
        enqueueCause();
        continue;
      }
      const children: unknown[] = [];
      for (let i = 0; i < length; i++) {
        if (!budget.consumeChildSlot()) {
          stopExpand();
          break;
        }
        const read = readOwnData(nested, String(i));
        if (!read.ok || !read.present) {
          stopExpand();
          break;
        }
        children.push(read.value);
      }
      if (children.length < length) stopExpand();
      enqueueCause();
      for (let i = children.length - 1; i >= 0; i--) enqueue(children[i]);
    } catch {
      stopExpand();
    }
  }
  if (sawCycle || state.unsafe || state.leaves.length === 0 || budget.exhausted) {
    markUnsafe(state);
    emit(UNSAFE_ERROR_GRAPH_SENTINEL);
  }
  return state;
}

export function isProcessGroupLifecycleError(err: unknown): boolean {
  try {
    return walkErrorGraph(err).sawLifecycle;
  } catch {
    return true;
  }
}

/** cycle-safe、identity-safe: 同一错误对象只出现一次；畸形/超预算带稳定哨兵叶。 */
export function lifecycleFailureLeaves(err: unknown): Error[] {
  try {
    return walkErrorGraph(err).leaves;
  } catch {
    return [UNSAFE_ERROR_GRAPH_SENTINEL];
  }
}

export function asProcessGroupLifecycleError(err: unknown): ProcessGroupLifecycleError {
  const budget = new GraphBudget();
  try {
    if (isObjectLike(err) && isBrandedLifecycleLeaf(err)) {
      return retainBrandedLeaf(err) as ProcessGroupLifecycleError;
    }
    if (isObjectLike(err) && isProxyValue(err)) return internHostileLeaf(err);
    if (!isObjectLike(err)) return OPAQUE_ERROR_GRAPH_VALUE;
    const internedHostile = hostileLeafIntern.get(err);
    if (internedHostile) return internedHostile;
    const proto = protoChainInspect(err, budget);
    if (proto === "proxy") return internHostileLeaf(err);
    if (proto === "budget" || proto === "cycle" || proto === "trap") return UNSAFE_ERROR_GRAPH_SENTINEL;
    const interned = lifecycleWrapIntern.get(err);
    if (interned) return interned;
    if (
      nativeErrorBrand(err) &&
      typeof AggregateError !== "undefined" &&
      safeInstanceof(err, AggregateError, budget)
    ) {
      const wrapped = freezeLifecycleConstant(
        new ProcessGroupLifecycleError("process group error graph aggregated")
      );
      transparentLifecycleWraps.add(wrapped);
      wrapOrigin.set(wrapped, err);
      lifecycleWrapIntern.set(err, wrapped);
      return wrapped;
    }
    if (isBrandedBusinessLeaf(err)) {
      const wrapped = freezeLifecycleConstant(
        new ProcessGroupLifecycleError(safeLeafMessage(err as Error))
      );
      wrapOrigin.set(wrapped, err);
      lifecycleWrapIntern.set(err, wrapped);
      return wrapped;
    }
    if (isKillOwnedTreeError(err)) {
      const msg = readOwnString(err, "message");
      const wrapped = freezeLifecycleConstant(
        new ProcessGroupLifecycleError(msg && msg.length > 0 ? msg : "killOwnedTree failed")
      );
      wrapOrigin.set(wrapped, err);
      lifecycleWrapIntern.set(err, wrapped);
      return wrapped;
    }
    if (nativeErrorBrand(err)) {
      const trusted = trustedKillIntern.get(err);
      if (trusted) return trusted;
      return internHostileLeaf(err);
    }
    return internHostileLeaf(err);
  } catch {
    return UNSAFE_ERROR_GRAPH_SENTINEL;
  }
}

/** runtime child / BYOA / Tier1 共用的 ownership barrier；任一子系统写入后禁止新 spawn。 */
let sharedLifecycleContamination: ProcessGroupLifecycleError | null = null;

export function sharedLifecycleContaminationError(): ProcessGroupLifecycleError | null {
  return sharedLifecycleContamination;
}

export function contaminateSharedLifecycle(err: unknown): ProcessGroupLifecycleError {
  sharedLifecycleContamination ??= asProcessGroupLifecycleError(err);
  return sharedLifecycleContamination;
}

export function resetSharedLifecycleForTests(): void {
  sharedLifecycleContamination = null;
}

function capCombinedLeaves(leaves: Error[], exhausted: boolean): Error[] {
  const without = leaves.filter((leaf) => leaf !== UNSAFE_ERROR_GRAPH_SENTINEL);
  const capped = without.slice(0, MAX_ERROR_GRAPH_NODES);
  if (exhausted || leaves.includes(UNSAFE_ERROR_GRAPH_SENTINEL) || without.length > MAX_ERROR_GRAPH_NODES) {
    if (!capped.includes(UNSAFE_ERROR_GRAPH_SENTINEL)) capped.push(UNSAFE_ERROR_GRAPH_SENTINEL);
  }
  return capped;
}

function mergeWalkedLeaves(errors: unknown[], budget: GraphBudget): Error[] {
  const leaves: Error[] = [];
  const seenLeaves = new Set<Error>();
  const seenOrigins = new Set<object>();
  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    let walked: ErrorGraphWalk;
    try {
      walked = walkErrorGraph(err, budget);
    } catch {
      walked = { leaves: [UNSAFE_ERROR_GRAPH_SENTINEL], sawLifecycle: true, unsafe: true };
      budget.markLeafCap();
    }
    for (let j = 0; j < walked.leaves.length; j++) {
      const leaf = walked.leaves[j]!;
      if (isObjectLike(leaf) && !rememberOrigin(seenOrigins, leaf)) continue;
      if (seenLeaves.has(leaf)) continue;
      seenLeaves.add(leaf);
      leaves.push(leaf);
    }
    if (budget.exhausted) break;
  }
  return capCombinedLeaves(leaves, budget.exhausted);
}

function combinableError(err: unknown): Error {
  return projectUnknownFailure(err);
}

function aggregateFromLeaves(leaves: Error[]): Error {
  if (leaves.length === 0) return OPAQUE_ERROR_GRAPH_VALUE;
  if (leaves.length === 1) return leaves[0]!;
  const message = leaves.map((leaf) => safeLeafMessage(leaf)).join("; ");
  const agg = new AggregateError(leaves, message);
  try {
    Object.defineProperties(agg, {
      message: { value: message, writable: false, configurable: false, enumerable: false },
      stack: { value: `AggregateError: ${message}`, writable: false, configurable: false, enumerable: false }
    });
  } catch {
    // 冻结失败仍返回受控 message 的 AggregateError。
  }
  return agg;
}

function readTrustedTopLevelItems(errors: unknown, budget: GraphBudget): { items: unknown[]; unsafe: boolean } {
  if (isProxyValue(errors)) {
    return { items: [errors], unsafe: false };
  }
  if (!isObjectLike(errors)) {
    return { items: [errors], unsafe: false };
  }
  let isArray = false;
  try {
    isArray = Array.isArray(errors);
  } catch {
    return { items: [errors], unsafe: true };
  }
  if (!isArray) {
    return { items: [errors], unsafe: false };
  }
  const length = readOwnArrayLength(errors);
  if (length === undefined) {
    return { items: [], unsafe: true };
  }
  const items: unknown[] = [];
  let unsafe = false;
  for (let i = 0; i < length; i++) {
    if (!budget.consumeTopLevel() || !budget.consumeChildSlot()) {
      unsafe = true;
      break;
    }
    const read = readOwnData(errors, String(i));
    if (!read.ok || !read.present) {
      unsafe = true;
      break;
    }
    items.push(read.value);
  }
  return { items, unsafe };
}

export function combineLifecycleFailureList(errors: unknown): Error {
  const budget = new GraphBudget();
  try {
    if (isProxyValue(errors)) return internHostileLeaf(errors as object);
    const { items, unsafe } = readTrustedTopLevelItems(errors, budget);
    if (items.length === 0 && !unsafe) return OPAQUE_ERROR_GRAPH_VALUE;
    const leaves = mergeWalkedLeaves(items, budget);
    const capped = capCombinedLeaves(
      unsafe ? [...leaves, UNSAFE_ERROR_GRAPH_SENTINEL] : leaves,
      budget.exhausted || unsafe
    );
    if (capped.length === 0) {
      return items.length > 0 ? projectUnknownFailure(items[0], budget) : OPAQUE_ERROR_GRAPH_VALUE;
    }
    return aggregateFromLeaves(capped);
  } catch {
    return UNSAFE_ERROR_GRAPH_SENTINEL;
  }
}

/** 当前调用的瞬态聚合：按 first-seen identity 保留每个 distinct failure。 */
export function appendLifecycleFailure(current: Error | undefined, err: unknown): Error {
  const next = asProcessGroupLifecycleError(err);
  if (current === undefined) return next;
  return combineLifecycleFailures(current, next);
}

const TRUSTED_PIPE_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "EIO",
  "EOF",
  "EBADF",
  "UNKNOWN",
  "ERR_STREAM_DESTROYED",
  "ERR_STREAM_PREMATURE_CLOSE"
]);

const PIPE_CONTROLLED_MESSAGE = "pipe error";

function freezePipeConstant(err: Error): Error {
  Object.defineProperties(err, {
    message: { value: PIPE_CONTROLLED_MESSAGE, writable: false, configurable: false, enumerable: true },
    name: { value: "PipeFailure", writable: false, configurable: false, enumerable: false },
    stack: { value: "PipeFailure: pipe error", writable: false, configurable: false, enumerable: false }
  });
  return Object.freeze(err);
}

/** pipe 专用 primitive opaque；不得与 object intern 或通用 error-graph opaque 合并。 */
export const PIPE_OPAQUE_FAILURE = freezePipeConstant(new Error(PIPE_CONTROLLED_MESSAGE));

const pipeLeafIntern = new WeakMap<object, Error>();

function internPipeFailure(origin: object): Error {
  const existing = pipeLeafIntern.get(origin);
  if (existing) return existing;
  if (origin === PIPE_OPAQUE_FAILURE) return PIPE_OPAQUE_FAILURE;
  const projected = freezePipeConstant(new Error(PIPE_CONTROLLED_MESSAGE));
  pipeLeafIntern.set(origin, projected);
  return projected;
}

export interface UntrustedPipeInspection {
  projected: Error;
  trustedCode: string | undefined;
  diagnostic: { code: string; message: string };
}

export interface PipeFailureRecord {
  stream: "stdout" | "stderr" | "stdin";
  code: string;
}

/**
 * pipe 专用 identity intern，与 projectUnknownFailure 分离。
 * 投影文本完全受控；只允许 trap-free 提取白名单 errno code。
 */
export function inspectUntrustedPipeFailure(err: unknown): UntrustedPipeInspection {
  try {
    const projected = isObjectLike(err) ? internPipeFailure(err) : PIPE_OPAQUE_FAILURE;
    let trustedCode: string | undefined;
    if (
      isObjectLike(err) &&
      !isProxyValue(err) &&
      protoChainInspect(err, new GraphBudget()) === "ok" &&
      nativeErrorBrand(err)
    ) {
      const code = readOwnString(err, "code");
      if (code !== undefined && TRUSTED_PIPE_CODES.has(code)) trustedCode = code;
    }
    return {
      projected,
      trustedCode,
      diagnostic: {
        code: trustedCode ?? "unknown",
        message: PIPE_CONTROLLED_MESSAGE
      }
    };
  } catch {
    return {
      projected: PIPE_OPAQUE_FAILURE,
      trustedCode: undefined,
      diagnostic: { code: "unknown", message: PIPE_CONTROLLED_MESSAGE }
    };
  }
}

export function combinePipeBusinessFailures(
  entries: readonly PipeFailureRecord[]
): Error | undefined {
  const leaves: Error[] = [];
  for (const entry of entries) {
    const leaf = invocationBusinessFailure({
      exitCode: 1,
      knownExit: true,
      terminationCause: "pipe_failed",
      pipeFailure: true,
      pipeStream: entry.stream,
      pipeCode: entry.code
    });
    if (leaf) leaves.push(leaf);
  }
  if (leaves.length === 0) return undefined;
  return leaves.length === 1 ? leaves[0] : combineLifecycleFailureList(leaves);
}

export function combineLifecycleFailures(workError: unknown, releaseError: unknown): Error {
  if (workError === releaseError) return combinableError(workError);
  return combineLifecycleFailureList([workError, releaseError]);
}

export async function settleWithLeaseRelease<T>(
  work: Promise<T>,
  release: () => Promise<void>,
  businessOf?: (value: T) => unknown
): Promise<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await work };
  } catch (error) {
    outcome = { ok: false, error };
  }
  try {
    await release();
  } catch (releaseError) {
    if (outcome.ok) {
      const business = businessOf?.(outcome.value);
      if (business != null) throw combineLifecycleFailureList([business, releaseError]);
      throw combinableError(releaseError);
    }
    throw combineLifecycleFailures(outcome.error, releaseError);
  }
  if (!outcome.ok) throw combineLifecycleFailureList([outcome.error]);
  return outcome.value;
}
