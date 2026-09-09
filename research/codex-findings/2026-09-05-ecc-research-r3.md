结论：GREEN。四维有限复核未发现可达 P0/P1；A5 已闭合，三项 P2 均确认 `fixed`，A1–A4 无回归。

有限证据：

- 候选初末均为 HEAD `bcf8ea8...`、fingerprint `7089536f...`。
- A5：4 个交付文件 SHA 全匹配；最终方案 10 个相对 Markdown 链接全部可达；同目录报告存在；ContextView README 与 SayDo 三件研究索引入口齐全。
- P2：日志确认包装 exit 0、两个子测试 exit 1、末尾 `DONE fail=1`；ECC rules 为 122，其中 README 1、正文 121；`sourceRevision` 已复用裸 hex 类型。
- 118 个 source、12 个 test 的路径和行号有效；emoji、隐私、`git diff --check` 均通过。
- 按授权未重跑 ContextView 89 秒门、ECC 全部测试或最终完整门禁；未启动第二次 P2 sweep，未修改候选。

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 3,
  "candidate_head": "bcf8ea855f25b177888d9159f75e49214f3dd892",
  "diff_fingerprint": "7089536f83a122527091f8a2bff75306c6a7a62935693bfd5affde7977652e44",
  "review_scope": "workflow-final",
  "blockers": [],
  "p2_ledger_delta": [
    {
      "id": "ECC-R1-P2-001",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "research/ecc/evidence-index.json:950-995",
      "evidence": "聚合项 958-963 的 exit_code=0 被明确限定为包装进程真实退出码，summary 同时声明聚合 failed；982-995 两条具体失败记录仍各为 exit_code=1。日志 SHA 匹配，原文含 18 passed/2 failed、16 passed/6 failed 与 DONE fail=1。",
      "impact": "原先把包装退出码与子测试聚合状态混写的歧义已消除，不能再把包装绿解释成测试全绿。",
      "status": "fixed",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/7089536f83a122527091f8a2bff75306c6a7a62935693bfd5affde7977652e44",
      "resolution": "保留包装进程实际 exit_code=0，在 summary 明示 aggregate failed，并以两条独立子记录保存非零退出码。"
    },
    {
      "id": "ECC-R1-P2-002",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "research/ecc/2026-09-05-ecc-project-research.md:186,443",
      "evidence": "冻结 ECC e04ea0b9 的 tracked rules/*.md 机械计数为 122，其中 rules/README.md 1 个、规则正文 121 个；报告两处当前正文均写 122 并注明含 README。",
      "impact": "规则文件总数与规则正文数的统计口径现已明确，不再有 121/122 歧义。",
      "status": "fixed",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/7089536f83a122527091f8a2bff75306c6a7a62935693bfd5affde7977652e44",
      "resolution": "总数统一为 122，并显式拆出 README 1 个与规则正文 121 个。"
    },
    {
      "id": "ECC-R1-P2-003",
      "first_seen_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/32fd336f9206de58508d7addad27fb3ccc15aeee9100f83bfed26ce6a0f05cbf",
      "location": "docs/plan/2026-09-05-ecc-borrowing-plan.md:224-242",
      "evidence": "草案现为 sourceRevision: RuntimeIdentity[\"sourceRevision\"]；packages/contracts/src/runtime.ts:5-10 将其约束为 7-64 位小写裸 hex，docs/09-data-contracts.md:14 的 Digest 仍是 sha256:<hex>。",
      "impact": "未来照抄草案不会再为同名 sourceRevision 引入第二种不兼容编码。",
      "status": "fixed",
      "last_validated_candidate": "bcf8ea855f25b177888d9159f75e49214f3dd892/7089536f83a122527091f8a2bff75306c6a7a62935693bfd5affde7977652e44",
      "resolution": "InstallReceipt 草案复用既有 RuntimeIdentity.sourceRevision 类型与裸 hex 语义，不再使用 Digest。"
    }
  ],
  "focused_gates": [
    {
      "name": "candidate-identity-and-stability",
      "exit_code": 0,
      "summary": "初末两次 candidate_fingerprint.py 均返回指定 HEAD 与 git-diff-v1，候选在核验期间未变化。"
    },
    {
      "name": "contextview-final-delivery-integrity",
      "exit_code": 0,
      "summary": "manifest 的 4 个目标文件均存在且 SHA-256 匹配；方案 10 个相对 Markdown 链接全部可达，同目录报告存在，三件研究文件与 SayDo 源逐字节一致，README 三条入口存在。"
    },
    {
      "name": "p2-final-sweep-verification",
      "exit_code": 0,
      "summary": "包装 exit 0 与两个子文件 exit 1 分层正确；ECC rules 为 122 含 README、正文 121；sourceRevision 复用 7-64 位裸 hex 类型。"
    },
    {
      "name": "r2-r3-regression-scope",
      "exit_code": 0,
      "summary": "三份正文变更块为 5、5、3，全部限于评审元数据、接收附记和三项 P2 机械修正；A1-A4 关键语义仍保留。"
    },
    {
      "name": "evidence-index-integrity",
      "exit_code": 0,
      "summary": "118 个 source 与 12 个 test 的 ID、项目根、相对路径和行号范围有效；3 份日志存在且字节数、SHA-256 匹配。"
    },
    {
      "name": "git-diff-check",
      "exit_code": 0,
      "summary": "tracked diff 未发现 whitespace error。"
    },
    {
      "name": "emoji-gates",
      "exit_code": 0,
      "summary": "SayDo 工作树及 ContextView 最终 4 个接收文件均输出 emoji gate clean。"
    },
    {
      "name": "public-tree-privacy",
      "exit_code": 0,
      "summary": "SayDo 工作树扫描 1991 个文本、108 个二进制、排除 8 个路径，hits=0；ContextView 最终 4 个接收文件内置隐私规则 hits=0。"
    }
  ],
  "stop_reason": null
}
```