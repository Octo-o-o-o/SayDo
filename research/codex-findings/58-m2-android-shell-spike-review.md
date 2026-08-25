# M2 spike:Android native 壳首版自审

> 日期:2026-08-12
> 基线:`feat/m2-ios-shell-spike` / `2439b0b2bf5d6297cc9ec1b8fec9054f51c4af0d`
> 评审对象:Android 代码提交
> `1f96f24369ecaee6cb6c1e6c182ec45a94d4aa1d`
> 范围:`apps/android/` 新增实现;未改 daemon/console/ios

## 结论

**Go(Android 壳与 Web UI 真机探针),No-Go(网页语音探针)。A=0,B=0,C=1。**

Gradle 工程、扫码解析、Keystore 包裹 token、多桌面切换、WebView、失败态、下拉刷新和真机
安装脚本均已落盘。独立 code review 首轮发现主文档 4xx/5xx 后 `onPageFinished` 会覆盖人话
失败页;回修后终审为 Go,A=0/B=0/C=1。唯一 C 级是扫码确认 Dialog 不恢复配置变更状态,
旋转发生在“确认桌面”页时需重扫;固定方向验收不受阻。

与 iOS 57 号自审相同,任务指定的 LAN IP 明文 HTTP 不是 Web secure context。原生
`WebChromeClient` 只能裁决 WebView 已发起的媒体权限请求,不能把 HTTP 页面提升为可信来源。
因此本壳可上真机评估页面滚动、交互、扫码和多桌面连接,但不能据此完成网页语音流畅度裁决。
关闭该边界需要在 M2 正批选择 HTTPS/可信本地入口或 native 采集桥,本批不代 owner 拍板。

## 独立评审 findings triage

一次只读 code-review subagent 初审发现 B=1,回修后终判 A=0/B=0/C=1。逐项处理如下:

- B-1 已关闭:`WebPanel.kt` 曾在主文档 4xx/5xx 或网络失败后显示人话失败页,但随后
  `onPageFinished` 无条件隐藏该页。现以 `mainFrameFailed` 在新导航/重试时重置、失败时置位,
  finish 只在未失败时隐藏错误层;最终构建与 lint 通过。
- C-1 保留:扫码结果到 profile 保存之间只存在于 `Dialog` 与 `EditText`;Activity 因旋转或其他
  配置变化重建时不恢复该中间状态,用户需重新扫描。它不损坏已保存 profile/token,也不阻断
  固定方向 spike 验收,本轮不扩大到完整状态恢复框架。

## 交付核对

- Gradle:固定 Gradle 8.11.1、AGP 8.9.1、Kotlin 2.2.21;包名
  `com.octoooo.saydo`,minSdk 26,targetSdk 34。直接 runtime 依赖仅
  `androidx.appcompat:appcompat:1.7.1` 与
  `com.journeyapps:zxing-android-embedded:4.3.0`;其余为二者的传递件。
- `DesktopProfile`:只接受带显式端口、无 userinfo、非空 token 的 HTTP URL;剥离全部 token
  query 和 fragment 后保存 base URL,加载时只拼回一个 percent-encoded token;默认名与 iOS
  同为 `host:port`。
- `ConnectionStore` 与 `TokenStore`:profile 元数据 JSON 只含 id/name/url;token 使用
  Android Keystore 中不可导出的 AES-GCM 密钥、随机 IV 加密后单独落 SharedPreferences。
  backup 与 device-transfer 规则排除全部 app 数据域,不把不可恢复密文跨设备迁移。
- `MainActivity`:首启扫码引导、扫码确认并改名、顶部 36 dp 薄工具条、底部桌面列表、添加、
  切换和删除齐全;profile 写入失败会回滚内存和 token 写入。
- `WebPanel`:JavaScript、DOM storage、持久化默认 WebView 数据、当前 profile 完整 origin 的
  相机/麦克风权限、下拉刷新、重试和固定人话失败态齐全;SSL 错误 fail-closed。
- Manifest:按 spike 合同显式 `usesCleartextTraffic=true`;相机、麦克风声明为非必需硬件;
  app backup 关闭并用新旧两套规则排除数据迁移。
- `build-and-install.sh`:依序运行 `./gradlew --no-daemon :app:assembleDebug`,再执行
  `adb -s 01234ABC install -r app/build/outputs/apk/debug/app-debug.apk`;本轮未执行安装。
- README 已如实记录 dev LAN+token、明文 HTTP、无 Noise、secure-context 阻断与 M2 正批边界。

## 实际验证

- `ANDROID_HOME=~/Library/Android/sdk ./gradlew --offline --no-daemon
  --console=plain clean :app:assembleDebug :app:lintDebug`:exit 0;45 个任务全部实际执行;输出
  `BUILD SUCCESSFUL in 19s`。lint 为 0 errors/5 warnings:1 个 `targetSdk 34` 旧目标提示是任务
  指定值,其余 4 个为可选 KTX 写法建议,无功能或安全 finding。
- `aapt dump badging app-debug.apk`:实际输出包名 `com.octoooo.saydo`,sdkVersion 26,
  targetSdkVersion 34,launchable activity `com.octoooo.saydo.MainActivity`,并含 CAMERA/INTERNET/
  RECORD_AUDIO 权限。
- APK 为 3,590,506 bytes,SHA-256
  `6adb928c17667214a3c74dee0cd0c2b8d0b3be79a56b7e7c50fe43046dd337a8`。
- 使用实际 `DesktopProfile.class` 编译运行独立 Java 探针:合法 URL 的 token 剥离/重建通过;
  HTTPS、缺端口、含 userinfo、缺 token 四类非法 URL 均拒绝;输出
  `[ok] pairing URL 与 token 剥离边界通过`。
- `bash -n apps/android/build-and-install.sh`:exit 0。安装命令未执行。
- `bash scripts/check-emoji.sh <apps/android 文本文件>`:输出 `[ok] emoji gate: clean`。
- 首个 Gradle 调用在受限沙箱内因 native dylib 无法加载而停止;切换沙箱外后,前两次构建又分别
  因未设置 Android SDK 路径、机器缺少 android-35 平台而未进入编译。显式使用已安装的
  android-36 compile platform 后,一次 offline 构建因缺少 AndroidX 传递件停止;联网补齐缓存后
  最终 offline 干净构建通过。上述失败均未伪报为代码或测试通过。
- 最终代码提交前 `git diff --cached --check`:exit 0,无输出。

## 未验证边界

- 未运行真机安装、扫码、LAN 导航、Android Keystore 读写、旋转行为和麦克风/相机采集;这些留给
  验收人。
- 未 push,未部署,未改 daemon/console/ios/canonical。
- APK 构建证明工程、资源和 Kotlin 可编译,不证明相机、局域网、Keystore 或 Web 媒体权限的
  真机行为。
