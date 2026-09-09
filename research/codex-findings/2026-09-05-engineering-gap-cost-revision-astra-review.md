# 工程缺口方案成本修订 · 独立验收报告

结论：`GREEN`。本轮只按 `value`、`boundaries`、`handoff` 三个维度审查冻结候选；未发现 A1–A4 的 P0/P1 blocker，也没有新增 P2。

候选身份：HEAD `bcf8ea855f25b177888d9159f75e49214f3dd892`；`git-diff-v1` fingerprint `a85ba64c7fbddb9d471a3cc787465493dd9854db1b5d49f078040066eea32d77`。开始核验命令为 `python3 ~/.octoworkflow/candidate_fingerprint.py --expect a85ba64c7fbddb9d471a3cc787465493dd9854db1b5d49f078040066eea32d77 .`，返回的 HEAD 与 fingerprint 均和冻结身份一致。报告落盘后的结束核验运行同一命令，也以 exit 0 返回同一 HEAD 与 fingerprint。

## A1 · value / boundaries

[ok] 两份文件都保留了现行安全链和 PG-01B 的动作、预算、远程止损边界。综合方案 `docs/plan/2026-09-05-engineering-gap-consolidated.astra.md:95-117` 保留 A01–A04、现行 `PROC-01 → PG-01B → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop`，并写明远程关闭会使手机或远程浏览器失去业务查看和操作能力，包括只读数据；本地正常入口继续可用。实施 prompt `docs/plan/IMPL-PROMPT-engineering-gap-consolidated.astra.md:53-69` 将同一损失、受限态、已有本地替代入口和 `abandon` / budget unknown 等原验收保持在默认 PG-01B 合同中。

[ok] 安全重开条件具体且没有为可用性保留不安全远程只读口。两文均绑定缺口决策表 D6/D18、相应 ADR、认证加密传输与信任根、逐设备最小权限及撤销、凭据存储/轮转、兼容与恢复，并要求重配对/重登录等负担显式告知。真实排产源 `docs/plan/IMPLEMENTATION-PLAN-2.md:81-103` 仍以 `remote_business_403 + budget_unknown` 为安全缺省；`docs/plan/2026-08-28-project-gap-owner-decisions.md:80-99` 也确认 D6/D18 未签时业务远程关闭或 unsupported。

[ok] 文档修订没有冒充产品或排产授权。综合方案 `:57`、`:113-117` 明确“保留/提名”不等于授权且不修改 PLAN-2；实施 prompt `:3`、`:9-17` 只在 owner 于新会话明确要求实施时选择当前 next，并再次排除 commit、push、merge、install、deploy 的预授权。

## A2 · value / boundaries

[ok] 页面刷新改为动作成功、已有事件和前台/重连恢复优先，先列事件覆盖与缺口，再保留有界兜底及手动重试。综合方案 `:141-151` 与实施 prompt `:91` 同时冻结新鲜度上限和每活跃页面请求预算，覆盖后台暂停、事件突发、多标签、离线恢复、局部详情失败、请求重叠和晚到旧响应；两文都明确拒绝固定 5 秒全量刷新、统一 6 秒承诺，并把 N+2 仅作为读取形状和负载估算。源码核查与之相符：`packages/console/src/hooks/redesign/useBoardPageData.ts:42-69` 当前一次读取列表、attention 和每项详情，`:99-100` 会跳过失败详情，`:150` 只由手动 tick 触发；`packages/console/src/shell/Layout.tsx:315-338` 证明现有 focus 事件、路由刷新和 10/30 秒侧栏轮询只覆盖部分变化。

[ok] VOBS-01 保持最小、有界并计入失败分母和日志保留。综合方案 `:125-139` 与实施 prompt `:89` 要求样本下限、P50/P90 双条件、pending 容量与 TTL、取消/超时/缺段计数、模式/工具分组、日志输出频率及保留容量/期限；不新增公开 API、外部监控或真实 provider 费用。源码 `packages/daemon/src/obs/latency.ts:75-113` 显示当前 complete 有 500 条上限而 partial 无回收，`:123-133` 只按 P50 判 publish，确有候选要修的有限缺陷；`packages/daemon/src/index.ts:2901`、`:3055-3066` 证明生产接线存在。

[ok] VOICE-01/02 按同模式证据只选一处瓶颈，没有固定 TTS 先于 LLM。综合方案 `:153-165` 与实施 prompt `:93` 保留完整输出校验、锚定/落账/模型身份/脱敏闸，覆盖取消、迟到 chunk、缓冲、重试、并发及已生成未消费的计费负担；无安全早播路径或收益/资源不合格时停在旧安全路径。当前整句 MP3 发送和逐句 `Audio` 播放事实可由 `pipeline/src/saydo_pipeline/hub_client.py:482-517` 与 `packages/console/src/voice/useVoiceChannel.ts:328-347` 核到，候选没有把网络 chunk 冒充实际出声改善。

## A3 · value / boundaries

[ok] 最小被动诊断已与分发改造解耦。综合方案 `:167-173` 和实施 prompt `:95` 限定 HOST-01 只聚合现有本地状态及已记录失败，不探测 provider、不执行第三方 CLI、不新增后台服务或必填配置；只有具名分发需求或可复现身份差异才进入同包验证，迁移/自动升级还受恢复、兼容和 owner 当次授权约束。

