# Codex 攒批评审 14:canonical 回写批 3(首发收口批)

你是独立评审员,复核 SayDo 项目 canonical 文档(`docs/09-data-contracts.md` 为主)的七处回写。
设计库根 = 当前目录(voice-coding);实现仓 = `/Users/wangyixiao/WorkSpace/SayDo`(可读源码与测试作证据)。
你只读不写。产出:逐条裁决(通过 / A 级硬伤 / B 级应修 / C 级建议),每条给位置(file:line)、问题、最小改法。

## 背景

首发实施期间对 docs/09 做过三批回写:批 1(裁决回填,Codex 12 已评)、批 2(M1-M11 文档侧,Codex 13/13b 已评,3A+7B 已回修)、
本批 = 批 3:五处实施期回写(仅过一致性 subagent,未经 Codex)+ 两处收口新回写。09 是 schema/DDL/工具契约的唯一 canonical,
SayDo 实现只 import `@saydo/contracts`(照抄 09)。评审目标:七处回写与 09 全文、04(交互)、10(话术)、11(UI)、
docs/modules/a-e、SayDo 实现是否自洽;有无新内部矛盾;措辞是否可机械判定。

## 待复核七处

1. **09 §9 approvals 矩阵机械化 CHECK**(搜 `decided_via IN` 一带,以及 §9 approvals DDL 的条件式 CHECK 块):
   词表 CHECK + screen 强认证 + runtime_effect 必绑父包 + S3 只走 screen 等。验证:与 §3 正文矩阵逐条等价?
   有无矩阵行漏翻译成 CHECK?与 SayDo `packages/daemon/src/storage/ddl.ts` approvals 表一致?

2. **09 §6.1 停靠边**(约 297/315/330 行):`paused_step_boundary → blocked`(T:30s 无应答)、
   停靠态老化 `→ cancel_requested`(T:parkedDeadline,cancelReason=park_expired)。验证:与 04 §5.4 步骤边界语义、
   10 #30 话术、11 §2.6 parked 派生态一致?T 边触发器与 U 边有无竞态歧义?

3. **09 §11 项目层白名单**(约 748 行内嵌 §12-9 断言 + [git] 段):项目层出现 models/providers/gate0/hopper/privacy/voice
   任一键即拒;`params.backup_retention_days` 项目覆盖被剥;`[git].protected` 取并集。验证:白名单枚举与
   SayDo `src/config/load.ts` PROJECT_OVERRIDABLE_KEYS(budget/dnd/params)的"缺省即禁"语义等价?
   [git].protected 并集语义在 09 何处、与实现(protectedBranches)一致?

4. **09 §11 规则 2 observedModel 按 provider 分档**(约 727 行):api/cursor 严格(缺失即作废)、
   codex_cli/claude_cli 恒定族豁免(缺失不作废,流内有 model 仍校验)。验证:分档表述与 ADR-002
   (SayDo `docs/adr/ADR-002-byoa-observed-model.md`)一致?与 owner"严格口径不放宽"表态的语境限定
   (api/cursor 有谎报面)表述清楚吗?注意:ADR-002 正在 owner 复核中,你只验一致性不拍板豁免本身。

5. **09 §12-3/§12-9 测试锚**(§12 清单 3/9 两条):批 2 时补的测试锚点(打断作废/params 断言/routed_provider 等)。
   验证:锚点与 SayDo 测试名真实对应(`packages/daemon/test/` 与 `packages/contracts/test/`)?有无锚了不存在的测试?

6. **09 §11 [hopper] expected_version 切锁回写**(约 653-666 行,2026-07-25 新回写):
   `expected_version = "bdd1e548…"` + `expected_tag = "v0.1.0-saydo-baseline.2"` + 切锁历史注释。
   验证:与运行时一致(声称 ~/.saydo/config.toml 同步——你无法读 ~,以文内自洽为准);
   与 §6.2/§6.3 的 baseline.1 过渡兜底表述(全文多处)有无冲突(过渡兜底应降级为非缺省而非删除);
   tag 对象 SHA 警告(ff6cee28 不可用作断言)保留了吗?

7. **09 §13 reviewTask 返回词勘误**(约 782-784 行,2026-07-25 新回写):
   返回 state 由 `"rejected"` 改 `"review_approved_waiting_merge"|"running"|"cancel_requested"`,
   注释说明 reject 走取消链(§6.1 无 rejected 边)。验证:与 §6.1 边表(ready_for_review 出边)、
   §6.3 cancel settled 判据、10 #34 话术、SayDo `packages/daemon/src/tier1/operations.ts` reviewTask 实现一致?
   §13 其他工具(cancelTask 返回 state 词表)与本勘误有无联动遗漏?09 全文其他 `rejected` 出现处
   (如 ApprovalReceipt.outcome 枚举)是否不同实体、无需联动?

## 输出格式

按 1-7 逐条:`#N|级别(通过/A/B/C)|位置|结论一句|问题(如有)|最小改法(如有)`;
最后一节"横切发现"(七处之外你顺带发现的 09 内部矛盾,标注级别)。中文输出。
