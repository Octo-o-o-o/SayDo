# 最近一周双向审计、快速启动与发布收口对抗评审

你是零上下文、只读的对抗评审方。仓库为 `/Users/wangyixiao/WorkSpace/SayDo`。
不要修改文件，不要提交，不要部署。先完整阅读仓库 `AGENTS.md`，再用真实 Git 与代码命令独立核验；
不要把现有 review、evidence 或报告中的断言当成证据。

## 评审范围

- 审计窗口固定为 `2026-08-15 00:00:00 +0800` 到当前工作树。
- 基线提交由 `git rev-list -1 --before='2026-08-15 00:00:00 +0800' main` 独立求得。
- 检查当前未提交 diff，以及这段窗口内 main、所有本地/远端 refs 的提交和文档。
- 核对 `scripts/week-audit.mjs`、生成的 Markdown/JSON 台账及
  `docs/review/2026-08-23-week-audit-faststart-release.md` 是否完整、可复现、无漏项。
- 检查文档到提交、提交到文档两条方向是否都覆盖；implementation-only、document-only、paired 的分类是否诚实。
- 检查 canonical、实施计划、evidence、README、中文/英文官网的 Claude CLI、Windows、Release、移动端状态是否与实际实现一致。
- 检查 Tier1 init 真实探针、凭据环境剥离、observed model/evidence、console 设置与详情页是否存在安全、契约、竞态或假绿。
- 检查 `@saydo/cli` `0.1.0-rc.2` 的打包、许可、版本、ownership、端口冲突、进程退出、恢复、Windows/Linux/macOS 行为和 CI 矩阵。
- 检查 GitHub Release 固定 URL 快速启动方案是否真的无需源码、是否诚实说明只含 daemon + Web 控制台，以及官网是否把尚未存在的包误写成稳定版。
- 检查 Playwright/fixture 变更是否修正测试漂移，还是通过改 fixture/断言掩盖产品缺陷。
- 检查活跃文档链接、历史事实改写、emoji 门禁、发布物可重现性与潜在敏感信息泄漏。

## 输出要求

只输出一份中文 Markdown 评审报告，不用 emoji。先给结论，再列发现：

- A：阻断发布，安全、数据丢失、契约错误、不可启动或审计漏项。
- B：重要缺陷，状态误导、跨平台不一致、维护性或测试真实性问题。
- C：改进项，不阻断当前预发布。

每条发现必须包含：严重级别、绝对 `file:line`、实际命令/代码证据、影响、最小修复建议。
不要写泛泛建议；没有可证实发现的类别明确写“无”。最后给“可以发布 / 修复后可以发布 / 不可以发布”裁决，
并列出你实际执行的门禁命令及其退出结果。任何未执行的检查必须明确写“未验证”。
