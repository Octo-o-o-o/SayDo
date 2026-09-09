// CLI 能力探测契约测试:模型枚举解析 / 登录态分类(含 claude JSON 形态) /
// 不可枚举家族禁造假候选 / 未登录不空转列模型。
// 全部走注入 exec,不 spawn 真 binary。

import { beforeEach, describe, expect, it } from "vitest";
import {
  CLAUDE_ALIAS_CANDIDATES,
  classifyAuthOutput,
  clearProbeCliCapabilityCache,
  discoverUsedModels,
  mergeModelOptions,
  parseCodexConfigModels,
  parseCursorModels,
  inferCostProvenance,
  parseGrokModels,
  parseOpencodeModels,
  parseReprobeNames,
  probeAllCliCapabilities,
  probeCliCapability,
  reprobeCliCapabilities,
  PROBE_CLI_NAMES,
  PROBE_TIMEOUT_NOTE,
  REPROBE_CLI_BUDGET_MS,
  type ExecFn
} from "../src/config/cliCapability.js";

/** cursor-agent --list-models 真实输出片段(2026-08-10 本机实测) */
const CURSOR_LIST_SAMPLE = `Available models

auto - Auto (default)
gpt-5.3-codex-low - Codex 5.3 Low
gpt-5.3-codex - Codex 5.3
claude-opus-5-thinking-high - Opus 5 1M Thinking
claude-fable-5-thinking-high - Fable 5 1M Thinking (NO ZDR)
`;

function execStub(map: Record<string, { stdout?: string; stderr?: string; throws?: boolean }>): ExecFn {
  return async (file, args) => {
    const key = `${file.split("/").pop()} ${args.join(" ")}`.trim();
    const hit = map[key];
    if (!hit) throw new Error(`unexpected exec: ${key}`);
    if (hit.throws) {
      const err = new Error(`exit 1: ${key}`) as Error & { stdout?: string; stderr?: string };
      err.stdout = hit.stdout ?? "";
      err.stderr = hit.stderr ?? "";
      throw err;
    }
    return { stdout: hit.stdout ?? "", stderr: hit.stderr ?? "" };
  };
}

beforeEach(() => {
  clearProbeCliCapabilityCache();
});

describe("parseCursorModels", () => {
  it("解析 '<id> - <显示名>' 并跳过标题/空行", () => {
    const models = parseCursorModels(CURSOR_LIST_SAMPLE);
    expect(models.map((m) => m.id)).toEqual([
      "auto",
      "gpt-5.3-codex-low",
      "gpt-5.3-codex",
      "claude-opus-5-thinking-high",
      "claude-fable-5-thinking-high"
    ]);
    // "Available models" 含空格,必须被当标题过滤掉
    expect(models.some((m) => m.id.includes(" "))).toBe(false);
    expect(models[0]?.label).toBe("Auto (default)");
  });

  it("空输出 ⇒ 空列表(不造条目)", () => {
    expect(parseCursorModels("")).toEqual([]);
    expect(parseCursorModels("Available models\n\n")).toEqual([]);
  });

  it("同 id 去重", () => {
    expect(parseCursorModels("a - X\na - Y\n").length).toBe(1);
  });
});

describe("classifyAuthOutput", () => {
  it("claude JSON 形态(驼峰 loggedIn)认得出", () => {
    // 实测:claude auth status 回 JSON,不是人话句子
    expect(classifyAuthOutput('{"loggedIn": true, "authMethod": "claude.ai"}')).toBe("logged_in");
    expect(classifyAuthOutput('{"loggedIn": false}')).toBe("not_logged_in");
  });

  it("codex / cursor 文本形态", () => {
    expect(classifyAuthOutput("Logged in using ChatGPT")).toBe("logged_in");
    // cursor-agent 实际带勾号前缀(源码用转义写,避开 emoji 门禁;运行时仍是真字符)
    expect(classifyAuthOutput("\u2713 Logged in as someone@example.com")).toBe("logged_in");
    expect(classifyAuthOutput("Not logged in. Run codex login")).toBe("not_logged_in");
  });

  it("含糊输出 ⇒ unknown,不伪造 logged_in", () => {
    expect(classifyAuthOutput("")).toBe("unknown");
    expect(classifyAuthOutput("some unrelated banner")).toBe("unknown");
  });

  it("grok models 登录句式", () => {
    expect(classifyAuthOutput("You are logged in with grok.com.")).toBe("logged_in");
  });
});

