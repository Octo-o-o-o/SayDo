# 统一工程方案与 ECC 交接独立评审

结论：`RED`。U1、U2、U3 通过；U4 有 1 个 P1 blocker。P2 为 0。

## 三维核验

- `[ok] scope / U1`：统一稿明确把方案入口合并，但产品批仍串行保持 `PG-01B → AS-01/AS-02 → PG-02`。当前 PLAN-2 与 canonical 均未改；AS 只有在新任务具名采纳、PG-01B 已合并且 evidence 可验证后，才由 supervisor 登记进唯一排产源。旧 D17 未被当作 blanket 授权，已闭合批按 evidence 与祖先关系跳过，commit、merge、push、install、deploy 和 owner-stop 均未被默认放行。
- `[ok] contracts / U2`：AS-01/AS-02 保留了窄凭据 grammar、`requestedTrust` 前拒写、foundation 首次 raw staging 前整次拒绝新 generation、旧 pointer/status 不变、create-only Git 保护、tracked/人工共享保留、三类失败、脱敏定位、既有重试与有限去重。合同阶段与实现阶段各一次独立 review，不再按两个 AS ID 拆成四轮；正式 ProjectSettings 路由、canonical 错误类型、共享 schema/相关 UI 门及完整产品门均有明确要求。
- `[ok] contracts / U3`：四行回报/成本要求完整；VOBS 的容量、失败分母与日志保留，VIEW 的事件优先、有界兜底、请求预算与新鲜度，VOICE 的证据选一处、输出/取消/计费边界，HOST 的被动诊断及无收据时 ownership 未验证均保留。其余候选保留触发条件且未扩大近期施工。
- `[fail] handoff / U4`：归档、九个旧入口、索引、唯一 workflow-v2 block 和角色隔离均通过冻结文档门；但统一 Prompt 对 review 报告落点给出互斥指令，正式执行路径会发生候选身份漂移，详见 B1。

## P1 blocker

### B1 · review artifact 落点会破坏冻结 fingerprint

`docs/plan/IMPL-PROMPT-engineering-unified.astra.md:157` 要求 reviewer 把报告写到 `research/codex-findings/`；同一 Prompt 的 `:198` 又要求报告与其它控制产物全部写入已忽略的 `$CONTROL_DIR`，以保持 fingerprint 不变。仓库实测只有本轮 `$CONTROL_DIR/review.md` 命中 `.gitignore`，`research/codex-findings/` 没有 ignore 规则；`candidate_fingerprint.py` 明确把所有未忽略的 untracked 文件计入 `git-diff-v1`。因此按前一条正常写入新报告后，结束 fingerprint 与派发 identity 会改变，后续 completion receipt、validator 和 gate 绑定无法同时满足 U4。

修复范围明确：统一当前报告落点为 `$CONTROL_DIR` 内的 ignored review artifact；若需长期归档到 `research/codex-findings/`，应在候选消费/收口后作为另一个有身份记录的步骤，不能与冻结 candidate 的 review 写入混为同一步。

## P2

无。

## 证据与边界

- 起始身份：HEAD `bcf8ea855f25b177888d9159f75e49214f3dd892`；`git-diff-v1` fingerprint `93b51736ec156a18e20367b5e166e75658166f3e30f0de2d889efc5900eaab36`，`--expect` exit 0。
- `unified-docs`：exit 0。`validate_handoff` valid；emoji clean；active document links 150 个、broken 0；九份原始归档 hash、九个非执行跳转、未变 PLAN-2/canonical 与唯一 workflow contract 均通过；`git diff --check` 无输出。
- 未运行产品 CLI、Grok、真实 provider、`just ci` 或 Playwright；没有读取旧 reviewer 推理，没有修改候选或 cycle state。

```review-manifest
{"verdict":"RED","review_ordinal":1,"candidate_head":"bcf8ea855f25b177888d9159f75e49214f3dd892","diff_fingerprint":"93b51736ec156a18e20367b5e166e75658166f3e30f0de2d889efc5900eaab36","review_scope":"workflow-final","blockers":[{"id":"U4-review-artifact-path-conflict","severity":"P1","summary":"统一 Prompt 同时要求 review 报告落 research/codex-findings 与 ignored control 目录，前一路径会改变冻结 fingerprint 并破坏后续身份绑定。","evidence":"docs/plan/IMPL-PROMPT-engineering-unified.astra.md:157; conflicts with line 198","in_scope":true,"needs_owner_decision":false,"acceptance_item":"U4"}],"p2_ledger_delta":[],"focused_gates":[{"name":"unified-docs","exit_code":0,"summary":"handoff valid; emoji clean; 150 active links and 0 broken; 9 archive hashes and redirects valid; unchanged schedule and canonical; diff check clean"}],"stop_reason":null}
```
