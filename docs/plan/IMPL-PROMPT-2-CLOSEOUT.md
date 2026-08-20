# SayDo 首发收口与交付验证 · 实施 Prompt(第二轮交接,复制分隔线以下到新会话)

> 背景:首发开发已由上一会话完成(P0 全部 + P0.5-A/B/C/E + 全量 readback,SayDo 仓 main @ `ed16d72`)。本 prompt 的任务**不是再开发,而是收口**:独立对账上一会话的自报成果(其交接文档已发现内部矛盾)、修复发现、清偿登记欠账、备齐 owner 真人验收材料、作出首发交付判定。
> 本文件所有坐标与命令均由主会话 2026-07-25 上午实测(含 `just ci` 全绿复跑);首发开发的原始交接 prompt 见 `IMPL-PROMPT.md`(已完成使命,红线与权威分界的出处仍有效)。

---

你接手 **SayDo 首发的收口与交付验证**。上一会话已完成首次完整开发并留下自报账(`HANDOFF.md` + `e2e/evidence/final-readback.md`),但其交接文档存在内部矛盾、且有明确登记的欠账。你的使命四件:**①独立对账(不轻信任何自报)②修复与欠账清偿 ③owner 场次支撑 ④首发交付判定**。代码仓 `/Users/wangyixiao/WorkSpace/SayDo`(远端 `github.com/Octo-o-o-o/SayDo`,main 直推);设计库 `/Users/wangyixiao/WorkSpace/voice-coding`(**只读,唯一改动通道=轻量评审仪式**,见 AGENTS.md)。

## 0. 坐标核验(第一件事;逐项跑命令,与期望不符 ⇒ 停下报告,禁止"应该差不多"继续)

| 命令 | 期望(2026-07-25 上午实测值) |
|---|---|
| `git -C /Users/wangyixiao/WorkSpace/SayDo log --oneline -1` | `ed16d72 chore(evidence): HANDOFF 刷新(全量对账收口,f03c637)` |
| `git -C /Users/wangyixiao/WorkSpace/SayDo status --short` | 空(工作区干净;不干净则先问 owner 是否有未收口改动) |
| `git -C /Users/wangyixiao/WorkSpace/SayDo branch -vv \| head -1` | `main … [origin/main]`(与远端同步) |
| `git -C /Users/wangyixiao/WorkSpace/Hopper rev-parse "v0.1.0-saydo-baseline.2^{commit}"` | `bdd1e548f9359789497a797eda24398beba68ac5` |
| `git -C ~/.saydo/hopper-dist rev-parse HEAD` | `bdd1e548f9359789497a797eda24398beba68ac5`(锁定副本就位) |
| `rg -n "expected_version" ~/.saydo/config.toml` | `bdd1e548…`(运行时**已切锁 baseline.2**) |
| `rg -n "expected_version" /Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md \| head -1` | 仍 `ea3fb31…`——**这不是漂移,是已知欠账**(canonical 示例块未随切锁回写,阶段 B 清偿) |
| `ls /Users/wangyixiao/WorkSpace/SayDo/e2e/evidence/` | 11 份:`final-readback.md` `gate0-checklist.md` `p0-readback.md` `p05.md` `phase-0..5.md` `review-m-batch.md` |
| `cd /Users/wangyixiao/WorkSpace/SayDo && just ci` | 双矩阵绿(主会话实测约 12s:contracts 65 + daemon 335 + pytest 8 + emoji 门禁自检 4/4,尾行 `[ok] just ci: node + python matrices green`) |

其余门禁(Playwright 8 例、fake-runner e2e 3 例、golden 43 条、音频烟测 5 条)的**准确命令主会话未逐一复跑**——你在阶段 A 从 `e2e/evidence/phase-5.md`/`p05.md` 的"测试命令"段定位原始命令并复跑,把命令与尾行输出记进你的对账报告(这些 evidence 文件声称的命令若定位不到=对账发现,记 [fail])。

## 1. 必读(按序;相对路径以各自仓根为准)

1. `SayDo/HANDOFF.md` — 上一会话交接。**带着怀疑读**:§1 说全线收口,§3 却留着"Phase 2.2 起未做"的旧待办、§6 说 expected_version 仍是 baseline.1——§3/§6 是中途旧段未清理(git log 与运行时配置证明 §1 更接近真相);其 §0"两条硬教训"与 §7"铁律速查"必须全文吸收。
2. `SayDo/e2e/evidence/final-readback.md` — 自报终账与首发交付判定口径(**你的对账对象,不是真理**)。
3. `voice-coding/IMPLEMENTATION-PLAN.md`(v2.5)— 计划基线;文末"评审记录"是计划自身的已修问题账。
4. `voice-coding/IMPL-PROMPT.md` — 首发实施的原始红线/权威分界/自决边界出处(§2/§3/§4/§5)。
5. `voice-coding/docs/09`(契约)/`docs/10`(话术)/`docs/11`(UI)/`docs/modules/a–e`(分域导航)/`AGENTS.md`(评审制度)— 按需查阅的 canonical。
6. `SayDo/e2e/evidence/phase-0..5.md`、`gate0-checklist.md`、`p05.md` — 阶段 A 抽查的证据池。

