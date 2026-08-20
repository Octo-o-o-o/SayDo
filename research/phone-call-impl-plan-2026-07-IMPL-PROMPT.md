# 通话形态实施 Prompt(发给新会话;**当前锁定,勿提前交付**)

> **锁定状态(owner 2026-07-25)**:方案已定稿但**暂不实施**。解锁触发 = 场次②/③ dogfood 跑 1–2 周、owner 体感"离机只收文字推送"缺口 + 有数据 → 先跑 Phase 0 spike。**触发前请勿把本 prompt 交给新会话开工**;解锁时先轻量核对 canonical(09/04)接缝是否在 dogfood 中漂移。
> 生成 2026-07-25。方案 `phone-call-design-2026-07.md` v3 + 计划 `phone-call-impl-plan-2026-07.md` v3(经 4 subagent + Codex ×2 交叉评审收口;8 项 owner 决策已拍板)。解锁后聊天可直接复制下方全文。

---

你要实施 SayDo 的**通话形态(Phone-Call Mode)**:让 AI 能给 owner 打电话(任务卡住/等审批时手机锁屏来电,接起听汇报、口头给下一步),owner 也能打给 AI;全部走 VoIP(Tailscale 加密),不用 PSTN。这是 P1 特性,P0+P0.5 桌面闭环已工程收口。

## 0. 身份与坐标核验(先做,漂移即停)

用命令核验以下,与描述不符先停下报告 owner,禁止"应该差不多"继续:
1. 设计库(只读):`/Users/wangyixiao/WorkSpace/voice-coding/`;实现仓:`/Users/wangyixiao/WorkSpace/SayDo/`(远端 `github.com/Octo-o-o-o/SayDo`)。
2. 实现仓 `git log --oneline -5` 确认在 P0+P0.5 收口态;`just ci` 双矩阵当前全绿(以实际输出为准,不锚定固定测试数)。
3. 关键代码现状(用 rg 核实,这些是计划的前提):`packages/daemon/src/voice/hub.ts` 的 role 仍是 `pipeline|console` 二值;`net/identity.ts` 仅 loopback/localhost 白名单;`callback/engine.ts` 生产未接线(`index.ts` 不 import callback);`session/manager.ts` 挂起/重建未接进 live 对话环。**若这些已变,说明场次②债务已部分完成,按 Phase 0.5 的"核对"分支处理。**

## 1. 必读文档(按序;设计库路径)

1. `research/phone-call-impl-plan-2026-07.md` v3 —— **主线**:阶段依赖图、四道前置门、Phase -1…8 步骤/验收、工期三口径、风险预案、待 owner 拍板;
2. `research/phone-call-design-2026-07.md` v3 —— 方案本体:§3 安全(SE 在场签名/Gate 0 addendum)、§8 V1–V8 验收、§9 评审 triage;
3. 实现仓 `AGENTS.md`(硬规则)+ 设计库 `IMPLEMENTATION-PLAN.md`(既有 Phase 风格/两提交法/evidence 六段);
4. 按 Phase 需要查 canonical:`docs/09`(schema 照抄源)、`docs/10`(话术)、`docs/04 §5`(审批不变量)、`docs/05 §4`(Gate 0)、`docs/07 D11-D13`。

## 2. 红线(违反任何一条即停)

1. **四道前置门是硬门,不满足不得进入受其保护的 Phase**:① Phase 0 spike 达 Phase -1 已落数并 owner 签认的阈值表;② A1–A9 全修 + V5 十四条负例 + Gate 0 addendum 同一 canonical digest 冻结;③ Gate 0 addendum owner 拍板 + canonical 回写 + **运行时总闸落地**;④ Phase 0.5 通话共享地基门完成。
2. **手机通道硬性 `risk ≤ S2`**(校验器从 Phase 1 固化,三层挂点,无 bypass);**S3 语音/通话绝不放行**,一律话术转屏幕。
3. **S2 消费凭据 = 原生层 Secure Enclave 在场生物识别签名**,不是"解锁布尔 + WebView 点击";锁屏接听只允许去敏摘要 + ack/拒接/推迟。WebView 不持长期凭据,写动作经 allowlist native bridge。
4. **Gate 0 运行时总闸**:`phone_mode_enabled` 默认 `false`;所有手机写路径(HTTP/WS 写端点、APNs、native bridge、receipt consume、callback route)统一调用总闸;逐端点有"Gate 未关拒绝"测试。
5. **不分步上线**:分阶段只为开发顺序;所有 in 范围(方案 §5)一次做完;V1–V8 最终强制全绿,任何 skip/deferred 必须回写范围 + owner 拍板,不得静默降级(尤其 CallKit 若走降级路径,先回写独立验收档)。
6. 涉 canonical(02/03/04/05/07/09/10)先回写走轻量评审(一致性 subagent + 攒批 Codex)再改代码;契约不分叉(import `@saydo/contracts`);零 emoji;状态词纪律;两提交法。
7. **不碰的红线**:S3 屏幕强认证、effect-based 风险、三熔断、状态词纪律、两把钥匙——本特性没有任何一步以放宽它们为前提;若发现"顺手要动",停下上浮。

