# SayDo Android 壳 spike

这是用于 Android 真机流畅度评估的最小 Kotlin 壳。它扫描桌面端生成的
`http://<ip>:<port>/?token=<token>`，在 `WebView` 中打开现有 SayDo 页面，并支持保存、
切换和删除多个桌面 profile。profile 元数据保存在 `SharedPreferences`；token 从 URL 中剥离，
经 Android Keystore 中的 AES-GCM 密钥加密后单独保存，不会以明文进入 profile 元数据。

工程包名为 `com.octoooo.saydo`，`minSdk 26`、`targetSdk 34`。运行时依赖仅有 AndroidX
AppCompat 和 zxing-android-embedded；扫码之外的 UI、下拉刷新和 Keystore 封装均使用平台 API。

## Spike 边界

- 当前仅用于开发通道的 LAN + token 连接，要求手机和桌面在同一可达网络；验收二维码使用
  LAN IP 和显式端口。
- 当前按任务要求设置 `android:usesCleartextTraffic="true"`，允许加载明文 HTTP。这是 spike
  的如实风险，不是生产安全配置。
- 当前没有 Noise 握手、设备信任、一次性配对票据、中继和正式威胁模型。
- 正式配对协议及完整安全层属于 M2 正批，本壳不能作为生产配对实现。
- `WebView` 只把相机和麦克风权限放给当前 profile 的同源页面。但 LAN IP 的明文 HTTP 不是
  Web secure context，现有页面的 `navigator.mediaDevices.getUserMedia` 预计不可用；本版可以
  评估真机 Web UI 流畅度，不能据此完成网页语音流畅度裁决。打通该探针需要 HTTPS/可信本地
  入口或 native 采集桥，归 M2 正批决策。

## 本机构建

准备 JDK 17 和 Android SDK 后，在本目录执行：

```bash
./gradlew --no-daemon :app:assembleDebug
```

APK 输出到 `app/build/outputs/apk/debug/app-debug.apk`。本机构建只验证 Gradle 工程、资源和
Kotlin 编译，不证明相机扫码、局域网导航、Android Keystore 或 Web 媒体权限的真机行为。

## 真机构建与安装

连接并解锁序列号为 `01234ABC` 的验收设备后执行：

```bash
./build-and-install.sh
```

脚本会先运行 `assembleDebug`，再执行 `adb -s 01234ABC install -r`。真机推装由验收人执行；
施工自证不运行安装脚本。
