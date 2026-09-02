[fail]

当前 v7 仍有 2 条 A 级实施就绪性缺口。它们需要修改 semantic bytes，不能靠机械最终化修复；owner 现在不应签 D17。

## A 级

1. `A-PG01A-DRYRUN-I-BINDING-01`：dry-run producer 可掩盖 I 中过期投影

   位置：[program:1463](docs/plan/2026-08-28-project-gap-closure-program.md:1463)、[program:1526](docs/plan/2026-08-28-project-gap-closure-program.md:1526)、[program:1631](docs/plan/2026-08-28-project-gap-closure-program.md:1631)、[rebuild-three-pass-dry-run.mjs:23](research/customer-question-corpus/dry-runs/rebuild-three-pass-dry-run.mjs:23)、[validate-three-pass-dry-run.mjs:108](research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs:108)。

   复现场景：I 改变 `questions/contexts/contracts/04` 的 source-tree digest，却漏交两份派生文档。在 detached clean validation worktree 中按 `FG-PG01A-CLAIM` 顺序运行时，producer 会先以内存新结果完成自检，再于第 49–50 行覆盖两份投影；随后 validator 读取覆盖后的 working-tree bytes 并通过。删除 validation worktree 后，门禁记录仍绑定 I SHA/tree，但 I tree 内投影仍旧，形成假绿。

   最小修法：producer 只在形成 I 前运行。I focused gate 先以只读 validator 检查 committed I bytes；如仍保留幂等 rebuild，则 rebuild 后必须断言两份文件与 `I:<path>` 全等且 validation worktree 仍 clean，任何 diff 都让门禁失败。无需新增生成平台。

2. `A-PG03-WEEK-AUDIT-PHASE-02`：PG-03 的 I 阶段要求验证 predecessor 的旧 publication bundle

   位置：[program:1463](docs/plan/2026-08-28-project-gap-closure-program.md:1463)、[program:1469](docs/plan/2026-08-28-project-gap-closure-program.md:1469)、[program:1529](docs/plan/2026-08-28-project-gap-closure-program.md:1529)、[week-audit.mjs:339](scripts/week-audit.mjs:339)、[week-audit.mjs:1145](scripts/week-audit.mjs:1145)。

   复现场景：合法 PG-03 I 必须修改 gate/workflow/scripts 并新增 checker。`--check-bundle` 会把 clean I 的 tracked exact-set 和逐文件 fingerprint 与 predecessor E 中的 publication manifest 比较，必然因新增路径或内容变化退出非零；现有生命周期却只允许 I 门禁/readback 之后、形成 E 时运行 writer。按当前字面无法同时满足 I focused gate 与 E-only writer。

   最小修法：从 `FG-PG03-CONTROL` 删除 `week-audit --check-bundle`；保留通用 E 流程中的现役 `--write`、七项实际变化 subset 和 clean E `--check-bundle`。I 阶段由 `check-gate-manifest` 及 mutation 验证 workflow 确实可达该 E/publication 门。

## B 级

无。

## C 级

无。

## 其余复核结论

