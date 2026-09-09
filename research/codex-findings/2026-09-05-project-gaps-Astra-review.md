# Astra 项目缺口建议独立复审

> `review_scope=step`；`review_ordinal=1`；候选 HEAD `bcf8ea855f25b177888d9159f75e49214f3dd892`；`git-diff-v1` fingerprint `a8bde2f9c6bada083653bf4d8ebc81c3231e71f996dd29c98c6b5fe621f13c51`。
>
> 被审报告：`docs/review/2026-09-05-project-gaps-Astra.md`，SHA-256 `cd5507a0449561b2653c8fa931c73ef3d5bed11eb63f3519abb8f11b043a055b`，20916 bytes。

## 结论

[ok] GREEN。报告的主要事实均可从冻结生产路径或明确标为合成的探针复核；建议集中在可见损失、最小行动和可判定出口，没有把已有备份、状态所有权、Tier1 路线、记忆预算、移动重连等能力误报为缺失。报告也没有建议收集外部用户实际使用或反馈。

本结论只表示建议报告满足 A1–A4，不表示产品门禁、真实性能、daemon E2E、外部 provider、真机或发布状态为 GREEN。

## A1 事实准确与 canonical 可达

| 取证面 | 复核结果 | 独立证据 |
|---|---|---|
| 现役 UI 动作与预算 | [ok] | 报告第 33–43 行所述正式路由、放弃错写归档、预算 `0/0` 投影及部分占位动作，分别可由 `packages/console/src/App.tsx:80-88`、`packages/console/src/pages/redesign/RecordsPageRoute.tsx:70-82`、`packages/daemon/src/api/focuses.ts:143-153`、`packages/console/src/hooks/redesign/mappers.ts:260-277` 复核。`docs/11-ui-spec.md:26,264-265` 明确区分放弃与归档并禁止 unknown 显示为零。 |
| 看板更新与部分失败 | [ok] | `packages/console/src/hooks/redesign/useBoardPageData.ts:49-69,73-100,150` 确为 `N+2` 请求、详情失败转 `null` 后跳项、仅 `tick` 失效；`BoardPageRoute.tsx:83-89` 只在本页弹窗成功后 reload。生产 hook 加合成 API 的探针复现 20 个 Focus、22 次初始请求、两秒零自动请求和单详情失败后静默剩 19 项。 |
| 远程、admission 与审计 | [ok] | `net/capToken.ts:11-21`、`net/pairUrl.ts:25-34`、Console `lib/api.ts:20-26,47-50` 支持长寿命全局 token 经 URL/localStorage/WS query 的判断。`setupApi.ts:1334-1359` 同时证明未知端点共用 env 槽且既存 key 不会无条件复用，报告第 83 行的收窄准确。`live/dialog.ts:1015-1021` 与 `storage/dao/misc.ts:83-99` 形成生产 raw text 调用点与原样 sink；`docs/modules/e-crosscutting.md:28` 要求原文不进审计。 |
| 数据升级与恢复 | [ok] | `storage/db.ts:11-24,39-45` 打开即迁移且不拒绝超前版本；`backup/cli.ts:21-30` 先 `openDb` 后快照。探针以临时库复现版本 9999 仍可打开。`backup/snapshot.ts:156-164,301-317` 已有 SQLite backup 与 `quick_check`，报告正确保留现有备份系统。 |
| 语音测量与流式路径 | [ok] | `docs/03-architecture.md:62-64` 同时要求 P50/P90 与级联流式；`obs/latency.ts:123-133` 只用 P50 形成 `passPublish`。`openaiCompat.ts:113-131`、`brain/dialogLoop.ts:643-649`、`pipeline/hub_client.py:493-511`、`doubao_tts.py:148-158` 证明当前 API 级联指标分别近似完整模型响应和整句音频。`obs/latency.ts:75-101` 的 partial 无回收而 completed 有 500 条上界。 |
| 工具、分发与键盘交互 | [ok] | `evaluator/snapshotter.ts:60-72` 只支持三类本地来源并对 web/artifact fail-closed；`brain/liveTools.ts:557-2480` 注册面以项目、任务、审批、记忆、Focus 和本地文件为主。README 第 18–47 行诚实说明公开包已有一键安装且不含 pipeline；`packages/cli/src/options.ts:4-5,30-33` 只有 `up/status/open`。`TaskModal.tsx:141-180,425-439` 有 dialog 语义但未见焦点圈、Escape 或归还焦点。 |

报告第 37、97、126、144、157 行还明确保留现有保守拒绝、快照实现、daemon 单一状态所有权、现有安装入口、记忆预算与 heard 历史恢复，未重复登记已修的 PG-01A 公共 claim 问题。

## A2 建议价值

[ok] 各主要方向都有具体损失、最小行动与验收出口。UI 方向绑定错误 durable transition、伪精确预算、静默丢项和陈旧页面；数据方向绑定旧 binary、新 schema、恢复点和引用一致性；语音方向先修口径与分母，再限制到一条级联路径；外部资料方向限制为一种资料的快照、引用、回读和导出；诊断方向复用现有 status/health/setup。报告第 152–158 行主动排除换数据库、恢复双执行路线、通用连接器平台、盲目 RAG 和按测试数量计功。

页面负载与 logger 建议使用条件式验证。报告第 120–124 行没有把同步写直接宣判为现有事故，第 122 行也把 20/100 明确标为工程样本而非支持承诺，符合证据强度。

## A3 范围与排产

[ok] 报告第 25 行与 `docs/plan/IMPLEMENTATION-PLAN-2.md:13-25` 的现势指针和串行链一致。PG-01B、PG-02、PG-04、PG-05、PG-06 的映射分别符合该计划第 81–149 行；SP5/SP6 只作为条件包出现。报告第 3、21–23、70、136–140、148 行持续声明未授权、需选定切片或等待分发触发，没有直接开包。

