// W5.4-b C1:setup 自检 scope=tier1 骨架(方案 §3.9)。
// 检查项(版本比对/auth/hook 链物理自检 jq+curl+socket/identity 写入)全部经注入 probe,
// 单测 fake 全覆盖、零真调 claude(live 走查归 W5.4-c);按生效 adapter 分叉:
// claude_code 检查链 / cursor 投影 tier1StartupVerdict / codex unsupported。

import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseConfigText } from "../src/config/load.js";
import { parseSetupTestRequest, runSetupTest } from "../src/api/setup.js";
import {
  claudeInitProbeArgv,
  claudeInitProbeEnv,
  claudeVersionFirstToken,
  defaultTier1Probes,
  runTier1SelfTest,
  type Tier1SelfTestProbes,
  type Tier1SelfTestReport
} from "../src/tier1/selfTest.js";
import { readClaudeIdentity } from "../src/tier1/claudeIdentity.js";
import { sha256File } from "../src/providers/binaryIdentity.js";
import {
  configureRuntimeChildRegistry,
  resetRuntimeChildLifecycleForTests
} from "../src/runtimeChildRegistry.js";

const NOW = new Date("2026-08-21T08:00:00.000Z");

function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "saydo-t1st-"));
  configureRuntimeChildRegistry(home);
  return home;
}

afterEach(() => {
  try {
    resetRuntimeChildLifecycleForTests();
  } catch {
    // 污染由本测断言覆盖
  }
});

function makeClaudeBin(home: string): string {
  const bin = join(home, "claude.exe");
  writeFileSync(bin, "#!/bin/bash\necho fake claude\n");
  chmodSync(bin, 0o755);
  return bin;
}

const MODELS = `
[models]
dialog = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }
thinking = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }
cheap = { provider = "api", via = "openrouter", model = "google/gemini-3.1-flash-lite" }
evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }
`;

// 路径必须经 JSON.stringify 转义后再插入 TOML：TOML 基本字符串里 `\U`/`\x` 等是转义序列，
// Windows 路径 `C:\Users\...` 会被解析成非法 unicode 转义而整份配置解析失败
// （真机上曾因此让本文件 26/37 例全红）。同目录 startup-failure.test.ts:753 即用此写法。
function claudeCfgToml(bin: string, pinned = "2.1.220"): string {
  return `${MODELS}
[models.dev]
agent = "claude_code"
model = "unused-for-claude"
[tier1]
claude_bin = ${JSON.stringify(bin)}
claude_pinned_version = ${JSON.stringify(pinned)}
model = "opus"
claude_max_turns = 200
`;
}

function fakeProbes(over: Partial<Tier1SelfTestProbes> = {}): Tier1SelfTestProbes {
  return {
    claudeVersion: async () => ({ ok: true, output: "2.1.220 (Claude Code)" }),
    claudeAuthStatus: async () => ({ ok: true, output: '{"loggedIn": true, "authMethod": "claude.ai"}' }),
    claudeInit: async () => ({ ok: true, output: initOutput() }),
    commandAvailable: async () => true,
    socketReachable: async () => true,
    // 评审 91:原生 Windows 上自检走 win32 分支,缺这个 probe 会让「全绿」用例恒红
    gateAssetsPresent: async () => true,
    ...over
  };
}

