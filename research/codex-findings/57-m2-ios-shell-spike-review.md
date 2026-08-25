# M2 spike:iOS native 壳首版自审

> 日期:2026-08-12
> 基线:`main` / `197d4f1`
> 评审对象:`feat/m2-ios-shell-spike` 代码提交
> `660846c7571285bc5f22a6bd019f500ad17345d5`
> 范围:`apps/ios/` 新增实现;未改 daemon/console

## 结论

**No-Go(网页语音探针),Go(壳与 Web UI 真机探针)。A=1,B=0,C=0。**

XcodeGen 工程、扫码解析、Keychain token、多桌面切换、WebView、失败态和真机安装脚本均已
落盘并通过模拟器构建。唯一 A 级不是编译问题:任务指定的 LAN IP 明文 HTTP 不是 Web secure
context,因此现有 console 的 `navigator.mediaDevices.getUserMedia` 预计不会暴露。原生
`WKUIDelegate` 返回 `.grant` 只能裁决 WebKit 已交给 app 的媒体权限请求,不能把 HTTP 页面提升为
secure context。

这意味着本壳可上真机评估页面滚动、交互与多桌面连接,但不能据此完成 owner 要求的网页语音
流畅度裁决。关闭 A 级需要在 M2 正批选择 HTTPS/可信本地入口或 native 采集桥;三者都会改变
当前连接架构或越过“本批不改 daemon/console”的范围,本批不代 owner 拍板。

## A 级开放项

### A-1:LAN HTTP 下 `getUserMedia` 不成立

代码证据:

- `apps/ios/SayDo/DesktopProfile.swift:18` 依任务合同只接受 `http` 配对 URL。
- `packages/console/src/voice/useVoiceChannel.ts:235` 实际通过
  `navigator.mediaDevices.getUserMedia` 采集麦克风。
- `apps/ios/SayDo/WebContainer.swift:139` 实现原生媒体权限 delegate,并在
  `WebContainer.swift:144` 按 protocol/host/port 限定当前 profile origin。

一手依据:

- WebKit [bug 220184](https://bugs.webkit.org/show_bug.cgi?id=220184) 记录 WKWebView 的
  `getUserMedia` 原先只在 HTTPS 暴露,后续修复面向 app bundle/custom scheme 的 secure
  context,不是把任意 LAN HTTP 变为可信来源。
- WebKit [bug 252303](https://bugs.webkit.org/show_bug.cgi?id=252303) 明确以 secure context
  要求解释非安全来源上 `MediaDevices` 不存在。
- Apple 的
  [WKUIDelegate 媒体权限 API](https://developer.apple.com/documentation/webkit/wkuidelegate/webview%28_%3Arequestmediacapturepermissionfor%3Ainitiatedbyframe%3Atype%3Adecisionhandler%3A%29)
  只定义对给定 security origin 的设备访问裁决。

最小真机反例:扫描 `http://<LAN-IP>:47100/?token=...`,在 Web Inspector 检查
`window.isSecureContext` 与 `navigator.mediaDevices`,再触发现有麦克风入口。预期前者为
`false`,后者缺失或采集被拒;最终状态必须由验收人真机记录,本轮未伪造运行结果。

## 独立评审 findings triage

一次只读 code-review subagent 初审结论为 No-Go:A=1,B=2,C=1,未修改文件。逐项处理如下:

- A-1 保持开放,原因与决策边界见上。
- B-1:现有 `pairUrl.ts` 可从配置生成 `.ts.net` FQDN,而
  `NSAllowsLocalNetworking` 只覆盖 IP、无后缀主机名和 `.local`。本任务配对格式明确为 LAN
  IP,README 已写明验收二维码必须使用 LAN IP、FQDN 不在本 spike 范围。Apple
  [NSAllowsLocalNetworking 文档](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)
  支持该边界判断。按已批 spike 范围关闭为 B=0,不扩大 ATS 全局例外。
- B-2:失败态全屏遮罩曾挡住底层下拉刷新;`WebContainer.swift:55` 已设
  `isUserInteractionEnabled=false`,失败后恢复桌面服务可原地拉动重试。
- C-1:媒体权限曾只比 host/port;`WebContainer.swift:25,88,144` 已补 protocol,按完整
  security origin 三元组裁决。

## 交付核对

- `project.yml`:SayDo、`com.octoooo.saydo`、iOS 17、SwiftUI、Automatic、team
  `5CS6HUB4P2` 及四项 Info.plist 配置齐全;XcodeGen 生成的 `SayDo/Info.plist` 同步落盘。
- `DesktopProfile` 与 `ConnectionStore`:profile 元数据进 `UserDefaults`;自定义 Codable 不编码
  token;token 按 profile id 进 Keychain,使用
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`。
- `ScannerView`:AVFoundation QR 扫码;只接受带显式端口和非空 token 的 HTTP URL;拒绝 HTTPS、
  用户信息、缺端口和缺 token;默认名为 host:port,保存前可编辑。
- `WebContainer`:持久化 website data store、inline media、无用户动作 autoplay 限制、当前
  origin 媒体权限、下拉刷新及固定人话失败态齐全。
- `RootView`:无 profile 引导;有 profile 显示 36 pt 顶栏;sheet 可切换、添加和删除多个桌面。
- `build-and-install.sh`:依序运行 XcodeGen、指定 `<account>` 真机构建,再按指定 CoreDevice
  UUID 安装 `Debug-iphoneos/SayDo.app`;本轮未执行脚本。
- README 已如实记录 dev LAN+token、无 Noise、FQDN 限制、HTTP secure-context 阻断与 M2
  正批边界。

## 实际验证

- `xcodegen generate`:exit 0;输出 `Created project at .../apps/ios/SayDo.xcodeproj`。
- `xcodebuild -project SayDo.xcodeproj -scheme SayDo -configuration Debug -destination
  'generic/platform=iOS Simulator' -derivedDataPath /tmp/saydo-ios-spike-derived build`:exit 0;
  输出 `** BUILD SUCCEEDED **`。初次受限沙箱调用因 SwiftUI macro plugin 被
  `sandbox-exec` 拒绝;按权限流程在沙箱外执行同一构建后成功,不把前者伪报成代码失败。
- `xcodebuild ... -showBuildSettings`:实际输出
  `CODE_SIGN_STYLE=Automatic`,`DEVELOPMENT_TEAM=5CS6HUB4P2`,
  `IPHONEOS_DEPLOYMENT_TARGET=17.0`,`PRODUCT_BUNDLE_IDENTIFIER=com.octoooo.saydo`,
  `SWIFT_VERSION=5.0`。
- `plutil -lint SayDo/Info.plist`:输出 `SayDo/Info.plist: OK`。
- 使用实际 `DesktopProfile.swift` 编译运行独立探针:合法 URL 解析/重建通过;四类非法 URL 拒绝;
  JSON 不含 token;输出 `[ok] pairing URL 与 token 编码边界通过`。
- `bash -n apps/ios/build-and-install.sh`:exit 0;`devicectl device install app --help` 确认
  `--device <identifier> <path>` 参数顺序。
- 最终 `git diff --cached --check`:exit 0,无输出。

## 未验证边界

- 未运行真机构建、安装、扫码、LAN 导航和麦克风采集;这些留给验收人。
- 未 push,未部署,未改 daemon/console/canonical。
- 模拟器构建证明工程与 Swift API 可编译,不证明相机、局域网、Keychain 或 Web 媒体权限的
  真机行为。
