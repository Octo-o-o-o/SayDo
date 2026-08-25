# 60 · M2-voice-a iOS 原生语音层自审

日期：2026-08-12

代码提交：`2f49597`（实现 M2 iOS 原生语音交互闭环）

## 评审范围

- 规格输入：`2026-08-11-SayDo移动端完整方案-v1.md` 文末“v4 增补”与“v4.1 修订”，B 项按 v4.1 冻结合同执行。
- 实现范围：`apps/ios`、`packages/console`、`packages/daemon`、`packages/contracts` 中的 M2-voice-a 增量。
- 明确排除：Android、HarmonyOS、正式配对安全层、Noise/设备信任、中继与真机体验裁决。

## 输入、行动、产出、结论

### 输入

- 当前工作树相对 `feat/m2-ios-shell-spike` 的差异。
- 一次独立 code-review subagent 初审及一次回修后追检。
- 一次 `codex exec -m gpt-5.6-sol -c model_reasoning_effort=max` 对抗性评审。
- TypeScript 全量 CI、XcodeGen 工程再生成、iOS 模拟器构建和 Swift 单测输出。

### 行动

- 逐项核对 native reply 定向范围、脱敏、来源标注和 mobile LAN 白名单。
- 逐项核对 v4.1 B 冻结桥合同、页面代次/来源约束、提交结果与回复转发。
- 逐项核对双授权、中文识别探针、60 秒上限、capture generation、托盘手势、TTS 白名单和去重。
- 对所有 A/B 级发现回修，并为竞态、来源、权限恢复和几何边界补测试。

### 产出

- daemon 新增定向、脱敏的 `native.reply`，仅发给绑定同一 session 的 `mobile_lan` console peer。
- console 新增冻结 native bridge，并在 native 模式保留文本输入、收薄 Web dock。
- iOS 新增原生 ASR、语音胶囊、Focus 托盘、桥提交和回复 TTS。
- 增加 contracts、daemon、console 与 Swift 状态机测试。

### 结论

未留存 A/B 级代码阻断项。模拟器构建、可测状态机和 Node 全量门禁已通过；真机授权弹窗、真实中文 ASR、系统 TTS、手势手感和 LAN 端到端仍由验收人裁决，因此本报告不声称真机行为已验收。

## 发现与处置

### A 级

1. 初版 bridge 只依赖 message handler 名称，缺少可信页面来源和页面代次绑定，旧页面或非 profile 页面可能注入消息。
   - 处置：增加 scheme/host/规范化 port 校验、main frame 与当前 WebView 校验、每次主导航重置的 page generation 和 document-start nonce；profile 切换、重载及导航均使旧桥失效。
   - 状态：已修。

2. `native.reply` 若沿用通用广播或允许对端上行，可泄漏到错误 peer 或被伪造。
   - 处置：合同收紧为严格 schema；daemon-only 发送；mobile LAN 上、下行分别使用白名单；只向同 session 的 `mobile_lan` console peer 定向发送，文本再次经脱敏。
   - 状态：已修。

### B 级

1. 系统话术和确认复述曾可能被默认标成 `assistant_reply`，造成 TTS 来源语义失真。
   - 处置：所有生产口播显式携带 `turnId/origin`；缺上下文时保守归为 `system`；确认复述携带当前 turn 的 `confirmation`。
   - 状态：已修。

2. 权限已拒绝的冷启动胶囊虽不可录音，但初版缺少始终可见的恢复指引。
   - 处置：增加纯策略 `VoicePermissionPolicy`，胶囊在 denied/restricted 时展示“到系统设置允许”或设备管理限制提示，并补单测。
   - 状态：已修。

3. Focus 托盘与胶囊之间 9 点视觉间隙曾被判为滑出，可能在上滑刚开托盘时永久取消本次捕获。
   - 处置：托盘打开后的 drag 有效区改为两者包围矩形；release 仍只接受胶囊或托盘本体；补间隙连续路径测试。
   - 状态：已修。

4. 首轮问候可能在 `hello.ack` 后、daemon 尚未处理 `voice.mode` 前发送，导致 once 标记已提交但原生 TTS 事件未定向送达。
   - 处置：移动 LAN 请求只有在 `native.reply` 实际送达后才把 marker 从 `presenting` 提交为 `presented`；未送达时保留相同 `turnId` 并由 console 有界重试，已写转写/审计不重复落盘。
   - 状态：已修。

### C 级

1. 初版回复队列可能在同一 React commit 前被后续事件覆盖。
   - 处置：改为上限 50 的 FIFO，并使用竞态安全消费。
   - 状态：已修。

2. 初版提交结果未区分已送 socket 与仅回填 draft。
   - 处置：桥返回 `queued_to_socket`、`drafted` 或 `rejected`，Swift 状态机按结果收口。
   - 状态：已修。

3. 手势、权限、来源和首跑竞态的自动测试覆盖不足。
   - 处置：增加四边滑出、托盘间隙、权限恢复、origin/捕获互斥、bridge origin/nonce、首跑未送达重试和确认复述上下文测试。
   - 状态：已修。

## 验证证据

### Node 全量

命令：

```bash
pnpm ci:node
```

最终输出摘录：

```text
packages/contracts test: Tests  92 passed (92)
packages/console test: Tests  106 passed (106)
packages/daemon test: Tests  1180 passed | 4 skipped (1184)
[ok] emoji gate: clean
```

同一最终命令内 typecheck、eslint、tests 和 emoji gate 均以退出码 0 结束。

过程记录：沙箱内 daemon 监听本机 WebSocket 曾因权限限制无输出卡住；允许本机监听后，聚焦测试为 67/67 通过。此前两次并行全量各出现一次既有时序/端口竞争型单测红（idle marker timing、`EADDRINUSE`），对应聚焦重跑及串行 daemon 全量均通过；最终原始 `pnpm ci:node` 已得到上述干净绿灯。

### iOS 模拟器构建

命令：

```bash
cd apps/ios
xcodegen generate
xcodebuild -project SayDo.xcodeproj -scheme SayDo -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .build/m2-final-build CODE_SIGNING_ALLOWED=NO build
```

输出摘录：

```text
Created project at ~/WorkSpace/SayDo/apps/ios/SayDo.xcodeproj
** BUILD SUCCEEDED **
```

### Swift 状态机测试

命令：

```bash
xcodebuild -project SayDo.xcodeproj -scheme SayDo -configuration Debug \
  -destination 'platform=iOS Simulator,id=0BC18C2B-88D0-4262-AB3E-9B83D0ED049A' \
  -derivedDataPath .build/m2-final-test CODE_SIGNING_ALLOWED=NO \
  -only-testing:SayDoTests test
```

输出摘录：

```text
Executed 9 tests, with 0 failures (0 unexpected)
** TEST SUCCEEDED **
```

## 真机留验

- 首次双授权、拒绝后去系统设置恢复、设备管理 restricted 状态。
- 设备内 `zh-CN` 实时 partial/final、设备不支持时的联网识别显式 opt-in。
- 60 秒自动收尾、授权中松手、滑出取消、上滑托盘手感及 Focus 选中反馈。
- 开录立即停播、`assistant_reply/onboarding` 朗读、`system/confirmation` 不朗读、同句去重。
- 多桌面 profile 切换、页面刷新/跨 origin 导航后的 bridge 失效与恢复。
- 真机经 LAN 完成“按住说→转写→发送→回复朗读”全链。