## 2. 红线摘要(每条都是可判定断言;违反任何一条即停)

1. **零 emoji**:`bash scripts/check-emoji.sh` 在任何提交前必须输出 `[ok] emoji gate: clean`(`→`/`↔` 合法,勾叉警告符禁)。
2. **状态词纪律**:任何新写的文案/代码注释/报告,执行态不得出现"完成";settle 后口径="执行和检查都跑完了,等你验收";合并后才"交付"。
3. **S3 语音绝不放行**;S3 merge 在屏幕审批卡(P1)落地前只走人工合并交接(requestManualMerge + MergeProof watcher),**代码里不得出现自动调用 `hopper merge` 的路径**。
4. **Gate 0 未关 ⇒ 拒 dispatch**,代码无 bypass 分支(grep 断言:不存在绕过 `validateDispatch` 的 dispatch 入口)。
5. **契约不分叉**:类型只 import `@saydo/contracts`;发现实现与 09 形状不一致 ⇒ 以 09 为准,改 09 必须走轻量评审,**绝不静默双改**。
6. **TTS 出口必经 redactor**;测试里的敏感样本一律运行时拼接构造(完整凭据字面量会触发平台防护断会话——上一会话踩过)。
7. **设计库只读**:voice-coding 侧任何文件的修改都必须经"1 个一致性 subagent + 攒批 Codex"仪式并在 evidence 留痕。
8. **每步独立核实**:每次 Write/commit 后用独立 Shell 命令验证真实落盘/真实 SHA(上一会话多次臆想工具结果,HANDOFF §0 明记)。
9. **两提交法**:feat/fix 代码提交 → `chore(evidence)` 证据提交,evidence 记录代码提交 SHA(hash 不自指)。
10. **诚实分级**:你的每个"已完成"必须带本会话可复跑的证据;做不到就写 [warn]/[fail] 与原因,禁止夸大。

## 3. 分阶段任务(竖切;每阶段:做 → 自查 → 自测 → 修 → evidence → 两提交)

### 阶段 A · 独立对账(产出 `e2e/evidence/closeout-verification.md`)

- **门禁全量复跑**并记录命令+尾行:`just ci`、Playwright、fake-runner e2e(对 `~/.saydo/hopper-dist` 锁定二进制)、golden 全套、音频烟测(命令从 evidence 定位,见 §0 末段)。
- **对 `final-readback.md` 逐节抽验**:每个 `[done]` 至少抽 1 个声称实证(测试名存在且绿/文件存在/截图存在);`[adapted]` 核对偏离注记与 canonical 是否冲突;`[skip]/[deferred]` 核对出处真实(如"Codex 12 A3"是否真有此裁定)。
- **专项疑点清单**(必须逐条裁决):
  - HANDOFF 三处内部矛盾(§3 旧待办 / §6 旧状态 vs §1)——按 git log + 运行时配置写明真相;
  - Gate 0 六项:`gate0-checklist.md` 里每项绑的测试名真实存在且本会话绿;
  - §12 契约测试抽查:0.2b 预授权反例子集(①–⑤/⑨/⑩)、§12-8 风险双维反例(ready∧high 拒代跑 / high 不自动 retry)、retry 闸门;
  - 11 §2.6 StatusChip 四联映射与 console 实现一致性抽查 + 截图基线(亮暗各 11 页)存在;
  - trust-report `.md`→`.html` 受控映射 + emoji 呈现层转换的测试真实性(越界路径反例在不在);
  - `review_reject` 返回词与 §6.1 边表的落地形态(final-readback 不实施清单第 5 项声称"实现按边表落取消链")。
- **验收**:全部门禁本会话绿;每个疑点有裁决([ok]确认/[warn]偏离注记/[fail]证伪);报告落盘并提交。

### 阶段 B · 修复与欠账清偿

