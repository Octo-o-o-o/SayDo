// docs/09 §9 SQLite DDL(对话域;执行域归 Hopper)—— v1 = 本表全集,照抄。
// dispatch_bindings/hopper_commands 两张表零成本建好,其读写路径属 P0.5-B(计划 0.3)。
// 迁移纪律:v1 之后只允许 additive 迁移,不改既有列语义。

import { createHash } from "node:crypto";
import { canonicalizeWorkspace, validateManagedWorkspace, WorkspacePolicyError } from "../projects/workspace.js";
import { relative, sep } from "node:path";

export const DDL_V1 = `
CREATE TABLE projects(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL,
  status TEXT NOT NULL, reanchored_to TEXT,
  workspace_json TEXT NOT NULL, canonical_workspace_path TEXT, workspace_dev TEXT, workspace_ino TEXT,
  hopper_project_id TEXT, exec_mode_default TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (type IN ('coding','writing','planning','research','marketing','general','pending')),
  CHECK (status IN ('draft','active','archived')));
CREATE TRIGGER project_type_transition_guard BEFORE UPDATE OF type ON projects
WHEN OLD.type != 'pending' AND NEW.type != OLD.type
BEGIN SELECT RAISE(ABORT, 'project type is immutable after pending'); END;
CREATE UNIQUE INDEX project_live_workspace_unique ON projects(canonical_workspace_path)
  WHERE canonical_workspace_path IS NOT NULL AND status != 'archived';
CREATE TRIGGER project_external_workspace_insert_guard BEFORE INSERT ON projects
WHEN NEW.status != 'archived'
 AND json_extract(NEW.workspace_json, '$.kind') = 'local_folder'
 AND json_extract(NEW.workspace_json, '$.managed') = 0
 AND (NEW.canonical_workspace_path IS NULL OR NEW.workspace_dev IS NULL OR NEW.workspace_ino IS NULL
      OR json_extract(NEW.workspace_json, '$.path') IS NOT NEW.canonical_workspace_path)
BEGIN SELECT RAISE(ABORT, 'external workspace registry incomplete'); END;
CREATE TRIGGER project_external_workspace_update_guard BEFORE UPDATE OF status, workspace_json,
  canonical_workspace_path, workspace_dev, workspace_ino ON projects
WHEN NEW.status != 'archived'
 AND json_extract(NEW.workspace_json, '$.kind') = 'local_folder'
 AND json_extract(NEW.workspace_json, '$.managed') = 0
 AND (NEW.canonical_workspace_path IS NULL OR NEW.workspace_dev IS NULL OR NEW.workspace_ino IS NULL
      OR json_extract(NEW.workspace_json, '$.path') IS NOT NEW.canonical_workspace_path)
BEGIN SELECT RAISE(ABORT, 'external workspace registry incomplete'); END;
CREATE TABLE sessions(id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
  project_revision INTEGER NOT NULL DEFAULT 0,
  anchor_readiness_revision INTEGER NOT NULL DEFAULT 0,
  anchor_pack_revision INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL, engine TEXT NOT NULL,
  transcript_path TEXT NOT NULL, context_digest TEXT, started_at TEXT NOT NULL, ended_at TEXT,
  lane TEXT CHECK (lane IS NULL OR lane IN ('quick','guided','explore')),
  CHECK (anchor_readiness_revision >= 0 AND anchor_readiness_revision <= project_revision),
  CHECK (anchor_pack_revision >= 0 AND anchor_pack_revision <= project_revision));  -- 价值证据轨埋点(05:车道占比;近零成本)
CREATE TRIGGER session_anchor_revision_update_guard BEFORE UPDATE OF project_revision,
  anchor_readiness_revision, anchor_pack_revision ON sessions
WHEN NEW.anchor_readiness_revision < 0 OR NEW.anchor_pack_revision < 0
  OR NEW.anchor_readiness_revision > NEW.project_revision
  OR NEW.anchor_pack_revision > NEW.project_revision
BEGIN SELECT RAISE(ABORT, 'session anchor revision invalid'); END;
CREATE TABLE session_project_events(id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id), project_id TEXT NOT NULL REFERENCES projects(id),
  project_revision INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(session_id, project_revision),
  CHECK (reason IN ('draft_created','workspace_adopted','draft_reanchored','migration_snapshot')));
CREATE TABLE decision_packages(id TEXT, revision INTEGER, digest TEXT UNIQUE, project_id TEXT,
  body_json TEXT, status TEXT, proposed_at TEXT, expires_at TEXT, created_at TEXT, PRIMARY KEY(id, revision),
  CHECK (status != 'proposed' OR proposed_at IS NOT NULL));   -- proposed 必带不可变锚(Codex 21 A6)
CREATE UNIQUE INDEX pkg_active_proposed ON decision_packages(project_id) WHERE status = 'proposed';
  -- 一项目至多一活跃 proposed(§2 注 ②;同包双 revision 同 proposed 亦拒,须先 CAS 关旧)
CREATE TABLE approvals(id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, ref_digest TEXT NOT NULL,
  parent_package_digest TEXT, effect TEXT, grant_digest TEXT, task_id TEXT, session_id TEXT, turn_ref TEXT,
  risk TEXT NOT NULL, principal TEXT NOT NULL DEFAULT 'owner', decided_via TEXT NOT NULL,
  auth_strength TEXT NOT NULL, decision TEXT,
  nonce TEXT UNIQUE NOT NULL, outcome TEXT NOT NULL DEFAULT 'pending',
  issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, decided_at TEXT, consumed_at TEXT,
  s3_challenge_id TEXT UNIQUE REFERENCES s3_challenges(id),   -- S3 判别域(09 §3.3;UNIQUE = 一挑战至多一收据,防双签)
  credential_id TEXT, assertion_digest TEXT,
  attempt INTEGER, package_revision INTEGER, prospective_tree_sha TEXT,
  CHECK (kind IN ('dispatch_package','runtime_effect')),
  CHECK (risk IN ('S0','S1','S2','S3')),
  CHECK (outcome IN ('pending','consumed','rejected','timeout_rejected','timeout_parked','superseded_by_edit','voided_by_conflict','expired')),
  -- 以下三条为 09 §3 正文矩阵的机械化补强(09 §9 DDL 原文缺;canonical 回填已登记,评审 B1):
  -- 词表 CHECK(否则未知 decided_via 绕过全部条件式 CHECK)+ screen 强认证 + runtime_effect 必绑父包
  CHECK (decided_via IN ('voice','screen','push','preauthorized')),
  CHECK (auth_strength IN ('voice_weak','paired_device_pin','screen_authenticated','os_biometric')),
  CHECK (decided_via != 'screen' OR auth_strength IN ('screen_authenticated','os_biometric')),
  CHECK (kind != 'runtime_effect' OR parent_package_digest IS NOT NULL),
  CHECK (risk != 'S3' OR (decided_via = 'screen' AND auth_strength IN ('screen_authenticated','os_biometric'))),
  CHECK (decided_via != 'voice'  OR (auth_strength = 'voice_weak'       AND risk IN ('S0','S1','S2'))),
  CHECK (decided_via != 'push'   OR (auth_strength = 'paired_device_pin' AND risk IN ('S0','S1','S2'))),
  CHECK (decided_via != 'preauthorized' OR (kind = 'runtime_effect' AND parent_package_digest IS NOT NULL)),
  -- turn_ref 约束(09 §3.3 放宽,W4/v9):screen/push 的 runtime_effect 无当前语音轮,turn_ref 允许 NULL;
  -- 旧 "runtime_effect 非预授权须绑 turn_ref" 行已删(S3 卡收据 = screen+runtime_effect+turn_ref NULL 合法)。
  -- 唯一强制 = voice 行(一切语音裁决须绑转写轮,SOL 反例 voice_dispatch_null_turn_ref):
  CHECK (decided_via != 'voice' OR turn_ref IS NOT NULL),
  -- S3 判别域双向 CHECK(09 §3.3/§9,Codex 21 A1):S3 收据必带全部来源域(generic screen 行 DDL 层
  -- 即非法;publish/deploy 等其余 action 落收据前须先另立判别合同再放宽——fail-closed);非 S3 不得蹭挑战来源:
  CHECK (risk != 'S3' OR (s3_challenge_id IS NOT NULL AND credential_id IS NOT NULL AND assertion_digest IS NOT NULL
         AND task_id IS NOT NULL AND attempt IS NOT NULL AND package_revision IS NOT NULL AND prospective_tree_sha IS NOT NULL)),
  CHECK (s3_challenge_id IS NULL OR risk = 'S3'));
-- S3 屏幕审批卡两表(WebAuthn;09 §3.3/§9;W4 v9)
CREATE TABLE webauthn_credentials(id TEXT PRIMARY KEY NOT NULL, credential_id TEXT UNIQUE NOT NULL,
  public_key_cose TEXT NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, principal TEXT NOT NULL DEFAULT 'owner',
  rp_id TEXT NOT NULL, backup_eligible INTEGER, backup_state INTEGER,   -- BE/BS 标志(同步凭据诚实条款,09 §3.3)
  status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT,
  CHECK (status IN ('active','revoked')),
  CHECK (backup_eligible IS NULL OR backup_eligible IN (0,1)),
  CHECK (backup_state IS NULL OR backup_state IN (0,1)));
CREATE UNIQUE INDEX webauthn_single_active ON webauthn_credentials(principal) WHERE status='active';
CREATE TABLE s3_challenges(id TEXT PRIMARY KEY NOT NULL, challenge TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL, ref_digest TEXT NOT NULL, prospective_tree_sha TEXT,
  task_id TEXT, project_id TEXT, attempt INTEGER, package_revision INTEGER,
  session_id TEXT, bootstrap_intent_id TEXT,
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL,
  CHECK (action IN ('register','merge','publish','deploy','delete_data','external_send','force_push')),
  CHECK (action != 'merge' OR (task_id IS NOT NULL AND project_id IS NOT NULL AND prospective_tree_sha IS NOT NULL
         AND attempt IS NOT NULL AND package_revision IS NOT NULL)),
  CHECK (action != 'register' OR (task_id IS NULL AND project_id IS NULL AND prospective_tree_sha IS NULL
         AND (session_id IS NOT NULL OR bootstrap_intent_id IS NOT NULL))));
CREATE TABLE tasks(id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
  package_id TEXT, package_rev INTEGER, package_digest TEXT,
  title TEXT NOT NULL, spec_markdown TEXT NOT NULL, route TEXT NOT NULL, status TEXT NOT NULL,
  cancel_reason TEXT, supersedes TEXT, adapter TEXT, native_session_id TEXT, cwd TEXT,
  budget_json TEXT NOT NULL, actual_cost_ref TEXT, parked_at TEXT, parked_deadline TEXT,
  approved_tree_sha TEXT,   -- 批准时落库的 prospectiveTree(Phase4 评审 A1:merge 对账基准取库值,不信 proof 自带)
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (route IN ('tier1','hopper')),
  CHECK (adapter IS NULL OR adapter IN ('claude_code','cursor','codex')),
  CHECK ((route = 'hopper') = (adapter IS NULL)));
CREATE TABLE dispatch_bindings(voice_task_id TEXT PRIMARY KEY, dispatch_id TEXT, idem_key TEXT UNIQUE,
  package_digest TEXT, mode TEXT, hopper_json TEXT, drop_outcome TEXT, created_at TEXT);
CREATE TABLE hopper_commands(id TEXT PRIMARY KEY, task_id TEXT, op TEXT, idem_key TEXT UNIQUE,
  payload_digest TEXT, receipt_id TEXT, state TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE memory_events(id TEXT PRIMARY KEY, ts TEXT, op TEXT, tier TEXT, project_id TEXT,
  claim TEXT, source_json TEXT, trust TEXT, taint_json TEXT, expires_at TEXT, supersedes TEXT,
  payload_json TEXT, generation INTEGER,
  readiness_key TEXT,
  CHECK (op IN ('add','correct','invalidate','forget_soft','forget_hard','consolidate')),
  CHECK (op NOT IN ('invalidate','forget_soft','forget_hard')
         OR (payload_json IS NOT NULL AND payload_json NOT IN ('','{}','null'))),
  CHECK (op != 'forget_hard' OR generation IS NOT NULL));
CREATE VIRTUAL TABLE memory_fts USING fts5(claim, tokenize = 'trigram');
CREATE TABLE context_snapshots(pack_digest TEXT PRIMARY KEY NOT NULL, compiler_version TEXT NOT NULL,
  body_json TEXT NOT NULL, created_at TEXT NOT NULL);
-- 使用记录允许重复行(评审 B6:PK 去重会静默丢同毫秒重用,审计计数偏低;查询走索引)
CREATE TABLE context_snapshot_uses(session_id TEXT NOT NULL, pack_digest TEXT NOT NULL REFERENCES context_snapshots(pack_digest),
  used_at TEXT NOT NULL, rebuild INTEGER NOT NULL DEFAULT 0);
CREATE INDEX snapshot_uses_session ON context_snapshot_uses(session_id, used_at);
CREATE TABLE readiness_assessments(id TEXT PRIMARY KEY NOT NULL, session_id TEXT, package_ref TEXT,
  verdict TEXT, dims_json TEXT, blocking_criticals_json TEXT,
  layer TEXT NOT NULL DEFAULT 'rules', evaluator_model TEXT,
  prompt_digest TEXT, prompt_body_path TEXT, source_verifications_json TEXT,
  checklist_digest TEXT, evidence_digest TEXT,
  outcome TEXT, created_at TEXT,
  CHECK (layer IN ('rules','deep')),
  CHECK (layer != 'deep' OR (evaluator_model IS NOT NULL AND prompt_digest IS NOT NULL
         AND prompt_body_path IS NOT NULL AND source_verifications_json IS NOT NULL)));
CREATE TABLE readiness_bindings(id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL, key TEXT NOT NULL, axis TEXT NOT NULL CHECK(axis IN ('knowledge','requirement')),
  mem_id TEXT NOT NULL, claim_digest TEXT NOT NULL,
  snapshot_id TEXT,
  receipt_id TEXT NOT NULL,
  session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
  foundation_generation INTEGER,
  bound_at TEXT NOT NULL, superseded_at TEXT, superseded_by TEXT,
  CHECK ((axis = 'knowledge') = (foundation_generation IS NOT NULL)));
CREATE UNIQUE INDEX readiness_bindings_active ON readiness_bindings(project_id, key) WHERE superseded_at IS NULL;
CREATE TABLE source_snapshots(id TEXT PRIMARY KEY NOT NULL, source_json TEXT NOT NULL,
  snapshot_locator TEXT NOT NULL, live_locator TEXT NOT NULL,
  content_digest TEXT NOT NULL, body_path TEXT NOT NULL, captured_at TEXT NOT NULL,
  resolver_version TEXT NOT NULL);
CREATE TABLE claim_snapshot_links(project_id TEXT, memory_event_id TEXT NOT NULL, claim_digest TEXT NOT NULL,
  snapshot_id TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(memory_event_id, claim_digest, snapshot_id));
CREATE TABLE artifacts(id TEXT, version INTEGER, project_id TEXT, type TEXT, path TEXT, digest TEXT,
  supersedes_json TEXT, tags_json TEXT, source TEXT, created_at TEXT, PRIMARY KEY(id, version));
CREATE TABLE cost_entries(id TEXT PRIMARY KEY, ts TEXT, project_id TEXT, task_id TEXT, session_id TEXT,
  kind TEXT, amount REAL, currency TEXT, known INTEGER CHECK(known IN (0,1)),
  source TEXT CHECK(source IN ('api','subscription')), meta_json TEXT,
  CHECK (source != 'subscription' OR (known = 0 AND amount IS NULL)));
CREATE TABLE callback_outbox(id TEXT PRIMARY KEY, task_id TEXT NOT NULL, trigger TEXT NOT NULL,
  occurrence_key TEXT NOT NULL, dedupe_key TEXT NOT NULL,
  settle_json TEXT, state TEXT NOT NULL, resolution TEXT, escalation INTEGER,
  notified_at TEXT, acked_at TEXT, resolved_at TEXT, snoozed_until TEXT, created_at TEXT, updated_at TEXT);
CREATE UNIQUE INDEX outbox_active_dedupe ON callback_outbox(dedupe_key)
  WHERE state IN ('pending','notified','acked','requeued');
CREATE TABLE audit_log(id TEXT PRIMARY KEY NOT NULL, ts TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, ref_digest TEXT, meta_json TEXT);
CREATE TABLE events_cursor(source TEXT PRIMARY KEY NOT NULL, byte_offset INTEGER NOT NULL,
  last_line_digest TEXT, vault_id TEXT, file_generation INTEGER, updated_at TEXT NOT NULL);
CREATE TABLE tier1_runs(id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id),
  attempt INTEGER NOT NULL, adapter TEXT NOT NULL, native_session_id TEXT, cwd TEXT NOT NULL,
  native_session_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(native_session_confirmed IN (0,1)),
  worktree_path TEXT NOT NULL, tree_sha TEXT, event_cursor TEXT,
  state TEXT NOT NULL, settle_proof_json TEXT, cancel_proof_json TEXT,
  decisions_json TEXT, restart_pending_at TEXT, restart_reason TEXT,
  budget_active_ms INTEGER NOT NULL DEFAULT 0, budget_tool_calls INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (adapter IN ('claude_code','cursor','codex')),
  CHECK (state IN ('reserved','running','step_paused','settled_review','settled_failed','cancel_requested','cancel_settled')));
CREATE TABLE project_settings(project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id),
  overrides_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE subscription_retry_queue(id TEXT PRIMARY KEY NOT NULL,
  slot TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL,
  reason TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  not_before TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
  enqueued_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (state IN ('queued','replayed','expired','cancelled')));
CREATE INDEX srq_due ON subscription_retry_queue(state, not_before);
`;

