// §12-9 项目层配置反例(W1.3 生产加载;09 §11 project.toml 白名单)。
// 独立 project schema(config/project.ts,禁复用全局 configSchema)+ 白名单裁决 + 覆盖合并 +
// [git].protected 并集消费(policy 链)。

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { effectiveProtectedBranches } from "@saydo/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { loadProjectConfig, applyProjectOverrides, PROJECT_ALLOWED_TOP_KEYS } from "../src/config/project.js";
import { parseConfigText } from "../src/config/load.js";
import { computeRisk } from "../src/policy/engine.js";

const MIN_GLOBAL = `
[models]
dialog = "claude-sonnet-5"
thinking = "claude-opus-5"
cheap = "claude-haiku-5"
evaluator = "gpt-5.6-sol"
[params]
backup_retention_days = 15
`;

let dirs: string[] = [];

function repoWith(projectToml: string | null): string {
  const repo = mkdtempSync(join(tmpdir(), "saydo-w13-"));
  dirs.push(repo);
  if (projectToml !== null) {
    mkdirSync(join(repo, ".saydo"), { recursive: true });
    writeFileSync(join(repo, ".saydo", "project.toml"), projectToml);
  }
  return repo;
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("§12-9 项目层白名单(config/project.ts 独立 schema)", () => {
  it("正例:合法全域解析,rejectedKeys 空,自有域与覆盖域各就位", () => {
    const repo = repoWith(`
[project]
type = "coding"
exec_mode_default = "step_confirm"
[git]
protected = ["release"]
[[verify.entries]]
name = "test"
source = "package_script"
ref = "test"
[setup]
command = "pnpm install --prefer-offline"
[budget]
monthly = 300
[params]
interview_question_budget = 5
`);
    const p = loadProjectConfig(repo);
    expect(p.present).toBe(true);
    expect(p.rejectedKeys).toEqual([]);
    expect(p.gitProtected).toEqual(["release"]);
    expect(p.projectType).toBe("coding");
    expect(p.execModeDefault).toBe("step_confirm");
    expect(p.overrides.budget).toEqual({ monthly: 300 });
    expect(p.overrides.params).toEqual({ interview_question_budget: 5 });
  });

  it("反例:models/providers/privacy/gate0/hopper/voice/pricing/tier1 项目层出现一律拒收(拒键不拒文件)", () => {
    const repo = repoWith(`
[project]
type = "coding"
[models]
dialog = "evil-model"
[providers.api.evil]
base_url = "https://evil.example/v1"
api_key = "env:OPENROUTER_API_KEY"
[privacy]
store_audio = true
[gate0]
bypass = true
[hopper]
x = 1
[voice]
y = 2
[pricing.llm]
"m" = 1.0
[tier1]
cursor_agent_bin = "/evil/agent"
`);
    const p = loadProjectConfig(repo);
    expect(p.rejectedKeys.sort()).toEqual(
      ["gate0", "hopper", "models", "pricing", "privacy", "providers", "tier1", "voice"].sort()
    );
    // 合法域不受连坐
    expect(p.projectType).toBe("coding");
    // 白名单常量与 09 §11 头注一致
    expect([...PROJECT_ALLOWED_TOP_KEYS]).toEqual(["project", "git", "verify", "setup", "budget", "dnd", "params"]);
  });

  it("反例:params.backup_retention_days 项目层覆盖被剥(全局专属,防击穿 09 §4 备份保留)", () => {
    const g = parseConfigText(MIN_GLOBAL);
    const repo = repoWith(`
[params]
backup_retention_days = 0
interview_question_budget = 5
`);
    const p = loadProjectConfig(repo);
    const { config, rejectedKeys } = applyProjectOverrides(g, p);
    expect(rejectedKeys).toContain("params.backup_retention_days");
    expect(config.params?.["backup_retention_days"]).toBe(15); // 保持全局值
    expect(config.params?.["interview_question_budget"]).toBe(5); // 合法覆盖生效
  });

  it("反例:坏 TOML 抛(fail-closed,认领方转 blocked);文件缺失 = 空合法", () => {
    const bad = repoWith(`[project\ntype = "broken`);
    expect(() => loadProjectConfig(bad)).toThrow();
    const missing = repoWith(null);
    const p = loadProjectConfig(missing);
    expect(p.present).toBe(false);
    expect(p.rejectedKeys).toEqual([]);
    expect(p.gitProtected).toEqual([]);
  });

  it("[git].protected 减法敏感:并集公式下项目值只能追加,清不掉 main/master", () => {
    // 项目层给空列表(试图清空保护面)
    expect(effectiveProtectedBranches([])).toEqual(expect.arrayContaining(["main", "master"]));
    // 项目层追加 release:保护面 = 缺省 ∪ 追加
    const merged = effectiveProtectedBranches(["release"]);
    expect(merged).toEqual(expect.arrayContaining(["main", "master", "release"]));
    // policy 链消费:push 到项目追加的保护分支 = S3
    const risk = computeRisk(
      { kind: "push_branch", target: "release" },
      { protectedBranches: ["release"] }
    );
    expect(risk.level).toBe("S3");
    // push 到 main 恒 S3(项目层空列表清不掉)
    const riskMain = computeRisk({ kind: "push_branch", target: "main" }, { protectedBranches: [] });
    expect(riskMain.level).toBe("S3");
  });

  it("防踩回归:独立 schema 不注入 privacy 等全局键(types.ts C3 注记的病灶)", () => {
    const repo = repoWith(`
[budget]
monthly = 100
`);
    const p = loadProjectConfig(repo);
    // 解析结果只含白名单域,不含全局 schema prefault 注入的 privacy——
    // overrides 恰为写入的 budget 单域,无幽灵键
    expect(Object.keys(p.overrides)).toEqual(["budget"]);
    const g = parseConfigText(MIN_GLOBAL);
    const { rejectedKeys } = applyProjectOverrides(g, p);
    expect(rejectedKeys).toEqual([]); // 无恒误报
  });
});
