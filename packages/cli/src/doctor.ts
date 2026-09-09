import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runtimeIdentitySchema,
  runtimeProtocolCompatible,
  voiceReadinessReasonSchema,
  type RuntimeIdentity,
  type VoiceReadinessReason
} from "@saydo/contracts";
import { homeDigest, portIsOccupied } from "./probe.js";

// HOST-01:只读诊断。不读 .cap-token、不发 provider 请求、不打印任何路径;
// 输出只含 digest、版本/build 标识、固定候选文件名与状态词。

export interface InstalledIdentity {
  source: "build_metadata" | "unavailable";
  version: string | null;
  buildId: string | null;
  sourceRevision: string | null;
  protocolVersion: string;
}

export type DoctorSeverity = "ok" | "warn" | "fail";

export interface DoctorFinding {
  code: string;
  severity: DoctorSeverity;
  summary: string;
  next: string;
}

export type DaemonState = "not_running" | "unknown_service" | "home_mismatch" | "starting" | "running";
type UpstreamState = "ok" | "degraded" | "down" | "unknown";

export interface DoctorReadiness {
  coreReady: boolean;
  voiceReady: boolean;
  voiceReason: VoiceReadinessReason | "unknown";
  pipelineConnected: boolean | null;
  asr: UpstreamState;
  tts: UpstreamState;
  runtimeDraining: boolean | null;
  startupLifecycleReady: boolean | null;
  recovery: { active: boolean; mode: string; violationCodes: string[] };
}

export interface DoctorReport {
  version: 1;
  installed: InstalledIdentity;
  home: { stateRootDigest: string; activeConfigDigest: string | null; pendingArtifacts: string[] };
  daemon: {
    state: DaemonState;
    pid?: number;
    startedAt?: string;
    identity?: RuntimeIdentity;
    stateRootDigest?: string;
  };
  readiness: DoctorReadiness | null;
  capabilities: { console: boolean; voice: boolean; asr: UpstreamState; tts: UpstreamState };
  findings: DoctorFinding[];
  exitCode: 0 | 1 | 2;
}

/** daemon 启动时会晋升的候选文件;只暴露固定文件名,不暴露所在目录。 */
const PENDING_ARTIFACTS = ["config.toml.pending", ".env.pending", "cli-runtime.pending.json"] as const;

export function readInstalledIdentity(distDir: string, protocolVersion: string): InstalledIdentity {
  const unavailable: InstalledIdentity = {
    source: "unavailable",
    version: null,
    buildId: null,
    sourceRevision: null,
    protocolVersion
  };
  try {
    const raw = JSON.parse(readFileSync(join(distDir, "build-metadata.json"), "utf8")) as Record<string, unknown>;
    const version = raw["version"];
    const buildId = raw["buildId"];
    const sourceRevision = raw["sourceRevision"];
    const declaredProtocol = raw["protocolVersion"];
    if (typeof version !== "string" || typeof buildId !== "string" || typeof sourceRevision !== "string") {
      return unavailable;
    }
    return {
      source: "build_metadata",
      version,
      buildId,
      sourceRevision,
      protocolVersion: typeof declaredProtocol === "string" ? declaredProtocol : protocolVersion
    };
  } catch {
    return unavailable;
  }
}

export function inspectHome(home: string): DoctorReport["home"] {
  let activeConfigDigest: string | null = null;
  try {
    activeConfigDigest = createHash("sha256").update(readFileSync(join(home, "config.toml"))).digest("hex").slice(0, 12);
  } catch {
    activeConfigDigest = null;
  }
  return {
    stateRootDigest: homeDigest(home),
    activeConfigDigest,
    pendingArtifacts: PENDING_ARTIFACTS.filter((name) => existsSync(join(home, name)))
  };
}

async function fetchJson(url: string): Promise<{ ok: boolean; body: Record<string, unknown> | null }> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    const body = (await response.json().catch(() => null)) as unknown;
    return { ok: response.ok, body: body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null };
  } catch {
    return { ok: false, body: null };
  }
}

