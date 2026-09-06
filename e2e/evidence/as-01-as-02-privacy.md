# AS-01/AS-02 隐私批 implementation GREEN 与本地完整门(2026-09-06)

[ok] implementation 阶段已有独立零上下文 GREEN、三个冻结门 record-gate exit 0、工具 finalized。owner 于 2026-09-06 授权提交后,产品候选以 I `7ab7ab394f97a9c1e9a666d218ac41cee3d2ef45`(feat(as-01-as-02))入库,本文随 E 提交入库并记录 I 的 SHA(不自指);尚未 push/merge,不是交付。supervisor 宿主为 Claude Code Fable 5.1(owner 交接),实施 Grok grok-4.6-build/xhigh,正式语义 review Codex gpt-5.6-sol/max。

## 身份与范围

评审与冻结门所绑定的候选:父 HEAD=`99d51106c9caaefcf55f72bff1a17a78abf58be9`(main PG-01B E),分支 codex/as-privacy-20260906,最终 dirty fingerprint(git-diff-v1)=`1d0050bce5fc81953fdebcf75f240b8784fb9f5da3676858028f5d259fc728a8`。该 dirty 候选的 36 个产品路径(合同 15 + 实施 21)一字不改地成为 I=`7ab7ab394f97a9c1e9a666d218ac41cee3d2ef45`;dirty 门绿不当作 I 的证据,I 的干净 clone 上重跑的完整门见下文「post-commit 干净 HEAD 完整门」。合同阶段起点 fingerprint `22aeb36ed341308f3af462055853c7c366f35f99bf5ed1b9419b14716d415270`(contract finalized,final.json SHA-256 `a0ad116ef219c8f7ad11ccfc116cee12bc9b5e46f7b63023d0c2017567fb03cb`)。

