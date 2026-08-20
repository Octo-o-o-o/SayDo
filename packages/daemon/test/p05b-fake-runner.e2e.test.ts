// §12-8 契约测试 harness(P0.5-B;附录 §2):HOPPER_FAKE_SPEC fake-runner 对锁定二进制
// 确定性跑全闭环(drop->triage->执行->post-run->RunSettled),零 LLM 成本零网络。
// C1 渲染产物直接投喂真 Hopper(契约漂移在此暴露);锁定副本缺失时跳过(CI 机器有)。

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computePackageDigest, type DecisionPackage } from "@saydo/contracts";
import { assertHandshake } from "../src/bridge/capabilities.js";
import { renderTaskCard } from "../src/bridge/taskCard.js";
import { judgeLint } from "../src/bridge/lintPrecheck.js";
import { consumeRunSettled, readEventsFrom, type HopperEvent } from "../src/bridge/events.js";
import { loadTrustReportForPresentation, resolveTrustReportHtml } from "../src/bridge/trustReport.js";

const HOPPER = join(homedir(), ".saydo", "hopper-dist", "bin", "hopper.mjs");
const LOCKED_COMMIT = "bdd1e548f9359789497a797eda24398beba68ac5";
const HAVE = existsSync(HOPPER);

function hopper(args: string[], env: Record<string, string> = {}, vault?: string): string {
  return execFileSync("node", [HOPPER, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...(vault ? { HOPPER_VAULT: vault } : {}), ...env },
    timeout: 120_000
  });
}

