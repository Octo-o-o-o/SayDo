# RC4 移动端最终复审返工：IPv6 同构、prompt 隐私、Harmony 设备口径

继续原 implementation session，只修改当前 mobile worktree。不要 commit、push、联网、发布、部署或调用 subagent；不要接触真机安装。

独立复审结论 No-Go：2 个 P1、1 个 P2。请一次性根因关闭。

## P1：iOS 接受 bracketed ULA trailing single colon

最小反例（仅作为协议测试输入，不是私有地址）：bracketed IPv6 authority，
host parts `["fd12", "", "1", ""]`（trailing empty hextet）、port `47100`、query `token=abc`。
不要把完整 pairing URL 写进本文。

当前 iOS 接受并生成多一个冒号的名称，Android/Harmony 与系统 IPv6 parser 均拒绝。根因是 Swift compressed IPv6 左右段用默认 `split(separator:)` 丢弃尾空段；Node reference `isUla()` 也只看字符集和首 hextet，属于同类假阳性。

必须完成：

1. 在 `apps/ios/SayDo/DesktopProfile.swift` 的 raw string 路径中，于 `URL(string:)`/Foundation normalization 之前严格验证 bracketed authority IPv6 grammar；post-URL/direct URL initializer 的 LAN 校验也必须严格，不能留下另一入口。
2. compressed `::` 最多一次；除 `::` 自身代表压缩的空侧外，任何额外空 hextet、leading single colon、trailing single colon、三冒号、九段、空 hextet 混入都拒绝；合法压缩（ULA 前缀 + `::` + 末 hextet）继续接受。
3. 修复 `scripts/test-pairing-url-corpus.mjs` reference parser，不依赖 lax `isUla`。
4. 在 canonical `scripts/pairing-url-corpus.json` 增加必选 `reject-ula-trailing-single-colon`，按 generator 重新生成 Android/iOS/Harmony 三份 fixture；不得手改生成文件造成漂移。
5. 三端 native unit tests 都加入精确回归，并保留此前五类 Unicode authority、percent decode 与 ASCII trim 合同。
6. 加入至少包含 leading-single-colon、trailing-single-colon、triple-colon、合法压缩的定向差分回归；三端结果必须 0 mismatch。

## P1：8 个 untracked prompts 含个人路径或 UUID 类标识

仅清理以下真实命中文件；保留 prompt 的评审/施工证据语义，不删除文件：

- `prompts/114-rc4-mobile-readiness-remediation.md`
- `prompts/117-rc4-mobile-host-gate-return.md`
- `prompts/119-rc4-mobile-harmony-ios-host-return.md`
- `prompts/122-rc4-mobile-final-host-readback-return.md`
- `prompts/124-rc4-mobile-ios-malformed-percent-return.md`
- `prompts/125-rc4-mobile-host-green-evidence-align.md`
- `prompts/126-rc4-mobile-precommit-privacy-return.md`
- `prompts/151-rc4-mobile-ios-ascii-trim-readback-return.md`

规则：个人 home/repo 绝对路径改为 `<repo>`、`$HOME` 或相对路径；session/run/simulator/device UUID 改为语义占位符；RFC1918 原值改为 `<private-ip>` 或由 parts 组装。不得在新 prompt、测试日志、文档中复制原值。`prompts/154-*` 只有占位文本，不计真实泄漏，但可把形似 home 的占位改为 `<repo>` 以消除扫描歧义。最终对全部 11 个 untracked mobile prompts 做文件内容隐私扫描，personal home、generic UUID、RFC1918 原值均为 0；只报告文件名/类别/计数，不回显原值。

扩展 `scripts/test-mobile-release-contract.mjs` 或复用公开隐私 helper，把当前轮会提交的 `prompts/` evidence 纳入门禁，避免再次出现范围假阴性。门禁不得依赖当前用户姓名或真实设备值。

## P2：Harmony 当前设备口径

本轮真实事实是：`hdc list targets` exit 0，非空目标数 0；历史证据是 2026-08-22 曾出现 1 台，随后连续空列表。统一以下位置为“历史曾出现、本轮无在线目标证据”，不得写“宿主当前发现 1 台”或无时间限定的“有物理目标”：

- `apps/harmonyos/README.md`
- `docs/release/version-matrix.md`
- `docs/site/2026-08-20-docs-page-content.fable.md` 的所有当前状态表述
- `deploy/saydo-octoooo-com/docs/index.html`
- `deploy/saydo-octoooo-com/en/docs/index.html`

`e2e/evidence/2026-08-22-mobile-shells-device-build.md` 的历史表述应保留，并在 rc.4 复核段补充本轮 0 台，不伪称安装。双语官网语义一致。Harmony 仍是 unsigned/profile 缺失、无真机安装、No-Go 分发。

## 必跑门禁

1. `node scripts/test-pairing-url-corpus.mjs`
2. `node scripts/test-mobile-installers.mjs`
3. `node scripts/test-mobile-release-contract.mjs`
4. `pnpm typecheck`
5. `pnpm lint`
6. Android unit + lint + assembleDebug，以及 build-only identity/signature
7. iOS simulator XCTest 全量 22 项以上，以及 build-only codesign/identity
8. Harmony cached-exact tests；fresh 仍失败则如实保留 exit/无计数，不得改写
9. `node scripts/check-emoji.mjs`
10. `node scripts/check-doc-links.mjs`
11. `git diff --check`
12. actionlint（若本机可用）
13. 全部 11 个 untracked prompt 的隐私扫描

最终报告每条真实 exit code与计数，单列 IPv6 定向差分 0 mismatch、prompt 隐私 0 命中、Harmony 文档“当前一台”0 命中。不要写入设备 ID、个人目录或 UUID 原值。
