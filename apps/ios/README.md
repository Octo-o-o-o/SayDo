# SayDo iOS 壳

这是用于移动端评估的 SwiftUI 壳。它扫描桌面端生成的
`http://<ip>:<port>/?token=<token>`，在 `WKWebView` 中打开现有 SayDo 页面，并支持保存、
切换和删除多个桌面 profile。profile 元数据保存在 `UserDefaults`，token 单独保存在
Keychain，访问级别为 `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`。

原生语音层提供按住说话、实时转写、松手发送、上滑选择最近三项 Focus、滑出取消和回复
朗读。设备内中文识别不可用时不会静默联网；验收人可在桌面列表的“壳设置”中显式开启
联网中文识别，也可关闭回复朗读。

## Spike 边界

- 当前仅用于开发通道的 LAN + token 连接，要求手机和桌面在同一可达网络。
- 当前 ATS 例外只覆盖 LAN IP、无后缀主机名和 `.local`；`.ts.net` 等公网格式 FQDN 的
  明文 HTTP 配对地址不在本 spike 支持范围内，验收二维码必须使用 LAN IP。
- 当前没有 Noise 握手、设备信任、一次性配对票据、中继和正式威胁模型。
- 正式配对协议及完整安全层属于 M2 正批，本壳不能作为生产配对实现。
- `WKWebView` 使用持久化默认数据仓；语音采集由 iOS 原生层负责，不依赖 LAN HTTP 页面中的
  `navigator.mediaDevices.getUserMedia`。
- 双授权、真实麦克风转写、系统语音朗读、手势手感和局域网端到端链路仍需验收人在真机裁决。

## 生成与模拟器构建

先安装 XcodeGen，然后在本目录执行：

```bash
xcodegen generate
xcodebuild \
  -project SayDo.xcodeproj \
  -scheme SayDo \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .build-simulator \
  build

xcodebuild \
  -project SayDo.xcodeproj \
  -scheme SayDo \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -derivedDataPath .build-simulator \
  CODE_SIGNING_ALLOWED=NO \
  test
```

相机扫码与局域网连接需要真机验证；模拟器构建和单测只验证工程、Swift 编译及可测状态机。

## 真机构建与安装

连接并解锁真机，确认 Xcode 已完成开发者签名准备。脚本不内置设备名或设备 id，必须先导出
`SAYDO_IOS_DEVICE_ID`（`xcrun devicectl list devices` 给出的 CoreDevice id），同一变量同时用于
`xcodebuild -destination platform=iOS,id=...` 与 `devicectl --device`：

```bash
SAYDO_IOS_DEVICE_ID=00000000-0000-0000-0000-000000000000 ./build-and-install.sh
```

未设置该变量时脚本在任何 generate/build/install 之前以退出码 2 失败。真机推装由验收人执行；
施工自证不运行此脚本。
