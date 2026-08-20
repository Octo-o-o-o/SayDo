# SayDo W5a 前段批 实施对账报告(/impl-review)

> 分支:main(SayDo 直推)· 基线 `086001d`(W2 收口)→ 收口 `eabc5ac` · **12 提交**(本会话 `git log 086001d..HEAD` 真实输出;实施方总结自述"11 提交",差额为开批 chore,无实质)· 计划文档:`voice-coding/IMPL-PROMPT-7-W5A.md` · 改动面 46 文件 +3057/−127 · 对账执行:2026-07-27 下午,双取证 subagent 实读代码 + 门禁全部本会话亲跑。

## TL;DR

**七竖切全部实证落地,四条红线全部守住,门禁亲跑全绿,判定:W5a 收口成立。** 台账 9/9 [ok] (3.0–3.8);A 级 0;批末评审的 1 个 B 级竞态已修并有回归用例(`0a64170` 实证);3 个 C 级如实登记;我方新增 3 条注记(措辞/计数口径级,不阻塞)。门禁:`just ci` exit 0(contracts **67** + daemon **564 passed | 4 skipped** + python **20**)、Playwright **14 passed**、runtime 已部署收口 SHA——三项均与实施方声称一致。

## 对账台账(状态 → 证据;全部来自本会话实读/实跑)

