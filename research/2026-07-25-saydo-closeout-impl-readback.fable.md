# SayDo 首发收口 · 实施对账报告(/impl-review)

> 对账对象:收口会话(交接 prompt = `IMPL-PROMPT-2-CLOSEOUT.md`,4 阶段/10 红线/4 检查点)的实施结果。
> 仓库:`~/WorkSpace/SayDo` main;基线 `ed16d72` → HEAD `d12e5c2`(与 origin/main 同步,工作区干净——本会话 `git status/branch -vv` 实测);区间 **11 个提交,48 文件 +780/-180**(本会话 `git log/diff --stat ed16d72..d12e5c2` 实测)。
> 被引用 hash 存在性:`0eb96f1`/`2837ba5`/`d12e5c2`/`e4b6ab3` 均 `git cat-file -t` = commit(本会话实测;无幻觉引用)。
> 评审路径:本人逐项取证(文件 Read + 门禁亲跑)+ 1 个独立 code-review subagent(区间 diff 质量复审,见 §3)。
> 落盘位置说明:按仓库纪律(AGENTS.md:`docs/` 仅 canonical、`research/` 为评审证据源)写入 research/,文件名从 /impl-review 约定。

## TL;DR

**收口会话的交付成立:交接 prompt 的 4 个阶段全部完成且质量高于要求,门禁在 HEAD 由本会话亲跑全绿,自报与实况一致、未发现夸大;独立 code review 判"可合并、无 A 级"(2B+3C 已当轮全部回收,见 §6)。**
台账 14 项:[ok] 14 / [fail] 0 / [mixed] 0(唯一口径校准:store_transcript="可接线"非"已生效",收口会话自己已挂账,见 §3)。
门禁:`just ci` 本会话两跑两绿(基线 `ed16d72` 13s、HEAD `d12e5c2` 14s:contracts 65 + daemon 344 passed | 1 skipped + pytest 8 + emoji 门禁自检 4/4,尾行 `[ok] just ci: node + python matrices green`)。
尤其值得记录:收口会话**抓到了上一实施会话的真实虚报**(Gate 0 G5"audit_log 不可变"绑定的测试与触发器当时根本不存在)并修复——这正是本收口流程存在的意义。

## 1. 对账台账(计划项 → 状态 → 本会话证据)

### 阶段 A · 独立对账

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| A1 | 门禁全量复跑并记录命令+尾行 | [ok] | `e2e/evidence/closeout-verification.md` §1:五路门禁均有完整命令+尾行(含音频烟测首跑外部超时、重跑 5/5 的如实记录);其中 `just ci`/fake-runner 声称与本会话亲跑结果一致 |
| A2 | final-readback 逐节抽验 | [ok] | closeout-verification §2:14 行抽验表,含 [偏差·C] 一处(p05a 13 例 vs 声称 12)——抽验粒度到出处原文(Codex 12 A3 引文核对) |
| A3 | 六个专项疑点逐条裁决 | [ok] | closeout-verification §3.1–3.6 全覆盖;且超出交接预期:HANDOFF 旧段实查 4 处(交接 prompt 只列 3)、ASR 阻塞段被证伪(key 已于 07-24 晚解锁且 1.0 跑分已完成) |
| A4 | 产出 closeout-verification.md | [ok] | 文件在 `e2e/evidence/`,证据纪律声明节(§5)属实——本人复核其关键声称(坐标 9 项/G5 虚报/G6 证据链断)均能独立复现 |

