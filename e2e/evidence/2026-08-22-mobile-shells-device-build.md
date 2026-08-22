# 三端移动壳真机构建与装机 · 证据(2026-08-22)

> 性质:**构建与装机层证据**,不是功能验收。这些壳是 WebView/原生语音薄壳,真正的四页烟测
> (Dashboard/任务/审批/review + 批一条 S2 + 点 S3 见拒绝话术)仍是 owner 触点,见 `HANDOFF.md` §2-12。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做。

## 1. 设备现场

| 端 | 设备 | 标识 | 状态 |
|---|---|---|---|
| iOS | iPhone Air(iPhone18,4) | `BF884EAE-6CC0-55A1-9A5F-D0DADCB6089C` | [ok] connected(physical) |
| Android | 联想 TB350XC(平板) | `01234ABC` | [ok] device(usb) |
| HarmonyOS | — | `5KLBB25B07200565` | [warn] 会话中途掉线,`hdc list targets` 连续三次 `[Empty]` |

**更正一条**:`apps/android/build-and-install.sh` 里的 `adb -s 01234ABC` 此前被我判为占位符,
实测 `adb devices -l` 显示该串就是该设备的真实序列号,脚本无需改。

## 2. 构建与装机结果

| 端 | 命令 | 结果 |
|---|---|---|
| iOS | `bash apps/ios/build-and-install.sh` | [ok] exit 0;`** BUILD SUCCEEDED **`;`App installed` bundleID `com.octoooo.saydo`,installationURL `file:///private/var/containers/Bundle/Application/2C732E25-.../SayDo.app/` |
| Android | `ANDROID_HOME=~/Library/Android/sdk bash apps/android/build-and-install.sh` | [ok] exit 0;`BUILD SUCCESSFUL in 16s`;`Performing Streamed Install` → `Success` |
| Android 拉起 | `adb shell am start -n com.octoooo.saydo/.MainActivity` | [ok] `topResumedActivity=ActivityRecord{... com.octoooo.saydo/.MainActivity}`,应用在真机前台 |
| HarmonyOS | `hvigorw assembleHap` | [warn] exit 0 但**未签名**:`WARN: No signingConfig found for product default`,只产出 `entry-default-unsigned.hap`(1769308 bytes) |
| HarmonyOS 装机 | — | [fail] **未做**:设备离线 + HAP 未签名。owner 本轮裁决「先只出 HAP 包不装机」 |

## 3. 首跑失败与修正(如实)

Android 首次执行 `build-and-install.sh` **失败**(exit 1):

```
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable
or by setting the sdk.dir path in your project's local properties file at
'/Users/wangyixiao/WorkSpace/SayDo/apps/android/local.properties'
```

根因 = 环境未导出 `ANDROID_HOME`,`local.properties` 不入仓(本机产物)。补 `ANDROID_HOME=~/Library/Android/sdk`
后成功。**登记为可用性缺口**:`apps/android/build-and-install.sh` 未自检 SDK 位置也未给处方,
换机/换会话会重踩。修复归后续批(不在本轮范围)。

## 4. 边界(不得外推)

1. [fail] **未做功能验收**:未连桌面服务、未扫码配对、未跑四页烟测、未过一条 S2、未点 S3 看拒绝话术。
   「装上了并能拉起」不等于「壳能用」。
2. [warn] iOS 侧无法在本会话内驱动物理设备做交互验证(模拟器工具不驱真机),iOS 的结论只到「装机成功」。
3. [warn] HarmonyOS 签名需 owner 用 DevEco 自动签名填 `build-profile.json5`,本会话不代签。
4. 这三个壳仍是 spike 边界(见 `apps/ios/README.md`「Spike 边界」):LAN + token,无 Noise 握手/设备信任/
   一次性配对票据,不能当生产配对实现。