function upstreamState(value: unknown): UpstreamState {
  return value === "ok" || value === "degraded" || value === "down" ? value : "unknown";
}

function parseReadiness(body: Record<string, unknown> | null): DoctorReadiness | null {
  if (body === null || body["service"] !== "saydo-runtime") return null;
  const voice = body["voice"];
  const reason = voice !== null && typeof voice === "object"
    ? voiceReadinessReasonSchema.safeParse((voice as Record<string, unknown>)["reason"])
    : undefined;
  const recovery = body["recovery"];
  const recoveryRecord = recovery !== null && typeof recovery === "object" ? (recovery as Record<string, unknown>) : {};
  const violations = Array.isArray(recoveryRecord["violations"]) ? recoveryRecord["violations"] : [];
  return {
    coreReady: body["coreReady"] === true,
    voiceReady: body["voiceReady"] === true,
    voiceReason: reason?.success ? reason.data : "unknown",
    pipelineConnected: typeof body["pipelineConnected"] === "boolean" ? body["pipelineConnected"] : null,
    asr: upstreamState(body["asr"]),
    tts: upstreamState(body["tts"]),
    runtimeDraining: typeof body["runtimeDraining"] === "boolean" ? body["runtimeDraining"] : null,
    startupLifecycleReady: typeof body["startupLifecycleReady"] === "boolean" ? body["startupLifecycleReady"] : null,
    recovery: {
      active: recoveryRecord["active"] === true,
      mode: typeof recoveryRecord["mode"] === "string" ? recoveryRecord["mode"] : "unknown",
      // 只保留 violation code;message 可能带配置摘录,不进可分享输出。
      violationCodes: violations
        .map((item: unknown) => (item !== null && typeof item === "object" ? (item as Record<string, unknown>)["code"] : undefined))
        .filter((code: unknown): code is string => typeof code === "string")
    }
  };
}

