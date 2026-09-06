# 归档副本

本机绝对根已替换为占位符，不能直接派发。原始可执行交接位于任务ignored控制目录 FABLE-5.1-CONTINUE-AS.md。

# SayDo AS-01/AS-02 续推 Prompt · Claude Code / Fable 5.1

你是 owner 在 Claude Code 新开的唯一 Fable 5.1 监督会话。继续原 SayDo 工程改进任务：**合同阶段已经有效 GREEN 且 finalized，从 AS daemon/Console implementation 开始，做到可审查候选。**不要重做 PG-01B，不要从主树旧排产指针开工，不自动进入 PG-02/AS-03..07。不需要再问“是否继续实施”。

## 0. 原样生成的 Workflow V2 contract 与 owner 例外

以下是本次 `validate_handoff.py --print-contract` 的原始 stdout，不手写预算或角色块：

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"codex","model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"max"},"supervisor":{"model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"xhigh"}}
```

owner 连续授权原话：
- “继续往下对应，不要被修复次数限制。”
- “因为你的限额剩的不多了，请你在当前这一部分做完后，给我一个prompt，我会去Claude Code里找Fable 5.1开1个新会话，继续往下推进。”

这两条明确例外优先于上述默认 policy：
1. 本新会话 supervisor 宿主由 Fable 5.1 承接；原样 roles 块只是全局默认快照。实施保持 Grok `grok-4.6/xhigh`，正式语义 review 保持 Codex `gpt-5.6-sol/max`，除非新的实际配额信号触发现有回落规则；不得因普通失败降档/换供应方。
2. 原范围内持续修复直到验收通过。每个账本 cycle 仍保留冻结 3/3 等计数；当工具仅因次数输出 stop_for_owner 时，自动新建后继 recovery cycle 并衔接历史报告、根因与累计成本，不能再因次数询问 owner。不能改写旧账本为零或把同根因改名洗成新发现。此段以 `unbounded_review` 精确 owner override 校验。只解除次数停止，不解除验收、独立评审、范围或外部操作权限。
3. 上一会话已按第二条要求在 contract 部分收口，**没有启动 implementation**。这次交接是 owner 要求的阶段交接，不是预算耗尽/产品阻断。

不修改全局 policy/CLI 配置。新 stage 冻结前读取 live policy；活动 cycle 只读其 frozen policy，并保存上述本任务授权 sidecar。

## 0A. 先核验坐标，读到什么就按什么处理

唯一继续施工的隔离 clone：`[IMPLEMENTATION_ROOT]`
分支：`codex/as-privacy-20260906`
HEAD：`99d51106c9caaefcf55f72bff1a17a78abf58be9`
合同 GREEN dirty fingerprint（git-diff-v1）：`22aeb36ed341308f3af462055853c7c366f35f99bf5ed1b9419b14716d415270`

```bash
cd '[IMPLEMENTATION_ROOT]'
git status --short
git log -3 --format='%H %s'
python3 [WORKFLOW_ROOT]/candidate_fingerprint.py --expect 22aeb36ed341308f3af462055853c7c366f35f99bf5ed1b9419b14716d415270
```

应为 43 个差异文件：15 个允许合同/schema/排产增量 + 28 个按 SHA 带入的只读方案来源；控制/原始日志已 ignored。不是 clean HEAD 已含AS：HEAD仅是PG-01B证据提交，AS仍为未提交diff。直接切到HEAD会丢失本次合同，不可执行。

合同控制根（以下简写 CONTRACT_CONTROL）：`[CONTRACT_CONTROL]`。
必核 `final.json`（原始文件SHA-256 `a0ad116ef219c8f7ad11ccfc116cee12bc9b5e46f7b63023d0c2017567fb03cb`）、`review-4.md`（原始文件SHA-256 `96f179c4e6da56e2b66ea024edd929eae6bab9155602644cc1c671a702f94f78`）、`review-validation-4.json`、`gate-evidence-final.json`、`cycle.json`、`contract-baseline.json`。`finalize-result.json`真实status=finalized；validator=valid/full_gate；review ordinal4 GREEN/P0=0/P1=0/P2 delta=[]。最后状态 repair3/3、rereview3/3、reset1/1均已结算，无悬挂；它是成功结束的合同cycle，不得在其中接产品implementation。

最后完整合同门名 contract-docs，record-gate exit0；工具原始日志SHA-256 `e7cec575ff396d9b801c5158833da4dbbc9ca107c4d5b0f4dc4aedf4e5f4e074`，1371 bytes。工具日志在 CONTRACT_CONTROL/gate_logs 下按 task/stage/cycle/HEAD/fingerprint/attempt 定址，receipt同样定址。内容含 contracts typecheck、schemas18 passed、privacy21 passed及文档/隐私/指针检查。这里的“完整”仅指contract验收合同，不是产品 `just ci`/Playwright。

版本实测：Node v22.23.1、pnpm10.33.1、just1.57.0、Python3.12.13。下一会话自行重读，不擅自升级依赖。`implementation-path-audit.json`已验证11个既有运行时入口存在，2个新source与4个新tests尚不存在；这是待建文件，不是缺失阻断。`docs/plan/ecc-as01-as02-privacy-implementation/` 尚未创建，须为新stage合法初始化，不可冒用旧control绑定。

若坐标漂移，先读实际diff/占用者并保全；不要reset/覆盖/复制控制目录到别的clone后rebind洗成有效。可读对账后在已授权范围解决；真实无法核实候选身份才暂缓依赖动作。不要重做已闭合的产品以匹配旧文字。

只读边界：
- 主树 `[MAIN_ROOT]` 的研究分支、journal及dirty由其它任务使用；本任务不施工、不覆盖。
- `[EVIDENCE_ROOT]` 是证据/journal归档副本，包含过程增量，不是冻结评审ref，也不带可搬用control；不要在那里写产品。
- 最终只读review snapshot：`[FINAL_REVIEW_SNAPSHOT]`。旧重复PG clone与其它AS snapshots只保留审计用途，不复用作实施入口，不清理。

## 1. 必读顺序与事实优先级

所有仓内相对路径均以唯一施工clone为根。
1. `AGENTS.md`、`.octoworkflow/project-profile.md`：零emoji、canonical、实施/评审隔离、质量门与状态词；当前新消息的两项owner例外优先。
2. `docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md`：已审过的唯一AS执行卡，重点§3 M1–M8、§4 grammar/写入恢复、§5成本、§6 exact-set、§7 gates。这是直接施工合同，不再从原统一大方案发明新功能。
3. CONTRACT_CONTROL 的 `implementation-scope.json`、`cost-limits.json`、`contract-baseline.json`：实际源/测试清单、所有生产消费者、数值上限及旧schema字节快照。保存到新stage baseline，不重新定义同名类型。
4. `docs/09-data-contracts.md` AS隐私相关段、`docs/03-architecture.md`、`docs/04-key-mechanisms.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`docs/modules/b-memory.md`对应段：canonical形状优先，按关键symbol定位，不反复全量读取长文。
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` AS批卡、`HANDOFF.md`指针镜像、`docs/plan/2026-08-28-project-gap-owner-decisions.md`新增授权登记。指针现为active=AS-01-AS-02/next=none/last_closed=PG-01B/revision4；不把next=none误判整个任务结束。
6. 原owner完整验收在 `[OLD_CONTRACT_CONTROL]/owner-input.md` §1/§3.4/§8；统一方案在 `docs/plan/2026-09-05-engineering-unified.astra.md` §3，源manifest和前置证据在CONTRACT_CONTROL。
7. 工程入口：`[WORKFLOW_ROOT]/supervised-delivery.md`、`cli-forms.md`、`cycle-state.md`、`autonomous-recovery.md`、`context-budget.md`；先看实际CLI `--help`，不凭旧记忆拼收据。

PG前置事实：I=`ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`，E/当前HEAD=`99d51106c9caaefcf55f72bff1a17a78abf58be9`。两者直接父子，产品目录零diff，已在main；证据实际是 `e2e/evidence/pg-01b-20260905.md`，不是旧批卡错误文件名。R129明示那一历史批缺finalize且owner知情合并，不抹平旧债，也不借旧债重开PG产品。本AS合同则有真实finalize。

## 2. 八条红线

1. 全仓及沟通零emoji/pictographic符号，使用[ok]/[warn]/[fail]。不在语音执行状态说“完成”；settle后“执行和检查都跑完了，等你验收”，合并后才说“交付了”。
2. MemoryLedger拒写必须早于classify/insert，覆盖supersedes/user_stated/requestedTrust/remember及所有真实入口；一条拒写不能破坏整个项目或事务。
3. 新generation的所有待落盘原文（含rules/scripts/justfile/excerpts/source元数据）在首次raw staging前检查；命中不发布partial，不修改旧pointer/status，不清历史。
4. 私有Git保护create-only且验证实际保护，等价规则接受，已tracked/未知/失败不能当已保护；不自动git rm/untrack，不覆盖用户配置。不把人工共享当无条件豁免。
5. 现有成功与三类失败可区分，旧有效generation/首次暂无底座必须真实；修源/保护后用现有重试恢复，不增共享设置或通知中心。
6. 09已有类型一律import `@saydo/contracts`；全生产producer/consumer做同一runtime parse。日志/审计/TTS/错误不能携带敏感原文，审计只允许kind/digest等合同字段。
7. 不改Gate0/S3/trust/blocked词表、DDL、PG-01B net业务范围、provider/runtime/安装器、AS-03..07或PG-02。必要canonical修正先完成一致性评审，再改代码；不能以旧GREEN证明新合同。
8. 仅本地隔离候选与fixture；无commit/push/merge/install/deploy/真实provider/live/真人场次授权。服务端口占用先识别，不杀其它任务进程。

## 3. 下一部分：implementation阶段的一个端到端隐私批

阶段链：已结束contract → 新implementation（M1–M8一起做）→ 独立review/必要修复 → GREEN后的本地完整门 → 唯一最终P2 sweep与候选收口。不是按ledger、Git、UI拆成多批各审一遍。

### 3A. 初始化与范围

新task仍ecc-as01-as02-privacy，stage=implementation，cycle=c1；新control建议 `docs/plan/ecc-as01-as02-privacy-implementation/`，state在其中cycle.json。保留当前contract control与final.json。初始化前机械验证candidate，再保存contract-baseline和owner授权；新阶段冻结M1–M8（每项P1）、三维coverage（写入/失败恢复/证据）、各项至少一正一反、exact路径、gate_mode=local_first与可执行gate spec。

11个运行时may/must-change入口（按合同逐项兑现，不顺手重构）：
- `packages/daemon/src/memory/ledger.ts`
- `packages/daemon/src/memory/foundation.ts`
- `packages/daemon/src/memory/foundationOps.ts`
- `packages/daemon/src/brain/liveTools.ts`
- `packages/daemon/src/index.ts`
- `packages/daemon/src/projects/lifecycle.ts`
- `packages/daemon/src/memory/growth.ts`
- `packages/daemon/src/memory/hotwords.ts`
- `packages/console/src/pages/ProjectSettings.tsx`
- `packages/console/src/lib/api.ts`
- `packages/console/src/lib/apiError.ts`

[new] 两个source：`packages/daemon/src/memory/credentialLiterals.ts`、`packages/daemon/src/memory/gitProtection.ts`。
[new] 四个tests：`packages/daemon/test/credential-literals.test.ts`、`packages/daemon/test/git-protection.test.ts`、`packages/daemon/test/live-tools-remember-privacy.test.ts`、`packages/console/src/pages/ProjectSettings.test.tsx`。
可扩展的既有tests：`packages/daemon/test/memory.test.ts`、`packages/daemon/test/memory-foundation.test.ts`、`packages/daemon/test/projects-lifecycle.test.ts`、`packages/daemon/test/memory-growth.test.ts`、`packages/contracts/test/knowledge-privacy.test.ts`。
现有shared schema（包括index出口）已有合同baseline；必要变动必须如实进入本阶段diff与review，不能另造DTO。执行卡提及e2e/console/console.spec.ts三态探针为可选；若采用，在派发前显式加入exact-set，不在施工中悄悄扩表。非生产接线的memory/negation.ts不纳入。

### 3B. 可判定验收

| ID | 结果 | 必测反例 |
|---|---|---|
| M1 | 窄字面量拒写覆盖所有Ledger真实入口 | requestedTrust等不能绕过；无insert/raw回显；一条失败不终止其余工作 |
| M2 | 全声明原文在首次staging前扫描 | rules/scripts等命中不落raw、不发partial、不动旧pointer；首次无旧知识不能假称保留 |
| M3 | create-only ignore与实际Git保护 | 等价规则不覆盖；tracked目标保留但拒本次投影，不自动untrack |
| M4 | 非Git/.git文件/worktree/根外symlink/未知与失败结果确定 | 非Git仍做凭据检测；根外拒写；Git查询失败不是protected |
| M5 | 三类失败及重试正式UI可用 | 单条未保存/刷新失败保留旧代/首次暂无底座不同；修复后现有重试真实发布新代 |
| M6 | 安全相对来源/行号/kind/处方正确 | 占位符/env/digest/ID不误拦；token/PEM局部引用不豁免整串；不泄露原文或完整路径 |
| M7 | 所有读取/扫描/Git资源边界符合冻结成本 | 超界在受影响写前fail-closed；不每轮全仓扫/持续上报，不吞失败造成功 |
| M8 | canonical/schema/代码/正式路由/证据一致 | 旧数据/用户文件/保护保留；不重放被拒内容、不自动删库或改历史 |

特别检查拒写外层消费者：remember、addHotword、nominateFromSession每条catch、reanchorDraft事务内逐条隔离、approve拒写candidate不变、foundationOps.onFact。BootstrapResult生产者、HTTP状态/JSON、Console api/runtime parse、ProjectSettings三态和memory-growth测试一起贯通。不能只测helper，绕过实际生产入口。

### 3C. 成本上限与四行说明

读取完整 `cost-limits.json` 并照抄工程选择/现有约束标签：rules单文件65536B、16文件、32dirent、累计名称4096B、累计读取131072B；NAME_MAX255B；单次foundation扫描524288字符，单条claim524288；safeHits8，去重键8。规则普通identity269字符/编码表示784，控制字符Cc集合与逆映射共享。不得将编码与安全定位脱离真实文件身份。
Git新保护最多5查询；既有首次峰值11+5=16子进程/边界；timeout10000ms，buffer1048576B。现役未设timeout等是待实施，不能称已实测。0新增产品模型请求、0周期全仓扫描、0持续上报。

四行回报/成本必须在实施后按实测更新：
- 回报：拒绝敏感新写入、保护私有投影、失败保留旧知识与可恢复；当前这些运行时行为**还没实现**。
- 成本：只在相关写入/构建边界支出；真实时延/资源未知，数值是冻结上限，不是测量结果。
- 用户负担：可能移除源凭据或手工修Git保护后重试；不要求重装/关保护/删历史。
- 维护：现有memory/ledger/foundation/ProjectSettings承接，止于该grammar和write-set；没有具名需求不扩扫描或平台。

### 3D. 真实gates

在施工clone执行，新增测试建立后才运行。本阶段focused维持PLAN-2 `FG-AS01AS02-PRIVACY`的同一exact测试集，另加受影响daemon typecheck作为编译边界检查：

```bash
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/daemon exec vitest run test/memory.test.ts test/memory-foundation.test.ts test/credential-literals.test.ts test/git-protection.test.ts test/live-tools-remember-privacy.test.ts test/projects-lifecycle.test.ts test/memory-growth.test.ts
pnpm --filter @saydo/contracts typecheck
pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts test/knowledge-privacy.test.ts
pnpm --filter @saydo/console typecheck
pnpm --filter @saydo/console exec vitest run src/pages/ProjectSettings.test.tsx
bash scripts/check-emoji.sh
node scripts/check-doc-links.mjs
node scripts/check-public-tree-privacy.mjs --fs
node scripts/schedule-pointer.mjs --check
git diff --check
```

完整门在有效语义GREEN后由supervisor通过record-gate执行冻结wrapper：`just ci`；`pnpm exec playwright test`。本地Node/Python/浏览器基线，不是托管CI/真机/provider等效；真实live/Windows记not_run。不要以缺scripts/check.sh停止，它不是本仓入口。

Playwright会写受管截图：运行前只备份测试生成路径，结束后按原始bytes恢复该次生成物再核fingerprint；不得reset整个工作树。端口配置47188，先读playwright.config.ts与global-setup.ts并识别占用者；不杀其它服务。外部Grok sandbox若阻止ps/IPC等测试，supervisor在正常本地测试环境运行冻结focused并交给只读reviewer原始日志，不靠改产品规避环境错误。

## 4. 监督、收据和恢复

Fable只编排，不替代实施和语义review。先用实际CLI help；`validate_handoff.py`对每份IMPL/REVIEW输入必须exit0；唯一workflow-v2块由当前 --print-contract生成。带授权例外的输入调用：

```bash
python3 [WORKFLOW_ROOT]/validate_handoff.py '<本次输入.md>' --allow-owner-override 'owner明确要求继续原任务，不受修复次数限制；当前会话承接该授权。' --override-rule unbounded_review
```

只有这项精确例外获授权；结构错误不可override。不在reviewer报告里伪造授权或参数。

新stage首次implement不得绑定旧GREEN报告。按原owner-input.md §8 的机械未评审bootstrap规则初始化：新stage有P1验收M1..M8，占位只证明“未评审不放行”，禁止送review消费闸；初次CLI实际结束后，用工具以action=implement迁移到真实candidate。不能在已审cycle反复免费implement。

实施线退出且candidate冻结后，只派一名fresh_zero_context reviewer；固定snapshot与首尾fingerprint，最多三维，P0/P1先证明正式可达/声明grammar；不开放式fuzz。不将父推理、实施自述或旧review全文给reviewer，允许合同、原始focused日志和上一轮blocker ID/摘要。报告最终唯一 `review-manifest` fence（不是json），证据file:line；focused条目只有name/exit_code/summary。

每次先以真实CLI terminal、当前head/fp、report canonical hash和control实际hash生成completion receipt，经cycle_state advance登记，再独立validate_review_manifest消费；不要手改state、复用GREEN来施工、跑reviewer输出任意命令。RED范围内继续修，旧报告/日志保留；工具只是因次数要求停止时按本次owner授权开后继恢复cycle，而非请owner重复许可。真实scope/架构/外部权限未决才交给owner。

GREEN后：刷新preflight runtime receipt → record-gate执行冻结wrapper → 以工具gate摘要组成gate-evidence → finalize。不能用pre-GREEN focused或caller自填exit/log冒充。当前已有contract的完整成功样例可读其收据形状，但不要复制身份/hash/consumer绑定到新stage。

长CLI用 await_external_cli.py，hard3600s/idle900s（有新历史证据才调整），唯一日志路径，读取真实 end_turn/turn.completed 与模型metadata。启动和等待在同一个工具runtime内阻塞，宿主提前yield仅恢复同一job，不由模型tail/ps轮询、不派babysitter。Bash/TaskOutput形态按Claude Code宿主实际可用接口；工具宿主限制优先。配额信号走plan_cli_recovery/cli-forms，普通产品RED不能当配额回落。

## 5. 证据与唯一P2 ledger

唯一P2 ledger：`[OLD_CONTRACT_CONTROL]/deferred-p2.json`，当前items=[]、final_sweep_count=0。不要新建第二份。单阶段P2只登记，整个AS最终候选交付前一次sweep；不在已结束contract再扫。P3普通backlog。

上轮证据归档副本根为前述证据clone。旧R130–R133和旧STOP记录保留；本次恢复R134–R137、GREEN报告、门禁与日志索引在该副本。下一阶段结束把过程证据增量按explicit pathset归入最终候选，保留旧条目；原施工clone的journal仍停R129，不能直接从它再编R130造成重号。归档文件单独对账，别整树覆盖主仓journal。

原始日志全部ignored；提交候选只记文件名/bytes/SHA，不写本机绝对路径、secret或日志正文。AS源/测试/文档候选仍无commit，只有明确获授权才commit/push。未来如授权提交，遵守I/E两提交与干净post-commit完整门禁后才执行获授权push/install，不把这次dirty门绿当新commit证据。

## 6. 本会话的终点与诚实报告

目标是AS M1–M8运行时和UI可审查候选，通过独立review、实际完整本地门并结算。只报告实际验证的用户可见行为；给四行回报/成本、workspace/head/fingerprint、review与日志证据、P2ledger、not_run和未提交边界。合并前不说“交付了”。不自动开PG-02或其它批。

遇到soft context、首次compaction、跨日、unknown usage只存checkpoint并继续，不因这些重复问许可；hard或真实context-limit才checkpoint/RECONCILE。owner此次已经主动要求换Fable宿主，不能以父会话上下文不足为理由重新评审已GREEN的合同。
