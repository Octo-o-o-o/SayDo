import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { issueExperimentPermit } from "../../src/experimental/codex-app-server/permit.js";
import { declineDecision } from "../../src/experimental/codex-app-server/protocol.js";
import { openFixtureSession, openRealSession, type TurnView } from "../../src/experimental/codex-app-server/session.js";
import { boot, createPair, delay, initResult, line, openPair, ownThread, requestByMethod, threadBody, turnBody } from "./support.js";

function phaseOf(pair: ReturnType<typeof openPair>): string | null {
  return pair.session.snapshot().threads[0]?.turn?.phase ?? null;
}

async function activeTurn(pair: ReturnType<typeof openPair>, text = "hello"): Promise<TurnView | null> {
  const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text });
  const request = requestByMethod(pair.frames, "turn/start");
  pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-1", "inProgress") } }));
  const outcome = await pending;
  return outcome.value;
}

describe("codex app-server session", () => {
  it("initialize 成功后才发 initialized,重复初始化不写第二帧", async () => {
    const pair = openPair();
    const first = pair.session.initialize();
    expect(pair.frames.map((frame) => frame["method"])).toEqual(["initialize"]);
    pair.stdout.write(line({ id: pair.frames[0]?.["id"], result: initResult() }));
    const outcome = await first;
    expect(outcome.status).toBe("acked");
    expect(pair.frames.map((frame) => frame["method"])).toEqual(["initialize", "initialized"]);
    const second = await pair.session.initialize();
    expect(second.reason).toBe("duplicate_initialize");
    expect(pair.frames.filter((frame) => frame["method"] === "initialize")).toHaveLength(1);
    const early = openPair();
    const blocked = await early.session.startThread({ taskId: "task-1" });
    expect(blocked.reason).toBe("not_ready");
    expect(early.frames.some((frame) => frame["method"] === "thread/start")).toBe(false);
  });

  it("ACK 丢失后不自动重发 initialize", async () => {
    const pair = openPair({ requestTimeoutMs: 30 });
    const outcome = await pair.session.initialize();
    expect(outcome.status).toBe("unknown");
    const again = await pair.session.initialize();
    expect(again.reason).toBe("duplicate_initialize");
    expect(pair.frames.filter((frame) => frame["method"] === "initialize")).toHaveLength(1);
    expect(pair.session.retryLast().reason).toBe("retry_refused");
  });

  it("start 的 ACK 之前可以先到 completed,迟到的 inProgress 回包不能恢复 active", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "secret-body" });
    const request = requestByMethod(pair.frames, "turn/start");
    pair.stdout.write(line({ method: "turn/completed", params: { threadId: "th-1", turn: turnBody("tu-1", "completed") } }));
    expect(phaseOf(pair)).toBe("terminal");
    expect(pair.session.snapshot().threads[0]?.turn?.upstreamTerminal).toBe(true);
    expect(pair.session.snapshot().saydoVerified).toBe(false);
    pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-1", "inProgress") } }));
    const outcome = await pending;
    expect(outcome.status).toBe("acked");
    expect(phaseOf(pair)).toBe("terminal");
    pair.stdout.write(line({ method: "turn/started", params: { threadId: "th-1", turn: turnBody("tu-1", "inProgress") } }));
    expect(phaseOf(pair)).toBe("terminal");
    expect(JSON.stringify(pair.recorder.records)).not.toContain("secret-body");
  });

  it("interrupt 的 ACK 不是已中断,只有 interrupted 终态才确认", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    await activeTurn(pair);
    const pending = pair.session.interruptTurn({ taskId: "task-1", threadId: "th-1", turnId: "tu-1" });
    const request = requestByMethod(pair.frames, "turn/interrupt");
    pair.stdout.write(line({ id: request["id"], result: {} }));
    const acked = await pending;
    expect(acked.value?.interruptAcked).toBe(true);
    expect(acked.value?.interruptConfirmed).toBe(false);
    expect(phaseOf(pair)).toBe("interrupt_pending");
    pair.stdout.write(line({ method: "turn/completed", params: { threadId: "th-1", turn: turnBody("tu-1", "interrupted") } }));
    const turn = pair.session.snapshot().threads[0]?.turn;
    expect(turn?.phase).toBe("terminal");
    expect(turn?.interruptConfirmed).toBe(true);
    expect(turn?.upstreamTerminal).toBe(true);
    expect(pair.session.snapshot().saydoVerified).toBe(false);
  });

  it("超时后的迟到 ACK 保持 unknown,观察到终态后才允许下一轮", async () => {
    const pair = openPair({ requestTimeoutMs: 40 });
    await boot(pair);
    await ownThread(pair);
    const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "x" });
    const request = requestByMethod(pair.frames, "turn/start");
    const outcome = await pending;
    expect(outcome.status).toBe("unknown");
    expect(phaseOf(pair)).toBe("unknown");
    pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-1", "inProgress") } }));
    await delay(20);
    expect(phaseOf(pair)).toBe("unknown");
    const blocked = await pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "again" });
    expect(blocked.reason).toBe("unknown_blocks");
    expect(pair.frames.filter((frame) => frame["method"] === "turn/start")).toHaveLength(1);
    pair.stdout.write(line({ method: "turn/completed", params: { threadId: "th-1", turn: turnBody("tu-late", "failed") } }));
    expect(phaseOf(pair)).toBe("terminal");
    expect(pair.session.snapshot().unknownBlocks).toBe(0);
  });

  it("错误回包、未知回包、重复回包和方向相同的 id 不会互相完成", async () => {
    const pair = openPair({ requestTimeoutMs: 200 });
    await boot(pair);
    await ownThread(pair);
    pair.stdout.write(line({ id: "missing", result: { thread: threadBody("foreign") } }));
    expect(pair.session.snapshot().threads.map((thread) => thread.threadId)).toEqual(["th-1"]);
    const errored = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "x" });
    const errorRequest = requestByMethod(pair.frames, "turn/start");
    pair.stdout.write(line({ id: errorRequest["id"], result: { turn: turnBody("tu-1", "inProgress") }, error: { code: 1, message: "both" } }));
    expect(pair.session.diagnostics().protocolErrors).toBeGreaterThan(0);
    expect(phaseOf(pair)).toBe("start_pending");
    pair.stdout.write(line({ id: errorRequest["id"], error: { code: -32000, message: "nope" } }));
    const rejected = await errored;
    expect(rejected.status).toBe("rejected");
    expect(phaseOf(pair)).toBeNull();

    const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "y" });
    const request = requestByMethod(pair.frames, "turn/start");
    pair.stdout.write(line({ method: "turn/started", params: { threadId: "th-1", turn: turnBody("tu-1", "inProgress") } }));
    pair.stdout.write(line({ id: 1, method: "item/commandExecution/requestApproval", params: approvalParams() }));
    pair.stdout.write(line({ id: 1, result: { turn: turnBody("other", "inProgress") } }));
    expect(pair.session.snapshot().pendingClientIds).toContain(`s:${String(request["id"])}`);
    expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-1");
    pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-1", "inProgress") } }));
    pair.stdout.write(line({ id: request["id"], result: { turn: turnBody("tu-2", "inProgress") } }));
    const acked = await pending;
    expect(acked.status).toBe("acked");
    expect(phaseOf(pair)).toBe("active");
    expect(pair.session.diagnostics().unknownResponses).toBeGreaterThan(0);
    const decisions = pair.frames.filter((frame) => frame["result"] && typeof frame["result"] === "object");
    expect(JSON.stringify(decisions)).toContain('"decline"');
    expect(JSON.stringify(decisions)).not.toContain('"accept"');
  });

  it("别的 thread、旧 turn 和断线后的通知不能推进当前轮", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    await activeTurn(pair);
    pair.stdout.write(line({ method: "turn/completed", params: { threadId: "other", turn: turnBody("tu-1", "failed") } }));
    pair.stdout.write(line({ method: "turn/started", params: { threadId: "th-1", turn: turnBody("tu-old", "inProgress") } }));
    expect(phaseOf(pair)).toBe("active");
    expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-1");
    pair.stdout.end();
    await delay(20);
    expect(pair.session.snapshot().phase).toBe("closed");
    expect(pair.session.snapshot().threads[0]?.turn?.turnId).toBe("tu-1");
    const again = await pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "later" });
    expect(again.reason).toBe("link_closed");
  });

  it("命令、文件、权限和用户输入默认拒绝,空权限不会抄成授权", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    await activeTurn(pair);
    const secret = "secret-command-text";
    pair.stdout.write(line({ id: "s1", method: "item/commandExecution/requestApproval", params: { ...approvalParams(), command: secret, reason: null } }));
    pair.stdout.write(line({ id: "s2", method: "item/fileChange/requestApproval", params: { threadId: "th-1", turnId: "tu-1", itemId: "file-1", startedAtMs: 1, reason: null, grantRoot: null } }));
    pair.stdout.write(line({
      id: "s3",
      method: "item/permissions/requestApproval",
      params: {
        cwd: "/tmp/spike",
        itemId: "perm-1",
        threadId: "th-1",
        turnId: "tu-1",
        startedAtMs: 1,
        permissions: { fileSystem: null, network: { enabled: true } },
        reason: null
      }
    }));
    pair.stdout.write(line({
      id: "s4",
      method: "item/tool/requestUserInput",
      params: {
        isBlocking: true,
        itemId: "ask-1",
        threadId: "th-1",
        turnId: "tu-1",
        questions: [{ id: "q", header: "h", question: "secret-question", isSecret: true }],
        autoResolutionMs: null
      }
    }));
    pair.stdout.write(line({
      id: "s5",
      method: "execCommandApproval",
      params: { callId: "call-1", command: [secret], conversationId: "th-1", cwd: "/tmp", parsedCmd: [{ cmd: secret, type: "unknown" }], reason: null }
    }));
    pair.stdout.write(line({ id: "s6", method: "mystery/do", params: { token: secret } }));
    const results = pair.frames.filter((frame) => "result" in frame || "error" in frame);
    const permission = results.find((frame) => frame["id"] === "s3");
    expect(permission?.["result"]).toEqual({ permissions: {} });
    expect(JSON.stringify(permission)).not.toContain("enabled");
    expect(results.find((frame) => frame["id"] === "s4")?.["result"]).toEqual({ answers: {} });
    expect(results.find((frame) => frame["id"] === "s1")?.["result"]).toEqual(declineDecision());
    expect(results.find((frame) => frame["id"] === "s2")?.["result"]).toEqual({ decision: "decline" });
    expect(results.find((frame) => frame["id"] === "s5")?.["result"]).toEqual({ decision: { denied: { rejection: "denied" } } });
    expect(results.find((frame) => frame["id"] === "s6")?.["error"]).toMatchObject({ code: -32601 });
    expect(JSON.stringify(pair.frames)).not.toContain(secret);
    expect(JSON.stringify(pair.recorder.records)).not.toContain(secret);
    expect(JSON.stringify(pair.recorder.records)).not.toContain("secret-question");
    expect(pair.session.diagnostics().warnings.join(" ")).not.toContain(secret);
  });

  it("具名一次授权只生效一次,越权、过期和重复请求不授予", async () => {
    const pair = createPair();
    const session = openFixtureSession({
      link: pair.link,
      recorder: pair.recorder,
      runId: "run-1",
      oneShotGrants: [{ method: "item/commandExecution/requestApproval", threadId: "th-1", turnId: "tu-1", itemId: "item-ok" }]
    });
    const armed = { ...pair, session };
    await boot(armed);
    await ownThread(armed);
    await activeTurn(armed);
    pair.stdout.write(line({ id: "bad", method: "item/commandExecution/requestApproval", params: { ...approvalParams(), threadId: "foreign", itemId: "item-ok" } }));
    pair.stdout.write(line({ id: "other", method: "item/commandExecution/requestApproval", params: { ...approvalParams(), itemId: "item-no" } }));
    pair.stdout.write(line({ id: "once", method: "item/commandExecution/requestApproval", params: { ...approvalParams(), itemId: "item-ok" } }));
    pair.stdout.write(line({ id: "once", method: "item/commandExecution/requestApproval", params: { ...approvalParams(), itemId: "item-ok" } }));
    pair.stdout.write(line({ method: "turn/completed", params: { threadId: "th-1", turn: turnBody("tu-1", "completed") } }));
    pair.stdout.write(line({ id: "late", method: "item/commandExecution/requestApproval", params: { ...approvalParams(), itemId: "item-late" } }));
    const byId = (id: string) => pair.frames.find((frame) => frame["id"] === id);
    expect(byId("bad")?.["error"]).toMatchObject({ code: -32602 });
    expect(byId("other")?.["result"]).toEqual({ decision: "decline" });
    expect(byId("once")?.["result"]).toEqual({ decision: "accept" });
    expect(pair.frames.filter((frame) => frame["id"] === "once" && frame["result"] && (frame["result"] as { decision?: string }).decision === "accept")).toHaveLength(1);
    expect(byId("late")?.["error"]).toMatchObject({ code: -32602 });
    expect(JSON.stringify(byId("late"))).not.toContain("accept");
  });

  it("意图写失败不会发出效果,真实模式没有许可或预算也不能发", async () => {
    const failing = openPair();
    await boot(failing);
    await ownThread(failing);
    const before = failing.frames.length;
    failing.recorder.fail = true;
    const blocked = await failing.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "secret-body" });
    expect(blocked.reason).toBe("intent_persist_failed");
    expect(failing.frames).toHaveLength(before);

    const realPair = createPair();
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-intent-"));
    const real = openRealSession({
      link: realPair.link,
      intentLogPath: join(dir, "intent.jsonl"),
      runId: "real-1",
      permit: null
    });
    const realBoot = { ...realPair, session: real };
    await boot(realBoot);
    const denied = await real.startTurn({ taskId: "task-1", threadId: "th-1", text: "nope" });
    expect(denied.reason).toBe("experiment_disabled");
    expect(realPair.frames.some((frame) => frame["method"] === "turn/start")).toBe(false);
    const forged = openRealSession({
      link: createPair().link,
      intentLogPath: join(dir, "forged.jsonl"),
      runId: "real-2",
      permit: {
        brand: Symbol("forged"),
        model: "named-model",
        effectBoundary: "deny-exec-file-permissions",
        maxTurns: 1,
        wallMs: 1000,
        deadlineMs: Date.now() + 1000
      } as never
    });
    expect((await forged.startThread({ taskId: "task-1" })).reason).toBe("not_ready");
  });

  it("真实许可到期或超出次数后拒发,且 raw session 没有 request 方法", async () => {
    let now = 1_000;
    const permit = issueExperimentPermit({
      enabled: true,
      model: "named-model",
      effectBoundary: "deny-exec-file-permissions",
      maxTurns: 1,
      wallMs: 1000
    }, now);
    expect(permit.ok).toBe(true);
    if (!permit.ok) return;
    const pair = createPair();
    const dir = mkdtempSync(join(tmpdir(), "saydo-codex-budget-"));
    const session = openRealSession({
      link: pair.link,
      intentLogPath: join(dir, "intent.jsonl"),
      runId: "budget",
      permit: permit.permit,
      now: () => now
    });
    const armed = { ...pair, session };
    await boot(armed);
    await ownThread(armed);
    await activeTurn(armed, "budget-body");
    expect(session.snapshot().realTurnFrames).toBe(1);
    const second = await session.startTurn({ taskId: "task-1", threadId: "th-1", text: "more" });
    expect(second.reason).toBe("turn_busy");
    pair.stdout.write(line({ method: "turn/completed", params: { threadId: "th-1", turn: turnBody("tu-1", "completed") } }));
    const over = await session.startTurn({ taskId: "task-1", threadId: "th-1", text: "more" });
    expect(over.reason).toBe("experiment_budget");
    now = permit.permit.deadlineMs;
    const late = await session.startThread({ taskId: "task-1" });
    expect(late.reason).toBe("experiment_deadline");
    expect("request" in session).toBe(false);
    expect(readFileSync(join(dir, "intent.jsonl"), "utf8")).not.toContain("budget-body");
    await session.shutdown();
  });

  it("外部 thread 不能 read/resume,thread/started 不建立所有权", async () => {
    const pair = openPair();
    await boot(pair);
    pair.stdout.write(line({ method: "thread/started", params: { thread: threadBody("external") } }));
    const read = await pair.session.readThread({ taskId: "task-1", threadId: "external" });
    const resume = await pair.session.resumeThread({ taskId: "task-1", threadId: "external" });
    expect(read.reason).toBe("not_owned");
    expect(resume.reason).toBe("not_owned");
    expect(pair.frames.some((frame) => frame["method"] === "thread/read" || frame["method"] === "thread/resume")).toBe(false);
    expect(pair.session.snapshot().threads).toEqual([]);
  });

  it("UTF-8 碎片里的终态通知仍然生效,畸形帧不算成功", async () => {
    const pair = openPair();
    await boot(pair);
    await ownThread(pair);
    await activeTurn(pair);
    const payload = Buffer.from(`${JSON.stringify({ method: "turn/completed", params: { threadId: "th-1", turn: { ...turnBody("tu-1", "completed"), note: "中文" } } })}\n`);
    const at = payload.indexOf(Buffer.from("中")) + 1;
    pair.stdout.write(payload.subarray(0, at));
    expect(phaseOf(pair)).toBe("active");
    pair.stdout.write(payload.subarray(at));
    expect(phaseOf(pair)).toBe("terminal");
    pair.stdout.write(Buffer.from("{not-json\n"));
    expect(pair.session.diagnostics().protocolErrors).toBeGreaterThan(0);
    expect(phaseOf(pair)).toBe("terminal");
  });

  it("shutdown 清掉计时器,且不杀死未登记的进程", async () => {
    const pair = openPair({ requestTimeoutMs: 10_000 });
    await boot(pair);
    await ownThread(pair);
    const pending = pair.session.startTurn({ taskId: "task-1", threadId: "th-1", text: "x" });
    const sleeper = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], { stdio: "ignore" });
    await pair.session.shutdown();
    const outcome = await pending;
    expect(outcome.status).toBe("unknown");
    expect(pair.session.snapshot().timers).toBe(0);
    expect(pair.session.snapshot().phase).toBe("closed");
    expect(sleeper.pid).toBeTruthy();
    expect(alive(sleeper.pid ?? 0)).toBe(true);
    sleeper.kill("SIGKILL");
  });

  it("生产入口源码不引用这个原型", () => {
    const index = readFileSync(new URL("../../src/index.ts", import.meta.url), "utf8");
    const pkg = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    expect(index.includes("experimental/codex-app-server")).toBe(false);
    expect(pkg.includes("experimental/codex-app-server")).toBe(false);
  });
});

function approvalParams(): Record<string, unknown> {
  return {
    threadId: "th-1",
    turnId: "tu-1",
    itemId: "item-1",
    startedAtMs: 1,
    command: null,
    reason: null,
    cwd: null
  };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
