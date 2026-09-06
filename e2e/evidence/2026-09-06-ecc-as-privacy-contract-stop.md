# AS-01/AS-02 隐私批合同阶段停止证据（2026-09-06）

状态：[fail] `STOP_FOR_OWNER`。尚未形成 GREEN 合同，未启动 daemon/Console implementation。本文为过程与证据归档，免语义评审；它不改变冻结候选的评审结论，不是新的产品 candidate。

## 候选与前置

- 分支 `codex/as-privacy-20260906`；HEAD `99d51106c9caaefcf55f72bff1a17a78abf58be9`；`git-diff-v1` fingerprint `8bac0d916e0ff14464b28ad19fb5a42fcda79369ce8901879f107083963ede84`。四轮 snapshot 均为 detached HEAD + 固定未提交 diff；首尾机械校验。最终报告绑定第四份 snapshot，不绑定本证据归档增量。
- PG-01B 已合并 I=`ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`，E=`99d51106c9caaefcf55f72bff1a17a78abf58be9`。本会话 `git log -3 --format='%H %s'` 已读取；I/E 祖先及七份原门禁摘要与原日志 SHA 已复核。既有证据为 `e2e/evidence/pg-01b-20260905.md`，R129 明确历史缺 finalize；未抹平历史流程债。
- 启动曾误从研究分支旧 PLAN-2 重做 PG-01B；发现 main 已快进后停止晋升重复候选并保留证据。重复产物没有评审、提交或合并。本 AS 候选重新基于真实 E 建立；主工作树未用于施工。
- 28 份方案与依赖来源按 source-manifest 的 bytes/SHA 复制；合同阶段产品增量限15文件，机械 exact-set 检查 `out_of_scope []`。

## 评审与预算

原始最终报告：[第四轮独立评审](../../research/codex-findings/2026-09-06-ecc-as-privacy-contract-review.md)，归档 bytes 与原报告相同。初轮一次格式无效报告原样保留，按程序性恢复替换，未冒充有效 RED；真正初审 ordinal 1 为 replacement。

| 候选 | 有效评审 | 结果与后续 |
|---|---|---|
| 1 | ordinal 1 replacement | RED，4 P1；自动修复1 |
| 2 | ordinal 2 | RED，2 P1；修复2，rules成本根因计数沿用 |
| 3 | ordinal 3 | RED，2 P1；全新诊断修复3，同时消耗唯一策略重置 |
| 4 | ordinal 4 | RED，1 P1；停止 |

最终有效 blocker `AS-C3-SAFE-SOURCE-GRAMMAR-CONFLICT`：声明支持的直系 rules 文件名允许 POSIX 合法反斜杠名称，读取边界返回 ok，但 safeHits 的 relativeSource 拒绝；评审定向复现 `suffix=true / bound=ok / relativeSource=false`。此前占位符子串豁免和269字符长度冲突均在第四轮得到闭合确认。此处不自判 GREEN 或降级。

`validate_review_manifest.py` 绑定 HEAD/fingerprint/ordinal=4/task/stage/cycle 和 frozen control 的真实输出：

```text
{"next_action":"stop_for_owner","status":"valid","policy_revision":"2.4.2"}
```

state：repair reserved/used=3/3，rereview reserved/used=3/3，strategy reset reserved/used=1/1；reservation_started=false，无悬挂预算。唯一 P2 ledger 为空，final_sweep_count=0；本任务未最终交付，不提前 sweep。未 finalize，未运行完整产品门禁。

## 已运行与未运行

第三次修复的原冻结命令 `bash docs/plan/ecc-as01-as02-privacy-contract/docs-gate.sh` exit 0；原始输出摘录：

```text
[ok] emoji gate: clean
[ok] active document links: files=150 broken=0
[ok] schedule-pointer check active=AS-01-AS-02 next=none last_closed=PG-01B revision=4
```

contracts typecheck 通过；schemas 18 passed、knowledge-privacy 13 passed。只证明本合同候选对应检查。未运行本阶段 GREEN 后的 record-gate/finalize；未跑 AS 产品 `just ci`、Playwright、provider/live、安装或部署。daemon/Console runtime 零改动，不能声称生产拒写或 Git 保护已生效。

## 四行实际回报与成本

- 可见回报：共享合同与纯 helper 的凭据豁免/来源边界已有定向测试，但没有新增用户可用行为；敏感记忆拒写、Git私有保护、三类失败UI仍待 implementation。
- 增量成本：没有新增运行时后台任务或模型调用；未来写入扫描/Git成本仅为冻结工程上限，实际延迟/运行资源尚未测量。本 contract 已记录的9次语义 CLI 墙钟合计 9100.688 秒，含一次格式无效替代；不含误启动PG或监督工具时间，不把它当产品运行成本。
- 用户负担：本轮未改变现有操作；未来移除源凭据或手工修 Git 保护再走现有重试的负担尚未体验验证，无重装/自动删历史。
- 维护与停止条件：由现有 memory/ledger/foundation/ProjectSettings 承接原计划；当前因冻结产品预算耗尽停止。需 owner 具名继续此已停止工作才可创建新恢复 cycle，保留本轮 RED；合同有效 GREEN 后才进入预接受 implementation，不进入 PG-02。

## 原始日志索引

全部 .log 留在原任务 ignored 控制目录；这里只记名称/字节数/SHA-256，不包含原文或本机完整路径。无提交、push、merge、安装、发布或部署。

| 文件 | bytes | SHA-256 |
|---|---:|---|
| implementation-1.log | 3476448 | `0310866e0d239e3c74fb3083283ec678bb151816f5c556161c2ff81caffdcdda` |
| review-1.log | 1137856 | `d0974dcff4f8cfb1c896eb71dd1eb02d3ff2d49c8a3182fd82de877a01c04808` |
| review-1-replacement.log | 970483 | `71b4a02f0d8535aaabd46aceccdef9b9f3e2328b1c154693991194549536052d` |
| repair-1.log | 3028679 | `caf05557040aed666c2892b101197fd1a001a7d6878597f87e0214842f2f5469` |
| review-2.log | 577468 | `64e6366ec6157a0a0801eb5b06840e031e4c49c2bdf9ced2fcea545e954a2512` |
| repair-2.log | 2304274 | `d0beabb19eee86f13ff13aa04d6dc7d7e7172e66de53dd0db7357d4248a84419` |
| review-3.log | 542006 | `014dcdf125837f47bd16e005aa40a6651dbe96d07d89fc26fef4a97127b965f7` |
| repair-3.log | 2156325 | `8ecb1bef7f6d0f47ea0dece80e812b90f70c714c849461326c70b0bb3f204a9a` |
| review-4.log | 610473 | `efa9839b40f94046ea43b0780ae8ed237eb32171a43d69277369e11d03448b22` |
| focused.log | 7734 | `01e13c70dfda4e500bda566fe67e32f0ba2f6e58d5a44ac4aad21386c114488c` |
| repair-1-focused.log | 7760 | `e96e599522f28f4427847ae674459a901e39213933083709d70268cb980c951b` |
| repair-2-focused.log | 7690 | `511a95d6492c1484b689c5f9da57419adf8592665be6eb3f0499cbfa85c973a1` |
| repair-3-focused.log | 7729 | `63c24e7cdb29db4391e025facaefaedce1c440fadfa4aa6d9a523e6ff3f9a888` |
