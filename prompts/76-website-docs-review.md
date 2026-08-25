# 76 · 官网首页 v2 + Docs 页对抗性评审

你是对抗性评审员。SayDo 官网(saydo.octoooo.com,Cloudflare Pages 静态站,零构建)刚完成两项变更:
1. 首页(中 `deploy/saydo-octoooo-com/index.html` / 英 `deploy/saydo-octoooo-com/en/index.html`)按 `docs/site/2026-08-20-homepage-structure-copy.fable.md` 做了结构与文案修订(主 CTA 改「开始用」、nav 加「文档」、七步第 3/6 步文案更新、卖点第 2/3 卡拆分推理与执行器、现状区新增「Claude Code 执行器 · 进行中」卡、`#download` 改 `#start` 并保留兼容锚、FAQ 新增两问、尾 CTA 三按钮、页脚加文档)。
2. 新增 Docs 长文页(中 `deploy/saydo-octoooo-com/docs/index.html` / 英 `deploy/saydo-octoooo-com/en/docs/index.html`),内容来自 `docs/site/2026-08-20-docs-page-content.fable.md` 的 B 部分(§0–§19 + 附录),桌面粘性目录 + 移动折叠目录,样式在 `deploy/saydo-octoooo-com/site.css`(docs-* 类)。

## 硬约束(违反 = A 级)
1. 零 emoji、零 pictographic 符号；文本状态标记使用 `[ok]` / `[fail]` / `[warn]`，文本箭头 → ↔ 合法。
2. 状态词纪律:执行完成只说「等你验收 / ready for your review」,不说 done;合并后才说「交付了 / delivered」。
3. 完成度诚实:已落地 = 现在可用;已开工未收口 = 进行中;未开工 = 规划中/Coming soon。不得把未落地能力写成已可用。
4. 正文不得出现仓内批号、内部文件路径(packages/... 之类)、commit SHA、本机绝对路径(~ 之类);`~/.saydo` 与 `<workspace>/.saydo` 是产品路径,允许。
5. 零构建约束:不得引入任何构建步骤或外部依赖;样式只许消费 site.css/tokens.css 已有 token。

## 评审角度(找问题,不给好评)
- A 级:违反硬约束;中英内容含义不一致;broken 链接/锚点(尤其 /docs/#quickstart、#start、#download 兼容锚、21 个目录锚点);HTML 转义错误导致代码块显示错误;移动端破版。
- B 级:首页改动与 homepage 稿 B 节不符之处;Docs 页与 docs 稿 B 部分的遗漏/错译/漏译(抽查 §4、§5.4、§8.1、§16);英文文案地道性;表格/代码块可读性。
- C 级:改进建议。

## 产出
报告写入 `research/codex-findings/76-website-docs-review.md`:A/B/C 分级,每条含文件:位置、问题、修法;末尾总评(可否上线)。简体中文。