## 3. 分阶段实施与自治循环(owner 指定的工作范式)

**逐 Phase 推进,每个 Phase 内部执行以下循环:**

1. **Phase 开始前 —— 重评本 Phase**:针对**已实施的内容**,思考当前 Phase 的计划是否仍值得实施、是否需要调整、调整是否影响后续 Phase。
   - 若你有**明确建议**(基于已落地事实的判断,不是凭空发挥)→ **按你的建议继续实施**,并在该 Phase 的 evidence 里记录"重评结论 + 调整 + 对后续 Phase 的影响";
   - 若调整触及**范围/红线/owner 拍板项/前置门**,或你无法形成明确建议 → **停下与 owner 确认**,确认时给出**完整问题描述 + 修正建议**(现状/冲突/两三个选项/你的推荐 + 理由)。
2. **实施该 Phase 的每一步**:按计划步骤表做;涉 canonical 先回写。
3. **每步完成后 —— review + 自测**:自查该步有无疏漏/不足/错误/不一致/过度设计;跑该步验收(机械可判定:test_id/命令/fixture/expected/artifact)。**有问题直接修复/完善并再次 review**,直到该步干净。
4. **Phase 末仪式**:1 个 code-review subagent(A 级=安全/契约/数据丢失,必修);跑 `just ci` 双矩阵绿;两提交法(`feat(phase-N)` → `chore(evidence)`,evidence 记代码提交 SHA、六段式 + §12 条目对照);canonical 回写攒批 Codex。
5. **确认完美实施后,提交代码,开始下一个 Phase。**

**必须停下与 owner 确认的检查点**(其余自治推进):
- 任一前置门不满足(尤其 Phase 0 spike 不达阈值、Gate 0 addendum 待拍板);
- Phase -1 阈值表数值、媒体 A/B 选型、CallKit 降级触发后的范围/V1 重定义、S3 手机承载、Phase 0.5 场次②债务边界——这些是"待 owner 拍板"项(计划文末);
- 需要不可逆或范围外操作;真机操作需 owner 在场配合(0.2/0.4/6.x/8.4)。

## 4. Phase 速览(详见计划 v3)

Phase -1 owner 前置+阈值签认 → 0 spike(止损门)→ 0.5 通话共享地基门 → 1 契约+Gate0 运行时总闸(owner 拍板)→ 2 网络身份 v2+配对+WebView 认证+写 API → 3 VoiceHub phone role+媒体+A2 live 接线【∥4】→ 4 APNs+投递表+来电状态机 → 5 daemon 编排(呼出呼入+S2 门控,注入测试)→ 6 iOS 原生实现(真机)【∥7】→ 7 熔断+话术+安全反例 → 8 真机全链 V1–V8+readback+owner 场次⑥。

工期三口径(串行 40–55 / 关键路径 34–47 / 另计评审+owner+分发);Phase 0 后按 spike 重估回写。**Phase 5 只在 daemon+注入层验协议,CallKit 全链与 SE 签名的真机验收在 Phase 8**(勿在 Phase 5 声称验真机)。

## 5. 诚实汇报要求

- 每 Phase evidence:[ok]完成(给代码提交 SHA + 测试/golden 尾行输出)/[warn]部分(差什么)/[fail]未做(为什么);重评结论 + 调整 + 对后续影响;canonical 回写附评审记录位置。
- 完成度不夸大:"库+测试就绪"≠"生产接线";"注入测试绿"≠"真机验收过"——分别如实标注。
- 交付判定 = Phase 8 的 V1–V8 全绿 + readback + owner 场次⑥;之前一律不称"完成/交付"(状态词纪律)。
- **绝不臆想工具结果**:每次 Write/Shell/提交后用独立命令核实真实落盘与 SHA(实现仓 HANDOFF §0 的一手教训)。
- 敏感样本(密钥/证书形态)一律运行时拼接构造,不写完整字面量(防平台内容防护误伤)。

## 6. 工作方式

单人实施走竖切(每 Phase 一个端到端切片);分支/提交按实现仓 AGENTS.md;遇阻先按自治循环判断,够明确就带建议继续,触红线或范围就停下带完整问题描述 + 修正建议找 owner。实施完成后可用对账复审(readback)核验。
