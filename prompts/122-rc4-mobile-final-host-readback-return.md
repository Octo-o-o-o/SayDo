# RC4 移动端第三次宿主 readback 回修：三端严格同构与产物新鲜性

继续 resume 同一移动实施会话 `<session-id>`，工作区：
`<repo>`。

这是宿主在 prompt 119 后的代码 readback，不是独立 review。不得新开分支，不得提交、push、发布、部署、读取真实设备列表或安装真机。先重读 prompts 114、117、119、当前 diff 和本文件。

## P1-1：Android 任意长 IPv4 数字段不能逃出统一校验错误

`DesktopProfile.isIpv4Address()` 在只确认全是数字后直接 `part.toInt()`。超长数字段会抛 `NumberFormatException`，而不是稳定的 `PairingUrlValidationException`。

- 使用 `toIntOrNull()` 或等价无异常判定；任意长十进制字段必须被当成非法 host。
- 增加 Android 直接反例，断言最终只抛统一 pairing 校验错误。
- Harmony 的 `Number()` 和 iOS 的 `Int()` 已会返回非有限/失败，但也补三端等价超长 octet 拒绝用例，防止合同再次分叉。

## P1-2：三端 URL 语法结果必须一致

宿主真实 readback 已确认三处分歧：

1. Android/Harmony 在字符串入口 `trim()`，iOS scanner 直接 `URL(string: value)`。三端实际扫码入口统一为先去掉首尾 whitespace/newline，再按严格 URL 合同解析；iOS 增加可单测的字符串入口并让 scanner 使用它，不能只在 UI 内写一个无测试 trim。
2. Android/iOS 接受空 fragment `#`，Harmony 拒绝任意 `#`。统一为 fragment 只要存在就拒绝，包括空 fragment；非空 fragment 继续拒绝。
3. Java/Foundation 接受合法十进制前导零 port 并归一化为整数，Harmony 当前拒绝。RFC URI port 是数字串，统一为接受 `047100` 这类仍落在 1..65535 的值，并把 profile/base URL 归一化为 `47100`；`00000`、大于 65535、非数字仍拒绝。

每项都补 Android/Harmony/iOS 等价正反例。现有 RFC1918/ULA、bracketed IPv6、非法 UTF-8、重复 token、userinfo、extra query、BMP/non-BMP 合同不得回退。

顺带闭合 Harmony `utf8Bytes()` 的不成对 surrogate：不得产生随后被自身严格 decoder 拒绝的非法 UTF-8。正常配对 token 路径必须 round-trip；可选择稳定 replacement 或 fail-closed，但要有直接测试且不得弱化合法 non-BMP。

## P1-3：安装器必须证明产物由本次构建重新产生

当前公共 `-ot BUILD_MARKER` 只拒绝旧时间戳；预先存在的同时间戳或未来时间戳产物在 fake build 不写输出时仍可被接受。这不满足“只接受本次构建后更新的产物”。

修复合同：

- 构建前删除且只删除各脚本的确定性生成目标：Android debug APK、iOS 固定 derived-data 下的 SayDo.app、Harmony 固定 signed/unsigned HAP。路径必须从脚本自身固定目录构造，不能使用未验证 glob、用户输入、HOME 或宽目录。
- 删除后再建立 build marker并运行构建；构建后目标必须重新存在。APK/HAP 还必须是非 symlink regular file；`.app` 必须是非 symlink directory；不得跟随/接受预置 symlink。
- 保留签名验证：iOS codesign 必须通过；Harmony 仍只接受 signed HAP，unsigned/缺 Profile fail-closed。
- 自测增加未来时间戳、相同时间戳或 symlink stale 产物，fake build 成功但不产出时三端均必须失败，且不得调用 install。不要只把测试时间改得更旧。

## P2：设备枚举继续 fail-closed

- iOS devicectl 项缺 `hardwareProperties.reality` 时不得默认成 physical；只有明确 physical 的 iOS/iPadOS 条目才可候选。补缺字段反例。
- Harmony `hdc list targets` 的任意多词诊断文本不能被首词当作在线设备。保留真实 one-token 在线目标格式；带状态时只接受明确 online/connected/device，Offline/unauthorized/disconnected 和未知诊断全部排除。补 `No connected targets` 同型反例。
- 显式设备、零/一/多/模拟器/离线行为及同一 id 绑定不得回退。

## 宿主已取得且文档必须继续如实保留的证据

- Android JDK 17 + SDK 36：14 tests、lint、assemble 全绿。
- iOS `xcodegen` 绿；本机 Xcode 27 beta plugin-server 仍阻断完整 build/XCTest，不能宣称 XCTest 通过。宿主另跑 `swiftc -typecheck DesktopProfile.swift` 为 exit 0，但这不等于 app XCTest。
- Harmony true fresh + 独立空 cache 仍因官方 hypium/hamock URL HTTP 502 失败；由 ohpm 正式安装且 lock 精确匹配的 cached-exact 一次性树 `hvigorw test` 为 12/12，unsigned assemble 绿。两种证据必须继续分开，不得写成 fresh CI 绿。

## 门禁

真实运行并报告退出码/计数：

```bash
bash -n apps/ios/build-and-install.sh apps/android/build-and-install.sh apps/harmonyos/build-and-install.sh scripts/mobile-install-common.sh
node scripts/test-mobile-installers.mjs
node scripts/test-mobile-release-contract.mjs
env ANDROID_HOME=<真实 SDK> ANDROID_SDK_ROOT=<同一 SDK> apps/android/gradlew --no-daemon -p apps/android :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
xcrun swiftc -typecheck apps/ios/SayDo/DesktopProfile.swift
cd apps/ios && xcodegen generate
# 标准 simulator build/XCTest 可再尽力跑；若仍是相同 Xcode 环境首错，保留真实 exit，不改项目绕过。
# Harmony fresh hydration 与 cached-exact 可复核，但不得手工复制 SDK 目录冒充 install。
actionlint .github/workflows/*.yml
pnpm typecheck
pnpm lint
node scripts/check-doc-links.mjs
bash scripts/check-emoji.sh
git diff --check
```

尖括号不可照抄。完整 Android 构建不要与另一个 Gradle 任务并行。最终只汇报真实改动、反例、门禁与外部阻断；不要 commit。
