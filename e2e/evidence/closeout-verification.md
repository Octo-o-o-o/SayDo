# 首发收口独立对账报告(closeout-verification)· 2026-07-25

> 性质:收口会话对上一实施会话自报账(`HANDOFF.md` + `final-readback.md`)的**独立对账**——
> 不轻信任何自报,每个结论都有本会话真实命令输出背书。对账对象基线:SayDo main @ `ed16d72`
> (交接 prompt 期望值)+ 增量 `15ae5b5`。
> 词表:[确认]=声称属实有实证;[偏差]=声称与实况有出入(附差距);[虚报]=声称的证据定位不到。

## 0. 坐标核验(9 项)

| 项 | 期望 | 实测 | 裁决 |
|---|---|---|---|
| HEAD | `ed16d72` | `15ae5b5` | [偏差·良性] `ed16d72` 为 HEAD 直接父提交;增量 `15ae5b5`(2026-07-25 10:37,本会话开始前 8 分钟)= p05.md §4b 手工探针追记 + statusMapping.ts 纯注释扩充,无逻辑改动 |
| 工作区 | 干净 | 干净(`status --short` 空) | [确认] |
| 分支 | main 与 origin 同步 | `main 15ae5b5 [origin/main]` | [确认] |
| Hopper baseline.2 tag | `bdd1e548…` | `bdd1e548f9359789497a797eda24398beba68ac5` | [确认] |
| `~/.saydo/hopper-dist` HEAD | 同上 | 同上 | [确认] |
| config.toml expected_version | `bdd1e548…` | 55 行,`bdd1e548…`(已切锁 baseline.2) | [确认] |
| docs/09 expected_version | 仍 `ea3fb31…`(已知欠账) | 656 行,`ea3fb31…` | [确认·欠账在案](阶段 B 清偿) |
| evidence 目录 | 11 份 | 11 份(清单一致) | [确认] |
| `just ci` | 双矩阵绿约 12s | 绿,13.7s(见 §1) | [确认] |

## 1. 门禁全量复跑(本会话 2026-07-25 上午;全部命令 + 尾行)

| 门禁 | 命令 | 结果与尾行 |
|---|---|---|
| 双矩阵 CI | `cd ~/WorkSpace/SayDo && just ci` | **绿,13.7s**:contracts `Tests 65 passed (65)` + daemon `Tests 335 passed (335)`(40 文件)+ `[ok] emoji gate: clean` + `emoji-gate self-test: pass=4 fail=0` + pytest `8 passed` + ruff `All checks passed!`;尾行 `[ok] just ci: node + python matrices green` |
| Playwright 冒烟 | `pnpm exec playwright test` | **8 passed (12.3s)**:G1 无 token 403 / 11 路由渲染+截图基线(亮暗)/ Dashboard fixture / parked 派生态 / 任务详情 AC+S3 样式 / 成本 unknown / 切导航不断会话 / 审批上下文 |
| fake-runner e2e(锁定二进制) | `cd packages/daemon && pnpm exec vitest run test/p05b-fake-runner.e2e.test.ts` | **3 passed**,`Duration 6.58s`:completed 全链(握手→lint→drop→scan→run→RunSettled 复核→trust-report→approve 幂等)/ hopper check oracle / blocked 链 |
| golden 全套 | `just ci` 内 `golden-coverage.test.ts` 5/5;条数用 tsx 实数 | **43 条**(PHASE1 5 + M6 4 + COVERAGE 30 + P05 4),>=20 达标、逆风六类齐、场景号覆盖断言过、零 emoji 断言过 |
| 音频烟测(真 sauc) | `pipeline/.venv/bin/python e2e/smoke/audio-smoke-5.py` | **首跑失败**:火山服务端 `55000000 … rpc timeout(timeout_config=3s)`(服务端业务超时);**立即重跑 5/5**:a01/a02/a04/a13/a20 术语全命中,尾行 `[ok] 音频烟测 5/5(合成底板;真人底板待 owner 录后重跑)`。裁决:外部服务瞬时故障,非实现问题;评分脚本自身含"重试 1 次兜底"(RESULT.md),烟测入口无重试,现场清单已注明 |

结论:**五路门禁本会话全绿**(音频烟测一次瞬时外部故障,重跑即绿,如实记录)。

