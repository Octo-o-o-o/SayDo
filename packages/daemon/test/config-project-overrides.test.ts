// W5a 3.5 验收锚:项目级模型/预算覆盖(02 §5.1;daemon 受控表 v7,绝不落 project.toml)。
// - 覆盖解析单元锚:dialog/thinking/dev/budget 的 项目 > 全局 解析;
// - 同族覆盖被拒反例:覆盖后的组合违反 evaluator 异族护栏 ⇒ 拒写(护栏不得在设置里悄悄失效);
// - 迁移幂等:v7 建表 + 二次 openDb 不炸(v4-era 老库回归在 storage-migration-v5.test.ts);
// - 执行器消费:project_settings 的 dev.model 覆盖 spawn 模型 + observedModel 族校验同源;
// - cache_write_input_tokens 列位(09 §9 注清偿):上游回带才落 meta,不编数。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import {
  validateProjectOverrides,
  getProjectOverrides,
  upsertProjectOverrides,
  effectiveModelBinding,
  effectiveDevModel,
  effectiveDevModelForAdapter,
  effectiveBudget,
  validateStoredProjectOverrides,
  clearInvalidStoredProjectOverrides,
  type ProjectOverrides
} from "../src/config/projectOverrides.js";
import { recordLlmUsage } from "../src/cost/ledger.js";
import type { SaydoConfig } from "../src/config/types.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const NOW = "2026-07-27T12:00:00.000Z";
const PRJ = "prj_01OVERRIDE000000000000000A";

/** 最小全局配置:dialog/thinking = gemini(经网关),evaluator = claude API(异族成立) */
const GLOBAL = {
  models: {
    profile: "default",
    dialog: { provider: "api", via: "openrouter", model: "google/gemini-2.5-flash" },
    thinking: { provider: "api", via: "openrouter", model: "google/gemini-2.5-pro" },
    cheap: { provider: "api", via: "openrouter", model: "google/gemini-2.5-flash" },
    evaluator: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-5" }
  },
  providers: { api: { openrouter: { base_url: "https://openrouter.ai/api/v1", api_key: "env:OPENROUTER_API_KEY" } } },
  privacy: { store_audio: false, store_transcript: true, audio_retention_days: 0 }
} as unknown as SaydoConfig;

let db: Db;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-ov-")), "saydo.db"));
  insertProject(db, {
    id: PRJ,
    title: "覆盖项目",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: NOW,
    updatedAt: NOW
  });
});

