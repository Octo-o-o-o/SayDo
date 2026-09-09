import { createServer, type RequestListener, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { homeDigest } from "../src/probe.js";
import {
  collectDoctor,
  inspectHome,
  readInstalledIdentity,
  renderDoctorText,
  type DoctorReport,
  type InstalledIdentity
} from "../src/doctor.js";
// @ts-expect-error scripts 下的 mjs 没有类型声明;这里只借用公开文本隐私探针口径。
import { countPublicPrivacyHits } from "../../../scripts/public-text-redaction.mjs";

const SECRET_TOKEN = "doctor-secret-cap-token-value";
const PROTOCOL = "1.0.0";
const installed: InstalledIdentity = {
  source: "build_metadata",
  version: "0.1.0-rc.12",
  buildId: "0.1.0-rc.12+abcdefabcdef.p1-0-0.cabcdefabcdef",
  sourceRevision: "a".repeat(64),
  protocolVersion: PROTOCOL
};
const runningIdentity = {
  sourceRevision: installed.sourceRevision,
  buildId: installed.buildId,
  protocolVersion: PROTOCOL
};
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClose) => server.close(() => resolveClose()))));
});

function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "saydo-doctor-home-"));
  writeFileSync(join(home, ".cap-token"), `${SECRET_TOKEN}\n`);
  writeFileSync(join(home, "config.toml"), "[models]\ndialog = \"api\"\n");
  return home;
}

async function listen(handler: RequestListener): Promise<number> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return (server.address() as { port: number }).port;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

function healthBody(home: string, identity: Record<string, unknown> = runningIdentity): Record<string, unknown> {
  return {
    ok: true,
    service: "saydo-daemon",
    identity,
    runtimeSha: identity["sourceRevision"],
    stateRootDigest: homeDigest(home),
    pid: 4242,
    startedAt: "2026-09-09T00:00:00.000Z",
    ts: "2026-09-09T00:00:01.000Z"
  };
}

function readyBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ok: true,
    service: "saydo-runtime",
    identity: runningIdentity,
    version: 1,
    coreReady: true,
    voiceReady: true,
    voice: { enabled: true, reason: "ready" },
    startupLifecycleReady: true,
    runtimeDraining: false,
    pipelineConnected: true,
    pipelineHealthAgeMs: 1200,
    asr: "ok",
    tts: "ok",
    recovery: { active: false, mode: "normal" },
    ...overrides
  };
}

async function serveDaemon(home: string, health: Record<string, unknown>, ready: Record<string, unknown>, readyStatus = 200): Promise<number> {
  return listen((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url?.startsWith("/health")) {
      res.end(JSON.stringify(health));
      return;
    }
    if (req.url?.startsWith("/readyz")) {
      res.statusCode = readyStatus;
      res.end(JSON.stringify(ready));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false }));
  });
}

const sampleOutputs: Array<{ label: string; text: string; json: string; home: string }> = [];

function keepSample(label: string, home: string, report: DoctorReport): void {
  sampleOutputs.push({ label, home, text: renderDoctorText(report), json: JSON.stringify(report) });
}

function codes(report: DoctorReport): string[] {
  return report.findings.map((finding) => finding.code);
}

