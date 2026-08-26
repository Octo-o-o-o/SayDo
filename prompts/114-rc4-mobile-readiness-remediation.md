# rc.4 移动端可复现性、诚实口径与真机入口实施单

你是全新的 Grok 实施会话。工作区：

`<repo>`

基线提交：`e22be466b206002fd5ab270d41471f7cbc72bc5e`。

先完整读取仓库 `AGENTS.md`、三端 README/构建脚本、移动工程、`docs/release/`、官网 Docs 源稿及
中英文静态页、`.github/workflows/ci.yml`。本轮只修可判定问题；不得声称离线设备已安装、缺失签名
材料已具备、商店包已可发布。不得读取或打印真实设备标识、证书密码、token、私钥或个人目录。
不提交、不推送、不发布、不部署。

## 已冻结事实与边界

- iOS simulator build/test、开发签名 device build/archive 已通过；开发真机当前可连，但本实施会话
  不得安装。它仍是开发签名 dogfood，不是 App Store 包。
- Android 本机构建仅在 SDK 路径显式注入时通过；没有在线 adb 设备，release 默认 unsigned，测试
  目前 `NO-SOURCE`。`compileSdk=36` 但 `targetSdk=34`；官方已声明 2026-08-31 起新应用/更新需
  API 36，因此本轮直接对齐 36，但不得因此宣称已满足全部 Play 审核要求。
- HarmonyOS unsigned HAP/APP 可构建；`hvigorw test` 因缺测试入口失败；目标设备当前 Offline；
  发布证书/P12 不等于签名 Profile，当前缺 SayDo Profile，只能如实停在 unsigned。
- 三端均是 LAN+token spike，缺 Noise、设备信任、一次性配对票据与完整威胁模型，当前明文 LAN
  例外不能包装成生产安全配对。

## 1. 三端安装脚本必须可复现且零私有标识

重做 `apps/{ios,android,harmonyos}/build-and-install.sh`：

- 仓库中不得硬编码真实或占位设备 serial、UDID、设备名、个人账号名、个人 home 绝对路径。
- 每端支持显式环境变量或 `--device <id>`；未显式指定时，从平台工具读取设备列表，必须恰好一个
  `connected/online/available` 真机才继续。零台、多台、Offline/unauthorized 必须 fail-closed，
  输出只给用户可操作说明，不能选择列表第一项碰运气。
- iOS 用同一解析出的 device identifier 同时绑定 `xcodebuild -destination id=...` 与
  `devicectl install`；Android 用同一 serial 绑定 `adb -s`；Harmony 用同一 target 绑定 `hdc -t`。
- Android 自动解析 SDK：优先已有 `ANDROID_HOME`/`ANDROID_SDK_ROOT`，其次项目 `local.properties`
  的 `sdk.dir`，再检查各系统标准 SDK 目录；找到后显式使用其 `platform-tools/adb`，不依赖 PATH。
- Harmony 的 DevEco/HDC/Hvigor 路径继续可由环境注入；只接受本次构建后更新的 signed HAP。
  unsigned 或 Profile 缺失必须 exit non-zero，不能改成手工临时签名后冒充发布包。
- iOS 只安装本次构建后更新且 `codesign --verify --deep --strict` 通过的 `.app`。
- 增加 `--build-only`（或等价明确模式），只构建/验证产物、不要求设备；默认仍是 build+install。
- 新增仓库级确定性安装器自测，使用临时 fake 工具验证零/一/多/离线设备、显式设备不存在、
  stale/unsigned 产物、正确 `-s/-t/id=` 绑定。测试不得接触真机或真实设备列表。

## 2. Android 最小质量闭环

- `targetSdk=36`，README 与实际一致；`minSdk=26` 不变。
- 为纯 JVM 可测的 `DesktopProfile` 配对 URL/token 逻辑增加单元测试，至少覆盖：合法 IPv4/IPv6
  私网地址、token percent encode/decode、重复 token、userInfo、缺 port、非 HTTP、额外不允许参数、
  malformed percent encoding。若实现当前错误，先按 iOS/Harmony 既有安全合同收紧实现再测。
- `:app:testDebugUnitTest` 必须真实执行且不再 `NO-SOURCE`；`lintDebug`、`assembleDebug` 通过。
- 不把本机 upload keystore 或密码写入 Gradle。release 未接线签名继续在版本矩阵中标 No-Go；
  Debug 真机 dogfood 与 Play 可发布包明确分开。