[ok] 全文未提出外部用户招募、实际使用、访谈、反馈或真人场次建议；“实际出声”只指语音播放埋点，不是用户研究。

[warn] 两处载体措辞可进一步缩窄，但现有“不改排产/未获授权/新增实现须显式入排产”上下文足以避免形成 P1：

- 报告第 20 行宜把“纳入 PG-02 核对范围”改成“PG-02 只登记或核对 action denominator；看板失效与聚合读口另经 owner 显式入排产”。`IMPLEMENTATION-PLAN-2.md:93-103` 的 PG-02 是最小真相控制面，不是看板读模型实施批。
- 报告第 21 行宜说明 SP3c 只是在 voice candidate 出现时共同触发 restart/cancel/error evidence，并非流式化实施载体；依据是缺口总案第 1808–1815 行的 SP2d/SP3c/SP5/SP6 条件表。第 138 行的后续 SaaS 也应继续受 SP6 的具名 owner 选择与维护能力条件约束。

## A4 证据诚实

[ok] 报告第 53–64、85、91–97、103–109、122、140、150、160–188 行逐项限定了证据边界。探针源码没有联网、真实凭据或常驻实例访问：`structural-probes.mts` 使用合成 trace 与临时 SQLite，`board-hook-probe.mjs` 用 Playwright 加全量路由 fixture 截获 API。探针断言对应正文所称当前行为，不把 `exit 0` 写成建议验收达成。

[ok] 冻结报告中的命令输出与本轮复跑一致；报告明确未运行 `just ci`、真实 provider、真机或生产升级，并明确建议 GREEN 不等于产品 GREEN。

## 主要投入方向判断

| 投入方向 | 决定 | 理由 |
|---|---|---|
| 现役操作、状态与预算准确性 | retain | 正式入口可达，错 transition 与伪精确值会直接误导操作；PG-01B 止损、PG-02 分母闭合已有明确出口。 |
| 远程凭据、请求准入、审计隐私 | retain | 生产路径和 canonical 红线均可达，且分别已有 PG-01B、PG-04、PG-06 承载；报告没有夸大为匿名公网攻击。 |
| 数据升级与恢复 | retain | 未来 schema 可打开、备份前先迁移均可复现；建议复用现有 backup API，行动范围最小。 |
| 页面实时性与业务读模型 | narrow | 隐藏失败、陈旧状态与请求扇出值得保留；PG-02 只负责登记/动作分母，任何聚合读口或失效机制实施须另行显式入排产。 |
| 语音延迟与流式处理 | narrow | P90 假绿、近似命名与 partial 分母是立即可修的准确性问题；流式实现应由独立获批切片承载，SP3c 只提供 voice restart 共同门。 |
| 工具与外部资料处理 | retain | 一种资料的不可变快照、引用回读和导出是具体纵切片；报告明确先读后写、单一来源起步、SP5/SP6 条件生效且未选择供应商。 |
| 诊断、安装后的维护 | retain | 已有一键包和 status/health，不重复建议安装器；doctor 仅在下一次分发变化触发并复用现有诊断。定向键盘验证也限定在触达正式组件时。 |

没有主要方向需要 drop。

## Deferred P2 ledger delta

- `ASTRA-P2-001`：收窄条件包与实施载体措辞。位置为报告第 20–22、136–140 行；影响是后续读者可能把 PG-02、SP3c 或 SP6 误当作已经授权的实现载体。状态 `open`；最小修订见 A3 的两条 `[warn]`，不改变建议本身与当前串行链。

## 门禁结果

```text
bash docs/plan/astra-gap-review-control/probes-gate.sh
exit 0
latency n=20,p50=1000,p90=10000,passPublish=true
budget spent=0,max=0,currency=CNY
schema count=31,max=31;future version=9999 opened=true
audit rawSentencePersisted=true,syntheticOnly=true
board initialFocuses=20,initialRequests=22,automaticRefreshRequests=0
board retainedOldGeneration=true,detail failure visibleFocuses=19,pageError=null

bash docs/plan/astra-gap-review-control/docs-gate.sh
exit 0
[ok] emoji gate: clean
[ok] active document links: files=139 broken=0
git diff --check: exit 0,无输出
```

## Review Manifest

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 1,
  "candidate_head": "bcf8ea855f25b177888d9159f75e49214f3dd892",
  "diff_fingerprint": "a8bde2f9c6bada083653bf4d8ebc81c3231e71f996dd29c98c6b5fe621f13c51",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [
    {
      "id": "ASTRA-P2-001",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892",
      "location": "docs/review/2026-09-05-project-gaps-Astra.md:20",
      "evidence": "docs/plan/IMPLEMENTATION-PLAN-2.md:93；docs/plan/2026-08-28-project-gap-closure-program.md:1808",
      "impact": "条件包关联可能被误读为 PG-02、SP3c 或 SP6 已承载并授权对应实现。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892",
      "resolution": "明确 PG-02 只核对 action denominator；看板读模型另行入排产；SP3c 只作 voice restart 共同门；后续 SaaS 仍受 SP6 owner 选择与维护条件约束。"
    }
  ],
  "focused_gates": [
    {
      "name": "report-docs",
      "exit_code": 0,
      "summary": "emoji clean；active document links files=139,broken=0；diff check clean"
    },
    {
      "name": "report-probes",
      "exit_code": 0,
      "summary": "结构与浏览器合成探针均复现报告所述行为，并保持 synthetic-only/component-only 边界"
    }
  ],
  "stop_reason": null
}
```
