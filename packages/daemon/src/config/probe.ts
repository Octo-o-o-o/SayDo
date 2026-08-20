// docs/09 §11 校验规则 3:agent_cli 供给探测(只探配置引用的 binary)。
// 逻辑(超时 5s + 失败重试一次;错误分类处方化)是纯逻辑,binary 调用抽象为可注入 Prober(测试用 fake)。
// 真实探测器(spawn codex/claude/cursor)在 1.2b 落地并接线;0.4 只落逻辑与错误分类。

export type ProbeTarget =
  | { provider: "codex_cli" }
  | { provider: "claude_cli" }
  | { provider: "cursor_cli" }
  | { provider: "grok_cli" }
  | { provider: "gemini_cli" }
  | { provider: "qwen_cli" }
  | { provider: "copilot_cli" };

export interface ProbeOutcome {
  ok: boolean;
  /** 分类:logged_in / not_logged_in / keychain_error / not_found / timeout / smoke_failed */
  status: string;
  detail?: string;
}

/** 单次底层探测(注入):真实实现 spawn binary,测试传 fake */
export type ProbeFn = (target: ProbeTarget) => Promise<ProbeOutcome>;

export interface ProbeResult {
  target: ProbeTarget;
  outcome: ProbeOutcome;
  attempts: number;
}

/** 探测一个目标:失败重试一次(09 §11 规则 3:5s + 重试一次) */
export async function probeOnce(fn: ProbeFn, target: ProbeTarget): Promise<ProbeResult> {
  let last: ProbeOutcome = { ok: false, status: "unknown" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    last = await fn(target);
    if (last.ok) return { target, outcome: last, attempts: attempt };
  }
  return { target, outcome: last, attempts: 2 };
}

/** 探测失败 => 处方化报错(结合 provider 给可粘贴修复行) */
export function probeFixHint(target: ProbeTarget, outcome: ProbeOutcome): string {
  const p = target.provider;
  if (outcome.status === "not_found") {
    const bin =
      p === "codex_cli"
        ? "codex"
        : p === "claude_cli"
          ? "claude"
          : p === "grok_cli"
            ? "grok"
            : p === "gemini_cli"
              ? "gemini"
              : p === "qwen_cli"
                ? "qwen"
                : p === "copilot_cli"
                  ? "copilot"
                  : "cursor-agent";
    return `未找到 ${bin};安装后重试,或把该槽位改走 api 直连`;
  }
  if (outcome.status === "not_logged_in") {
    if (p === "codex_cli") return "codex login   # 完成 ChatGPT 登录后重试";
    if (p === "claude_cli") return "claude auth login   # 完成 Claude 登录后重试";
    if (p === "grok_cli") return "grok login   # 完成 Grok 登录后重试";
    if (p === "gemini_cli") return "在终端运行 gemini 完成 Google 登录(0.46 已无 gemini auth 子命令)";
    if (p === "qwen_cli") return "配置 OpenAI 兼容端点或 OPENAI_API_KEY(0.18 已移除 qwen auth)";
    if (p === "copilot_cli") return "copilot login   # 完成 GitHub Copilot 登录后重试";
    return "cursor-agent login   # 完成 Cursor 登录后重试";
  }
  if (outcome.status === "keychain_error") {
    // cursor keychain SecItemCopyMatching -50 分类(复评 B4)
    return "keychain 访问异常(如 SecItemCopyMatching -50):在有 GUI keychain 的会话里重跑 cursor-agent status,或改走 api";
  }
  if (outcome.status === "timeout") {
    return "探测超时(5s);检查网络/登录态后重试,或改走 api 直连";
  }
  if (outcome.status === "smoke_failed") {
    return "真实 -p smoke 未通过;确认订阅额度与登录态,或改走 api 直连";
  }
  return `探测失败(${outcome.status})`;
}