- D17 已覆盖 semantic freeze、机械最终化、owner 原始 SHA、prospective index、`I:path` 回读、三路 I 复审、E、amend/恢复以及未来绑定完整 E OID 的 `ff-only`；E 前也明确重验 preexisting literal staged blobs。事务形状本身无新 finding。
- PG-00 及代码批 E 已规定 index/worktree 全等后运行现役 writer，只 stage 七项固定输出的实际变化 subset，clean E 运行 `--check-bundle`，且禁止第三提交。
- 当前 corpus 静态枚举为 `986` 个 source 对象，其中 `USER-PROVIDED=752`、`authorized-project-root=234`；按 repo-relative path + RFC6901 pointer 得到 `986/986` 唯一 identity。当前 source-tree digest 为 `0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6`，两份现役 dry-run 文档均登记该值。除上述 producer/I 绑定缺口外，Q0 report 的唯一 producer、I/tree/raw digest/E 绑定和 mutation 合同完整。
- PG-01B 的 remote denominator 已覆盖 main/recovery/voice/tier1、HTTP/WS/Unix、method/path/message/via，并要求与实际 handler/switch/listener exact-set 全等；遗漏、guard bypass、WS mutation 均 fail-closed。Windows tier1 的实际实现是 loopback HTTP，静态来源可由 tier1 composition root 枚举。
- PG-02 明确以所有默认 UI 与 Brain 可调用动作、transition、receipt/error 为唯一 denominator，遗漏和错 transition 必须转红；没有预建通用 route/report/receipt 平台。
- PG-03–PG-06 的串行顺序、close/stop-loss/deferred、focused/full gate、证据、回滚与安全缺省，以及工程、初级/资深用户、AI subscription/API、工具/connector、模拟提问、回报和持续成本均已有归属；未出现默认全做或过度设计回退。
- 208–212、214 仍是旧 `[fail]` 快照；213、215–218 均无 report。当前 219 report 也不存在，本轮未创建文件。

## 实际只读命令与静态门

- `git rev-parse --abbrev-ref HEAD`、`git rev-parse HEAD`：分支为 `codex/project-gap-plans-20260828`，HEAD 为 `280b0cfa1594a8963bed2a4b730734915a3762b0`。
- `git diff --cached --quiet`：exit 0，index 为空。
- `git status --porcelain=v1 --untracked-files=all`：2 个 tracked 修改、25 个 untracked；属于签署前现场，不作为 finding。
- `bash scripts/check-emoji.sh`：exit 0，`[ok] emoji gate: clean`。
- `node scripts/check-doc-links.mjs`：exit 0，`[ok] active document links: files=117 broken=0`。
- `git diff --check`：exit 0。
- 对 25 个 untracked 文件逐项运行 `git diff --no-index --check /dev/null <literal-path>`：修正后的完整循环为 `files=25 failures=0`，每项均为预期 exit 1 且无 whitespace 诊断。
- `node scripts/week-audit.mjs --check-bundle`：exit 1，`审计后出现未入账工作树路径:docs/plan/README.md`。这是当前未最终化 dirty bytes 的预期红灯，不单列 finding；同时确认该门确实校验当前全树。
- `git cat-file -e` 对 week-audit config 的 base/range/remediation 三个完整 OID：均 exit 0。
- `jq` 全量枚举 source 对象：`986=752+234`；path+RFC6901 identity 为 `total=986, unique=986`。
- 调用现役 `hashCorpusSourceTree()` 并 `rg` 两份投影：三处 digest 全等。
- 使用 `sed -n`、`nl -ba`、`rg -n`、`rg --files` 完整读取必读文档、脚本及点名源码。

两类无效补证据尝试均未用于结论：首次 untracked 循环误用 zsh 特殊变量 `path`，导致 25 次 exit 127，随后已更名重跑；首次把 dry-run 脚本误查到 `scripts/`，随后按真实路径纠正。另有两个非 config 的试探性短 SHA `git cat-file` 返回 exit 128，随后已按脚本中的三个完整 OID 重验。

明确未运行：`just ci`、lint、typecheck、unit/contract、build、Playwright/e2e、产品测试、corpus/dry-run rebuild、真实账号、设备、connector、deploy、网络访问或外部 `codex exec`。未修改文件，未 commit/push/merge；未计算或生成 D17 签署 SHA。

```text
A_open_exact_set={A-PG01A-DRYRUN-I-BINDING-01,A-PG03-WEEK-AUDIT-PHASE-02}
B_open_exact_set={}
C_open_exact_set={}
D17_SEMANTIC_FREEZE_READY=no
D17_READY_AFTER_MECHANICAL_FINALIZATION=no
owner_now_must_provide_exact_set={}
OVERDESIGN_REGRESSION=no
```