## 2. final-readback 逐节抽验

| 节 | 声称 | 抽验证据(本会话) | 裁决 |
|---|---|---|---|
| Phase -1 | D①物理落地+D②切锁完成 | hopper-dist@`bdd1e548` rev-parse + config.toml 55 行 | [确认] |
| Phase 0 0.0 | cursor 钩子门 spike 有证据 | `e2e/smoke/cursor-cli-0.0/` 存在;phase-0.md 六段完整 | [确认] |
| Phase 0 0.5 | [adapted] fake-runner 承载八条对照 | `e2e/poc/narrow-loop-manual/RESULT.md` 存在 + p05.md §4 八条表 + fake-runner 本会话 3/3 | [确认](偏离注记如实,能力超集成立) |
| Phase 1 1.0 | [done] ADR-101 + [skip] 第二家对比出处 Codex 12 A3 | ADR-101 已定稿(2026-07-24);`research/codex-findings/12-…md:40` A3 原文:"D4 已于 2026-07-24 结项…第二家对比和 300–500 条真实 golden 是换 provider 门禁,不是 Phase -1/P0 开工门" | [确认](出处真实,引用准确) |
| Phase 1 1.1 | [adapted] ADR-001 后记如实注记 | ADR-001 §后记(2026-07-25):P0 未启用 Pipecat 运行时,打断由 hub watermark 承载,LiveKit 条款不触发 | [确认](与 canonical 不冲突:切换条款针对"打断语义不成立",实测成立) |
| Phase 2/3 | 全部 [done] | phase-2.md(daemon 174)/phase-3.md(daemon 208)存在,声称测试均在本会话 335 集合内绿 | [确认] |
| Phase 4/5 | 全部 [done] | phase-4.md(如实标注"回溯补记")/phase-5.md/gate0-checklist.md/p0-readback.md 在;Playwright/截图/golden 本会话复证 | [确认](Gate 0 两处证据行例外,见 §3.2) |
| M1-M11 | 全部 [done],五路评审 A 级 9 项清零 | review-m-batch.md 逐项有提交号+测试名;M1/M6/M7 测试在 335 内绿;Codex 13 报告存在且 triage 表 3A+7B 全采纳 | [确认] |
| P0.5 A/B/C/E | [done] | p05a **13 例**(声称 12——[偏差·C 级]数字过时)/p05b 11/p05c 7/p05e 3,本会话全绿;trust-report/截图脚本实证 | [确认](一处数字勘误) |
| 不实施清单 1-4 | 出处 v2.3①/Codex 12 A3/需真人/工期口径失效 | 计划 v2.3① 原文核对;12 A3 核对;场次归 owner 属实 | [确认] |
| 不实施清单 5 | reviewTask reject 按 §6.1 边表落取消链,§13 措辞勘误挂账 | 09 §6.1(318-330 行)实证 ready_for_review 出边仅 running/review_approved_waiting_merge/cancel_requested,**无 failed/rejected 边**;实现 operations.ts:171-172 reject→guard("cancel_requested")→取消链 | [确认](§13 `state:"rejected"` 为 canonical 内部不一致,勘误归阶段 B) |

## 3. 专项疑点裁决

### 3.1 HANDOFF 内部矛盾(交接 prompt 列 3 处,实查 **4 处旧段**)