### 阶段 B · 修复与欠账清偿

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| B1 | 修复对账 A/B 发现 | [ok] | `0eb96f1`:audit_log 不可变 DDL v2 触发器(本会话 Read `ddl.ts:110/112` CREATE TRIGGER IF NOT EXISTS)+ privacy prefault 单源 + storage-checks 测试(`test/storage-checks.test.ts:236` describe 实存);证据行更正 `787979a` |
| B2 | HANDOFF 重写为单一真相 | [ok] | 本会话全文 Read:旧 §3/§4.1/§5/§6 矛盾段清除,头部注明裁决出处;剩余事项=8 项纯 owner 清单(含 Codex 14 三件上浮,无隐藏);新增"关键实测知识"节(zod prefault 坑/sauc 无置信度/Hopper 探针九条) |
| B3 | canonical 欠账清偿(09 两条) | [ok] | 09:656 `expected_version = bdd1e548…`(切锁注记 2026-07-25);09:782-784 reviewTask 返回词改 `cancel_requested` + **U 触发限定**(§6.1 any→failed 属 L/P 边、Hopper Console 打回走 §7 投影,均不经工具面)+ **留白声明**(Hopper 侧出站翻译归 P0.5 桥接线裁决)——限定与留白都写得克制、可判定 |
| B4 | Codex 14 攒批(先核 13/13b 覆盖面) | [ok] | closeout-verification §3.1 第 4 行:13/13b 覆盖面=M 批文档侧,五处 09 回写未覆盖——核对后才跑 14(物证:`research/codex-findings/14-…md` 13KB + prompts/14 + logs/14 3.4MB);triage 表逐条"核实/处置",A 级 4 项(#1a/#3a/#4/#7)代码修复于 `e4b6ab3`,#3b 重定级 B 有独立理由(无运行时暴露),3 件 B 级上浮 owner 而非擅自扩面——**与交接 prompt 的自决边界完全一致** |
| B5 | 门禁仍绿 + A 级清零 | [ok] | 本会话 HEAD 亲跑 `just ci` 绿;五路评审 A 级累计 5 项账目吻合(Codex 14 原判 4 + 收口对账自抓 G5 1),处置均有 commit 级证据 |

### 阶段 C · owner 场次支撑 + 决议材料

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| C1 | 场次①–④现场清单 | [ok] | `e2e/owner-sessions/session-1..4.md` 四文件实存;session-4(抽读)含前置核验命令表、Hopper 回执九坑预调、含糊答复反例演示、capabilities 断言现场演示——质量超出"一页清单"要求 |
| C2 | ADR-002 复核材料并上浮 | [ok] | `adr-002-review-brief.md`:如实记录 owner 已裁定一次(`22d9290`,dev 期 cursor 两族、豁免休眠)、残留决策点收窄为"canonical 豁免条款去留";**未代拍板,批复前维持现状**——检查点纪律遵守 |
| C3 | ASR key 就位后补跑 1.0 | [ok] (已在收口前完成) | 对账发现该项在交接 prompt 写作时已过时:key 07-24 晚解锁、两轮跑分与 ADR-101 已定(`asr-1.0/STATUS.md` 头部+RESULT.md);收口如实更正而非重复劳动 |

### 阶段 D · 交付判定收口

| # | 计划项 | 状态 | 证据 |
|---|---|---|---|
| D1 | final-readback 合入收口验证节 | [ok] | `final-readback.md:62`"## 收口验证"节实存(Codex 14 triage 并入,`57dc17e`) |
| D2 | README 状态行刷新 | [ok] | SayDo README:6 状态注(收口+独立对账指针) |
| D3 | tag 待 owner 确认后打 | [ok] (按检查点挂起) | 未打 tag、未推——正确执行"对外推 tag=检查点"纪律;HANDOFF/用户摘要均列为待 owner ① |

### 红线抽查(10 条中抽 5)

emoji 门禁 HEAD 绿(本会话 `just ci` 内自检 4/4)[ok];两提交法(log 中 feat/fix→chore(evidence) 配对,evidence 记代码 SHA)[ok];canonical 只经评审(09 改动全部走 Codex 14 + 一致性 subagent,journal R35+补记留痕)[ok];契约不分叉/状态词纪律 → 交由独立 code review 复核(§3)[ok]/见下;"每步独立核实"→ closeout-verification §5 证据纪律声明与本人复核一致 [ok]。

## 2. 我方独立发现(区别于收口会话自报)

1. **无虚报发现**:用户摘要与 HANDOFF/report 的每个可检验声称(hash/测试数/文件/回写行)在本会话全部复现。上一轮实施会话的"自报膨胀"问题在收口会话身上**没有复发**。
2. [warn] 微瑕(不列修复清单,记录在案):(a) 摘要说"两路评审综合",实为五路累计口径的收尾两路,表述无害;(b) ADR-002 brief 自注的日期笔误(2026-07-25 vs 提交 07-24)已由材料本身标注;(c) closeout-verification 引用行号(如 09:783)在其后续回写中已漂移——历史文档不回改,合理。
3. **三件登记上浮的定性核对**:①停靠老化调度接线(B,dogfood 前接上即可)②项目层配置生产加载(B,staged 形态、无运行时暴露)③retryTask 状态机边(B,canonical 语义级需拍板)——三件均为真实缺口、定级合理、且都不阻塞"首发交付 = final-readback + 场次④"的判定口径。

## 3. 质量复审(独立 code-review subagent,区间 ed16d72..d12e5c2;其自行复跑 typecheck/lint/test/emoji 门禁全绿)

**总判定:可合并——无 A 级;两条 B 级建议下轮回修,不构成阻断。**

| 级 | 位置 | 问题 | 修法 |
|---|---|---|---|
| B1 | `packages/daemon/src/providers/openaiCompat.ts:71` | "严格口径"只查 `model === undefined`:响应体 `"model": null`(或非字符串)可穿透——dialog 侧不触发作废且静默跳过记账,evaluator 侧 `?? input.llm.model` 会把 null **洗成配置模型名**(把"未证实"记成"族恒定") | 改 `typeof json.model !== "string" \|\| json.model === ""` 即作废 |
| B2 | `packages/daemon/src/index.ts:273-285` | provider 层作废后,调用方专用作废分支成死代码:`dialog.observed_model_missing` **审计不可达**(只剩 log.warn,日志≠审计),且用户听到的降级话术("模型没接通,看下模型配置")与真实原因(响应缺身份标识)误导 | `out.error` 分支识别 `observed_model_missing` 错误码,补专用审计+原话术,删死分支 |
| C1 | `packages/console/src/components/ui.tsx:73` | `CostText` 非 USD 币种一律误标"元"(同文件 `costTotalsText` 已是正确通用式)——方向上属"编数" | 统一 `currency === "CNY" ? "元" : currency` |
| C2 | `packages/daemon/src/tier1/operations.ts:169,180` | audit meta 落 owner comments 原文,v2 触发器使其**永不可清**——与"敏感 payload 只存 digest"纪律有张力(存量行为,非本区间引入,但触发器把"可改"变"永久") | 上浮 owner 知悉;从严则 comments 存 digest+正文落可清除介质 |
| C3 | `packages/daemon/src/config/types.ts:38` | `prefault({})` 的前瞻陷阱:未来项目配置若复用全局 schema,privacy 键恒被注入 → 恒误报 rejectedKeys(当前无害,mergeConfig 无生产调用方) | 项目配置接线时用独立 project schema |

**对收口会话四项自评的独立核对:全部证实**——①迁移事务性(db.transaction 包 exec+版本落库,增量测试实证)②RAISE(ABORT) 与 better-sqlite3 兼容(测试实跑 SqliteError)③prefault 无连锁覆盖(显式配置不被覆盖有测试;privacy 在项目层白名单外)④forget_hard 清除面与 audit_log **零交集**、不被触发器焊死(snapshotForget 全清除面核对 + 全 src 无 UPDATE/DELETE audit_log)。
**一处口径校准**:"store_transcript 已接线"应读作**"可接线"**——SessionManager 在 src 尚无生产构造点,参数面与测试已备,缺口已被收口会话自己在 `2837ba5`/`d12e5c2` 如实挂账(场次② dogfood 接线时以 gate0-checklist G6 行为验收锚),未隐瞒。
**整体不变量核对**:收据单次消费/Gate 0 无 bypass/TTS redactor 出口/契约不分叉/零 emoji——均未被本区间破坏。

## 4. 门禁结果(本会话亲跑)

| 命令 | 结果 |
|---|---|
| `cd ~/WorkSpace/SayDo && just ci`(基线 ed16d72,12:36 前) | 绿:contracts 65 + daemon 335 + pytest 8 + emoji 4/4 |
| 同上(HEAD d12e5c2) | 绿:daemon `Tests 344 passed | 1 skipped (345)`(skip=SAYDO_SLOW_E2E 门控,合法)+ pytest `8 passed` + `[ok] emoji gate: clean` + 尾行 `[ok] just ci: node + python matrices green`,exit 0 |

Playwright/fake-runner/golden/音频烟测:收口会话已于同日复跑并记录命令+尾行(closeout-verification §1),本会话对其中 fake-runner 的锚(测试文件+越界反例行号)做了静态复核;未重复跑全量(判断:`just ci` 亲跑 + 报告命令可复跑性 + 静态锚复核已足以支撑判定,如需 100% 亲跑可再补)。

## 5. 修复清单(2026-07-25 下午 owner 授权"最完整最标准对应"后,全部当轮处置——终态见 §6)

1. **[B1] openaiCompat model:null 穿透** → **已修**(非非空字符串即作废 + 缺失/null/数字/空串四反例)。
2. **[B2] observed_model_missing 审计不可达 + 误导话术** → **已修**(dialogLoop 按错误码分流话术并透出归一 errorCode;index 按码补专用审计、删不可达死分支;dialog-loop.test 新建)。
3. [C1] CostText 币种通用化 → **已修**(与 costTotalsText 同源规则)。
4. [C2] audit meta comments 原文 → **已修为 commentsDigest**(E3 纪律;比"知悉"更进一步——v2 不可变触发器使原文永不可清,从严处理;审计纪律断言测试)。
5. [C3] 项目配置独立 schema → **防踩注记已落**(config/types.ts;接线属 HANDOFF 上浮件②)。
6. (承 §2)三件登记上浮(停靠老化调度接线 / 项目层配置生产加载 / retryTask 状态机边)= **owner 排期/拍板项**,维持上浮。

## 6. 回收记录(闭环证据)

- **代码提交 `5c00505`(fix)+ 证据提交 `628f7e4`(chore)**,已推远端(`d12e5c2..628f7e4`,本会话 git push 输出)。
- **复审**:第二只 code-review subagent 审回收批 diff——**无 A 无 B、2C**:C-1(BYOA 前缀码 `voided_observed_model_missing` 与精确匹配不一致的复发面)已当轮并入(dialogLoop 双匹配 + errorCode 归一 canonical 码 + 测试);C-2(作废话术入史)经裁决接受(入史与实际播出一致,利于模型理解用户复述;评审自评"可接受不修")。其余核查点(行为链完整/不误记账/TTS 出口 hub 层统一 redact/textDigest 来源/空串币种不可达)逐项确认通过。
- **新发现登记**:tier1 操作面(reviewTask/cancelTask/retryTask/requestManualMerge)src 零生产调用方——"库+测试就绪、生产未接线"staged 形态,与 SessionManager 同族;已统一登记 SayDo `HANDOFF.md` §2-9"场次② dogfood 接线增量清单"(单一登记处,防散落)。
- **门禁终态**:`just ci` 双矩阵绿——contracts 65 + daemon **349 passed | 1 skipped**(+5 新测试),emoji 门禁自检 4/4,pytest 8(本会话尾行 `[ok] just ci: node + python matrices green`)。
- 过程留痕:voice-coding `history/PROCESS-JOURNAL.md` R36。
