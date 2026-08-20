# M2 spike:HarmonyOS native 壳首版自审

> 日期:2026-08-12
> 基线:`feat/m2-ios-shell-spike` / `408b29ba7816e35011f3e0a7d5da138aaa0af591`
> 评审对象:HarmonyOS 代码提交
> `369cb66fa168c77fe16cf88011b0d6bc793f6d40`
> 范围:`apps/harmonyos/` 新增实现;未改 ios/android/daemon/console/canonical

## 结论

**Go(HarmonyOS 壳与 Web UI 真机探针),No-Go(网页语音探针)。实现评审 A=0,B=0,C=0。**

DevEco/hvigor 工程、扫码解析、HUKS 包裹 token、多桌面切换、ArkWeb、失败态和签名感知安装
脚本均已落盘。最终只读 code review 为 Go,A=0/B=0/C=0。评审期间发现的删除崩溃窗口、单个
坏 token 拖垮列表、配对 URL 过宽、图标转码失败和签名材料占位偏差均已回修并在提交前关闭。

与 iOS 57 号、Android 58 号自审相同,任务指定的 LAN IP 明文 HTTP 不是 Web secure context。
ArkWeb 允许 HTTP 与混合内容只解决导航限制,不能把页面提升为可信来源。因此本壳可上真机评估
页面滚动、交互、扫码和多桌面连接,但不能据此完成网页语音流畅度裁决。关闭该边界需要在 M2
正批选择 HTTPS/可信本地入口或 native 采集桥,本批不代 owner 拍板。

## 独立评审 findings triage

一次只读 code-review subagent 分轮复核,最终判定 A=0/B=0/C=0。逐项处理如下:

- A-1 已关闭:`ProfileStore.delete` 最初先擦 HUKS token、再提交 profile metadata,进程在两次
  durable 写之间退出会让仍存在的 profile 永久失去 token。现先在同一个 profile preferences
  flush 中提交剩余 metadata、currentId 与 `pendingTokenDeletes` tombstone,再 best-effort 擦除
  token;下次启动幂等重放,清理失败不会把已提交删除误报为失败。
- A-2 已关闭:最终核对时签名 `material` 曾出现本机自动签名内容,与空占位合同冲突。提交前已将
  证书路径、alias、key/store password 和 profile 全部恢复为空字符串,product 不引用 signing
  config;明确 pathspec 暂存后再次扫描,未提交本机路径、证书或密码。
- B-1 已关闭:单个 profile 的 HUKS envelope 损坏或 token 缺失最初会让整个列表加载失败或误进
  首启。现逐 profile 隔离读取;仍有有效项时保留可用 profile,全部已存凭据不可读时显示凭据读取
  失败,不伪装成首次启动。
- B-2 已关闭:扫码 URL 最初允许域名、非根路径和额外 query。现只接受 literal IPv4/IPv6、显式
  端口、根路径、无 userinfo/fragment、且只有一个非空 token 的
  `http://<ip>:<port>/?token=<token>`。
- C-1 已关闭:早期 SVG 与扁平 PNG 图标触发 `ScaleImage`/`TranscodeSLR` 失败。现按参考工程改为
  layered app icon 与独立 144 px start icon;最终 clean 区间不再出现这两类转码失败,资源已进入
  unsigned HAP。restool 仍报告 layered source 超过 41 px 及 JSON 非 PNG 两类警告,参考工程有
  同类输出;本轮按工具链噪声记录,不伪报为无告警。

## 交付核对

- 工程形态:ArkTS Stage 模型 HAP,modelVersion 6.1.1,HarmonyOS 6.0.2(22),包名
  `com.octoooo.saydo`;`build-profile.json5` 保留完整空签名结构。
- `DesktopProfile`:只接受任务指定的完整 HTTP 配对 URL;保存前剥离 token,ArkWeb 导航时只拼回
  当前 profile token;默认名为 `host:port`。
