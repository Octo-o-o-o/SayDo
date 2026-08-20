// docs/09 §11 规则 4:纯推理笼 argv 构造(buildCageArgv,配置面无解笼开关)。
// 安全等级(07 D18 纪律 1 分档表 + 2026-08-12 grok 实测):
//   claude/grok = tool-deny 可证零工具
//   codex = write-sandbox 限写不限读
//   cursor = ask+tripwire 检测型(最弱)
// §12-9 对参数集合做快照断言。

export type CageProvider =
  | "codex_cli"
  | "claude_cli"
  | "cursor_cli"
  | "grok_cli"
  | "gemini_cli"
  | "qwen_cli"
  | "copilot_cli";
export type CodexReasoning = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface CageInput {
  provider: CageProvider;
  /** 会话专用空目录(cwd);奠基只读例外时传只读仓路径 */
  cwd: string;
  model?: string | undefined;
  reasoning?: CodexReasoning | undefined; // 仅 codex
  outputSchemaFile?: string | undefined; // codex 结构化输出约束文件
  outputSchemaJson?: string | undefined; // claude/grok --json-schema 接受内联 JSON,不是文件路径
  /** grok:prompt 经临时文件(--prompt-file),不经 argv 防超长;由 provider 写盘并清理 */
  promptFile?: string | undefined;
  /** cliCapability 固化的绝对路径;省略仅供探测/测试兼容,不可用于 familyFixed 豁免。 */
  binaryPath?: string | undefined;
  /** 奠基/调研只读例外(07 D18 唯一例外):claude 侧放开 Read,Glob,Grep;codex/cursor 用只读仓 cwd */
  readonlyFoundation?: boolean;
  /** gemini:隔离 HOME 内 admin deny-all policy 路径 */
  policyFile?: string | undefined;
  /** qwen:非交互必须显式 auth-type(0.18 已移除 auth 子命令) */
  authType?: string | undefined;
}

export interface CageArgv {
  bin: string;
  args: string[];
  cwd: string;
}