| 段 | 内容 | 真相(证据) | 裁决 |
|---|---|---|---|
| §3"后续待办"(2.2 起未做) | 列 2.2/2.3/2.4/Phase 3-5/P0.5 为待办 | git log:`49ccefb`(2.1)后有 phase-2..5 与 P0.5 全部提交(`12c7fcf`/`1d1552f`/`cafde9d`/`56d8b89`/`922f6e6`…);phase-2..5 evidence 齐;本会话 335 测试含全部模块 | **旧段未清理**,§1 为真相 |
| §6"expected_version 仍 = ea3fb31,切锁待 P0.5-B" | 声称切锁未发生 | config.toml 55 行 = `bdd1e548`;p05.md §5"baseline.2 切锁(X1 条件达成)";fake-runner 对锁定二进制本会话 3/3 | **过时句**(切锁已完成;canonical 文档欠账另案,见 §3.6) |
| §4.1"ASR key 阻塞" | 声称 key 全不可用、1.0 定档被阻塞 | `asr-1.0/STATUS.md` 头部:"[已解锁 2026-07-24 晚]";RESULT.md 两轮跑分(裸 25%→热词 65.3% 术语召回);ADR-101 状态"已定";本会话烟测真 sauc 5/5 = key 现可用 | **过时段**(交接 prompt 阶段 C"ASR key 就位后补跑 1.0 跑分"一项**实际已完成**,不再是待办) |
| §5"Codex 攒批复核待做" | 五处 09 回写待 Codex 复核 | Codex 13/13b 已跑(报告在),但其覆盖面 = **M1-M11 文档侧**(订阅 meta/prefixDigest/10 §2.5/routed_provider/拆表测试条/audio_retention 双源/kind 词表/成本断言/params 断言),**不含** §5 所列五处(approvals CHECK/§6.1 停靠边/§11 白名单/observedModel 分档/§12-3、9 测试锚) | **半旧半真**:攒批已跑过一轮(13/13b),但五处回写确实未复核——归入 Codex 14(阶段 B) |

### 3.2 Gate 0 六项(gate0-checklist.md 逐行核测试名)

