# SayDo HarmonyOS NEXT 壳 spike

这是与 `apps/ios`、`apps/android` 同定位的 ArkTS 真机评估壳。它扫描桌面端生成的
`http://<ip>:<port>/?token=<token>`，在 ArkWeb 中打开现有 SayDo 页面，并支持保存、切换和
删除多个桌面 profile。版本 `0.1.0 (1)`。

profile 的 `id`、`name`、`url` 和当前选择保存在 ArkData `preferences`；token 不进入该 JSON，
而是由 HUKS 内的 AES-256-GCM 密钥包裹后另存到专用 `preferences`。扫码使用
`@kit.ScanKit` 对应的系统能力；底层 HMS 模块只在用户点扫码时动态加载，非 HMS 设备或模块
缺失会显示“扫码不可用”，不会在首屏初始化时崩溃。

## Spike 边界

- 当前仅用于开发通道的 LAN + token 连接，要求手机和桌面在同一可达网络。
- `network_config.json` 和 ArkWeb `MixedMode.All` 明确允许明文 HTTP。这是为真机探针做的临时
  放宽，不是生产安全配置。
- 当前没有 Noise 握手、设备信任、一次性配对票据、中继和正式威胁模型。
- 正式配对协议及完整安全层属于 M2 正批，本壳不能作为生产配对实现。
- ArkWeb 已开启 JavaScript 与 DOM storage，并使用持久化 Web 数据；页面加载失败会显示可重试的
  人话提示。
- 明文 LAN HTTP 不是 Web secure context。现有网页依赖的
  `navigator.mediaDevices.getUserMedia` 预计不可用；本版可以评估 Web UI、连接和多桌面流程，
  不能据此完成网页语音流畅度裁决。该判断仍需验收人在真机 Web Inspector 中记录。
- 发布证书 / P12 不等于签名 Profile。当前缺 SayDo Profile，命令行默认只产出 unsigned HAP。
  unsigned 不能安装到要求签名一致的真机，不能手工临时签名后冒充发布包，也不得放入
  GitHub Release。GitHub 无 HarmonyOS job；测试与 HAP 构建只能走本机门禁。

## DevEco 工程

- DevEco / hvigor 工程形态与同机 OctoDesk HarmonyOS NEXT 工程一致：`modelVersion 6.1.1`，
  HarmonyOS `6.0.2(22)`，Stage 模型 HAP。
- 包名为 `com.octoooo.saydo`。
- `build-profile.json5` 保留完整 `signingConfigs[].material` 结构，但所有证书路径、别名和密码均为
  空占位，且 product 暂不引用 signing config，因此命令行默认只产出 unsigned HAP。
- 验收人可在 DevEco Studio 开启自动签名，或填入自己的 debug 签名材料并让 product 引用
  `default`；不要把真实密码或私钥提交到仓库。

## 命令行构建与测试

DevEco / hvigor / hdc 路径可用 `HVIGORW_BIN`、`HDC_BIN`、`DEVECO_SDK_HOME` 注入。本机
DevEco Studio 已提供 `hvigorw` 时：

```bash
DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk \
  /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw test --no-daemon

DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk \
  /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw assembleHap --no-daemon
```

未填签名时预期产物为：

```text
entry/build/default/outputs/default/entry-default-unsigned.hap
```

该结果只证明工程和 ArkTS 编译通过，不能安装。

测试依赖只在工程根 `oh-package.json5` 的 `devDependencies` 声明：`@ohos/hypium@1.0.25`、
`@ohos/hamock@1.0.0`。entry 模块不重复声明。仓库提交候选 `oh-package-lock.json5`
（`stableOrder`，integrity/resolved 来自官方 ohpm 源，不得编造）。`oh_modules/`、`.ohpm/`、
SDK 内文件和测试报告不入 Git，手工复制这些目录不是安装。

当前依赖与测试口径必须分开读：

- fresh dependency hydration 目前被上游 502 阻断：本机 `ohpm install --all --lockfile_stable_order`
  对官方源上的 hypium/hamock 仍返回 HTTP 502，干净树无法复现安装。
- 把 SDK 内测试框架目录手工复制进 `oh_modules` 不是有效安装。该路径的真实红灯是
  `Failed to resolve OhmUrl` 与 dependency not installed，不得当作门禁证据。
- 此前 12/12 为**实施自报、未独立验收**。`hvigorw test` **13/13 仅 cached-exact 依赖环境**
  (ohpm 正式安装且 lock 匹配的本机 store，含 shared corpus)。fresh clone 当前因
  `@ohos/hypium` / OhmUrl 解析失败会以 exit 255 结束、无测试计数，不得表述成 fresh
  reproducibility。fresh hydrate 仍 502，不得把 Harmony job 宣称为可复现 CI 绿。
- 因上游当前不可 fresh hydrate，仍不得把 Harmony job 宣称为可复现 CI 绿。GitHub 无
  Harmony job；unsigned assemble 绿不等于测试绿。

`./build-and-install.sh --build-only` 在缺少本次构建的 signed HAP 时会失败，这是预期。
--build-only 不要求 hdc。

## 真机构建与安装

验收人先在 DevEco Studio 配好自动签名并取得 SayDo Profile，连接并解锁恰好一台在线设备后：

```bash
./build-and-install.sh
```

多台设备时必须显式指定，不会挑列表第一项：

```bash
./build-and-install.sh --device <target>
# 或: SAYDO_DEVICE=<target> ./build-and-install.sh
```

脚本只接受本次构建后更新的 signed HAP，然后执行 `hdc -t <target> install`。目标 ID 合同
只接受 USB 风格字符集（字母数字、点、下划线、连字符；6–64 字符），不支持含冒号的网络
target。诊断文本、模拟器与 probe 失败一律拒绝。若只有 unsigned HAP 或 Profile 缺失，
脚本会 exit non-zero 并提示签名待验收人处理，不会假装安装成功。2026-08-22 曾出现物理
target，本轮无在线目标证据（`hdc list targets` 非空目标数为 0）；仓库仍缺签名 Profile 与
signed HAP。生成合规签名产物前不推装、不假装成功。
