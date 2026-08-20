import { createHash, randomInt, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve, sep } from "node:path";
import type { Violation } from "../config/validate.js";
import { loadConfigFile } from "../config/load.js";
import {
  clearInvalidStoredProjectOverrides,
  inspectStoredProjectOverrides,
  validateStoredProjectOverrides
} from "../config/projectOverrides.js";
import { parseReprobeNames, probeAllCliCapabilities, reprobeCliCapabilities } from "../config/cliCapability.js";
import { loadCliRuntimeReceiptIndex, loadPendingCliRuntimeRegistry } from "../config/cliRuntime.js";
import { loadOrCreateCapToken } from "../net/capToken.js";
import { extractToken, verifyIdentity, type IdentityVia } from "../net/identity.js";
import { readT2Config } from "../net/t2.js";
import type { Logger } from "../obs/logger.js";
import type { AuditSink } from "../obs/audit.js";
import type { Db } from "../storage/db.js";
import { recordCliSubscriptionInvocation } from "../cost/ledger.js";
import { abortAllByoaInvocations, activeByoaInvocationCount } from "../providers/byoa/provider.js";
import {
  buildSetupProbe,
  confirmCliCapability,
  parseSetupTestRequest,
  pendingCliSelfTestGate,
  runSetupTest,
  writeSetupConfigStaged,
  writeSetupSecretStaged
} from "./setup.js";
import {
  supervisorFrameSchema,
  type PrepareShutdownReason,
  type RuntimeIdentity,
  type SupervisorFrame
} from "@saydo/contracts";
import { getDesktopSummary } from "./desktop.js";
import { consoleDistDirectory } from "../runtimeAssets.js";
import { markDurableTier1RestartPending } from "../tier1/restartPolicy.js";
import { runtimeOwnershipProof } from "../runtimeOwnership.js";