// v2(收口对账修复 #1):审计不可变从"DAO 只写纪律"升为库层强制(modules/e E3"日志可轮转,审计不可变";
// gate0-checklist G5 原声称的触发器此前并不存在)。additive:只加触发器,不动既有表。
export const DDL_V2_AUDIT_IMMUTABLE = `
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log immutable (E3)'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log immutable (E3)'); END;
`;

// v3(接线批 Codex 16 A 回修):retry message / request_changes comments 原文的 durable 落点——
// 09 §13 "message 进下次 run 编译上下文"/#29b 返工修改意见的机械承载(audit 只记 digest 是 E3 纪律,
// 但审计≠功能存储;丢原文 = 用户答复静默蒸发)。执行器认领新 attempt 时按 (task_id, attempt) 读取。
// additive:新表,不动既有表。
export const DDL_V3_TASK_MESSAGES = `
CREATE TABLE IF NOT EXISTS task_messages(id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  attempt INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retry','review_comments')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS task_messages_task ON task_messages(task_id, attempt);
`;

// v4(执行器批):task_messages.kind 词表 + 'steer'——09 §13 steerTask 对 cursor 后端应答
// queued_delta(无 live steer,spike 8 约束 4)的 durable 落点:指令排队,下次 run 认领时经
// readTaskMessages 进编译上下文。SQLite 不支持改 CHECK,走重建迁移(表新且量小,事务内安全)。
export const DDL_V4_TASK_MESSAGES_STEER = `
CREATE TABLE task_messages_v4(id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  attempt INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retry','review_comments','steer')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL);
INSERT INTO task_messages_v4 SELECT id, task_id, attempt, kind, body, created_at FROM task_messages;
DROP TABLE task_messages;
ALTER TABLE task_messages_v4 RENAME TO task_messages;
CREATE INDEX IF NOT EXISTS task_messages_task ON task_messages(task_id, attempt);
`;

// v5(W2 场次① A1,2026-07-26):清偿"改 DDL_V1 不配迁移"的系统性欠账——
// M 批(M1 快照拆表)/Phase3 前置(§4.1 源快照)/接线批/W1 一路把新表新列直接写进 DDL_V1
// 建表原文,测试全用新建库故 CI 恒绿,owner 老运行库(v4 时代建库)全部缺失,dogfood 首日
// 连环崩(dialog loop 崩 sessions.lane / pack compile 崩 context_snapshot_uses)。
// 差集经机械对账(v4 时代库 vs 全新库,与 owner 现场实测清单完全吻合):
//   表 context_snapshot_uses / source_snapshots / claim_snapshot_links + 索引 snapshot_uses_session;
//   列 sessions.lane、tasks.approved_tree_sha、readiness_assessments.{layer,prompt_digest,prompt_body_path,source_verifications_json}。
// 容错形态(代码迁移,非纯 SQL):owner 库已被现场手术补齐(裸类型列,备份
// ~/.saydo/saydo.db.bak-20260726-1435)——列用 PRAGMA table_info 探测已存在即跳过
// (接受手术列无列级 CHECK 的现实;新库走 DDL_V1 有完整 CHECK);表/索引用 IF NOT EXISTS。
// 诚实注记:readiness_assessments 的跨列 CHECK(deep 行四必填)SQLite 无法后补到老库
// (无 ADD CONSTRAINT),由 DAO/契约层纪律兜——新库 DDL_V1 有库层强制。
// 铁律(HANDOFF §4 已同步):改 DDL_V1 必配增量迁移 + v4-era fixture 回归。
type DbLike = {
  exec(sql: string): unknown;
  prepare(sql: string): { all(...args: unknown[]): unknown[]; get(...args: unknown[]): unknown; run(...args: unknown[]): unknown };
};

