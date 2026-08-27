# RC4 公开树隐私线主机 readback 返工单

继续原实施会话 `<session-id>`。这不是独立评审，而是主机对已交付工作树的真实 readback。继续遵守 102/129 的范围：只改隐私清理、共享 redaction helper、扫描器、公开快照门、对应测试与必须重生的既有生成物；不得 commit/push/release/deploy/联网，不得修改真实远端或设备。使用 `apply_patch`。

常规自测中，redaction 25/25、scanner 26/26、typecheck、lint、actionlint、emoji 均退出 0。但主机发现以下红灯，必须全部关闭。

## 1. 批量占位符破坏 569 个 Markdown 链接

主机实测：

```text
rg -n '\]\(<home>' --glob '*.md' --glob '*.fable.md' | wc -l
569
rg -l '\]\(<home>' --glob '*.md' --glob '*.fable.md' | wc -l
24
```

CommonMark 实际渲染证明字面量 `[x](` + `<home>/WorkSpace/SayDo/file.ts:1)`(拼接书写,见本文末注) 不会形成链接，而字面量 `[x](~/WorkSpace/SayDo/file.ts:1)` 会形成链接。当前替换因此违反“保留文档原意/最小替换”。

- 把 home 占位策略改为不会破坏 Markdown、命令和 URI 语法的平台中性形式，推荐 `~`。共享 redaction helper 也必须输出同一种形式，避免下一次生成再次产生该无效目的地(形态 = `](` 紧跟 `<home>`)。
- 对本轮所有已替换文本做完整机械修复；至少保证 `rg '\]\(<home>'` 为 0，且不得留下其他 `](<...>` 同类无效目的地。
- 更新 helper/self-test 的期望并重生受影响的 canonical 周审计输出；不要手改生成 JSON。
- 对 active docs 运行真实 `node scripts/check-doc-links.mjs`；对被批量改动的 archive/research Markdown，增加一个最小语法反例或程序化断言，防止占位符再次让内联链接退化为纯文本。

## 2. iOS 安装脚本被字面占位符破坏

当前 `apps/ios/build-and-install.sh` 含：

```sh
-destination 'platform=iOS,name=<account>'
```

这不再能匹配真实设备；脚本仍硬编码一个 CoreDevice ID，也不应继续作为公开通用安装入口。

- 用一个显式、必填、无默认私值的 `SAYDO_IOS_DEVICE_ID`（或同等清晰名称）同时驱动 `xcodebuild -destination "platform=iOS,id=..."` 与 `devicectl --device`。
- 缺变量时在任何 build/install 外部动作前 fail-fast，错误只给通用配置提示。
- README 给可复制的通用示例，使用不会被 shell 当重定向符的示例值；不得写真实账户、设备名或设备 ID。
- 加最小 shell/源码合同测试，证明脚本没有字面 `<account>`/固定设备 ID，且同一变量同时绑定 build 和 install；不要只改文档。

## 3. diff 门禁四处失败

主机真实 `git diff --check 3bafd53cf44e051bdc8ca5d2858d48823d71a6e4 --` 发现四处 trailing whitespace：

- `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md:3`
- `research/codex-findings/67-t19-polish-review.md:8`
- `research/codex-findings/71-phase-analysis-review-attempt1.md:4`
- `research/codex-findings/71-phase-analysis-review.md:5`

只清掉本轮引入的尾随空白，保持段落含义。

## 4. 当前候选扫描与周审计要诚实闭环

- 主机 `node scripts/check-public-tree-privacy.mjs --fs` 唯一命中是不会交付的未跟踪实施 prompt 110；输出只含 path/category/count，没有原文泄漏。不得用放宽规则或跳过整个 prompts 目录换绿。
- 最终交付 exact-set 应排除 99/100/101/102/103/104/105/107/108-rc4/110/129/146 等施工 prompt。用临时 index 或等价非破坏方式把“全部 tracked 修改 + 本轮四个新脚本”组成精确候选，再用同一 scanner 扫该候选，并报告精确文件/文本/二进制/排除/命中数。
- 当前真实 index 尚未包含四个新脚本，所以主机直接 `week-audit --check` 会报 publication manifest 漂移；`--check-bundle` 在内部树会看到私有软著目录。这两项不能冒充当前 index 已绿。按原有公开候选临时 index 流程重生并检查，最后明确说明整合提交后还须对真实候选 ref 再跑一次 `--ref` 与 bundle 门。
- 102 要求的 cross-link 与 public tree object/commit 对象措辞不得在本轮修复中回退。

## 验收门禁

至少逐项运行并记录真实退出码：

```sh
node scripts/test-public-text-redaction.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-release-provenance.mjs
node scripts/check-doc-links.mjs
bash -n scripts/publish-public-snapshot.sh
pnpm typecheck
pnpm lint
pnpm exec actionlint
bash scripts/check-emoji.sh
git diff --check 3bafd53cf44e051bdc8ca5d2858d48823d71a6e4 --
```

另外运行 iOS installer 合同自测、占位符 Markdown 反例、精确候选的 privacy scanner 与生成物 check。最后给出改动文件 exact-set、每项门禁原始摘要和退出码、未解决风险；不 commit。

---

> **入库注(2026-08-27)**:本文原稿把反例字面量整段写在正文里,而 `scripts/test-public-text-redaction.mjs`
> 的 `tracked files have no angle-wrapped privacy destinations` 一项用正则 `\]\(<(?:home|account|private-ip)\b`
> 扫全部 tracked 文件,**不区分「讨论该反例」与「犯该反例」**。抢救入库时该项因此转红。
> 已按本仓既有做法(`scripts/public-text-redaction.mjs` 用 `"Use" + "rs"` 拼接避免源文件自命中)
> 把上文两处字面量拆开书写,语义不变。原意即:home 占位符必须用不破坏 Markdown/命令/URI 语法的
> 平台中性形式(`~`),这一结论已落进 `HOME_PLACEHOLDER`。