export async function collectDoctor(input: {
  home: string;
  port: number;
  protocolVersion: string;
  installed: InstalledIdentity;
}): Promise<DoctorReport> {
  const home = inspectHome(input.home);
  const findings: DoctorFinding[] = [];
  let daemon: DoctorReport["daemon"] = { state: "not_running" };
  let readiness: DoctorReadiness | null = null;

  if (await portIsOccupied(input.port)) {
    const health = await fetchJson(`http://127.0.0.1:${input.port}/health`);
    const body = health.body;
    const identity = runtimeIdentitySchema.safeParse(body?.["identity"]);
    if (!health.ok || body === null || body["service"] !== "saydo-daemon" || !identity.success) {
      daemon = { state: "unknown_service" };
    } else {
      const pid = typeof body["pid"] === "number" && Number.isInteger(body["pid"]) ? body["pid"] : undefined;
      const startedAt = typeof body["startedAt"] === "string" ? body["startedAt"] : undefined;
      const stateRootDigest = typeof body["stateRootDigest"] === "string" ? body["stateRootDigest"] : undefined;
      const state: DaemonState = stateRootDigest !== home.stateRootDigest
        ? "home_mismatch"
        : body["phase"] === "starting"
          ? "starting"
          : "running";
      daemon = {
        state,
        identity: identity.data,
        ...(pid !== undefined ? { pid } : {}),
        ...(startedAt !== undefined ? { startedAt } : {}),
        ...(stateRootDigest !== undefined ? { stateRootDigest } : {})
      };
      if (state !== "home_mismatch") {
        readiness = parseReadiness((await fetchJson(`http://127.0.0.1:${input.port}/readyz`)).body);
      }
    }
  }

  // 1. 服务没起 / 端口冲突 / 数据目录不一致
  if (daemon.state === "not_running") {
    findings.push({
      code: "daemon_not_running",
      severity: "fail",
      summary: `端口 ${input.port} 空闲,daemon 未运行`,
      next: "运行 saydo up 启动服务(或先确认 --port / SAYDO_HOME 是否指向预期实例)"
    });
  } else if (daemon.state === "unknown_service") {
    findings.push({
      code: "port_conflict",
      severity: "fail",
      summary: `端口 ${input.port} 被非 SayDo 服务占用`,
      next: "停掉占用端口的进程,或用 --port 换端口后再 saydo up"
    });
  } else if (daemon.state === "home_mismatch") {
    findings.push({
      code: "home_mismatch",
      severity: "fail",
      summary: `端口 ${input.port} 上运行的是另一数据目录的 daemon`,
      next: "确认 --home / SAYDO_HOME 指向预期数据目录,或停掉该实例后再 saydo up"
    });
  } else if (daemon.state === "starting") {
    findings.push({
      code: "daemon_starting",
      severity: "warn",
      summary: "daemon 仍在启动相位",
      next: "稍候再执行 saydo doctor"
    });
  }

  // 2. 旧 runtime 还在跑:运行 identity 与已安装 build 不一致
  if (daemon.identity) {
    if (!runtimeProtocolCompatible(daemon.identity.protocolVersion, input.protocolVersion)) {
      findings.push({
        code: "protocol_mismatch",
        severity: "fail",
        summary: `运行中协议 ${daemon.identity.protocolVersion} 与本 CLI 协议 ${input.protocolVersion} 主版本不兼容`,
        next: "停掉旧 runtime(Ctrl+C 或结束其进程)后用当前安装重新 saydo up"
      });
    } else if (input.installed.source === "unavailable") {
      findings.push({
        code: "installed_unknown",
        severity: "warn",
        summary: "已安装版本未知(缺 build-metadata.json,通常是源码树运行),无法比对运行 identity",
        next: "用发布包运行 saydo doctor 可得到已安装/运行版本比对"
      });
    } else if (daemon.identity.buildId !== input.installed.buildId) {
      findings.push({
        code: "runtime_stale",
        severity: "warn",
        summary: `运行中 build ${daemon.identity.buildId} 与已安装 build ${input.installed.buildId} 不一致(旧 runtime 仍在跑)`,
        next: "停掉旧 runtime(Ctrl+C 或结束其进程)后重新 saydo up"
      });
    }
  }

  // 3. 配置待生效:候选文件尚未晋升
  if (home.pendingArtifacts.length > 0) {
    const running = daemon.state === "running" || daemon.state === "starting";
    findings.push({
      code: "config_pending",
      severity: "warn",
      summary: `待生效候选:${home.pendingArtifacts.join(",")}`,
      next: running
        ? "重启 daemon 使其晋升为活动配置(Ctrl+C 后 saydo up,或在控制台设置页触发重启)"
        : "下次启动(saydo up)时自动晋升"
    });
  }

  // 4./5. readiness:recovery-only、核心未就绪、pipeline 未接入、上游降级
  if (readiness) {
    if (readiness.recovery.active) {
      findings.push({
        code: "recovery_only",
        severity: "fail",
        summary: `活动配置未通过校验,daemon 只开放配置自救面(${readiness.recovery.violationCodes.join(",") || "无 code"})`,
        next: "打开控制台设置页修正配置后重启"
      });
    } else if (!readiness.coreReady) {
      findings.push({
        code: "core_not_ready",
        severity: "warn",
        summary: readiness.runtimeDraining === true
          ? "daemon 正在收口(draining)"
          : readiness.startupLifecycleReady === false
            ? "daemon 尚未完成启动恢复"
            : "核心未就绪",
        next: "稍候再执行 saydo doctor;持续不就绪时查看 daemon 日志"
      });
    }
    if (readiness.pipelineConnected === false || readiness.voiceReason === "pipeline_absent") {
      findings.push({
        code: "pipeline_absent",
        severity: "warn",
        summary: "语音 pipeline 未接入(未安装或未启动);控制台可用,语音不可用",
        next: "需要语音时安装并启动 pipeline(源码树:cd pipeline && uv sync && uv run python -m saydo_pipeline);否则用打字或浏览器系统语音"
      });
    } else if (!readiness.voiceReady && readiness.voiceReason !== "unknown") {
      findings.push({
        code: "voice_degraded",
        severity: "warn",
        summary: `语音降级:${readiness.voiceReason}(asr ${readiness.asr} / tts ${readiness.tts})`,
        next: readiness.voiceReason === "health_stale"
          ? "pipeline 心跳过期:检查 pipeline 进程是否卡住,必要时重启 pipeline"
          : readiness.voiceReason === "protocol_mismatch" || readiness.voiceReason === "home_mismatch"
            ? "pipeline 与 daemon 版本或数据目录不一致:用同一安装、同一 SAYDO_HOME 重启 pipeline"
            : "检查对应语音服务商的 key 与网络;恢复后 pipeline 会自动回到 ok"
      });
    }
  } else if (daemon.state === "running") {
    findings.push({
      code: "readiness_unavailable",
      severity: "warn",
      summary: "daemon 在线但 /readyz 不可解析",
      next: "稍候重试;持续出现时查看 daemon 日志"
    });
  }

  if (findings.length === 0) {
    findings.push({ code: "all_ok", severity: "ok", summary: "服务、配置与语音链路全部正常", next: "无需处理" });
  }

  const exitCode: DoctorReport["exitCode"] = findings.some((f) => f.severity === "fail")
    ? 2
    : findings.some((f) => f.severity === "warn")
      ? 1
      : 0;
  return {
    version: 1,
    installed: input.installed,
    home,
    daemon,
    readiness,
    capabilities: {
      console: readiness?.coreReady === true,
      voice: readiness?.voiceReady === true,
      asr: readiness?.asr ?? "unknown",
      tts: readiness?.tts ?? "unknown"
    },
    findings,
    exitCode
  };
}

