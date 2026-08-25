# 21 · 对抗性评审:R-A 合同轮(S3 屏幕审批卡 + writing 窄版 + 场次① canonical 补丁包)

你是对抗性评审员。仓库 `~/WorkSpace/voice-coding` 是 SayDo 设计文档仓(docs/01–11 canonical,09 是实施照抄源);实施仓 `~/WorkSpace/SayDo`(只读参照,HANDOFF/e2e evidence 是现状真相)。

## 本轮变更(R-A 合同轮,2026-07-26;owner 三项已拍板:WebAuthn platform authenticator / writing 走 worktree 交付 / step_confirm 承载 deferred)

三块 canonical 回写,请全部核验:

**A · S3 屏幕审批卡(WebAuthn)**:04 §5.1 merge 措辞精化("人触发"= passkey 强认证签发 S3 收据 + daemon 执行);09 新增 §3.3(WebauthnCredential/S3Challenge schema + 签发链 + Tier1 合并链复用 review_approved_waiting_merge→merging + requestManualMerge 降级 + 三红线:无收据不合并/S3 仅本机/Hopper merge 保守人工);09 §13 新增 registerWebauthn/issueS3Challenge/verifyS3Assertion/approveMerge 四工具 + requestManualMerge 降级注;09 §3 turn_ref CHECK 放宽(仅 voice 必填);11 §5.4 S3 卡 WebAuthn 交互 + §5.5 合并按钮语义。

**B · writing 窄版(worktree 交付)**:09 新增 §6.1a(复用 Tier1 route/worktree/合并链;verify=内容评审 gate 非测试;WritingSettleProof schema;逐节停靠复用 paused_step_boundary;content_done);09 §13 explainResult 加 content_done;09 §11 enabled_project_types 加 writing;02 §5.0 与 05 提前批 #5 分期行改"合同已落"。

**C · 场次① canonical 补丁包**:04 §2.2-2 + 09 §13 assessReadiness 空账本 fail-closed(dims 从类型就绪清单机械派生 readinessSkeleton,零 dims 恒 gap_critical);10 #1 结果类话术仅回叫链硬规则;10 §3-7 桌面采集交互(toggle/hold/免手 + 录制中反馈 + 采完不直发);11 §5.10 输入区(消息流/输入区分离修 Output 叠 Input、语音+文字双呈现、思考中反馈);09 §2 proposed 终态语义(TTL 24h + 新提议 supersede)+ [params].proposed_ttl_hours;09 §6.1 step_confirm 步界边 deferred 分类型(writing 启用/coding deferred);09 §3 tailnet S2 收据口径对表(push/paired_device_pin,对齐 04 §5.2)。

## 请对抗性审查(先读上述落点,重点)

1. **S3 卡安全性(最高优先)**:WebAuthn 签发链有无重放/克隆/降级绕过漏洞?rpId=localhost/tailnet 不放宽的隔离是否真的堵死远程 S3?"无 S3 收据不进 merging"的机械强制点是否明确?challenge 单次消费/signCount 单调/120s 窗是否够?requestManualMerge 降级会不会成为绕过 S3 卡的旁路(即不注册 passkey 就永远走弱的人工交接)?
2. **空账本闸正确性**:"dims 从就绪清单机械派生 → 零 dims 恒 gap_critical"是否真的堵住 W1 实测的"空账本判就绪"漏洞?会不会矫枉过正把合法的"简单任务快速就绪"也锁死(与 02 §5 Quick 车道冲突)?readinessSkeleton 纯函数与 Brain instructions 就绪清单"同源"是否会双源漂移?
3. **writing 复用自洽性**:writing 走 worktree+合并链,但"非 coding 无 merging"(04 §6)——§6.1a 说 writing 也合并回主分支,与 04 §6 是否冲突、需否同步改 04 §6?WritingSettleProof 与 Tier1SettleProof 在 tasks 表如何并存(route=tier1 按 project.type 二选一)是否有 DDL/契约落点?内容评审 gate 替代 verify 测试,settle barrier"四项俱备"对 writing 具体指什么?
4. **契约完备性**:新增 schema(WebauthnCredential/S3Challenge/WritingSettleProof)有无对应 DDL 表/列缺失?§12 契约测试清单是否需要新增项(我只在 §3.3 列了 S3 卡反例,其余是否遗漏)?proposed TTL 的 expiresAt 派生与 §0.1 digest 签名域(expiresAt 是派生不可变值、不入签名)有无冲突?
5. **分期与实施现状**:writing/S3 卡标"合同已落"→ W4 实施——与实施仓 SayDo 现状(HANDOFF)有无冲突?enabled_project_types 加 writing 但 W4 未实施,会不会导致"开值了但执行器不认"的中间态?
6. **红线一致**:与 AGENTS.md、HANDOFF §4(契约不分叉/S3 语音不放行/不自动 hopper merge)、既有 04 §5 治理是否冲突?有无过度设计(为假想需求发明机制)或不足(owner 明确要的没落)?

## 输出

报告写入 `research/codex-findings/21-ra-contract-review.md`(简体中文):结论一句话 → A 级(硬伤必修,给修法)→ B 级 → C 级 → 免修确认清单(逐条,给文件/行证据)。若无 A 级明说。不改任何 canonical 文件。
