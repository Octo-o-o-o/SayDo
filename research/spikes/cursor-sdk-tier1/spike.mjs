// Spike 8(07 D8/§10):@cursor/sdk 能否承载 SayDo Tier 1 执行器
// 运行:cd research/spikes/cursor-sdk-tier1 && npm i && CURSOR_API_KEY=cursor_xxx node spike.mjs
// key 获取:cursor.com/dashboard → Integrations → 新建 user API key(1 分钟)
//
// 三问(07 D8 spike 8):
//   T1 无头连通:Agent.create(local)+ send + stream + wait 是否可用、首响/整轮延迟量级
//   T2 hooks 阻塞审批(canUseTool 等价物):worktree 的 .cursor/hooks.json 在 SDK 无头下
//      是否触发 beforeShellExecution、能否阻塞等外部决策、deny 是否真挡住命令
//   T3 崩溃恢复:Agent.resume(agentId) 跨进程续会话
//   (计费口径:跑完后人工看 cursor.com/dashboard 用量页,确认这几次调用计入订阅还是按量)
//
// 判定(写回 07 D8):T1+T2 全过 ⇒ dev 机 Tier 1 = cursor_sdk 适配可行;T2 不过 ⇒ 维持 Claude SDK 绑定。

import { Agent, CursorAgentError } from "@cursor/sdk";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MODEL = process.env.SPIKE_MODEL || "claude-fable-5-thinking-max"; // dev 机 Cursor 优先缺省(07 D18)
const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) { console.error("缺 CURSOR_API_KEY(cursor.com/dashboard → Integrations)"); process.exit(1); }

const t = (ms) => `${(ms / 1000).toFixed(1)}s`;
const results = [];
function record(name, pass, detail) { results.push({ name, pass, detail }); console.log(`\n[${pass ? "PASS" : "FAIL"}] ${name} — ${detail}\n`); }

// ---- 搭一个模拟 worktree:.cursor/hooks.json + 阻塞式审批钩子 ----
const wt = mkdtempSync(join(tmpdir(), "saydo-spike-wt-"));
mkdirSync(join(wt, ".cursor", "hooks"), { recursive: true });
const FIRED = join(wt, "hook-fired.json");     // 钩子触发证据
const DECISION = join(wt, "approval-decision"); // 模拟 daemon 决策信箱:钩子轮询此文件(allow/deny)
writeFileSync(join(wt, ".cursor", "hooks.json"), JSON.stringify({
  version: 1,
  hooks: { beforeShellExecution: [{ command: ".cursor/hooks/approval-gate.sh", failClosed: true, timeout: 120 }] },
}, null, 2));
writeFileSync(join(wt, ".cursor", "hooks", "approval-gate.sh"), `#!/bin/bash
# SayDo 审批门原型:记录触发 → 阻塞等决策文件(模拟 daemon 等用户批准)→ 返回 permission
input=$(cat)
echo "{\\"ts\\":\\"$(date +%s)\\",\\"input\\":$input}" > "${FIRED}"
for i in $(seq 1 100); do
  if [ -f "${DECISION}" ]; then
    d=$(cat "${DECISION}")
    if [ "$d" = "allow" ]; then echo '{"permission":"allow"}'; else echo '{"permission":"deny","agent_message":"SayDo approval gate denied this command (spike)."}'; fi
    exit 0
  fi
  sleep 0.2
done
echo '{"permission":"deny","agent_message":"approval timeout (spike)"}'
exit 0
`);
chmodSync(join(wt, ".cursor", "hooks", "approval-gate.sh"), 0o755);
writeFileSync(join(wt, "README.md"), "spike worktree\n");
console.log("worktree:", wt);

