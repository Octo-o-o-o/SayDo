[fail]

当前 bytes 仍有 `3A/2B`。`PENDING_FINAL_REVIEW` 未被计为 finding；失败来自可复现的结构缺口，因此不能只靠 digest 回填、journal 和现有静态门进入 D17。

## A findings

### A-PG00-STRUCTURE-GATE-02

- 证据：[PLAN-2:73](docs/plan/IMPLEMENTATION-PLAN-2.md:73) 仍以现在时声明 `W5.4-c → R-B`；但 `FG-PG00-DOC` 的负门只拒绝 `下一工程批是|2026-08-27 开坐标`，[program:1486](docs/plan/2026-08-28-project-gap-closure-program.md:1486)。此外，import spec 要求七批逐项具备全部批卡字段，[import-spec:212](docs/plan/2026-08-28-project-gap-d17-import-spec.md:212)，现有 shell 断言块未验证这些字段。
- 失败场景：PG-00 可保留第二条现在时执行链，或漏导某批的 `depends_on/safe_default/evidence/rollback`，仍通过当前静态门，形成双排产或不可执行批卡。
- 最小修法：只扩展现有 `FG-PG00-DOC`，拒绝 `后续工程顺序现为` 等当前态旧链；为 PG-01A–PG-06 增加单一机器投影行并断言全部必需字段、唯一依赖及 `close_set` 互斥并集。不要新增第二套 gate registry。
- disposition：`open`；最终 import spec digest 前必修。

### A-WAVE-GENESIS-01

- 证据：PG-00 明确“尚无 receipt checker”且 finalization 为 `N/A`，[program:1503](docs/plan/2026-08-28-project-gap-closure-program.md:1503)、[program:1508](docs/plan/2026-08-28-project-gap-closure-program.md:1508)；但 PG-01A 被要求消费“PG-00 文档 receipt digest”，[program:1527](docs/plan/2026-08-28-project-gap-closure-program.md:1527)。唯一明确的 PG-00 产物是 Markdown evidence，[import-spec:197](docs/plan/2026-08-28-project-gap-d17-import-spec.md:197)。
- 失败场景：PG-02 升级 PG-01A 时只能临时发明 PG-00 receipt、漏掉前驱，或把 Markdown 当 final receipt；三者分别导致不可复制、断链或违反“checker 不读 Markdown”。
- 最小修法：把 PG-01A 定义为 genesis，令 `predecessor_receipt_exact_set=[]`，另绑定 D17 spec、PG-00 postimage/tree 与独立复审 digest；同步把 HANDOFF 的“PG-00 receipt”改成“PG-00 evidence anchor”。这是比引入 PG-00 新 checker 更小的修法。
- disposition：`open`；receipt bootstrap 前必修。

### A-WAVE-VALIDATION-SNAPSHOT-01

- 证据：input 绑定 revision、manifest 和结果日志 digest，但没有规定实现 scope 必须与被声明的 validation revision bytes 全等，[program:1517](docs/plan/2026-08-28-project-gap-closure-program.md:1517)。PG-02 只明确重跑两个 focused gate set，[program:1680](docs/plan/2026-08-28-project-gap-closure-program.md:1680)；PG-01B 所需 Playwright 是独立 full gate，[program:1531](docs/plan/2026-08-28-project-gap-closure-program.md:1531)，没有明确要求在 PG-02 validation bytes 上重跑。
- 失败场景：测试可在 commit 之后的 dirty 修补上转绿，但 receipt 仍绑定旧 revision；或 PG-01B 的旧 Playwright exit 被带入新 validation revision，产生“receipt 绿但实际被签 bytes 未受测”。
- 最小修法：input 增加 `validation_tree_digest`，并要求实现 scope bytes 与 validation revision 全等，仅允许 evidence/input/receipt 路径后写；所有用于 receipt 的 focused/full gates—including PG-01B Playwright—必须绑定同一 tree digest。增加 dirty-in-scope 与 stale-full-gate mutation。
- disposition：`open`；否则 receipt 可假绿。

## B findings

### B-PG00-PARTIAL-ROLLBACK-CAS-01

- 证据：事务失败时要求整笔回滚，但只在“当前 bytes 等于事务 postimage”时反向应用 delta，[import-spec:220](docs/plan/2026-08-28-project-gap-d17-import-spec.md:220)、[program:1609](docs/plan/2026-08-28-project-gap-closure-program.md:1609)。
- 失败场景：五个 writable paths 只写成两个时，工作区既不是完整 preimage，也不是完整 postimage；独立会话无法判断应整笔回滚、逐文件恢复还是停止。
- 最小修法：改成逐路径三态 CAS：`current==preimage` 不动作；`current==owned_postimage` 恢复 preimage；其他 bytes 立即停并上浮。新文件对应 `absent/no-op`、`owned_postimage/delete`、`other/stop`。
- disposition：`open`；无需 owner 战略决策。