describe("parseGrokModels", () => {
  const sample = `You are logged in with grok.com.

Default model: grok-4.5

Available models:
  * grok-4.5 (default)
  * grok-4
`;

  it("解析 * 列表与 default 标记,并读出登录态", () => {
    const parsed = parseGrokModels(sample);
    expect(parsed.authHint).toBe("logged_in");
    expect(parsed.defaultModel).toBe("grok-4.5");
    expect(parsed.models.map((m) => m.id)).toEqual(["grok-4.5", "grok-4"]);
    expect(parsed.models[0]?.label).toBe("default");
  });

  it("无列表仅有 Default model 时降级为单候选", () => {
    const parsed = parseGrokModels("You are logged in with grok.com.\nDefault model: grok-4.5\n");
    expect(parsed.models).toEqual([{ id: "grok-4.5", label: "default", source: "listed" }]);
  });
});

describe("probeCliCapability", () => {
  it("未安装 ⇒ not_found + 改走 API 的处方,不谎报可用", async () => {
    const cap = await probeCliCapability("codex", {
      whichFn: async () => ({})
    });
    expect(cap.found).toBe(false);
    expect(cap.auth.status).toBe("not_found");
    expect(cap.models).toEqual([]);
    // GAP-02 2.9:capability 带笼分档单源(未安装也声明档位;不是 conformance 结果)
    expect(cap.cage).toEqual({ level: "write-sandbox", enforcement: "full" });
    expect(cap.auth.fixHint).toContain("API");
  });

  it("绝对可执行路径可固化内容 digest,相对路径不由默认实现伪造", async () => {
    const cap = await probeCliCapability("codex", {
      whichFn: async () => ({ path: "/opt/bin/codex" }),
      exec: execStub({ "codex login status": { stdout: "Logged in using ChatGPT" } }),
      digestFn: async (path) => (path === "/opt/bin/codex" ? "a".repeat(64) : undefined),
      discover: { listFiles: async () => [] }
    });
    expect(cap).toMatchObject({ path: "/opt/bin/codex", binaryDigest: "a".repeat(64) });
  });

  it("cursor 已登录 ⇒ 真枚举模型", async () => {
    const cap = await probeCliCapability("cursor-agent", {
      whichFn: async () => ({ path: "/bin/cursor-agent", version: "2026.07.23" }),
      exec: execStub({
        "cursor-agent status": { stdout: "\u2713 Logged in as a@b.com" },
        "cursor-agent --list-models": { stdout: CURSOR_LIST_SAMPLE }
      })
    });
    expect(cap.auth.status).toBe("logged_in");
    expect(cap.enumerable).toBe(true);
    expect(cap.models.length).toBe(5);
    expect(cap.provider).toBe("cursor_cli");
    expect(cap.cage).toEqual({ level: "ask+tripwire", enforcement: "partial" });
  });

  it("cursor 未登录 ⇒ 丢弃并行发出的模型列表,只提示登录", async () => {
    // status 与 --list-models 并行发起(省 1.5s);未登录时即便列表回来了也不能用,必须丢弃
    const cap = await probeCliCapability("cursor-agent", {
      whichFn: async () => ({ path: "/bin/cursor-agent" }),
      exec: execStub({
        "cursor-agent status": { stdout: "Not logged in", throws: true },
        "cursor-agent --list-models": { stdout: CURSOR_LIST_SAMPLE }
      })
    });
    expect(cap.auth.status).toBe("not_logged_in");
    expect(cap.auth.fixHint).toBe("cursor-agent login");
    expect(cap.models).toEqual([]);
    expect(cap.note).toContain("登录");
  });

  // 下面两条必须注入空的 discover:否则会去读跑测试这台机器上真实的 ~/.codex / ~/.claude 记录,
  // 结果随环境漂移(2026-08-10 就是这么被抓到的)。
  const noHistory = {
    listFiles: async () => [] as string[],
    readHead: async () => {
      throw new Error("ENOENT");
    }
  };

  it("codex 不可枚举且无本机记录 ⇒ 空列表 + 人话说明(禁造假候选)", async () => {
    const cap = await probeCliCapability("codex", {
      whichFn: async () => ({ path: "/bin/codex" }),
      exec: execStub({ "codex login status": { stdout: "Logged in using ChatGPT" } }),
      discover: noHistory
    });
    expect(cap.enumerable).toBe(false);
    expect(cap.models).toEqual([]);
    expect(cap.note).toContain("手填");
    expect(cap.provider).toBe("codex_cli");
  });

  it("claude 不可枚举且无本机记录 ⇒ 只给 --help 实证的两个别名", async () => {
    const cap = await probeCliCapability("claude", {
      whichFn: async () => ({ path: "/bin/claude" }),
      exec: execStub({ "claude auth status": { stdout: '{"loggedIn":true}' } }),
      discover: noHistory
    });
    expect(cap.auth.status).toBe("logged_in");
    expect(cap.enumerable).toBe(false);
    expect(cap.models).toEqual(CLAUDE_ALIAS_CANDIDATES);
    expect(cap.models.map((m) => m.id)).toEqual(["sonnet", "opus"]);
  });

  it("grok 已登录 ⇒ 枚举模型且 provider=grok_cli(已接线)", async () => {
    const cap = await probeCliCapability("grok", {
      whichFn: async () => ({ path: "/opt/homebrew/bin/grok", version: "grok 1.0.3" }),
      exec: execStub({
        "grok --version": { stdout: "grok 1.0.3 (1a29d5bc12d4)" },
        "grok --help": { stdout: "Grok Build TUI" },
        "grok -h": { stdout: "Grok Build TUI" },
        "grok models": {
          stdout: `You are logged in with grok.com.

Default model: grok-4.5

Available models:
  * grok-4.5 (default)
`
        }
      })
    });
    expect(cap.found).toBe(true);
    expect(cap.provider).toBe("grok_cli");
    expect(cap.auth.status).toBe("logged_in");
    expect(cap.enumerable).toBe(true);
    expect(cap.models.map((m) => m.id)).toEqual(["grok-4.5"]);
    expect(cap.note ?? "").not.toMatch(/尚未接入/);
  });

  it("kimi 未安装 ⇒ not_found,不谎报可用", async () => {
    const cap = await probeCliCapability("kimi", {
      whichFn: async () => ({})
    });
    expect(cap.found).toBe(false);
    expect(cap.provider).toBeNull();
    expect(cap.auth.status).toBe("not_found");
  });

  it("gemini 已接线,kimi/opencode 保持 inventory_only", async () => {
    const gemini = await probeCliCapability("gemini", {
      whichFn: async () => ({ path: "/opt/homebrew/bin/gemini", version: "0.46.0" }),
      exec: execStub({
        "gemini --version": { stdout: "0.46.0" },
        "gemini --help": { stdout: "Gemini CLI" },
        "gemini -h": { stdout: "Gemini CLI" }
      }),
      discover: { homeDir: "/no/such/home" }
    });
    expect(gemini.provider).toBe("gemini_cli");
    expect(gemini.auth.fixHint ?? "").not.toMatch(/gemini auth login/);

    const kimi = await probeCliCapability("kimi", {
      whichFn: async () => ({ path: "/bin/kimi", version: "0.34.0" }),
      exec: execStub({
        "kimi --version": { stdout: "0.34.0" },
        "kimi --help": { stdout: "kimi-code" },
        "kimi -h": { stdout: "kimi-code" },
        "kimi provider list": { stdout: "No providers configured." }
      })
    });
    expect(kimi.provider).toBeNull();
    expect(kimi.note ?? "").toMatch(/尚未接入/);
  });

  it("inferCostProvenance 三值", () => {
    expect(inferCostProvenance("gemini", "logged_in", { selectedType: "oauth-personal" }).provenance).toBe(
      "subscription"
    );
    expect(inferCostProvenance("qwen", "logged_in", { selectedType: "openai" }).provenance).toBe("external_api");
    expect(inferCostProvenance("copilot", "unknown", {}).provenance).toBe("unknown");
  });

  it("parseOpencodeModels 只收 provider/model 单 token", () => {
    expect(parseOpencodeModels("opencode/big-pickle\nanthropic/claude-sonnet-4\nbad line here\n").map((m) => m.id)).toEqual(
      ["opencode/big-pickle", "anthropic/claude-sonnet-4"]
    );
  });

  it("pi 同名二进制缺指纹 ⇒ 不算命中", async () => {
    const cap = await probeCliCapability("pi", {
      whichFn: async () => ({ path: "/usr/bin/pi", version: "pi 3.14" }),
      exec: execStub({
        "pi --version": { stdout: "pi 3.14 calculator" },
        "pi --help": { stdout: "usage: pi <expression>" },
        "pi -h": { stdout: "usage: pi <expression>" }
      })
    });
    expect(cap.found).toBe(false);
    expect(cap.auth.status).toBe("not_found");
  });

  it("probeAll 覆盖目录内全部名字", async () => {
    const all = await probeAllCliCapabilities({
      whichFn: async () => ({}),
      exec: execStub({})
    });
    expect(all.map((c) => c.name).sort()).toEqual([...PROBE_CLI_NAMES].sort());
  });

  it("parseReprobeNames 只认目录内名字,去重保序", () => {
    expect(parseReprobeNames(["codex", "claude", "codex"])).toEqual({ ok: true, names: ["codex", "claude"] });
    expect(parseReprobeNames([])).toEqual({ ok: true, names: [] });
    expect(parseReprobeNames("codex").ok).toBe(false);
    expect(parseReprobeNames(["not-a-cli"]).ok).toBe(false);
  });

  it("reprobe 绕缓存并写回,不走 confirm 真调用", async () => {
    let whichCalls = 0;
    const first = await probeCliCapability("codex", {
      whichFn: async () => {
        whichCalls += 1;
        return { path: "/bin/codex" };
      },
      exec: execStub({ "codex login status": { stdout: "Logged in using ChatGPT" } }),
      discover: { listFiles: async () => [] as string[], readHead: async () => { throw new Error("ENOENT"); } }
    });
    expect(first.auth.status).toBe("logged_in");
    expect(whichCalls).toBe(1);
    const fresh = await reprobeCliCapabilities(["codex"], {
      whichFn: async () => {
        whichCalls += 1;
        return { path: "/bin/codex" };
      },
      exec: execStub({ "codex login status": { stdout: "Not logged in" } }),
      discover: { listFiles: async () => [] as string[], readHead: async () => { throw new Error("ENOENT"); } },
      probeTimeoutMs: REPROBE_CLI_BUDGET_MS
    });
    expect(fresh[0]?.auth.status).toBe("not_logged_in");
    expect(whichCalls).toBe(2);
    const after = await probeCliCapability("codex", {
      whichFn: async () => {
        whichCalls += 1;
        return { path: "/bin/codex" };
      },
      exec: execStub({})
    });
    expect(after.auth.status).toBe("not_logged_in");
    expect(whichCalls).toBe(2);
  });

  it("探测超时如实降级:auth 标 unknown + 超时 note,不假装 logged_in", async () => {
    const cap = await probeCliCapability("codex", {
      whichFn: async () => ({ path: "/bin/codex" }),
      probeTimeoutMs: 40,
      exec: async () => {
        await new Promise(() => undefined);
        return { stdout: "Logged in using ChatGPT", stderr: "" };
      },
      discover: {
        listFiles: async () => [] as string[],
        readHead: async () => {
          throw new Error("ENOENT");
        }
      }
    });
    expect(cap.found).toBe(true);
    expect(cap.auth.status).toBe("unknown");
    expect(cap.note).toContain(PROBE_TIMEOUT_NOTE);
    expect(cap.models).toEqual([]);
  });

  it("缓存命中不再调子进程(fake 计数)", async () => {
    let execCalls = 0;
    let whichCalls = 0;
    const deps = {
      whichFn: async () => {
        whichCalls += 1;
        return { path: "/bin/codex" };
      },
      exec: async () => {
        execCalls += 1;
        return { stdout: "Logged in using ChatGPT", stderr: "" };
      },
      discover: {
        listFiles: async () => [] as string[],
        readHead: async () => {
          throw new Error("ENOENT");
        }
      },
      statFn: async () => ({ mtimeMs: 1_700_000_000_000 })
    };
    const first = await probeCliCapability("codex", deps);
    const second = await probeCliCapability("codex", deps);
    expect(first.auth.status).toBe("logged_in");
    expect(second).toEqual(first);
    expect(execCalls).toBe(1);
    expect(whichCalls).toBe(1);
  });
});

