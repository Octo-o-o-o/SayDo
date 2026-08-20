# SayDo HarmonyOS NEXT 壳 spike

这是与 `apps/ios`、`apps/android` 同定位的 ArkTS 真机评估壳。它扫描桌面端生成的
`http://<ip>:<port>/?token=<token>`，在 ArkWeb 中打开现有 SayDo 页面，并支持保存、切换和
删除多个桌面 profile。

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
- 本轮未验证真机扫码、HUKS 持久化、LAN 导航、ArkWeb 音视频权限或设备安装。

## DevEco 工程

- DevEco / hvigor 工程形态与同机 OctoDesk HarmonyOS NEXT 工程一致：`modelVersion 6.1.1`，
  HarmonyOS `6.0.2(22)`，Stage 模型 HAP。
- 包名为 `com.octoooo.saydo`。
- `build-profile.json5` 保留完整 `signingConfigs[].material` 结构，但所有证书路径、别名和密码均为
  空占位，且 product 暂不引用 signing config，因此命令行默认只产出 unsigned HAP。
- 验收人可在 DevEco Studio 开启自动签名，或填入自己的 debug 签名材料并让 product 引用
  `default`；不要把真实密码或私钥提交到仓库。

## 命令行构建

本机 DevEco Studio 已提供 `hvigorw`，在本目录执行：

```bash
DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk \
  /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw assembleHap
```

未填签名时预期产物为：

```text
entry/build/default/outputs/default/entry-default-unsigned.hap
```

该结果只证明工程和 ArkTS 编译通过，不能安装到要求签名一致的真机。

## 真机构建与安装

验收人先在 DevEco Studio 配好自动签名，连接并解锁设备 `5KLBB25B07200565`，再执行：

```bash
./build-and-install.sh
```

脚本依次运行 `hvigorw assembleHap`，检查 signed HAP，然后执行：

```bash
hdc -t 5KLBB25B07200565 install -r entry-default-signed.hap
```

若只有 unsigned HAP，脚本会如实停止并提示签名待验收人处理，不会假装安装成功。
