[fail]

208 的 3A/4B 中，6 项内容层面已关闭；receipt bootstrap 仍缺无自指的机械协议。本轮另发现 PG-00 静态门可假绿，因此当前不能只回填 digest 后签 D17。`PENDING_FINAL_REVIEW` 未被计为 finding。

## A 级 findings

### A-PG00-GATE-COVERAGE-01：`FG-PG00-DOC` 不能证明唯一排产链，也未完全拒绝未知 legacy 行

- 证据：断言块只检查新增标准行/marker 的唯一性，[program:1460](docs/plan/2026-08-28-project-gap-closure-program.md:1460)，没有检查旧的替代性“下一批/下一工程批”正文已失效。当前冲突正文真实存在于 [HANDOFF.md:48](HANDOFF.md:48)、[HANDOFF.md:50](HANDOFF.md:50)、[PLAN-2:137](docs/plan/IMPLEMENTATION-PLAN-2.md:137) 和 [PLAN-2:253](docs/plan/IMPLEMENTATION-PLAN-2.md:253)。此外，visible `LEGACY` 计数只匹配严格三列行，[program:1476-1483](docs/plan/2026-08-28-project-gap-closure-program.md:1476)，弱于 import spec 要求的“任何集合外 `LEGACY` 行均门红”，[import spec:139-149](docs/plan/2026-08-28-project-gap-d17-import-spec.md:139)。
- 失败场景：保留旧 `下一批 = ai-supply`/W5.4-c 链，同时附加新的标准链、18 个正确 marker/table 行，当前 pointer/chain 断言仍全部通过。另加 `| LEGACY | UNKNOWN | status | extra |` 也能绕过现有行数与逐项断言。
- 实测：两个内存夹具均 exit 0，分别输出 `CURRENT_POINTER_ASSERTIONS_ACCEPT_STALE_ALTERNATE_NEXT_PROSE` 和 `CURRENT_ROW_ASSERTIONS_ACCEPT_UNKNOWN_4TH_COLUMN`。
- 最小修法：
  1. 为 PLAN-2 的全局优先级 supersede、HANDOFF 旧 ai-supply 指针、PLAN-2 旧 §7 尾链各增加一个稳定可见断言或 bounded marker，并由门验证；
  2. 同时计数所有以 `LEGACY` 开头的表行，再计严格三列行，二者都必须恰为 18；现有逐 ID/status 检查保留。
- disposition：必须在计算最终 spec digest 前回修并重跑独立复评。

### A-WAVE-EXIT-SELFREF-01：post-evidence checker 的输入、输出和最终 evidence 顺序未消除自指

- 证据：evidence 被要求记录自身 post-evidence exit，[program:1427-1432](docs/plan/2026-08-28-project-gap-closure-program.md:1427)；checker 又要求在 receipt/evidence 已写入后运行，[program:1486-1498](docs/plan/2026-08-28-project-gap-closure-program.md:1486)，并在“draft evidence”存在后决定能否收口，[program:1502-1503](docs/plan/2026-08-28-project-gap-closure-program.md:1502)。当前没有定义 checker 读取哪个不可变对象、忽略哪个终局字段、最终 receipt 由谁生成，也没有明确后批必须消费哪个 predecessor receipt digest。
- 失败场景：
  - checker 要求 evidence 已写自己的成功 exit，则必须预写成功才能运行，形成假绿/循环；
  - checker允许该字段缺失，运行后再改 evidence，则最终 bytes 未被该次检查验证；
  - receipt 在 checker 前已写 overall pass，则 checker只是验证预先声明的结论；
  - PG-03–PG-06 只验当前 batch，而不机械消费直接前驱 receipt。
- 最小修法：定义两个非自指 artifact：
  1. immutable `wave-exit-input`：绑定 code revision、gate IDs、真实 pre-gate results、checker version 和 predecessor receipt digests；
  2. `check-wave-exit` 校验该输入后生成独立 final receipt，receipt 绑定 input digest，但不包含自身 digest/自身命令退出码。Markdown evidence 只在事后引用两者及真实 exit，不作为 final receipt 的输入。为“改 Markdown 状态、漏前驱 receipt、复用旧 revision”各加 mutation。
- disposition：必须回修。208 的 `B-RECEIPT-BOOT-01` 仅关闭了 provisional→重跑→v1 的内容要求，尚未机械关闭。

## B 级 findings

### B-PG00-DIRTY-BASE-01：PG-00 没有可复制的 dirty-base 归属和无损回滚规则

