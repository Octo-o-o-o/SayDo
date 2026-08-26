# RC4 移动端宿主 XCTest 回修：iOS 原始字符串非法 percent escape

继续 resume 同一移动实施会话 `<session-id>`，工作区：
`<repo>`。

这是 prompt 122 后宿主真实 XCTest 的单点回修。不得新开分支，不得提交、push、发布、部署、查询或安装真机。先重读 prompt 122、当前 diff 与本文件。

## 真实红灯

宿主已取得：

```text
xcodebuild ... test
exit 65
DesktopProfileTests.swift:133 XCTAssertThrowsError failed: did not throw
http://<private-ip>:47100/?token=%zz
http://<private-ip>:47100/?token=%2
```

原因：`DesktopProfile.init(pairingURLString:)` 先调用 `URL(string:)`，Foundation 会把原始非法 `%` 重新编码成 `%25`，后续严格 decoder 看不到原始错误。

## 修复合同

1. 在 iOS 字符串入口 trim 后、构造 `URL` 前，严格验证原始字符串中的每个 `%` 后恰有两个 ASCII hex 字符；非法或截断 escape 统一抛 `PairingURLValidationError.invalidFormat`。
2. 验证必须覆盖完整原始 URL，不能只覆盖 token；不得把合法 `%25`、合法 UTF-8 percent 序列、未转义 BMP/non-BMP token、合法 IPv6 authority 或既有 whitespace trim 回归。
3. 保持 `init(pairingURL:)` 现有 API，但 scanner 的实际字符串入口必须继续走严格校验。
4. 现有 XCTest 反例必须通过；如缺少 `%` 边界用例，最小补齐 `%`、`%0`、`%00`/`%25` 的正反例。
5. 检查 Android/Harmony 当前严格 decoder 没有同类绕过；不要做无关重构。

## 只跑聚焦门禁

```bash
xcrun swiftc -typecheck apps/ios/SayDo/DesktopProfile.swift
cd apps/ios && xcodegen generate
DEST="$(node ../../scripts/select-ios-simulator.mjs)"
xcodebuild -project SayDo.xcodeproj -scheme SayDo -destination "$DEST" -derivedDataPath .build-simulator CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES test
git diff --check
```

不要重跑 Android/Harmony/全仓门禁；宿主会统一复核。最终仅报告改动和真实退出码，保留工作树。
