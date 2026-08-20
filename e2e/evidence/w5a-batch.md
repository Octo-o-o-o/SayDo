# W5a 前段批(合同就绪子集 + TTS 拍板落地)—— 验收证据(2026-07-27)

> 范围 = IMPLEMENTATION-PLAN-2 §1-W5 中不依赖 W4/R-A 的合同就绪子集(PLAN-2 §7-8 批间重估授权)
> + owner 已拍板的 TTS 音色落地。七竖切:3.0 TTS / 3.1 verify 安全债 / 3.2 decisions+深链 /
> 3.3 edit 第四动作 / 3.4 steer cancel_resume / 3.5 项目级覆盖 / 3.6 产物控制面 / 3.7 微项篮。
> 三级词表:[ok] 可复跑证据 / [warn] 差距如实 / [fail] 未做。SHA 均为本会话 git log 真实输出。
> 基线:开批 HEAD `086001d`(W2 收口);§0 坐标核验六项全过(ci contracts 66 + daemon 521|4 skipped
> + python 20;playwright 10/10;批次指针空;runtime HEAD 086001d;PLAN-2 存在)。

## 0. TTS 音色落地(owner 2026-07-26 拍板;代码 `ee5a366`)

- [ok] `pipeline/src/saydo_pipeline/doubao_tts.py` voice 缺省 `jitangmei` → `zh_female_tianmeiyueyue_uranus_bigtts`(uranus 系,W1 实测有效清单内)。
- [ok] 真实合成烟测:`.venv/bin/python /tmp/w5a-tts-smoke.py`(一句话术"排进队列了,到验收点我叫你。")→ exit 0,25965 字节 mp3 落 `/tmp/w5a-tts-voice-smoke.mp3`;断言 `tts.voice == zh_female_tianmeiyueyue_uranus_bigtts`。
- [ok] `just daemon deploy`:常驻切 `~/.saydo/runtime@3ed8a6d`(plist 已指向 runtime 树,`/health` 正常,launchctl `com.saydo.daemon` pid 71043);pipeline 进程以新代码重启(hub 连上 + hotwords 50 + tts=doubao/asr=volc-sauc)。**注:收口后 runtime 将再 deploy 到收口 SHA(§8)。**
- [ok] HANDOFF §2-10 清账标完成(dogfood 时段惯例:deploy 前会话已 suspended,无打断)。

## 1. verify 两条 P1 安全债(3.1;Gate 0 G3/G4 域;代码 `7c4fe1b` + evidence `36e2987`)

- [ok] **① 框架 config 冻结闭包**(取舍 = 方案 a 冻结快照,非方案 b 保守拒;evidence 说明:方案 a 保住 vitest/playwright 类模板可登记,config 变更走 Plan Delta 重拍板而非整体拒)。闭包范围(`verifyFreeze.ts` 头注):runner config 文件族(vitest/vite/playwright/jest/mocha/tsc/eslint/pytest/ruff)+ 命令内路径 token + justfile 一层递归 `package.json#scripts.*` 伪键;缺席记 null(新建即漂移);`precheckVerify` 重校不符 = content_drift 转 blocked。诚实残余(仍 P1 受控执行环境):node_modules/依赖树/monorepo 子包 config/tsconfig extends 链/TOCTOU 精确竞态。
- [ok] **② verify 执行 env 隔离**:`VERIFY_ENV_ALLOWLIST`(PATH/LANG/LC_*/TERM/TMPDIR,无 USER/SHELL/LOGNAME)+ HOME 指向 `runDir/verify-home`(每 run 空目录,只建不删)+ COREPACK_HOME 定向透传(pnpm shim 缓存面非凭据面)。诚实残余(仍 P1 容器):绝对路径直读 + 网络出口。
- [ok] **反例双绿**(`tier1-security.test.ts` W5a 3.1 两 describe,8 例):改 vitest.config 自证通过被拦 / 新建 config 拦 / 删 tsconfig 拦 / justfile 递归 pkg 脚本拦 / 路径 token 拦 / 无漂移放行 / verify 读 `~/.ssh/id_rsa` 失败(含真实 HOME 对照组证明断言有效)/ COREPACK_HOME 透传。
- [ok] `tier1-conformance.md` §3/§4 两条 [warn] 改 [ok](注修复 SHA `7c4fe1b`)。

