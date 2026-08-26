# rc4 mobile readiness 第一次独立复审退回

你是本批原实施会话。独立 reviewer 对你已提交的
`70622677bad97b04aa8d8ffb23328576ef639e55` 给出第一次 No-Go。按仓库规则在同一会话
返工，不新开实现上下文。只修改本 worktree；禁止联网、push、release、deploy、删除真实用户
数据或自动卸载设备应用；不要提交，由主会话在真实门禁后提交。

## 0. 事实基线

- 正常二维码由 `packages/console/src/lib/pairing.ts` 用 `encodeURIComponent(token)` 生成。
- daemon token 当前由 `randomBytes(24).toString("base64url")` 生成，但既有 token 文件只保证
  `trim()` 后非空，所以本批不得擅自把接收合同缩成固定 32 字符。
- 本机有 Android SDK 36 的 `apksigner`/`aapt2`，DevEco SDK 有
  `openharmony/toolchains/lib/hap-sign-tool.jar`；实现须支持环境变量注入以便离线测试。
- iPhone 真机当前可配对；Android/Harmony 当前没有在线真机。不得把缺设备写成通过。

## 1. P1：统一三端 pairing URL grammar

建立一份仓库内共享的、数据驱动 corpus（可由 Node 门禁读取并分别校验三端测试已覆盖），三端
行为必须同构：

1. 只允许外围 ASCII whitespace `SP/HTAB/CR/LF`，统一 trim；BOM、NBSP 与其他 Unicode
   whitespace 拒绝。
2. raw query 必须恰好一个 `token` 参数；参数名和值的 raw 字节只允许 RFC3986
   unreserved ASCII `[A-Za-z0-9._~-]` 或完整 `%HH` triplet。因而 raw space/tab/NUL、raw
   `@`、raw `[`/`]`、raw non-ASCII/non-BMP 均拒绝；规范 percent-encoded UTF-8（含空格、
   reserved、BMP/non-BMP）继续按现有合同解码并往返。
3. percent decode 必须严格 UTF-8，拒绝坏 `%`、overlong、surrogate、截断序列；Android 不得
   再逐 UTF-16 `Char` 把代理项编码为 `??`，应按 Unicode scalar/标准 UTF-8 bytes 处理。
4. 保持现有 scheme、private IP/ULA、显式端口、根 path、无 fragment/userinfo、无额外或重复
   query 的 fail-closed 合同。
5. 正反例至少覆盖 reviewer 的 raw space/tab/NUL/raw `@`/raw U+10000/BOM，以及 percent-
   encoded non-BMP。三端各自单测和共享合同门都必须真实执行这些样本，不得只 grep 文本。

若平台 URL parser 在原始字符串规范化前会吞掉信息，先在 raw string 层做 grammar 检查，再交给
平台 parser。不得放宽安全边界来求同构。

## 2. P1：包格式、签名与身份校验

Android `build-and-install.sh` 在 `saydo_require_rebuilt_file` 后、任何成功提示/安装前：

- 从同一 SDK 的 build-tools 解析 `apksigner` 与 `aapt2`（允许测试专用显式环境变量注入，
  不依赖 PATH）；工具缺失 fail-closed。
- `apksigner verify --verbose --print-certs` 必须退出 0。
- `aapt2 dump packagename` 必须精确为 `com.octoooo.saydo`；`dump badging` 中 versionName 必须
  与项目声明一致，不能只凭扩展名或 ZIP magic。
- 测试用真正的最小签名 fixture 或严格 fake verifier，必须证明 ASCII 假 APK、verifier 非 0、
  applicationId/version 漂移均失败，并证明 verifier 确实被调用。

Harmony `build-and-install.sh` 在成功提示/安装前：

- 解析可注入的 Java 与 `hap-sign-tool.jar`；运行官方 `verify-app` 输出 cert chain/profile，随后
  `verify-profile`；任一工具/输出/退出码异常 fail-closed，临时目录用 trap 清理。