function mkPkg(): DecisionPackage {
  const body = {
    id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
    revision: 1,
    projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
    outcomePreview: "加一个新文件",
    inScope: ["src"],
    outOfScope: ["其它目录"],
    assumptions: [],
    acceptance: ["新文件 src/new.txt 存在且内容为 hi"],
    plan: [{ seq: 1, step: "创建文件", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "direct_to_review" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  return { ...body, digest: computePackageDigest(body), status: "approved", expiresAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-07-25T07:00:00.000Z" };
}

describe.skipIf(!HAVE)("§12-8 fake-runner 全闭环(锁定二进制)", () => {
  it("capabilities 握手 -> C1 渲染 -> lint 预检 -> drop -> scan -> fake run -> RunSettled{review} + 复核", { timeout: 300_000 }, () => {
    // 0) 握手断言(对真实锁定副本)
    const vaultRoot = join(mkdtempSync(join(tmpdir(), "saydo-hop-")), "vault");
    hopper(["init", vaultRoot]);
    const caps = hopper(["capabilities", "--json"], {}, vaultRoot);
    const hs = assertHandshake(caps, { expectedCommit: LOCKED_COMMIT, requireSettleEvent: true });
    expect(hs.ok).toBe(true);

    // 1) sandbox repo(package.json 带恒真 test;附录 §2.4)
    const repo = mkdtempSync(join(tmpdir(), "saydo-repo-"));
    execFileSync("git", ["-C", repo, "init", "-q", "-b", "main"]);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "t", version: "1.0.0", scripts: { test: "exit 0" } }));
    execFileSync("git", ["-C", repo, "add", "-A"]);
    execFileSync("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"]);
    hopper(["--json", "link-project", "--project", "app", "--repo", repo, "--no-inbox"], {}, vaultRoot);

    // 2) C1 渲染(真实渲染器产物直接投喂)
    const card = renderTaskCard({
      pkg: mkPkg(),
      dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAA",
      hopperProject: "app",
      saydoTaskId: "tsk_01K0W9TESTAAAAAAAAAAAAAAAA"
    });
    expect(card.ok).toBe(true);
    if (!card.ok) return;

    // 3) lint 预检(三处判定;真实 lint 输出)
    const cardPath = join(mkdtempSync(join(tmpdir(), "saydo-card-")), "card.md");
    writeFileSync(cardPath, card.markdown);
    const lintOut = hopper(["lint", cardPath, "--json"], {}, vaultRoot);
    const verdict = judgeLint(lintOut);
    expect(verdict.ok, `lint 预检应放行: ${JSON.stringify(verdict)}`).toBe(true);

    // 4) drop(stdin)-> scan -> 定向 run(fake spec)
    const dropOut = execFileSync("node", [HOPPER, "--json", "drop", "--project", "app", "--stdin"], {
      encoding: "utf8",
      input: card.markdown,
      env: { ...process.env, HOPPER_VAULT: vaultRoot },
      timeout: 120_000
    });
    const taskId = (JSON.parse(dropOut) as { task_id: string }).task_id;
    expect(taskId).toBeTruthy();
    hopper(["--json", "scan"], {}, vaultRoot);
    const spec = join(mkdtempSync(join(tmpdir(), "saydo-spec-")), "spec.json");
    writeFileSync(spec, JSON.stringify({ status: "completed", changedFiles: [{ path: "src/new.txt", content: "hi" }] }));
    const runOut = hopper(["--json", "run", taskId], { HOPPER_FAKE_SPEC: spec }, vaultRoot);
    const run = JSON.parse(runOut) as { executed?: { finalStatus: string; runId: string }[]; skipped?: unknown[] };
    expect(run.executed?.[0]?.finalStatus, `run 应执行: ${runOut.slice(0, 300)}`).toBe("review");

    // 5) C3 消费:events.jsonl 断点读 -> RunSettled -> 廉价复核(evidence + summary)
    const eventsPath = join(vaultRoot, ".hopper", "events.jsonl");
    const read = readEventsFrom(eventsPath, 0);
    expect(read.corruptLines).toBe(0);
    const settled = read.events.filter((e) => e.type === "RunSettled").pop() as HopperEvent;
    expect(settled).toBeTruthy();
    const payload = settled.payload as { evidence_digest?: string; summary_path?: string };
    const reviewShow = JSON.parse(hopper(["--json", "review", "show", taskId], {}, vaultRoot)) as Record<string, unknown>;
    const evidenceDigest =
      (reviewShow["evidenceDigest"] as string | undefined) ?? (reviewShow["evidence_digest"] as string | undefined) ?? null;
    const summaryExists = payload.summary_path ? existsSync(join(vaultRoot, payload.summary_path)) || existsSync(payload.summary_path) : false;
    const check = consumeRunSettled(settled, { reviewEvidenceDigest: evidenceDigest, summaryExists });
    expect(check.ok, `RunSettled 复核: ${JSON.stringify({ check, evidenceDigest, summary: payload.summary_path })}`).toBe(true);
    if (check.ok) expect(check.finalStatus).toBe("review");

    // 5b) trust-report 嵌入合同(11 §5.5;5.2 挂账的真实渲染前置):.md 受控映射 .html + 呈现层转换零 emoji
    if (payload.summary_path) {
      const loaded = loadTrustReportForPresentation(vaultRoot, payload.summary_path);
      expect(loaded.ok, `trust-report 加载: ${JSON.stringify(loaded)}`).toBe(true);
      if (loaded.ok) {
        expect(loaded.html).toContain("<!DOCTYPE html>");
        expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/u.test(loaded.html)).toBe(false); // DOM 字符门禁
      }
      // 反例:越界路径/扩展名异常 => 证据缺失
      expect(resolveTrustReportHtml(vaultRoot, "../../etc/passwd.md").ok).toBe(false);
      expect(resolveTrustReportHtml(vaultRoot, payload.summary_path.replace(/\.md$/, ".txt")).ok).toBe(false);
    }

    // 6) review approve 真实链(0.5 八条之⑧留痕/A3 幂等在真实 CLI 上):--req-id 重放返回首次结果 + --receipt 审计透传
    const approveArgs = ["--json", "review", "approve", taskId, "--req-id", "saydo-apr-1", "--receipt", "apr_01AAAAAAAAAAAAAAAAAAAAAAAA", "--origin", "saydo-bridge"];
    const a1 = JSON.parse(hopper(approveArgs, {}, vaultRoot)) as Record<string, unknown>;
    const a2 = JSON.parse(hopper(approveArgs, {}, vaultRoot)) as Record<string, unknown>; // 同 req-id 重放
    expect(JSON.stringify(a2)).toBe(JSON.stringify(a1)); // 幂等:重放返回首次结果
    const showAfter = JSON.parse(hopper(["--json", "review", "show", taskId], {}, vaultRoot)) as Record<string, unknown>;
    const approvedFlag = showAfter["approved"] ?? (showAfter["review"] as Record<string, unknown> | undefined)?.["approved"];
    expect(approvedFlag, `approve 后 review show: ${JSON.stringify(showAfter).slice(0, 200)}`).toBe(true);
  });

  it("0.5 顺做:hopper check = Tier1 确定性验收 oracle 可行性(09 §9;--staged --criteria - 四闸门 JSON)", { timeout: 120_000 }, () => {
    const repo = mkdtempSync(join(tmpdir(), "saydo-check-"));
    execFileSync("git", ["-C", repo, "init", "-q", "-b", "main"]);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "t", version: "1.0.0", scripts: { test: "exit 0" } }));
    execFileSync("git", ["-C", repo, "add", "-A"]);
    execFileSync("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"]);
    // Tier1 式产出:staged 改动 + DecisionPackage.acceptance[] 经 stdin 喂 --criteria -
    writeFileSync(join(repo, "new.txt"), "hi\n");
    execFileSync("git", ["-C", repo, "add", "-A"]);
    const out = execFileSync(
      "node",
      [HOPPER, "check", "--staged", "--criteria", "-", "--format", "json", "--no-vault", "--no-llm"],
      { encoding: "utf8", input: "- 新文件 new.txt 存在且内容为 hi\n- npm test 通过\n", cwd: repo, timeout: 120_000 }
    );
    const report = JSON.parse(out) as Record<string, unknown>;
    expect(report["schema_version"]).toBe("1");
    expect((report["changed_files"] as string[])).toContain("new.txt");
    expect((report["verification"] as Record<string, unknown>)["status"]).toBe("passed"); // 独立 oracle:真跑了 npm test
    // 确定性(--no-llm 全闸门照跑)+ 不写事件流(独立于 vault)——"生成方不自评"的机械承载成立
  });

  it("blocked spec:RunSettled{blocked} 事件即证据(summary 允许空)", { timeout: 300_000 }, () => {
    const vaultRoot = join(mkdtempSync(join(tmpdir(), "saydo-hop2-")), "vault");
    hopper(["init", vaultRoot]);
    const repo = mkdtempSync(join(tmpdir(), "saydo-repo2-"));
    execFileSync("git", ["-C", repo, "init", "-q", "-b", "main"]);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "t", version: "1.0.0", scripts: { test: "exit 0" } }));
    execFileSync("git", ["-C", repo, "add", "-A"]);
    execFileSync("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"]);
    hopper(["--json", "link-project", "--project", "app", "--repo", repo, "--no-inbox"], {}, vaultRoot);
    const card = renderTaskCard({
      pkg: mkPkg(),
      dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAB",
      hopperProject: "app",
      saydoTaskId: "tsk_01K0W9TESTBAAAAAAAAAAAAAAA"
    });
    if (!card.ok) throw new Error("render failed");
    const dropOut = execFileSync("node", [HOPPER, "--json", "drop", "--project", "app", "--stdin"], {
      encoding: "utf8",
      input: card.markdown,
      env: { ...process.env, HOPPER_VAULT: vaultRoot },
      timeout: 120_000
    });
    const taskId = (JSON.parse(dropOut) as { task_id: string }).task_id;
    hopper(["--json", "scan"], {}, vaultRoot);
    const spec = join(mkdtempSync(join(tmpdir(), "saydo-spec2-")), "spec.json");
    writeFileSync(spec, JSON.stringify({ status: "blocked", summary: "缺少 API 契约" }));
    hopper(["--json", "run", taskId], { HOPPER_FAKE_SPEC: spec }, vaultRoot);
    const read = readEventsFrom(join(vaultRoot, ".hopper", "events.jsonl"), 0);
    const settled = read.events.filter((e) => e.type === "RunSettled").pop() as HopperEvent;
    const check = consumeRunSettled(settled, { projectionStatus: "blocked" });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.finalStatus).toBe("blocked");

    // blocked 应答链(0.5 八条之②应答回注;A3 幂等):unblock --req-id 放回队列,重放同 req-id 幂等
    const u1 = JSON.parse(hopper(["--json", "unblock", taskId, "--req-id", "saydo-unb-1", "--origin", "saydo-bridge"], {}, vaultRoot)) as Record<string, unknown>;
    const u2 = JSON.parse(hopper(["--json", "unblock", taskId, "--req-id", "saydo-unb-1", "--origin", "saydo-bridge"], {}, vaultRoot)) as Record<string, unknown>;
    expect(JSON.stringify(u2)).toBe(JSON.stringify(u1)); // 幂等重放
    hopper(["--json", "scan"], {}, vaultRoot);
    const show = JSON.parse(hopper(["--json", "show", taskId], {}, vaultRoot)) as Record<string, unknown>;
    const status = ((show["projected"] as Record<string, unknown> | undefined)?.["status"] ??
      (show["frontmatter"] as Record<string, unknown> | undefined)?.["status"]) as string;
    expect(["ready", "received"], `unblock 后状态: ${status}`).toContain(status); // 回到可调度档(不再 blocked)
  });
});
