# SayDo 首发实施交接 Prompt(复制到新会话)

> **状态(2026-07-25):首发开发已由实施会话完成**(SayDo 仓 main @ `ed16d72`,P0 全部 + P0.5-A/B/C/E + 全量 readback)。本文件使命已达,保留作红线/权威分界出处;**下一步交接用 [IMPL-PROMPT-2-CLOSEOUT.md](IMPL-PROMPT-2-CLOSEOUT.md)(收口与交付验证)**。
>
> 用途:在全新会话里把下面分隔线以下整段作为 prompt 发出,即可开始首发实施。已按"新会话可执行性"评审修订(自决边界、完美实施定义、阶段边界裁决、评审出处均已明确)。
>
> **[warn] 发送前置(owner 动作,缺则新会话会卡)**:完成 `IMPLEMENTATION-PLAN.md` 的 **Phase -1**——建仓 `github.com/Octo-o-o-o/SayDo`(已建)、填模板落 `~/.saydo/`(已落,待补 key:**≥2 家 ASR key 为阻塞档**,评审 A-1)、装 `just`、指定 dogfood 仓。~~发对接 prompt~~ ~~回传 X1/X3~~ **Hopper 侧全部完成**(2026-07-24):裁决已回填,**baseline.2 已 commit+打 tag(`v0.1.0-saydo-baseline.2`,切锁 commit = `bdd1e548…`;tag 对象 SHA 不可用作断言),diff 面清单与 acceptance 词表/`HOPPER_FAKE_SPEC` harness 附录已交付 `research/`**。分期已 owner 裁定(2026-07-23):**首发 = 完整双路径一次交付**,P0 阶段(Tier1)先行,P0.5 阶段(Hopper 桥/直达验收/Demo 生成器)接续,同属首发,**全部做完才算交付、不分步上线**;P0.5 唯一外部开关 = SayDo 契约测试对 baseline.2 全绿即切锁,不绿按 baseline.1 过渡兜底合同实现,不阻塞。

---

你将从零实施 **SayDo**(原名 VoiceLoop)的**首发交付**。首发 = P0 阶段(Tier 1 全闭环)+ P0.5 阶段(Hopper 桥 + 直达验收档 + Demo 生成器),按此顺序**全部做完才算交付——分 Phase 只是开发顺序,不分步上线**;你先做 P0 阶段,P0.5 以 `docs/09 §14` 封闭为前置——**Hopper 侧全部就绪(2026-07-24)**:裁决终稿已回填(A3/A4/A7 封闭;终稿在 Hopper 仓 `docs/plan/2026-07-23-saydo-integration-adjudication.fable.md`),**批次 A + RunSettled 已交付并打 tag `v0.1.0-saydo-baseline.2`(切锁 commit = `bdd1e548f9359789497a797eda24398beba68ac5`;annotated tag 对象自身 SHA ff6cee28… 不可用作 rev-parse HEAD/expected_version 断言)**,diff 面清单与 acceptance 词表/`HOPPER_FAKE_SPEC` harness 文档在 `research/hopper-baseline2-diff-manifest.md` 与 `research/hopper-integration-appendix.md`;**你的开关动作 = 契约测试对 baseline.2 全绿后把 09 §11 [hopper] expected_version 切到 `bdd1e548…`**,不绿则停留 baseline.1 按过渡兜底合同实现(09 §6.2/§6.3 已注明),capabilities 握手探测切换。设计文档库在 `~/WorkSpace/voice-coding/`(**只读参考**,回写走下述评审),代码仓 `~/WorkSpace/SayDo/`(远端 `github.com/Octo-o-o-o/SayDo`)。

## 先读(按序;以下相对路径一律以 `~/WorkSpace/voice-coding/` 为根)

1. `AGENTS.md`(协作与评审纪律,先读)→ 2. `README.md`(文档地图)→ 3. `IMPLEMENTATION-PLAN.md`(**你的主线,分 Phase 与验收;文末"评审记录"是本计划的已修问题账**)→ 4. `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`(**schema/话术/界面的照抄源**)→ 5. `docs/modules/a–e` 五份(**每模块实施导航:接口引用/测试归属/步骤映射**)→ 6. `docs/01–08`、`docs/adr/ADR-001`、`research/hopper-integration-appendix.md`(词表/harness)按需。**权威澄清**:设计仓"只读"= 实施中不得随手改;唯一改动通道 = §4 回写纪律(轻量评审);canonical 全集 = `docs/01–11 + docs/modules/ + docs/adr/`。**库/栈自决边界**:07(技术栈)与 11(UI 库)已锁定的选型不可换,自决仅限 canonical 未锁定的内部实现细节。

