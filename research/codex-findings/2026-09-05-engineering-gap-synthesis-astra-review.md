# 工程缺口综合方案与实施交接独立审查

> `review_scope=step`；`review_ordinal=1`；候选 HEAD `bcf8ea855f25b177888d9159f75e49214f3dd892`；`git-diff-v1` fingerprint `bf119ec422359cec3e7e876ea9dc0a6950f85eacde9a68eaa89bc0c266089114`。

## 结论

[ok] GREEN。综合方案对 Fable F00–F28 与 Astra A01–A11 均给出一次且可追溯的处置，关键纠错与冻结生产路径一致；建议把可立即判断的观测准确性、页面生命周期、流式边界、运行时诊断和外部资料链拆开，没有把候选自动写成现役排产。实施 prompt 默认回到 PLAN-2 当前 next `PG-01B`，其 scope、A1–A7、focused/full gate、角色隔离、预算和授权边界可直接交给新会话。

本结论只评价两份方案文档及冻结探针，不表示 PG-01B、语音性能、真实 provider、常驻 runtime、发行物或产品门禁为 GREEN。

## A1 比较事实与技术建议

[ok] 通过。

- 延迟不是“零接线”。`packages/daemon/src/index.ts:2211` 实例化 collector，`:2901` 记录模型返回，`:3055-3066` 接收阶段事件与首个 playout；`pipeline/src/saydo_pipeline/hub_client.py:457-463,507-511` 发送现役阶段。综合方案 `docs/plan/2026-09-05-engineering-gap-consolidated.astra.md:23-27` 正确把问题改为统计口径、失败分母和 partial 回收；`packages/daemon/src/obs/latency.ts:123-133` 确实仅以 P50 形成 `passPublish`，与 `docs/03-architecture.md:62` 的 P50/P90 双指标不全等。
- 控制面不是“零推送”。`packages/daemon/src/voice/hub.ts:813-829` 已有四类 Console 事件，`packages/console/src/shell/Layout.tsx:327-333` 会因 `focus.entity` 刷侧栏；正式看板 `packages/console/src/hooks/redesign/useBoardPageData.ts:49-69,97-100,150` 仍存在 N+2、详情失败跳项和仅手动 tick 失效。综合方案 `:29-33` 同时保留这两个事实，没有把旧页面轮询外推为正式看板保证。
- 新控制事件与音频分块不能宣称零契约成本。`packages/contracts/src/types/pipeline.ts:17-120` 是封闭判别联合，比较探针证实当前 `state.changed` 被拒；`pipeline/src/saydo_pipeline/hub_client.py:493-517` 等整句音频后发送一帧，`packages/console/src/voice/useVoiceChannel.ts:330-344,464-473` 按每帧一个 MP3 URL 排队。综合方案 `:35-39,141-149` 要求 framing、取消、watermark、播放器和完整输出闸先闭合，方向正确。
- 运行形态与 CLI 纠错成立。`packages/daemon/src/launchd/cli.ts:80-106` 仍以 tsx 跑源码入口，deploy 使用独立锁定源码树；`packages/cli/src/supervisor.ts:28-31,345-370` 启动发行包内 daemon bundle；`packages/cli/src/options.ts:30-65` 的命令为 `up/status/open`。仓内已有 `packages/cli/scripts/verify-distribution.mjs:143-173` 的打包安装验证和三平台 distribution job。综合方案 `:41-45,74` 因而保留差异治理，同时没有抹掉现有发行验证。
- Fable 关于全 L1、零 09 变更、零评审成本、硬治理数量上限、PG-04/05 合批和按行数判价值的结论均被有依据地收窄或删除；Astra 原稿关于动作真相、恢复、审计、页面失败语义、资料链和诊断入口的价值也被保留。没有因反驳 Fable 引入相反方向的绝对承诺。

## A2 逐项处置、价值与出口

[ok] 通过。

