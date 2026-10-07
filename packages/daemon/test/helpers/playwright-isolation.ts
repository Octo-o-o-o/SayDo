// Playwright 装配的状态所有权、端口拒占与 ready 归属校验；不修改产品网络合同。
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import {
  runtimeIdentitySchema,
  runtimeOwnershipPayload,
  runtimeOwnershipProofSchema
} from "@saydo/contracts";

export function createPlaywrightState(parent: string): { root: string; home: string; firstRunHome: string } {
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(resolve(parent), "saydo-playwright-run-"));
  const home = join(root, "main");
  const firstRunHome = join(root, "first-run");
  try {
    mkdirSync(home, { mode: 0o700 });
    mkdirSync(firstRunHome, { mode: 0o700 });
    return { root, home, firstRunHome };
  } catch (err) {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch (cleanupErr) {
      throw new AggregateError([err, cleanupErr], "Playwright state creation failed and owned root cleanup failed");
    }
    throw err;
  }
}

/** 启动前拒绝已占端口；探针只关闭自己创建的 listener，不连接或终止既有服务。 */
export async function assertPlaywrightPortsAvailable(ports: readonly number[]): Promise<void> {
  for (const port of ports) {
    // Darwin 可让 wildcard 与既有 loopback listener 共存，须单独探测实际访问的 loopback。
    for (const host of ["127.0.0.1", "0.0.0.0", "::1"]) {
      await new Promise<void>((resolveProbe, rejectProbe) => {
        const server = createServer();
        server.once("error", (err: NodeJS.ErrnoException) => {
          if (host === "::1" && (err.code === "EAFNOSUPPORT" || err.code === "EADDRNOTAVAIL")) {
            resolveProbe();
          } else {
            rejectProbe(new Error(`Playwright port ${port} unavailable (${host}): ${err.code ?? err.message}`));
          }
        });
        server.listen({ host, port, exclusive: true }, () => {
          server.close((err) => err ? rejectProbe(err) : resolveProbe());
        });
      });
    }
  }
}

/** 仅接收本装配 detached spawn 返回的 child；PID 不从 runtime 文件或端口扫描恢复。 */
export async function stopOwnedPlaywrightChild(child: ChildProcess | null): Promise<void> {
  if (!child) return;
  // Windows保持现有child生命周期处理；它不是POSIX组证明，真机/后代验收仍未闭合。
  if (process.platform === "win32") {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
    const closed = new Promise<boolean>((done) => {
      const onClose = () => { clearTimeout(timer); done(true); };
      const timer = setTimeout(() => { child.off("close", onClose); done(false); }, 5000);
      child.once("close", onClose);
    });
    child.kill("SIGKILL");
    if (!await closed) throw new Error(`owned Playwright child ${child.pid} did not stop; state retained`);
    return;
  }
  const pgid = child.pid;
  if (!pgid) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    throw new Error("owned Playwright child has no process-group identity; state retained");
  }
  const groupAlive = (): boolean => {
    try { process.kill(-pgid, 0); return true; }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
      throw err; // EPERM/未知不能冒充已退出，也不回退到陌生 PID。
    }
  };
  const signalGroup = (signal: NodeJS.Signals): void => {
    try { process.kill(-pgid, signal); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err; }
  };
  const waitGone = async (timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (groupAlive()) {
      if (Date.now() >= deadline) return false;
      await new Promise((resolvePoll) => setTimeout(resolvePoll, Math.min(50, deadline - Date.now())));
    }
    return true;
  };
  if (!groupAlive()) return;
  signalGroup("SIGTERM");
  if (await waitGone(5000)) return;
  signalGroup("SIGKILL");
  if (!await waitGone(5000)) throw new Error(`owned Playwright group ${pgid} did not stop; state retained`);
}

/** HTTP 200 不足以 ready：子进程须存活，且响应须由本轮新 HOME 的 token 证明。 */
export async function waitForOwnedPlaywrightDaemon(input: {
  url: string;
  home: string;
  port: number;
  children: readonly ChildProcess[];
  what: string;
  logPath?: string;
  timeoutMs?: number;
}): Promise<string> {
  const failures = new Map<ChildProcess, Error>();
  const listeners = input.children.map((child) => {
    const onError = (err: Error) => failures.set(child, err);
    child.on("error", onError);
    return { child, onError };
  });
  const assertAlive = () => {
    for (const child of input.children) {
      if (failures.has(child) || child.exitCode !== null || child.signalCode !== null || !child.pid) {
        throw new Error(`${input.what} child exited before ready (${failures.get(child)?.message ?? child.exitCode ?? child.signalCode ?? "no pid"})`);
      }
    }
  };
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  const stateRootDigest = createHash("sha256").update(input.home, "utf8").digest("hex");
  let lastError = "";
  try {
    while (Date.now() < deadline) {
      assertAlive();
      try {
        const token = readFileSync(join(input.home, ".cap-token"), "utf8").trim();
        if (!token) throw new Error("owned HOME has no capability token");
        const nonce = randomBytes(24).toString("hex");
        const url = new URL(input.url);
        url.searchParams.set("ownershipNonce", nonce);
        const response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(1500, deadline - Date.now()))) });
        const raw = await response.json() as Record<string, unknown>;
        const identity = runtimeIdentitySchema.safeParse(raw.identity);
        const proof = runtimeOwnershipProofSchema.safeParse(raw.ownershipProof);
        if (!response.ok || raw.ok !== true || raw.service !== "saydo-daemon" || raw.phase === "starting" ||
          !identity.success || !proof.success || proof.data.nonce !== nonce ||
          typeof raw.pid !== "number" || !Number.isInteger(raw.pid) || raw.pid <= 1 ||
          typeof raw.startedAt !== "string" || raw.stateRootDigest !== stateRootDigest) {
          throw new Error(`owned daemon readiness rejected (HTTP ${response.status})`);
        }
        const expected = createHmac("sha256", token).update(runtimeOwnershipPayload({
          nonce, pid: raw.pid, port: input.port, startedAt: raw.startedAt, stateRootDigest,
          identity: identity.data
        })).digest();
        const actual = Buffer.from(proof.data.mac, "hex");
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
          throw new Error("owned daemon capability proof mismatch");
        }
        assertAlive();
        return token;
      } catch (err) {
        lastError = String((err as { message?: unknown })?.message ?? err);
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await new Promise((resolvePoll) => setTimeout(resolvePoll, Math.min(500, remaining)));
    }
    const tail = input.logPath && existsSync(input.logPath)
      ? `\n${readFileSync(input.logPath, "utf8").slice(-4000)}` : "";
    throw new Error(`${input.what} did not become owned-ready: lastError=${lastError}${tail}`);
  } finally {
    for (const { child, onError } of listeners) child.off("error", onError);
  }
}