function hasColumn(db: DbLike, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(db: DbLike, table: string, column: string, decl: string): void {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl};`);
}

export function applyDdlV5CatchUp(db: DbLike): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS context_snapshot_uses(session_id TEXT NOT NULL, pack_digest TEXT NOT NULL REFERENCES context_snapshots(pack_digest),
  used_at TEXT NOT NULL, rebuild INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS snapshot_uses_session ON context_snapshot_uses(session_id, used_at);
CREATE TABLE IF NOT EXISTS source_snapshots(id TEXT PRIMARY KEY NOT NULL, source_json TEXT NOT NULL,
  snapshot_locator TEXT NOT NULL, live_locator TEXT NOT NULL,
  content_digest TEXT NOT NULL, body_path TEXT NOT NULL, captured_at TEXT NOT NULL,
  resolver_version TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS claim_snapshot_links(project_id TEXT, memory_event_id TEXT NOT NULL, claim_digest TEXT NOT NULL,
  snapshot_id TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(memory_event_id, claim_digest, snapshot_id));
`);
  addColumnIfMissing(db, "sessions", "lane", "TEXT CHECK (lane IS NULL OR lane IN ('quick','guided','explore'))");
  addColumnIfMissing(db, "tasks", "approved_tree_sha", "TEXT");
  addColumnIfMissing(db, "readiness_assessments", "layer", "TEXT NOT NULL DEFAULT 'rules' CHECK (layer IN ('rules','deep'))");
  addColumnIfMissing(db, "readiness_assessments", "prompt_digest", "TEXT");
  addColumnIfMissing(db, "readiness_assessments", "prompt_body_path", "TEXT");
  addColumnIfMissing(db, "readiness_assessments", "source_verifications_json", "TEXT");
}

// v6(W5a 3.2,2026-07-27):tier1_runs.decisions_json——decisions[] 摘要层(09 §13 explainResult
// level=decisions;10 §5 每条=决策+理由+可推翻,≤5 条)的 durable 落点,口播与上屏读同一份
// (落库才一致)。additive 列,老库 addColumnIfMissing 探测容错(铁律:改 DDL_V1 必配迁移)。
export function applyDdlV6Decisions(db: DbLike): void {
  addColumnIfMissing(db, "tier1_runs", "decisions_json", "TEXT");
}

// v7(W5a 3.5,2026-07-27):project_settings——项目级模型/预算覆盖的 daemon 受控设置表
// (02 §5.1;PLAN-2 5.5)。承载纪律:**绝不落 project.toml**——09 §11 白名单把 models/providers
// 列为项目层禁键(仓库随附输入不可信,防克隆仓把用户 key 引到攻击者主机),该白名单是安全面
// 不放宽;本表只经 console 受信终端写口(tailnet 403),daemon 库内持有,与仓库文件无关。
export const DDL_V7_PROJECT_SETTINGS = `
CREATE TABLE IF NOT EXISTS project_settings(project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id),
  overrides_json TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

// v8(W5a 3.7,2026-07-27):subscription_retry_queue——订阅限流 durable 排队重放
// (09 §11-5"P0.5 再议 durable 排队"清偿)。限流请求落库排队,窗口重置后 sweep 按 kind 重放;
// 重启不丢(此前内存态"重启重新询问")。生产 enqueue 点随 claude 订阅接入批(PLAN-2 5.4)。
export const DDL_V8_SUBSCRIPTION_RETRY = `
CREATE TABLE IF NOT EXISTS subscription_retry_queue(id TEXT PRIMARY KEY NOT NULL,
  slot TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL,
  reason TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  not_before TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
  enqueued_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (state IN ('queued','replayed','expired','cancelled')));
CREATE INDEX IF NOT EXISTS srq_due ON subscription_retry_queue(state, not_before);
`;

// v9(W4 3.1,2026-07-27):S3 屏幕审批卡承载(09 §3.3/§9;R-A 合同)。三件:
//   ① webauthn_credentials + s3_challenges 两新表(含 BE/BS 列、单活跃凭据部分唯一索引、challenge UNIQUE、
//      merge/register 双 CHECK);
//   ② approvals 六列(s3_challenge_id UNIQUE REFERENCES/credential_id/assertion_digest/attempt/
//      package_revision/prospective_tree_sha)+ S3 判别域双向 CHECK;
//   ③ turn_ref 过约束放宽(Codex 14 #1 随 S3 卡兑现):删旧 "runtime_effect 非预授权须绑 turn_ref" 行,
//      唯一强制余 voice 行——旧库全部 voice 行天然满足,additive 放宽。
// SQLite 不支持改 CHECK/加 UNIQUE 列 ⇒ approvals 走表重建(v4 同模式);迁移前后行数对账在事务内断言,
// 不符即回滚(§12-13 迁移对账用例另有独立 digest 对账)。
export function applyDdlV9S3Card(db: DbLike): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS webauthn_credentials(id TEXT PRIMARY KEY NOT NULL, credential_id TEXT UNIQUE NOT NULL,
  public_key_cose TEXT NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, principal TEXT NOT NULL DEFAULT 'owner',
  rp_id TEXT NOT NULL, backup_eligible INTEGER, backup_state INTEGER,
  status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT,
  CHECK (status IN ('active','revoked')),
  CHECK (backup_eligible IS NULL OR backup_eligible IN (0,1)),
  CHECK (backup_state IS NULL OR backup_state IN (0,1)));
CREATE UNIQUE INDEX IF NOT EXISTS webauthn_single_active ON webauthn_credentials(principal) WHERE status='active';
CREATE TABLE IF NOT EXISTS s3_challenges(id TEXT PRIMARY KEY NOT NULL, challenge TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL, ref_digest TEXT NOT NULL, prospective_tree_sha TEXT,
  task_id TEXT, project_id TEXT, attempt INTEGER, package_revision INTEGER,
  session_id TEXT, bootstrap_intent_id TEXT,
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL,
  CHECK (action IN ('register','merge','publish','deploy','delete_data','external_send','force_push')),
  CHECK (action != 'merge' OR (task_id IS NOT NULL AND project_id IS NOT NULL AND prospective_tree_sha IS NOT NULL
         AND attempt IS NOT NULL AND package_revision IS NOT NULL)),
  CHECK (action != 'register' OR (task_id IS NULL AND project_id IS NULL AND prospective_tree_sha IS NULL
         AND (session_id IS NOT NULL OR bootstrap_intent_id IS NOT NULL))));
`);
  // approvals 表重建(老库仅当 s3 列缺失时;新库 DDL_V1 已是终形状)
  if (hasColumn(db, "approvals", "s3_challenge_id")) return;
  // B-1(批末 review):老库/演示库可能有 W4 前的 generic S3 行(risk='S3' 但无判别六列,
  // 如基线 fixture 的 apr_...APRSCR)——新 CHECK 下这些行非法,重建 INSERT 会炸。它们是 pre-W4
  // 演示/终局数据(W4 前无 S3 签发生产路径),迁移前先剔除(与"generic screen 不构成 S3 收据"合同一致)。
  const s3Invalid = db
    .prepare("SELECT COUNT(*) AS c FROM approvals WHERE risk='S3'")
    .get() as { c: number };
  if (s3Invalid.c > 0) {
    db.prepare("DELETE FROM approvals WHERE risk='S3'").run();
  }
  const before = (db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c;
  db.exec(`
CREATE TABLE approvals_v9(id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, ref_digest TEXT NOT NULL,
  parent_package_digest TEXT, effect TEXT, grant_digest TEXT, task_id TEXT, session_id TEXT, turn_ref TEXT,
  risk TEXT NOT NULL, principal TEXT NOT NULL DEFAULT 'owner', decided_via TEXT NOT NULL,
  auth_strength TEXT NOT NULL, decision TEXT,
  nonce TEXT UNIQUE NOT NULL, outcome TEXT NOT NULL DEFAULT 'pending',
  issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, decided_at TEXT, consumed_at TEXT,
  s3_challenge_id TEXT UNIQUE REFERENCES s3_challenges(id),
  credential_id TEXT, assertion_digest TEXT,
  attempt INTEGER, package_revision INTEGER, prospective_tree_sha TEXT,
  CHECK (kind IN ('dispatch_package','runtime_effect')),
  CHECK (risk IN ('S0','S1','S2','S3')),
  CHECK (outcome IN ('pending','consumed','rejected','timeout_rejected','timeout_parked','superseded_by_edit','voided_by_conflict','expired')),
  CHECK (decided_via IN ('voice','screen','push','preauthorized')),
  CHECK (auth_strength IN ('voice_weak','paired_device_pin','screen_authenticated','os_biometric')),
  CHECK (decided_via != 'screen' OR auth_strength IN ('screen_authenticated','os_biometric')),
  CHECK (kind != 'runtime_effect' OR parent_package_digest IS NOT NULL),
  CHECK (risk != 'S3' OR (decided_via = 'screen' AND auth_strength IN ('screen_authenticated','os_biometric'))),
  CHECK (decided_via != 'voice'  OR (auth_strength = 'voice_weak'       AND risk IN ('S0','S1','S2'))),
  CHECK (decided_via != 'push'   OR (auth_strength = 'paired_device_pin' AND risk IN ('S0','S1','S2'))),
  CHECK (decided_via != 'preauthorized' OR (kind = 'runtime_effect' AND parent_package_digest IS NOT NULL)),
  CHECK (decided_via != 'voice' OR turn_ref IS NOT NULL),
  CHECK (risk != 'S3' OR (s3_challenge_id IS NOT NULL AND credential_id IS NOT NULL AND assertion_digest IS NOT NULL
         AND task_id IS NOT NULL AND attempt IS NOT NULL AND package_revision IS NOT NULL AND prospective_tree_sha IS NOT NULL)),
  CHECK (s3_challenge_id IS NULL OR risk = 'S3'));
INSERT INTO approvals_v9(id, kind, ref_digest, parent_package_digest, effect, grant_digest, task_id, session_id,
  turn_ref, risk, principal, decided_via, auth_strength, decision, nonce, outcome, issued_at, expires_at,
  decided_at, consumed_at)
  SELECT id, kind, ref_digest, parent_package_digest, effect, grant_digest, task_id, session_id,
    turn_ref, risk, principal, decided_via, auth_strength, decision, nonce, outcome, issued_at, expires_at,
    decided_at, consumed_at FROM approvals;
DROP TABLE approvals;
ALTER TABLE approvals_v9 RENAME TO approvals;
`);
  const after = (db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c;
  if (after !== before) {
    throw new Error(`v9 approvals rebuild row-count mismatch: before=${before} after=${after} (事务回滚)`);
  }
}

// v10(W4 3.2,2026-07-27):projects CHECK 加 'writing'(09 §6.1a/§9 writing 窄版;zod+DDL+存量重建同批)。
// SQLite 不支持改 CHECK ⇒ projects 表重建(v4/v9 同模式);FK 关系(sessions/tasks REFERENCES projects)
// 在重建中经 PRAGMA foreign_keys 事务边界安全(migrate() 在事务内跑,better-sqlite3 事务期 FK 检查
// 延后到提交)。老库仅当 type CHECK 未含 writing 时重建;新库 DDL_V1 已终形状。前后行数对账,不符回滚。
export function applyDdlV10ProjectsWriting(db: DbLike): void {
  // 探测:新库(DDL_V1 已含 writing)插一条 writing 试探——能插即已终形状,跳过重建
  const probe = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get() as
    | { sql: string }
    | undefined;
  if (probe && probe.sql.includes("'writing'")) return; // 新库或已迁移
  const before = (db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number }).c;
  // projects 被 sessions/tasks REFERENCES(父表重建):RA-closeout code-review A-1/B-4 勘误——
  // 旧注释"deferred FK 在 COMMIT 时 id 复原即通过"是对 SQLite 的错误理解(deferred FK 是违规计数器,
  // DROP 的隐式 DELETE 累计的违规不因 RENAME 复原,带引用行的老库 COMMIT 必炸)。
  // 现由 migrate() 框架统一承载(连接级 foreign_keys=OFF + 每迁移事务内 foreign_key_check,db.ts),
  // 本函数不再自设 defer(带数据老库回归用例:storage-migration-v5)。
  db.exec(`
CREATE TABLE projects_v10(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL,
  status TEXT NOT NULL, reanchored_to TEXT,
  workspace_json TEXT NOT NULL, hopper_project_id TEXT, exec_mode_default TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (type IN ('coding','writing','planning','research','marketing','general','pending')),
  CHECK (status IN ('draft','active','archived')));
INSERT INTO projects_v10 SELECT id, title, type, status, reanchored_to, workspace_json, hopper_project_id,
  exec_mode_default, created_at, updated_at FROM projects;
DROP TABLE projects;
ALTER TABLE projects_v10 RENAME TO projects;
`);
  const after = (db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number }).c;
  if (after !== before) throw new Error(`v10 projects rebuild row-count mismatch: before=${before} after=${after}`);
}