- 从 HAP 的 `module.json` 机械核对 `app.bundleName=com.octoooo.saydo`、versionName 与项目
  `AppScope/app.json5` 一致，并核对 profile 非空且验证成功；不得只认文件名。
- ASCII 假 HAP、unsigned/坏签名、bundle/version 漂移、工具缺失必须失败；测试证明 verifier
  被调用。当前真实构建只有 unsigned HAP，应继续如实红灯。

## 3. P1：真机证明收紧

- Android：对每个 `adb devices` 的 `device` 候选用同一 SDK adb 二次查询物理属性；至少检查
  `ro.kernel.qemu`、`ro.boot.qemu`、`ro.hardware`、`ro.product.model`、
  `ro.build.fingerprint`。命中 qemu/emulator/goldfish/ranchu/cuttlefish/sdk_gphone/generic 等
  模拟器证据即拒；关键查询失败或必要身份字段为空 fail-closed。`localhost:5555` 若探针显示
  模拟器必须拒；显式 `--device` 不得绕过。
- Harmony：单字段诊断（例如 `error`）不得直接成为 target。先做严格 ID grammar，再用
  `hdc -t <id> shell` challenge/设备属性二次探针确认真实在线、非 emulator/simulator；查询失败
  或未知形状 fail-closed；显式设备同样受检。
- iOS：只接受已知 schema 下 `reality=physical`、platform iOS/iPadOS、
  `pairingState=paired` 且连接状态满足明确白名单。缺失或未知 pairingState（如 diagnostic）
  一律拒绝；build/install 必须仍绑定同一 identifier。
- installer harness 新增 localhost emulator alias、Harmony 单词诊断/假 target、iOS 未知或缺失
  pairingState 等反例。

## 4. P1：官网与版本矩阵诚实口径

对齐 canonical site 源、中文/英文部署页、`docs/release/version-matrix.md`、三端 README 与合同测试：

- 当前可用的是移动浏览器 LAN dogfood。
- iOS/Android/Harmony App 壳均是开发候选；iOS 待本轮真机复测，Android 无当前在线设备证据，
  Harmony 当前只有 unsigned HAP 且无在线设备；三者均未上架、无公开下载。
- 删除或改写“App 壳当前可连接”等会让普通用户误解为已可获得/已验收的句子。
- 合同门应核对完整状态语义，而不是仅排除某一条旧固定短语。
- Harmony 12/12 若没有独立可重算日志证据，只能标为“实施自报、未独立验收”；不得当通过项。

## 5. P2 顺手闭环（保持最小 diff）

- 为 Gradle wrapper 增加与当前 distribution URL 对应的 `distributionSha256Sum`，用已下载
  distribution 或官方校验值离线核实，不得猜。
- Android debug signer 跨 clone 漂移不自动卸载用户 App；README/安装失败提示明确说明签名不一致
  时需用户显式卸载或提供稳定的本地 keystore。不要提交 keystore/密码。
- 对能够无争议固定的 CI 工具版本做最小 pin；若当前 runner 镜像事实无法离线证明，则保持现状并
  在交付摘要列为未处理 P2，不要猜版本。

## 6. 验收门

实施完成后至少真实运行并报告原始摘要与退出码：

1. `node scripts/test-mobile-installers.mjs`
2. `node scripts/test-mobile-release-contract.mjs`
3. 三端 pairing corpus 对应测试；Android 离线 unit/lint/assemble；iOS simulator build + XCTest；
   Harmony cached test 若不可复现就如实红，`assembleHap` + installer 必须拒绝 unsigned。
4. 对实际 Android APK 运行本次新 verifier；对 fake APK/HAP 反例运行 installer harness。
5. `pnpm typecheck`、`pnpm lint`、`actionlint .github/workflows/ci.yml`、文档链接、emoji、
   `git diff --check`。
6. 最终列出 exact changed files；禁止把 prompts/logs/build output 纳入候选改动。

若签名工具真实语义无法验证，不得以假 fixture 代替成功结论；停在可审查的 fail-closed 实现并如实
说明剩余阻塞。