- `ProfileStore` 与 `HuksWrappedPreferenceStore`:profile metadata/currentId 进普通 ArkData
  preferences;token 由 HUKS 中不可导出的 AES-256-GCM 密钥包裹后进入独立 preferences;删除使用
  durable tombstone,metadata 不包含 token。
- `ScanPlugin`:只在用户触发扫码时 dynamic import `@kit.ScanKit` facade 对应的两个 HMS 模块;
  import、权限、取消与调用失败均降级为可理解状态,模块缺失不会让首屏初始化崩溃。
- `Index`:首启引导、扫码后改名确认、顶部当前桌面名、profile 列表、添加、切换、删除和 ArkWeb
  人话失败重试齐全;JavaScript、DOM storage、持久 Web 数据与 `MixedMode.All` 已开启。
- `network_config.json`:明确允许 spike 的 HTTP 明文访问并配置 ArkWeb component;该配置格式与
  OpenHarmony 的[HTTP 数据请求说明](https://gitee.com/openharmony/docs/blob/master/zh-cn/application-dev/network/http-request.md)
  一致。README 同时写明它不是生产安全配置。
- `build-and-install.sh`:依序运行 `hvigorw assembleHap`,只接受本次构建产生的 signed HAP,再执行
  `hdc -t 5KLBB25B07200565 install -r`;只有 unsigned HAP 时以状态 2 停止,不会拿旧签名产物冒充
  或调用 hdc。
- README 已如实记录 dev LAN+token、无 Noise/正式信任层、明文 HTTP、secure-context 阻断、
  空签名占位与真机未验证边界。

## 实际验证

- 空签名占位下执行
  `DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk
  /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw clean assembleHap`:exit 0;输出
  `BUILD SUCCESSFUL in 3 s 361 ms` 与 `No signingConfig found for product default`,只生成
  `entry-default-unsigned.hap`。ArkTS 编译另报告平台 API 可能抛异常及 `getContext` deprecated
  警告;动作入口已有用户可理解失败态,本轮未把警告伪报为零。
- 最终 clean build 内部日志存在 layered source 超过 41 px 与
  `layered_app_icon.json is not png format` 两类 restool 警告;无 `ScaleImage` 或 `TranscodeSLR`
  失败。该 `.hvigor` 日志被 `.gitignore` 排除,未提交。
- unsigned HAP 为 166,881 bytes,SHA-256
  `999df99eb972c21e3eb0a7ca044e13b25583f23a9689cc6da521062bb63e11bc`。实际解包的
  `pack.info` 显示 bundleName `com.octoooo.saydo`,entry module,target/compatible API 22;layered
  icon 三个资源与 144 px start icon 均在包内。
- `bash -n apps/harmonyos/build-and-install.sh`:exit 0。随后实际运行脚本,其 hvigor 增量构建输出
  `BUILD SUCCESSFUL in 126 ms`;外层断言确认脚本以状态 2 停止,并输出“构建到未签名 HAP”与
  “签名待验收人”,未执行 hdc 安装。
- `bash scripts/check-emoji.sh`:输出 `[ok] emoji gate: clean`。脚本自身无 executable bit,首次直接
  执行得到 `permission denied`;改用 bash 后才取得真实通过结果。
- 功能代码提交前 `git diff --cached --check`:exit 0,无输出;暂存清单仅含
  `apps/harmonyos/` 28 个文件。

## 未验证边界

- 未运行真机签名、安装、扫码、LAN 导航、HUKS 持久化、多桌面交互、ArkWeb 音视频权限或
  Web Inspector secure-context 检查;这些留给验收人。
- 未为 ArkTS URL/HUKS/profile store 建立独立运行时单测 harness;本轮证据是最终 clean 编译、
  HAP 解包核对与独立只读代码评审,不把它表述成运行时行为测试。
- 未 push,未部署,未改 ios/android/daemon/console/canonical。构建证明工程、资源和 ArkTS
  可编译,不证明相机、局域网、HUKS 或 ArkWeb 媒体权限的真机行为。
