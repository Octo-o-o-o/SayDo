[fail]

结论：v6 的标准 Git `P → I → E` 骨架是当前最小合理形态，不应恢复 v4/v5 的自制事务机制；但现有方案仍有 7 条 A、8 条 B。当前 semantic freeze 不应交给 owner 签署。

## A 级

1. `A-PG00-AUDIT-E-01`：E 无法满足仓库现役 publication/week-audit 硬门
   位置：[HANDOFF.md:16](HANDOFF.md:16)、[D17:87](docs/plan/2026-08-28-project-gap-d17-import-spec.md:87)、[program:1468](docs/plan/2026-08-28-project-gap-closure-program.md:1468)、[week-audit.mjs:47](scripts/week-audit.mjs:47)。
   复现：I/E 改变 tracked 全树，但 D17 的 E exact-set 不含七个 week-audit 生成物，PG-00 门也不跑 `--check-bundle`；候选可按 PG-00 字面收口，却必然留下过期 publication manifest。当前只读运行已 `exit 1`。
   最小修法：E 的 20 个输入先显式 stage，再运行现有 `week-audit --write`；把七个生成物列为显式 `may_change` allowlist 并 stage 实际变化子集，E 后增加 `--check-bundle`。仍保持 I/E 两提交，不加第三提交。
   disposition：`fix_now`，阻断 D17。

2. `A-PG00-SIGNED-BLOB-02`：签名只在 preflight 验证，没有绑定 I 中实际提交的 blob
   位置：[D17:35](docs/plan/2026-08-28-project-gap-d17-import-spec.md:35)、[D17:83](docs/plan/2026-08-28-project-gap-d17-import-spec.md:83)、[D17:170](docs/plan/2026-08-28-project-gap-d17-import-spec.md:170)、[D17:193](docs/plan/2026-08-28-project-gap-d17-import-spec.md:193)。
   复现：preflight 后或 review 红灯返工时修改已签 spec/program；它们本就在 I allowlist，现有 pathset、whitespace、parent 断言仍可通过。
   最小修法：提交前用 prospective index、提交后用 `I:path` 再验 spec raw SHA 等于 owner 原话，并逐项核对 semantic-freeze/dirty-manifest binding；任一冻结输入变化即重新最终化和签署。
   disposition：`fix_now`，阻断 D17。

3. `A-BATCH-SOURCE-TIP-03`：`merge --ff-only <branch>` 没有锁定被评审的 source tip
   位置：[program:1471](docs/plan/2026-08-28-project-gap-closure-program.md:1471)、[D17:174](docs/plan/2026-08-28-project-gap-d17-import-spec.md:174)。
   复现：E 通过后在 candidate branch 追加未评审 X；目标仍为 P，按 branch 名执行 fast-forward 会导入 `P→I→E→X`。两支从同一 P 误开时的 predecessor 规则挡不住该情况。
   最小修法：集成授权绑定完整 E OID；验证 source tip 恰等于 E，并执行 `git merge --ff-only <full-E-OID>`，随后断言目标 tip 等于 E。
   disposition：`fix_now`，适用于 PG-00 未来晋升及 PG-01A–PG-06。

4. `A-PG01A-CORPUS-CLOSE-04`：G-A1 可在没有 Q0 语义报告时被记为关闭
   位置：[program:101](docs/plan/2026-08-28-project-gap-closure-program.md:101)、[program:924](docs/plan/2026-08-28-project-gap-closure-program.md:924)、[program:1512](docs/plan/2026-08-28-project-gap-closure-program.md:1512)、[program:1582](docs/plan/2026-08-28-project-gap-closure-program.md:1582)。
   复现：只把 986 项改称 unresolved 并降级公开文案，保留 locator/required-field 语义污染；当前批卡没有固定 truth-report 路径、schema、逐对象状态或异常计数门，仍可能写 `G-A1=repo_closed`。
   最小修法：为 PG-01A 固定 Q0 machine report 路径/schema，逐对象给出 `valid|unresolved`，绑定 commit、计数和 A-RAG-01/A-RAG-02/B-VAL-01 mutation；报告缺失不得关闭。
   disposition：`fix_now`，阻断 D17。