### B-PG05-SAFE-DEFAULT-01

- 证据：PG-05 写成 `incompatible_read_only_or_refuse` 二选一，[program:1732](docs/plan/2026-08-28-project-gap-closure-program.md:1732)；上位验收实际要求 immutable/read-only probe 后旧 binary 非零退出且数据库 bytes 全等，[program:226](docs/plan/2026-08-28-project-gap-closure-program.md:226)。
- 失败场景：施工者可能把“read-only”解释为允许继续打开不兼容数据库，重新选择产品行为。
- 最小修法：收敛为唯一值，例如 `immutable_probe_then_refuse_incompatible`。
- disposition：`open`；属于批卡机械性澄清，不需 owner 决策。

## C findings

`C_open=∅`。

## 历史 findings 对账

- 208 的原始 `3A/4B` 按其原失败条件均已关闭：D17 literal SHA、单一 gate registry、G-A2 stop-loss、legacy exact-set、provisional 升级规则、deferred 字段和条件触发边界都已补齐。新发现的 genesis/validation 缺口不等于原 `B-RECEIPT-BOOT-01` 未改。
- 209 并非全部关闭：
  - `A-PG00-GATE-COVERAGE-01`：未完全关闭；legacy 未知行防护已补，但现在时旧链和批卡字段未进入机械门。
  - `A-WAVE-EXIT-SELFREF-01`：按原自指、预写 pass、Markdown 输入和直接前驱问题已关闭。
  - `B-PG00-DIRTY-BASE-01`：原 dirty-base ownership、禁止恢复到 HEAD 已关闭；本轮部分写入 CAS 是新的相邻缺口。
- `A-PREFLIGHT-MANIFEST-LIFETIME-01` 已关闭：D17 manifest 明确仅绑定 PG-00，PG-01A–PG-06 各批重新锁 batch-local manifest，[program:1414](docs/plan/2026-08-28-project-gap-closure-program.md:1414)。

D17 本身没有暗含代码、commit、push、deploy、外部调用或战略授权；条件包仍只是登记。repo/deployed、local/hosted/platform/live/release 的证据边界未发现新增 A/B。现有 marker、Gate-ID、manifest 与 receipt 约束各有明确判定作用，没有找到可删除而不降低可判定性的要求。

## 最终判定

```text
A_open={A-PG00-STRUCTURE-GATE-02,A-WAVE-GENESIS-01,A-WAVE-VALIDATION-SNAPSHOT-01}
B_open={B-PG00-PARTIAL-ROLLBACK-CAS-01,B-PG05-SAFE-DEFAULT-01}
D17_CONTENT_READY_EXCEPT_DIGEST_AND_OWNER=no
D17_READY_AFTER_FINALIZATION=no
owner_now_must_provide_exact_set={}
```

owner 现在不需要补充任何信息，也不应先签。上述机制回修、零上下文复评和最终静态门通过后，owner 唯一需要提供的是一条含最终 SHA 的 D17 原始消息：

```text
批准 D17；绑定 import spec SHA-256=<最终64位SHA>；仅授权 PG-00 文档原子导入；不授权代码实施、提交、推送、部署、外部调用、数据删除或条件包。
```

## 实际只读命令与未运行项

实际运行：

- `git status --short --branch`、`git status --porcelain=v1 --untracked-files=all`
- `git rev-parse HEAD`，结果为 `280b0cfa1594a8963bed2a4b730734915a3762b0`
- `wc -l`、`nl -ba ... | sed -n ...`、多组 `rg -n/-Fxc/-Fc/-c` 语义探针
- `shasum -a 256` 全 manifest 与最终关键文件复核；当前 program SHA 为 `225473e838cec01e274bd2ea8e85a5fc951b0c7f138f68dd4d9f9bd3572c1188`，import spec SHA 为 `b83ba52d826fb8c2bf5ae2854340eb78365ca9d3ed4bdde45f71865a13d22f69`
- existing/`[new]` 路径存在性检查：现有路径均存在，16 个 `[new]` 路径当前均不存在
- `bash -n <(sed -n '1466,1497p' ...)`，exit 0
- `bash scripts/check-emoji.sh` → `[ok] emoji gate: clean`
- `node scripts/check-doc-links.mjs` → `[ok] active document links: files=117 broken=0`
- `git diff --check`，exit 0
- 两个零上下文只读 subagent 互补复核

一次 SHA 清单循环因 `awk` 转义错误失败，未据该结果判断；随后改用 shell 截取重跑，producer/sort 均 exit 0。

未运行：`just ci`、lint、typecheck、单元/契约测试、构建、Playwright、真实账号、设备、connector、部署、网络访问及单独外部 `codex exec`。未修改文件，未 commit/push。