interface RecoveryOnlyServerInput {
  saydoHome: string;
  daemonDir: string;
  port: number;
  startedAt: string;
  identity: RuntimeIdentity;
  stateRootDigest: string;
  db: Db;
  audit: AuditSink;
  log: Logger;
  supervised: boolean;
  violations: Violation[];
  preboundServer?: Server;
  pendingShutdownReason?: PrepareShutdownReason | null;
  /** B4: spawn 新实例前释放 HOME lock。 */
  onReleaseLock?: () => void;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let body = "";
    let overflow = false;
    req.on("data", (chunk: Buffer) => {
      if (overflow) return;
      if (body.length + chunk.length > 65_536) {
        overflow = true;
        json(res, 413, { ok: false, code: "payload_too_large", message: "body exceeds 64KB", retryable: false });
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on("end", () => {
      if (overflow) return;
      try {
        resolveBody(body.trim() === "" ? {} : JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function serveConsoleStatic(urlPath: string, res: ServerResponse, daemonDir: string): boolean {
  const distDir = consoleDistDirectory(daemonDir);
  if (!existsSync(distDir)) return false;
  const clean = urlPath.split("?")[0] as string;
  const rel = clean === "/" ? "index.html" : clean.replace(/^\//, "");
  const base = resolve(distDir);
  const abs = resolve(distDir, rel);
  if (abs !== base && !abs.startsWith(base + sep)) return false;
  const file = existsSync(abs) ? abs : resolve(distDir, "index.html");
  if (!existsSync(file)) return false;
  const ext = file.slice(file.lastIndexOf("."));
  const mime: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2"
  };
  res.writeHead(200, { "content-type": mime[ext] ?? "application/octet-stream" });
  res.end(readFileSync(file));
  return true;
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

interface StoredOverrideClearItem {
  projectId: string;
  rowDigest: string;
  affectedKeys: string[];
}

function storedOverrideClearItems(db: Db, projectIds: readonly string[]): StoredOverrideClearItem[] {
  const read = db.prepare("SELECT overrides_json FROM project_settings WHERE project_id=?");
  return projectIds.flatMap((projectId) => {
    const row = read.get(projectId) as { overrides_json: string } | undefined;
    if (!row) return [];
    let affectedKeys = ["整份覆盖"];
    try {
      const parsed = JSON.parse(row.overrides_json) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        affectedKeys = Object.keys(parsed).sort();
      }
    } catch {
      // 损坏 JSON 只能按整份覆盖删除，不能编造字段级保留能力。
    }
    return [
      {
        projectId,
        rowDigest: createHash("sha256").update(`${projectId}\0${row.overrides_json}`).digest("hex"),
        affectedKeys
      }
    ];
  });
}

/**
 * recovery-only 的独立 composition root。这里只装配配置自救 HTTP 与静态壳；不构造 WS、
 * 会话、确认环、恢复器、sweep、Tier 1 或外呼器，也不写启动 audit。
 */
export function startRecoveryOnlyServer(input: RecoveryOnlyServerInput): void {
  const capToken = process.env["SAYDO_DISABLE_CAP_TOKEN"] === "1" ? "" : loadOrCreateCapToken(input.saydoHome);
  const t2Cfg = readT2Config(resolve(input.saydoHome, "config.toml"));
  const activeConfigReadable = !input.violations.some((violation) => violation.code === "active_config_unreadable");
  const overrideClearReceipts = new Map<
    string,
    { expiresAtMs: number; rows: Map<string, StoredOverrideClearItem> }
  >();
  let draining = false;
  let drainPromise: Promise<{ aborted: number }> | undefined;
  let stopPromise: Promise<void> | undefined;
  let fatalPromise: Promise<never> | undefined;
  let dbClosed = false;
  let exitIntent: "restart" | "signal" | undefined;
  let tier1DrainPromise: Promise<{ recoverableTier1: number }> | undefined;
  let bindPromise: Promise<void> | undefined;
  const setupJobs = new Set<Promise<void>>();
  const setupJobAbort = new AbortController();

  const sendFrame = (frame: SupervisorFrame): void => {
    void sendFrameAndWait(frame);
  };

  const sendFrameAndWait = (frame: SupervisorFrame): Promise<void> => {
    if (typeof process.send !== "function") return Promise.resolve();
    return new Promise((resolveSend) => {
      try {
        process.send?.(frame, (err) => {
          if (err) input.log.warn("recovery supervisor IPC send failed", { t: frame.t, error: String(err).slice(0, 160) });
          resolveSend();
        });
      } catch (err) {
        input.log.warn("recovery supervisor IPC send failed", { t: frame.t, error: String(err).slice(0, 160) });
        resolveSend();
      }
    });
  };

  const beginDrain = (): Promise<{ aborted: number }> => {
    draining = true;
    setupJobAbort.abort();
    drainPromise ??= (async () => {
      const result = await abortAllByoaInvocations({ permanent: true });
      await Promise.allSettled([...setupJobs]);
      return result;
    })();
    return drainPromise;
  };

  const trackSetupJob = <T>(job: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (draining) return Promise.reject(new Error("runtime is draining"));
    const result = job(setupJobAbort.signal);
    const tracked = result.then(() => undefined, () => undefined).finally(() => setupJobs.delete(tracked));
    setupJobs.add(tracked);
    return result;
  };

  const beginTier1Drain = (reason: string): Promise<{ recoverableTier1: number }> => {
    tier1DrainPromise ??= markDurableTier1RestartPending(input.db, input.audit, input.saydoHome, reason);
    return tier1DrainPromise;
  };

  const closeAfterDrain = async (reason: string): Promise<{ recoverableTier1: number; abortedUnrecoverable: number }> => {
    const byoaDrain = beginDrain();
    const tier1Drain = beginTier1Drain(reason);
    const [byoa, tier1] = await Promise.all([byoaDrain, tier1Drain]);
    await bindPromise;
    const listenerClosed = server.listening
      ? new Promise<void>((resolveClosed, rejectClosed) =>
          server.close((err) => (err ? rejectClosed(err) : resolveClosed()))
        )
      : Promise.resolve();
    server.closeIdleConnections();
    // 活跃 self-test 已结算后终止其 HTTP keep-alive，避免 server.close 永久等待。
    server.closeAllConnections();
    await listenerClosed;
    return { recoverableTier1: tier1.recoverableTier1, abortedUnrecoverable: byoa.aborted };
  };

  const closeDb = (): void => {
    if (dbClosed) return;
    input.db.close();
    dbClosed = true;
  };

  const waitForCleanupWithin = async (jobs: Promise<unknown>[], timeoutMs: number): Promise<void> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled(jobs).then(() => undefined),
        new Promise<void>((resolveTimeout) => {
          timer = setTimeout(resolveTimeout, timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const fatal = (code: string, error: unknown): Promise<never> => {
    if (fatalPromise) return fatalPromise;
    const message = String(error instanceof Error ? error.message : error).slice(0, 500);
    input.log.error("recovery-only shutdown failed", { code, message });
    fatalPromise = (async (): Promise<never> => {
      await waitForCleanupWithin([
        closeAfterDrain("supervisor_stop").then(() => undefined)
      ], 5_000);
      server.closeAllConnections();
      try {
        closeDb();
      } catch (closeError) {
        input.log.error("recovery-only database close failed", { error: String(closeError).slice(0, 200) });
      }
      await waitForCleanupWithin([
        sendFrameAndWait({ v: 1, t: "fatal", code, message })
      ], 500);
      process.exit(1);
    })();
    return fatalPromise;
  };

  const checkIdentity = (req: IncomingMessage): { ok: boolean; via?: IdentityVia; code?: string } => {
    const host = req.headers["host"];
    const origin = req.headers["origin"];
    const result = verifyIdentity({
      host: Array.isArray(host) ? host[0] : host,
      origin: Array.isArray(origin) ? origin[0] : origin,
      referer: req.headers.referer,
      secFetchSite: req.headers["sec-fetch-site"],
      peerAddress: req.socket.remoteAddress,
      token: extractToken(req.url, req.headers),
      port: input.port,
      expectedToken: capToken,
      tailnetHosts: t2Cfg.tailnetHosts
    });
    return result.ok ? { ok: true, via: result.via } : { ok: false, code: result.code };
  };

  const restart = (generation: number): void => {
    if (exitIntent !== "restart") return;
    input.audit.record({ actor: "daemon", action: "setup.self_restart", meta: { generation, pid: process.pid } });
    if (input.supervised) {
      if (typeof process.send !== "function") {
        void fatal("supervisor_ipc_missing", new Error("supervised restart requires IPC"));
        return;
      }
      sendFrame({ v: 1, t: "restartRequested", reason: "setup_recovery", generation });
      return;
    }
    void closeAfterDrain("restart")
      .then((stats) => {
        if (exitIntent !== "restart") return;
        input.audit.record({
          actor: "daemon",
          action: "runtime.prepare_shutdown",
          meta: { reason: "restart", ...stats, recoveryOnly: true }
        });
        // B4: 先关闭 DB / 释放资源，再 spawn；不再固定延迟 200ms 放大锁冲突窗口。
        closeDb();
        input.onReleaseLock?.();
        const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
          detached: true,
          stdio: "inherit",
          env: { ...process.env },
          cwd: process.cwd()
        });
        child.unref();
        process.exit(0);
      })
      .catch((err) => fatal("restart_failed", err));
  };

  const server = input.preboundServer ?? createServer();
  server.on("request", (req, res) => {
    const pathname = (req.url ?? "/").split("?")[0] as string;
    if (pathname === "/health") {
      const ownershipProof = runtimeOwnershipProof({
        nonce: new URL(req.url ?? "/", "http://localhost").searchParams.get("ownershipNonce"),
        token: capToken,
        pid: process.pid,
        port: input.port,
        startedAt: input.startedAt,
        stateRootDigest: input.stateRootDigest,
        identity: input.identity
      });
      json(res, 200, {
        ok: true,
        service: "saydo-daemon",
        identity: input.identity,
        runtimeSha: input.identity.sourceRevision,
        stateRootDigest: input.stateRootDigest,
        pid: process.pid,
        startedAt: input.startedAt,
        ...(ownershipProof ? { ownershipProof } : {}),
        ts: new Date().toISOString()
      });
      return;
    }
    if (pathname === "/readyz") {
      json(res, 503, {
        ok: false,
        service: "saydo-runtime",
        identity: input.identity,
        version: 1,
        coreReady: false,
        voiceReady: false,
        voice: { enabled: false, reason: "pipeline_absent" },
        recovery: { active: true, mode: "recovery_only", violations: input.violations }
      });
      return;
    }

    if (pathname.startsWith("/api/")) {
      const identity = checkIdentity(req);
      if (!identity.ok) {
        json(res, 403, {
          ok: false,
          code: identity.code ?? "identity_rejected",
          message: "G1 identity check failed",
          retryable: false
        });
        return;
      }
      if (req.method === "GET" && pathname === "/api/desktop/summary") {
        let config = null;
        try {
          config = loadConfigFile(resolve(input.saydoHome, "config.toml"));
        } catch {
          // 损坏配置下 DND 如实 disabled,attention/active work 仍从账本现读。
        }
        json(res, 200, getDesktopSummary(input.db, config, activeByoaInvocationCount()));
        return;
      }
      if (!pathname.startsWith("/api/setup/")) {
        json(res, 503, {
          ok: false,
          code: "recovery_only",
          message: "活动模型配置不合法,当前仅开放配置自救",
          retryable: false
        });
        return;
      }
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        json(res, 403, {
          ok: false,
          code: "setup_local_only",
          message: "配置向导仅限本机回环连接",
          retryable: false
        });
        return;
      }
      if (identity.via !== "local") {
        json(res, 403, {
          ok: false,
          code: "setup_local_only",
          message: "配置向导仅限本机受信终端(远程面不开)",
          retryable: false
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/setup/probe") {
        void trackSetupJob((signal) => buildSetupProbe({
          saydoHome: input.saydoHome,
          signal,
          recoveryViolations: input.violations,
          voice: { pipelinePeer: false, asr: "down", tts: "down" }
        }))
          .then((probe) => json(res, 200, probe))
          .catch((err) => json(res, 500, { ok: false, code: "setup_error", message: String(err).slice(0, 200) }));
        return;
      }
      if (req.method === "GET" && pathname === "/api/setup/cli-capability") {
        void trackSetupJob((signal) => probeAllCliCapabilities({ signal }))
          .then((clis) => json(res, 200, { ok: true, clis }))
          .catch((err) => json(res, 500, { ok: false, code: "cli_probe_failed", message: String(err).slice(0, 200) }));
        return;
      }
      if (req.method === "GET" && pathname === "/api/setup/project-overrides/invalid") {
        try {
          const cfg = loadConfigFile(resolve(input.saydoHome, "config.toml"));
          const inspected = inspectStoredProjectOverrides(input.db, cfg);
          const rows = storedOverrideClearItems(input.db, inspected.map((issue) => issue.projectId));
          const rowByProjectId = new Map(rows.map((row) => [row.projectId, row]));
          const now = Date.now();
          for (const [receipt, snapshot] of overrideClearReceipts) {
            if (snapshot.expiresAtMs <= now) overrideClearReceipts.delete(receipt);
          }
          const receipt = randomUUID();
          const expiresAtMs = now + 5 * 60_000;
          overrideClearReceipts.set(receipt, {
            expiresAtMs,
            rows: new Map(rows.map((row) => [row.projectId, row]))
          });
          const issues = inspected.map((issue) => ({
            projectId: issue.projectId,
            violations: issue.violations,
            affectedKeys: rowByProjectId.get(issue.projectId)?.affectedKeys ?? ["整份覆盖"]
          }));
          json(res, 200, {
            ok: true,
            receipt,
            expiresAt: new Date(expiresAtMs).toISOString(),
            deleteWholeOverride: true,
            issues
          });
        } catch {
          json(res, 409, {
            ok: false,
            code: "active_config_unreadable",
            message: "活动 config.toml 不可读;请先用全 API 方案重建配置",
            retryable: false
          });
        }
        return;
      }
      if (req.method !== "POST") {
        json(res, 405, { ok: false, code: "method_not_allowed", message: "unsupported method", retryable: false });
        return;
      }
      if (pathname === "/api/setup/first-run/query") {
        json(res, 503, {
          ok: false,
          code: "recovery_only",
          message: "活动模型配置不合法,改成全 API 并重启后再进入对话",
          retryable: false
        });
        return;
      }

      void readJsonBody(req, res)
        .then(async (body) => {
          if (pathname === "/api/setup/project-overrides/clear-invalid") {
            const record = body as Record<string, unknown> | null;
            const projectIds = record?.["projectIds"];
            if (!Array.isArray(projectIds) || projectIds.length === 0 || projectIds.some((id) => typeof id !== "string")) {
              json(res, 422, {
                ok: false,
                code: "project_ids_required",
                message: "请先读取非法覆盖列表,再明确提交要清除的 projectIds",
                retryable: false
              });
              return;
            }
            const receipt = record?.["receipt"];
            if (typeof receipt !== "string" || record?.["deleteWholeOverride"] !== true) {
              json(res, 422, {
                ok: false,
                code: "override_clear_confirmation_required",
                message: "请先读取非法覆盖列表,并明确确认删除所列项目的整份覆盖",
                retryable: false
              });
              return;
            }
            const snapshot = overrideClearReceipts.get(receipt);
            if (!snapshot || snapshot.expiresAtMs <= Date.now()) {
              overrideClearReceipts.delete(receipt);
              json(res, 409, {
                ok: false,
                code: "override_clear_receipt_invalid",
                message: "非法覆盖列表凭据缺失或已过期,请刷新后重新确认",
                retryable: false
              });
              return;
            }
            let cfg;
            try {
              cfg = loadConfigFile(resolve(input.saydoHome, "config.toml"));
            } catch {
              json(res, 409, {
                ok: false,
                code: "active_config_unreadable",
                message: "活动 config.toml 不可读;请先用全 API 方案重建配置",
                retryable: false
              });
              return;
            }
            const requested = projectIds as string[];
            const invalidProjectIds = new Set(
              inspectStoredProjectOverrides(input.db, cfg).map((issue) => issue.projectId)
            );
            const currentRows = new Map(
              storedOverrideClearItems(input.db, requested).map((row) => [row.projectId, row])
            );
            const snapshotChanged = requested.some((projectId) => {
              const listed = snapshot.rows.get(projectId);
              const current = currentRows.get(projectId);
              return !listed || !current || listed.rowDigest !== current.rowDigest;
            });
            if (
              new Set(requested).size !== requested.length ||
              requested.some((projectId) => !invalidProjectIds.has(projectId)) ||
              snapshotChanged
            ) {
              json(res, 409, {
                ok: false,
                code: "project_overrides_changed",
                message: "非法覆盖列表已变化,请刷新后重新确认",
                retryable: false
              });
              return;
            }
            const cleared = clearInvalidStoredProjectOverrides(input.db, cfg, requested);
            overrideClearReceipts.delete(receipt);
            input.audit.record({
              actor: "owner",
              action: "setup.invalid_project_overrides_cleared",
              meta: {
                projectIds: cleared,
                deleteWholeOverride: true,
                affectedKeys: Object.fromEntries(
                  requested.map((projectId) => [projectId, snapshot.rows.get(projectId)?.affectedKeys ?? ["整份覆盖"]])
                )
              }
            });
            json(res, 200, { ok: true, cleared, deletedWholeOverride: true });
            return;
          }
          if (pathname === "/api/setup/config") {
            // active 不可读时先允许落一份本身合法的 pending；重启后以该配置精确列出/清除
            // 存量 override。否则 candidate 校验会和“必须先列出再清除”形成自救死锁。
            const validateCandidate = activeConfigReadable
              ? (config: Parameters<typeof validateStoredProjectOverrides>[1]) =>
                  validateStoredProjectOverrides(input.db, config)
              : undefined;
            const out = writeSetupConfigStaged(input.saydoHome, body, undefined, validateCandidate);
            if (!out.ok) {
              json(res, out.status, {
                ok: false,
                code: out.code,
                message: out.message,
                violations: out.violations,
                retryable: false
              });
              return;
            }
            input.audit.record({ actor: "owner", action: "setup.config_staged", meta: {} });
            json(res, 200, { ok: true, restart_required: true });
            return;
          }
          if (pathname === "/api/setup/secret") {
            const out = writeSetupSecretStaged(input.saydoHome, body, input.audit);
            if (!out.ok) {
              json(res, out.status, { ok: false, code: out.code, message: out.message, retryable: false });
              return;
            }
            json(res, 200, { ok: true, name: out.name, restart_required: true });
            return;
          }
          if (pathname === "/api/setup/test") {
            if (draining) {
              json(res, 503, {
                ok: false,
                code: "daemon_draining",
                message: "daemon 正在退出,不再接受新的 CLI self-test",
                retryable: true
              });
              return;
            }
            const { scope } = parseSetupTestRequest(body);
            const out = await trackSetupJob((signal) => runSetupTest({
              saydoHome: input.saydoHome,
              signal,
              scope,
              voice: { pipelinePeer: false, asr: "down", tts: "down" },
              audit: input.audit,
              cliRuntimeReceipts: loadCliRuntimeReceiptIndex(input.db),
              onSubscriptionInvocation: (slot, invocation) =>
                recordCliSubscriptionInvocation(input.db, slot, invocation),
              log: input.log
            }));
            json(res, 200, { ok: true, ...out });
            return;
          }
          if (pathname === "/api/setup/cli-capability/reprobe") {
            if (draining) {
              json(res, 503, {
                ok: false,
                code: "daemon_draining",
                message: "daemon 正在退出,不再接受新的 CLI 轻量重探",
                retryable: true
              });
              return;
            }
            const names = parseReprobeNames((body as { names?: unknown }).names);
            if (!names.ok) {
              json(res, 400, { ok: false, code: "reprobe_names_invalid", message: names.message, retryable: false });
              return;
            }
            const clis = await trackSetupJob((signal) => reprobeCliCapabilities(names.names, { signal }));
            json(res, 200, { ok: true, clis });
            return;
          }
          if (pathname === "/api/setup/cli-capability/confirm") {
            if (draining) {
              json(res, 503, {
                ok: false,
                code: "daemon_draining",
                message: "daemon 正在退出,不再接受新的 CLI 确认一发",
                retryable: true
              });
              return;
            }
            const parsed = body as { name?: unknown };
            const name = typeof parsed.name === "string" ? parsed.name : "";
            const out = await trackSetupJob((signal) => confirmCliCapability({ name, signal, audit: input.audit }));
            json(res, 200, out);
            return;
          }
          if (pathname === "/api/setup/restart") {
            if (draining || exitIntent) {
              json(res, 503, {
                ok: false,
                code: "daemon_draining",
                message: "daemon 正在退出,不能重复发起 restart",
                retryable: true
              });
              return;
            }
            const pendingActivation = loadPendingCliRuntimeRegistry(input.saydoHome).activation;
            const cliGate = pendingCliSelfTestGate(
              input.saydoHome,
              loadCliRuntimeReceiptIndex(input.db, "pending", pendingActivation)
            );
            if (!cliGate.ok) {
              json(res, 409, {
                ok: false,
                code: "cli_self_test_required",
                message: `CLI 槽尚未通过真实 self-test:${cliGate.missingSlots.join(",")}`,
                retryable: true
              });
              return;
            }
            exitIntent = "restart";
            void beginDrain();
            const generation = randomInt(1, 2_147_483_647);
            json(res, 200, { ok: true, restarting: true, generation, pipelineAcked: false });
            setImmediate(() => restart(generation));
            return;
          }
          json(res, 404, { ok: false, code: "not_found", message: "unknown setup route", retryable: false });
        })
        .catch(() => {
          if (!res.headersSent) {
            json(res, 400, { ok: false, code: "bad_json", message: "request body is not valid json", retryable: false });
          }
        });
      return;
    }

    if (req.method === "GET") {
      const rawHost = req.headers["host"];
      const hostHeader = (Array.isArray(rawHost) ? rawHost[0] : rawHost)?.toLowerCase();
      if (hostHeader === `127.0.0.1:${input.port}`) {
        res.writeHead(308, { location: `http://localhost:${input.port}${req.url ?? "/"}` });
        res.end();
        return;
      }
      if (serveConsoleStatic(req.url ?? "/", res, input.daemonDir)) return;
    }
    json(res, 404, { ok: false, code: "not_found", message: "unknown route", retryable: false });
  });

  const listen = (): Promise<void> => {
    if (server.listening) {
      bindPromise ??= Promise.resolve().then(() => {
        if (draining) return;
        input.log.warn("daemon running in recovery-only mode", {
          port: input.port,
          listen: t2Cfg.listen,
          violations: input.violations.map((violation) => ({ code: violation.code, slot: violation.slot }))
        });
        sendFrame({
          v: 1,
          t: "ready",
          identity: input.identity,
          port: input.port,
          stateRootDigest: input.stateRootDigest,
          readiness: {
            version: 1,
            coreReady: false,
            voiceReady: false,
            voice: { enabled: false, reason: "pipeline_absent" }
          }
        });
      });
      return bindPromise;
    }
    bindPromise ??= new Promise((resolveListen, rejectListen) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off("error", onError);
        input.log.error("recovery-only listen failed", { error: String(err), port: input.port });
        rejectListen(err);
      };
      server.once("error", onError);
      server.listen(input.port, t2Cfg.listen, () => {
        server.off("error", onError);
        if (draining) {
          server.close((err) => (err ? rejectListen(err) : resolveListen()));
          return;
        }
        input.log.warn("daemon running in recovery-only mode", {
          port: input.port,
          listen: t2Cfg.listen,
          violations: input.violations.map((violation) => ({ code: violation.code, slot: violation.slot }))
        });
        sendFrame({
          v: 1,
          t: "ready",
          identity: input.identity,
          port: input.port,
          stateRootDigest: input.stateRootDigest,
          readiness: {
            version: 1,
            coreReady: false,
            voiceReady: false,
            voice: { enabled: false, reason: "pipeline_absent" }
          }
        });
        resolveListen();
      });
    });
    return bindPromise;
  };
  void beginTier1Drain("recovery_only")
    .then(() => draining ? undefined : listen())
    .catch((err) => fatal("tier1_reap_failed", err));

  function stop(reason: PrepareShutdownReason): Promise<void> {
    if (stopPromise) return stopPromise;
    if (!exitIntent) exitIntent = reason === "restart" ? "restart" : "signal";
    stopPromise = Promise.race([
      closeAfterDrain(reason),
      new Promise<never>((_, rejectTimeout) => {
        const timer = setTimeout(() => rejectTimeout(new Error("recovery shutdown deadline exceeded")), 25_000);
        timer.unref();
      })
    ])
      .then(async (tier1) => {
        input.audit.record({
          actor: "daemon",
          action: "runtime.prepare_shutdown",
          meta: { reason, recoverableTier1: tier1.recoverableTier1, abortedUnrecoverable: tier1.abortedUnrecoverable, recoveryOnly: true }
        });
        closeDb();
        await sendFrameAndWait({
          v: 1,
          t: "stopped",
          reason,
          recoverableTier1: tier1.recoverableTier1,
          abortedUnrecoverable: tier1.abortedUnrecoverable
        });
        process.exit(0);
      })
      .catch((err) => fatal("shutdown_failed", err));
    return stopPromise;
  }
  process.on("message", (message: unknown) => {
    const parsed = supervisorFrameSchema.safeParse(message);
    if (parsed.success && parsed.data.t === "prepareShutdown") void stop(parsed.data.reason);
  });
  if (!input.supervised) {
    process.on("SIGINT", () => void stop("cli_sigint"));
    process.on("SIGTERM", () => void stop("supervisor_stop"));
  }
  if (input.supervised) process.on("disconnect", () => void stop("supervisor_stop"));
  if (input.pendingShutdownReason) void stop(input.pendingShutdownReason);
}