// ---- 已知模型发现(codex/claude 无列模型接口时的真实数据源) ----

describe("discoverUsedModels(从会话记录抓真用过的模型)", () => {
  const fakeFs = (files: Record<string, string>) => ({
    listFiles: async () => Object.keys(files),
    readHead: async (p: string) => files[p] ?? ""
  });

  it("统计 model / model_slug 出现次数,按次数降序", async () => {
    const caps = await discoverUsedModels("/sessions", {
      ...fakeFs({
        "/a.jsonl": '{"model":"claude-opus-5"}\n{"model":"claude-opus-5"}\n{"model_slug":"sonnet"}',
        "/b.jsonl": '{"model":"claude-opus-5"}'
      })
    });
    expect(caps).toEqual([
      { id: "claude-opus-5", seen: 3 },
      { id: "sonnet", seen: 1 }
    ]);
  });

  it("过滤占位/非法值(claude 会写 <synthetic>)", async () => {
    const caps = await discoverUsedModels("/s", {
      ...fakeFs({ "/a.jsonl": '{"model":"<synthetic>"}{"model":"unknown"}{"model":"ok-model"}' })
    });
    expect(caps.map((c) => c.id)).toEqual(["ok-model"]);
  });

  it("目录读不到 ⇒ 空数组,不抛(首启不能因为没历史就崩)", async () => {
    const caps = await discoverUsedModels("/nope", {
      listFiles: async () => {
        throw new Error("ENOENT");
      }
    });
    expect(caps).toEqual([]);
  });

  it("单个文件读失败不影响其余(并行读要各自兜底)", async () => {
    const caps = await discoverUsedModels("/s", {
      listFiles: async () => ["/bad.jsonl", "/good.jsonl"],
      readHead: async (p: string) => {
        if (p === "/bad.jsonl") throw new Error("EACCES");
        return '{"model":"gpt-5.5"}';
      }
    });
    expect(caps).toEqual([{ id: "gpt-5.5", seen: 1 }]);
  });
});