implementation 增量 21 个路径全部在冻结 exact-set 内(11 个 must_change、2 个新源 `credentialLiterals.ts`/`gitProtection.ts`、4 个新测试、4 个扩展测试),每轮机械核对无越界;contracts 三文件 SHA-256 与合同 baseline 一致(knowledgePrivacy.ts `9cc1f84d…`、index.ts `7d6a438e…`、knowledge-privacy.test.ts `e3a3eb22…`),共享 schema 未改。未动 canonical、PLAN-2/HANDOFF/指针、net/**、DDL、Gate 0/S3/trust/blocked 词表、通知中心。

## Owner 授权与轮次

owner 当前消息:"我授权继续原范围工作,不受修复次数限制;保留独立评审和质量门要求。未授权提交、合并或部署。"以 unbounded_review 精确 override 校验每份 IMPL/REVIEW 输入,不改全局 policy。

| cycle / 轮次 | 实施 | 独立评审结论 |
|---|---|---|
| c1 implement-1 | M1–M8 一起落地(fp `8ac2ebf8…`) | ordinal 1 RED:5 项 P1(remember 凭据闸晚于四闸;projectM1Notes 绕过 Git 保护;记忆拒写缺 failureClass;UI Git 分支遮蔽 kept_old;safeHit 行号取组装偏移) |
| c1 repair-1 | 闭合上述 5 项(fp `056a72df…`) | ordinal 2:首个 reviewer 因执行卡 unbounded_review 标记拒审(无 manifest,程序性替代 1);第二个 reviewer manifest 键名不合 schema(程序性替代 2);第三个有效 RED:2 项 P1(叶子 symlink 未守卫;indexOf 首次匹配丢失重复 literal 行号) |
| c1 repair-2 | 闭合 2 项(fp `6b367d2a…`) | ordinal 3 RED:2 项新 P1(staging 目录写失败未映射 write_failed;行号定位完整重扫原文使扫描合计可超 524288) |
| c1 repair-3(diagnose_and_repair_fresh) | 先独立诊断再修(fp `6f3e46af…`) | ordinal 4 RED:1 项新 P1(rules 原始文件名拼进标题,safeHit 误归属 conventions.md);c1 repair 3/3、rereview 3/3、reset 1/1 结算,validator 仅因次数 stop_for_owner |
| owner-recovery-1 implement-1 | 闭合 P1-M6-02(fp `1d0050bc…`) | ordinal 1 GREEN:M1–M8 全 [ok],P0/P1=0,P2 delta=[] |

c1 账本原样保留(cycle.json SHA-256 `995b28b98a53c4b535323f00aadb839d4fd90cbf60288f8dce86e659624e81eb`),后继 cycle 的 owner-authorization.json 记录其 state/manifest SHA、carried blocker 与累计成本;根因对账见两目录的 blocker-reconcile-*.md(P1-M7-01、P1-M6-02 保守沿用 M6 归属根因,不洗成新发现)。

## 机械结算与门禁

每轮 completion receipt 先 cycle_state advance 登记,再 validate_review_manifest 绑定 head/fingerprint/ordinal/cycle-state/control;两次无效评审经 plan_recovery(review_invalid_replace)程序性替代,不占产品预算、不覆盖旧 RED。GREEN 后 validator=valid/full_gate,三个冻结门由 cycle_control --record-gate 执行 wrapper(不传调用方 exit/log),gate-evidence 取工具收据,finalize 返回 status=finalized;final.json 原文件 SHA-256 `f2551c5023e95c24ca5f5a8155b440c75c67777015600ca235717f16a4711275`。三门跑完 fingerprint 不变,Playwright 受管截图按跑前原始 bytes 恢复。

| 门 | exit | bytes | SHA-256 | recorded_at |
|---|---:|---:|---|---|
| focused-privacy | 0 | 4174 | `d277c8b3ba43a527eceb1d5f694f1bd757b2b4e20427587dd2237876c68e4b8b` | 2026-09-06T07:16:52Z |
| local-ci | 0 | 94295 | `4c9abd3180b220c0397542126825760b10eadf080c2d7ee0869cb193bd9e9da4` | 2026-09-06T07:19:24Z |
| local-browser | 0 | 5213 | `fb0dd381f537b57ade6bb938f6844cc52258674377bb7a972d3dc2f45b0d33c5` | 2026-09-06T07:22:07Z |

原始输出可核:focused-privacy = daemon typecheck + 7 文件 104 tests、contracts typecheck + 39 tests、console typecheck + ProjectSettings 7 tests、emoji/doc-links/public-tree-privacy(hits=0)/schedule-pointer/`git diff --check` 全 [ok];local-ci = `just ci` node 矩阵(contracts 12 文件、platform 7、console 35、cli 4、daemon 134 passed | 2 skipped,eslint、各 check/test 脚本、public-tree-privacy --ref)+ python 矩阵(ruff、pytest 34 passed);local-browser = `pnpm exec playwright test` 38 passed(2.7m)。这是本地 Node/Python/浏览器基线,不是托管 CI、真机、真实 provider 等效。

## 四行实际回报与成本

- 回报(已由独立 GREEN + 单测/静态渲染 + 本地完整门验证):`MemoryLedger.add` 在 classify/insert 前扫描 claim 与落盘 source 字段,remember/addHotword 凭据闸先于 invalid_trust/readiness 四闸,nominate/reanchor/approve/onFact 逐条隔离且带 failureClass=memory_item_not_saved;foundation 先组装五件落盘文档并扫描、再做 Git 保护与目录/叶子守卫、才创建 staging,core.md 不再写绝对 workspace,`.cursor/rules` opendir 逐条 + 先 stat 再有限读;Git 私有 write set create-only ignore + 5 次封闭查询 + timeout/maxBuffer,not_git/protected/insufficient/outside_root/query_failed/write_failed 确定;三类失败经同一 contracts schema 在 daemon DTO、HTTP 409 与 console 解析,ProjectSettings 同按钮区分「仍用上一版 / 还没建起来 / Git 未保护好」并可重试;safeHits 只含相对来源/行号/kind/处方,rules 来源经 foundationRulesRelativeSource。Playwright 只证明控制台整体仍可渲染,未专门走查新三态(可选 e2e 探针未采纳)。
- 成本(实测):本任务 implementation 阶段 12 次语义 CLI 墙钟合计 12025.7 秒(Grok 5 次、Codex 7 次含 2 次无效);三个冻结门约 6.5 分钟。运行时行为只在写入/构建边界支出,数值上限仍是冻结工程选择(rules 65536B/16 文件/32 dirent/131072B、扫描 524288、Git 5/16 次、10000ms、1MiB),未做时延测量;0 新增模型请求、0 周期全仓扫描、0 持续上报(代码与测试未引入)。
- 用户负担:命中时需移除源文件凭据或手工修正 Git ignore/untrack,然后用项目设置同一按钮重奠基;不要求重装、关闭保护或改历史;旧有效 generation、用户文件与已建 ignore 保留。
- 维护与停止/扩展:由 memory/ledger、foundation、gitProtection、credentialLiterals 与现有 ProjectSettings 承接;止于声明凭据 grammar 与私有 write set,格式外 token 与同形假 token 为已知漏检;没有具名需求不扩全源审计/共享平台/通知中心;收口后排产接回 PG-02,不自动开 PG-02 或 AS-03..07。

## post-commit 干净 HEAD 完整门(I=7ab7ab394f97a9c1e9a666d218ac41cee3d2ef45)

在 I 的干净 `--shared` clone(detached at I,tracked 树零 dirty,只含产品路径,不含未跟踪的只读方案来源)上重跑合同门,全部 exit 0:`node scripts/check-doc-links.mjs`(files=139 broken=0,证明 I 对未入库来源无悬空链接)、`bash scripts/check-emoji.sh`、`node scripts/schedule-pointer.mjs --check`(临时 clone 首跑因缺 main ref 失败,补 main=`99d51106…` 后 [ok] active=AS-01-AS-02 next=none last_closed=PG-01B revision=4)、`just ci`(contracts 12 文件 132 tests、platform 7 文件、console 35 文件 290 tests、cli 4 文件、daemon 134 passed | 2 skipped,eslint 与全部 check/test 脚本,python ruff + pytest 34 passed)、`pnpm exec playwright test`(38 passed,3.0m)。I 的父提交即 main `99d51106…`。

| 日志 | bytes | SHA-256 |
|---|---:|---|
| post-commit-docs.log | 178 | `ed3806741d722e3fffa5a4e09859c84dce7b149d66ec9af99d45f6ba031122eb` |
| post-commit-pointer.log | 87 | `37e12238c0087d3216a552981192417461e03351fddf4d031d9437e2f0a14628` |
| post-commit-ci.log | 96401 | `bb3c02aaf0945d103981b8aac3a5148164516515a5f3299db91e7dd3c5c3cb0a` |
| post-commit-playwright.log | 4946 | `772f7abf6c502f610166bc366f92f44c7c7668d9e72424de6f839589af2aaedd` |

## P2、未运行与边界

唯一 Deferred P2 ledger(contract 目录)items=[];整个 AS 任务的最终 P2 sweep 已在本 finalize 后执行一次,结果 no_items,final_sweep_count=1。

not_run:Windows 真机(MAX_PATH/盘符/无 O_NOFOLLOW 平台)、uid=0 下的 0o555 反例、真实 provider/live 会话、常驻 runtime、真实 `.saydo` 数据、tailnet、托管 CI、发行物。未 commit/push/merge/install/deploy;主树未施工;候选仍为施工 clone 的 dirty 工作树。

## 评审报告归档(bytes 与原文件全等)

| 来源 | 归档路径 | bytes | SHA-256 |
|---|---|---:|---|
| c1/review-1.md | `research/codex-findings/2026-09-06-ecc-as-privacy-implementation-c1-review-1.md` | 6067 | `1b7cc5653c20782e96659f64cc2fa31365a92ae4b6ae55377f06753b41cf7d31` |
| c1/review-2-replacement-2.md | `research/codex-findings/2026-09-06-ecc-as-privacy-implementation-c1-review-2.md` | 3557 | `a4f65d3611e0eb9018d76173f2eb8f680ed7c35abcb571abf8bb4df4fd03bd86` |
| c1/review-3.md | `research/codex-findings/2026-09-06-ecc-as-privacy-implementation-c1-review-3.md` | 3742 | `c47e656c9098b4f475465981d847929eb6ba2bf582db2db48d3fed0d4d15c95f` |
| c1/review-4.md | `research/codex-findings/2026-09-06-ecc-as-privacy-implementation-c1-review-4.md` | 3758 | `6a3062e38fa923ae205d4b64f47548cd2f2e4e4acb8d51b3d7c565b347355660` |
| owner-recovery-1/review-1.md | `research/codex-findings/2026-09-06-ecc-as-privacy-implementation-recovery-1-review.md` | 2612 | `6e204a6ff07f02bf409b33ec12e24a7058a7e3ceb0437739b98e9d566421d0df` |

## 原始日志索引

原始 .log 只留任务 ignored 控制目录;下表不含本机绝对路径、secret 或日志正文。

| 文件 | bytes | SHA-256 | duration_s |
|---|---:|---|---:|
| c1/implementation-1.log | 3443132 | `0ac8ca653b0ab9f3d8eb20fb811259c096449570ed4895bc1c286510ac6746de` | 1811.4 |
| c1/review-1.log | 720923 | `4f7fedba784281d3bdfe7ddb7039d81d244d96389fbd95ba58564589d369f987` | 1032.0 |
| c1/repair-1.log | 2919340 | `2ae60b4c5445ad7ff83c6e71410b1bb41f7d9e3fdda7dd2d120d9f756265d3d1` | 1246.6 |
| c1/review-2.log | 34938 | `88b7e13b3fcbbd053d037dcd6eee87a131ad1cba444a36fca0ed3aa4e1f98473` | 90.3 |
| c1/review-2-replacement.log | 918843 | `61c654ea5e7110cf13c7d5cb24aa172b5642cbb5b4951d9b93f0198022f8927e` | 1010.7 |
| c1/review-2-replacement-2.log | 646568 | `027f03e3f3ba070b1fade36076cfa3ad6a334c9ae1b3c7dabc788bd4bb6ecc5c` | 816.7 |
| c1/repair-2.log | 1796048 | `b87826b24fd802a793ee556aa047aebd1c32c5878cc636574cfb436b9e331240` | 1144.1 |
| c1/review-3.log | 718003 | `44903257f69f9c76a188e11349ac17038173adc0d111e1a0ab6d705a38f09e93` | 850.1 |
| c1/repair-3.log | 2286467 | `dd902733efa81d4831fd1321331bc4d2706b721dcad1ad54b14c346571f79584` | 1548.5 |
| c1/review-4.log | 873853 | `388895f27ca54a26af059046a7d43af25d248c04ad26007759e58025dd207a72` | 1176.3 |
| owner-recovery-1/implementation-1.log | 1524202 | `d8ee52f444e83accd4bdfd3a28130ba933d07dd2b1111e35eba0545b70d974a8` | 621.3 |
| owner-recovery-1/review-1.log | 874011 | `3e8bc2babea31b1163cef173a8337332cd8d26f82be5862abef772bb374093c6` | 677.5 |
| c1/focused-supervisor-1.log | 3761 | `86264397fee0f7465f697f3c1062ad078c9f281de26bdb743a0e27b2e850b44b` | - |
| c1/focused-supervisor-2.log | 3740 | `7b9adb029d764f60b1a9f96da3e3e91e8914dc5705468223ff72dc950398d0c7` | - |
| c1/focused-supervisor-3.log | 3641 | `7b6c6fc9d6682cfab4df8c76e384f956e23433a1c724c48261dd45998b55c0ff` | - |
| c1/focused-supervisor-4.log | 5478 | `e2c11cf6ad4f66f911e152d5c61fdd71143705d88a7ceb3b030f70ce79c0ba10` | - |
| owner-recovery-1/focused-supervisor-1.log | 3976 | `2158803b88adacbd1c470c03d902a3ca4cba0f7673038ff1b453c6bfc437fb90` | - |
| owner-recovery-1/gate_logs/.../1/focused-privacy.log | 4174 | `d277c8b3ba43a527eceb1d5f694f1bd757b2b4e20427587dd2237876c68e4b8b` | - |
| owner-recovery-1/gate_logs/.../1/local-ci.log | 94295 | `4c9abd3180b220c0397542126825760b10eadf080c2d7ee0869cb193bd9e9da4` | - |
| owner-recovery-1/gate_logs/.../1/local-browser.log | 5213 | `fb0dd381f537b57ade6bb938f6844cc52258674377bb7a972d3dc2f45b0d33c5` | - |