## 2. decisions[] 摘要层 + openOnScreen 编辑器深链(3.2;PLAN-2 5.1;代码 `06e832a`)

- [ok] **decisions 第三层**(10 §5;09 §13 explainResult level=decisions):`summary/explain.ts` 三层——one_liner/walkthrough 规则层渲染 + decisions 从 events.jsonl 机械抽 assistant/result 文本 → 廉价档惰性提炼(≤5 条,overridable 恒 true)→ 落 `tier1_runs.decisions_json`(v6 迁移)。语音工具与 console `POST /api/tasks/:id/explain` **同实现同落库**——口播/上屏一致。诚实降级:无记录/无提炼模型 ⇒ 空 decisions + 如实话术,不编。
- [ok] **openOnScreen editor 深链**(09 §13 签名不动,纯实现扩展):what=file + ref ⇒ `cursor://file/<abs>:<line>` 优先,`vscode://` 兜底,无编辑器/ref 越界(绝对路径/../~)/无本地工作区 ⇒ 回落本地 review URL;opener 只吃编辑器 scheme(darwin `open`);diff/log/pr 语义不变。
- [ok] **decisions 落库任务口播/上屏一致 + 深链 e2e**:`summary-explain.test.ts` 7 例(主锚:惰性提炼→落库→二次调用零模型调用→console getTaskDetail 读同一份;≤5 条上限;诚实降级;Hopper 无 run;kind 映射)+ `tools.test.ts` 深链 4 例(cursor url 断言 + opener spy / vscode 兜底 + 无编辑器回落 / 越界回落 / diff/log/pr 不走深链)。
- [ok] Decision 类型消分叉:summarizer 本地定义改 import `@saydo/contracts`(decisionSchema)。

## 3. edit 审批第四动作——修改后批准(3.3;09 §3 骨架照抄;PLAN-2 5.2;代码 `fad546b`)

- [ok] `RuntimeApprovalFlow.edit`(仅屏幕仅 S2,S3 不适用):旧张走状态机 `user_edit` 边(superseded_by_edit + decision=edit)+ 同步签发新张(新 nonce/新 refDigest=编辑后命令,decision=accept 等消费);当前命令 gate deny 回执带修改建议(agent_message),agent 按建议重试 ⇒ `request()` 预批消费点命中即放行(单次消费,同命令二次照常上浮);编辑后命令风险重估 S3 ⇒ 拒(不开 S3 预批面)。命令原文仅内存 pending 持有(审计仍只记 digest,E3 纪律不变;零 DDL 变更)。
- [ok] **§12-3 正反例绿**:contracts `receipt-sm.test.ts` user_edit 边(作废/终态不复活/已决不可 edit)+ daemon `tier1-approval-live.test.ts` W5a 3.3 describe 4 例(作废重签链主锚:旧 superseded_by_edit + 新张新 nonce/新 refDigest/decision=accept + 修改建议单次可取 + audit 链;单次消费与二次上浮;S3 编辑拒;已终局/空命令/过期预批不命中)。
- [ok] **audit 链完整**:`tier1.approval_edit`(绑 old/new receiptId + editedCommandDigest + editedRisk)。
- [ok] console 审批卡"修改后批准"按钮(S2 且有 pending_command 才出)+ `POST /api/approvals/:id/decide` 扩 decision=edit。

## 4. steer 增量——cancel_resume + Hopper capabilities 分级消费(3.4;PLAN-2 5.3;代码 `44ff66d` + 竞态守卫 `0a64170`)