| # | 计划项 | 状态 | 关键证据 |
|---|---|---|---|
| 3.0 | TTS 音色切换 + deploy | [ok] | `doubao_tts.py:91` 缺省 `zh_female_tianmeiyueyue_uranus_bigtts`;`~/.saydo/runtime` HEAD=`eabc5ac`(本会话 `git rev-parse` 实证)+ daemon 常驻进程在跑(ps);HANDOFF §2-10 已清账 |
| 3.1 | verify 两条 P1 安全债 | [ok] | ① config 冻结闭包 `verifyFreeze.ts:86-176`(九族 config/路径 token/justfile 递归 pkg scripts/缺席记 null),precheck 不符 → blocked(`executor.ts:880-884`);② env 隔离 `executor.ts:90,951-952,98-101`(白名单无 USER/SHELL/LOGNAME、HOME→run 专用空目录、COREPACK_HOME 定向);`tier1-security.test.ts:133,209` 两 describe 共 8 例含"改 config 自证被拦""读 ~/.ssh 失败含对照组";conformance §3/§4 已 [ok] 注 `7c4fe1b` |
| 3.2 | decisions[] 第三层 + 编辑器深链 | [ok] | `summary/explain.ts:37,61-72,100-123,181-183`(events 机械抽取→廉价档提炼≤5→落 `decisions_json`);语音工具/console POST/详情页三入口同一实现同一落库列(`liveTools.ts:482`、`index.ts:386`、`api/console.ts:131`);深链 `brain/tools.ts:14-18,161-187`(cursor:// 优先、vscode:// 兜底、越界回落);09 §13 签名逐字未动;v6 迁移 `ddl.ts:207-209,241`;测试 7+4 例实证在案 |
| 3.3 | edit 审批第四动作 | [ok] | 状态机 `receipt.ts:53-55` user_edit 边;`approvalFlow.ts:251-323`(旧张 superseded_by_edit + 新张新 nonce/新 refDigest、S3 编辑显式拒 :265-273、audit 绑 old/new receiptId);console decide 扩 edit(`index.ts:229-245`)+ 按钮条件 S2∧pending_command(`Approvals.tsx:81-89`);contracts +1 例、daemon 4 例实证 |
| 3.4 | steer cancel_resume + capabilities 分级 | [ok] (注记①) | run 级 cancel + 任务保持 running(`operations.ts:113-126`)、reap 辨识 steer_resume(`executor.ts:451-455`)、run 级结算(`:1067-1093`)、worktree 确定性复用(`:550,739-745`)、指令编入下次 run(`:756-764`)、恢复链(`:1106-1132`);竞态守卫 = 入口重读 task 状态,cancel_requested 改走 task 级结算(`:1067-1072`,`0a64170` +8 行守卫 +19 行回归);hopper 分支按 steerLevel 诚实拒且不落 task_messages(`operations.ts:95-107`) |
| 3.5 | 项目级覆盖 + cache_write | [ok] (注记②) | v7 `project_settings`(`ddl.ts:215-218`);唯一写口 console POST,tailnet 403(`index.ts:298-301`);schema 无 evaluator 键(`projectOverrides.ts:18-34`);覆盖后组合重跑异族校验、违者 422(`:64-90`);生效链 dialog/executor/预算三点实证;cache_write 回带才写(`openaiCompat.ts:92,131-133`、`ledger.ts:53-54`);thinking 覆盖 live 消费点顺延已在 evidence 如实标 [warn],非隐瞒 |
| 3.6 | 产物控制面 | [ok] | LCS diff + 超限降级(`diff.ts:10-49`)、读取 digest 重校(`store.ts:63-68`)、导出上限 100/跨项目拒(`console.ts:222-229`)、时间线分组/降序/supersedes 链(`Artifacts.tsx:27-35,121-163`);Playwright 三用例本会话亲跑绿 |
| 3.7 | 微项篮(合同就绪子集) | [ok] | v8 `subscription_retry_queue` + sweep 重放 + 指数退避 + expired + 零计费(`retryQueue.ts`、测试断言 cost=0);紧凑模式 `Layout.tsx:52-62` + `tokens.css:64-75`;cursor BYOA 两变量源码零写入(rg 实证,仅登记待回写)——与"零 canonical 落盘"红线一致;其余篮内 6 项顺延**如实登记**(prompt 授权"做不完顺延不硬塞",合规) |
| 3.8 | 收尾 | [ok] | evidence `w5a-batch.md`(99 行,三级词表+待回写清单 8 条+批末评审节);HANDOFF 批次指针已清、§2 回填、§2-10 清账;红线四条全守——console 输入区/PTT 零触碰(diff 文件清单实证)、S3/writing/类型门禁域零命中(diff 内容 rg 实证)、覆盖不落 project.toml(`PROJECT_ALLOWED_TOP_KEYS` 与基线逐字相同)、canonical 零落盘(设计库 docs 当日下午零写入,mtime 实证) |

## 质量复审发现

- **B(已修,实证)**:steer cancel_resume 与用户取消竞态致任务永久卡 `cancel_requested`——`0a64170` 守卫 + 回归用例,本会话读到守卫代码与测试。
- **C×3(实施方已登记,复核属实,不阻塞)**:① `getArtifactDiff` 未做项目归属校验(与 export 不对称;单 owner 非漏洞);② decisions 并发提炼可能双写(派生缓存,无损坏);③ `applyReceiptEvent` UPDATE 缺 `outcome='pending'` CAS 守卫(当前同步执行不双写,改异步 DB 前需补)。
- **注记①(措辞级)**:evidence 称 hopper steer"能力出现自动启用"——实证为 `hopperSteerSupport` 判定值自动翻转(测试锚成立),但 `steerTask` 的 hopper 分支在 runtime 级同样 throw(桥出站 op 属 W8 挂起轨)——"启用"指判定面非执行面,建议下轮措辞收窄。
- **注记②(计数口径)**:config-project-overrides 实为 7 个 it(自述"9 例")、p05b steer 分级实为 1 个 it 含 ~7 断言(自述"5 例")——覆盖面完整,计数方式差异。
- **注记③(自述小误)**:总结说"11 提交",真实为 12(含开批 chore `3ed8a6d`)。

## 门禁结果(本会话亲跑)

- `just ci`(输出 `/tmp/w5a-review-ci.log`):**CI_EXIT=0**;contracts `Tests 67 passed (67)`;daemon `Tests 564 passed | 4 skipped (568)`;python `20 passed in 0.24s`。
- `pnpm exec playwright test`:**14 passed (16.7s)**,PW_EXIT=0(含产物控制面三用例 + 紧凑模式)。
- runtime:`git -C ~/.saydo/runtime rev-parse HEAD` = `eabc5ac`(= 收口 SHA);daemon/pipeline 常驻进程在跑(ps 实证)。

## 修复清单

无必修项。C×3 与注记①②已随 evidence/本报告登记;待回写清单 8 条(canonical 侧)由设计库会话在 R-A 收口后落盘(本报告发出时正在进行)。
