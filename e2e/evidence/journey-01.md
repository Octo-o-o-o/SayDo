# DAILY-01 / JOURNEY-01 本地集成收口

日期：2026-09-23。状态：LOCAL_GREEN_REMOTE_PENDING。本地代码批已收口，不表示远端CI、真实设备验收或生产发布。

## 授权与实际集成

owner本次明确授权“确认本地合并与收口”。原主仓main `25d96595cde150428b6840e450e15f11d50f021f` 干净，候选分支 `codex/journey01-accepted-20260923` 干净；使用 `git merge --ff-only` exit 0，本地main已到证据提交 `d05d8eeba7ec40159ff3586c8e557b6d70fcc9bd`。

产品提交：`62b07c243879189fca221f42449e033fc596b2f7`。产品238路径逐项SHA-256及提交路径集与冻结输入一致。证据提交为其直接后继。来源工作树和原日志完整保留；未reset、未清理旧候选。

本次收口仅更新排产、历史标记和证据，不改产品源码、合同或测试。PLAN-2 revision 12，active=none、last_closed=JOURNEY-01、next=PG-02；HANDOFF由schedule-pointer --render生成。DAILY/JOURNEY同一集成包验收，不补造历史中间开批事件。PG-02未开工，App Server未开批，本次不重新排序其他任务。

## 验收证据与限制

原验收输入为HEAD `25d96595cde150428b6840e450e15f11d50f021f` + git-diff-v1 `0d18cdc58ac271b617f51d44662a956a34a5db2b72f55d6451d5b9afccaceba1`。review15语义通过，review16核门禁GREEN但属于重复评审；校验器的reviewer_budget_exceeded保留，owner具名接受该一次例外，不宣称流程校验自动通过。

原完整门禁：just ci / Playwright / just precommit均exit0；Python64 passed，Playwright54 passed；Node报告3263 passed、21 skipped，跳过不计通过。三日志字节与SHA-256本次已核匹配，详见[本地验收原始记录](../../docs/review/2026-09-23-journey01-local-acceptance.md)。本次整合前另复跑语音关键5文件25 passed，未重新消耗无产品变更的全量门禁。

七步参考旅程连接真实daemon/SQLite/API/WS及文件产物、verify proof；模型与CLI为确定性替身。正例保留npm并增加pnpm，负例删npm检查失败/禁批；坏引用服务端拒批。它不替代真实模型与硬件验收。

## 保留事项

- 三个P2沿原组延期：看板列遗漏ready_for_review；安排前置标题字段错配；依赖preId:null与taskId互斥缺口。
- 真实模型/CLI、麦克风、云ASR、多设备、远端CI均未验；owner真人场次仍待安排。
- TTS延迟跨轮归属、HF延迟观测与EOU标点属于后续研究小批，不称本批已修。
- 未push、未发布、未部署、未更新常驻runtime。不得因本地合并升级为生产GREEN。

本次后续文档卫生、排产与账本检查记录见同日PROCESS-JOURNAL收口条目。本文件引用既有产品/证据SHA，不自指收口提交。