describe("覆盖解析单元锚(项目 > 全局;02 §5.1 解析顺序)", () => {
  const ov: ProjectOverrides = {
    models: {
      dialog: { provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" },
      dev: { agent: "cursor", model: "gpt-5.6-sol" }
    },
    budget: { maxCost: 35, maxTurns: 120 }
  };

  it("dialog/thinking:有覆盖取覆盖,无覆盖回全局;dev/budget 同构(缺省键回落)", () => {
    const d = effectiveModelBinding(GLOBAL, ov, "dialog");
    expect(d.source).toBe("project");
    expect((d.binding as { model: string }).model).toBe("deepseek/deepseek-chat");
    const t = effectiveModelBinding(GLOBAL, ov, "thinking");
    expect(t.source).toBe("global"); // thinking 未覆盖
    expect(effectiveModelBinding(GLOBAL, null, "dialog").source).toBe("global");

    expect(effectiveDevModel("fable-5-max", ov)).toEqual({ model: "gpt-5.6-sol", source: "project" });
    expect(effectiveDevModel("fable-5-max", null)).toEqual({ model: "fable-5-max", source: "global" });

    const b = effectiveBudget({ maxCost: 20, walltimeActiveMin: 45, maxTurns: 80 }, ov);
    expect(b).toEqual({ maxCost: 35, walltimeActiveMin: 45, maxTurns: 120, source: "project" }); // 缺省键回落
  });

  it("DAO 往返 + 覆盖变更可再存(upsert);损坏行按无覆盖", () => {
    expect(getProjectOverrides(db, PRJ)).toBeNull();
    upsertProjectOverrides(db, PRJ, ov, NOW);
    expect(getProjectOverrides(db, PRJ)?.budget?.maxCost).toBe(35);
    upsertProjectOverrides(db, PRJ, { budget: { maxCost: 10 } }, NOW);
    expect(getProjectOverrides(db, PRJ)?.budget?.maxCost).toBe(10);
    db.prepare("UPDATE project_settings SET overrides_json='not-json' WHERE project_id=?").run(PRJ);
    expect(getProjectOverrides(db, PRJ)).toBeNull();
  });
});

describe("同族覆盖被拒反例(02 §5.1 护栏:evaluator 异族对覆盖后组合同样跑)", () => {
  it("覆盖 dialog 成 claude 族(与 evaluator API 同族)⇒ 拒;覆盖成 deepseek ⇒ 过", () => {
    const bad = validateProjectOverrides(GLOBAL, {
      models: { dialog: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-4.5" } }
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.violations.some((v) => v.code === "evaluator_same_family")).toBe(true);
    }
    const good = validateProjectOverrides(GLOBAL, {
      models: { dialog: { provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" } }
    });
    expect(good.ok).toBe(true);
  });

  it("覆盖 thinking 成 claude 族同拒(两槽任一同族即违规)", () => {
    const bad = validateProjectOverrides(GLOBAL, {
      models: { thinking: { provider: "api", via: "openrouter", model: "anthropic/claude-opus-4.6" } }
    });
    expect(bad.ok).toBe(false);
  });

  it("project thinking CLI 恒拒,不允许借全局 runtime 登记生效", () => {
    const result = validateProjectOverrides(GLOBAL, {
      models: { thinking: { provider: "cursor_cli", model: "mystery-unwired-model" } }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations.map((v) => v.code)).toContain("project_override_cli_rejected");
  });

  it("全局 evaluator 改型后重验存量 project override,且不消费全局 same-family ack", () => {
    upsertProjectOverrides(
      db,
      PRJ,
      { models: { thinking: { provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" } } },
      NOW
    );
    const changed = {
      ...GLOBAL,
      models: {
        ...GLOBAL.models,
        dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
        thinking: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-terra-pro" },
        evaluator: { provider: "api", via: "openrouter", model: "deepseek/deepseek-r1" },
        evaluator_same_family_ack: true
      }
    } as unknown as SaydoConfig;

    expect(validateStoredProjectOverrides(db, changed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "project_override_evaluator_same_family" })])
    );
    expect(clearInvalidStoredProjectOverrides(db, changed, [PRJ])).toEqual([PRJ]);
    expect(validateStoredProjectOverrides(db, changed)).toEqual([]);
    expect(getProjectOverrides(db, PRJ)).toBeNull();
  });

  it("纯 budget 覆盖继承已双 ack 的全局 CLI 组合,不误判为项目新造同族", () => {
    const globallyAcked = {
      ...GLOBAL,
      models: {
        ...GLOBAL.models,
        dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
        thinking: { provider: "codex_cli", model: "gpt-5.6-terra" },
        evaluator: { provider: "codex_cli", model: "gpt-5.6-sol" },
        evaluator_same_family_ack: true,
        evaluator_isolation_ack: true
      }
    } as unknown as SaydoConfig;
    expect(validateProjectOverrides(globallyAcked, { budget: { maxCost: 10 } })).toMatchObject({ ok: true });
  });

  it("冗余同族模型覆盖不算新造冲突,继承已经确认的全局组合", () => {
    const globallyAcked = {
      ...GLOBAL,
      models: {
        ...GLOBAL.models,
        dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
        thinking: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-terra" },
        evaluator: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-sol" },
        evaluator_same_family_ack: true
      }
    } as unknown as SaydoConfig;
    expect(
      validateProjectOverrides(globallyAcked, {
        models: { thinking: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-terra-pro" } }
      })
    ).toMatchObject({ ok: true });
  });

  it("损坏 JSON 也可由显式 recovery 动作定点清除,不锁死全局改配", () => {
    upsertProjectOverrides(db, PRJ, { budget: { maxCost: 10 } }, NOW);
    db.prepare("UPDATE project_settings SET overrides_json='not-json' WHERE project_id=?").run(PRJ);
    expect(validateStoredProjectOverrides(db, GLOBAL)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "project_override_invalid" })])
    );
    expect(clearInvalidStoredProjectOverrides(db, GLOBAL, [PRJ])).toEqual([PRJ]);
    expect(validateStoredProjectOverrides(db, GLOBAL)).toEqual([]);
  });

  it("dialog 覆盖非 api 供给拒(09 §11 规则 1 对项目覆盖同样成立);schema 外键拒;dev.agent 放开 claude_code,codex 仍拒", () => {
    const byoa = validateProjectOverrides(GLOBAL, { models: { dialog: { provider: "codex_cli" } } });
    expect(byoa.ok).toBe(false);
    if (!byoa.ok) expect(byoa.violations.some((v) => v.code === "project_override_cli_rejected")).toBe(true);
    expect(validateProjectOverrides(GLOBAL, { evil: true }).ok).toBe(false);
    expect(validateProjectOverrides(GLOBAL, { models: { dev: { agent: "claude_code", model: "x" } } }).ok).toBe(true);
    expect(validateProjectOverrides(GLOBAL, { models: { dev: { agent: "codex", model: "x" } } }).ok).toBe(false);
    expect(validateProjectOverrides(GLOBAL, { models: { evaluator: { provider: "api", model: "gpt-5" } } }).ok).toBe(false); // evaluator 不可覆盖(schema 无此键)
  });
});

describe("effectiveDevModelForAdapter(W5.4-b C1;09 §11:dev.agent !== 生效 adapter ⇒ 忽略 + 审计素材)", () => {
  it("正例:override agent 与生效 adapter 匹配 ⇒ 应用 override model(cursor 现状语义不变)", () => {
    const ov: ProjectOverrides = { models: { dev: { agent: "cursor", model: "gpt-5.6-sol" } } };
    expect(effectiveDevModelForAdapter("fable-5-max", ov, "cursor")).toEqual({
      model: "gpt-5.6-sol",
      source: "project"
    });
  });

  it("反例:override agent 与生效 adapter 不匹配 ⇒ 忽略回全局 + ignored 携带双方词值(消费方据此审计 tier1.model_override_ignored_adapter_mismatch)", () => {
    const ov: ProjectOverrides = { models: { dev: { agent: "cursor", model: "gpt-5.6-sol" } } };
    expect(effectiveDevModelForAdapter("opus", ov, "claude_code")).toEqual({
      model: "opus",
      source: "global",
      ignored: { overrideAgent: "cursor", effectiveAdapter: "claude_code" }
    });
    const claudeOv: ProjectOverrides = { models: { dev: { agent: "claude_code", model: "opus" } } };
    expect(effectiveDevModelForAdapter("gpt-5.6-sol", claudeOv, "cursor")).toEqual({
      model: "gpt-5.6-sol",
      source: "global",
      ignored: { overrideAgent: "claude_code", effectiveAdapter: "cursor" }
    });
  });

  it("无 dev override ⇒ 回全局且无 ignored(不误报审计)", () => {
    expect(effectiveDevModelForAdapter("fable-5-max", null, "cursor")).toEqual({
      model: "fable-5-max",
      source: "global"
    });
    expect(effectiveDevModelForAdapter("opus", { budget: { maxCost: 5 } }, "claude_code")).toEqual({
      model: "opus",
      source: "global"
    });
  });

  it("匹配语义与既有 effectiveDevModel 在 cursor 匹配面等价(回归锚:C2 换接线不改行为)", () => {
    const ov: ProjectOverrides = { models: { dev: { agent: "cursor", model: "gpt-5.6-sol" } } };
    const legacy = effectiveDevModel("fable-5-max", ov);
    const next = effectiveDevModelForAdapter("fable-5-max", ov, "cursor");
    expect({ model: next.model, source: next.source }).toEqual(legacy);
  });
});

describe("迁移幂等(v7 受控表;铁律:改 DDL_V1 必配迁移)", () => {
  it("新库 openDb 即有 project_settings;重复 openDb 不炸不重放", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-ov-mig-"));
    const p = join(dir, "saydo.db");
    const d1 = openDb(p);
    expect(d1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_settings'").get()).toBeTruthy();
    d1.close();
    const d2 = openDb(p);
    expect((d2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=7").get() as { c: number }).c).toBe(1);
    d2.close();
  });
});

describe("cache_write_input_tokens 列位(09 §9 注清偿;additive meta 键)", () => {
  it("上游回带 ⇒ meta 含 cache_write_input_tokens;不回带 ⇒ 键缺席(不编 0)", () => {
    recordLlmUsage(
      db,
      "dialog",
      { model: "m1", promptTokens: 100, completionTokens: 20, cachedPromptTokens: 40, cacheWriteInputTokens: 60 },
      { projectId: PRJ },
      () => new Date(NOW)
    );
    recordLlmUsage(db, "dialog", { model: "m1", promptTokens: 50, completionTokens: 10 }, { projectId: PRJ }, () => new Date(NOW));
    const rows = db.prepare("SELECT meta_json FROM cost_entries ORDER BY rowid").all() as { meta_json: string }[];
    const m1 = JSON.parse((rows[0] as { meta_json: string }).meta_json) as Record<string, unknown>;
    const m2 = JSON.parse((rows[1] as { meta_json: string }).meta_json) as Record<string, unknown>;
    expect(m1["cache_write_input_tokens"]).toBe(60);
    expect(m1["cached_input_tokens"]).toBe(40);
    expect(m2["cache_write_input_tokens"]).toBeUndefined();
  });
});