## 3. HarmonyOS 测试入口与构建卫生

- 增加 Hvigor/Hypium 所需的 `entry/src/test/List.test.ets` 聚合入口和至少一组实际纯逻辑测试，
  优先覆盖 `DesktopProfile` 的 IP/URL/token 校验；不能只写 `1 + 1` 占位测试。
- `hvigorw test --no-daemon` 必须在当前 DevEco SDK 上通过；若平台本地测试不支持某 kit，把纯函数
  抽到不依赖 kit 的模块再测，产品行为不弱化。
- `.gitignore` 覆盖 Hvigor test/assemble 产生的 root `build/`、`entry/.test/` 等可重生产物。
- 签名 config 继续无密钥占位且 product 不引用；README 明确 Profile 缺失、unsigned 不能安装。

## 4. 版本 SoT 与官网诚实对齐

- 创建 `docs/release/release-profile.yaml` 已指向的 `docs/release/version-matrix.md`，记录 desktop CLI
  与三端壳的版本号、build code、签名状态、自动测试、真机证据、可分发性和下一阻断；不写设备 ID。
- 将三端壳版本统一为 `0.1.0 (1)`；CLI 仍是 `0.1.0-rc.4`，不得改桌面 tag/version。
- 官网首页目前“移动 App 开发中、无下载版本”是正确口径，保留。
- 修正 Docs 源稿及中英文静态 Docs 页：把“局域网手机面（浏览器/壳）现在可用”拆为：
  手机浏览器 dogfood 可用；iOS 壳仅开发签名候选且待最终真机复测；Android 壳仅构建/单测候选且无
  当前设备证据；Harmony 壳仅 unsigned build/test 候选、Profile/在线设备缺失。
- 所有页面继续明确 App 未上架、无公开下载；不得把开发签名包或 unsigned 包放进 GitHub Release。

## 5. CI 可见性

- 在 `.github/workflows/ci.yml` 增加真实 Android shell job：JDK 17、API 36，运行 unit test、lint、
  assembleDebug；复用已固定 SHA 的 checkout，新增 action也必须固定完整 commit SHA。
- 增加真实 iOS shell job：在 macOS runner 生成 Xcode 工程、无签名 simulator build 并运行现有
  XCTest。模拟器必须按运行时实际可用设备确定性选择，不硬编码某代 iPhone。
- HarmonyOS 因 DevEco/签名 Profile 无标准 GitHub runner，不能加假绿 job；在 CI/版本矩阵中明确
  只能由本机门禁，并确保仓库级安装器/文档一致性自测仍会在 Node job 运行。
- CI 增加三端版本/安装器合同自测，验证 target、版本、无硬编码设备、Docs 状态映射；不得抽样。

## 6. 本轮门禁

先跑新增直接反例，再真实运行并报告退出码：

```sh
bash -n apps/ios/build-and-install.sh apps/android/build-and-install.sh apps/harmonyos/build-and-install.sh
node scripts/test-mobile-installers.mjs
env ANDROID_HOME=<探测到的SDK> ANDROID_SDK_ROOT=<同一SDK> apps/android/gradlew --no-daemon -p apps/android :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
cd apps/ios && xcodegen generate && xcodebuild -project SayDo.xcodeproj -scheme SayDo -destination 'generic/platform=iOS Simulator' -derivedDataPath .build-simulator CODE_SIGNING_ALLOWED=NO build
# 选择本机实际 available iPhone simulator 后运行 XCTest，不写死名称。
cd apps/harmonyos && env DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw test --no-daemon
cd apps/harmonyos && env DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw assembleHap --no-daemon
actionlint .github/workflows/*.yml
pnpm typecheck
pnpm lint
node scripts/check-doc-links.mjs
bash scripts/check-emoji.sh
git diff --check
```

尖括号只是说明，不得照抄执行。若工具或设备缺失，区分“工程失败”和“外部阻断”；工程可修的继续修，
离线设备/Profile 缺失只如实记录，绝不伪造通过。交付列出改动、三端状态矩阵、真实命令/退出码和
仍待宿主真机执行的明确项；实施自报不构成验收。
