// RunSettled{recovery:true} dead-owner 兜底端到端(Hopper appendix §3.2,2026-07-25 已对锁定副本实跑通过)。
// 慢测试(含 65s scheduler.lock lease 等待):SAYDO_SLOW_E2E=1 才跑,CI 缺省跳过——
// 首次验证证据见 e2e/evidence/p05.md §4b(2026-07-25 手工实跑输出)。
// 两坑(§3.2 如实):① kill -9 后须等 lease(60s)过期再 cancel,立刻 cancel 会 expired 且请求保留
// (之后被补 applied,断言别数重);② cancel 必须先于 reconcile(reconcile 先跑 => RecoveryRecorded
// 终态不发 RunSettled——SIGKILL 残余边界,走「超时->reconcile->RecoveryRecorded」对账兜底)。

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { consumeRunSettled, readEventsFrom, type HopperEvent } from "../src/bridge/events.js";

const HOPPER = join(homedir(), ".saydo", "hopper-dist", "bin", "hopper.mjs");
const RUN = existsSync(HOPPER) && process.env["SAYDO_SLOW_E2E"] === "1";

function hopper(args: string[], vault: string): string {
  return execFileSync("node", [HOPPER, ...args], { encoding: "utf8", env: { ...process.env, HOPPER_VAULT: vault }, timeout: 120_000 });
}

describe.skipIf(!RUN)("dead-owner 兜底(SAYDO_SLOW_E2E=1;约 80s)", () => {
  it("kill -9 -> 等 lease 过期 -> cancel => RunSettled{recovery:true};事件即证据可 settle", { timeout: 200_000 }, async () => {
    const vault = join(mkdtempSync(join(tmpdir(), "saydo-rec-")), "v");
    hopper(["init", vault], vault);
    const repo = mkdtempSync(join(tmpdir(), "saydo-rec-repo-"));
    execFileSync("git", ["-C", repo, "init", "-q", "-b", "main"]);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "t", version: "1.0.0", scripts: { test: "exit 0" } }));
    execFileSync("git", ["-C", repo, "add", "-A"]);
    execFileSync("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "i"]);
    hopper(["--json", "link-project", "--project", "app", "--repo", repo, "--no-inbox"], vault);
    const dropOut = execFileSync("node", [HOPPER, "--json", "drop", "--project", "app", "--stdin"], {
      encoding: "utf8",
      input: "# 长任务\n\n跑很久。\n\n## 验收标准\n- 新文件 x.txt 存在",
      env: { ...process.env, HOPPER_VAULT: vault },
      timeout: 120_000
    });
    const taskId = (JSON.parse(dropOut) as { task_id: string }).task_id;
    hopper(["--json", "scan"], vault);
    const spec = join(mkdtempSync(join(tmpdir(), "saydo-rec-spec-")), "s.json");
    writeFileSync(spec, JSON.stringify({ status: "completed", sleepMs: 300_000 }));
    const run = spawn("node", [HOPPER, "--json", "run", taskId], {
      env: { ...process.env, HOPPER_VAULT: vault, HOPPER_FAKE_SPEC: spec },
      stdio: "ignore"
    });
    const eventsPath = join(vault, ".hopper", "events.jsonl");
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (existsSync(eventsPath) && readFileSync(eventsPath, "utf8").includes("RunnerStarted")) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    run.kill("SIGKILL"); // 模拟宿主真崩溃(锁不释放)
    await new Promise((r) => setTimeout(r, 65_000)); // 坑①:等 lease 过期
    hopper(["--json", "cancel", taskId], vault); // 坑②:先于 reconcile
    const read = readEventsFrom(eventsPath, 0);
    const settled = read.events.filter((e) => e.type === "RunSettled").pop() as HopperEvent;
    expect(settled).toBeTruthy();
    expect(settled.payload).toMatchObject({ recovery: true, runner_status: "cancelled", final_status: "failed" });
    // SayDo 消费面:recovery 事件即证据(summary 允许空),投影一致即 settle
    const verdict = consumeRunSettled(settled, { projectionStatus: "failed" });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.finalStatus).toBe("failed");
  });
});
