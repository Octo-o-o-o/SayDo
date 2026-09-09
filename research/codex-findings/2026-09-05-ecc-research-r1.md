结论：RED。无 P0，共 4 个 P1。机械门与日志完整性无新增失败，但候选在两份正式借鉴路径上存在可复现的事实或合同冲突，当前版本不能验收。

这些问题都可通过本轮文档修订解决，不需要 owner 决策；是否把修订后的建议导入产品排产，仍须 owner 后续授权。

## P1-01：Codex native hook 被误判为 instruction-backed

- 验收项：A1
- 正式路径：ECC 调研的跨宿主结论 → Contexpect CV-03 → WP-02/WP-06 resolver 与 loss 分类。
- 候选把 Codex hooks 写成 instruction-backed，并据此要求把 `hooks-runtime` 判为 omitted/instruction overlay：ECC 调研:164（`review-r1:research/ecc/2026-09-05-ecc-project-research.md:164`）、Contexpect 方案:59（`review-r1:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:59`）、Contexpect 方案:144（`review-r1:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:144`）。
- 同一冻结 ECC SHA 的当前实现明确相反：Codex plugin manifest 绑定原生 hook 文件 plugin.json:23（`ECC:.codex-plugin/plugin.json:23`），该文件注册真实 `SessionStart` command hook codex-hooks.json:2（`ECC:hooks/codex-hooks.json:2`）；说明要求通过 `/hooks` 显式信任 Codex plugin README:64（`ECC:.codex-plugin/README.md:64`），能力表也标为 `native-plugin`、`native-trust` harness-capabilities.js:54（`ECC:scripts/lib/harness-capabilities.js:54`）。
- 上游旧 `cross-harness` 文档与当前实现自身发生漂移；候选却采用旧矩阵，且 evidence index 没有索引上述 native manifest/hook 路径。类似地，“plugin.json MCP 为空”只适用于 Claude manifest；Codex native plugin 指向单一 `.mcp.json`，legacy `.codex/config.toml` 又是另一套六服务器兼容层。
- 最小修正：按 Claude plugin、Codex native plugin、Codex legacy sync 分层重写事实表；明确 Codex 当前只有受信任的 native `SessionStart` 子集，其他 Claude 事件才是 omitted；更新 CV-03、target 对照和 evidence index。Installed/discoverable 仍不得自动升级为 Model-visible、UseEvidence 或 Outcome-affecting。

## P1-02：拟新增 field map 必然触发 foreign-map 门禁

- 验收项：A4
- 正式路径：Contexpect 方案 §4 第 2 项 → WP-01/WP-05。
- 候选指定新增 `acceptance/field-to-claim/ecc-overlay.yaml`，同时声明不增加 `family_id=ecc`：方案:154（`review-r1:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:154`）。
- 当前 acceptance 只允许由既有 family/surface 枚举生成的精确文件集合，额外文件会同时报 foreign map、extra map 和数量不等：check_acceptance.py:216（`ContextView:scripts/check_acceptance.py:216`）。路径合同固定为 `{family_id}-{surface}.yaml` contexpect_contract.py:1641（`ContextView:scripts/contexpect_contract.py:1641`），且已有明确负例锁定该行为 test_false_greens.py:735（`ContextView:tests/acceptance/test_false_greens.py:735`）。
- 最小修正：删除该现成路径承诺。可以在 canonical/schema/generator/negative tests 先行变更后，为既有 family/surface 增加显式 overlay 来源；或另建版本化 overlay-to-claim 工件，不占用严格的 field-to-claim 集合。两种方式都必须保持 18 family、ECC 非 oracle、cutoff 后仅 optional。

## P1-03：第三方 corpus 的许可方案与现有 gate 冲突