// v11(W4 3.8,2026-07-27):decision_packages proposed TTL(09 §2 注 ④;Codex 21 A6)。
// 加 proposed_at 列 + CHECK(status!='proposed' OR proposed_at IS NOT NULL) + 唯一活跃部分索引
// pkg_active_proposed。SQLite 不支持加 CHECK ⇒ 表重建(无 FK 子表引用 decision_packages,安全)。
// 老库仅当无 proposed_at 列时重建;前后行数对账。
export function applyDdlV11ProposedTtl(db: DbLike): void {
  if (hasColumn(db, "decision_packages", "proposed_at")) return; // 新库或已迁移
  const before = (db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c;
  // A-1(批末 review):W4 前 proposeStart 不 supersede 旧 proposed(裸 updatePackageStatus),
  // 老库可能同项目多行 proposed("提议未拍板又重提"的 dogfood 常态)——直接建唯一活跃索引会炸、升级即砖。
  // 迁移前先收敛:同项目多 proposed 只保留 created_at 最新一行,其余 superseded(与 transitionToProposed
  // 的 CAS 关旧同语义)。ROWID 兜底同 created_at 的确定性排序。
  db.exec(`
UPDATE decision_packages SET status='superseded'
 WHERE status='proposed'
   AND rowid NOT IN (
     SELECT rowid FROM decision_packages d1 WHERE d1.status='proposed'
       AND d1.created_at = (SELECT MAX(d2.created_at) FROM decision_packages d2 WHERE d2.project_id=d1.project_id AND d2.status='proposed')
       AND d1.rowid = (SELECT MAX(d3.rowid) FROM decision_packages d3 WHERE d3.project_id=d1.project_id AND d3.status='proposed' AND d3.created_at=d1.created_at)
   );
`);
  db.exec(`
CREATE TABLE decision_packages_v11(id TEXT, revision INTEGER, digest TEXT UNIQUE, project_id TEXT,
  body_json TEXT, status TEXT, proposed_at TEXT, expires_at TEXT, created_at TEXT, PRIMARY KEY(id, revision),
  CHECK (status != 'proposed' OR proposed_at IS NOT NULL));
INSERT INTO decision_packages_v11(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
  SELECT id, revision, digest, project_id, body_json, status,
    CASE WHEN status='proposed' THEN COALESCE(expires_at, created_at) ELSE NULL END,
    expires_at, created_at FROM decision_packages;
DROP TABLE decision_packages;
ALTER TABLE decision_packages_v11 RENAME TO decision_packages;
CREATE UNIQUE INDEX pkg_active_proposed ON decision_packages(project_id) WHERE status = 'proposed';
`);
  const after = (db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c;
  if (after !== before) throw new Error(`v11 decision_packages rebuild row-count mismatch: before=${before} after=${after}`);
}

export type Migration = { version: number; sql: string } | { version: number; apply: (db: DbLike) => void };

export const DDL_V15_PROJECT_TYPE_IMMUTABLE = `
CREATE TRIGGER IF NOT EXISTS project_type_transition_guard BEFORE UPDATE OF type ON projects
WHEN OLD.type != 'pending' AND NEW.type != OLD.type
BEGIN SELECT RAISE(ABORT, 'project type is immutable after pending'); END;
`;

// v16(Focus Contract 批 1,2026-08-04):7 canonical + 2 shadow + sessions 两列。
// 注:计划文稿写 "v14/v15",但本仓迁移链已占用 v14(project anchors)/v15(project type immutable),
// 故顺延为 v16/v17——内容与约束按方案 §2 与实施计划 A1,版本号仅反映链序。
export const DDL_V16_FOCUS_BATCH1 = `
CREATE TABLE IF NOT EXISTS focuses(
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  semantic_authority TEXT NOT NULL,
  authority_epoch INTEGER NOT NULL DEFAULT 0,
  current_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (lifecycle IN ('captured','active','dormant','closed','abandoned')),
  CHECK (semantic_authority IN ('external_bootstrap','saydo')),
  CHECK (authority_epoch >= 0),
  CHECK (current_revision >= 0)
);

CREATE TABLE IF NOT EXISTS focus_project_refs(
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  added_by_event_id TEXT NOT NULL,
  removed_by_event_id TEXT,
  removed_at TEXT,
  note TEXT,
  added_at TEXT NOT NULL,
  PRIMARY KEY (focus_id, project_id, added_by_event_id),
  CHECK ((removed_at IS NULL) = (removed_by_event_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS focus_project_refs_active
  ON focus_project_refs(focus_id, project_id) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS focus_states(
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  revision INTEGER NOT NULL,
  current_direction TEXT NOT NULL,
  last_reliable_state TEXT NOT NULL,
  next_activation_trigger TEXT,
  accepted_decision_refs_json TEXT NOT NULL DEFAULT '[]',
  event_high_watermark INTEGER NOT NULL DEFAULT 0,
  obligations_digest TEXT NOT NULL,
  created_by_session_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (focus_id, revision),
  UNIQUE (focus_id, revision),
  CHECK (revision >= 1),
  CHECK (event_high_watermark >= 0)
);

CREATE TABLE IF NOT EXISTS focus_events(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  session_id TEXT,
  turn_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (focus_id, seq),
  CHECK (seq >= 1),
  CHECK (payload_schema_version >= 1),
  CHECK (actor_kind IN ('user','daemon','brain_proposal')),
  CHECK (type IN (
    'created','activation_started','activation_closed','revision_settled',
    'obligation_opened','obligation_status_changed','obligation_resolved',
    'lifecycle_changed','project_ref_added','project_ref_removed',
    'packet_frozen','packet_confirmed','binding_authorized','binding_ledger_bound',
    'authority_transfer','close_settlement','correction'
  ))
);
CREATE TRIGGER IF NOT EXISTS focus_events_no_update BEFORE UPDATE ON focus_events
BEGIN SELECT RAISE(ABORT, 'focus_events immutable'); END;
CREATE TRIGGER IF NOT EXISTS focus_events_no_delete BEFORE DELETE ON focus_events
BEGIN SELECT RAISE(ABORT, 'focus_events immutable'); END;

CREATE TABLE IF NOT EXISTS focus_obligations(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  verification TEXT NOT NULL,
  waiting_on TEXT,
  defer_reason TEXT,
  next_step TEXT,
  due_or_trigger TEXT,
  blocking INTEGER NOT NULL DEFAULT 0,
  project_ref TEXT,
  action_ref TEXT,
  source_session_id TEXT,
  source_turn_ref TEXT,
  dedupe_key TEXT NOT NULL,
  resolution_event_id TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (focus_id, dedupe_key),
  CHECK (kind IN ('answer','decision','action','followup','check')),
  CHECK (owner IN ('human','agent','external')),
  CHECK (status IN ('open','in_progress','waiting','deferred','blocked','resolved','superseded')),
  CHECK (verification IN ('provisional','unverified','confirmed')),
  CHECK (blocking IN (0,1)),
  CHECK (resolution IS NULL OR resolution IN ('done','abandoned','superseded','no_longer_applicable')),
  CHECK (status NOT IN ('waiting','blocked') OR waiting_on IS NOT NULL),
  CHECK (status != 'deferred' OR defer_reason IS NOT NULL),
  CHECK (status NOT IN ('resolved','superseded') OR (resolution_event_id IS NOT NULL AND resolution IS NOT NULL)),
  CHECK (NOT (verification = 'unverified' AND status = 'resolved' AND resolution = 'done'))
);

CREATE TABLE IF NOT EXISTS focus_activations(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  anchor_revision INTEGER NOT NULL,
  input_focus_revision INTEGER NOT NULL,
  resume_source TEXT NOT NULL,
  packet_revision INTEGER,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  output_focus_revision INTEGER,
  started_at TEXT NOT NULL,
  closed_at TEXT,
  CHECK (resume_source IN ('packet','state_direct','cold')),
  CHECK (trigger IN ('user_explicit','session_open_suggest','reopen')),
  CHECK (status IN ('active','closed','interrupted')),
  CHECK (anchor_revision >= 0),
  CHECK (input_focus_revision >= 0),
  CHECK (status != 'active' OR (closed_at IS NULL AND output_focus_revision IS NULL)),
  CHECK (status != 'closed' OR (closed_at IS NOT NULL AND output_focus_revision IS NOT NULL)),
  CHECK (status != 'interrupted' OR (closed_at IS NOT NULL AND output_focus_revision IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS focus_activations_session_active
  ON focus_activations(session_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS focus_close_settlements(
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  activation_id TEXT NOT NULL REFERENCES focus_activations(id),
  idempotency_key TEXT NOT NULL,
  close_attempt INTEGER NOT NULL,
  frozen_inputs_json TEXT NOT NULL,
  candidates_json TEXT NOT NULL,
  decisions_json TEXT,
  presentation_id TEXT,
  phase TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (session_id, close_attempt),
  UNIQUE (idempotency_key),
  CHECK (close_attempt >= 1),
  CHECK (phase IN ('enumerated','presented','confirmed','auto_ledgered','committed','conflict'))
);
CREATE UNIQUE INDEX IF NOT EXISTS focus_close_settlements_session_active
  ON focus_close_settlements(session_id) WHERE phase NOT IN ('committed','conflict');

CREATE TABLE IF NOT EXISTS focus_shadow_projections(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL,
  source_authority TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_compare_records(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL,
  projection_id TEXT NOT NULL,
  ledger_revision TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  zero_divergence INTEGER NOT NULL DEFAULT 0,
  scene_tag TEXT,
  created_at TEXT NOT NULL,
  CHECK (zero_divergence IN (0,1))
);
`;

// v17(Focus Contract 批 2 表壳,2026-08-04):resume packets + action execution bindings。
// 服务层归 M3;本迁移只建表+约束(IM-15..19)。
export const DDL_V17_FOCUS_BATCH2 = `
CREATE TABLE IF NOT EXISTS focus_resume_packets(
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  revision INTEGER NOT NULL,
  baseline_revision INTEGER NOT NULL,
  baseline_event_high_watermark INTEGER NOT NULL,
  baseline_obligations_digest TEXT NOT NULL,
  compiled_from_json TEXT NOT NULL,
  compiler_version TEXT NOT NULL,
  renderer_version TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  facts_json TEXT NOT NULL,
  obligations_snapshot_json TEXT NOT NULL,
  digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (focus_id, revision),
  CHECK (revision >= 1)
);
CREATE TRIGGER IF NOT EXISTS focus_resume_packets_no_update BEFORE UPDATE ON focus_resume_packets
BEGIN SELECT RAISE(ABORT, 'focus_resume_packets immutable'); END;
CREATE TRIGGER IF NOT EXISTS focus_resume_packets_no_delete BEFORE DELETE ON focus_resume_packets
BEGIN SELECT RAISE(ABORT, 'focus_resume_packets immutable'); END;

CREATE TABLE IF NOT EXISTS action_execution_bindings(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  task_id TEXT NOT NULL,
  focus_revision_at_authorization INTEGER NOT NULL,
  selected_authority TEXT NOT NULL,
  phase TEXT NOT NULL,
  authorized_by_event_id TEXT NOT NULL,
  authoritative_ledger_ref TEXT,
  mode TEXT,
  settlement_ref TEXT,
  superseded_by_binding_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (selected_authority IN ('tier1','hopper')),
  CHECK (phase IN ('authorized','bound')),
  CHECK (mode IS NULL OR mode IN ('direct_to_review','step_confirm')),
  CHECK (phase != 'bound' OR authoritative_ledger_ref IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS action_execution_bindings_task_active
  ON action_execution_bindings(task_id) WHERE superseded_by_binding_id IS NULL;
`;

// v18(Focus Contract M3,2026-08-04):dispatch 收据冻结 Focus 授权快照(C5)。
// receipt 无 Focus 时 focus_id 等列为 NULL(显式路径:binding 不建)。
export const DDL_V18_FOCUS_AUTH_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS focus_auth_snapshots(
  receipt_id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT,
  focus_revision INTEGER,
  focus_anchor_revision INTEGER,
  authority_epoch INTEGER,
  created_at TEXT NOT NULL
);
`;

export function applyDdlV16FocusBatch1(db: DbLike): void {
  db.exec(DDL_V16_FOCUS_BATCH1);
  // sessions 两列:nullable/default,不改既有列语义
  addColumnIfMissing(db, "sessions", "primary_focus_id", "TEXT NULL REFERENCES focuses(id)");
  addColumnIfMissing(db, "sessions", "focus_anchor_revision", "INTEGER NOT NULL DEFAULT 0");
}

// v25(console 重设计批次②):attention 账本 ack——与 callback_outbox.acked_at 分账。
// item_id 含 conf:/ob:/task: 命名空间前缀;仅 green/gray(calm)可写,橙/蓝升级后过滤失效重现。
export const DDL_V25_ATTENTION_ACKS = `
CREATE TABLE IF NOT EXISTS attention_acks(
  item_id TEXT PRIMARY KEY NOT NULL,
  acked_at TEXT NOT NULL
);
`;

// v26(Focus v0.4 ④a):confirmation_ledger 跨域终局账——presented 插入/终局更新与 pending 同事务;
// payload_summary 白名单 + payload_digest;downgrade_* 供 ④b saga;remaining_intent 列留给 ④c。
export const DDL_V26_CONFIRMATION_LEDGER = `
CREATE TABLE IF NOT EXISTS confirmation_ledger(
  receipt_id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  outcome TEXT NULL,
  payload_summary_json TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  session_id TEXT NOT NULL,
  focus_id TEXT NULL,
  presented_at TEXT NOT NULL,
  finalized_at TEXT NULL,
  downgrade_status TEXT NOT NULL DEFAULT 'n/a',
  downgrade_payload_json TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT NULL,
  remaining_intent_json TEXT NULL,
  CHECK (outcome IS NULL OR outcome IN (
    'accepted','rejected','dismissed','to_screen','withdrawn','stale','expired'
  )),
  CHECK (downgrade_status IN ('n/a','pending','failed','done','abandoned')),
  CHECK (retry_count >= 0)
);
CREATE INDEX IF NOT EXISTS idx_conf_ledger_session ON confirmation_ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_conf_ledger_focus ON confirmation_ledger(focus_id);
CREATE INDEX IF NOT EXISTS idx_conf_ledger_finalized ON confirmation_ledger(finalized_at);
CREATE INDEX IF NOT EXISTS idx_conf_ledger_downgrade ON confirmation_ledger(downgrade_status);
`;

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, sql: DDL_V1 },
  { version: 2, sql: DDL_V2_AUDIT_IMMUTABLE },
  { version: 3, sql: DDL_V3_TASK_MESSAGES },
  { version: 4, sql: DDL_V4_TASK_MESSAGES_STEER },
  { version: 5, apply: applyDdlV5CatchUp },
  { version: 6, apply: applyDdlV6Decisions },
  { version: 7, sql: DDL_V7_PROJECT_SETTINGS },
  { version: 8, sql: DDL_V8_SUBSCRIPTION_RETRY },
  { version: 9, apply: applyDdlV9S3Card },
  { version: 10, apply: applyDdlV10ProjectsWriting },
  { version: 11, apply: applyDdlV11ProposedTtl },
  { version: 12, apply: applyDdlV12S3ChallengeBinding },
  { version: 13, apply: applyDdlV13ReadinessBindings },
  { version: 14, apply: applyDdlV14ProjectAnchors },
  { version: 15, sql: DDL_V15_PROJECT_TYPE_IMMUTABLE },
  { version: 16, apply: applyDdlV16FocusBatch1 },
  { version: 17, sql: DDL_V17_FOCUS_BATCH2 },
  { version: 18, sql: DDL_V18_FOCUS_AUTH_SNAPSHOTS },
  { version: 19, apply: applyDdlV19SnapshotSessionAnchor },
  { version: 20, apply: applyDdlV20FocusBatch1 },
  { version: 21, apply: applyDdlV21FocusEventsRebuild },
  { version: 22, apply: applyDdlV22FocusesRebuild },
  { version: 23, apply: applyDdlV23ObligationsLanesRebuild },
  { version: 24, apply: applyDdlV24ArtifactsRebuild },
  { version: 25, sql: DDL_V25_ATTENTION_ACKS },
  { version: 26, sql: DDL_V26_CONFIRMATION_LEDGER },
  { version: 27, apply: applyDdlV27ObligationProvenance },
  { version: 28, apply: applyDdlV28FocusExpectations },
  { version: 29, apply: applyDdlV29RestartPending },
  { version: 30, apply: applyDdlV30NativeSessionConfirmed }
];

// v29(D1 可分发运行时):可恢复退出使用 additive marker,不扩 tier1 run 状态机。
export function applyDdlV29RestartPending(db: DbLike): void {
  addColumnIfMissing(db, "tier1_runs", "restart_pending_at", "TEXT");
  addColumnIfMissing(db, "tier1_runs", "restart_reason", "TEXT");
  addColumnIfMissing(db, "tier1_runs", "budget_active_ms", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "tier1_runs", "budget_tool_calls", "INTEGER NOT NULL DEFAULT 0");
}

// v30(W5.4-b C2b):claude 会话钥匙确认位。老库缺省 0,既有 cursor 三元组行为不因该列改变。
export function applyDdlV30NativeSessionConfirmed(db: DbLike): void {
  addColumnIfMissing(
    db,
    "tier1_runs",
    "native_session_confirmed",
    "INTEGER NOT NULL DEFAULT 0 CHECK(native_session_confirmed IN (0,1))"
  );
}

// v27(Focus v0.4 ④b):focus_obligations.provenance 可选列——过期确认降格溯源
// (confirm_expired / confirm_expired_batch);不参与 obligationsDigest。
export function applyDdlV27ObligationProvenance(db: DbLike): void {
  addColumnIfMissing(
    db,
    "focus_obligations",
    "provenance",
    "TEXT NULL CHECK (provenance IS NULL OR provenance IN ('confirm_expired','confirm_expired_batch'))"
  );
}

// v28(Focus v0.4 ④d):Expectation aggregate——管理期待与执行边界分离;
// 部分唯一:每 logical_key 至多一行 active、至多一行 pending_ack。
export function applyDdlV28FocusExpectations(db: DbLike): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS focus_expectations(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  logical_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('acceptance','artifact','budget','due')),
  source_ref_json TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','pending_ack','superseded')),
  revision INTEGER NOT NULL,
  applies_from TEXT NOT NULL DEFAULT 'current' CHECK (applies_from IN ('current','next_dispatch')),
  created_from_event INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (revision >= 1)
);
CREATE INDEX IF NOT EXISTS idx_focus_exp_focus ON focus_expectations(focus_id);
CREATE INDEX IF NOT EXISTS idx_focus_exp_status ON focus_expectations(focus_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_exp_active
  ON focus_expectations(logical_key) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_exp_pending
  ON focus_expectations(logical_key) WHERE status = 'pending_ack';
`);
}