function mark(severity: DoctorSeverity): string {
  return severity === "ok" ? "[ok]" : severity === "warn" ? "[warn]" : "[fail]";
}

export function renderDoctorText(report: DoctorReport): string {
  const lines: string[] = ["SayDo doctor(只读诊断)"];
  lines.push(
    report.installed.source === "build_metadata"
      ? `已安装:${report.installed.version}(build ${report.installed.buildId},协议 ${report.installed.protocolVersion})`
      : `已安装:未知(缺 build-metadata.json;CLI 协议 ${report.installed.protocolVersion})`
  );
  const daemon = report.daemon;
  const daemonLabel: Record<DaemonState, string> = {
    not_running: "未运行",
    unknown_service: "端口被非 SayDo 服务占用",
    home_mismatch: "另一数据目录的 daemon 在跑",
    starting: "启动中",
    running: "运行中"
  };
  const daemonDetail = daemon.identity
    ? `,build ${daemon.identity.buildId},协议 ${daemon.identity.protocolVersion}` +
      (daemon.pid !== undefined ? `,pid ${daemon.pid}` : "") +
      (daemon.startedAt !== undefined ? `,启动于 ${daemon.startedAt}` : "")
    : "";
  lines.push(`服务:${daemonLabel[daemon.state]}${daemonDetail}`);
  lines.push(`数据目录:digest ${report.home.stateRootDigest.slice(0, 16)}(不显示路径)`);
  lines.push(
    `配置:活动世代 ${report.home.activeConfigDigest ?? "无 config.toml"}` +
      (report.home.pendingArtifacts.length > 0 ? `,待生效 ${report.home.pendingArtifacts.join(",")}` : ",无待生效候选")
  );
  const caps = report.capabilities;
  lines.push(
    `能力:控制台 ${caps.console ? "可用" : "不可用"} / 语音 ${caps.voice ? "可用" : "不可用"}(asr ${caps.asr},tts ${caps.tts})`
  );
  if (report.readiness?.recovery.active) {
    lines.push(`恢复模式:${report.readiness.recovery.mode},violations ${report.readiness.recovery.violationCodes.join(",") || "无"}`);
  }
  lines.push("判定:");
  for (const finding of report.findings) {
    lines.push(`  ${mark(finding.severity)} ${finding.code}:${finding.summary}`);
  }
  lines.push("下一步:");
  for (const finding of report.findings) {
    lines.push(`  - ${finding.next}`);
  }
  return `${lines.join("\n")}\n`;
}