function initOutput(overrides: Record<string, unknown> = {}): string {
  return [
    {
      type: "system",
      subtype: "init",
      session_id: "00000000-0000-4000-8000-000000000001",
      model: "claude-opus-5",
      tools: [],
      permissionMode: "default",
      apiKeySource: "none",
      claude_code_version: "2.1.220",
      ...overrides
    },
    {
      type: "assistant",
      message: { model: "claude-opus-5", content: [{ type: "text", text: "OK" }] }
    },
    {
      type: "result",
      session_id: "00000000-0000-4000-8000-000000000001",
      subtype: "success",
      is_error: false,
      num_turns: 1,
      stop_reason: "end_turn",
      terminal_reason: "completed",
      permission_denials: [],
      result: "OK"
    }
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
}

function check(report: Tier1SelfTestReport, name: string): { status: string; error?: string } {
  const c = report.checks.find((x) => x.name === name);
  if (!c) throw new Error(`check ${name} missing`);
  return c;
}

describe("claudeVersionFirstToken(合同:claude --version 首 token 比对)", () => {
  it("实测形态与裸串都取首 token", () => {
    expect(claudeVersionFirstToken("2.1.220 (Claude Code)")).toBe("2.1.220");
    expect(claudeVersionFirstToken(" 2.1.220\n")).toBe("2.1.220");
    expect(claudeVersionFirstToken("")).toBe("");
  });
});

describe("claude init 生产探针参数与凭据剥离", () => {
  it("argv 是有界零工具一发一收封闭形状", () => {
    expect(claudeInitProbeArgv("opus")).toEqual([
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      "opus",
      "--permission-mode",
      "default",
      "--tools",
      "",
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--max-turns",
      "1",
      "只回复 OK,不要使用工具。"
    ]);
  });

  it("env 只保留 G4 白名单并强制两项非凭据覆盖", () => {
    const env = claudeInitProbeEnv({
      PATH: "/usr/bin",
      HOME: "/tmp/fake-home",
      SHELL: "/bin/zsh",
      ANTHROPIC_API_KEY: "fixture-secret",
      CLAUDE_CODE_OAUTH_TOKEN: "fixture-token",
      OPENROUTER_API_KEY: "fixture-secret",
      RANDOM_FLAG: "1"
    });
    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/tmp/fake-home",
      SHELL: "/bin/sh",
      DISABLE_AUTOUPDATER: "1"
    });
    expect(Object.keys(env).some((key) => key.includes("KEY") || key.includes("TOKEN"))).toBe(false);
  });

  it.skipIf(process.platform === "win32")("取消 init 探针会回收 CLI 及其后代", async () => {
    const home = makeHome();
    const marker = join(home, "descendant.pid");
    const bin = join(home, "claude-orphan.cjs");
    writeFileSync(
      bin,
      `#!/usr/bin/env node\nconst {spawn}=require("node:child_process"),fs=require("node:fs");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});fs.writeFileSync(${JSON.stringify(marker)},String(child.pid));setInterval(()=>{},1000);\n`
    );
    chmodSync(bin, 0o755);
    const abort = new AbortController();
    const probe = defaultTier1Probes().claudeInit(bin, "opus", abort.signal);
    for (let attempt = 0; attempt < 100 && !existsSync(marker); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(marker)).toBe(true);
    const descendantPid = Number(readFileSync(marker, "utf8"));
    abort.abort();
    await expect(probe).resolves.toMatchObject({ ok: false });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        process.kill(descendantPid, 0);
      } catch {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(() => process.kill(descendantPid, 0)).toThrow();
  });
});

describe("parseSetupTestRequest 接受 scope=tier1(既有 plan/voice 语义不变)", () => {
  it("tier1/voice/缺省三态", () => {
    expect(parseSetupTestRequest({ scope: "tier1" })).toEqual({ scope: "tier1" });
    expect(parseSetupTestRequest({ scope: "voice" })).toEqual({ scope: "voice" });
    expect(parseSetupTestRequest({})).toEqual({ scope: "plan" });
    expect(parseSetupTestRequest({ scope: "bogus" })).toEqual({ scope: "plan" });
    expect(parseSetupTestRequest(null)).toEqual({ scope: "plan" });
  });
});