- 验收项：A5
- 正式路径：Contexpect 方案 §4 corpus 项及 §8 制作规程。
- 候选一处要求从 ECC SHA 摘录内容并加 Apache-2.0 头，另一处又要求每个文件记录 `license=MIT`：方案:158（`review-r1:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:158`）、方案:209（`review-r1:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:209`）。
- 当前 development static fixture 的 validator 强制 `license == Apache-2.0` check_acceptance.py:740（`ContextView:scripts/check_acceptance.py:740`），而现有 corpus 字段还没有 `allowed_redistribution` contexpect_contract.py:449（`ContextView:scripts/contexpect_contract.py:449`）。PRD 要求第三方配置记录来源、许可、可再分发方式、脱敏和 digest PRD:1006（`ContextView:docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:1006`）。ECC MIT 条款要求复制时保留版权与许可文本 ECC LICENSE:1（`ECC:LICENSE:1`）。
- 最小修正：二选一并写死。要么只生成自有 Apache-2.0 合成夹具，不复制 ECC 的实质文本或命令；要么先扩展 corpus canonical、schema、validator、NOTICE/SBOM 和负例，使第三方 MIT fixture 能携带原版权、许可、再分发与脱敏记录。不能以 Apache 头覆盖上游 MIT 身份。

## P1-04：SayDo 的 candidate 与 third_party 被错误视为可互换

- 验收项：A3
- 正式路径：SayDo S-03 记忆导入适配器。
- 候选要求导入后一律为 `candidate` 或 `third_party`，验收却只检查零 M0：SayDo 方案:82（`review-r1:docs/plan/2026-09-05-ecc-borrowing-plan.md:82`）。
- 当前 `source.kind=import` 被分类器确定性降为 `candidate` classify.ts:23（`review-r1:packages/daemon/src/memory/classify.ts:23`），Ledger 不接受调用方自报这两个 trust ledger.ts:88（`review-r1:packages/daemon/src/memory/ledger.ts:88`）。二者的 Context Pack 语义也不同：`candidate` 可作为只读标注参与非 M0 编译，`third_party` 默认完全排除 09-data-contracts:524（`review-r1:docs/09-data-contracts.md:524`）、compiler.ts:89（`review-r1:packages/daemon/src/memory/compiler.ts:89`）。
- 最小修正：按现有正式路径固定为 `source.kind=import → trust=candidate + taint`，补非 M0 包含行为、readiness 不绑定和正常 candidate→trusted 确认路径的正反验收。如果目标是默认完全排除，则必须先做 classifier/Ledger 的合同变更，不能走 DAO 旁路。

## 核验覆盖与限制