5. `A-PG01B-ACTION-CLOSE-05`：G-A3 在完整 action denominator 门出现前被关闭
   位置：[program:926](docs/plan/2026-08-28-project-gap-closure-program.md:926)、[program:1513](docs/plan/2026-08-28-project-gap-closure-program.md:1513)、[program:1514](docs/plan/2026-08-28-project-gap-closure-program.md:1514)、[program:1610](docs/plan/2026-08-28-project-gap-closure-program.md:1610)。
   复现：PG-01B 修复已知 direct/abandon/budget 点，遗留另一默认可见或 Brain 可调用的 toast-only/错 transition 动作；定向测试可绿。完整 `check-action-reachability` 到 PG-02 才出现，且历史 evidence 不追溯升级。
   最小修法：把 G-A3 在 PG-01B 改为 `stop_loss_set`、由 PG-02 完整 denominator 后关闭；或把 action checker 前移 PG-01B。
   disposition：`fix_now`，阻断 D17。

6. `A-PG01B-REMOTE-DENOMINATOR-06`：没有证明所有远程 HTTP/WS 业务入口均关闭
   位置：[program:929](docs/plan/2026-08-28-project-gap-closure-program.md:929)、[program:1621](docs/plan/2026-08-28-project-gap-closure-program.md:1621)、[mobileLan.ts:11](packages/daemon/src/net/mobileLan.ts:11)、[index.ts:941](packages/daemon/src/index.ts:941)、[hub.ts:140](packages/daemon/src/voice/hub.ts:140)。
   复现：只关闭已测 mobile-LAN HTTP 路由，遗留一个 tailnet、voice WS 或 recovery-server 业务入口；PG-01B 的定向 gate 没有 `server × method/path/message × via` exact denominator。
   最小修法：建立所有 HTTP/WS server 的远程入口清单；非 local 统一只允许 health/static/safe redirect，并加入绕过统一 guard、遗漏路由和 WS 消息的 mutation。
   disposition：`fix_now`，阻断 D17。

7. `A-PG05-MIGRATION-SNAPSHOT-07`：PG-05 批卡弱化了 G-A5 的恢复合同
   位置：[program:105](docs/plan/2026-08-28-project-gap-closure-program.md:105)、[program:928](docs/plan/2026-08-28-project-gap-closure-program.md:928)、[program:1698](docs/plan/2026-08-28-project-gap-closure-program.md:1698)、[program:1704](docs/plan/2026-08-28-project-gap-closure-program.md:1704)。
   复现：实施者把 `immutable probe` 直接用于 live 主文件，或认为 additive migration 无需 snapshot；这符合 PG-05 第1704–1705行，却不满足第928行“只在一致副本 immutable、生产迁移前恢复点”的合同。
   最小修法：明确 live inspect 必须一致读取 sidecar；immutable 只用于 quiesce 后的一致副本；所有生产 migration 前均建恢复点，并增加 WAL-only future/gap、additive migration 故障点门。
   disposition：`fix_now`，阻断 D17。

## B 级

1. `B-BATCH-READBACK-BINDING-01`
   位置：[program:1465](docs/plan/2026-08-28-project-gap-closure-program.md:1465)、[program:1493](docs/plan/2026-08-28-project-gap-closure-program.md:1493)。
   场景：I1 review 通过，返工成 I2；evidence 顶层填 I2，却继续引用未声明 reviewed SHA/tree 的 I1 报告。
   最小修法：每条 readback 增加 `reviewed_implementation_sha/tree` 并要求等于顶层 I；gate 条目同样绑定 I。
   disposition：`fix_now`。

2. `B-PG00-FOCUSED-GATE-PHASE-02`
   位置：[program:1505](docs/plan/2026-08-28-project-gap-closure-program.md:1505)、[program:1511](docs/plan/2026-08-28-project-gap-closure-program.md:1511)、[D17:167](docs/plan/2026-08-28-project-gap-d17-import-spec.md:167)。
   场景：registry 要求复制 `<LOCKED_HEAD>..<E_OID>`，但 I review 时 E 尚不存在；D17 同时要求检查到 I。
   最小修法：拆成 `FG-PG00-I` 与 E 后 closure gate，或将上界明确参数化为 phase candidate OID。
   disposition：`fix_now`。