describe("runTier1SelfTest claude 分支(fake probes,零真调)", () => {
  it("全绿 ⇒ status ok + identity 写入(digest 真算/version 首 token/receipt 存证)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes(),
      now: () => NOW
    });
    expect(report.adapter).toBe("claude_code");
    expect(report.status).toBe("ok");
    expect(report.identityWritten).toBe(true);
    for (const name of ["binary", "version", "auth", "init", "hook_jq", "hook_curl", "hook_socket", "identity"]) {
      expect(check(report, name).status).toBe("ok");
    }
    const rec = readClaudeIdentity(home);
    expect(rec).not.toBeNull();
    expect(rec?.binaryPath).toBe(realpathSync(bin));
    expect(rec?.binaryDigest).toBe(sha256File(bin));
    expect(rec?.version).toBe("2.1.220");
    expect(rec?.testedAt).toBe(NOW.toISOString());
    expect((rec?.receipt as { source?: string }).source).toBe("setup_self_test_tier1");
  });

  it("同一 SAYDO_HOME 的并发自检串行化，两个回执都确定且最终登记可解析", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    let active = 0;
    let maxActive = 0;
    const delayed = async <T>(value: T): Promise<T> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value;
    };
    const probes = fakeProbes({
      claudeVersion: async () => delayed({ ok: true, output: "2.1.220 (Claude Code)" }),
      claudeAuthStatus: async () => delayed({ ok: true, output: '{"loggedIn": true}' }),
      claudeInit: async () => delayed({ ok: true, output: initOutput() })
    });
    const input = {
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes,
      now: () => NOW
    };
    const [first, second] = await Promise.all([runTier1SelfTest(input), runTier1SelfTest(input)]);
    expect([first.status, second.status]).toEqual(["ok", "ok"]);
    expect([first.identityWritten, second.identityWritten]).toEqual([true, true]);
    expect(maxActive).toBe(1);
    expect(readClaudeIdentity(home)?.binaryDigest).toBe(sha256File(bin));
  });

  it.skipIf(process.platform === "win32")("claude_bin 为 symlink 时解析实体再探测并登记", async () => {
    const home = makeHome();
    const target = makeClaudeBin(home);
    const alias = join(home, "claude-current");
    symlinkSync(target, alias, "file");
    const seen = new Set<string>();
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(alias)),
      probes: fakeProbes({
        claudeVersion: async (bin) => {
          seen.add(bin);
          return { ok: true, output: "2.1.220 (Claude Code)" };
        },
        claudeAuthStatus: async (bin) => {
          seen.add(bin);
          return { ok: true, output: '{"loggedIn": true}' };
        },
        claudeInit: async (bin) => {
          seen.add(bin);
          return { ok: true, output: initOutput() };
        }
      }),
      now: () => NOW
    });
    expect(report.status).toBe("ok");
    expect([...seen]).toEqual([realpathSync(target)]);
    expect(readClaudeIdentity(home)?.binaryPath).toBe(realpathSync(target));
  });

  it("版本漂移 ⇒ version fail(重跑门禁仪式处方)+ identity 不写(fail-closed)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin, "2.1.200")),
      probes: fakeProbes(),
      now: () => NOW
    });
    expect(report.status).toBe("fail");
    expect(report.identityWritten).toBe(false);
    expect(check(report, "version").status).toBe("fail");
    expect(check(report, "version").error).toContain("版本漂移");
    expect(check(report, "identity").status).toBe("skipped");
    expect(readClaudeIdentity(home)).toBeNull();
  });

  it("未登录 ⇒ auth fail + /login 处方(其余检查照跑,一次看全)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ claudeAuthStatus: async () => ({ ok: true, output: '{"loggedIn": false}' }) }),
      now: () => NOW
    });
    expect(report.status).toBe("fail");
    expect(check(report, "auth").status).toBe("fail");
    expect(check(report, "auth").error).toContain("/login");
    expect(check(report, "version").status).toBe("ok");
    expect(report.identityWritten).toBe(false);
  });

  it("hook 链物理缺件:jq 缺 / socket 不可达分别 fail(gate 前提如实报)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const noJq = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ commandAvailable: async (cmd) => cmd !== "jq" }),
      now: () => NOW
    });
    expect(check(noJq, "hook_jq").status).toBe("fail");
    expect(check(noJq, "hook_curl").status).toBe("ok");

    const noSock = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ socketReachable: async () => false }),
      now: () => NOW
    });
    expect(check(noSock, "hook_socket").status).toBe("fail");
    expect(check(noSock, "hook_socket").error).toContain("tier1-gate.sock");
    expect(noSock.status).toBe("fail");
    // 评审 90 A-2:identity 只由二进制类检查(binary/version/auth)把门。hook 链是 daemon 自身运行态,
    // 让它把门会死锁——启动资格要 identity、gate 只在启动资格通过后才起、自检又要 gate 可达才写 identity。
    expect(noSock.identityWritten).toBe(true);
    expect(check(noSock, "identity").status).toBe("ok");
  });

  it("hook 链全红也不挡 identity 生成(A-2 首次武装闭环回归锚)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const out = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ commandAvailable: async () => false, socketReachable: async () => false }),
      now: () => NOW
    });
    expect(out.status).toBe("fail");
    expect(out.identityWritten).toBe(true);
    expect(readClaudeIdentity(home)?.binaryPath).toBe(realpathSync(bin));
  });

  it("评审 91 A-2:首份 identity 写出后如实告知需重启才武装", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const out = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes(),
      now: () => NOW
    });
    expect(out.identityWritten).toBe(true);
    expect(out.restartRequiredToArm).toBe(true);
    expect(String(out.prescription)).toContain("restart");

    // 评审 92:第二次跑**仍然**要报——本批拿不到 daemon 运行时武装态,
    // 用「之前有没有登记」推断会在「首次自检后没重启、又跑一次」时错误撤销处方。
    const again = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes(),
      now: () => NOW
    });
    expect(again.identityWritten).toBe(true);
    expect(again.restartRequiredToArm).toBe(true);
  });

  it("二进制类检查红 ⇒ identity 不写(fail-closed 边界不变)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const out = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ claudeAuthStatus: async () => ({ ok: true, output: "Not logged in" }) }),
      now: () => NOW
    });
    expect(check(out, "auth").status).toBe("fail");
    expect(out.identityWritten).toBe(false);
    expect(check(out, "identity").status).toBe("skipped");
  });

  it("claude_bin 未配置 ⇒ binary fail + version/auth skipped(probe 不被调用)", async () => {
    const home = makeHome();
    let probeCalls = 0;
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(`${MODELS}
[models.dev]
agent = "claude_code"
model = "unused"
`),
      probes: fakeProbes({
        claudeVersion: async () => {
          probeCalls += 1;
          return { ok: true, output: "2.1.220" };
        },
        claudeAuthStatus: async () => {
          probeCalls += 1;
          return { ok: true, output: '{"loggedIn": true}' };
        }
      }),
      now: () => NOW
    });
    expect(check(report, "binary").status).toBe("fail");
    expect(check(report, "binary").error).toContain("claude_bin");
    expect(check(report, "version").status).toBe("skipped");
    expect(check(report, "auth").status).toBe("skipped");
    expect(probeCalls).toBe(0);
    expect(report.identityWritten).toBe(false);
  });

  it("pinned 未配置 ⇒ version fail 且处方回显实测版本(不编数)", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(`${MODELS}
[models.dev]
agent = "claude_code"
model = "unused"
[tier1]
claude_bin = ${JSON.stringify(bin)}
model = "opus"
`),
      probes: fakeProbes(),
      now: () => NOW
    });
    expect(check(report, "version").status).toBe("fail");
    expect(check(report, "version").error).toContain("claude_pinned_version");
    expect(check(report, "version").error).toContain("2.1.220");
  });

  it("probe 命令自身失败(claude --version 起不来)⇒ version fail 透传错误", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ claudeVersion: async () => ({ ok: false, error: "spawn ENOENT" }) }),
      now: () => NOW
    });
    expect(check(report, "version").status).toBe("fail");
    expect(check(report, "version").error).toContain("ENOENT");
  });

  it.each([
    ["缺 system/init", JSON.stringify({ type: "result", subtype: "success" }), "system/init"],
    ["API key 来源", initOutput({ apiKeySource: "ANTHROPIC_API_KEY" }), "API key"],
    ["init 版本漂移", initOutput({ claude_code_version: "2.1.219" }), "pinned"],
    ["模型异族", initOutput({ model: "gpt-5.6-sol" }), "Claude 族"],
    ["工具面非空", initOutput({ tools: ["Read"] }), "零工具面"],
    ["权限模式缺失", initOutput({ permissionMode: undefined }), "default"]
  ])("init 物理断言 fail-closed:%s", async (_name, output, errorPart) => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ claudeInit: async () => ({ ok: true, output }) }),
      now: () => NOW
    });
    expect(report.status).toBe("fail");
    expect(check(report, "init").status).toBe("fail");
    expect(check(report, "init").error).toContain(errorPart);
    expect(report.identityWritten).toBe(false);
    expect(readClaudeIdentity(home)).toBeNull();
  });

  it.each([
    ["未知前导事件", `not-json\n${initOutput()}`, "未知或损坏"],
    ["只有 init 的截断流", initOutput().split("\n")[0]!, "result 终态"],
    [
      "成功 result 后追加第二个 init",
      [initOutput(), initOutput({ apiKeySource: "ANTHROPIC_API_KEY" }).split("\n")[0]!].join("\n"),
      "只能包含一个"
    ],
    [
      "成功 result 后追加 assistant 事件",
      [
        initOutput(),
        JSON.stringify({
          type: "assistant",
          message: { model: "claude-opus-5", content: [{ type: "text", text: "trailing" }] }
        })
      ].join("\n"),
      "事件流末尾"
    ],
    [
      "result 与 init session 不一致",
      initOutput().replace(
        '"session_id":"00000000-0000-4000-8000-000000000001","subtype":"success"',
        '"session_id":"00000000-0000-4000-8000-000000000002","subtype":"success"'
      ),
      "同 session"
    ],
    [
      "夹带工具调用",
      [
        initOutput().split("\n")[0]!,
        JSON.stringify({
          type: "assistant",
          message: { model: "claude-opus-5", content: [{ type: "tool_use", id: "tool_1", name: "Read" }] }
        }),
        initOutput().split("\n")[2]!
      ].join("\n"),
      "工具调用"
    ],
    [
      "成功终态不是一回合 OK",
      initOutput().replace('"num_turns":1', '"num_turns":2').replace('"result":"OK"', '"result":"not ok"'),
      "result 终态"
    ]
  ])("init 完整一发一收 fail-closed:%s", async (_name, output, errorPart) => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(claudeCfgToml(bin)),
      probes: fakeProbes({ claudeInit: async () => ({ ok: true, output }) }),
      now: () => NOW
    });
    expect(check(report, "init").status).toBe("fail");
    expect(check(report, "init").error).toContain(errorPart);
    expect(report.identityWritten).toBe(false);
  });

  it.each(["claude init 探针超时;请重试", "claude init 探针非零退出;请重试"])(
    "init probe 进程失败不写 identity:%s",
    async (error) => {
      const home = makeHome();
      const bin = makeClaudeBin(home);
      const report = await runTier1SelfTest({
        saydoHome: home,
        cfg: parseConfigText(claudeCfgToml(bin)),
        probes: fakeProbes({ claudeInit: async () => ({ ok: false, error }) }),
        now: () => NOW
      });
      expect(check(report, "init").error).toBe(error);
      expect(report.identityWritten).toBe(false);
    }
  );
});