- [ok] **cancel_resume 档**(09 §13 词表既有;03 §5 cursor 降级):running ∧ 有活跃 run 的 steerTask ⇒ run 级 cancel_requested(任务保持 running)→ 执行器 reap 辨识 steer_resume 杀进程 + run 级结算(proof 齐备落 cancel_settled)→ 认领循环按"running 无活跃 run"起新 attempt,worktree 确定性复用,steer 指令经 task_messages 编译进下次 run。恢复链同修(重启时 run cancel_requested ∧ 任务非取消 ⇒ run 级补结算)。非运行中仍 queued_delta。
- [ok] **Hopper capabilities steer 分级消费核对**:握手暴露 `steerLevel`(baseline.2 实测 `none`;缺键缺省 none)+ `hopperSteerSupport` 纯函数消费面(runtime 自动改判);steerTask 的 route=hopper 分支按分级**诚实拒**——修掉此前静默落 task_messages 的谎报面(桥不消费该表);steer 出站 op/CLI 形状属 canonical §6.2 + 锁定二进制升级仪式(PLAN-2 W8 挂起轨),不在本批杜撰。**"现 steer=none,消费面代码就位、能力出现自动启用"验收成立**(单元锚断言 runtime 翻转)。
- [ok] **cancel_resume e2e(注入版)**:`tier1-executor.test.ts` W5a 3.4——杀当前 run(run 级结算,任务保持 running,proof 齐备)⇒ 同 worktree 新 attempt 带新指令 ⇒ settle;audit `tier1.steer_resume_settled`。**竞态守卫回归**(批末 review B 修):steer 杀进程与 settle 之间用户取消同一任务 ⇒ 守卫改走 task 级结算,任务落 cancel_settled(不永久卡 cancel_requested)。
- [ok] **capabilities 消费单元锚**:`p05b-bridge.test.ts` W5a 3.4(none 不可 steer / runtime 可 / schema_only 不放行 / 缺键缺省 none / 握手带出升级值);操作层三态 `tier1-operations.test.ts`(running+活跃 run=cancel_resume / queued=queued_delta / hopper=分级拒不落 task_messages)。
- 未做:Tier2 步序循环(6.10 挂触发线,PLAN-2 §6-10)——按 prompt 不做。

## 5. 项目级模型/预算覆盖 + cache_write 列位(3.5;PLAN-2 5.5;代码 `5244751`)

- [ok] **daemon 受控设置表**(v7 迁移 `project_settings`;**绝不落 project.toml**——09 §11 白名单把 models/providers 列为项目层禁键,安全面不放宽;唯一写口 = console 受信终端 `POST /api/projects/:id/settings/overrides`,tailnet 403)。覆盖面(02 §5.1):dialog/thinking(ModelBinding)/dev(执行 agent model,词表限 cursor)/budget(maxCost/walltimeActiveMin/maxTurns);evaluator 不可覆盖(异族护栏锚点档,schema 无此键)。
- [ok] **生效链**:对话档按会话锚定项目解析(`LiveDialog.dialogProviderFor`,项目缓存 + 覆盖变更失效);开发档 executor claim 消费(`resolveRunModel`;spawn 模型 + observedModel 族校验同源 `run.model`,恢复链同);预算 = 包 cost.max 组包时点生效 + 执行墙钟/回合派发时点生效(maxCost 恒随包,拍板口播过的数字不在派发点漂移)。**家族护栏 02 §5.1 照守**:`validateProjectOverrides` 对"覆盖后组合"重跑 evaluator 异族(违者 422 拒存);dialog 覆盖恒守 api。
- [ok] **覆盖解析单元锚 + 同族覆盖被拒反例 + 迁移幂等**:`config-project-overrides.test.ts` 9 例(项目>全局解析/DAO 往返/dialog 同族拒/thinking 同族拒/dialog 非 api 拒/schema 外键拒/evaluator 不可覆盖/迁移幂等/cache_write meta 两态)+ `tier1-executor.test.ts` 执行器覆盖消费(project_settings dev.model 进 spawn + 族校验对生效模型 + audit `tier1.model_override_applied`)。
- [ok] **cache_write_input_tokens 列位启用**(09 §9 注"留列位待 P1"清偿):`ChatUsage.cacheWriteInputTokens` + openaiCompat(Anthropic `cache_creation_input_tokens` 经网关回带)+ 记账链透传,meta 回带才写不编数。
- [warn] thinking 覆盖:解析/校验/DAO 就位(单元锚绿),但 thinking 槽位在生产**尚以 dialog 代位**(生产 thinkingProvider=dialogProvider,预先存在,非本批引入)——thinking 覆盖的 live 消费点随 thinking 槽位独立生产接线批,如实登记。
- 成本三档预设未做(6.11 挂 owner 点名)。

## 6. 产物库控制面——时间线/diff/子集导出(3.6;modules/b B4 P1;PLAN-2 5.7;代码 `9040f1c`)

