# RC4 移动端第二次宿主门禁回修：Harmony 依赖闭环与 iOS IPv6 归一化

继续同一移动端实施会话。本文件是宿主真实门禁反馈，不是独立 review。工作目录：
`<repo>`。

不得提交、push、发布或安装真机；完成后保留工作树给宿主复核。

## 1. HarmonyOS：纠正真实失败归因并闭合标准依赖形态

宿主复核确认了两件同时成立的事实：

1. `ohpm install --all --lockfile_stable_order` 当前仍真实失败，官方源对 `@ohos/hypium` / `@ohos/hamock` 返回 HTTP 502。
2. 上一施工会话把 SDK 内的测试框架目录手工复制到 `oh_modules` 后再跑 `hvigorw test`，最终并不是 502，而是 106 个 `Failed to resolve OhmUrl`，并反复告警 dependency not installed。手工复制目录不是有效安装，不能把它当门禁证据。

宿主又做了两个隔离探针：使用本机另一工程由 ohpm 正式安装的精确
`@ohos/hypium@1.0.25` / `@ohos/hamock@1.0.0` store 与对应 lock，在一次性 SayDo 工程副本中运行当前测试：

- 保留当前重复的 entry devDependency：`hvigorw test` exit 0，12 passed / 0 failed。
- 恢复标准工程形态（只在工程根 `devDependencies` 声明 hypium/hamock，entry 不重复声明）后：同样 exit 0，12 passed / 0 failed。

要求：

1. 恢复 DevEco 标准形态：`apps/harmonyos/oh-package.json5` 作为测试依赖唯一声明源；移除 `apps/harmonyos/entry/oh-package.json5` 中重复的 hypium devDependency。
2. 新增并提交候选 `apps/harmonyos/oh-package-lock.json5`，内容必须与根依赖图精确匹配、stable order、无个人路径或凭证。可只读参考同机另一工程的 `oh-package-lock.json5`（路径不写入本文件）；两项版本必须仍是 hypium `1.0.25`、hamock `1.0.0`，integrity/resolved 不得编造。
3. 不 vendor `oh_modules`、`.ohpm`、SDK 内文件或测试报告；确认这些生成物仍被 ignore。
4. README 与版本矩阵必须准确区分：
   - fresh dependency hydration 目前被上游 502 阻断；
   - 手工复制 SDK 目录的 OhmUrl 红灯不是有效安装方式；
   - 宿主用既有的、由 ohpm 正式安装且 lock 匹配的精确 store 在一次性树实跑 12/12 通过；
   - 因上游当前不可 fresh hydrate，仍不得把 Harmony job 宣称为可复现 CI 绿。
5. 正式门禁/合同自测应检查 root-only devDependency、lock exact versions/integrity/resolved、无 entry 重复依赖、无 vendor 目录进入 Git。

## 2. iOS：IPv6 authority 与展示名必须按 authority 本身归一化

当前 `DesktopProfile.swift` 使用：

```swift
if host.contains(":") && !pairingURL.absoluteString.contains("[")
```

这会在整个 URL 中找 `[`，不是只检查 authority。宿主 Foundation 探针还确认当前系统中 bracketed IPv6 的 `URLComponents.host` / `percentEncodedHost` 都含 `[]`；当前 `name` 因而会是 `[fd...]:port`，与 Android/Harmony 的 `fd...:port` 不一致。

要求：

1. 只使用 `URLComponents` 的 authority/host 字段校验 bracketed IPv6；不得再在完整 `absoluteString` 中找括号。
2. 对 IPv6 host 去掉且只去掉一对 authority brackets 后再做 LAN 校验和 profile `name`，使三端 display name 一致；构造 base URL 时仍保留合法 bracketed IPv6。
3. 补 XCTest：bracketed ULA 被接受，`name == "fd12:...:47100"`（无 brackets）；未 bracket IPv6/畸形 authority 拒绝；query/path 中的 bracket 或其编码不能充当 authority bracket。
4. 现有非法 UTF-8、BMP/non-BMP、重复 token、userinfo、端口与 LAN 边界不得回退。

## 3. 其余检查

- 重新检查 Android/Harmony/iOS 三端 pairing URL 结果是否一致；若发现可判定差异直接最小修复并补三端等价反例。
- 不把 Xcode 27 beta plugin-server 环境错误写成 XCTest 通过；Foundation-only 探针不等于完整 app test。
- 不改桌面 release tag/version，不把三端壳放入 GitHub Release。

## 4. 门禁

真实运行并报告退出码/计数：

1. `bash -n apps/ios/build-and-install.sh apps/android/build-and-install.sh apps/harmonyos/build-and-install.sh scripts/mobile-install-common.sh`
2. `node scripts/test-mobile-installers.mjs`
3. `node scripts/test-mobile-release-contract.mjs`
4. Android：JDK 17 + SDK 36 下 `:app:testDebugUnitTest :app:lintDebug :app:assembleDebug`
5. iOS：`xcodegen generate`；标准 simulator build/XCTest 如仍被本机 Xcode 环境阻断，保留首个真实错误和 exit code，不篡改项目绕过。
6. Harmony：先真实 `ohpm install --all --lockfile_stable_order`；若仍 502，明确记录。不得再手工复制 SDK 包冒充 install。可在一次性副本用上文已经由 ohpm 正式安装的 exact store + 本仓 lock 复核 `hvigorw test`，并报告 `Tests run/Pass/Failure/Error`；同时跑 `assembleHap`。
7. `actionlint .github/workflows/*.yml`
8. `pnpm typecheck`
9. `pnpm lint`
10. `node scripts/check-doc-links.mjs`
11. `bash scripts/check-emoji.sh`
12. `git diff --check`

最终只汇报：改动、Harmony fresh/install 与 cached-exact 两种证据、iOS 修复、每项真实门禁和仍在的外部阻断。不要 commit。