- **[确认] 15/17 行**:G1 五子项(approvals CHECK/PTT 窗口外/网络半边/审批门四律+版本 pin/role 白名单)、G2 三行(outbox 唯一/崩溃重放/跨域 P0.5 分行)、G3 四行(内容冻结+Plan Delta/E2 风险/golden #16)、G4 四行(.env 升级/egress 如实 uncontrolled/--ignore-scripts/redactor)、G5 意图链与转写落盘、G6 forget_hard/备份例外——describe 名逐一 grep 实证存在,且全部在本会话 `just ci` 335 绿集合内。
- **[虚报·A 级] G5"audit_log 不可变 + 全动作落账"行**:绑定证据"storage-checks.test.ts(audit UPDATE/DELETE 触发器拒)"——**该测试不存在**(storage-checks.test.ts 无 audit 字样),**触发器也不存在**(`rg -i trigger src/storage/` 仅命中 callback_outbox 的 trigger 字段;ddl.ts 无 CREATE TRIGGER)。现状 = DAO 仅 INSERT(misc.ts:86)+ 注释自称不可变(index.ts:43),库层无强制。modules/e E3 合同明确"审计不可变"。**修复归阶段 B:DDL 触发器 + 测试 + 证据行更正。**
- **[偏差·B 级] G6"录音/转写分别同意"行**:绑定"config.test.ts"——实现存在(config/types.ts:30-33 `[privacy] store_audio` 缺省 false / `store_transcript` 缺省 true 分键;load.ts 白名单拒项目层 privacy)但 **config.test.ts 全部 24 个测试无一断言 privacy 键**。证据链断。**修复归阶段 B:补测试 + 证据行更正。**

### 3.3 §12 契约测试抽查

- **[确认] 0.2b 预授权反例子集**:effects.test.ts(19 例,本会话绿)实证 ①(hopper+grants 拒)②(step_confirm 带 grants 拒签)③(枚举外拒)④+④b(必填缺失/整包不静默剔除)⑤(spokenForm 重渲染不符拒)⑨(revision/digest 漂移拒)⑩(Gate 0 未关拒,enabled=false 与 bypass=true 均拒)——与计划 0.2b 行"①–⑤/⑨/⑩"逐一对上;另有 ⑥ 校验器面(保护分支)、effectPolicyVersion 重签、过期包、时区反转、不可解析 fail-closed。
- **[确认] §12-8 风险双维反例**:p05a-contracts.test.ts:141"红线:ready∧high ⇒ blocked 且禁自动执行(含 retry)";p05b-bridge.test.ts:139"retry 闸门(high 转人工/分诊 blocked 走 re-drop)"。两条本会话绿。
- **[确认] retry 闸门**:同上 p05b:139 + journal 三态(intent→sent→confirmed,!=confirmed 重放)。

### 3.4 11 §2.6 StatusChip 四联映射 + 截图基线

- **[确认] 主表 16 状态**:StatusChip.tsx CHIP_TABLE 与 11 §2.6 逐行比对,状态→色调→Lucide 图标→用户语全部一致(含 ready_for_review ink 填充全站最高优先级、cancel_requested 呼吸点、parked 倒计时)。未知状态 fallback = muted/CircleHelp(fail-safe)。
- **[偏差·C 级 x2]**:① parked 倒计时显示"MM-DD止"而 11 §2.6 文案为"N 天后自动取消"(信息等价,形态偏离);② RiskBadge S2/S3 无 shield/shield-alert 图标(11 §2.6"S2 warning 描边徽章 + shield 图标"),仅文字徽章。S3 审批按钮屏幕强认证样式另有 Playwright 用例覆盖(本会话绿),安全语义不受影响。
- **[确认] 截图基线**:`e2e/screenshots/{light,dark}/` 各 11 张,页名与 11 页 IA 一致;Playwright 用例 2 每跑重录。

### 3.5 trust-report 受控映射 + emoji 呈现层转换

- **[确认]** trustReport.ts:resolveTrustReportHtml 三重 fail-closed(非 .md 扩展名拒 / resolve 后越界拒 / realpath symlink 逃逸拒)+ .html 缺失按证据缺失;transformForPresentation 映射表 + 残留 `[sym]` + DOM 门禁复检(转换后仍有禁区字符 ⇒ 拒渲染)。**原始文件不动、不改证据 digest**(呈现层纪律)。
- **[确认] 反例真实在测**:p05b-fake-runner.e2e.test.ts:123-124(`../../etc/passwd.md` 越界拒 + `.txt` 扩展名拒)+ :120 DOM 零 pictographic 断言——本会话 3/3 绿内。

### 3.6 review_reject 返回词(§13 vs §6.1)

见 §2 末行:[确认] 实现落取消链合法(09 §6.1 无 rejected 边),§13 `reviewTask` 返回词 `"rejected"`(09:783)为 canonical 内部不一致——**勘误属实、挂账真实**,阶段 B 回写(按 §6.1 边表实际形态改 `cancel_requested` 并注记语义 = 作废这轮,话术 #34)。

## 4. 裁决汇总与修复清单

**总裁决:final-readback 的首发交付判定口径成立**——工程侧齐备的声称经独立复证**基本属实**;
唯 Gate 0 证据两行(G5 audit 触发器 [虚报·A]、G6 privacy 测试 [偏差·B])与三处 C 级数字/视觉偏差需阶段 B 清偿;
HANDOFF 四处旧段需重写消解。

| # | 级 | 项 | 修复 |
|---|---|---|---|
| 1 | A | audit_log 库层不可变缺失 + 测试虚报(G5) | DDL 触发器(UPDATE/DELETE RAISE ABORT)+ storage-checks 测试 + gate0-checklist 证据行更正 |
| 2 | B | [privacy] 分键无测试(G6 证据链断) | config.test 补 store_audio 缺省 false/store_transcript 缺省 true/项目层 privacy 拒 + 证据行更正 |
| 3 | B | HANDOFF 四处旧段(§3/§4.1/§6/§5) | 重写为单一真相(状态=已收口,剩余=纯 owner 项) |
| 4 | B | canonical 欠账两条 | 09 §11 [hopper] expected_version → `bdd1e548…`;09 §13 reviewTask 返回词勘误(轻量评审 + Codex 14 攒批) |
| 5 | C | final-readback p05a"12 例"实为 13 | 收口时随"收口验证"节勘误 |
| 6 | C | StatusChip 两处视觉细节(parked 文案形态/RiskBadge 缺 shield 图标) | 随阶段 B 顺修或登记(不阻交付) |
| 7 | - | Codex 14 攒批范围确认 | HANDOFF §5 五处 09 回写(13/13b 未覆盖)+ #4 两条新回写 |

## 5. 本报告证据纪律声明

以上每个 [确认]/[偏差]/[虚报] 的依据均为本会话(2026-07-25 上午)真实命令输出:git log/rev-parse/status、
`just ci`、`pnpm exec playwright test`、`pnpm exec vitest run test/p05b-fake-runner.e2e.test.ts`、
`audio-smoke-5.py`、tsx golden 计数、逐文件 rg/Read。未引用任何上一会话的声称作为证据。
