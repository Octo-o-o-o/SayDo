// cursor stream-json 六类 golden fixtures(复评 A3 验收:读/写/shell/MCP/未知/解析异常)。
// 形态按 07 D8 实测:顶层 type:"tool_call"(started/completed)、type:"assistant"(带 model)、type:"result"。

export const CURSOR_GOLDEN = {
  // 实测(2026-07-24):cursor model 在 system.init 顶层(keys 含 model/apiKeySource/cwd/permissionMode/session_id)
  // 1. 读文件(tool_call)—— 笼内出现即 tripwire 作废
  readFile: [
    JSON.stringify({ type: "system", subtype: "init", model: "claude-fable-5", cwd: "/tmp", permissionMode: "ask" }),
    JSON.stringify({ type: "tool_call", subtype: "Read", tool_call: { name: "Read", args: { path: "a.ts" } } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "读到了" }] } }),
    JSON.stringify({ type: "result", subtype: "success", result: "done" })
  ],
  // 2. 写文件(tool_call)
  writeFile: [
    JSON.stringify({ type: "tool_call", subtype: "Write", tool_call: { name: "Write", args: { path: "b.ts" } } }),
    JSON.stringify({ type: "result", result: "wrote" })
  ],
  // 3. shell 执行(tool_call)
  shell: [
    JSON.stringify({ type: "tool_call", subtype: "Shell", tool_call: { name: "Shell", args: { command: "ls" } } })
  ],
  // 4. MCP 工具(tool_call)
  mcp: [
    JSON.stringify({ type: "tool_call", subtype: "mcp__server__tool", tool_call: { name: "mcp__server__tool" } })
  ],
  // 5. 未知事件类型(fail-closed 作废)
  unknown: [
    JSON.stringify({ type: "system", subtype: "init", model: "claude-fable-5" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }),
    JSON.stringify({ type: "brand_new_event_2027", payload: {} })
  ],
  // 6. 解析异常(半行/坏 JSON,fail-closed 作废)
  parseError: [
    JSON.stringify({ type: "system", subtype: "init", model: "claude-fable-5" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }),
    '{"type":"assistant","message":{'
  ],
  // 干净纯文本(无工具;正例)—— model 在 system.init 顶层(实测形态)
  clean: [
    JSON.stringify({ type: "system", subtype: "init", model: "claude-fable-5", cwd: "/tmp", permissionMode: "ask" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "方案是这样的" }] } }),
    JSON.stringify({ type: "result", subtype: "success", result: "方案是这样的" })
  ],
  // 思考型模型完整一发(2026-08-13 本机三发原始流):system/user/thinking×N/assistant/result
  // thinking 行形态照抄真实样本;text 是内心独白,不得进入正文。
  thinkingStream: [
    JSON.stringify({
      type: "system",
      subtype: "init",
      model: "cursor-grok-4.6-high-fast",
      cwd: "/tmp",
      permissionMode: "ask"
    }),
    JSON.stringify({ type: "user", message: { content: [{ type: "text", text: "hi" }] } }),
    JSON.stringify({
      type: "thinking",
      subtype: "delta",
      text: "先想一下怎么答",
      session_id: "redacted",
      timestamp_ms: 1720000000000
    }),
    JSON.stringify({
      type: "thinking",
      subtype: "delta",
      text: "再补一句独白",
      session_id: "redacted",
      timestamp_ms: 1720000000500
    }),
    JSON.stringify({
      type: "thinking",
      subtype: "completed",
      session_id: "redacted",
      timestamp_ms: 1720000001000
    }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "方案是这样的" }] } }),
    JSON.stringify({ type: "result", subtype: "success", result: "方案是这样的" })
  ]
} as const;

/** 2026-08-13 owner 复测原始流两行(字段形状原样;值已脱敏)。 */
export const CURSOR_THINKING_SAMPLES = [
  JSON.stringify({
    type: "thinking",
    subtype: "delta",
    text: "先想一下怎么答",
    session_id: "redacted",
    timestamp_ms: 1720000000000
  }),
  JSON.stringify({
    type: "thinking",
    subtype: "completed",
    session_id: "redacted",
    timestamp_ms: 1720000001000
  })
] as const;