## 总目标与范围

- **P0 阶段先做 Tier 1 全闭环**(语音采访 → 决策包拍板 → **Tier 1 后端后台执行(dev 缺省 Cursor CLI / 产品缺省 Claude SDK,见文末"Tier 1 执行后端")** → 回叫验收 → 人工合并),让 owner 能每天自用;含计划 0.5 行的**窄闭环 PoC 手动版**(用 Hopper 现状 CLI + 锁定副本,与底座并行,不等裁决)。
- **P0 阶段不做、留给 P0.5 阶段(仍属首发,§14 封闭后必做)**:Hopper 桥、直达验收档 + 预授权 EffectGrant 放行路径、Demo 生成器、话术表标 P0.5 的条目(如 #39),以及 `docs/09 §14` 与文中标 `[P0.5]` 的**行为路径**(原 `[待Hopper裁决]` 标记已全部按裁决终稿回填,不再出现)。**首发之外(P1+)**:S3 屏幕审批卡、decisions[] 口播、电话等计划"P1/P2"清单项。
- **范围裁决唯一依据 = `IMPLEMENTATION-PLAN.md` 的 Phase 步骤表**:计划步骤表明确列入 P0 的类型/校验器/反例测试(例如 0.2b 的 EffectGrant 校验器、0.3 的 tier1_runs 崩溃重放基元与 outbox 两阶段写基元、3.4 的收据矩阵)**照做**——即使 09 给它们标了 P0.5/待裁决;只有其**运行时行为路径**(放行、跨域对接、念清单)不实现。**权威分界(防契约分叉)**:计划管**顺序与范围**(何时做、做不做),canonical(09/10/ADR)管**合同形状**(schema/语义/枚举/CHECK)——范围/排期标注冲突以步骤表为准并在 evidence 登记;**形状冲突一律以 09 为准**,若步骤表引用了过时形状,先按 §4 回写纪律修文档再编码,不得按步骤表的旧形状实现。

## 执行方式

1. **先做 Phase -1 前置检查**:逐项核对计划的 Phase -1 清单。按其"分档"——**阻塞 P0 的**(环境/仓库/模型槽位与 key 含 ≥2 家 ASR key/测试仓)缺失则用文末卡点格式向我索取;**可自办的**(Hopper 锁定副本 checkout/build/init 与 baseline.2 契约测试切锁,计划 Phase -1 D——**你自己做,不需要我**;音频底板可延到 Phase 1 前)排进对应 Phase,不要为它们停下。

2. **按 Phase 顺序实施,每步:实现 → 步级自查(review)→ 自测**;发现疏漏/不足/错误/不一致/过度设计,**直接修复/完善并再次自查**。一个 Phase 的**"完美实施"有操作定义,达到即算完成、不做无限自审**:
   - 该 Phase 全部步骤的"验收/自测"列逐项过(标 `[owner]` 的攒到 owner 场次,不阻塞你);
   - 相关契约测试(`docs/09 §12`)绿;
   - **本 Phase 归属的 Gate 0 项已关闭并在 evidence 留证**(见计划 Gate 0 分散表);
   - **Phase 级评审**跑完(见下)、A 级问题修完;
   - 产出 `e2e/evidence/phase-N.md`(六段:测试命令+尾行输出 / §12 条目↔测试对照 / golden 通过率 / 截图清单 / 偏离与回写链接 / **代码提交 hash**;跨 Phase 的 Gate 0 项分"基元级证据/完整关闭"两行)。
   - 达到后**两提交收口**(commit hash 不能自指):先代码提交 `feat(phase-N): …`,再证据提交 `chore(evidence): phase-N`(evidence 文件记录代码提交的 SHA),然后开始下一个 Phase。

3. **每个 Phase 开始前**,针对已实施内容,思考当前 Phase 的计划是否还值得实施、是否需要调整、调整后是否影响后续 Phase。**若你有明确建议,按你的建议继续实施**;直到全部完成或**必须和我确认**。可自决 vs 必须确认的边界:
   - **可自决**(按建议继续):不改变 P0 范围、不改 canonical 语义(09/10/ADR)、不碰安全红线、不新增花钱或外部副作用的调整;实现细节的发明(库选型、分词器、内部数据形态等)——定了就在工程 ADR / evidence 记录。
   - **必须确认**(上浮我):动 P0 范围、要改 canonical 文档语义、触及安全红线、需要新账号/新花费/外部副作用、或某 spike 结果推翻计划前提(如**所选 Tier 1 后端** conformance 不成立——dev=cursor_cli 钩子门/产品缺省=claude_sdk 四能力;**已选后端缺任一必需能力即停止上浮**,未选后端顺延不触发停止,见计划风险表)。

4. **照抄与回写**:schema 照抄 `docs/09`(标 [P0-Tier1 就绪] 的部分)、话术照抄 `docs/10`、**界面照抄 `docs/11`**(token/组件/状态映射;**零 emoji 门禁 0.1 即接,全仓适用**);每模块开工前先读 `docs/modules/` 对应域文档(接口引用/测试归属/步骤映射的导航)。发现设计文档本身有错/缺,**先回写文档再改代码**;回写用**实施期轻量评审**(见 `IMPLEMENTATION-PLAN.md` 每 Phase 收尾仪式):纯代码改动 = 1 个 code-review subagent(A 级=安全/契约/数据丢失类,必修);**回写 09/10/ADR 等 canonical = 1 个一致性 subagent + 攒批一次 Codex**(`codex exec -m gpt-5.6-sol -c model_reasoning_effort=max`;Codex 不可用则降级为 subagent + 标记"待 owner 补批");journal/证据免评审;战略/范围上浮我。计划文档(voice-coding 侧)过时:记 evidence 偏离段 + 工程 ADR,攒批同步回 voice-coding,不在实施仓改它。

5. **安全红线(任何情况不破)**:状态词纪律(执行状态不说"完成",settle 后"执行和检查都跑完了,等你验收",合并后才"交付");S3 语音绝不放行(P0 用拒绝+降级话术);verify 只认登记模板;**Gate 0 未关 ⇒ 拒 dispatch,代码无 bypass 分支**;记忆写路径 candidate→trusted、M0 拒第三方、forget_hard 传播;TTS 脱敏(token/secret/路径不进语音)。

6. **自测能力边界**:契约测试、崩溃注入、mock 驱动的 E2E、headless Chrome 走查——你自己跑;真人语音音频、真麦克风全流程——用计划 §1.2 的测试音频注入通道做逻辑级自测,主观体感与真麦收尾攒到 owner 场次(计划标了四次:Phase 1 末 / Phase 4 末 / Phase 5 / P0.5-D——①–③是必需真人验收，④是 Hopper 全链与直达档的最终发布裁决点)。不要卡在需要真人的步骤上,标注 `[待 owner 验收]` 继续推进。

开始吧:先读文档,再做 Phase -1 核对,然后进入 Phase 0。

---

**Tier 1 执行后端(2026-07-23 更新)**:dev 机缺省 = **Cursor CLI 订阅态,审批门冒烟已实测通过**(`research/spikes/cursor-cli-tier1/`:worktree `.cursor/hooks.json` 的 beforeShellExecution 钩子无头触发 + `--force` 下 deny 拦截 + 阻塞等待放行;零 API key)。4.1 的 cursor_cli 后端照此实现——**fail-closed 四律**:① 只依赖 deny(CLI 仅 deny 可靠)② 钩子 JSON 用 jq(防 fail-open)③ 超时=deny ④ **每条命令独立审批(禁便车:agent 一回合可发多条 shell,第二条不得搭第一条的 allow)**;审批 = 钩子同步阻塞回连 daemon socket 等语音/屏幕决策;无 live steer(§13 queued_delta/cancel_resume)。**门完整性(05 §4 Gate 0):** gate 逻辑落 agent 不可写目录、`tool_call` 无对应 hook 回调的 canary ⇒ 立即 cancel、`cursor-agent` 版本 pin。claude_sdk 是产品缺省后端(canUseTool),cursor_sdk(API key)为后续优化。适配层接口按 canUseTool 语义抽象、tier1_runs.adapter 承载(07 D8)。

**卡点上浮格式**(阻塞型即时发,非阻塞型攒到 Phase 末):
背景一句 / 选项 A、B(各一句利弊)/ 我的建议与理由 / 影响面 / 若无回复我将执行的缺省动作。**缺省动作纪律**:可自决类卡点缺省动作=按建议继续;**必须确认类(范围/canonical 语义/安全红线/花费/外部副作用)缺省动作只能是"暂停受影响分支、继续无关工作"**——绝不替 owner 拍板。