describe("runTier1SelfTest 非 claude 分支(按生效 adapter 分叉)", () => {
  it("cursor 生效 ⇒ 投影 tier1StartupVerdict(未配 ⇒ fail + cursor 处方;不碰 claude probe)", async () => {
    const home = makeHome();
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(MODELS),
      probes: fakeProbes({
        claudeVersion: async () => {
          throw new Error("cursor 分支不得调 claude probe");
        },
        claudeInit: async () => {
          throw new Error("cursor 分支不得调 claude init probe");
        }
      }),
      now: () => NOW
    });
    expect(report.adapter).toBe("cursor");
    expect(report.status).toBe("fail");
    expect(check(report, "binary").error).toContain("cursor_agent_bin");
    expect(report.identityWritten).toBe(false);
  });

  it("codex 生效 ⇒ unsupported(不编检查结果)", async () => {
    const home = makeHome();
    const report = await runTier1SelfTest({
      saydoHome: home,
      cfg: parseConfigText(`${MODELS}
[models.dev]
agent = "codex"
model = "gpt-5.6-sol"
`),
      probes: fakeProbes(),
      now: () => NOW
    });
    expect(report.adapter).toBe("codex");
    expect(report.status).toBe("unsupported");
    expect(report.identityWritten).toBe(false);
  });

  it("cfg 不可读(null)⇒ 按缺省 cursor 分叉 fail(fail-closed 不猜)", async () => {
    const home = makeHome();
    const report = await runTier1SelfTest({ saydoHome: home, cfg: null, probes: fakeProbes(), now: () => NOW });
    expect(report.adapter).toBe("cursor");
    expect(report.status).toBe("fail");
  });
});

