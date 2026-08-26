# 三端移动壳真机构建与装机 · 证据(2026-08-22)

> 性质:**构建与装机层证据**,不是功能验收。这些壳是 WebView/原生语音薄壳,真正的四页烟测
> (Dashboard/任务/审批/review + 批一条 S2 + 点 S3 见拒绝话术)仍是 owner 触点,见 `HANDOFF.md` §2-12。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做。
> 本文件不记录设备 ID、证书密码、token、私钥、本地安装 URL 或个人目录。路径只用
> `$HOME` 与 `<repo>` 占位。

## 1. 设备现场

| 端 | 设备类别 | 标识 | 状态 |
|---|---|---|---|
| iOS | 1 台物理 iPhone | (省略) | [ok] connected / pairingState=paired |
| Android | 1 台 USB 平板(当时在线) | (省略) | [ok] device(usb)；当前无在线设备证据 |
| HarmonyOS | 1 台物理目标曾出现 | (省略) | [warn] 会话中途掉线,`hdc list targets` 连续三次空列表 |

## 2. 构建与装机结果

| 端 | 命令 | 结果 |
|---|---|---|
| iOS | `bash apps/ios/build-and-install.sh` | [ok] exit 0;`BUILD SUCCEEDED`;`App installed` bundleID `com.octoooo.saydo` |
| Android | `ANDROID_HOME=$HOME/Library/Android/sdk bash apps/android/build-and-install.sh` | [ok] exit 0;`BUILD SUCCESSFUL`;Streamed Install `Success` |
| Android 拉起 | `adb shell am start -n com.octoooo.saydo/.MainActivity` | [ok] 应用在当时真机前台 |
| HarmonyOS | `hvigorw assembleHap` | [warn] exit 0 但**未签名**:`WARN: No signingConfig found for product default`,只产出 unsigned HAP |
| HarmonyOS 装机 | — | [fail] **未做**:设备离线 + HAP 未签名。owner 本轮裁决「先只出 HAP 包不装机」 |

## 3. 首跑失败与修正(如实)

Android 首次执行 `build-and-install.sh` **失败**(exit 1):缺少 SDK 位置(`ANDROID_HOME` 未导出,
`<repo>/apps/android/local.properties` 不入仓)。补 `ANDROID_HOME=$HOME/Library/Android/sdk`
后成功。安装器现已自检 SDK。

## 4. 边界(不得外推)

1. [fail] **未做功能验收**:未连桌面服务、未扫码配对、未跑四页烟测、未过一条 S2、未点 S3 看拒绝话术。
   「装上了并能拉起」不等于「壳能用」。
2. [warn] iOS 侧无法在本会话内驱动物理设备做交互验证(模拟器工具不驱真机),iOS 的结论只到「装机成功」。
3. [warn] HarmonyOS 签名需 owner 用 DevEco 自动签名填 `build-profile.json5`,本会话不代签。
4. 这三个壳仍是 spike 边界(见 `apps/ios/README.md`「Spike 边界」):LAN + token,无 Noise 握手/设备信任/
   一次性配对票据,不能当生产配对实现。

## 5. 2026-08-24 rc.4 移动端回修复核

- 代码提交：`36a445092cdca24f83a57152252fd432a136b5da`（本文件记录该 SHA，不自指）。
- 共享解析语料：`node scripts/test-pairing-url-corpus.mjs` 为当时会话计数；三端生成 fixture
  与源 JSON 同字节语义。
- 安装/发布门禁：`node scripts/test-mobile-release-contract.mjs` 与
  `node scripts/test-mobile-installers.mjs` 当时均为退出码 0。
- 原生测试：Android unit test 当时全绿；iOS Simulator XCTest 当时 22/22；HarmonyOS
  `hvigorw test` **13/13 仅在 cached-exact 依赖环境**(本机已由 ohpm 正式安装且 lock 匹配的
  store)。fresh clone 当前会因 `@ohos/hypium` / OhmUrl 解析失败以 exit 255 结束、**无测试计数**,
  不得表述成 fresh reproducibility。
- 其他门禁：`pnpm typecheck`、`pnpm lint`、emoji、diff-check 当时均为退出码 0。
- 设备状态只记结论、不记标识：当时 iOS 物理机可配对；HarmonyOS 曾见 1 台物理目标；Android
  当前无在线设备。签名与真机交互测试仍按后续发布阶段单独记账。
- 本轮口径：HarmonyOS `hdc list targets` 非空目标数 0，无在线目标证据，未安装。2026-08-22
  的历史 1 台不作为本轮在线证明。
