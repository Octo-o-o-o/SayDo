# RC4 移动端首次实施后的宿主门禁回传

继续 resume 同一 Grok 实施会话 `<session-id>`，在当前 worktree 修复。不要新开分支，不要提交、推送、发布、部署或安装真机。先重读 prompt 114、当前 diff 和本文件。

宿主已真实通过：安装器 43 项、release contract 51 项、bash syntax、actionlint、doc links、emoji、diff-check。以下是代码 readback 发现的可判定红灯，必须批量修复后重跑门禁。

## P1-1：`--build-only` 仍错误依赖设备工具

- Android 在任何模式都先 `resolve_android_sdk()`，而该函数只接受存在 `platform-tools/adb` 的 SDK；这使 build-only 仍依赖 adb。
- Harmony 在任何模式都先 `resolve_hdc()`；这使 build-only 即使只想构建/验证 signed HAP，也必须安装 hdc。
- prompt 114 的合同是 build-only 只构建/验证产物、不要求设备。设备枚举和设备安装工具必须延迟到非 build-only 路径。

修复：Android 将“找到 Gradle 可用 SDK root”和“安装时要求该 SDK 的 adb”分开；Harmony 只在安装分支解析 hdc。新增 fake 反例，明确在 adb/hdc 缺失或不可执行时 build-only 仍可完成构建验证；默认安装仍 fail-closed。

## P1-2：iOS percent decode 明确 off-by-one

`PairingPercentCoding.decode` 当前从 `%` 只 offset 2，并取 `afterPercent..<next`，范围只有一个 hex 字符；合法 `%2F`、`%20` 都会因 `hex.count != 2` 被拒，现有 XCTest 本应抓住，但本机 XCTest 尚未真正运行。

修复为严格消费 `%` 后两个 hex 字符并把 index 移到第三个字符之后；保留 malformed 和非法 UTF-8 fail-closed。补直接测试，至少验证 `%2F`、`%20`、`%2B` 和多字节 UTF-8 round-trip。

## P1-3：Harmony profile ID 行为被弱化

基线 `DesktopProfile.ets` 使用 `cryptoFramework.createRandom().generateRandomSync(16)`；当前为了抽纯逻辑把它改成 `Date.now()+进程内序号`，重启/并发时可碰撞，违反 prompt 114“抽纯函数但产品行为不弱化”。

恢复产品 `DesktopProfile` 的加密随机 16-byte ID；纯 parser 继续留在无 kit 的 `pairingUrl.ets` 供 Hypium 测试。不得把随机依赖重新塞进纯 parser。

## P1-4：三端 token/IPv6 解析必须一致

- Android `String(bytes, UTF_8)` 会用 replacement character 接纳非法 UTF-8；改为严格 decoder，malformed/unmappable 必须抛统一校验错误。
- Harmony `utf8FromBytes` 没验证 continuation byte、overlong/surrogate，且不支持合法四字节 UTF-8；改成严格 UTF-8 decode，合法非 BMP token 可 round-trip，非法/overlong/surrogate/truncated 全拒。
- Harmony 手写 authority 当前可能接受无方括号 IPv6 + port；与 iOS/Android 对齐，只接受 `[ULA]:port`。
- 三端测试补合法 Unicode token 与 `%C0%AF`、`%ED%A0%80`、截断序列等反例；若 iOS `URL(string:)` 在构造阶段已拒，测试也要明确计为拒绝，不能用 `guard ... else { continue }` 静默跳过断言。

## P1-5：CI 不得写入本机架构 workaround

`.github/workflows/ci.yml` 的 generic simulator build 不得固定 `EXCLUDED_ARCHS=x86_64`；该值会让 Intel runner 无可用架构，也不是 portable contract。移除本机 workaround；`ONLY_ACTIVE_ARCH` 也只有在实际选中的 simulator test 阶段有意义，generic build 使用标准无签名 simulator build。保留运行时确定性选择 available iPhone simulator。

## P2：文档只记录真实门禁状态

- Harmony README 不能说纯逻辑测试已经通过：本会话 `hvigorw test` 真实退出 255，原因是 ohpm 获取 Hypium/Hamock 返回 502；只能说测试入口已落盘、待源可用后跑通。unsigned assemble 退出 0 可如实保留。
- `docs/release/version-matrix.md` 的 iOS 自动测试不能写得像 XCTest 已绿：当前本机 Xcode 27 beta plugin-server 阻断、GitHub job 尚未实际运行。写成测试/CI 已接线但结果 pending，并列真实本机阻断。
- Harmony 行同样明确测试入口已接线但本机依赖源 502 阻断；unsigned assemble 绿不等于测试绿。
- 若其他 README/Docs 有同义假绿，一并最小修正；不要把外部阻断说成工程通过。

## 门禁

依次执行并报告真实退出码。完整 Android 构建不要与另一个 Gradle 任务并跑。

```bash
bash -n apps/ios/build-and-install.sh apps/android/build-and-install.sh apps/harmonyos/build-and-install.sh scripts/mobile-install-common.sh
node scripts/test-mobile-installers.mjs
node scripts/test-mobile-release-contract.mjs
env ANDROID_HOME=<真实 SDK> ANDROID_SDK_ROOT=<同一 SDK> apps/android/gradlew --no-daemon -p apps/android :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
cd apps/ios && xcodegen generate
# 尽力重跑标准 simulator build/XCTest；若仍是工具链阻断，如实保留原始退出码，不得加架构规避把红灯藏掉。
cd apps/harmonyos && env DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw test --no-daemon
cd apps/harmonyos && env DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw assembleHap --no-daemon
actionlint .github/workflows/*.yml
pnpm typecheck
pnpm lint
node scripts/check-doc-links.mjs
bash scripts/check-emoji.sh
git diff --check
```

尖括号不可照抄。仍禁止读取/打印真实设备标识、证书密码、token、私钥或个人目录；不得安装真机。交付只列真实结果。
