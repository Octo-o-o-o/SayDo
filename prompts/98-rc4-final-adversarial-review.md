# RC4 最终对抗评审输入

## 目标

对当前干净提交做只读、对抗性最终复审。最终实施边界固定为
`b768089585d710255d61a693c2489ccf425f446f`；其后的提交只允许承载证据、评审与发布状态，不得悄悄
改变实施。请独立核验，不要把仓库内报告的 `[ok]` 或测试摘要当成事实来源。

## 必读范围

1. `docs/plan/2026-08-22-week-audit-faststart-release.fable.md`。
2. `docs/review/2026-08-23-week-audit-faststart-release.md`、
   `docs/review/2026-08-23-remediation-ledger.md`。
3. `e2e/evidence/2026-08-23-rc3-release-recovery.md` 与
   `e2e/evidence/2026-08-23-rc4-release-candidate.md`。
4. F106–F108 对应实现、测试、发布脚本、GitHub workflows、CLI 包文档、README、官网中英页面与
   `scripts/week-audit.mjs` 生成物。
5. `git diff 8602c7324844ede014c577409ae10a834f1a1714..HEAD`、最近一周主线提交与文档双向账本。

## 必查问题

- 文档到 commit、commit 到文档是否逐项闭环；版本、tag、固定 URL、source revision、build ID、
  availability 和“尚未发布”状态是否一致。
- F106 的 LF 合同是否足以保证 Windows checkout 与包内法务/构建输入同字节，且没有掩盖应保留的
  平台换行文件。
- F107 对 stdout/stderr/control pipe 的处理是否只在可证明的收口期忽略预期错误；活动期错误、
  审计、退出结果、重试与资源释放是否仍 fail-closed。
- F108 的 50ms 同 signal 去重是否会吞掉真正的紧急停止、不同 signal 或显式 `cli-stop-*`；是否存在
  时间、队列、平台或测试盲区。
- 快速启动 tarball、`npm exec` 与 global install 的安全边界、零孤儿、端口/状态根、Windows shim、
  Linux/macOS 行为是否合理；官网是否把未实现的语音、常驻服务或商店/npm 发布写成可用。
- 发布流程能否确保新 tag 不可移动、只接受 attempt 1、公开快照不带私有材料、Release 字节与本地
  候选一致、失败时不会错误回写 availability 或部署。
- 证据是否有自引用、过期 SHA、伪绿、隐私泄露、抽样替代全量、命令结果与结论不匹配等问题。

## 输出要求

只做只读审查，不修改文件、不提交、不推送、不部署。先列 findings，按 P0/P1/P2/P3 排序；每条必须给
出文件与行号、可复现依据、影响和最小修复建议。没有某级问题就不要虚构。最后单独给出 `Go` 或
`No-Go`，并列出仍需在发布后才能验证的硬门。若没有 actionable finding，明确写“无 actionable
P0/P1/P2/P3”，但仍说明检查过的高风险面与真实门禁结果。
