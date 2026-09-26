# JOURNEY-01 本地验收与两提交记录（2026-09-23）

> 历史阶段快照：本文的未提交/未合并/门禁待验描述只对应当时阶段。2026-09-23已按owner授权本地合入main；当前收口状态见[本地集成记录](../../e2e/evidence/journey-01.md)。历史证据与未运行边界不改写。

状态：LOCAL_GREEN_REMOTE_PENDING。当前集成候选本地验收及产品提交已记录；主仓尚未合并，不表示生产交付。

产品提交：`62b07c243879189fca221f42449e033fc596b2f7`，分支 `codex/journey01-accepted-20260923`。
验收输入：HEAD `25d96595cde150428b6840e450e15f11d50f021f` + git-diff-v1 `0d18cdc58ac271b617f51d44662a956a34a5db2b72f55d6451d5b9afccaceba1`。产品提交238路径逐项字节对照冻结输入一致；另4项原有过程/证据文件留到证据提交，产品与证据分开。

## 独立结论与流程例外

同任务review-15：语义通过、门禁待验，无已确认P0/P1。之后当前固定候选三required全通过。review-16独立报告GREEN并核对全部门禁，但supervisor对同一候选又派fresh reviewer，违反每候选1名规则；原校验器返回 `reviewer_budget_exceeded`，该失败不改写。

owner随后明确授权：“接受这次重复评审的流程例外，继续原授权的本地两提交”。本次据此作单次例外收口，不声称未修改的校验器自动通过，不修改全局规则，不删除历史事件。原始记录在任务目录 `owner-exception-duplicate-review-20260923.json`、`supervisor-duplicate-review-incident.json`、`review-15.md`、`review-16.md`。

## 实际门禁

日志位于本机任务目录 `~/.codex/tasks/saydo-journey01-acceptance-20260920/`，不将原始日志提交Git。

| 命令 | exit | 日志 | 字节数 | SHA-256 |
|---|---:|---|---:|---|
| `just ci` | 0 | `final16-ci.log` | 119417 | `9f13fa7dd9006ecd735d8290335fa33f65680b0e0a9492ff5e5776788e367414` |
| `pnpm exec playwright test` | 0 | `final16-browser.log` | 7047 | `e6b750f1741af482060577513d5ca7c1f870016c1588e13c7b3f1e6478c4b93e` |
| `just precommit` | 0 | `final16-precommit.log` | 407 | `ce87a0d4a36d57b2f39549c699f6d4e16cabcdf3764366804da7683d54215c50` |

Playwright全量54 passed。独立七步参考旅程正反例另见host16-results.json、host16-journey-evidence；包含真实Executor产物、Git tree、settle proof、坏引用拒批与下一回合记忆消费。模型与CLI使用确定性替身，不冒充真实云服务。历史失败保留：host15负例受Corepack未固定版本影响，repair16固定pnpm版本并保留真正npm负例断言。

Playwright重写4张输出截图，本轮生成图已归档final16-generated-screenshots，恢复冻结输入后指纹一致；未更改被测源码或测试。三门禁后只有证据文档与审计账本整理，不修改产品。

## 范围、保留与剩余事项

PTT跨模式再锚定时，quiesce按同连接纪元/sid等待合法在途PTT终态，final先于成功ACK；保留其他sid、退役HF、旧epoch隔离。采访轮归属、legacy重放、manualunknown引用有效性及真实实体入口均纳入累计独立审查。

原176路径与当前242路径已核；DAILY58路径中29字节同源、29不同，路径/hash不代表全部语义等价，语义审查深度见独立报告。未改源DAILY/main；排产仍active DAILY、next JOURNEY，未伪清批。

三项P2继续延期：Board遗漏ready_for_review；安排页标题字段错配；依赖API的preId:null与taskId互斥缺口。Focus内完整ChatComposer仍非本轮完整挂载，现役锚定入口保留。

真实麦克风、云ASR、真实模型/CLI、多设备、远端CI均not_run。未merge、push、发布或部署；主仓未集成，生产未更新；App Server原型仍为后续独立批。

本文件记录产品SHA，不自指证据提交。旧交接文档与journal是历史快照，最新状态以本记录和仓外任务状态为准。
