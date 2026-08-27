# RC4 期间未被采用的工具脚本（归档，非现役）

## 这是什么

2026-08-27 从 worktree `SayDo-rc4-f107-readline-review-fix-20260823` 抢救出来的 20 个
`scripts/*.mjs`。它们在该工作树里**从未入库**，RC 链（rc.4 → rc.12）最终走了另一套实现。

## 为什么放在这里而不是 `scripts/`

**它们不是现役工具**：

- 不在 `justfile` 的 `ci-node` / `ci-python` 链路上；
- 不在 `package.json` 的 `ci:node` 里；
- 未经任何独立评审;
- main 上只有一个有等效物：`availability-transition.mjs` ⇄ `scripts/release-availability.mjs`
  （main 采用后者，已过 rc.10/rc.11/rc.12 的实体门验证）。

放进 `scripts/` 会让后续会话误以为它们是发布链路的一部分。归档在此，需要时再评估、再晋升。

## 清单

| 文件 | 从命名推断的意图（**未经验证**） |
|---|---|
| `availability-transition.mjs` | Release availability 翻转;main 已有 `release-availability.mjs` |
| `ci-gate-manifest.mjs` / `check-ci-gate-equivalence.mjs` / `test-ci-gate-equivalence.mjs` | 本地门禁与 CI 门禁的等价性对账 |
| `journal-digest.mjs` / `check-journal-digests.mjs` / `test-journal-digests.mjs` / `journal-digest-catalog.json` | history/ 文档的摘要与漂移检查 |
| `implementation-boundary.mjs` | 实施边界 commit 的固定与校验 |
| `historical-markdown-redact.mjs` / `test-historical-markdown-redact.mjs` / `historical-markdown-inventory.json` / `journal-redaction-manifest.json` | 历史 Markdown 的批量脱敏 |
| `ios-artifact-policy.mjs` / `test-ios-artifact-policy.mjs` | iOS 产物的发布策略门 |
| `git-blob-id.mjs` / `safe-regular-file.mjs` | blob id 计算与常规文件安全读取的小工具 |
| `test-doc-links.mjs` | 文档链接检查器自身的自测（main 有 `check-doc-links.mjs` 但无此自测） |
| `test-public-tree-boundary.mjs` / `test-week-audit-boundary.mjs` | 公开树与周审计的边界自测 |

**上表是从文件名推断的，不是读过实现后的结论。** 要用其中任何一个，先读代码再判断。

## 同批抢救的过程证据

同一轮还入库了两条 RC4 工作线的 61 份交接 prompt / findings / readback（散在
`prompts/`、`research/codex-findings/`、`docs/review/`）。它们此前同样只存在于工作树里。
背景见 `history/PROCESS-JOURNAL.md` R113。
