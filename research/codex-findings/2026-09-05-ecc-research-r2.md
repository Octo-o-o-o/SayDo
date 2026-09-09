结论：RED。无 P0，新增 1 个 P1，命中 A5。R1 的 4 个 P1 均已闭合；本轮失败仅来自 Contexpect 最终接收稿的证据链不可达。

## P1：最终接收目录缺少所声明的配套调研

- acceptance_item：A5
- 正式路径：Contexpect 接收 `docs/research/2026-09-05-ecc-borrowing-plan.md`，读者再按正文进入配套 ECC 调研。
- 候选明确指定接收位置，并宣称调研报告位于“同目录”：Contexpect 方案:4（`review-r2:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:4`）、方案:9（`review-r2:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:9`）、方案:258（`review-r2:research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:258`）。
- 但交付索引只把借鉴方案标为 Contexpect 接收档案，调研报告仍属于 SayDo：research/README.md:17（`review-r2:research/README.md:17`）。ContextView 当前研究索引也没有该报告：ContextView docs/README.md:76（`ContextView:docs/README.md:76`）。
- 按最终位置机械解析，正文其余 10 个相对 Markdown 链接均存在，唯一失败为 `docs/research/2026-09-05-ecc-project-research.md`，原始输出为 `missing=1`。
- 最小修正：将调研报告一并纳入 ContextView 接收集合并更新索引；或者把“同目录”改为真实、固定 commit 的跨仓 permalink。不能继续引用尚未提交、最终不存在的支持文件。
- 该修正属于已授权文档交付范围，`needs_owner_decision=false`；后续是否导入产品排产仍由 owner 决定。

## 其余验收结果

- A1/A2：通过本轮复核。Codex native plugin、单一受信 `SessionStart`、Claude 七类事件及 legacy sync 已正确分层；installer、memory、session adapter、MCP、control pane、ecc2 和测试局限均有源码或日志依据。官方 [ECC 2.2.0 公告](https://github.com/affaan-m/ECC/discussions/2887)、[npm 包页](https://www.npmjs.com/package/ecc-universal?activeTab=dependents)及[选择性安装目录](https://ecc.tools/skills)也支持发布版和目录数量分层。
- A3：通过。SayDo 导入固定走 `source.kind=import → candidate + taint`，不传 `requestedTrust`、不绑 readiness、M0 拒绝、升格只走 `approveCandidate`，与实际分类器、编译器和账本一致。
- A4：通过。ECC 保持 overlay/optional fixture 身份；18 family、六 facet、双 oracle、passive scan、Claim 权威和 cutoff 均未被放宽。overlay-to-claim 明确合同先行，Apache 自有夹具与未来 MIT 条件包已拆开。
- 三份日志字节数及 SHA-256 与声明一致；当前索引 118 个 source、12 个 test，路径和行号均有效。
- 按约定未重跑 ContextView 89 秒门禁、ECC 全套测试或 Rust 测试。未修改候选，未执行 commit、push、install。

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 2,
  "candidate_head": "bcf8ea855f25b177888d9159f75e49214f3dd892",
  "diff_fingerprint": "e1e1c4798020a8d85f1a640d35f2e3896e330f0fa0ef7cd3a66fef5339d58185",
  "review_scope": "workflow-final",
  "blockers": [
    {
      "id": "R2-P1-01",
      "severity": "P1",
      "summary": "Contexpect 接收稿把未纳入接收集合的 SayDo 调研报告声明为最终目录同级文件，正式落位后的证据链不可达。",
      "evidence": "正式路径为 Contexpect docs/research/2026-09-05-ecc-borrowing-plan.md 的配套调研入口；候选 research/ecc/2026-09-05-contextview-ecc-borrowing-plan.md:4-9,258 声明接收位置及同目录报告，SayDo research/README.md:17-18 只把借鉴方案标为 Contexpect 接收档案、报告仍是 SayDo 调研，ContextView docs/README.md:76-84 与目标 docs/research 实际文件集均无 2026-09-05-ecc-project-research.md；最终路径核验唯一缺失项即该文件。",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "A5"
    }
  ],
  "p2_ledger_delta": [
    {
      "id": "ECC-R1-P2-001",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "research/ecc/evidence-index.json:950-963",
      "evidence": "同一聚合测试记录的 exit_code 为 1，summary 又写包装脚本 exit 0；允许日志末尾为 DONE fail=1。",
      "impact": "机器消费者无法区分真实进程退出码与子测试聚合状态；正文虽如实披露两个失败文件，证据字段仍有歧义。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/e1e1c4798020a8d85f1a640d35f2e3896e330f0fa0ef7cd3a66fef5339d58185",
      "resolution": "拆分 process_exit_code 与 aggregate_status 或 failed_children，或让聚合器按失败子项返回非零并同步正文。"
    },
    {
      "id": "ECC-R1-P2-002",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "research/ecc/2026-09-05-ecc-project-research.md:186,443",
      "evidence": "冻结 ECC 树中 tracked rules/*.md 为 122 个，其中含 rules/README.md；候选写 121 且未声明排除口径。",
      "impact": "一个非价值性数量口径不精确，不改变技术结论。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/e1e1c4798020a8d85f1a640d35f2e3896e330f0fa0ef7cd3a66fef5339d58185",
      "resolution": "改为 122，或明确写成排除 rules/README.md 后的 121 条规则文件。"
    },
    {
      "id": "ECC-R1-P2-003",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "docs/plan/2026-09-05-ecc-borrowing-plan.md:224-242",
      "evidence": "草案将 InstallReceipt.sourceRevision 定为 Digest；现有 docs/09-data-contracts.md:12-15,1572-1575 与 packages/contracts/src/runtime.ts:5-8 的同名字段是裸 7-64 位 hex，而 Digest 是 sha256:<hex>。",
      "impact": "未来若照抄会让同名 sourceRevision 出现两种不兼容编码。",
      "status": "open",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/e1e1c4798020a8d85f1a640d35f2e3896e330f0fa0ef7cd3a66fef5339d58185",
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
      "summary": "118 个 source 与 12 个 test 条目的 ID、路径和行号范围有效，errors=0。"
    },
    {
      "name": "task-log-integrity",
      "exit_code": 0,
      "summary": "三份允许日志存在，字节数与 SHA-256 均与正文及索引声明一致。"
    },
    {
      "name": "contextview-final-reference-resolution",
      "exit_code": 1,
      "summary": "按最终 docs/research 落位核验，10 个相对 Markdown 链接均可达，但 line 9 声明的同目录配套调研文件不存在；missing=1。"
    }
  ],
  "stop_reason": null
}
```