- 证据：通用 preflight 要求遇到“未归属改动”即停，[program:1414-1416](docs/plan/2026-08-28-project-gap-closure-program.md:1414)；import spec 只锁 HEAD 与部分文件 digest，[import spec:7-23](docs/plan/2026-08-28-project-gap-d17-import-spec.md:7)，而回滚只写“恢复 PG-00 前内容”，[import spec:190-191](docs/plan/2026-08-28-project-gap-d17-import-spec.md:190)。
- 当前实况：工作树已有 2 个 modified 文件和 10 个 untracked 方案/评审文件；其中 README、journal 已含前置用户改动。
- 失败场景：严格会话把现有评审产物判为未归属而无法开工；宽松会话则无法机械区分后来出现的额外改动。失败回滚若按 HEAD `git restore`，会覆盖 README/journal 的 PG-00 前改动。
- 最小修法：最终化时登记 `preexisting_worktree_status_exact_set`，包含 path、status、必要 digest，并规定零额外路径；回滚必须反向应用本次 PG-00 delta 或恢复锁定的 pre-transaction bytes，明确禁止恢复到 HEAD。
- disposition：D17 签署前补齐；不需要新增 owner 战略决策。

## C 级 findings

无。

## 208 逐项对账

- `A-D17-BIND-01`：已关闭。owner 原话必须含字面 SHA，且 PG-00 以原始消息为锚，[owner decisions:17-19](docs/plan/2026-08-28-project-gap-owner-decisions.md:17)、[import spec:25-27](docs/plan/2026-08-28-project-gap-d17-import-spec.md:25)。
- `A-GATE-SOT-01`：原 finding 已关闭。唯一 registry 已包含此前漏掉的 PG-01B/PG-02 命令，[program:1441-1455](docs/plan/2026-08-28-project-gap-closure-program.md:1441)。本轮 A-PG00-GATE-COVERAGE-01 是新的覆盖缺口，不是第二套 SoT。
- `A-GA2-STOPLOSS-01`：已关闭。PG-01A 的 `stop_loss_set=G-A2`、`AGENTS.md`/`justfile` scope 与 PG-03 唯一 final close 均已明确，[program:1526-1534](docs/plan/2026-08-28-project-gap-closure-program.md:1526)、[program:1591-1600](docs/plan/2026-08-28-project-gap-closure-program.md:1591)。
- `B-LEGACY-SET-01`：内容层已关闭；18 项三处 exact-set 一致。机械门仍受 A-PG00-GATE-COVERAGE-01 影响。
- `B-RECEIPT-BOOT-01`：未完全关闭，见 A-WAVE-EXIT-SELFREF-01。
- `B-DEFERRED-FIELD-01`：已关闭。17 个稳定 deferred ID 与七张批卡均已具名。
- `B-CONDITION-TRIGGER-01`：已关闭。API 触发已收窄到 contract/DTO/schema 变化，distribution 触发排除了 repo-only 保守降级，[program:1737-1744](docs/plan/2026-08-28-project-gap-closure-program.md:1737)。

D17 本身没有暗含代码、commit、push、deploy、外部调用、数据删除或条件包授权，[owner decisions:35-49](docs/plan/2026-08-28-project-gap-owner-decisions.md:35)。legacy/deferred IDs 和机器 marker 属于小而有界的必要机制，没有发现显著过度设计；问题是当前 checker 没有完整消费它们。

`D17_CONTENT_READY_EXCEPT_DIGEST_AND_OWNER=no`

`D17_READY_AFTER_FINALIZATION=no`

owner 现在必须提供的 exact-set：

```text
owner_now_exact_set=∅
```

当前不要签。上述内容问题修复并经新一轮独立复评后，owner 仍只需提供一条 D17 原始批准消息；不需要现在补 D1–D16、D18–D19 或 AI 决策 4/5。

可签时的最小文本：

> 批准 D17；绑定 import spec SHA-256=<最终64位SHA>；仅授权 PG-00 文档原子导入；不授权代码实施、提交、推送、部署、外部调用、数据删除或条件包。

## 实际只读命令与未运行项

实际执行：

- `pwd`、`git status --short --branch`、`git rev-parse HEAD`
- `wc -l`、`nl -ba`、`sed -n`、`rg -n/-Fxc/-Fc`
- gate/test 路径逐项 `test -e`
- `bash -n < <(sed -n '1461,1483p' ...)`：exit 0
- 两组内存 fixture shell 语义探针
- `test ! -e e2e/evidence/project-gap-pg-00.md`：exit 0
- 两轮 `shasum -a 256`：所有必读 bytes 前后一致
- `bash scripts/check-emoji.sh`：`[ok] emoji gate: clean`，exit 0
- `node scripts/check-doc-links.mjs`：`files=117 broken=0`，exit 0
- `git diff --check`：无输出，exit 0

HEAD 始终为 `280b0cfa1594a8963bed2a4b730734915a3762b0`。未运行 lint、typecheck、unit、contract、build、`just ci`、Playwright、真实账号、设备、connector、部署、外部调用或网络访问；未修改任何文件。