// v19(codex v0.3 审 A5,2026-08-05):授权快照锚定签发 session——
// 此前消费复核按 primary_focus_id 反查"最新一场会话",多会话复核错对象、
// 原会话换锚后查询落空静默跳过校验(fail-open)。存量行 session_id 为 NULL,
// 消费端对 NULL fail-closed 拒(receipt TTL 24h,无长期挂单)。
export function applyDdlV19SnapshotSessionAnchor(db: DbLike): void {
  addColumnIfMissing(db, "focus_auth_snapshots", "session_id", "TEXT NULL");
}

// v20(Focus Contract 批 1 / v0.3.3,2026-08-05):确认环 DB-authoritative + needs 列 +
// 产物表 + 空间表 + 会话任务上下文(additive;存量 needs 回填归批 1.5 v21)。
// DDL 形状一字不差抄 .contract-v032.md §2/§4.2/§5.1/§5.4。
export function applyDdlV20FocusBatch1(db: DbLike): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS pending_confirmations(
  session_id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  digest TEXT NOT NULL,
  digest_version INTEGER NOT NULL,
  sentence_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  focus_id TEXT NULL,
  presented_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_conf_focus ON pending_confirmations(focus_id);

CREATE TABLE IF NOT EXISTS focus_artifacts(
  id TEXT PRIMARY KEY,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  kind TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  ref_json TEXT NOT NULL,
  copied_from_artifact_id TEXT NULL,
  created_from_event INTEGER NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_spaces(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_task_context(
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  ref_kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  set_at TEXT NOT NULL
);
`);
  addColumnIfMissing(db, "focuses", "space_id", "TEXT NULL REFERENCES focus_spaces(id)");
  addColumnIfMissing(db, "focuses", "forked_from", "TEXT NULL");
  addColumnIfMissing(db, "focus_obligations", "needs", "TEXT NULL");
  db.exec(`
CREATE INDEX IF NOT EXISTS idx_focuses_space_lifecycle ON focuses(space_id, lifecycle);
CREATE INDEX IF NOT EXISTS idx_focuses_forked_from ON focuses(forked_from);
`);
}

/** 表 CREATE SQL(sqlite_master);无表则空串 */
function tableCreateSql(db: DbLike, name: string): string {
  const r = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name) as
    | { sql: string }
    | undefined;
  return r?.sql ?? "";
}

function countRows(db: DbLike, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

/** focus_events 内容指纹:(focus_id,seq,type,payload_json) 有序聚合 sha256 */
function focusEventsContentChecksum(db: DbLike, table: string): string {
  const rows = db
    .prepare(
      `SELECT focus_id, seq, type, payload_json FROM ${table} ORDER BY focus_id ASC, seq ASC`
    )
    .all() as { focus_id: string; seq: number; type: string; payload_json: string }[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(r.focus_id);
    h.update("\0");
    h.update(String(r.seq));
    h.update("\0");
    h.update(r.type);
    h.update("\0");
    h.update(r.payload_json);
    h.update("\n");
  }
  return h.digest("hex");
}

/** focuses 全列内容指纹(有序) */
function focusesContentChecksum(db: DbLike, table: string): string {
  const rows = db
    .prepare(
      `SELECT id, title, lifecycle, semantic_authority, authority_epoch, current_revision,
              created_at, updated_at, space_id, forked_from
         FROM ${table} ORDER BY id ASC`
    )
    .all() as {
    id: string;
    title: string;
    lifecycle: string;
    semantic_authority: string;
    authority_epoch: number;
    current_revision: number;
    created_at: string;
    updated_at: string;
    space_id: string | null;
    forked_from: string | null;
  }[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(
      [
        r.id,
        r.title,
        r.lifecycle,
        r.semantic_authority,
        String(r.authority_epoch),
        String(r.current_revision),
        r.created_at,
        r.updated_at,
        r.space_id ?? "",
        r.forked_from ?? ""
      ].join("\0")
    );
    h.update("\n");
  }
  return h.digest("hex");
}

function assertForeignKeyCheckClean(db: DbLike, version: number): void {
  const violations = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
  if (violations.length > 0) {
    throw new Error(
      `migration v${version} foreign_key_check failed: ${JSON.stringify(violations).slice(0, 300)}`
    );
  }
}

// v21(Focus Contract 批 1.5 / v0.3.3 §9.1,2026-08-05):focus_events controlled rebuild——
// 去掉封闭 type CHECK(新事件类型进枚举前不被 SQLite 拒),保留 UNIQUE(focus_id,seq) 与其余列/CHECK;
// type 校验上移 contracts zod + writeTx 写入口。同窗回填 focus_obligations.needs 存量
// (human 未结:decision→decision / answer→input / 其余→unknown;已有非 NULL 不动)。
// 失败抛错 ⇒ migrate 事务回滚,原表原位。
export function applyDdlV21FocusEventsRebuild(db: DbLike): void {
  const createSql = tableCreateSql(db, "focus_events");
  // 已是终形状(无 type CHECK)则跳过 rebuild,仍跑 needs 回填(幂等 WHERE needs IS NULL)
  const needsRebuild = /CHECK\s*\(\s*type\s+IN/i.test(createSql);
  if (needsRebuild) {
    const beforeCount = countRows(db, "focus_events");
    const beforeChecksum = focusEventsContentChecksum(db, "focus_events");

    db.exec(`
CREATE TABLE focus_events_v21(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  session_id TEXT,
  turn_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (focus_id, seq),
  CHECK (seq >= 1),
  CHECK (payload_schema_version >= 1),
  CHECK (actor_kind IN ('user','daemon','brain_proposal'))
);
INSERT INTO focus_events_v21(
  id, focus_id, seq, type, payload_schema_version, payload_json,
  actor_kind, session_id, turn_ref, created_at
)
SELECT
  id, focus_id, seq, type, payload_schema_version, payload_json,
  actor_kind, session_id, turn_ref, created_at
FROM focus_events;
`);

    const midCount = countRows(db, "focus_events_v21");
    if (midCount !== beforeCount) {
      throw new Error(
        `v21 focus_events rebuild row-count mismatch: before=${beforeCount} after_copy=${midCount}`
      );
    }
    const midChecksum = focusEventsContentChecksum(db, "focus_events_v21");
    if (midChecksum !== beforeChecksum) {
      throw new Error(
        `v21 focus_events rebuild content checksum mismatch: before=${beforeChecksum} after_copy=${midChecksum}`
      );
    }

    // DROP 不触发 DELETE 触发器(SQLite 文档);immutable 触发器随旧表销毁
    db.exec(`
DROP TABLE focus_events;
ALTER TABLE focus_events_v21 RENAME TO focus_events;
CREATE TRIGGER IF NOT EXISTS focus_events_no_update BEFORE UPDATE ON focus_events
BEGIN SELECT RAISE(ABORT, 'focus_events immutable'); END;
CREATE TRIGGER IF NOT EXISTS focus_events_no_delete BEFORE DELETE ON focus_events
BEGIN SELECT RAISE(ABORT, 'focus_events immutable'); END;
`);

    const afterCount = countRows(db, "focus_events");
    if (afterCount !== beforeCount) {
      throw new Error(
        `v21 focus_events rebuild row-count mismatch after swap: before=${beforeCount} after=${afterCount}`
      );
    }
    const afterChecksum = focusEventsContentChecksum(db, "focus_events");
    if (afterChecksum !== beforeChecksum) {
      throw new Error(
        `v21 focus_events rebuild content checksum mismatch after swap: before=${beforeChecksum} after=${afterChecksum}`
      );
    }
  }

  // 合同 §5.3 存量回填:仅 human 未结且 needs IS NULL;其余行保持 NULL
  db.exec(`
UPDATE focus_obligations
   SET needs = CASE kind
     WHEN 'decision' THEN 'decision'
     WHEN 'answer' THEN 'input'
     ELSE 'unknown'
   END
 WHERE needs IS NULL
   AND owner = 'human'
   AND status IN ('open','in_progress','waiting','deferred','blocked');
`);

  assertForeignKeyCheckClean(db, 21);
}

// v22(Focus Contract 批 1.5 / v0.3.3 §9.2,2026-08-05):focuses controlled rebuild——
// lifecycle CHECK 五值扩六值(+archived)。本批只放开约束,不实现 archive/reopen 行为(批 3)。
// 列保真含 v20 additive 的 space_id/forked_from;索引 idx_focuses_space_lifecycle /
// idx_focuses_forked_from 随 DROP 销毁后重建。
export function applyDdlV22FocusesRebuild(db: DbLike): void {
  const createSql = tableCreateSql(db, "focuses");
  if (createSql.includes("'archived'")) {
    assertForeignKeyCheckClean(db, 22);
    return;
  }

  const beforeCount = countRows(db, "focuses");
  const beforeChecksum = focusesContentChecksum(db, "focuses");

  db.exec(`
CREATE TABLE focuses_v22(
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  semantic_authority TEXT NOT NULL,
  authority_epoch INTEGER NOT NULL DEFAULT 0,
  current_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  space_id TEXT NULL REFERENCES focus_spaces(id),
  forked_from TEXT NULL,
  CHECK (lifecycle IN ('captured','active','dormant','closed','abandoned','archived')),
  CHECK (semantic_authority IN ('external_bootstrap','saydo')),
  CHECK (authority_epoch >= 0),
  CHECK (current_revision >= 0)
);
INSERT INTO focuses_v22(
  id, title, lifecycle, semantic_authority, authority_epoch, current_revision,
  created_at, updated_at, space_id, forked_from
)
SELECT
  id, title, lifecycle, semantic_authority, authority_epoch, current_revision,
  created_at, updated_at, space_id, forked_from
FROM focuses;
`);

  const midCount = countRows(db, "focuses_v22");
  if (midCount !== beforeCount) {
    throw new Error(`v22 focuses rebuild row-count mismatch: before=${beforeCount} after_copy=${midCount}`);
  }
  const midChecksum = focusesContentChecksum(db, "focuses_v22");
  if (midChecksum !== beforeChecksum) {
    throw new Error(
      `v22 focuses rebuild content checksum mismatch: before=${beforeChecksum} after_copy=${midChecksum}`
    );
  }

  // 父表重建:migrate() 连接级 foreign_keys=OFF,DROP 安全;提交前 foreign_key_check
  db.exec(`
DROP TABLE focuses;
ALTER TABLE focuses_v22 RENAME TO focuses;
CREATE INDEX IF NOT EXISTS idx_focuses_space_lifecycle ON focuses(space_id, lifecycle);
CREATE INDEX IF NOT EXISTS idx_focuses_forked_from ON focuses(forked_from);
`);

  const afterCount = countRows(db, "focuses");
  if (afterCount !== beforeCount) {
    throw new Error(
      `v22 focuses rebuild row-count mismatch after swap: before=${beforeCount} after=${afterCount}`
    );
  }
  const afterChecksum = focusesContentChecksum(db, "focuses");
  if (afterChecksum !== beforeChecksum) {
    throw new Error(
      `v22 focuses rebuild content checksum mismatch after swap: before=${beforeChecksum} after=${afterChecksum}`
    );
  }

  assertForeignKeyCheckClean(db, 22);
}

/** focus_obligations 内容指纹(v23 rebuild 用;关键列有序聚合) */
function obligationsContentChecksum(db: DbLike, table: string): string {
  const rows = db
    .prepare(
      `SELECT id, focus_id, kind, title, detail, owner, status, verification,
              waiting_on, defer_reason, next_step, due_or_trigger, blocking,
              project_ref, action_ref, source_session_id, source_turn_ref,
              dedupe_key, needs, resolution_event_id, resolution, created_at, updated_at
         FROM ${table} ORDER BY id ASC`
    )
    .all() as Record<string, string | number | null>[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(
      [
        r.id,
        r.focus_id,
        r.kind,
        r.title,
        r.detail ?? "",
        r.owner,
        r.status,
        r.verification,
        r.waiting_on ?? "",
        r.defer_reason ?? "",
        r.next_step ?? "",
        r.due_or_trigger ?? "",
        String(r.blocking),
        r.project_ref ?? "",
        r.action_ref ?? "",
        r.source_session_id ?? "",
        r.source_turn_ref ?? "",
        r.dedupe_key,
        r.needs ?? "",
        r.resolution_event_id ?? "",
        r.resolution ?? "",
        r.created_at,
        r.updated_at
      ].join("\0")
    );
    h.update("\n");
  }
  return h.digest("hex");
}

/** focus_artifacts 内容指纹(v24 rebuild) */
function artifactsContentChecksum(db: DbLike, table: string): string {
  const rows = db
    .prepare(
      `SELECT id, focus_id, kind, role, title, ref_json, copied_from_artifact_id,
              created_from_event, created_at
         FROM ${table} ORDER BY id ASC`
    )
    .all() as Record<string, string | number | null>[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(
      [
        r.id,
        r.focus_id,
        r.kind,
        r.role,
        r.title,
        r.ref_json,
        r.copied_from_artifact_id ?? "",
        r.created_from_event == null ? "" : String(r.created_from_event),
        r.created_at
      ].join("\0")
    );
    h.update("\n");
  }
  return h.digest("hex");
}

// v23(Focus Contract 批 3 / v0.3.4 §3.1/§9.3):focus_lanes 表 + obligations controlled rebuild
// 加 lane_id / created_from_event / waiting_on_obligation_id + 复合 FK;created_from_event
// 回填=obligation_opened 事件按 dedupeKey 反查 seq,匹配不到留 NULL。
export function applyDdlV23ObligationsLanesRebuild(db: DbLike): void {
  // 1) focus_lanes 表(幂等)
  db.exec(`
CREATE TABLE IF NOT EXISTS focus_lanes(
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  parent_lane_id TEXT NULL,
  created_from_event INTEGER NOT NULL,
  retired_at TEXT NULL,
  PRIMARY KEY (focus_id, id),
  FOREIGN KEY (focus_id, parent_lane_id) REFERENCES focus_lanes(focus_id, id),
  FOREIGN KEY (focus_id, created_from_event) REFERENCES focus_events(focus_id, seq)
);
`);

  const createSql = tableCreateSql(db, "focus_obligations");
  const hasLaneCol = /lane_id/i.test(createSql);
  if (!hasLaneCol) {
    const beforeCount = countRows(db, "focus_obligations");
    const beforeChecksum = obligationsContentChecksum(db, "focus_obligations");

    db.exec(`
CREATE TABLE focus_obligations_v23(
  id TEXT PRIMARY KEY NOT NULL,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  verification TEXT NOT NULL,
  waiting_on TEXT,
  defer_reason TEXT,
  next_step TEXT,
  due_or_trigger TEXT,
  blocking INTEGER NOT NULL DEFAULT 0,
  project_ref TEXT,
  action_ref TEXT,
  source_session_id TEXT,
  source_turn_ref TEXT,
  dedupe_key TEXT NOT NULL,
  needs TEXT,
  resolution_event_id TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  lane_id TEXT NULL,
  created_from_event INTEGER NULL,
  waiting_on_obligation_id TEXT NULL,
  UNIQUE (focus_id, dedupe_key),
  CHECK (kind IN ('answer','decision','action','followup','check')),
  CHECK (owner IN ('human','agent','external')),
  CHECK (status IN ('open','in_progress','waiting','deferred','blocked','resolved','superseded')),
  CHECK (verification IN ('provisional','unverified','confirmed')),
  CHECK (blocking IN (0,1)),
  CHECK (resolution IS NULL OR resolution IN ('done','abandoned','superseded','no_longer_applicable')),
  CHECK (status NOT IN ('waiting','blocked') OR waiting_on IS NOT NULL),
  CHECK (status != 'deferred' OR defer_reason IS NOT NULL),
  CHECK (status NOT IN ('resolved','superseded') OR (resolution_event_id IS NOT NULL AND resolution IS NOT NULL)),
  CHECK (NOT (verification = 'unverified' AND status = 'resolved' AND resolution = 'done')),
  FOREIGN KEY (focus_id, lane_id) REFERENCES focus_lanes(focus_id, id)
);
INSERT INTO focus_obligations_v23(
  id, focus_id, kind, title, detail, owner, status, verification,
  waiting_on, defer_reason, next_step, due_or_trigger, blocking,
  project_ref, action_ref, source_session_id, source_turn_ref,
  dedupe_key, needs, resolution_event_id, resolution, created_at, updated_at,
  lane_id, created_from_event, waiting_on_obligation_id
)
SELECT
  id, focus_id, kind, title, detail, owner, status, verification,
  waiting_on, defer_reason, next_step, due_or_trigger, blocking,
  project_ref, action_ref, source_session_id, source_turn_ref,
  dedupe_key, needs, resolution_event_id, resolution, created_at, updated_at,
  NULL, NULL, NULL
FROM focus_obligations;
`);

    const midCount = countRows(db, "focus_obligations_v23");
    if (midCount !== beforeCount) {
      throw new Error(
        `v23 obligations rebuild row-count mismatch: before=${beforeCount} after_copy=${midCount}`
      );
    }
    // 新列全 NULL,关键列 checksum 与旧表一致
    const midChecksum = obligationsContentChecksum(db, "focus_obligations_v23");
    if (midChecksum !== beforeChecksum) {
      throw new Error(
        `v23 obligations rebuild content checksum mismatch: before=${beforeChecksum} after_copy=${midChecksum}`
      );
    }

    db.exec(`
DROP TABLE focus_obligations;
ALTER TABLE focus_obligations_v23 RENAME TO focus_obligations;
`);

    const afterCount = countRows(db, "focus_obligations");
    if (afterCount !== beforeCount) {
      throw new Error(
        `v23 obligations rebuild row-count mismatch after swap: before=${beforeCount} after=${afterCount}`
      );
    }
    const afterChecksum = obligationsContentChecksum(db, "focus_obligations");
    if (afterChecksum !== beforeChecksum) {
      throw new Error(
        `v23 obligations rebuild content checksum mismatch after swap: before=${beforeChecksum} after=${afterChecksum}`
      );
    }
  }

  // created_from_event 回填:obligation_opened 事件按 dedupeKey 反查 seq;匹配不到留 NULL
  db.exec(`
UPDATE focus_obligations
   SET created_from_event = (
     SELECT e.seq FROM focus_events e
      WHERE e.focus_id = focus_obligations.focus_id
        AND e.type = 'obligation_opened'
        AND json_extract(e.payload_json, '$.dedupeKey') = focus_obligations.dedupe_key
      ORDER BY e.seq ASC
      LIMIT 1
   )
 WHERE created_from_event IS NULL;
`);

  db.exec(`
CREATE INDEX IF NOT EXISTS idx_obligations_lane ON focus_obligations(focus_id, lane_id);
CREATE INDEX IF NOT EXISTS idx_obligations_waiting ON focus_obligations(waiting_on_obligation_id)
  WHERE waiting_on_obligation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obligations_attention ON focus_obligations(owner, status, needs, updated_at);
`);

  assertForeignKeyCheckClean(db, 23);
}

// v24(Focus Contract 批 3 / v0.3.4 §4.2/§9.3):focus_artifacts rebuild 补
// created_from_event 复合 FK(focus_id, created_from_event) → focus_events。
export function applyDdlV24ArtifactsRebuild(db: DbLike): void {
  const createSql = tableCreateSql(db, "focus_artifacts");
  // 已含复合 FK 则跳过(幂等)
  if (/FOREIGN KEY\s*\(\s*focus_id\s*,\s*created_from_event\s*\)/i.test(createSql)) {
    assertForeignKeyCheckClean(db, 24);
    return;
  }

  const beforeCount = countRows(db, "focus_artifacts");
  const beforeChecksum = artifactsContentChecksum(db, "focus_artifacts");

  db.exec(`
CREATE TABLE focus_artifacts_v24(
  id TEXT PRIMARY KEY,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  kind TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  ref_json TEXT NOT NULL,
  copied_from_artifact_id TEXT NULL,
  created_from_event INTEGER NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (focus_id, created_from_event) REFERENCES focus_events(focus_id, seq)
);
INSERT INTO focus_artifacts_v24(
  id, focus_id, kind, role, title, ref_json, copied_from_artifact_id, created_from_event, created_at
)
SELECT
  id, focus_id, kind, role, title, ref_json, copied_from_artifact_id, created_from_event, created_at
FROM focus_artifacts;
`);

  const midCount = countRows(db, "focus_artifacts_v24");
  if (midCount !== beforeCount) {
    throw new Error(`v24 artifacts rebuild row-count mismatch: before=${beforeCount} after_copy=${midCount}`);
  }
  const midChecksum = artifactsContentChecksum(db, "focus_artifacts_v24");
  if (midChecksum !== beforeChecksum) {
    throw new Error(
      `v24 artifacts rebuild content checksum mismatch: before=${beforeChecksum} after_copy=${midChecksum}`
    );
  }

  db.exec(`
DROP TABLE focus_artifacts;
ALTER TABLE focus_artifacts_v24 RENAME TO focus_artifacts;
`);

  const afterCount = countRows(db, "focus_artifacts");
  if (afterCount !== beforeCount) {
    throw new Error(
      `v24 artifacts rebuild row-count mismatch after swap: before=${beforeCount} after=${afterCount}`
    );
  }
  const afterChecksum = artifactsContentChecksum(db, "focus_artifacts");
  if (afterChecksum !== beforeChecksum) {
    throw new Error(
      `v24 artifacts rebuild content checksum mismatch after swap: before=${beforeChecksum} after=${afterChecksum}`
    );
  }

  assertForeignKeyCheckClean(db, 24);
}

// v14(场次① 2026-07-30 live 阻断回修):external local workspace canonical 唯一索引、
// session.project 单调 revision 与 durable event。存量 external workspace 必须能 realpath，
// exact/父子冲突均 fail-closed，避免迁移后同目录被重复登记。
export function applyDdlV14ProjectAnchors(db: DbLike): void {
  addColumnIfMissing(db, "projects", "canonical_workspace_path", "TEXT");
  addColumnIfMissing(db, "projects", "workspace_dev", "TEXT");
  addColumnIfMissing(db, "projects", "workspace_ino", "TEXT");
  addColumnIfMissing(db, "sessions", "project_revision", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "sessions", "anchor_readiness_revision", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "sessions", "anchor_pack_revision", "INTEGER NOT NULL DEFAULT 0");

  const rows = db
    .prepare("SELECT id, workspace_json FROM projects WHERE status != 'archived'")
    .all() as { id: string; workspace_json: string }[];
  const external: { id: string; path: string }[] = [];
  for (const row of rows) {
    let workspace: { kind?: string; path?: string; managed?: boolean };
    try {
      workspace = JSON.parse(row.workspace_json) as typeof workspace;
    } catch {
      throw new Error(`v14 project ${row.id} workspace_json invalid`);
    }
    if (workspace.kind !== "local_folder") continue;
    if (typeof workspace.path !== "string" || workspace.path === "") {
      throw new Error(`v14 project ${row.id} local workspace path missing`);
    }
    if (workspace.managed !== false) {
      try {
        validateManagedWorkspace(row.id, workspace.path);
      } catch (err) {
        const code = err instanceof WorkspacePolicyError ? err.code : "workspace_invalid";
        throw new Error(`v14 project ${row.id} managed workspace rejected: ${code}`);
      }
      continue;
    }
    external.push({ id: row.id, path: workspace.path });
  }

  const canonical: { id: string; path: string; dev: string; ino: string }[] = external.map((item) => {
    try {
      return { id: item.id, ...canonicalizeWorkspace(item.path) };
    } catch (err) {
      const code = err instanceof WorkspacePolicyError ? err.code : "workspace_invalid";
      throw new Error(`v14 project ${item.id} workspace rejected: ${code}`);
    }
  });
  canonical.sort((a, b) => a.path.localeCompare(b.path));
  for (let i = 0; i < canonical.length; i++) {
    for (let j = i + 1; j < canonical.length; j++) {
      const a = canonical[i] as { id: string; path: string };
      const b = canonical[j] as { id: string; path: string };
      const rel = relative(a.path, b.path);
      if (a.path === b.path || (rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`))) {
        throw new Error(`v14 workspace conflict: ${a.id} <-> ${b.id}`);
      }
    }
  }
  const update = db.prepare(
    "UPDATE projects SET workspace_json=?, canonical_workspace_path=?, workspace_dev=?, workspace_ino=? WHERE id=?"
  );
  for (const item of canonical) {
    update.run(JSON.stringify({ kind: "local_folder", path: item.path, managed: false }), item.path, item.dev, item.ino, item.id);
  }

  db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS project_live_workspace_unique ON projects(canonical_workspace_path)
  WHERE canonical_workspace_path IS NOT NULL AND status != 'archived';
