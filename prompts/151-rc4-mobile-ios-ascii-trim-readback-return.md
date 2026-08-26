# RC4 移动端第三次主会话 readback 退回：iOS ASCII trim 真机语料

你是原移动端实施会话。只在当前 worktree 修复，不提交、不推送、不部署，不改无关文件；禁止 subagent。

主会话在本机真实 iOS Simulator 执行：

```text
xcodebuild -project SayDo.xcodeproj -scheme SayDo \
  -destination 'platform=iOS Simulator,id=<simulator-id>' \
  -derivedDataPath .build-simulator CODE_SIGNING_ALLOWED=NO test
```

真实结果为 22 tests、2 failures，退出码 65：

- `DesktopProfileTests.testSharedCorpusAcceptAndReject()` 在首个需要 trim 的 accept case 抛 `invalidFormat`；
- `DesktopProfileTests.testStringEntryTrimsWhitespaceAndNewlines()` 对 `"\n\t http://.../?token=abc \r\n"` 抛 `invalidFormat`。

根因定位：Swift 的 `Character` 扩展字素语义可把尾部 CRLF 视为一个 Character；当前
`PairingPercentCoding.asciiTrim` 用 Character 与单个 `"\r"` / `"\n"` 比较，因此无法剥离该尾部。

## 验收目标

1. `asciiTrim` 按 Unicode scalar 或等价的 ASCII code-unit 边界，只剥离 U+0020、U+0009、U+000A、U+000D；不得把 BOM、NBSP 或其他 Unicode whitespace 当作可 trim。
2. 覆盖独立 CR、独立 LF、CRLF grapheme、混合前后 ASCII whitespace；并保留 BOM/NBSP 拒绝。
3. 共享 corpus 的所有 accept/reject case 必须在真实 XCTest 中逐项通过；若 accept case 抛错，测试失败信息应带 case id，避免下次只看到裸 `invalidFormat`。
4. 不回退严格 percent/UTF-8、userinfo、duplicate token、non-BMP、安装器签名和设备选择修复。
5. 重跑并记录真实退出码：

```text
node scripts/test-pairing-url-corpus.mjs
node scripts/test-mobile-release-contract.mjs
node scripts/test-mobile-installers.mjs
cd apps/ios
xcodegen generate
DEST="$(node ../../scripts/select-ios-simulator.mjs)"
xcodebuild -project SayDo.xcodeproj -scheme SayDo -destination "$DEST" \
  -derivedDataPath .build-simulator CODE_SIGNING_ALLOWED=NO test
```

完成后只报告改动文件、XCTest 精确计数与各命令退出码；不要宣称移动端发布完成。