- 修复阶段 A 的 [fail] 与 A 级 [warn] (修一个复跑一次相关门禁);B 级列清单逐个清。
- **HANDOFF.md 重写为单一真相**:删 §3 旧待办段与 §6 过时句,状态=已收口,剩余=纯 owner 项清单。
- **canonical 回写欠账清偿**(走轻量评审)。注意 HANDOFF §5 的"Codex 攒批待做"可能也是陈旧句——`research/codex-findings/prompts/13-canonical-writeback-m-batch.md` 与 `13b-m-batch-focused.md` 已存在(git log `cd4429e` 显示 13b 批已回修),**先核对 13/13b 报告的覆盖面**,只对未覆盖点行动:
  - voice-coding `docs/09 §11 [hopper]` 示例块 `expected_version` → `bdd1e548…`(与运行时一致,注明切锁完成日期);
  - `docs/09 §13` reviewTask 返回词 `rejected` 勘误(按 §6.1 边表实际形态改);
  - 上一会话回写的 5 处 09 变更(approvals 矩阵 CHECK / §6.1 停靠态边 / §11 项目层白名单 / §11 规则 2 observedModel 分档 / §12 测试锚)中**未被 13/13b 覆盖的部分**,连同上两条新回写,交一次 Codex 攒批复核——命令(在 voice-coding 目录,后台跑 10–40 分钟,期间继续其他工作;**编号用 14**,12/13/13b 已被占用):
    `codex exec --json --skip-git-repo-check -s read-only -m gpt-5.6-sol -c model_reasoning_effort=max "$(cat research/codex-findings/prompts/14-canonical-writeback-closeout.md)" > research/codex-findings/logs/14-canonical-writeback-closeout.log 2>&1`
    (评审 prompt 自己写:列出回写点+出处+验证问题;报告提取到 `research/codex-findings/14-canonical-writeback-closeout.md`,triage 后 A 级必修;若核对后确认全部已覆盖且无新回写,记录结论即可免跑。)
- **验收**:门禁仍全绿;Codex 报告 triage 完毕且 A 级清零;HANDOFF 无内部矛盾。

### 阶段 C · owner 场次支撑 + 待 owner 决议材料

- 为场次①②③④各写一页**现场清单**(步骤/预期表现/失败回退;④=P0.5-D:八条对照现场复跑 + 直达档念清单 + trust-report 展示),落 `e2e/owner-sessions/session-1..4.md`。
- **ADR-002(observedModel 恒定族豁免)复核材料一页**:背景/流内无 model 字段的实测证据/风险面/建议——**上浮 owner 等批复,不自决**(它触及 owner 2026-07-24"严格口径不放宽"表态)。
- ASR key 就位后(owner 开通火山资源;见 HANDOFF §4.1)补跑真实 1.0 跑分并更新 ADR-101;**key 不就位不阻塞其他一切**。
- **验收**:四份场次清单落盘;ADR-002 材料已发 owner;ASR 项状态如实记录。

### 阶段 D · 首发交付判定收口

- 把阶段 A–C 结果合入 `final-readback.md`(新增"收口验证"节,引用 closeout-verification);刷新 SayDo `README.md` 状态行。
- 与 owner 确认后打 tag(如 `v0.1.0-rc.1`)并推远端——**推远端 tag 属对外动作,列检查点**。
- **验收**:closeout-verification 与 final-readback 口径一致;剩余项全部为纯 owner 项(场次/音频底板/dogfood 指定/Actions billing/Claude 订阅)。

## 4. 节奏与检查点(自治循环推进;以下必须停下等 owner)

1. **ADR-002 复核批复**(阶段 C)——批前 observedModel 豁免保持现状运行,不扩大;
2. **场次①②③④本身**——你只备料与现场支撑,绝不代跑真人验收;
3. **超出阶段 B 清单的任何 canonical 语义级变更**;
4. **新花费/新账号/对外推 tag**。
缺省动作纪律:必须确认项无回复 ⇒ 暂停该分支、继续无关工作;可自决项 ⇒ 按建议继续并在 evidence 留痕。卡点格式:背景一句 / 选项 A、B(各一句利弊)/ 我的建议与理由 / 影响面 / 若无回复我将执行的缺省动作。

## 5. 诚实汇报要求

- 完成度只用三级词表:**[ok] 完成**(附本会话真实 git log SHA + 测试命令与尾行输出)/ **[warn] 部分或有偏离**(附具体差距)/ **[fail] 未做**(附原因)。禁"应该没问题/差不多"。
- 每个 SHA 与测试结果必须来自你本会话的真实命令输出(独立 Shell 核实,不引用记忆、不引用上一会话的声称)。
- 收尾把 `closeout-verification.md` + 重写后的 `HANDOFF.md` 作为对账物——owner 之后会用 /impl-review 按这两份对账,夸大会被抓。

## 6. 工作方式约定

- main 直推(单人仓既定惯例,远端 origin 已配);每次提交前 `just ci` 必绿(GitHub Actions billing 未修期间本地即 CI)。
- 提交粒度:每阶段两提交法收口;阶段内修复可多个 `fix:` 提交。
- 评审:阶段 B 的 canonical 回写 = 1 个一致性 subagent + 1 次 Codex 攒批(AGENTS.md 轻量版);纯代码修复 = 每阶段末 1 个 code-review subagent(A 级必修)。
- 遇阻用卡点格式上浮;阻塞型即时发,非阻塞型攒到阶段末。

开始吧:先跑 §0 坐标核验,然后读 §1 文档,进入阶段 A。