/** 一发一收 CLI 的笼 argv(canonical:09 §11 规则 4;prompt 走 stdin,不进 argv) */
export function buildCageArgv(input: CageInput): CageArgv {
  switch (input.provider) {
    case "codex_cli": {
      const args = [
        "exec",
        "--json",
        "--ignore-user-config",
        "--ignore-rules",
        "-s",
        "read-only",
        "--ephemeral",
        "--skip-git-repo-check",
        "-c",
        "tools.web_search=false"
      ];
      if (input.reasoning) args.push("-c", `model_reasoning_effort=${input.reasoning}`); // 复评 B9 映射
      args.push("-C", input.cwd);
      if (input.model) args.push("-m", input.model);
      if (input.outputSchemaFile) args.push("--output-schema", input.outputSchemaFile);
      return { bin: input.binaryPath ?? "codex", args, cwd: input.cwd };
    }
    case "claude_cli": {
      // tool-deny:allow 式全禁;奠基只读例外放开 Read,Glob,Grep(07 D18 唯一例外)
      const tools = input.readonlyFoundation ? "Read,Glob,Grep" : "";
      const args = [
        "-p",
        "--output-format",
        input.outputSchemaJson ? "json" : "stream-json",
        ...(input.outputSchemaJson ? [] : ["--verbose"]),
        "--safe-mode",
        "--tools",
        tools,
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--permission-mode",
        "dontAsk",
        "--no-session-persistence"
      ];
      if (input.model) args.push("--model", input.model);
      if (input.outputSchemaJson) args.push("--json-schema", input.outputSchemaJson);
      return { bin: input.binaryPath ?? "claude", args, cwd: input.cwd };
    }
    case "cursor_cli": {
      // ask+tripwire:无可证零工具旗标,笼等级最弱(评估档产品缺省禁用之由来)
      // 禁止加 -f/--force/--yolo:那是放行命令(--force 的 alias 即 --yolo),会把笼从 ask+tripwire 升成可执行。
      // P6b(2026-08-13 实测):登录凭据不在可拷贝文件(cli-config.json 仅 authInfo 展示字段),
      // 真实鉴权走 Keychain(status/whoami/-p 均 SecItemCopyMatching -50,本会话无法读出可注入物)。
      // 拷贝 cli-config 到空 HOME 不能自证登录态保持,故 requiresIsolatedHome 不加 cursor。
      // 暴露面=真实 HOME + CURSOR_AGENT_STORE_* + ~/.cursor 全局配置/插件/MCP/hooks(tripwire 事后性无法撤回)。
      const args = ["-p", "--output-format", "stream-json", "--mode", "ask", "--trust"];
      if (input.model) args.push("--model", input.model);
      return { bin: input.binaryPath ?? "cursor-agent", args, cwd: input.cwd };
    }
    case "grok_cli": {
      // tool-deny:--tools "" 可证零工具(2026-08-12 空目录实测无 tool_call)
      // prompt 走 --prompt-file(不经 argv);runner 仍可写空 stdin,grok 忽略
      if (!input.promptFile) {
        throw new Error("grok_cli 笼要求 promptFile");
      }
      const args = [
        "--prompt-file",
        input.promptFile,
        "--output-format",
        "streaming-json",
        "--permission-mode",
        "dontAsk",
        "--tools",
        "",
        "--disable-web-search",
        "--no-subagents",
        "--no-plan",
        "--max-turns",
        "1"
      ];
      if (input.model) args.push("-m", input.model);
      if (input.outputSchemaJson) args.push("--json-schema", input.outputSchemaJson);
      return { bin: input.binaryPath ?? "grok", args, cwd: input.cwd };
    }
    case "gemini_cli": {
      // policy deny + plan + 禁扩展/MCP;plan 单独不是 tool-deny
      // -p "" + stdin 正文(help:prompt 会 append stdin,避免长 prompt 进 argv)
      if (!input.policyFile) {
        throw new Error("gemini_cli 笼要求 policyFile");
      }
      const args = [
        "--output-format",
        "stream-json",
        "--approval-mode",
        "plan",
        "--admin-policy",
        input.policyFile,
        "--skip-trust"
      ];
      if (input.model) args.push("-m", input.model);
      args.push("-p", "");
      return { bin: input.binaryPath ?? "gemini", args, cwd: input.cwd };
    }
    case "qwen_cli": {
      // maxToolCalls=0 主控 + excludeTools + bare + plan;-p "" + stdin
      const args = [
        "--bare",
        "--approval-mode",
        "plan",
        "--max-tool-calls",
        "0",
        "--output-format",
        "stream-json"
      ];
      if (input.authType) args.push("--auth-type", input.authType);
      for (const tool of [
        "run_shell_command",
        "write_file",
        "read_file",
        "list_directory",
        "glob",
        "grep_search",
        "search_file_content",
        "replace",
        "web_fetch",
        "web_search",
        "save_memory"
      ]) {
        args.push("--exclude-tools", tool);
      }
      if (input.model) args.push("-m", input.model);
      args.push("-p", "");
      return { bin: input.binaryPath ?? "qwen", args, cwd: input.cwd };
    }
    case "copilot_cli": {
      // 非交互要求 --allow-all-tools;真正阻断靠空 available-tools 白名单
      const args = [
        "--output-format",
        "json",
        "--allow-all-tools",
        "--available-tools",
        "--disable-builtin-mcps",
        "--no-custom-instructions",
        "--disallow-temp-dir"
      ];
      if (input.model) args.push("--model", input.model);
      args.push("-p", "");
      return { bin: input.binaryPath ?? "copilot", args, cwd: input.cwd };
    }
  }
}

/** codex reasoning 词表(服务端校验;非法值 400,启动前校验用) */
export const CODEX_REASONING_VALUES: readonly CodexReasoning[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