- [ok] **时间线**:产物页按 id 分组 + 版本降序 + supersedes 链呈现(接替 vN / 初版)。
- [ok] **diff**:`GET /api/artifacts/:id/diff?from&to` → LCS 行级 diff(`artifacts/diff.ts` 零依赖确定性,超限 4000 行降级整文件替换视图);读取走 `ArtifactStore.read` digest 重校(损坏 ArtifactCorruptError,不静默)。
- [ok] **子集导出**:`GET /api/projects/:id/artifacts/export?items=id:v,…` → JSON bundle(内容+digest 可独立核验;项目归属断言拒跨项目;上限 100);前端勾选 + blob 下载。
- [ok] **Playwright 三交互用例**(`console.spec.ts`,13/13 全绿):① 时间线(按 id 分组/版本降序/supersedes 链呈现)② diff(点对比 v1→v2 出 add/del 语义行)③ 子集导出(勾两版 → 下载 bundle,断言 kind/count/内容/digest)。fixture 改产真实产物文件(真 digest + supersedes 链 + SourceRef 词表值)。
- sqlite-vec 未做(6.7 挂检索 miss 证据)。

## 7. 微项篮(3.7 合同就绪子集;代码 `4b930fd`)

- [ok] **订阅限流 durable 排队重放**(09 §11-5"P0.5 再议 durable 排队"清偿):v8 迁移 `subscription_retry_queue`——限流请求落库排队(重启不丢,替代内存态"重启重新询问"),sweep 到点按 kind 经注入 replayer 重放,再限流指数退避重排,超上限 expired 不无限重试;计费纪律不变(重放仍订阅额度内,不产生 source='api' 行)。生产 enqueue/replayer 接线随 claude 订阅接入批(5.4);当前空 replayers = sweep 空转零成本。验收:`subscription-retry.test.ts` 3 例(入队 durable 换连接可见 + 到点重放 replayed + 未到点不动 / 再限流退避到 expired / 无 replayer 保持 queued + 零计费)。
- [ok] **11 §3 紧凑模式**:顶栏切换 `data-density=compact` + localStorage 持久,CSS 覆盖行高(表 40→32 / 列表 52→40)+ 页距收紧;字号/圆角不动(密度让位可读性)。验收:`console.spec.ts` 紧凑模式(切换 + 持久 + 切回,14/14 绿)。
- [ok] **cursor BYOA 笼两处"实测后补"变量**(09 §11 规则 3):锁定副本 `2026.07.23-e383d2b` 二进制实测确定 = `CURSOR_AGENT_STORE_FILES_DIR` / `CURSOR_AGENT_STORE_SHARED_PATHS`(agent store 面,对应 CODEX_HOME/CLAUDE_CONFIG_DIR 的 cursor 等价物;`index.js` 内 `tu=["CURSOR_CONVERSATION_ID","CURSOR_AGENT_STORE_FILES_DIR","CURSOR_AGENT_STORE_SHARED_PATHS"]` 为 spawn 透传集)。**属 09 §11 规则 3 canonical 措辞的占位填充 = canonical 变更,本批零 canonical 落盘红线 ⇒ 登记待回写清单(§待回写),不落码**(且 cursor BYOA 供给档 P0 未接线,无生产消费点)。
- [warn] **顺延(批容量,如实登记不硬塞)**:C8 成本表盘 + E3 指标完整版(08 §2)· 会话滚动 gist 蒸馏(modules/a A3)· A7 IntentLedger 独立账本(08 §2)· 评估档"读禁闭 spike"(07 D18)· D9 中文分词/预分词真实语料 spike(07/modules sqlite-vec 标注冲突消解)· 10 §6 音频级 golden 其余项。`[pricing.llm]` 三键分列按 prompt 跳过(候 owner 价签)。

## 待回写清单(设计库;R-A 合同轮进行中,本批零 canonical 落盘——收口时若 R-A 已收口才落盘,防双写 docs/09)