[ok] gist、更多供应方/本地模型、外部连接及 HOST-02 均退出近期默认范围，并各有可判定触发或停止边界。`CONTEXT-01` 需先证明约束丢失且现有 pack/记忆不足，不能证明改善即不启用；`READ-01` 只为一个现有工具无法满足的具名资料任务选择一个只读来源；额外供应方/本地模型只在现有供给不能满足具名需求且维护能力成立时验证一种组合。综合方案 `:175-183` 与实施 prompt `:13`、`:95-104` 一致。

[ok] 每个实际开批的执行副本都必须补四行：用户可见回报、增量运行成本与上限、用户负担、维护责任及停止/扩展条件。综合方案 `:121-123` 和实施 prompt `:29-38` 都要求在冻结验收前可判定；既定止损不受无关全项目成本基线阻塞，也不新增成本平台、通用 checker 或额外审批。

## A4 · handoff

[ok] 新会话入口可有界选择一批。实施 prompt `:9-17` 区分状态/方案询问、按 prompt 明确继续当前 next、具名改选未排产候选三种路径；`:29-49` 每次只锁一批，`:87-104` 为新增候选给出生成规则和禁止捷径。Grok 产品实施与独立零上下文 Codex 只读 review 的职责在 `:21-25`、`:106-134` 分离，未把候选表自动升级为施工授权。

[ok] 两文的选择顺序、成本边界、停止条件和授权语义一致。冻结文档门 `bash docs/plan/astra-gap-cost-revision-control/docs-gate.sh` 返回 exit 0，原始摘要为：handoff validator `status=valid`；`[ok] emoji gate: clean`；`[ok] active document links: files=142 broken=0`；`[ok] Fable 29 / Astra 11 coverage; source hashes; document links; whitespace; one workflow contract`。两份候选 SHA-256 分别为 `a527f2ce59fe692070ca98215c7ef4fe88e1c142d8e48ec4e2eab6458ec85ba7` 和 `fe996a266c282f29adf6081b7d1a52113d02d558bbc7d506666fe88aaf75acc7`，与冻结 reviewed-file manifest 一致。

[ok] 综合方案 `:195-199` 明确 fixture、真实 provider、运行日志、播放器和常驻部署的证据边界，称初版 GREEN 只绑定旧摘要且不能替代本次修订审查；没有声称新建议已实施或实测提速。

## 验证限制

按冻结 brief，本轮没有运行 `just ci`、Playwright、产品 CLI、真实供应方、live runtime 或部署。曾尝试以 `pnpm exec tsx research/astra-gap-synthesis/comparative-probes.mts` 复跑只读探针，隔离工作树缺少可执行 `tsx`，命令 exit 254，原始错误为 `Command "tsx" not found`；该探针不是本轮冻结门禁，相关现势事实改用上述源码定点核验，没有据此宣称运行效果。

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 1,
  "candidate_head": "bcf8ea855f25b177888d9159f75e49214f3dd892",
  "diff_fingerprint": "a85ba64c7fbddb9d471a3cc787465493dd9854db1b5d49f078040066eea32d77",
  "review_scope": "workflow-final",
  "blockers": [],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "cost-revision-docs",
      "exit_code": 0,
      "summary": "handoff、emoji、活动文档链接、Fable 29/Astra 11 覆盖、来源 hash、whitespace 与唯一 workflow-v2 均通过"
    }
  ],
  "stop_reason": null
}
```

## Supervisor 收口记录

本节为独立报告之后追加的机械收据，不改写 reviewer 结论。此次为 owner 在初版收口后明确要求的成本取舍修订，旧审查、原稿和旧计数保持原样。

- reviewer 已退出；supervisor 复核 `candidate_fingerprint.py --expect` 为 exit 0，当前 candidate 与审查身份相同。
- reviewer 在 supervisor 尚未登记初次 review completion 时提前运行 validator，得到 `unreviewed_candidate_green`。未消费该状态；之后按真实退出/指纹事实通过 `cycle_state.py --advance` 登记 completion receipt（零 repair/rereview 成本），再运行 `validate_review_manifest.py`，返回 `status=valid,next_action=full_gate`。没有手改 state、重复派 reviewer 或使用旧 GREEN。
- supervisor 运行冻结 `cycle_control.py --record-gate --gate-name cost-revision-docs`：exit 0；`--finalize` 返回 `finalized`。原始输出包含 `handoff status=valid`、`emoji gate: clean`、`active document links: files=142 broken=0`、`Fable 29 / Astra 11 coverage; source hashes; document links; whitespace; one workflow contract`。
- 本次修订唯一最终 P2 sweep：0 项；两份方案/Prompt 在评审后未改动。未改产品代码、canonical 或排产；未 commit/push/install/deploy。

日志只保存在 ignored `.local/`；`cost-revision-docs.log` 为 543 字节，SHA-256 `c54f37b2a16082d8c5837af93aa9a9bb4b9321a2bcff2f1902c340eb39ca19fb`。独立 reviewer 原始报告 SHA-256 `f052685effd097db8820652168747c46e910ff013e4a00f4ca48cd41f8928b3c`。当前文件摘要、验证返回值和修订前摘要见 [修订证据](../astra-gap-synthesis/cost-revision/delivery-evidence.json)。
