# SayDo 版本矩阵

> 本文件是 `docs/release/release-profile.yaml` 的 `version_sot`。记录 desktop CLI 与三端壳的版本号、签名、自动测试、真机证据、可分发性与下一阻断。
> 不写设备 ID、证书密码、token、私钥或个人目录。实施自报不构成验收。
> 更新:2026-08-23。CLI 仍为 `0.1.0-rc.4`，不得改桌面 tag/version。三端壳统一 `0.1.0 (1)`。

## 1. 当前坐标

| 面 | 版本 | build code | 签名状态 | 自动测试 | 真机证据 | 可分发性 | 下一阻断 |
|---|---|---|---|---|---|---|---|
| Desktop CLI | `0.1.0-rc.4` | 见 `docs/release/v0.1.0-rc.4-assets.json` | 不适用(npm tgz) | Node/Python CI + 分发核验 | 桌面三系统发布核验(见 rc.4 记录) | GitHub Release 候选;不是移动包 | 不在本轮范围 |
| iOS 壳 | `0.1.0` | `1` | 开发签名;不是 App Store 分发签名 | 宿主本机 generic simulator `BUILD SUCCEEDED`;available simulator XCTest `DesktopProfileTests` 13/13、`VoiceStateMachineTests` 9/9，合计 22/22 `TEST SUCCEEDED`。GitHub `ios-shell` 已接线但尚未实际运行 | 开发真机此前可连;本轮实施会话未安装,待宿主最终真机复测 | **No-Go**:不得进商店,不得进 GitHub Release;未上架,无公开下载 | 生产配对/信任层;商店签名与 Profile;宿主真机复测 |
| Android 壳 | `0.1.0` | `1` | Debug 可安装;release 默认 unsigned,Gradle 未接线 upload keystore | `:app:testDebugUnitTest` + `lintDebug` + `assembleDebug`;GitHub Android job | **无当前设备证据**(无在线 adb 真机) | **No-Go**:Debug dogfood ≠ Play 可发布包;不得进 GitHub Release | 在线真机证据;Play upload 签名接线;生产配对。`targetSdk=36` 只满足目标 API 对齐,不宣称已满足全部 Play 审核要求 |
| HarmonyOS 壳 | `0.1.0` | `1` | unsigned;仓库签名 config 无密钥占位且 product 不引用。发布证书/P12 **不等于** 签名 Profile,当前缺 SayDo Profile | 测试入口已接线。fresh dependency hydration 目前被上游 502 阻断;手工复制 SDK 目录的 OhmUrl 红灯不是有效安装。此前 12/12 为**实施自报、未独立验收**。`hvigorw test` **13/13 仅 cached-exact 依赖环境**(ohpm 正式安装且 lock 匹配的本机 store)。fresh clone 当前因 `@ohos/hypium` / OhmUrl 解析失败 exit 255、无测试计数,不得表述成 fresh reproducibility。因上游当前不可 fresh hydrate,仍不得把 Harmony job 宣称为可复现 CI 绿。GitHub 无 Harmony job,只能本机门禁。unsigned assembleHap 绿不等于测试绿 | 2026-08-22 曾出现物理目标;本轮无在线目标证据(hdc list targets 非空目标数 0);签名 Profile/signed HAP 缺失,尚未安装 | **No-Go**:unsigned HAP 不能安装到要求签名一致的真机;未上架,无公开下载;不得进 GitHub Release | SayDo 签名 Profile;签名真机包;生产配对;ohpm 源可 fresh hydrate 后再谈可复现测试 |

共同边界:三端均是 LAN + token spike。没有 Noise、设备信任、一次性配对票据与完整威胁模型。明文 LAN 例外不能包装成生产安全配对。App 未上架,无公开下载。

## 2. 工程坐标

| 项 | 值 |
|---|---|
| bundle / applicationId / bundleName | `com.octoooo.saydo` |
| Android `minSdk` | `26` |
| Android `compileSdk` / `targetSdk` | `36` / `36` |
| iOS deployment target | `17.0` |
| HarmonyOS compatible/target | `6.0.2(22)` |
| 安装脚本 | `apps/{ios,android,harmonyos}/build-and-install.sh`;未指定设备时必须恰好一台 connected/online/available 真机 |
| 安装器自测 | `node scripts/test-mobile-installers.mjs`(fake 工具,不接触真机) |
| 配对 URL corpus | `scripts/pairing-url-corpus.json`;`node scripts/test-pairing-url-corpus.mjs` |
| 合同自测 | `node scripts/test-mobile-release-contract.mjs` |

## 3. CI 可见性

| Job | 跑什么 | 不跑什么 |
|---|---|---|
| `node` | 既有 Node 门禁 + 安装器自测 + 三端版本/文档合同自测 | 真机安装 |
| `android-shell` | JDK 17、API 36、unit test、lint、assembleDebug | release 签名、真机 |
| `ios-shell` | XcodeGen、无签名 simulator build、按运行时 available iPhone 跑 XCTest | 真机、开发签名安装 |
| HarmonyOS | 无 GitHub job | DevEco/HAP 只能本机门禁 |

## 4. 明确不做的宣称

- 不得声称离线设备已安装、缺失签名材料已具备、商店包已可发布。
- 不得把开发签名包或 unsigned 包放进 GitHub Release。
- `targetSdk=36` 不是 Play 审核通过。
- 有发布证书不等于有 HarmonyOS 签名 Profile。