`docs/plan/2026-09-05-engineering-gap-consolidated.astra.md:57-87` 对 F00–F28 各出现一次，`:91-103` 对 A01–A11 各出现一次。冻结文档门进一步核对了 Fable 29 项、Astra 11 项、原稿摘要和 SHA-256。重复建议被合并到同一候选，没有借合并漏项或重复开批。

最重要取舍如下：

| 决定 | 内容 | 价值判断 |
|---|---|---|
| retain | 先走 PG-01B/PG-02；保留动作、预算、远程面、审计、迁移恢复等既有止损；将 VOBS-01 作为 owner 可选择的唯一排产调整 | 正式路径损失可达，且现有批卡已有可判定出口；VOBS-01 先修 P90、样本下限、失败分母和 pending 回收，为后续性能改造提供可信基线 |
| narrow | VIEW 拆成生命周期与聚合读口；VOICE 拆成音频早播与 LLM 早播；HOST 拆成只读诊断与部署升级；CONTEXT 先要求定向漏检复现 | 每一刀分别守住 runtime schema、输出闸、取消、数据恢复和 owner checkpoint，避免把多个 L3 边界捆成一批 |
| drop | 延迟零接线、控制面零推送、CLI 仅两命令、全部 L1/零 09 变更、plist 改动即部署成功、硬 checker/evidence 上限、PG-04/05 合批、gist/provider/全局热键顺手加入 | 这些结论或与冻结源码冲突，或缺少性能、兼容、授权与故障边界证据，不能作为施工合同 |

VOBS-01 在综合方案 `:119-131` 给出五项可判定验收、明确不承诺性能达标，并以 L2 限制在观测准确性；VIEW-02、VOICE-01/02、HOST-02 和外部资料链分别按跨端、语音输出、部署/数据与外部输入边界列为 L3。其余候选在 `:117` 明确不是可直接施工的完整合同，必须补 canonical、exact pathset、正反例和真实 gate argv 后再交实施者，因此当前粒度不会形成隐性开包。

## A3 新会话实施合同

[ok] 通过。

- `docs/plan/IMPL-PROMPT-engineering-gap-consolidated.astra.md:7-13` 将“只问方案”与“明确要求实施”分开；未具名更换批次时读取 PLAN-2 当前 next。冻结基线的 `docs/plan/IMPLEMENTATION-PLAN-2.md:10-28,81-91` 确为 `active=none,next=PG-01B`，串行链和 PG-01B exact-set 与 prompt 一致。
- prompt `:29-70` 给出的 PG-01B A1–A7 同时覆盖远程 fail-closed、本地正例、abandon/unknown、`direct_to_review` 保守状态、共享合同、inventory denominator 和候选证据。focused 命令逐字对应 PLAN-2 `:87-88`；两条 `[new]` 脚本明确以缺失为未建立，不会假绿。
- prompt `:9-13,74-83,111-113` 不授权一次性实施所有候选，也不预授权 commit、push、merge、install 或 deploy；新候选须 owner 具名、进入唯一排产源、补齐 canonical/exact pathset/反例/gate，并接受必要的独立方案审查。
- prompt `:17-21,85-109,125-126` 与冻结 policy 一致：Grok `grok-4.6/xhigh` 实施，独立 Codex `gpt-5.6-sol/max` review；同一 parent 最多一个语义 child；每 candidate 一名 reviewer；首次范围内 P0/P1 自动回修一次；最多三次产品修复和三次复审；P2 单账本、最终一次 sweep；完整门在语义 GREEN 后运行。实施、review 和 supervisor 身份没有混用。

## A4 证据边界与可复跑性

[ok] 通过。