describe("parseCodexConfigModels", () => {
  it("取顶层 model,不把 model_reasoning_effort / model_provider 当模型名", () => {
    const r = parseCodexConfigModels(`
model = "gpt-5.6-sol"
model_reasoning_effort = "xhigh"
model_provider = "sub2api"

[tui.model_availability_nux]
"gpt-5.5" = 3
"gpt-5.6-sol" = 1
`);
    expect(r.configured).toBe("gpt-5.6-sol");
    expect(r.seen).toEqual(["gpt-5.5", "gpt-5.6-sol"]);
  });

  it("没有相关段落 ⇒ 空结果", () => {
    const r = parseCodexConfigModels("[unrelated]\nfoo = 1\n");
    expect(r.configured).toBeUndefined();
    expect(r.seen).toEqual([]);
  });
});

describe("mergeModelOptions:同名保留最强来源,顺序 listed>used>configured>alias", () => {
  it("used 覆盖 alias,并保住次数", () => {
    const merged = mergeModelOptions([
      [{ id: "opus", source: "used", seen: 9 }],
      [{ id: "opus", source: "alias", label: "最新 Opus" }],
      [{ id: "gpt-5.5", source: "configured" }]
    ]);
    expect(merged[0]).toMatchObject({ id: "opus", source: "used", seen: 9 });
    expect(merged.map((m) => m.id)).toEqual(["opus", "gpt-5.5"]);
  });

  it("同来源按 seen 降序", () => {
    const merged = mergeModelOptions([
      [
        { id: "a", source: "used", seen: 2 },
        { id: "b", source: "used", seen: 10 }
      ]
    ]);
    expect(merged.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("codex/claude 候选装配(禁编造)", () => {
  it("claude:用过的排在官方别名前,并标 source", async () => {
    const cap = await probeCliCapability("claude", {
      whichFn: async () => ({ path: "/bin/claude" }),
      exec: execStub({ "claude auth status": { stdout: '{"loggedIn":true}' } }),
      discover: {
        listFiles: async () => ["/x.jsonl"],
        readHead: async () => '{"model":"claude-opus-4-8"}{"model":"claude-opus-4-8"}'
      }
    });
    expect(cap.models[0]).toMatchObject({ id: "claude-opus-4-8", source: "used", seen: 2 });
    expect(cap.models.some((m) => m.id === "sonnet" && m.source === "alias")).toBe(true);
    // 不是全集这件事必须写在 note 里
    expect(cap.note).toContain("不是全集");
  });

  it("没有任何本机记录 ⇒ codex 候选为空,绝不拿别家模型名充数", async () => {
    const cap = await probeCliCapability("codex", {
      whichFn: async () => ({ path: "/bin/codex" }),
      exec: execStub({ "codex login status": { stdout: "Logged in using ChatGPT" } }),
      discover: {
        listFiles: async () => [],
        readHead: async () => {
          throw new Error("ENOENT");
        }
      }
    });
    expect(cap.models).toEqual([]);
    expect(cap.note).toContain("手填");
  });
});