- 已全文核对四个必审工件、两个索引增量、SayDo canonical/源码、ContextView 当前未提交规范快照，以及 ECC 冻结源码关键路径。
- evidence index 的 94 个 source 条目和 12 个 test 条目路径、行号范围均有效；三份允许日志的字节数和 SHA-256 与声明一致。
- ECC 日志中的 14 个测试文件通过、2 个因缺依赖失败均已被候选如实披露；ContextView 六门日志均为 0，`144 tests OK`。按约定未重跑 89 秒门禁或 ECC 全套测试。
- 本地确认 ECC HEAD、v2.2.0 tag 后 147 commits，以及 286/68/94 的 skills/agents/commands 数量。公开 [npm 包页](https://www.npmjs.com/package/ecc-universal?activeTab=dependents)和[仓库发布公告](https://github.com/affaan-m/ECC/discussions/2887)也支持发布版本为 2.2.0。沙盒代理阻止了直接 GitHub API 重取，因此 stars、forks、downloads 瞬时值没有被本 reviewer 独立再认证，也未据此判 RED。
- 未修改候选，未执行 commit、push、install 或产品实现。

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 1,
  "candidate_head": "bcf8ea855f25b177888d9159f75e49214f3dd892",
  "diff_fingerprint": "32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
  "review_scope": "workflow-final",
  "blockers": [
    {
      "id": "R1-P1-01",
      "severity": "P1",
      "summary": "ECC 的 Codex 当前实现被误写为 instruction-backed，导致下游 resolver 方案遗漏 native plugin 与显式 hook trust。",
      "evidence": "候选 research/ecc/2026-09-05-ecc-project-research.md:164、research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:59-61,144；对照 ECC .codex-plugin/plugin.json:23-25、hooks/codex-hooks.json:2-17、.codex-plugin/README.md:64-74、scripts/lib/harness-capabilities.js:54-67。",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "A1"
    },
    {
      "id": "R1-P1-02",
      "severity": "P1",
      "summary": "计划新增的 ecc-overlay field-to-claim 文件必然被当前 Contexpect acceptance 认作 foreign map。",
      "evidence": "候选 research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:154-161,225-230；对照 ContextView scripts/check_acceptance.py:216-253、scripts/contexpect_contract.py:1641-1642、scripts/contexpect_schema.py:484-503、tests/acceptance/test_false_greens.py:735-763。",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "A4"
    },
    {
      "id": "R1-P1-03",
      "severity": "P1",
      "summary": "ECC corpus 制作规程同时要求 Apache-2.0 头和 MIT 元数据，既不能通过当前 corpus gate，也未闭合第三方再分发记录。",
      "evidence": "候选 research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:158,209-219；对照 ContextView scripts/check_acceptance.py:740-748、scripts/contexpect_contract.py:32-36,449-460、docs/requirements/2026-09-04-contexpect-complete-product-requirements.md:1006-1013,1276-1282，以及 ECC LICENSE:1-13。",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "A5"
    },
    {
      "id": "R1-P1-04",
      "severity": "P1",
      "summary": "SayDo 记忆导入把 candidate 与 third_party 当作可互换结果，但现有写路径与 Context Pack 对两者语义不同。",
      "evidence": "候选 docs/plan/2026-09-05-ecc-borrowing-plan.md:82-93,230；对照 docs/09-data-contracts.md:423-431,524、packages/daemon/src/memory/classify.ts:23-24,61-74、packages/daemon/src/memory/ledger.ts:88-116、packages/daemon/src/memory/compiler.ts:89-108。",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "A3"
    }
  ],
  "p2_ledger_delta": [
    {
      "id": "ECC-R1-P2-001",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "research/ecc/evidence-index.json:766-771",
      "evidence": "同一测试记录的 exit_code 为 1，summary 却写包装脚本 exit 0；允许日志末尾为 DONE fail=1。",
      "impact": "机器消费者无法区分真实进程退出码和归一化子测试聚合状态；正文虽披露两个失败文件，仍存在证据字段歧义。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "resolution": "拆分 process_exit_code 与 aggregate_status 或 failed_children，或让聚合器按失败子项返回非零并同步正文。"
    },
    {
      "id": "ECC-R1-P2-002",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "research/ecc/2026-09-05-ecc-project-research.md:171",
      "evidence": "冻结 ECC 树中 tracked rules/*.md 为 122 个，其中含 rules/README.md；候选写 121 且未声明排除口径。",
      "impact": "一个非价值性数量口径不精确，不改变技术结论。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "resolution": "改为 122，或明确写成排除 rules/README.md 后的 121 条规则文件。"
    },
    {
      "id": "ECC-R1-P2-003",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "docs/plan/2026-09-05-ecc-borrowing-plan.md:218-225",
      "evidence": "草案将 InstallReceipt.sourceRevision 定为 Digest；现有 docs/09-data-contracts.md:1572-1575 与 packages/contracts/src/runtime.ts:5-8 的同名字段是裸 7-64 位 hex，而 Digest 在 docs/09-data-contracts.md:12-15 为 sha256:<hex>。",
      "impact": "未来若照抄会让同名 sourceRevision 出现两种不兼容编码。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "resolution": "复用现有 RuntimeIdentity.sourceRevision 语义，或将带前缀的值改名为 bundleDigest 并在 canonical 中单源定义。"
    }
  ],
  "focused_gates": [
    {
      "name": "git-diff-check",
      "exit_code": 0,
      "summary": "tracked diff 未发现 whitespace error。"
    },
    {
      "name": "emoji-gate",
      "exit_code": 0,
      "summary": "输出 [ok] emoji gate: clean。"
    },
    {
      "name": "evidence-index-range-check",
      "exit_code": 0,
      "summary": "94 个 source 与 12 个 test 条目的路径和行号范围有效，errors=0。"
    },
    {
      "name": "task-log-integrity",
      "exit_code": 0,
      "summary": "三份允许日志的字节数与 SHA-256 均与报告声明一致。"
    }
  ],
  "stop_reason": null
}
```