- 综合方案 `docs/plan/2026-09-05-engineering-gap-consolidated.astra.md:177-181` 将纯解析/内存/source-presence 探针、原有合成结构探针、未运行的真实 provider/runtime 和产品实施状态分开。末尾收口记录当前为占位符合 review brief，未据此判产品状态。
- `research/astra-gap-synthesis/source-manifest.json` 的三份输入摘要由 `research/astra-gap-synthesis/check-artifacts.py` 实际复核通过；Fable、Astra 原稿和原独立复审保持冻结 SHA-256，主要文件引用均可回读。
- `synthesis-docs` 实际 exit 0：handoff validator `status=valid`；emoji clean；active document links `files=142,broken=0`；Fable 29/Astra 11 coverage、source hashes、links、whitespace 和唯一 workflow-v2 contract 均通过；`git diff --check` 无输出。
- `synthesis-probes` 实际 exit 0：CLI 解析为 `up/status/open`；当前 schema 拒绝 `state.changed`；合成延迟为 `n=20,p50=1000,p90=10000,passPublish=true`；六项静态接线检查全为 true；原结构与看板合成探针复现报告所列结果。探针输出明确标记 pure/source-presence、synthetic 和 component-only 边界。

## P0/P1 blocker

无。

## Deferred P2 ledger delta

无新增项。候选已把非完整合同、合成证据、条件式候选、owner 授权和产品 GREEN 的边界写清，不需要为措辞开启当轮修订。

## Review Manifest

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 1,
  "candidate_head": "bcf8ea855f25b177888d9159f75e49214f3dd892",
  "diff_fingerprint": "bf119ec422359cec3e7e876ea9dc0a6950f85eacde9a68eaa89bc0c266089114",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "synthesis-docs",
      "exit_code": 0,
      "summary": "handoff status=valid；emoji clean；active links files=142,broken=0；Fable 29/Astra 11 coverage、source hashes、links、whitespace、单一 workflow contract 与 diff check 均通过"
    },
    {
      "name": "synthesis-probes",
      "exit_code": 0,
      "summary": "纯解析、内存与 source-presence 探针确认 CLI 三命令、封闭 schema、P90 未参与 passPublish、六项现役接线，并复现原结构与看板合成结果"
    }
  ],
  "stop_reason": null
}
```


## Supervisor 机械收口记录

上方为独立 reviewer 原文，原始文件 8887 bytes，SHA-256 `d0356b3f33f67ccd191d2d8e0dcdabec94df1c9d7fe6ee4b9d7b6473ed170bb6`；原件另保存在本轮 ignored `.local/reviewer-original.md`。未修改其 verdict、finding 或 manifest。

`validate_review_manifest.py` 绑定候选、ordinal、cycle-state、frozen policy 后返回 `status=valid,next_action=full_gate`；`cycle_control.py --record-gate` 执行两项冻结文档/探针门，均 exit 0；`--finalize` 返回 `status=finalized`。两项门仅评价本次建议与交接资料，不是 PG 产品 full gate。

| 本地日志（不入 Git） | 字节数 | SHA-256 |
|---|---:|---|
| `research/astra-gap-synthesis/.local/synthesis-docs.log` | 543 | `8f4b9dc0745464d96a4c87d8c6bcb15e894417284b9f9e051f47d910beb854e0` |
| `research/astra-gap-synthesis/.local/synthesis-probes.log` | 1411 | `0469bc2d485165556a848b80a06f2c63745a291f79ddbafc7bdd6e6dfde544d4` |

本任务唯一一次最终 P2 sweep 已核对：0 项，无需修改方案或 prompt。两份主文档的 bytes 与独立 review 候选保持全等；新增的本节、ledger 和交接 JSON 属机械收口资料，不冒称为另一轮语义审查。最终文件摘要与本地检查见[交接证据](../astra-gap-synthesis/delivery-evidence.json)。

程序性记录：首次 freeze 调用遗漏显式 policy 参数，未派发前补齐，preflight_ok 后才启动 reviewer；首次 cycle-state advance 误传提取 JSON 而工具要求 Markdown manifest，改传原始 review.md 后成功。没有将这些调用错误记为产品 RED，也没有更改 reviewer 结论或预算。
