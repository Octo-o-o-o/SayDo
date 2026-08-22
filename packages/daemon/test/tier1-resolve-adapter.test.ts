// W5.4-b C1:resolveTier1Adapter 单源 resolver + F-14 adapter 切换 reap 判定。
// D2:[models.dev].agent 是唯一后端选择键,缺省 cursor(与既有 readDevAdapter 缺省语义恒等,
// 产品缺省切 claude 归 W5.4-c 模板);F-14:row.adapter !== 生效 adapter ⇒ inconsistent 口径 reap,
// 不跨后端接续(executor recover 接线归 C2)。

import { describe, expect, it } from "vitest";
import { parseConfigText } from "../src/config/load.js";
import { checkRunAdapterConsistency, resolveTier1Adapter } from "../src/tier1/resolveAdapter.js";
import type { SaydoConfig } from "../src/config/types.js";

const BASE_TOML = `
[models]
dialog = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }
thinking = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }
cheap = { provider = "api", via = "openrouter", model = "google/gemini-3.1-flash-lite" }
evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }
`;

describe("resolveTier1Adapter(D2:唯一选择键 [models.dev].agent,缺省 cursor)", () => {
  it("cfg 缺 / dev 段缺 ⇒ cursor(缺省不随 C1 变,回归锚)", () => {
    expect(resolveTier1Adapter(null)).toBe("cursor");
    expect(resolveTier1Adapter(undefined)).toBe("cursor");
    expect(resolveTier1Adapter(parseConfigText(BASE_TOML))).toBe("cursor");
  });

  it("dev.agent 三词表逐值返回(cursor/claude_code/codex)", () => {
    for (const agent of ["cursor", "claude_code", "codex"] as const) {
      const cfg = parseConfigText(`${BASE_TOML}
[models.dev]
agent = "${agent}"
model = "m"
`);
      expect(resolveTier1Adapter(cfg)).toBe(agent);
    }
  });

  it("[tier1] 段不参与选择(不新增 [tier1].agent;四键在场也不改判)", () => {
    const cfg = parseConfigText(`${BASE_TOML}
[tier1]
claude_bin = "/opt/claude.exe"
claude_pinned_version = "2.1.220"
model = "opus"
claude_max_turns = 200
`);
    expect(resolveTier1Adapter(cfg)).toBe("cursor");
  });

  it("形状健壮:dev 存在但 agent 缺失时回 cursor(zod 层通常已拒,resolver 自身兜底)", () => {
    const cfg = { models: { dev: {} } } as unknown as SaydoConfig;
    expect(resolveTier1Adapter(cfg)).toBe("cursor");
  });
});

describe("checkRunAdapterConsistency(F-14 adapter 切换 reap 判定;executor 接线归 C2)", () => {
  it("row.adapter === 生效 adapter ⇒ consistent(cursor/claude_code 双向)", () => {
    expect(checkRunAdapterConsistency("cursor", "cursor")).toEqual({ consistent: true });
    expect(checkRunAdapterConsistency("claude_code", "claude_code")).toEqual({ consistent: true });
  });

  it("row.adapter !== 生效 adapter ⇒ inconsistent 并带双方词值(审计素材)", () => {
    expect(checkRunAdapterConsistency("cursor", "claude_code")).toEqual({
      consistent: false,
      rowAdapter: "cursor",
      effectiveAdapter: "claude_code"
    });
    expect(checkRunAdapterConsistency("claude_code", "cursor")).toEqual({
      consistent: false,
      rowAdapter: "claude_code",
      effectiveAdapter: "cursor"
    });
    expect(checkRunAdapterConsistency("codex", "cursor")).toEqual({
      consistent: false,
      rowAdapter: "codex",
      effectiveAdapter: "cursor"
    });
  });
});