describe("saydo doctor 五种判定", () => {
  it("1. 服务没起:端口空闲判 daemon_not_running", async () => {
    const home = makeHome();
    const port = await freePort();
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(report.daemon.state).toBe("not_running");
    expect(report.readiness).toBeNull();
    expect(codes(report)).toContain("daemon_not_running");
    expect(report.findings.find((f) => f.code === "daemon_not_running")?.severity).toBe("fail");
    expect(report.exitCode).toBe(2);
    expect(renderDoctorText(report)).toContain("saydo up");
    keepSample("not_running", home, report);
  });

  it("2. 旧 runtime 还在跑:运行 identity 与已安装 buildId 不一致判 runtime_stale", async () => {
    const home = makeHome();
    const staleIdentity = {
      sourceRevision: "b".repeat(64),
      buildId: "0.1.0-rc.11+bbbbbbbbbbbb.p1-0-0.cbbbbbbbbbbbb",
      protocolVersion: PROTOCOL
    };
    const port = await serveDaemon(home, healthBody(home, staleIdentity), readyBody({ identity: staleIdentity }));
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(report.daemon.state).toBe("running");
    expect(report.daemon.identity?.buildId).toBe(staleIdentity.buildId);
    expect(codes(report)).toContain("runtime_stale");
    expect(codes(report)).not.toContain("all_ok");
    expect(report.exitCode).toBe(1);
    const text = renderDoctorText(report);
    expect(text).toContain(staleIdentity.buildId);
    expect(text).toContain(installed.buildId);
    keepSample("runtime_stale", home, report);
  });

  it("3. pipeline 未安装:readyz voice.reason=pipeline_absent 判 pipeline_absent", async () => {
    const home = makeHome();
    const port = await serveDaemon(
      home,
      healthBody(home),
      readyBody({
        voiceReady: false,
        voice: { enabled: false, reason: "pipeline_absent" },
        pipelineConnected: false,
        pipelineHealthAgeMs: null,
        asr: "down",
        tts: "down"
      })
    );
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(report.readiness?.pipelineConnected).toBe(false);
    expect(codes(report)).toContain("pipeline_absent");
    expect(codes(report)).not.toContain("voice_degraded");
    expect(report.capabilities.console).toBe(true);
    expect(report.capabilities.voice).toBe(false);
    expect(report.exitCode).toBe(1);
    keepSample("pipeline_absent", home, report);
  });

  it("4. 配置待生效:HOME 有 pending 候选而 daemon 仍在跑判 config_pending", async () => {
    const home = makeHome();
    writeFileSync(join(home, "config.toml.pending"), "[models]\ndialog = \"api\"\n");
    writeFileSync(join(home, ".env.pending"), "SAYDO_TEST_KEY=should-never-print\n");
    const port = await serveDaemon(home, healthBody(home), readyBody());
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(report.home.pendingArtifacts).toEqual(["config.toml.pending", ".env.pending"]);
    expect(codes(report)).toContain("config_pending");
    expect(codes(report)).not.toContain("all_ok");
    expect(report.exitCode).toBe(1);
    const text = renderDoctorText(report);
    expect(text).toContain("config.toml.pending");
    expect(text).not.toContain("should-never-print");
    keepSample("config_pending", home, report);
  });

  it("4b. 配置待生效但服务没起:提示下次启动自动晋升,不报 config_pending 需重启", async () => {
    const home = makeHome();
    writeFileSync(join(home, "cli-runtime.pending.json"), "{}\n");
    const port = await freePort();
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(report.home.pendingArtifacts).toEqual(["cli-runtime.pending.json"]);
    const pending = report.findings.find((f) => f.code === "config_pending");
    expect(pending?.next).toContain("下次启动");
    expect(codes(report)).toContain("daemon_not_running");
  });

  it("5. 上游降级:pipeline 已接入但 tts degraded 判 voice_degraded", async () => {
    const home = makeHome();
    const port = await serveDaemon(
      home,
      healthBody(home),
      readyBody({
        voiceReady: false,
        voice: { enabled: false, reason: "tts_unavailable" },
        asr: "ok",
        tts: "degraded"
      })
    );
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(codes(report)).toContain("voice_degraded");
    expect(codes(report)).not.toContain("pipeline_absent");
    expect(report.capabilities.asr).toBe("ok");
    expect(report.capabilities.tts).toBe("degraded");
    const degraded = report.findings.find((f) => f.code === "voice_degraded");
    expect(degraded?.summary).toContain("tts");
    expect(degraded?.summary).toContain("degraded");
    expect(report.exitCode).toBe(1);
    keepSample("voice_degraded", home, report);
  });

  it("5b. recovery-only:readyz 503 且 recovery.active 判 recovery_only,只列 violation code", async () => {
    const home = makeHome();
    const port = await serveDaemon(
      home,
      healthBody(home),
      {
        ok: false,
        service: "saydo-runtime",
        identity: runningIdentity,
        version: 1,
        coreReady: false,
        voiceReady: false,
        voice: { enabled: false, reason: "pipeline_absent" },
        recovery: {
          active: true,
          mode: "recovery_only",
          violations: [{ code: "provider_key_missing", slot: "dialog", message: "详细信息不应出现在 doctor 输出" }]
        }
      },
      503
    );
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(codes(report)).toContain("recovery_only");
    expect(report.readiness?.recovery.violationCodes).toEqual(["provider_key_missing"]);
    expect(report.capabilities.console).toBe(false);
    expect(report.exitCode).toBe(2);
    const text = renderDoctorText(report);
    expect(text).toContain("provider_key_missing");
    expect(text).not.toContain("详细信息不应出现");
    keepSample("recovery_only", home, report);
  });

  it("6. 全部正常:只有 all_ok,退出码 0", async () => {
    const home = makeHome();
    const port = await serveDaemon(home, healthBody(home), readyBody());
    const report = await collectDoctor({ home, port, protocolVersion: PROTOCOL, installed });
    expect(report.daemon.state).toBe("running");
    expect(report.daemon.pid).toBe(4242);
    expect(report.home.stateRootDigest).toBe(homeDigest(home));
    expect(report.home.activeConfigDigest).toMatch(/^[0-9a-f]{12}$/);
    expect(report.home.pendingArtifacts).toEqual([]);
    expect(report.capabilities).toEqual({ console: true, voice: true, asr: "ok", tts: "ok" });
    expect(codes(report)).toEqual(["all_ok"]);
    expect(report.exitCode).toBe(0);
    keepSample("all_ok", home, report);
  });

  it("端口被非 SayDo 服务占用与另一数据目录的 daemon 都判 fail", async () => {
    const home = makeHome();
    const foreignPort = await listen((_req, res) => {
      res.end("not-json");
    });
    const foreign = await collectDoctor({ home, port: foreignPort, protocolVersion: PROTOCOL, installed });
    expect(foreign.daemon.state).toBe("unknown_service");
    expect(codes(foreign)).toContain("port_conflict");
    expect(foreign.exitCode).toBe(2);

    const otherHome = makeHome();
    const otherPort = await serveDaemon(otherHome, healthBody(otherHome), readyBody());
    const mismatch = await collectDoctor({ home, port: otherPort, protocolVersion: PROTOCOL, installed });
    expect(mismatch.daemon.state).toBe("home_mismatch");
    expect(codes(mismatch)).toContain("home_mismatch");
    expect(mismatch.exitCode).toBe(2);
    keepSample("home_mismatch", home, mismatch);
  });

  it("已安装身份:dist 缺 build-metadata.json 时标 unavailable 并给 warn", async () => {
    const dist = mkdtempSync(join(tmpdir(), "saydo-doctor-dist-"));
    expect(readInstalledIdentity(dist, PROTOCOL)).toEqual({
      source: "unavailable",
      version: null,
      buildId: null,
      sourceRevision: null,
      protocolVersion: PROTOCOL
    });
    writeFileSync(
      join(dist, "build-metadata.json"),
      JSON.stringify({
        schemaVersion: 1,
        package: "@saydo/cli",
        version: installed.version,
        sourceRevision: installed.sourceRevision,
        buildId: installed.buildId,
        protocolVersion: PROTOCOL
      })
    );
    expect(readInstalledIdentity(dist, PROTOCOL)).toEqual(installed);

    const home = makeHome();
    const port = await serveDaemon(home, healthBody(home), readyBody());
    const report = await collectDoctor({
      home,
      port,
      protocolVersion: PROTOCOL,
      installed: readInstalledIdentity(mkdtempSync(join(tmpdir(), "saydo-doctor-empty-")), PROTOCOL)
    });
    expect(codes(report)).toContain("installed_unknown");
    expect(codes(report)).not.toContain("runtime_stale");
  });

  it("inspectHome 只产出 digest 与固定候选文件名", () => {
    const home = makeHome();
    mkdirSync(join(home, "runtime"), { recursive: true });
    const inspected = inspectHome(home);
    expect(inspected.stateRootDigest).toBe(homeDigest(home));
    expect(JSON.stringify(inspected)).not.toContain(home);
    expect(JSON.stringify(inspected)).not.toContain(SECRET_TOKEN);
  });

  it("隐私:所有示例输出不含 HOME 路径、token 与公开文本隐私命中", () => {
    expect(sampleOutputs.length).toBeGreaterThanOrEqual(6);
    for (const sample of sampleOutputs) {
      for (const output of [sample.text, sample.json]) {
        expect(output, sample.label).not.toContain(sample.home);
        expect(output, sample.label).not.toContain(SECRET_TOKEN);
        expect(output, sample.label).not.toMatch(/x-saydo-token|cap-token/);
        expect(countPublicPrivacyHits(output), sample.label).toEqual({});
      }
    }
  });
});