3. `B-PG00-AMEND-DIFF-BASE-03`
   位置：[D17:83](docs/plan/2026-08-28-project-gap-d17-import-spec.md:83)、[D17:170](docs/plan/2026-08-28-project-gap-d17-import-spec.md:170)。
   场景：I review 红后只改一个文件；`git diff --cached` 默认相对旧 I，只显示一个路径，无法再证明七路径 exact-set，而 reset 又被禁止。
   最小修法：初次和 amend 均相对 `LOCKED_HEAD` 检查 prospective I pathset/whitespace。
   disposition：`fix_now`。

4. `B-PG00-STAGED-RECOVERY-04`
   位置：[D17:27](docs/plan/2026-08-28-project-gap-d17-import-spec.md:27)、[D17:119](docs/plan/2026-08-28-project-gap-d17-import-spec.md:119)、[D17:184](docs/plan/2026-08-28-project-gap-d17-import-spec.md:184)。
   场景：I 或 E exact-stage 后进程中断；新会话看到非空 index，无法区分本次合法中断态与 preexisting owner stage。
   最小修法：定义 `HEAD + staged path/blob exact-set` 的恢复判据；取消时仅允许对具名集合执行 `git restore --staged -- <literal paths>`，不改变 worktree bytes。
   disposition：`fix_now`。

5. `B-PG00-UNTRACKED-WHITESPACE-05`
   位置：[D17:59](docs/plan/2026-08-28-project-gap-d17-import-spec.md:59)、[206 prompt:44](prompts/206-project-gap-program-adversarial-review.md:44)、[212 report:36](research/codex-findings/212-project-gap-v4-transaction-and-wave-final-review.md:36)。
   场景：最终化规定的普通 `git diff --check` 返回 0，但它忽略 untracked；实际逐文件扫描发现 prompt 206 多一个 EOF 空行、report 212 有 trailing whitespace，两者都将进入 E。
   最小修法：签名前对 dirty manifest 中所有 untracked 文件逐个执行等价 `--no-index --check`，先修当前两处，再计算最终 SHA。
   disposition：`fix_now`。

6. `B-LEGACY-W53-DISPOSITION-06`
   位置：[PLAN-2:55](docs/plan/IMPLEMENTATION-PLAN-2.md:55)、[PLAN-2:238](docs/plan/IMPLEMENTATION-PLAN-2.md:238)、[D17:143](docs/plan/2026-08-28-project-gap-d17-import-spec.md:143)、[program:1710](docs/plan/2026-08-28-project-gap-closure-program.md:1710)。
   场景：W5.3-tail 实际只有 Hopper+S2 的 Tier2 步序循环，D17 却称部分进入 AI admission/discovery 的 PG-06，未给 child ID。
   最小修法：整体改为带 §6.10 触发线的 `inventory_deferred`；若确有 PG-06 子项，先建立稳定 child ID。
   disposition：`fix_now`。

7. `B-SP2D-TRIGGER-STATE-07`
   位置：[program:990](docs/plan/2026-08-28-project-gap-closure-program.md:990)、[program:1611](docs/plan/2026-08-28-project-gap-closure-program.md:1611)、[program:1623](docs/plan/2026-08-28-project-gap-closure-program.md:1623)。
   场景：SP2d 被定义为 consumer 批内义务，却又以 `DF-SP2D-API` 无条件 deferred；PG-01B 改 DTO 时可据 deferred 状态跳过双端 parse。
   最小修法：删除其“延期批”身份，每批强制记录 `SP2d=triggered|N/A(reason)`。
   disposition：`fix_now`。

8. `B-Q12-PRIMARY-OWNER-08`
   位置：[program:1032](docs/plan/2026-08-28-project-gap-closure-program.md:1032)、[program:1079](docs/plan/2026-08-28-project-gap-closure-program.md:1079)、[program:1743](docs/plan/2026-08-28-project-gap-closure-program.md:1743)。
   场景：crosswalk 声称唯一主责，但 Q1/Q2 同时归 `SP4/SP5`；二者分期开包时可能重复创建 taxonomy/schema/oracle。
   最小修法：拆出唯一初始化者 `Q1/Q2-core`，后开 slice 只能作为具名 consumer 扩展。
   disposition：`fix_now`。

## C 级

无。

## 其余对抗结论

