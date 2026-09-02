# PG-00 I plan/import 零上下文只读复审

你是全新、零上下文、只读的 PG-00 import readback reviewer。不得继承实施会话的自述、
推理或“已完成”断言。不得改文件，不得创建 E 文件，不得运行产品测试、构建、真实账号、
connector、deploy、push、merge、付费、数据删除或 week-audit writer。不得创建 subagent。
允许只读 Git、文本检索，以及 `FG-PG00-I` 三个静态门。

本 prompt 的唯一问题：当前 feature branch 上那个声称是 I 的本地 commit，是否满足 D17
`docs/plan/2026-08-28-project-gap-d17-import-spec.md` 第 3.1 / 第 4 / 第 6 节对 I 的
exact assertions。不能根据实施自述判定。

## 0. 现场工作区

必须在 **clean detached validation worktree** 中审查，且该 worktree 的 `HEAD` 恰等于被审
I 的完整 commit OID：

```text
git fetch --no-tags 不需要；不要 push
git worktree add --detach <mktemp-d> <full-I-OID>
cd <worktree>
git rev-parse HEAD
git rev-parse HEAD^{tree}
git rev-parse HEAD^
git status --porcelain=v1 --untracked-files=all
```

worktree 必须干净。不要复用实施会话工作树，不要在 dirty 主工作树上“就地”审查。
现场解析完整 `I` OID / tree / parent；把这三个值写入报告，不得抄实施汇报。

## 1. 锁定输入（现场重算，不得信任文档里的转述）

| 项 | 期望 |
|---|---|
| locked HEAD | `280b0cfa1594a8963bed2a4b730734915a3762b0` |
| branch（实施时所在） | `codex/project-gap-plans-20260828` |
| `parent(I)` | 必须等于 locked HEAD |
| import spec raw SHA-256 | `9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf` |
| program raw SHA-256 | `fa6f8c8aeb7f3e7727bfd3f440a5e01dce0413a311dc44f35425f7038a3bc8f5` |
| I path exact-set | 见第 2 节七个字面路径 |

现场命令：

```text
git rev-parse HEAD^
git cat-file -p HEAD | sed -n '1,8p'
git diff --name-status --no-renames -z 280b0cfa1594a8963bed2a4b730734915a3762b0 HEAD
python3 -c "import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())" < docs/plan/2026-08-28-project-gap-d17-import-spec.md
python3 -c "import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())" < docs/plan/2026-08-28-project-gap-closure-program.md
git show HEAD:docs/plan/2026-08-28-project-gap-d17-import-spec.md | python3 -c "import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())"
git show HEAD:docs/plan/2026-08-28-project-gap-closure-program.md | python3 -c "import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())"
```

spec / program 的 working-tree raw SHA-256 必须分别与 `HEAD:path` blob SHA-256 全等，并与
上表锁定值全等。任一 byte 变化则旧 semantic review 与 D17 签署同时失效：本审查必须
`verdict=fail`，且不得授权 E。

## 2. D17 §3.1 路径与越权

`diff_pathset(locked_HEAD,I)` 必须恰等于下列七个字面路径，不多不少：

1. `HANDOFF.md`
2. `docs/plan/IMPLEMENTATION-PLAN-2.md`
3. `docs/plan/README.md`
4. `docs/plan/2026-08-28-project-gap-closure-program.md`
5. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
6. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
7. `prompts/221-project-gap-pg00-import-readback.md`

集合外任何路径都是 A 级。`git add -A`、产品代码、canonical `docs/01–11`、测试、runtime、
历史 evidence、`e2e/evidence/project-gap-pg-00.md`、`research/codex-findings/221-project-gap-pg00-import-readback.md`
进入 I 都失败。七个路径的 Git mode 必须是 `100644`。

`docs/plan/README.md`、`docs/plan/2026-08-28-project-gap-closure-program.md`、
`docs/plan/2026-08-28-project-gap-d17-import-spec.md` 相对其 I 前 working bytes 必须零变化：
只作为已签输入进入 I，不得被本批改写。

## 3. D17 §4 postimage

### 3.1 HANDOFF

- active 保持空：`HANDOFF_active == none`
- 唯一 next：`HANDOFF_next == PG-01A`；不得把 `PG-01A` 标成已开工；不得另有第二个 current next
- 开工先读链必须包含：
  `docs/plan/2026-08-28-project-gap-closure-program.md`、
  `docs/plan/2026-08-28-project-gap-d17-import-spec.md`、
  `docs/plan/2026-08-28-project-gap-owner-decisions.md`
- 历史原文必须保留；只允许当前指针与必要 supersede 说明

### 3.2 PLAN-2

- 唯一串行链必须可判定为：
  `PLAN2_chain == PG-01A>PG-01B>PG-02>PG-03>PG-04>PG-05>PG-06>owner-stop`
- 每批必须逐字、可判定地登记：depends_on、A-ID exact-set、scope roots、focused/full gate、
  evidence path、回滚上限、deferred exact-set
- 上述字段内容必须来自 closure program §20 批卡，不得新增功能或另造控制平台
- 历史批次、旧 evidence 与原文必须保留；只增加 superseded/disposition
- `PLAN2-default-all` 必须 `superseded`；未被 exact 选入的未来项一律 deferred；取消“缺省全做”

### 3.3 legacy disposition exact-set

