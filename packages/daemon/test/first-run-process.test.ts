import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIRST_RUN_OPENING } from "../src/api/firstRun.js";
import { openDb } from "../src/storage/db.js";
import { reservePort, startDaemonProcess } from "./helpers/daemonProcess.js";

const SESSION_ID = "ses_01W1RE0000000000000000000A";

async function waitForMarker(home: string, state: string): Promise<Record<string, unknown>> {
  const markerPath = join(home, "first-run-onboarding.json");
  for (let attempt = 0; attempt < 100; attempt++) {
    if (existsSync(markerPath)) {
      const marker = JSON.parse(readFileSync(markerPath, "utf8")) as Record<string, unknown>;
      if (marker["state"] === state) return marker;
    }
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error(`marker did not reach ${state}`);
}

describe("first-run 真实进程链", () => {
  it("空 HOME→配置→重启→chat-new 查询；响应丢失与再次重启都幂等回同一开场白", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-first-run-process-")));
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    try {
      await expect(waitForMarker(home, "eligible")).resolves.toMatchObject({ state: "eligible" });
      const beforeRestart = await daemon.health();
      const configResponse = await daemon.api("/api/setup/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providers: {
            api: {
              openrouter: {
                base_url: "https://openrouter.ai/api/v1",
                api_key: "env:OPENROUTER_API_KEY"
              }
            }
          },
          models: {
            dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
            thinking: { provider: "api", via: "openrouter", model: "deepseek/deepseek-r1" },
            cheap: { provider: "api", via: "openrouter", model: "google/gemini-3.1-flash-lite" },
            evaluator: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-5" }
          }
        })
      });
      expect(configResponse.status, await configResponse.text()).toBe(200);

      const restartResponse = await daemon.api("/api/setup/restart", { method: "POST", body: "{}" });
      expect(restartResponse.status, await restartResponse.text()).toBe(200);
      const afterSetupRestart = await daemon.waitForRestart(beforeRestart.pid);

      // 服务端已提交 presented 后立即丢弃响应体，模拟组件卸载/网络断开窗口。
      const dropped = await daemon.api("/api/setup/first-run/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID })
      });
      await dropped.body?.cancel();
      const marker = await waitForMarker(home, "presented");
      expect(marker).toMatchObject({ state: "presented", sessionId: SESSION_ID });

      const replayResponse = await daemon.api("/api/setup/first-run/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID })
      });
      const replay = (await replayResponse.json()) as Record<string, unknown>;
      expect(replayResponse.status).toBe(200);
      expect(replay).toMatchObject({
        ok: true,
        state: "presented",
        delivered: true,
        message: FIRST_RUN_OPENING,
        turnId: marker["turnId"]
      });

      const transcriptPath = join(home, "sessions", `${SESSION_ID}.jsonl`);
      const rawTurns = readFileSync(transcriptPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      expect(rawTurns).toHaveLength(1);
      expect(rawTurns[0]).toMatchObject({ speaker: "ai", text: FIRST_RUN_OPENING, origin: "onboarding" });

      const secondRestart = await daemon.api("/api/setup/restart", { method: "POST", body: "{}" });
      expect(secondRestart.status, await secondRestart.text()).toBe(200);
      await daemon.waitForRestart(afterSetupRestart.pid);
      const afterProcessRestart = await daemon.api("/api/setup/first-run/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID })
      });
      await expect(afterProcessRestart.json()).resolves.toMatchObject({
        state: "presented",
        delivered: true,
        message: FIRST_RUN_OPENING,
        turnId: marker["turnId"]
      });
      const turnsAfterRestart = readFileSync(transcriptPath, "utf8").trim().split("\n");
      expect(turnsAfterRestart).toHaveLength(1);

      const db = openDb(join(home, "saydo.db"));
      const presentedAudits = db
        .prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='onboarding.first_run_presented'")
        .get() as { c: number };
      expect(presentedAudits.c).toBe(1);
      db.close();
    } finally {
      await daemon.stop();
    }
  }, 30_000);

  it("空 HOME 起来就备齐 sessions/——它是备份的必需源,缺了每轮定时备份都会直接失败", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "saydo-home-layout-")));
    const daemon = await startDaemonProcess({
      home,
      port: await reservePort(),
      env: { OPENROUTER_API_KEY: "process-test-key" }
    });
    try {
      await daemon.health();
      // backup/snapshot.ts 把 global_sessions 列为 required;第一次对话之前这个目录本来不会存在,
      // 于是全新部署的每一轮定时备份都报"必需备份源不存在"(2026-08-12 实测)。
      expect(existsSync(join(home, "sessions"))).toBe(true);
    } finally {
      await daemon.stop();
    }
  }, 30_000);
});