- 签名真相源与留档本身没有形成循环：owner 原始消息中的最终 spec SHA 是授权真相；decision `[x]`、日期和原话是 `POST_SIGNATURE_RECORD`。本轮没有采纳“必须再签一次”的建议。真正缺口是 I staged/committed blob 未重验。
- 两支从同一 P 误开时，目标 tip 必须仍为 P 的设计可以让后晋升分支失效；补齐“按完整 E OID 合并”后即可，无需全局 active 锁。
- `active=empty,next=ai-supply`、D17 未签、`PENDING_*` 未最终化、214 report 不存在均是当前预期状态，不是 finding。213 report 缺失同样符合题设。
- 五线均有宏观归属，但工程/动作、Q0/Q1/Q2、远程关闭证明仍是 `[partial]`；初级/资深用户、AI subscription/admission、connector deferred 与持续成本/退出合同本身有明确触发线，没有默认全做或企业化提前施工。
- 第15–17节的回报、非开发持续成本、继续/暂停/降级/退出条件足够；本轮缺口不需要 owner 新提供产品战略信息。

更小替代方案比较：单提交会破坏本仓“两提交证据”纪律；增加 B0/ref/CAS/WAL 又没有现实收益。修正后的标准 `P→I→E`、clean I worktree、完整 E OID 晋升仍是最小方案。

## 实际只读命令与输出

- `git --version` → `git version 2.54.0`
- `git branch --show-current` → `codex/project-gap-plans-20260828`
- `git rev-parse HEAD main origin/main` → 三者均为 `280b0cfa1594a8963bed2a4b730734915a3762b0`
- `git diff --cached --quiet` → exit 0，index 空
- `git worktree list --porcelain` → 仅当前一个 worktree
- `git status --porcelain=v1 --untracked-files=all` → tracked 修改为 `docs/plan/README.md`、`history/PROCESS-JOURNAL.md`；untracked 为三份 v6 文档、prompts 206–214、reports 206–212
- `bash scripts/check-emoji.sh` → exit 0，`[ok] emoji gate: clean`
- `node scripts/check-doc-links.mjs` → exit 0，`[ok] active document links: files=117 broken=0`
- `git diff --check` → exit 0、无输出；但只覆盖 tracked diff
- 对所有 untracked 文件逐项执行 `git diff --no-index --check /dev/null <path>` → 检出上述两处 whitespace
- `node scripts/week-audit.mjs --check-bundle` → exit 1，`Error: 审计后出现未入账工作树路径:docs/plan/README.md`
- 使用 `nl -ba`、`sed`、`rg -n` 读取必读文档、生命周期、五线 crosswalk、HTTP/WS 路由和 gate 定义
- 两路零上下文只读 subagent 已完成；结论由当前会话逐条回查后裁决

明确未运行：`just ci`、lint、typecheck、unit/contract、build、Playwright/e2e、产品测试、真实账号、设备、connector、deploy、网络访问、外部 `codex exec`；未 commit、push、merge、stash、reset、clean；未修改文件；未生成签署 SHA。

```text
A_open_exact_set={A-PG00-AUDIT-E-01,A-PG00-SIGNED-BLOB-02,A-BATCH-SOURCE-TIP-03,A-PG01A-CORPUS-CLOSE-04,A-PG01B-ACTION-CLOSE-05,A-PG01B-REMOTE-DENOMINATOR-06,A-PG05-MIGRATION-SNAPSHOT-07}
B_open_exact_set={B-BATCH-READBACK-BINDING-01,B-PG00-FOCUSED-GATE-PHASE-02,B-PG00-AMEND-DIFF-BASE-03,B-PG00-STAGED-RECOVERY-04,B-PG00-UNTRACKED-WHITESPACE-05,B-LEGACY-W53-DISPOSITION-06,B-SP2D-TRIGGER-STATE-07,B-Q12-PRIMARY-OWNER-08}
C_open_exact_set={}
D17_SEMANTIC_FREEZE_READY=no
D17_READY_AFTER_MECHANICAL_FINALIZATION=no
owner_now_must_provide_exact_set={}
OVERDESIGN_REGRESSION=no
```

当前 owner 不应先签任何内容。上述问题修复、重新独立复审并完成机械最终化后，owner 唯一需要提供的是绑定最终 spec SHA 的 D17 原始批准消息及本地 I/E 授权；无需同时提供 D1–D16、D18 或 D19。