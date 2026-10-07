# SayDo iOS 壳

> 当前源码边界(2026-09-13 对账):PG-01B 已关闭 daemon 的远程业务入口。以下 LAN + token 是历史开发壳能力,当前 main 不支持据此完成跨设备业务连接;解析测试或壳构建通过不等于配对可用。重开条件以 `docs/09-data-contracts.md`、`docs/11-ui-spec.md` 为准。

这是用于移动端评估的 SwiftUI 壳。它扫描桌面端生成的
`http://<ip>:<port>/?token=<token>`，在 `WKWebView` 中打开现有 SayDo 页面，并支持保存、
切换和删除多个桌面 profile。profile 元数据保存在 `UserDefaults`，token 单独保存在
Keychain，访问级别为 `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`。

版本 `0.1.0 (1)`。原生语音层提供按住说话、实时转写、松手发送、上滑选择最近三项 Focus、
滑出取消和回复朗读。设备内中文识别不可用时不会静默联网；验收人可在桌面列表的“壳设置”
中显式开启联网中文识别，也可关闭回复朗读。

## Spike 边界

- 当前仅用于开发通道的 LAN + token 连接，要求手机和桌面在同一可达网络。
- 当前 ATS 例外只覆盖 LAN IP、无后缀主机名和 `.local`；`.ts.net` 等公网格式 FQDN 的
  明文 HTTP 配对地址不在本 spike 支持范围内，验收二维码必须使用 LAN IP。
- 当前没有 Noise 握手、设备信任、一次性配对票据、中继和正式威胁模型。
- 正式配对协议及完整安全层属于 M2 正批，本壳不能作为生产配对实现。
- `WKWebView` 使用持久化默认数据仓；语音采集由 iOS 原生层负责，不依赖 LAN HTTP 页面中的
  `navigator.mediaDevices.getUserMedia`。
- 双授权、真实麦克风转写、系统语音朗读、手势手感和局域网端到端链路仍需验收人在真机裁决。
- 这是开发签名 dogfood，不是 App Store 包，不得放入 GitHub Release。

拒绝或桥接丢失后的转写可在本机编辑、复制或确认丢弃；未丢弃前不能开始新录音。
空白编辑不会删除保留稿,恢复不会自动重发或跨 profile 提交。这仍是开发壳的本地保稿能力,
不重开 daemon 远程业务入口。真机语音/交互当前未验。

## 生成与模拟器构建

先安装 XcodeGen，然后在本目录执行：

```bash
xcodegen generate
xcodebuild \
  -project SayDo.xcodeproj \
  -scheme SayDo \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .build-simulator \
  CODE_SIGNING_ALLOWED=NO \
  build
```

测试必须按本机实际 available iPhone simulator 选择，不写死某代机型：

```bash
DEST="$(node ../../scripts/select-ios-simulator.mjs)"
xcodebuild \
  -project SayDo.xcodeproj \
  -scheme SayDo \
  -destination "$DEST" \
  -derivedDataPath .build-simulator \
  CODE_SIGNING_ALLOWED=NO \
  test
```

只构建并校验真机产物、不要求设备：

```bash
./build-and-install.sh --build-only
```

相机扫码与局域网连接需要真机验证。以下为历史 spike 验证记录,不是当前候选验收:
宿主当时 generic simulator build 为 `BUILD SUCCEEDED`；
available iPhone simulator 上 XCTest 为 `DesktopProfileTests` 13/13、`VoiceStateMachineTests`
9/9，合计 22/22 `TEST SUCCEEDED`。此后已新增 ownership/保稿测试,当前结果以本次证据为准。GitHub `ios-shell` 已接线但尚未实际运行。这不是 App Store
包，不得放入 GitHub Release。真机扫码与 LAN 待本轮真机复测。

## 真机构建与安装

连接并解锁恰好一台开发签名真机，确认 Xcode 已完成开发者签名准备后执行：

```bash
./build-and-install.sh
```

多台设备时必须显式指定，不会挑列表第一项：

```bash
./build-and-install.sh --device <id>
# 或: SAYDO_DEVICE=<id> ./build-and-install.sh
```

脚本用同一设备 identifier 绑定 `xcodebuild -destination id=...` 与 `devicectl install`，
并要求本次构建的 `.app` 通过 `codesign --verify --deep --strict`。零台、多台、
Offline/unauthorized 都会失败。真机推装由验收人执行；本施工会话不安装。待本轮真机复测。