describe("runSetupTest scope=tier1 集成(端点分支;四槽/voice 不跑)", () => {
  it("claude 生效全绿:返回 tier1 报告 + slots 空(早退不触发四槽 self-test)+ identity 落盘", async () => {
    const home = makeHome();
    const bin = makeClaudeBin(home);
    writeFileSync(join(home, "config.toml"), claudeCfgToml(bin));
    const out = await runSetupTest({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      scope: "tier1",
      tier1Probes: fakeProbes(),
      now: () => NOW
    });
    expect(out.configSource).toBe("active");
    expect(out.slots).toEqual({});
    expect(out.tier1?.status).toBe("ok");
    expect(out.tier1?.identityWritten).toBe(true);
    expect(readClaudeIdentity(home)?.binaryPath).toBe(realpathSync(bin));
  });

  it("cursor 生效(缺省):tier1 报告走 cursor 投影,不要求 claude probe", async () => {
    const home = makeHome();
    writeFileSync(join(home, "config.toml"), MODELS);
    const out = await runSetupTest({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      scope: "tier1",
      tier1Probes: fakeProbes(),
      now: () => NOW
    });
    expect(out.tier1?.adapter).toBe("cursor");
    expect(out.tier1?.status).toBe("fail");
    expect(out.tier1?.identityWritten).toBe(false);
  });
});
