[fail]

D17 的范围克制方向基本成立，但当前还有 3 个 A 级缺口，会造成签名未真正绑定、focused gate 假绿或 G-A2 止损漏项，因此暂不能签署。

## A 级 findings

### A-D17-BIND-01：签署没有不可变地绑定 exact import spec

- 证据：[owner decisions:26-29](docs/plan/2026-08-28-project-gap-owner-decisions.md:26) 把 digest 存在可修改的决策文件中；推荐签署文本只引用“决策单所列 digest”，没有写出字面 SHA，[owner decisions:46-48](docs/plan/2026-08-28-project-gap-owner-decisions.md:46)。PG-00 只是执行时记录当前决策文件 bytes，并检查 `[x]` 与当前 spec digest，[import spec:38-40](docs/plan/2026-08-28-project-gap-d17-import-spec.md:38)。
- 失败场景：owner 批准 digest A 后，spec 被改为 B，同时决策单 digest 改为 B、保留 `[x]`；PG-00 对当前两份可变文件自洽检查仍能通过，无法证明 B 曾获 owner 批准。
- 最小修法：owner 的签署原文必须包含最终 64 位 SHA-256；PG-00 必须逐字记录并比较该批准原文中的 SHA，而不是只信当前决策文件。任何不一致直接失效，不要求第二次战略选择，只需重新签新 digest。
- disposition：必须回修。

### A-GATE-SOT-01：focused gate 存在两个不等价的权威集合

- 证据：[program:1436-1444](docs/plan/2026-08-28-project-gap-closure-program.md:1436) 要求从总表“逐字复制”命令；但 PG-01B 批卡另要求 `console-api.test.ts`、`logger.test.ts`、`apiError.test.ts`，[program:1537-1540](docs/plan/2026-08-28-project-gap-closure-program.md:1537)，总表没有这些命令。PG-02 批卡要求 claim-roots gate，[program:1557-1558](docs/plan/2026-08-28-project-gap-closure-program.md:1557)，总表同样遗漏。
- 失败场景：照总表施工可以漏门仍写 focused gate 绿；照批卡施工又违反“逐字复制”，独立 IMPL prompt 无法确定 exact command set。
- 最小修法：建立唯一 gate-ID/exact-command SoT；批卡只引用 gate ID。先裁决 PG-01B 两套命令的明确并集，并把 PG-02 claim/action regression 与 receipt 命令写进同一表。
- disposition：必须回修。

### A-GA2-STOPLOSS-01：G-A2 的立即止损没有进入 v4 core 的明确 scope

- 证据：G-A2 要求立即删除“本地 CI 等效”总括声明，[program:904-908](docs/plan/2026-08-28-project-gap-closure-program.md:904)，14.7 也把 immediate owner 指给 SP0，[program:988-993](docs/plan/2026-08-28-project-gap-closure-program.md:988)。但 PG-01A/PG-01B 的 `close_set` 没有 G-A2，直到 PG-03 才关闭，[program:1472-1482](docs/plan/2026-08-28-project-gap-closure-program.md:1472)。当前活跃声明仍存在于 [AGENTS.md:80](AGENTS.md:80) 和 [justfile:7](justfile:7)；PG-01A scope 不含两者，[program:1508-1511](docs/plan/2026-08-28-project-gap-closure-program.md:1508)，PG-03 scope 也不含 `AGENTS.md`，[program:1569-1571](docs/plan/2026-08-28-project-gap-closure-program.md:1569)。
- 失败场景：PG-01A、PG-01B、PG-02 可以连续以 `just ci` 留证，同时仓库规则仍把它称为“本地 CI 等效”；这正是 G-A2 定义的 evidence 假绿。PG-03 即使完成控制图，也可能遗留 `AGENTS.md` 的现役声明。
- 最小修法：增加 `PG-01A stop_loss_set=G-A2`，纳入 `AGENTS.md`、`justfile` 及全部现役 claim roots；PG-03 仍保留唯一最终 `close_set=G-A2`。同步 14.7、20.3 和 import spec。
- disposition：必须回修。