CREATE TRIGGER IF NOT EXISTS project_external_workspace_insert_guard BEFORE INSERT ON projects
WHEN NEW.status != 'archived'
 AND json_extract(NEW.workspace_json, '$.kind') = 'local_folder'
 AND json_extract(NEW.workspace_json, '$.managed') = 0
 AND (NEW.canonical_workspace_path IS NULL OR NEW.workspace_dev IS NULL OR NEW.workspace_ino IS NULL
      OR json_extract(NEW.workspace_json, '$.path') IS NOT NEW.canonical_workspace_path)
BEGIN SELECT RAISE(ABORT, 'external workspace registry incomplete'); END;
CREATE TRIGGER IF NOT EXISTS project_external_workspace_update_guard BEFORE UPDATE OF status, workspace_json,
  canonical_workspace_path, workspace_dev, workspace_ino ON projects
WHEN NEW.status != 'archived'
 AND json_extract(NEW.workspace_json, '$.kind') = 'local_folder'
 AND json_extract(NEW.workspace_json, '$.managed') = 0
 AND (NEW.canonical_workspace_path IS NULL OR NEW.workspace_dev IS NULL OR NEW.workspace_ino IS NULL
      OR json_extract(NEW.workspace_json, '$.path') IS NOT NEW.canonical_workspace_path)
