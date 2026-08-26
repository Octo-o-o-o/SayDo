# SayDo Android 壳 spike

这是用于 Android 真机流畅度评估的最小 Kotlin 壳。它扫描桌面端生成的
`http://<ip>:<port>/?token=<token>`，在 `WebView` 中打开现有 SayDo 页面，并支持保存、
切换和删除多个桌面 profile。profile 元数据保存在 `SharedPreferences`；token 从 URL 中剥离，
经 Android Keystore 中的 AES-GCM 密钥加密后单独保存，不会以明文进入 profile 元数据。

工程包名为 `com.octoooo.saydo`，版本 `0.1.0 (1)`，`minSdk 26`、`compileSdk 36`、`targetSdk 36`。
`targetSdk=36` 只表示目标 API 已对齐，不表示已满足全部 Play 审核要求。运行时依赖仅有
AndroidX AppCompat 和 zxing-android-embedded；扫码之外的 UI、下拉刷新和 Keystore 封装均使用
平台 API。

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
./gradlew --no-daemon :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

或只构建并校验产物、不要求设备：

```bash
./build-and-install.sh --build-only
```

APK 输出到 `app/build/outputs/apk/debug/app-debug.apk`。本机构建只验证 Gradle 工程、资源、
Kotlin 编译和 `DesktopProfile` 单测，不证明相机扫码、局域网导航、Android Keystore 或 Web
媒体权限的真机行为。Gradle 不读取本机 upload keystore；release 默认 unsigned，Debug 真机
dogfood 不是 Play 可发布包，不得放入 GitHub Release。

安装脚本解析 SDK 的顺序：`ANDROID_HOME`、`ANDROID_SDK_ROOT`、本目录 `local.properties` 的
`sdk.dir`、各系统标准 SDK 目录。`--build-only` 只需要 SDK 目录给 Gradle，不要求
`platform-tools/adb`。安装时才使用该 SDK 的 `adb`，不依赖 PATH。

## 真机构建与安装

连接并解锁恰好一台已授权真机后执行：

```bash
./build-and-install.sh
```

多台设备时必须显式指定，不会挑列表第一项：

```bash
./build-and-install.sh --device <serial>
# 或: SAYDO_DEVICE=<serial> ./build-and-install.sh
```

零台、多台、Offline/unauthorized 都会失败。真机推装由验收人执行；本施工会话不安装。
当前无在线 adb 设备证据。

Debug 签名使用本目录 `debug.keystore`(已 gitignore)。跨 clone 会各自生成,签名不一致。
若 `adb install` 提示签名冲突,需用户显式卸载已装包,或自行提供稳定的本地 debug
keystore;安装器不会自动卸载用户 App。不要把 keystore 或密码提交进仓库。
`--build-only` 会在成功前提示同一约束。