## B 级 findings

### B-LEGACY-SET-01：legacy disposition 的 exact-set 三处不全等

- 证据：PLAN-2 仍登记 W5.4-c 之外的 5.6/5.8/5.9、5.3 尾项及 5.11 六项为“W5 剩余”，[PLAN-2:55](docs/plan/IMPLEMENTATION-PLAN-2.md:55)。import spec disposition 表没有单列这些项，[import spec:89-101](docs/plan/2026-08-28-project-gap-d17-import-spec.md:89)，机械验收也不检查它们，[import spec:131-134](docs/plan/2026-08-28-project-gap-d17-import-spec.md:131)。决策摘要又遗漏表中已有的 R-C、W9，[owner decisions:35-36](docs/plan/2026-08-28-project-gap-owner-decisions.md:35)。
- 失败场景：“未选即 deferred”能保持安全，但 PG-00 仍可能留下另一段现时态“W5 剩余”，或对 R-C/W9 是否获明确授权产生争议。
- 最小修法：定义一份 `legacy_node_exact_set`，在决策单、disposition 表和机械验收中逐字复用；纳入全部 W5 残余、R-C、W9。
- disposition：必须回修。

### B-RECEIPT-BOOT-01：PG-01A/01B 的前置 receipt 缺少升级规则

- 证据：PG-01A/01B 已被要求产出 receipt，[program:1463-1464](docs/plan/2026-08-28-project-gap-closure-program.md:1463)；稳定 gate-ID/receipt schema 到 PG-02 才建立，[program:1465](docs/plan/2026-08-28-project-gap-closure-program.md:1465)、[program:1554-1558](docs/plan/2026-08-28-project-gap-closure-program.md:1554)，但没有规定旧证据如何重验或升级。
- 失败场景：PG-02 的 wave-exit checker 无法机械判断前两批 Markdown 是否属于合法 receipt；实施会话可能分别选择直接接受、转换或重跑。
- 最小修法：把前两批产物明确命名为 `provisional_evidence`；PG-02 按锁定 revision 重跑 exact gates，并签发绑定 gate ID、checker version、代码 revision 的 v1 receipt。
- disposition：必须回修。

### B-DEFERRED-FIELD-01：各批缺少可机械复制的 `deferred_exact_set`

- 证据：统一模板要求 deferred exact-set，[program:775](docs/plan/2026-08-28-project-gap-closure-program.md:775)；导入事务和机械验收也明确要求该字段，[program:1094-1096](docs/plan/2026-08-28-project-gap-closure-program.md:1094)、[import spec:79-83](docs/plan/2026-08-28-project-gap-d17-import-spec.md:79)。PG-01A–PG-06 批卡只有散落的不做描述，没有逐批具名 exact-set。
- 失败场景：PG-00 必须自行把全局条件包和不做清单分摊到七张批卡，不再是原子复制；后续独立 prompt 可能产生不同范围。
- 最小修法：每张批卡增加稳定 ID 构成的 `deferred_exact_set=[...]` 和 `safe_default=[...]`，并说明允许重复引用还是只能有一个 owner。
- disposition：必须回修。

### B-CONDITION-TRIGGER-01：两个条件触发线会被 core 自身字面触发