1. **09 §11 规则 3**:cursor BYOA spawn env 透传变量占位填实——`CURSOR_AGENT_STORE_FILES_DIR` / `CURSOR_AGENT_STORE_SHARED_PATHS`(实测锚:锁定副本 `2026.07.23-e383d2b`,本 evidence §7)。
2. **09 §13 explainResult**:level=decisions 的 decisions 生产语义(events 抽取 → 廉价档提炼 → 落库口播/上屏同源)——实现先行,措辞回填(签名未动)。
3. **09 §9 tier1_runs**:decisions_json 列(v6);**project_settings 表**(v7,项目级覆盖受控承载)+ **subscription_retry_queue 表**(v8,§11-5 durable 排队)——additive 迁移,canonical DDL 补录。
4. **09 §11 校验规则**:项目级覆盖的"覆盖后组合异族护栏"机械口径(02 §5.1 护栏的 daemon 承载)。
5. **09 §9 cost_entries meta**:`cache_write_input_tokens` 键从"留列位待 P1"改"已启用"(Anthropic cache_creation_input_tokens)。
6. **03 §5 / 09 §13**:Hopper steer 分级消费(steerLevel 握手值;none ⇒ 诚实拒不落 task_messages)——实施状态注。
7. **11 §3**:紧凑模式已实施(P1 项落地);11 §5.4/5.5:审批卡 edit 第四动作交互 + 任务详情 decisions 区(实现先行,回填)。
8. **07 D18**:cursor BYOA env 透传实测状态行(同 §待回写-1)。

## 批末评审(轻量制度;A 级必修,前台 code-review subagent)

- **结论:A 级零**(安全/契约/数据丢失七承重面 + 铁律全过:零 emoji / 契约不分叉 / S3 语音绝不放行 / Gate 0 无 bypass / 审计只记 digest / 三迁移 additive 幂等对老库安全)。
- **B(已修,`0a64170`)**:steer cancel_resume 与用户取消竞态——steer 杀进程与 settleAttempt 之间用户取消同一任务,`settleSteerResumeRun` 只结算 run 级致任务永久卡 `cancel_requested`(无自愈)。修 = 入口重读 task 状态,cancel_requested ⇒ 改走 task 级 `settleCancelledRun`(用户取消优先);回归用例 1 例。
- **C(登记,不阻塞收口)**:① `getArtifactDiff` 未做项目归属校验(与 exportArtifacts 不对称;单 owner 非漏洞,多租户假设漂移前补);② decisions 并发提炼双写 decisions_json(派生缓存 temperature 0 基本同结果,无损坏;在意可加 `WHERE decisions_json IS NULL` CAS);③ `applyReceiptEvent` UPDATE 缺 `AND outcome='pending'` 守卫(当前靠 better-sqlite3 同步执行不双写;改异步 DB 需补 CAS)。

## 测试与门禁(本会话真实输出)

- `just ci` 双矩阵:每提交前独立全绿(退出码显式核查 `ci-exit=0`,未管道取尾);**收口终值 = contracts 67 + daemon 564 passed | 4 skipped + python 20**(W2 基线 66/521/20 → contracts +1 = receipt-sm edit 边;daemon +43;emoji 门禁 clean 自测 4/4)。
- `pnpm exec playwright test`:**14 passed**(W2 基线 10 → +4:产物控制面三用例 + 紧凑模式一用例)。
- 本批新增测试明细:tier1-security +8(config 冻结 6 / env 隔离 2)· summary-explain 7 · tools +4(深链)· receipt-sm(contracts)+1(edit 边)· tier1-approval-live +4(edit)· tier1-operations +3(steer 三态)· p05b-bridge +1(steer 分级)· tier1-executor +3(model 覆盖 / cancel_resume e2e / 竞态守卫)· config-project-overrides 9 · artifacts-controls 3 · subscription-retry 3 · storage-migration-v5(+v6/v7/v8 列表断言)。

## 代码提交(SHA 均为本会话 git log 真实输出)

`ee5a366`(3.0 TTS)/ `3ed8a6d`(开批+清账)/ `7c4fe1b`(3.1 verify 安全债)/ `36e2987`(3.1 conformance 回填)/
`06e832a`(3.2 decisions+深链)/ `fad546b`(3.3 edit)/ `44ff66d`(3.4 steer)/ `5244751`(3.5 覆盖+cache_write)/
`9040f1c`(3.6 产物控制面)/ `4b930fd`(3.7 微项篮)/ `0a64170`(批末 review B 竞态守卫)。
基线 `086001d`(W2 收口);本文件与 HANDOFF 更新随末次 `chore(evidence)` 提交(不自指)。
备注:部分提交夹带 e2e/screenshots 基线抖动(playwright 反锯齿微差,无语义,已 checkout 复原不入提交)。