let agentId = null;
try {
  // ---- T1 无头连通 + 延迟 ----
  {
    const t0 = Date.now();
    const agent = await Agent.create({ apiKey, model: { id: MODEL }, local: { cwd: wt } });
    try {
    agentId = agent.agentId;
    const run = await agent.send("只回一个词:通了。不要使用任何工具。");
    let firstEvent = null, text = "";
    for await (const ev of run.stream()) {
      if (!firstEvent) firstEvent = Date.now();
      if (ev.type === "assistant") for (const b of ev.message.content) if (b.type === "text") text += b.text;
    }
    const r = await run.wait();
    record("T1 无头连通", r.status === "finished" && text.length > 0,
      `status=${r.status} text=${JSON.stringify(text.slice(0, 40))} 首事件=${t(firstEvent - t0)} 整轮=${t(Date.now() - t0)} agentId=${agentId}`);

    // ---- T2a hooks 触发 + 阻塞(先不给决策,验证真的在等)----
    rmSync(FIRED, { force: true }); rmSync(DECISION, { force: true });
    const t2 = Date.now();
    const run2 = await agent.send('用 shell 执行:echo saydo-hook-test。执行后告诉我输出。');
    let sawFired = false, blockedMs = 0;
    const approver = (async () => {
      // 模拟 daemon:看到钩子触发后压 3 秒再批,验证执行被真实阻塞
      for (let i = 0; i < 300; i++) {
        if (existsSync(FIRED)) { sawFired = true; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (sawFired) { await new Promise((r) => setTimeout(r, 3000)); blockedMs = 3000; writeFileSync(DECISION, "allow"); }
    })();
    const r2 = await run2.wait(); await approver;
    const firedInfo = existsSync(FIRED) ? readFileSync(FIRED, "utf8").slice(0, 120) : "(未触发)";
    record("T2a hooks 触发+阻塞放行", sawFired && r2.status === "finished",
      `hook 触发=${sawFired} 人为压 ${t(blockedMs)} 后 allow;run=${r2.status};fired=${firedInfo};整轮=${t(Date.now() - t2)}`);

    // ---- T2b deny 真挡住 ----
    rmSync(FIRED, { force: true }); writeFileSync(DECISION, "deny");
    const run3 = await agent.send('用 shell 执行:touch should-not-exist.txt。');
    const r3 = await run3.wait();
    const denied = !existsSync(join(wt, "should-not-exist.txt"));
    record("T2b deny 挡住副作用", denied, `文件未产生=${denied} run=${r3.status}(deny 后 agent 应报告被拒)`);
    } finally { await agent[Symbol.asyncDispose]?.() ?? agent.close?.(); }
  }

  // ---- T3 跨进程 resume(agent 已 dispose,重新拿)----
  {
    const t0 = Date.now();
    const agent2 = await Agent.resume(agentId, { apiKey });
    try {
    writeFileSync(DECISION, "allow");
    const run = await agent2.send("我们上一轮 shell 测试 echo 的字符串是什么?只回该字符串。");
    let text = "";
    for await (const ev of run.stream()) { if (ev.type === "assistant") for (const b of ev.message.content) if (b.type === "text") text += b.text; }
    const r = await run.wait();
    record("T3 跨进程 resume", r.status === "finished" && /saydo-hook-test/.test(text),
      `status=${r.status} 记得上下文=${/saydo-hook-test/.test(text)} text=${JSON.stringify(text.slice(0, 60))} 耗时=${t(Date.now() - t0)}`);
    } finally { await agent2[Symbol.asyncDispose]?.() ?? agent2.close?.(); }
  }
} catch (err) {
  if (err instanceof CursorAgentError) record("启动失败(CursorAgentError)", false, `${err.message} retryable=${err.isRetryable}`);
  else record("异常", false, String(err?.stack || err));
}

console.log("\n===== 结果汇总 =====");
for (const r of results) console.log(`${r.pass ? "[ok]" : "[fail]"} ${r.name}: ${r.detail}`);
console.log(`\nworktree 留存(人工检查 hooks 证据):${wt}`);
console.log("别忘了:去 cursor.com/dashboard 用量页确认这几次调用的计费口径(T3 问题③)。");
process.exit(results.every((r) => r.pass) ? 0 : 2);