BEGIN SELECT RAISE(ABORT, 'external workspace registry incomplete'); END;
CREATE TABLE IF NOT EXISTS session_project_events(id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id), project_id TEXT NOT NULL REFERENCES projects(id),
  project_revision INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(session_id, project_revision),
  CHECK (reason IN ('draft_created','workspace_adopted','draft_reanchored','migration_snapshot')));
INSERT OR IGNORE INTO session_project_events(id, session_id, project_id, project_revision, reason, created_at)
SELECT 'evt_' || substr(hex(randomblob(16)),1,26),
       id, project_id, project_revision, 'migration_snapshot', started_at FROM sessions;
CREATE TRIGGER IF NOT EXISTS session_anchor_revision_update_guard BEFORE UPDATE OF project_revision,
  anchor_readiness_revision, anchor_pack_revision ON sessions
WHEN NEW.anchor_readiness_revision < 0 OR NEW.anchor_pack_revision < 0
  OR NEW.anchor_readiness_revision > NEW.project_revision
  OR NEW.anchor_pack_revision > NEW.project_revision
BEGIN SELECT RAISE(ABORT, 'session anchor revision invalid'); END;
`);
}

// v13(A3-armed,2026-07-28;09 §13 covered 块 + §9):全 additive——
// memory_events.readiness_key(候选绑定 key)/ readiness_assessments.{checklist_digest,evidence_digest}
// (清单/证据版本指纹)/ readiness_bindings 新表(确认绑定一等实体,user_approved 的机械承载)。
// 老库无回填(历史零 key = 全 unknown 是 fail-closed 正确语义;存量激活走引导重绑,禁自动 backfill)。
export function applyDdlV13ReadinessBindings(db: DbLike): void {
  addColumnIfMissing(db, "memory_events", "readiness_key", "TEXT");
  addColumnIfMissing(db, "readiness_assessments", "checklist_digest", "TEXT");
  addColumnIfMissing(db, "readiness_assessments", "evidence_digest", "TEXT");
  db.exec(`CREATE TABLE IF NOT EXISTS readiness_bindings(id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL, key TEXT NOT NULL, axis TEXT NOT NULL CHECK(axis IN ('knowledge','requirement')),
  mem_id TEXT NOT NULL, claim_digest TEXT NOT NULL,
  snapshot_id TEXT,
  receipt_id TEXT NOT NULL,
  session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
  foundation_generation INTEGER,
  bound_at TEXT NOT NULL, superseded_at TEXT, superseded_by TEXT,
  CHECK ((axis = 'knowledge') = (foundation_generation IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS readiness_bindings_active ON readiness_bindings(project_id, key) WHERE superseded_at IS NULL;`);
}

// v12(RA-closeout,2026-07-28;Codex 22 A2 残余):s3_challenges 加挑战目标绑定三列——
// merge 挑战签发时点固化 attempt/package_revision(防签发后 run 换代/包换版仍被消费);
// register 挑战强制可审计 owner intent(session_id 或 bootstrap_intent_id 至少一个非空)且 project_id 必空。
// 老库表重建:老 merge 行经 approvals(s3_challenge_id UNIQUE)JOIN 回填真实 attempt/package_revision
// (已消费挑战必有收据,数据诚实不造数);无收据的未消费/过期 merge 行删除(120s 短命凭证,无 FK 引用,
// 删行审计计数;挑战签发/消费的审计链在 audit_log 不受影响);老 register 行 intent 兜底
// COALESCE(session_id, 'pre-v12-grandfathered')——占位语义如实标注迁移前历史行。
export function applyDdlV12S3ChallengeBinding(db: DbLike): void {
  if (hasColumn(db, "s3_challenges", "attempt")) return; // 新库或已迁移
  const before = (db.prepare("SELECT COUNT(*) AS c FROM s3_challenges").get() as { c: number }).c;
  const orphanMerge = (
    db.prepare(
      `SELECT COUNT(*) AS c FROM s3_challenges c WHERE c.action='merge'
         AND NOT EXISTS (SELECT 1 FROM approvals a WHERE a.s3_challenge_id = c.id)`
    ).get() as { c: number }
  ).c;
  db.exec(`
CREATE TABLE s3_challenges_v12(id TEXT PRIMARY KEY NOT NULL, challenge TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL, ref_digest TEXT NOT NULL, prospective_tree_sha TEXT,
  task_id TEXT, project_id TEXT, attempt INTEGER, package_revision INTEGER,
  session_id TEXT, bootstrap_intent_id TEXT,
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL,
  CHECK (action IN ('register','merge','publish','deploy','delete_data','external_send','force_push')),
  CHECK (action != 'merge' OR (task_id IS NOT NULL AND project_id IS NOT NULL AND prospective_tree_sha IS NOT NULL
         AND attempt IS NOT NULL AND package_revision IS NOT NULL)),
  CHECK (action != 'register' OR (task_id IS NULL AND project_id IS NULL AND prospective_tree_sha IS NULL
         AND (session_id IS NOT NULL OR bootstrap_intent_id IS NOT NULL))));
INSERT INTO s3_challenges_v12(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id,
    attempt, package_revision, session_id, bootstrap_intent_id, expires_at, consumed_at, created_at)
  SELECT c.id, c.challenge, c.action, c.ref_digest, c.prospective_tree_sha, c.task_id, c.project_id,
         a.attempt, a.package_revision, c.session_id, NULL, c.expires_at, c.consumed_at, c.created_at
    FROM s3_challenges c JOIN approvals a ON a.s3_challenge_id = c.id
   WHERE c.action = 'merge'
  UNION ALL
  SELECT c.id, c.challenge, c.action, c.ref_digest, NULL, NULL, NULL,
         NULL, NULL, c.session_id, CASE WHEN c.session_id IS NULL THEN 's3i_00000000000000000000000000' ELSE NULL END,
         c.expires_at, c.consumed_at, c.created_at
    FROM s3_challenges c
   WHERE c.action = 'register';
DROP TABLE s3_challenges;
ALTER TABLE s3_challenges_v12 RENAME TO s3_challenges;
`);
  // grandfather 兜底值用 idSchema 合法形状(全零 ULID;语义 = 迁移前历史行的占位 intent——回读 parse 不炸,code-review B-1)
  const after = (db.prepare("SELECT COUNT(*) AS c FROM s3_challenges").get() as { c: number }).c;
  if (after !== before - orphanMerge) {
    throw new Error(`v12 s3_challenges migration row mismatch: before=${before} after=${after} droppedOrphanMerge=${orphanMerge}`);
  }
  if (orphanMerge > 0) {
    // 孤儿删除留痕(code-review B-2):无收据引用的过期/未消费 merge 挑战(120s 短命凭证)——审计行不随迁移事务外的任何回滚丢失语义
    db.prepare("INSERT INTO audit_log(id, ts, actor, action, meta_json) VALUES (?, ?, 'daemon', 'migration.v12_orphan_merge_dropped', ?)").run(
      `aud_v12orphan${Date.now().toString(36)}`,
      new Date().toISOString(),
      JSON.stringify({ dropped: orphanMerge })
    );
  }
}
