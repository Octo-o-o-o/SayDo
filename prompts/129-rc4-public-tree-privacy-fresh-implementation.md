# RC4 公开树隐私硬门实施

完整读取并严格执行同目录 `prompts/102-rc4-public-tree-privacy-remediation.md`。仓库为当前 cwd，分支 `codex/rc4-f107-readline-review-fix`，基线提交 `3bafd53cf44e051bdc8ca5d2858d48823d71a6e4`。这是实施任务，只改该修复单需要的文本、redaction helper、隐私扫描器、公开快照脚本、对应测试与 canonical 生成物；不得 commit/push/release/deploy/联网，不碰真实远端或设备。

当前工作树已有两个未暂存的生成物 `research/week-audit/2026-08-22-bundle-integrity.json` 与 `research/week-audit/2026-08-23-publication-manifest.json`，它们是先前生成流程留下的暂态 scratch，不是 owner 手写内容。不得手工拼接或盲目保留；只能在生成器与源内容修复后由 canonical 生成流程整体重生。其余现有未跟踪 prompt 不是交付文件，不要修改或提交。

额外硬要求：

- 扫描当前将公开的 Git tree/工作树时绝不回显命中的原文、账号、home 或私网地址；输出只允许 path、规则类别、计数。
- 自测 fixture 的敏感样本必须运行时片段拼接，源文件静态扫描不得自命中。
- 公开过滤 exact-set 必须与 `scripts/publish-public-snapshot.sh` 实际过滤单源；路径相似但不在 exact-set 的目录不能误排除。
- Git/ref/解码/对象读取任何失败都必须非零，二进制明确计数并跳过内容扫描，不可把失败当 0 命中。
- redaction 必须先于 whitespace normalize、截断、hash/excerpt 落盘；`week-audit` 与 refiner 共用单一 helper。
- 因真实工作树路径本身含 owner home，扫描的对象必须是文件内容/公开 blob，不得把绝对 cwd 字符串写进会提交的报告、JSON、测试源码或错误 fixture。
- 交付前程序化核对 diff 中不含 owner-specific literal、私网 literal和本机绝对路径；精确列出改动文件与每项门禁退出码。不得用 skip/白名单整个目录换绿。

按 102 的全部门禁执行。若 `week-audit --write/check/check-bundle` 因并行分支尚未合并导致 implementation boundary 漂移，仍须保证生成器与隐私硬门本身正确，并明确列出最终整合时必须重生的生成物；不要伪造绿色。使用 `apply_patch` 修改文件。