`PLAN2_legacy_disposition_id_exact_set` 必须与下表 18 行全等。缺项、重复、删除历史节点或
保留第二个 active/next 都是失败。

| legacy node | disposition |
|---|---|
| `AI-ACTIVE` | `superseded_by_PG-00_chain` |
| `AI-DRAFT` | `archive_deferred` |
| `W5.4-c` | `conditional_release_evidence` |
| `W5.3-tail` | `inventory_deferred(trigger=PLAN-2 §6.10)` |
| `W5.6` | `inventory_deferred` |
| `W5.8` | `inventory_deferred` |
| `W5.9` | `inventory_deferred` |
| `W5.11-rest-six` | `inventory_deferred` |
| `R-B` | `split_deferred` |
| `R-C` | `inventory_deferred` |
| `A5-armed` | `not_authorized` |
| `A5-UI` | `not_authorized` |
| `W6` | `inventory_deferred` |
| `W7` | `inventory_deferred` |
| `W8` | `inventory_deferred` |
| `W9` | `preserved_trigger_track` |
| `PLAN2-default-all` | `superseded` |
| `Codex-app-server` | `deferred_by_AI_decision_2` |

### 3.4 owner / spec / program digest binding

- owner decision：D17 为 `[x]`，日期 `2026-08-29`，owner 批准原文必须与下列字面全等：

> 批准 D17；绑定 import spec SHA-256=9159d69ba91f3676cb96a896ac55f7e3976cc503e5212f1b378089de997940cf；授权 PG-00 在当前专用 feature branch 上只以 import spec 明示的 I/E required path 与 week-audit 七项 allowlist 实际变化子集创建仅本地 I plan/import commit 与 E evidence commit，并创建一个 clean validation worktree 及 exact ignored review logs；不授权产品代码实施、推送、合并、部署、真实账号/connector/产品外部调用、付费、既有、用户、产品或历史数据删除、条件包。

- 该签署不得扩大到 D1–D16 / D18–D19；这些项必须仍为未签
- `sha256(I:docs/plan/2026-08-28-project-gap-d17-import-spec.md)` 必须等于 owner 原话中的 64 hex
- `sha256(I:docs/plan/2026-08-28-project-gap-closure-program.md)` 必须等于冻结值
  `fa6f8c8aeb7f3e7727bfd3f440a5e01dce0413a311dc44f35425f7038a3bc8f5`

## 4. FG-PG00-I 三个静态门

在 clean detached I worktree 上直接运行，记录 exit；skip、命令不存在或在另一 SHA 运行都不算绿。

1. `bash scripts/check-emoji.sh`
2. `node scripts/check-doc-links.mjs`
3. `git diff --check 280b0cfa1594a8963bed2a4b730734915a3762b0 <full-I-OID>`

再加上 D17 第 4 节 I 调度断言（第 3 节全部条款）。OID 必须是现场解析的完整 I commit OID。

不要运行 `just ci`、Playwright、产品测试、week-audit、PG-01A–PG-06 门或任何外部调用。

## 5. D17 §6 与本审查相关的 I 断言

本审查至少机械核对：

```text
parent(I) == locked_HEAD
diff_pathset(locked_HEAD,I) == section_3_1
spec_raw_sha256_in_owner_message == sha256(I:docs/plan/2026-08-28-project-gap-d17-import-spec.md)
program_frozen_sha256 == sha256(I:docs/plan/2026-08-28-project-gap-closure-program.md)
reviewed_commit == I
HANDOFF_active == none
HANDOFF_next == PG-01A
PLAN2_chain == PG-01A>PG-01B>PG-02>PG-03>PG-04>PG-05>PG-06>owner-stop
PLAN2_legacy_disposition_id_exact_set == section_4_2
push == not_run
merge == not_run
product_tests == not_run
```

E 相关断言（`parent(E)`、E pathset、week-audit、porcelain empty）不属于本 prompt；
本审查不得创建 `e2e/evidence/project-gap-pg-00.md` 或
`research/codex-findings/221-project-gap-pg00-import-readback.md`。

## 6. 输出合同

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 finding；每条含稳定 ID、真实 `file:line` 或真实命令
输出、可复现失败与最小修法。B/C 必须逐项 disposition，取值只能是
`fix_now|tracked|deferred_with_trigger|rejected_with_reason`。

硬门：

- `verdict=pass` **且** `A_open_exact_set` 为空 **且** B/C disposition 完整，才允许后续会话形成 E
- 任一 A 非空，或 B/C 缺 disposition，则 `E_authorized=no`
- 不得根据实施自述、聊天摘要或未在本 worktree 重跑的命令输出给 pass

最后必须给出：

```text
verdict=pass|fail
reviewed_I=<full commit OID>
reviewed_tree=<full tree OID>
reviewed_parent=<full parent OID>
A_open_exact_set={...}
B_open_exact_set={...}
C_open_exact_set={...}
B_disposition_complete=yes|no
C_disposition_complete=yes|no
E_authorized=yes|no
FG-PG00-I_emoji=<exit>
FG-PG00-I_doc_links=<exit>
FG-PG00-I_diff_check=<exit>
fix_list=...
```

列出实际只读命令与未运行项。修复清单只写使 I 满足 D17 第 3.1 / 第 4 / 第 6 节所必需的
最小修正。spec 或 program 任一 byte 变化必须标注为“签署失效，回到 D17 第 2.2 节重审重签”，
不能当作普通 I 返工。
