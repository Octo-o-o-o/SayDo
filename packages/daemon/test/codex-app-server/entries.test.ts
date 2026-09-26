import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runControlledExperiment } from "../../src/experimental/codex-app-server/experiment.js";
import { runHandshake, type SpawnedLink } from "../../src/experimental/codex-app-server/handshake.js";
import { APP_SERVER_ARGV, PINNED_CODEX_CLI_VERSION } from "../../src/experimental/codex-app-server/provenance.js";
import { parseCodexCliVersion } from "../../src/experimental/codex-app-server/processControl.js";
import { createPair, line, initResult, threadBody, turnBody } from "./support.js";

function versionText(version = PINNED_CODEX_CLI_VERSION): { stdout: string; stderr: string } {
  return { stdout: `codex-cli ${version}\n`, stderr: "WARNING: proceeding, even though we could not create PATH aliases\n" };
}

function answeringSpawn(userAgent?: string): { spawned: SpawnedLink; frames: () => Array<Record<string, unknown>>; terminated: () => boolean } {
  const pair = createPair();
  let terminated = false;
  pair.link.stdin.on("data", () => {
    const message = pair.frames.at(-1);
    if (!message) return;
    if (message["method"] === "initialize") {
      pair.stdout.write(line({ id: message["id"], result: initResult(userAgent) }));
    } else if (message["method"] === "thread/start") {
      pair.stdout.write(line({ id: message["id"], result: { thread: threadBody("th-real") } }));
    } else if (message["method"] === "turn/start") {
      pair.stdout.write(line({ id: message["id"], result: { turn: turnBody("tu-real", "inProgress") } }));
      pair.stdout.write(line({
        id: "srv-1",
        method: "item/commandExecution/requestApproval",
        params: { threadId: "th-real", turnId: "tu-real", itemId: "item-1", startedAtMs: 1, command: "secret-command-text", reason: null }
      }));
    }
  });
  pair.link.terminate = async () => {
    terminated = true;
    return { sigkill: false, exitCode: 0, signal: null };
  };
  return {
    spawned: { link: pair.link, pid: 4242, cleanup() {} },
    frames: () => pair.frames,
    terminated: () => terminated
  };
}

describe("codex app-server entries", () => {
  it("版本字符串必须精确等于 0.153.3", () => {
    expect(parseCodexCliVersion(versionText()).ok).toBe(true);
    expect(parseCodexCliVersion(versionText("0.153.4")).ok).toBe(false);
    expect(parseCodexCliVersion(versionText("0.153.30")).ok).toBe(false);
    expect(parseCodexCliVersion({ stdout: "", stderr: "codex-cli 0.153.3" }).ok).toBe(true);
  });

  it("握手只写 initialize 和 initialized,并且脱敏", async () => {
    const fake = answeringSpawn();
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-handshake-"));
    let spawned = false;
    const report = await runHandshake({
      intentLogPath: join(dir, "intent.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: (spec) => {
        spawned = true;
        expect(spec.argv).toEqual(APP_SERVER_ARGV);
        return fake.spawned;
      }
    });
    expect(spawned).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.modelExperiment).toBe(false);
    expect(report.userAgentRedacted).not.toContain("secret-home");
    expect(report.codexHomePresent).toBe(true);
    expect(fake.frames().map((frame) => frame["method"])).toEqual(["initialize", "initialized"]);
    expect(fake.terminated()).toBe(true);
  });

  it("版本不匹配或 userAgent 不一致时不把握手当成功", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-version-"));
    const mismatch = await runHandshake({
      intentLogPath: join(dir, "intent.jsonl"),
      versionImpl: () => versionText("0.9.0"),
      spawnImpl: () => {
        throw new Error("spawned");
      }
    });
    expect(mismatch.spawned).toBe(false);
    expect(mismatch.reason).toBe("version_mismatch");
    const fake = answeringSpawn("codex/9.9.9");
    const agent = await runHandshake({
      intentLogPath: join(dir, "agent.jsonl"),
      versionImpl: () => versionText(),
      spawnImpl: () => fake.spawned
    });
    expect(agent.ok).toBe(false);
    expect(agent.reason).toBe("user_agent_version_mismatch");
    expect(fake.terminated()).toBe(true);
    expect(fake.frames().some((frame) => frame["method"] === "turn/start")).toBe(false);
  });

  it("实验默认不 spawn;注入的完整许可仍拒绝命令且不算真实模型实验", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-exp-"));
    const disabled = await runControlledExperiment({
      enabled: false,
      model: "",
      effectBoundary: "",
      maxTurns: 0,
      wallMs: 0,
      taskId: "",
      text: "",
      intentLogPath: join(dir, "off.jsonl"),
      versionImpl: () => {
        throw new Error("version");
      },
      spawnImpl: () => {
        throw new Error("spawn");
      }
    });
    expect(disabled.reason).toBe("experiment_disabled");
    expect(disabled.modelExperiment).toBe(false);
    const missing = await runControlledExperiment({
      enabled: true,
      model: "",
      effectBoundary: "deny-exec-file-permissions",
      maxTurns: 1,
      wallMs: 1000,
      taskId: "task-1",
      text: "hi",
      intentLogPath: join(dir, "missing.jsonl"),
      spawnImpl: () => {
        throw new Error("spawn");
      }
    });
    expect(missing.reason).toBe("model_required");
    const fake = answeringSpawn();
    const ran = await runControlledExperiment({
      enabled: true,
      model: "named-model",
      effectBoundary: "deny-exec-file-permissions",
      maxTurns: 1,
      wallMs: 5000,
      taskId: "task-1",
      text: "secret-prompt-body",
      intentLogPath: join(dir, "ran.jsonl"),
      now: 5_000,
      versionImpl: () => versionText(),
      spawnImpl: () => fake.spawned
    });
    expect(ran.spawned).toBe(true);
    expect(ran.turnFrameWritten).toBe(true);
    expect(ran.modelExperiment).toBe(false);
    expect(ran.textChars).toBe("secret-prompt-body".length);
    const decline = fake.frames().find((frame) => frame["id"] === "srv-1");
    expect(decline?.["result"]).toEqual({ decision: "decline" });
    expect(JSON.stringify(fake.frames().filter((frame) => frame["method"] === "turn/start"))).toContain("named-model");
  });

  it("命令行实验入口在默认参数下拒绝", () => {
    const cli = fileURLToPath(new URL("../../src/experimental/codex-app-server/cli.ts", import.meta.url));
    const tsx = fileURLToPath(new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url));
    try {
      execFileSync(process.execPath, [tsx, cli, "experiment"], { encoding: "utf8", timeout: 10_000 });
      expect.unreachable("experiment entry should refuse");
    } catch (error) {
      const failed = error as { status?: number; stdout?: string };
      expect(failed.status).toBe(2);
      expect(failed.stdout ?? "").toContain("experiment_disabled");
    }
  });
});
