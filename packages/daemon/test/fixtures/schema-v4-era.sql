CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);
CREATE TABLE projects(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL,
  status TEXT NOT NULL, reanchored_to TEXT,
  workspace_json TEXT NOT NULL, hopper_project_id TEXT, exec_mode_default TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (type IN ('coding','planning','research','marketing','general','pending')),
  CHECK (status IN ('draft','active','archived')));
CREATE TABLE sessions(id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
  state TEXT NOT NULL, engine TEXT NOT NULL,
  transcript_path TEXT NOT NULL, context_digest TEXT, started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE decision_packages(id TEXT, revision INTEGER, digest TEXT UNIQUE, project_id TEXT,
  body_json TEXT, status TEXT, expires_at TEXT, created_at TEXT, PRIMARY KEY(id, revision));
CREATE TABLE approvals(id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, ref_digest TEXT NOT NULL,
  parent_package_digest TEXT, effect TEXT, grant_digest TEXT, task_id TEXT, session_id TEXT, turn_ref TEXT,
  risk TEXT NOT NULL, principal TEXT NOT NULL DEFAULT 'owner', decided_via TEXT NOT NULL,
  auth_strength TEXT NOT NULL, decision TEXT,
  nonce TEXT UNIQUE NOT NULL, outcome TEXT NOT NULL DEFAULT 'pending',
  issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, decided_at TEXT, consumed_at TEXT,
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
  CHECK (kind != 'runtime_effect' OR decided_via = 'preauthorized' OR turn_ref IS NOT NULL),
  CHECK (decided_via != 'voice' OR turn_ref IS NOT NULL));
CREATE TABLE tasks(id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
  package_id TEXT, package_rev INTEGER, package_digest TEXT,
  title TEXT NOT NULL, spec_markdown TEXT NOT NULL, route TEXT NOT NULL, status TEXT NOT NULL,
  cancel_reason TEXT, supersedes TEXT, adapter TEXT, native_session_id TEXT, cwd TEXT,
  budget_json TEXT NOT NULL, actual_cost_ref TEXT, parked_at TEXT, parked_deadline TEXT,
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
  CHECK (op IN ('add','correct','invalidate','forget_soft','forget_hard','consolidate')),
  CHECK (op NOT IN ('invalidate','forget_soft','forget_hard')
         OR (payload_json IS NOT NULL AND payload_json NOT IN ('','{}','null'))),
  CHECK (op != 'forget_hard' OR generation IS NOT NULL));
CREATE VIRTUAL TABLE memory_fts USING fts5(claim, tokenize = 'trigram');
CREATE TABLE context_snapshots(pack_digest TEXT PRIMARY KEY, session_id TEXT, compiler_version TEXT,
  body_json TEXT, created_at TEXT);
CREATE TABLE readiness_assessments(id TEXT PRIMARY KEY, session_id TEXT, package_ref TEXT,
  verdict TEXT, dims_json TEXT, blocking_criticals_json TEXT, evaluator_model TEXT,
  outcome TEXT, created_at TEXT);
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
  worktree_path TEXT NOT NULL, tree_sha TEXT, event_cursor TEXT,
  state TEXT NOT NULL, settle_proof_json TEXT, cancel_proof_json TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (adapter IN ('claude_code','cursor','codex')),
  CHECK (state IN ('reserved','running','step_paused','settled_review','settled_failed','cancel_requested','cancel_settled')));
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log immutable (E3)'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log immutable (E3)'); END;
CREATE TABLE "task_messages"(id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  attempt INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retry','review_comments','steer')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL);
CREATE INDEX task_messages_task ON task_messages(task_id, attempt);
