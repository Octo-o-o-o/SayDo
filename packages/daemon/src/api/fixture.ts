// 控制台冒烟 fixture(5.1/5.2 Playwright 用;POST /dev/seed-fixture,身份门内,库空才种)。
// 覆盖 11 §2.6 主要呈现态:ready_for_review/running/blocked/parked/task_done/failed +
// 审批三态 + 回叫 + 成本(known/unknown/订阅)+ 记忆 trust 层 + 产物。
// W5a 3.6:产物改产真实文件(真 digest + supersedes 链)——控制面 diff/导出用例要读真内容。

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computePackageDigest, textDigest, type DecisionPackage } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { insertPackage } from "../storage/dao/packages.js";
import { managedProjectPath } from "../projects/workspace.js";

const T0 = "2026-07-25T02:00:00.000Z";

export const FIXTURE_ARTIFACT_V1 = ["# 报表导出方案", "", "- 格式:CSV", "- 编码:UTF-8", "- 入口:工具栏按钮"].join("\n");
export const FIXTURE_ARTIFACT_V2 = ["# 报表导出方案", "", "- 格式:CSV", "- 编码:UTF-8 带 BOM(Excel 兼容)", "- 入口:工具栏按钮", "- 大表分页导出"].join("\n");

export function seedConsoleFixture(db: Db, opts: { artifactsDir?: string } = {}): { seeded: boolean; reason?: string } {
  const existing = (db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number }).c;
  if (existing > 0) return { seeded: false, reason: "projects not empty (fixture only seeds empty db)" };

  const tx = db.transaction(() => {
    // 项目
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES ('prj_01F1XT0RE0A000000000000000', '报表系统', 'coding', 'active', ?, 'stepwise', '${T0}', '${T0}'),
              ('prj_01F1XT0RE0B000000000000000', '语音助手自举', 'pending', 'draft', ?, 'stepwise', '${T0}', '${T0}')`
    ).run(
      JSON.stringify({
        kind: "local_folder",
        path: managedProjectPath("prj_01F1XT0RE0A000000000000000"),
        managed: true
      }),
      JSON.stringify({
        kind: "local_folder",
        path: managedProjectPath("prj_01F1XT0RE0B000000000000000"),
        managed: true
      })
    );

    // 决策包(严格 canonical 正文 + 真 digest；任务详情与 review approve 共用同一 durable 事实)
    const packageUnsigned = {
      id: "pkg_01F1XT0RE0A000000000000000",
      revision: 1,
      projectId: "prj_01F1XT0RE0A000000000000000",
      outcomePreview: "报表页支持导出 CSV",
      inScope: ["导出"],
      outOfScope: ["认证", "依赖升级"],
      assumptions: [],
      acceptance: ["导出按钮出现在报表页工具栏", "导出的 CSV 与页面数据一致(含表头)", "verify: pnpm test 全绿"],
      plan: [{ seq: 1, step: "实现并验证 CSV 导出", owner: "ai" as const }],
      cost: { expected: { known: false as const }, p95: { known: false as const }, max: 20, currency: "CNY" as const },
      risks: [],
      mode: "step_confirm" as const,
      preauthorizedEffects: [],
      effectPolicyVersion: "e2/0.1.0"
    };
    const fixturePackage: DecisionPackage = {
      ...packageUnsigned,
      digest: computePackageDigest(packageUnsigned),
      status: "approved",
      createdAt: T0
    };
    insertPackage(db, fixturePackage);

    // 任务(六态覆盖;tier1 必带 adapter,route=hopper 恒 NULL adapter)
    const budget = '{"walltimeActiveMin":45,"maxTurns":80,"maxCost":20}';
    const tasks: [string, string, string][] = [
      ["tsk_01F1XT0RE0TSKRDY0000000000", "报表导出 CSV", "ready_for_review"],
      ["tsk_01F1XT0RE0TSKRVN0000000000", "分页性能优化", "running"],
      ["tsk_01F1XT0RE0TSKB1K0000000000", "接入企业微信通知", "blocked"],
      ["tsk_01F1XT0RE0TSKD0N0000000000", "修复日期时区显示", "task_done"],
      ["tsk_01F1XT0RE0TSKFA10000000000", "升级图表库", "failed"]
    ];
    for (const [id, title, status] of tasks) {
      db.prepare(
        `INSERT INTO tasks(id, project_id, package_id, package_rev, package_digest, title, spec_markdown, route, status,
                           adapter, cwd, budget_json, created_at, updated_at)
         VALUES (?, 'prj_01F1XT0RE0A000000000000000', 'pkg_01F1XT0RE0A000000000000000', 1, ?, ?, '规格见决策包', 'tier1', ?,
                 'cursor', '/tmp/wt', ?, '${T0}', '${T0}')`
      ).run(id, fixturePackage.digest, title, status, budget);
    }
    // 停靠(派生态 parked:blocked + parked_deadline)
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, cwd, budget_json,
                         parked_at, parked_deadline, created_at, updated_at)
       VALUES ('tsk_01F1XT0RE0TSKPRK0000000000', 'prj_01F1XT0RE0A000000000000000', '数据库索引重建', '规格见决策包', 'tier1', 'blocked',
               'cursor', '/tmp/wt', '${budget}', '${T0}', '2099-07-28T02:00:00.000Z', '${T0}', '${T0}')`
    ).run();

    // tier1_runs(执行记录;settled_review 契约 = Tier1SettleProof 齐备——approve 的 evidenceDigest 从此自取)
    const fixtureProof = JSON.stringify({
      taskId: "tsk_01F1XT0RE0TSKRDY0000000000",
      runId: "run_01F1XT0RE0A000000000000000",
      attempt: 1,
      packageRevision: 1,
      treeSha: "abc123def456",
      tier1VerifyDigest: `sha256:${"f".repeat(64)}`,
      acceptanceChecks: fixturePackage.acceptance.map((criterion) => ({ criterion, status: "unknown", source: "manual" })),
      transcriptCursor: "cursor-fixture-1",
      settledAt: T0
    });
    db.prepare(
      `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, tree_sha, state, settle_proof_json, created_at, updated_at)
       VALUES ('run_01F1XT0RE0A000000000000000', 'tsk_01F1XT0RE0TSKRDY0000000000', 1, 'cursor', '/tmp/wt', '/tmp/wt', 'abc123def456', 'settled_review', '${fixtureProof.replace(/'/g, "''")}', '${T0}', '${T0}'),
              ('run_01F1XT0RE0B000000000000000', 'tsk_01F1XT0RE0TSKRVN0000000000', 1, 'cursor', '/tmp/wt', '/tmp/wt', NULL, 'running', NULL, '${T0}', '${T0}')`
    ).run();
    db.prepare(
      `INSERT INTO audit_log(id, ts, actor, action, meta_json)
       VALUES ('aud_01F1XT0RE0OBSMODEL0000000', '${T0}', 'daemon', 'tier1.settled_review', ?)`
    ).run(
      JSON.stringify({
        taskId: "tsk_01F1XT0RE0TSKRDY0000000000",
        runId: "run_01F1XT0RE0A000000000000000",
        observedModel: "cursor-grok-4.6-high-fast",
        observedModelSource: "stream",
        observedModelExempted: false,
        observedModelFamilyOk: true
      })
    );

    // 审批(S2 pending / S2 voice consumed / S3 screen consumed;voice 必带 turn_ref)
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, effect, task_id, turn_ref, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at)
       VALUES ('apr_01F1XT0RE0APRPND0000000000', 'runtime_effect', 'sha256:${"b".repeat(64)}', 'sha256:${"a".repeat(64)}', '要在报表项目里跑数据库迁移', 'tsk_01F1XT0RE0TSKB1K0000000000', 'ses_01FIX#t1', 'S2', 'voice', 'voice_weak', 'nonce-fix-1', 'pending', '${T0}', '2026-07-25T02:01:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, effect, task_id, turn_ref, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at, decided_at, consumed_at)
       VALUES ('apr_01F1XT0RE0APRVC00000000000', 'dispatch_package', ?, '拍板执行:报表导出 CSV', 'tsk_01F1XT0RE0TSKRDY0000000000', 'ses_01FIX#t2', 'S2', 'voice', 'voice_weak', 'nonce-fix-2', 'consumed', '${T0}', '2026-07-25T02:01:00.000Z', '${T0}', '${T0}')`
    ).run(fixturePackage.digest);
    // W4(09 §3.3):S3 演示行改造为合法 S3MergeReceipt 全形状(v9 双向 CHECK 下 generic S3 行 DDL 层即非法)
    // ——先落已消费的 merge 挑战行(FK),收据带 s3 判别域六列(runtime_effect + os_biometric + 父包)
    db.prepare(
      `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id, attempt, package_revision, expires_at, consumed_at, created_at)
       VALUES ('s3c_01F1XT0RE0CHLMRG000000000', 'fixture-merge-challenge', 'merge', 'sha256:${"c".repeat(64)}', '${"d".repeat(40)}',
               'tsk_01F1XT0RE0TSKD0N0000000000', 'prj_01F1XT0RE0A000000000000000', 1, 1, '2026-07-25T02:07:00.000Z', '${T0}', '${T0}')`
    ).run();
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, effect, task_id, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at, decided_at, consumed_at,
                             s3_challenge_id, credential_id, assertion_digest, attempt, package_revision, prospective_tree_sha)
       VALUES ('apr_01F1XT0RE0APRSCR0000000000', 'runtime_effect', 'sha256:${"c".repeat(64)}', ?, '合并到主分支(本机认证已批)', 'tsk_01F1XT0RE0TSKD0N0000000000', 'S3', 'screen', 'os_biometric', 'nonce-fix-3', 'consumed', '${T0}', '2026-07-25T02:05:00.000Z', '${T0}', '${T0}',
               's3c_01F1XT0RE0CHLMRG000000000', 'fixture-cred-id', 'sha256:${"e".repeat(64)}', 1, 1, '${"d".repeat(40)}')`
    ).run(fixturePackage.digest);

    // 回叫 outbox
    db.prepare(
      `INSERT INTO callback_outbox(id, task_id, trigger, occurrence_key, dedupe_key, state, escalation, notified_at, created_at, updated_at)
       VALUES ('out_01F1XT0RE0A000000000000000', 'tsk_01F1XT0RE0TSKRDY0000000000', 'ready_for_review', 'occ-1', 'tsk_01F1XT0RE0TSKRDY0000000000|ready_for_review|occ-1|1', 'notified', 0, '${T0}', '${T0}', '${T0}'),
              ('out_01F1XT0RE0B000000000000000', 'tsk_01F1XT0RE0TSKB1K0000000000', 'blocked', 'occ-2', 'tsk_01F1XT0RE0TSKB1K0000000000|blocked|occ-2|1', 'pending', 1, NULL, '${T0}', '${T0}')`
    ).run();

    // 成本(known api / unknown api / 订阅行 known=0 amount NULL)
    db.prepare(
      `INSERT INTO cost_entries(id, ts, project_id, task_id, kind, amount, currency, known, source, meta_json)
       VALUES ('cst_01F1XT0RE0A000000000000000', '${T0}', 'prj_01F1XT0RE0A000000000000000', 'tsk_01F1XT0RE0TSKRDY0000000000', 'asr.seconds', 0.36, 'CNY', 1, 'api', '{"seconds":3600}'),
              ('cst_01F1XT0RE0B000000000000000', '${T0}', 'prj_01F1XT0RE0A000000000000000', 'tsk_01F1XT0RE0TSKRDY0000000000', 'llm.dialog', NULL, NULL, 0, 'api', '{"model":"m1","input_tokens":1200,"cached_input_tokens":800,"output_tokens":300}'),
              ('cst_01F1XT0RE0C000000000000000', '${T0}', 'prj_01F1XT0RE0A000000000000000', NULL, 'llm.thinking', NULL, NULL, 0, 'subscription', '{"model":"codex","input_tokens":8000,"cached_input_tokens":0,"output_tokens":2000}')`
    ).run();

    // 记忆(trust 层覆盖;M0 不入项目页)
    db.prepare(
      `INSERT INTO memory_events(id, ts, op, tier, project_id, claim, source_json, trust, generation)
       VALUES ('mem_01F1XT0RE0A000000000000000', '${T0}', 'add', 'M1', 'prj_01F1XT0RE0A000000000000000', '导出格式用 CSV,不要 Excel', '{"kind":"user_utterance","ref":"trn_01F1XT0RE0T000000000000003"}', 'user_stated', 1),
              ('mem_01F1XT0RE0B000000000000000', '${T0}', 'add', 'M1', 'prj_01F1XT0RE0A000000000000000', '报表模块入口在 src/reports', '{"kind":"repo_file","ref":"repo:src/reports/index.ts@abc123"}', 'auto_low_impact', 1),
              ('mem_01F1XT0RE0C000000000000000', '${T0}', 'add', 'M2', 'prj_01F1XT0RE0A000000000000000', 'README 说构建用 pnpm build', '{"kind":"repo_file","ref":"repo:README.md@abc123"}', 'candidate', 1)`
    ).run();

    // 产物(W5a 3.6:有 artifactsDir 时写真实文件——真 digest + supersedes 链,diff/导出可用;
    // 无 dir 保持旧占位形态,既有纯库测试不受影响)
    const artId = "art_01F1XT0RE0A000000000000000";
    let p1 = "artifacts/pkg-report-export-v1.json";
    let p2 = "artifacts/pkg-report-export-v2.json";
    let d1 = `sha256:${"a".repeat(64)}`;
    let d2 = `sha256:${"d".repeat(64)}`;
    if (opts.artifactsDir) {
      mkdirSync(opts.artifactsDir, { recursive: true });
      p1 = join(opts.artifactsDir, `${artId}-v1.md`);
      p2 = join(opts.artifactsDir, `${artId}-v2.md`);
      writeFileSync(p1, FIXTURE_ARTIFACT_V1);
      writeFileSync(p2, FIXTURE_ARTIFACT_V2);
      d1 = textDigest(FIXTURE_ARTIFACT_V1);
      d2 = textDigest(FIXTURE_ARTIFACT_V2);
    }
    // source 用 SourceRef 词表值 + tags_json 恒有值(diff/导出链走 zod artifactSchema,旧 'saydo' 会被拒)
    db.prepare(
      `INSERT INTO artifacts(id, version, project_id, type, path, digest, supersedes_json, tags_json, source, created_at)
       VALUES (?, 1, 'prj_01F1XT0RE0A000000000000000', 'decision_package', ?, ?, NULL, '[]', 'agent_output', '${T0}'),
              (?, 2, 'prj_01F1XT0RE0A000000000000000', 'decision_package', ?, ?, ?, '[]', 'agent_output', '${T0}')`
    ).run(artId, p1, d1, artId, p2, d2, JSON.stringify({ artifactId: artId, version: 1 }));

    // C7 Focus 只读页 fixture
    const focId = "foc_01F1XT0RE0F0CVS00000000001";
    const fevId = "fev_01F1XT0RE0F0CVS00000000001";
    const fobId = "fob_01F1XT0RE0F0CVS00000000001";
    db.prepare(
      `INSERT INTO focuses(id, title, lifecycle, semantic_authority, authority_epoch, current_revision, created_at, updated_at)
       VALUES (?, '整理 D2 观察表素材', 'active', 'saydo', 0, 1, ?, ?)`
    ).run(focId, T0, T0);
    db.prepare(
      `INSERT INTO focus_events(id, focus_id, seq, type, payload_schema_version, payload_json, actor_kind, session_id, turn_ref, created_at)
       VALUES (?, ?, 1, 'created', 1, ?, 'daemon', NULL, NULL, ?)`
    ).run(fevId, focId, JSON.stringify({ payloadSchemaVersion: 1, title: "整理 D2 观察表素材" }), T0);
    db.prepare(
      `INSERT INTO focus_states(focus_id, revision, current_direction, last_reliable_state, next_activation_trigger,
        accepted_decision_refs_json, event_high_watermark, obligations_digest, created_by_session_id, created_at)
       VALUES (?, 1, '整理素材', 'fixture baseline', NULL, '[]', 1, 'sha256:${"b".repeat(64)}', NULL, ?)`
    ).run(focId, T0);
    db.prepare(
      `INSERT INTO focus_obligations(
        id, focus_id, kind, title, detail, owner, status, verification, waiting_on, defer_reason, next_step,
        due_or_trigger, blocking, project_ref, action_ref, source_session_id, source_turn_ref, dedupe_key,
        resolution_event_id, resolution, created_at, updated_at
      ) VALUES (?, ?, 'action', '整理观察表行', NULL, 'human', 'open', 'confirmed', NULL, NULL, '打开表格核对',
        NULL, 1, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?, ?)`
    ).run(fobId, focId, `${focId}:action:fixture:1`, T0, T0);
  });
  tx();
  return { seeded: true };
}