- 证据：PG-01B 明确触及 `packages/daemon/src/api/**`，[program:1530-1533](docs/plan/2026-08-28-project-gap-closure-program.md:1530)，而 SP2d 写成“任一 consumer 批触及 API”即触发，[program:1641](docs/plan/2026-08-28-project-gap-closure-program.md:1641)。PG-01A 修改公开 claim roots，[program:1504-1511](docs/plan/2026-08-28-project-gap-closure-program.md:1504)，SP3b 又以“公开/RC claim 改变”为触发，[program:1643](docs/plan/2026-08-28-project-gap-closure-program.md:1643)。同时条件包被排除出 denominator，[program:1654-1656](docs/plan/2026-08-28-project-gap-closure-program.md:1654)。
- 失败场景：严格读法会让 PG-01A/01B 自动带入 W5.4-c/distribution 或 API 条件包；宽松读法又等于忽略已成立的触发线。
- 最小修法：SP2d 收窄为“新增或改变跨端 API contract/DTO”；无 schema 变化时登记 `N/A`。SP3b 收窄为实际外部发布、RC 创建或 distribution 变化，不包括 repo-only 文案降级。
- disposition：条件登记前必须澄清。

## C 级 findings

无。

## 已核对成立的边界

- G-A1–G-A9 的最终 `close_set` 各有且只有一个 core owner；问题仅是 A-GA2-STOPLOSS-01 的立即动作漏位。
- D1–D19 未签不会卡住 core 安全收紧；AI 决策 2、7 已签，4/5 未签只阻塞 live/probe 条件项，[owner decisions:56-87](docs/plan/2026-08-28-project-gap-owner-decisions.md:56)。
- `repo_closed`/`deployed_closed` 分轴及 `blocks_expansion` 规则成立，[program:1658-1661](docs/plan/2026-08-28-project-gap-closure-program.md:1658)。
- `just ci`、Playwright、托管 CI、跨平台、live、设备和 release 的证据边界明确，[program:1421-1424](docs/plan/2026-08-28-project-gap-closure-program.md:1421)、[program:1450-1452](docs/plan/2026-08-28-project-gap-closure-program.md:1450)。

`PENDING_FINAL_REVIEW` 没有被列为内容 finding。它仍是最终机械前置：完成上述回修和 journal 记录后，填入全部输入 SHA/行数，再计算最终 spec SHA，并把该字面值写入签署文本。

## 最终判定

1. `D17_READY=no`
2. owner 决策 exact-set 仍只有 `{D17}`；不需要现在补签 D1–D16、D18–D19 或 AI 决策 4/5。但须先完成上述回修，当前不要签 D17。
3. 最小签署文本：

> 批准 D17；绑定 import spec SHA-256=`<最终64位值>`，仅授权 PG-00 文档原子导入；不授权代码实施、提交、推送、部署、外部调用、数据删除或条件包。

## 实际读取与命令

审查中 program/import spec 曾发生一次并发字节变化；旧读数已丢弃并重读。最终连续两次 `shasum` 一致：

- HEAD：`280b0cfa1594a8963bed2a4b730734915a3762b0`
- program：`4131f489…`
- import spec（占位版）：`de47cbba…`
- owner decisions：`55388d33…`
- PG-00 evidence：不存在

实际只读命令包括：

```bash
pwd
rg --files -g 'AGENTS.md'
wc -l <全部必读文件>
nl -ba <全部必读文件> | sed -n '<相关范围>p'
rg -n '<pointer/digest/decision/gate/receipt/deferred/repo_closed 查询式>' <相关文件>
rg -n '本地 CI 等效|CI.*等效' .
rg --files packages/daemon/test packages/console/src scripts research/customer-question-corpus
git rev-parse HEAD
git status --short
git diff --check
shasum -a 256 <全部输入文件>   # 最终连续执行两次
test -e e2e/evidence/project-gap-pg-00.md
bash scripts/check-emoji.sh
node scripts/check-doc-links.mjs
```

静态门真实输出：emoji clean；active document links `files=117 broken=0`；三项退出码均为 0。

一次路径存在性循环误把 zsh 特殊变量 `path` 用作循环变量，导致随后一组 `rg/nl/sed` 报 `command not found`；相关查询已用正常 PATH 全部重跑，未据失败输出形成结论。

未运行产品测试、构建、真实账号、设备、connector、部署、外部调用或网络访问；未修改任何文件。