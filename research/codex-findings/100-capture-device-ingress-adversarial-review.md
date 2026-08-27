# 对抗评审结论

结论：**需回修后可，现稿不应直接进入 PR1。**

共确认 6 项 A 级、9 项 B 级、4 项 C 级问题。最大的结构性缺口是：capture principal 只在 WS 准入层存在，进入 `LiveDialog` 后立即退化成普通 owner 用户轮，因此方案宣称的令牌 scope、确认隔离、记忆第三方纪律均无法贯穿执行链。

## A 级：必修

### A-1 capture 令牌只限制传输权限，不能限制 Brain 的语义权限

**问题 →** §3.2 的 role 白名单只能阻止持牌者直接发送 `asr.final`、`confirm.click` 等协议消息，不能阻止其通过自然语言让 Brain 调用写工具。方案又在进入 `LiveDialog` 时丢掉 `origin`，所以工具层看到的仍是普通 owner 用户轮。§3.4“只能说话、不能发 dispatch/影响状态”的攻击面声明不成立。

**依据 →**

- 方案宣称 `origin:"capture"`“贯穿全链”：`docs/plan/2026-08-26-capture-device-ingress.fable.md:81,129-143`。
- 实际接线只传 `sessionId/turnId/text`：`packages/daemon/src/index.ts:2913-2915`。
- `LiveDialog.onAsrFinal`、Brain input 和 `ToolContext` 都没有 ingress principal：`packages/daemon/src/live/dialog.ts:570-630,859-889`，`packages/daemon/src/brain/registry.ts:7-17`。
- 无确认即可直接改变状态的工具包括 `cancelTask`、`reviewTask`、`retryTask`、`steerTask`：`packages/daemon/src/brain/liveTools.ts:1111-1204`；还有项目转正、记忆、热词和 Focus 直通：同文件 `:692-750,1273-1344,1434-1450,1655-1731,2174-2231`。
- `remember` 会把当前轮机械标为 `user_utterance`，甚至接受 `user_stated/user_approved`：同文件 `:1275-1333`。
- capture 轮新建的 Focus/义务确认还可在 5 秒后自动接受；入口只拦“到达前已经存在”的 pending，拦不住同一轮新建的 pending：`packages/daemon/src/live/dialog.ts:1318-1338`，`packages/daemon/src/brain/liveTools.ts:1701,1781,2262`。

**建议修法 →** 定义独立的 `InputPrincipal`/`inputOrigin`，贯穿 `onAsrFinal → runUserTurn → onUserTurn → DialogTurnInput → ToolContext → audit/memory`。capture 采用显式工具 allowlist，至少禁止所有状态修改、自动接受、词法直通、可信记忆写入和 S2/S3 路径。若产品真实意图是“capture token 等价 owner 的自然语言权限”，则必须重写 §3.4，不得继续声称 scope 受限。

### A-2 `captureInFlight` 版本偏斜后备会双向误归因，并可旁路确认隔离

**问题 →** 基于“无 origin final + 计数 + shadow mode”的猜测不是可靠 provenance。它既能把 capture final 放成普通用户轮，也能把真正的 Console final 吞成 capture。

**依据 →**

- 后备规则及 mode/sid 变化清零规则：方案 `:143,149-151`。
- pipeline 收到 `voice.mode` 只清 VAD/EOU/mic buffer，不取消已经提交的 PTT ASR：`pipeline/src/saydo_pipeline/hub_client.py:280-303,423-470`；Console 代码也明确在途识别不会 cancel：`packages/console/src/voice/useVoiceChannel.ts:722-728`。
- 反例一：旧 pipeline 的 capture final 在途时切到 `hands_free`，shadow 条件失败，该 final 按普通轮广播并进入确认词表环；普通 final 会消费 pending：`packages/daemon/src/voice/hub.ts:470-474`，`packages/daemon/src/live/dialog.ts:640-676,1077-1083`。方案只把该窗口描述成“误广播一次”，低估了确认收据被消费的后果。
- 反例二：Console done 后切 sid，方案清空 `consolePttInFlight`；随后 capture flush，旧 Console final 先返回时满足 `captureInFlight>0`，会被错认成 capture。真正的 capture final随后反而可被当作 Console final。
- canonical 还写着 daemon/pipeline SHA 必须一致，而实现只比较 protocol major：`docs/09-data-contracts.md:986-1000`，`packages/contracts/src/runtime.ts:128-131`，`packages/daemon/src/runtimeIdentity.ts:9-13`。方案称这项分叉“不影响”，但它正是旧 pipeline 能否接入的根因。

**建议修法 →** 删除猜测式后备。pipeline hello/health 显式声明 `capture_origin_v1` capability；缺 capability 时 capture flush 必须 fail-closed 为 `pipeline_incompatible`。更稳妥的是 daemon 为每轮生成 `ingressId`，pipeline 在 final 原样回显。先统一 docs/09 与运行时代码的版本兼容合同。

### A-3 单轮上限没有形成总资源上限，可制造无界 ASR 队列

**问题 →** 1.92 MB 只限制单轮，flush 条件没有限制 capture 在途轮数。持牌端可以高速连续提交，造成 pipeline 内存、ASR 时长、费用和永久审计记录无界增长。

**依据 →**

- flush a–g 没有 `captureInFlight===0`：方案 `:90-100`；`captureInFlight` 只用于来源猜测：`:143`。
- 每个 done 都复制完整 PCM、清 `_mic_buf` 并创建链式后台 task：`pipeline/src/saydo_pipeline/hub_client.py:280-289,423-438`。
- 每个 task 闭包可持有 1.92 MB，单次识别最长 90 秒：同文件 `:440-470`。
- 方案反而断言 pipeline 不需要限额：方案 `:222-228`。
- 每次弃轮、连接抖动还要求写 append-only audit：方案 `:230-233`。

**建议修法 →** PR1 最多允许一个 capture 轮在途，`captureInFlight>0` 时弃轮 `capture_busy`；同时增加每分钟轮数/字节 token bucket、pipeline 队列硬上限、WS 高水位和重复 audit 聚合。burst 测试应证明连续提交 N 轮时 pipeline 最多持有一个 capture PCM。

### A-4 无 Console 模式必然写出虚假的 `heard=true`

**问题 →** 方案允许没有 Console 时独立跑 Brain，同时设备明确无下行。pipeline 接受 TTS enqueue 会被当成“已投递”，但音频只会回到 Console；下一 capture 用户轮会把完全没人听到的 AI 句结算为 `heard:true`，违反 docs/09 §10 的 unheard 纪律。确认倒计时也可能在无人听见提示时自动接受。

**依据 →**

- 无 Console 也可成轮、设备无下行：方案 `:123-125,251`。
- `sendTtsSay` 只要求 pipeline enqueue 成功，不要求 Console 或实际播放：`packages/daemon/src/voice/hub.ts:822-858`。
- pipeline 合成后仅把 0x02 音频发回 WS：`pipeline/src/saydo_pipeline/hub_client.py:482-517`；daemon 二进制下行只广播给 Console：`packages/daemon/src/voice/hub.ts:770-789`。
- AI 句默认记 `unheard:false`；下一用户轮先结算成 `heard:true`：`packages/daemon/src/live/voiceSessions.ts:153-168,222-258,315-336`。
- canonical：`docs/09-data-contracts.md:1039`。

**建议修法 →** 第一刀二选一：要求存在唯一 active local Console 且 playback 可用，否则 capture 弃轮；或实现 delivery-aware 结算，让无播放确认的句子持久化为 `heard=false`，并禁用 capture 轮产生的自动接受。没有 playout ack 前不能把 pipeline enqueue 当作“用户已听见”。

### A-5 会话解析没有权威 owner，会误挂或偷偷创建会话

**问题 →** “最近心跳的 Console”不是活跃会话权威。新页面、closed 页面或多标签页都可被选中；特别是新 Console 的 sid 尚未入库时，capture final 会通过 `ensureSession` 创建 draft project/session，正面违反方案“不让口袋卡默默建会话”的承诺。

**依据 →**

- 解析规则直接信 `lastVoiceModeSessionId`，多 Console 取最近心跳：方案 `:115-123`。
- Console 本地先随机生成 sid：`packages/console/src/shell/VoiceContext.tsx:18-35`。
- hello.ack 后立即发送该 sid 的 `voice.mode`/heartbeat，此时不要求 DB session 已存在：`packages/console/src/voice/useVoiceChannel.ts:478-484`。
- 未知 sid 会由 `ensureSession` 创建 draft project 和 session；closed 才抛错：`packages/daemon/src/live/voiceSessions.ts:98-145`。
- Hub 只限制单 pipeline，不限制多 Console；每个页面都周期心跳：`packages/daemon/src/voice/hub.ts:340-357`，`useVoiceChannel.ts:438-446`。
- DB fallback 对多个同优先级候选只按 `started_at` 拍板，方案没有歧义拒绝规则。

**建议修法 →** 候选 sid 必须只读验证为已存在且状态允许。出现多个合格 local Console、多个 talking 或同优先级 suspended 时 fail-closed 为 `ambiguous_session`，不要按 timer 调度或 started_at 猜 owner。补新开空页、closed 页、双标签交错心跳和多个 talking 的测试。

### A-6 capture 前置分流并未隔离 Console 专属状态，closed 竞态也不是纯弃轮

**问题 →** 方案把 capture 检查放在 hold 队列之前，但通过检查后仍“走下方既有主链”，所以仍会消费 Console 的 hold FIFO。另一个反例是 session 在 flush 后变 closed：抛错前已经执行 durable callback ACK，不能描述成“丢轮 + 日志”。

**依据 →**

- capture 通过后 fall through：方案 `:156-169`；同时又声称 capture 不得消费 hold：`:171`。
- 当前 hold FIFO 在 `onAsrFinal` 主链最前消费：`packages/daemon/src/index.ts:2868-2900`；`onPipelineLeft` 不清 hold：同文件 `:2986-2995`。因此“Console hold 后 pipeline 断线重连，再来 capture final”会吞掉 Console flag。
- `runUserTurn` 在 `ensureSession` 之前调用 `onUserTurnBegin`：`packages/daemon/src/live/dialog.ts:614-630`。
- 生产钩子会 durable ack 本项目 L0 callback：`packages/daemon/src/index.ts:2774-2780`，`packages/daemon/src/callback/ack.ts:38-60`。

**建议修法 →** capture final 必须进入独立、source-aware handler并直接 `return`，不能读取 Console hold、`speechPending` 或确认 FIFO；hold 也应绑定 round owner。把 `ensureSession`/session epoch 验证移到任何用户轮副作用之前。补 hold 断线重连及 closed-final 两条数据不变测试。

## B 级：应修

### B-1 64 KB 检查挡不住 transport 层巨帧 DoS

**问题 →** 应用层看到消息时，`ws` 已经聚合完整帧。64 KB 后置判断只能阻止入轮，不能阻止默认近 100 MB 消息的内存分配与 JSON 解析。

**依据 →** WSS 未配置 `maxPayload`：`packages/daemon/src/voice/hub.ts:167-176`；消息聚合后才进入 handler：`:215-225,390-395`；方案自己承认“先整帧进内存”：方案 `:224-226`。

**建议修法 →** capture 使用独立 WS path/WSS，并在 receiver 层设置约 64 KB `maxPayload`；若共用 path，则先确认合法 TTS 最大帧，再设全局硬上限。测试需覆盖 fragmented binary 和超大 text，并验证业务 handler 未被调用。

### B-2 “Console 在任何时序都不受影响”是事实错误

**问题 →** Console 按下 PTT 到首帧到达前没有协议级占用信号。capture 可在此窗口先进入 Python ASR FIFO，使随后 Console 轮等待最多一个 90 秒 capture 识别。

**依据 →** 绝对承诺见方案 `:110,152`；Console `pttDown` 仅异步启动麦克风：`packages/console/src/voice/useVoiceChannel.ts:258-300,708-712`；pipeline PTT task 串行：`hub_client.py:423-458`。

**建议修法 →** 增加 Console capture-start 信号和可取消的 capture ASR，或明确接受“Console 最多被一个 capture ASR 阻塞”并修改产品承诺及延迟验收。

### B-3 `hasUserTurnInFlight` 不是完整的 voice-busy 状态

**问题 →** 它只检查用户模型轮，漏掉控制轮、`speechPending`、TTS 排队/播放及 flush→final 间完成过的用户轮。capture final 进入主链会清 `speechPending`、取消控制轮并重置深度。

**依据 →** `hasUserTurnInFlight` 仅返回一个布尔位：`packages/daemon/src/live/dialog.ts:210-213`；控制轮和 `speechPending` 是独立状态：`:355-410,547-567`；普通 final 会修改这些状态：`:570-597`。

**建议修法 →** 新增 `captureIngressBusy(sessionId, epoch)`，覆盖用户轮、控制轮、speech pending、未结算播放和 session generation；flush 前与 final 到达时都复查。final 必须携带 flush 时捕获的 session epoch，防 session suspend/rebuild 或新用户轮完成后的迟到注入。

### B-4 “原子转发”实际只有 enqueue 顺序，没有 all-or-none

**问题 →** 同一同步块可以保证 JS 消息不插队，但 `ws.send` 没有事务、回滚或 delivery ack。背压时数据进入无界 socket buffer；中途失败可能让 pipeline 留下部分 capture PCM 而收不到 done。

**依据 →** 方案断言见 `:107-111`；现有发送路径不检查 callback/`bufferedAmount`，调用不抛即记成功：`packages/daemon/src/voice/hub.ts:637-663,770-789`。

**建议修法 →** 缓冲完成后向 pipeline 发一条合并 PCM frame，再发带 `ingressId` 的 commit；检查 `readyState`、`bufferedAmount` 和 send callback，任一步失败就关闭该 pipeline connection以触发 `_mic_buf` 清账。若不实现事务，应把“原子”改成“同连接 FIFO enqueue”。

### B-5 pipeline 单独重连不会触发 Console 重发 `voice.mode`

**问题 →** 方案声称 hub/pipeline shadow 重置为 ptt 后，Console 会重连并重发 mode；但 pipeline 重连不会使仍在线的 Console 重连。hands-free UI 可能继续显示免手档，而 pipeline 与 shadow 已回 ptt。

**依据 →** 方案 `:149`；Console 只在自己的 hello.ack 或用户 `setMode` 时发送 mode：`packages/console/src/voice/useVoiceChannel.ts:478-484,722-745`；daemon `onPipelineJoined` 只更新状态并推热词：`packages/daemon/src/index.ts:2975-2984`。

**建议修法 →** Hub 保存最后一个权威 effective `voice.mode`，pipeline join 后主动重放；或增加显式 resync 请求。补“Console 保持连接、只重启 pipeline”的测试。

### B-6 flush a–g 的依赖顺序和接线不完整

**问题 →** f 要检查“该会话”是否在途，但 g 才解析 session，顺序不可执行；lifecycle 状态又只存在于 `index.ts`，PR1 清单却只描述 `resolveCaptureSession` 回调，没有 `canAcceptCapture`/busy/epoch 接线。

**依据 →** 条件顺序：方案 `:90-100`；当前 lifecycle 门在 `index.ts:2888-2911`；`VoiceHubEvents` 没有对应 predicate：`packages/daemon/src/voice/hub.ts:52-86`；PR1 描述：方案 `:283-284`。

**建议修法 →** 明确定义同步流程：解析候选并只读验证 → 读取 lifecycle/busy/epoch → 最后一刻复查 pipeline owner 与背压 → enqueue。把所需 callback 和返回形状写进方案及文件清单。

### B-7 PR1“全部文件”清单与验收要求不一致

**问题 →** 表格声称超出即越界，却没有列出其后明确要求新增的三个 test 文件，也没有 pipeline origin 单测或 contracts schema 测试。吸收 A 级修复后，还会遗漏更多生产文件。

**依据 →** “全部列出”及文件表：方案 `:276-287`；验收要求测试文件：`:291-297,318-350`；现有 strict schema 回归落点为 `packages/contracts/test/schemas.test.ts:36-39,172-184`。

**建议修法 →** 将表头改为“生产改动文件”或真正列全。至少补：

- `packages/contracts/test/schemas.test.ts`
- `packages/daemon/test/voice-hub-capture.test.ts`
- `packages/daemon/test/capture-identity.test.ts`
- `packages/daemon/test/capture-session.test.ts`
- pipeline origin/capability 测试
- 修复 provenance 后的 `live/dialog.ts`、`live/voiceSessions.ts`、`brain/registry.ts`、`brain/liveTools.ts`、`contracts/src/types/project.ts`

### B-8 测试计划漏掉决定安全性的交错

**问题 →** §7 主要验证正常路径和三个影子值的单点变化，没有覆盖已发现的跨状态交错。

**依据 →** 当前测试计划：方案 `:316-355`。

**建议修法 →** 至少新增：

- 旧 pipeline + pending 确认 + capture final 在途 + 切 hands-free；
- Console done → sid rebound → capture flush → Console final 先到；
- pipeline-only reconnect 且 Console 保持 hands-free；
- 控制轮、`speechPending`、TTS 播放中 capture；
- flush 后 session closed/suspended 或新 typed 轮完成；
- 无 Console 下 `heard=false` 和禁止 auto-accept；
- burst、backpressure、审计聚合；
- transport 层 fragmented 巨帧；
- capture 轮无法调用所有写工具；
- 新页面未知 sid、closed 页、多 Console、多 talking。

### B-9 “capture 轮 Console 不可见”只过滤了提问，没有过滤回答

**问题 →** Hub 不广播 capture `asr.final`，但 `LiveDialog` 仍会发送 `screen_text`、`native.reply`、`tts.say` 和 0x02 音频到 Console。UI 会看到或听到一个没有用户气泡的回答，且 capture 与 Console 播放状态会互相影响。

**依据 →** 过滤范围：方案 `:141,398`；回答上屏：`packages/daemon/src/live/dialog.ts:977-1027`；TTS/Console 广播：`packages/daemon/src/voice/hub.ts:822-858`。

**建议修法 →** origin 必须贯穿输出层。PR1 要么同时隐藏 capture 的全部 response，要么以明确的 capture 来源展示完整问答，不能只隐藏用户轮。

### B-10 PR2 将 principal 混进 `IdentityVia`，模型维度错误

**问题 →** `IdentityVia` 当前表示网络位置 `local/tailnet/mobile_lan`；PR2 增加 `"capture"` 会把身份主体与网络位置混为一维，使现有 `else` 分支可能把 capture 误当 tailnet 或 screen。

**依据 →** 当前类型：`packages/daemon/src/net/identity.ts:12`；方案 PR2：`:299-305`。现有多个消费者假设只有三值，包括 `VoiceHubEvents` 和确认路径：`packages/daemon/src/voice/hub.ts:47-85`，`packages/daemon/src/live/dialog.ts:1086-1120`。

**建议修法 →** 保持正交字段：`principal: owner|capture` 与 `via: local|tailnet|mobile_lan`。不要新增 `via=capture`；所有授权判断基于二元组并用 exhaustive switch。

## C 级：可选或措辞修正

### C-1 §3.3 的既有 WS 失败码写错

**问题 →** Host/Origin/token 失败不是 4001/4002。

**依据 →** identity 拒绝统一 close 4003：`packages/daemon/src/voice/hub.ts:183-191`；4001 是协议/runtime，4002 是 hello timeout：`:208-213,313-339`。方案 §4 的失败码表反而是正确的：方案 `:252`。

**建议修法 →** 将 §3.3 第 209 行改为“WS identity 失败为 4003 + reason；HTTP 沿用对应状态码”，避免两个章节互相冲突。

### C-2 两枚 token“固定等长且各走 timingSafeEqual”没有实现依据

**问题 →** 当前 loader 对任意非空旧 token 原样接受；长度不同会提前返回，不会进入 `timingSafeEqual`。简单克隆 `capToken.ts` 不能保证方案声明。

**依据 →** `packages/daemon/src/net/capToken.ts:13-20`，`packages/daemon/src/net/identity.ts:109-115`，方案 `:213,281`。

**建议修法 →** 装载时严格验证 32 字符 base64url；非法值 fail-closed 或显式轮换并审计。比较前归一为固定长度 digest。

### C-3 帧长合同有一字节错误

**问题 →** `tag 1B + seq 4B + 至少一个 PCM16 sample 2B` 的最小总长度是 7，不是 6。虽然“payload 偶数”会间接拒绝 6 字节帧，但合同文字错误。

**依据 →** 方案 `:226,245`；现有帧头消费为 5 字节：`packages/daemon/src/voice/hub.ts:587-602`，`pipeline/src/saydo_pipeline/hub_client.py:167-176`。

**建议修法 →** 写成 `len >= 7 && (len - 5) % 2 === 0`。

### C-4 可砍掉的过度设计

**问题 →** 三套机制增加了状态空间，却没有增加可靠性。

**依据与建议修法 →**

1. 固定占位 sid 仅为复用 `pipelineMsgSchema`：方案 `:127,243-246`。改用独立 strict capture-ingress schema，设备的 `done_speaking` 不带 sid；可删除占位重写、泄漏探针及对应审计。
2. 删除 `captureInFlight` 的 origin 猜测：方案 `:143`。改为 capability + `ingressId`，同时消除多条竞态。
3. daemon 已经持有完整 PCM，可合并成一条新 0x01 frame 再交 pipeline，不必逐帧同步 replay：方案 `:99-110`。pipeline 当前只按到达顺序拼 payload，不消费 seq 语义：`hub_client.py:167-176`。这会显著缩小“原子转发”和背压的实现面。

## 合同核验补充

以下部分本身没有发现结构性冲突，但成立有前提：

- B8“只有 pipeline 可发 `asr.*`”当前真实成立：`packages/daemon/src/voice/hub.ts:108-139,398-406,461-474`。capture JSON 必须确实在 `routeJson` 层短路，不能进入普通 dispatch。
- 单 pipeline owner 与 stale peer 丢弃当前真实成立：同文件 `:340-344,398-406`。
- pipeline 对每个已收到的 PTT done 维持 FIFO 并产生一个 final，包括空/异常轮：`pipeline/src/saydo_pipeline/hub_client.py:423-470`。问题在于方案无法可靠判断每个 final 属于 Console 还是 capture。
- `PipelineMsg` 使用 `z.strictObject`，所以 additive origin 必须同步修改 schema 和 docs/09；方案对此判断正确：`packages/contracts/src/types/pipeline.ts:17-26,55-59`。
- gate 命令形态可判定，但当前验收集合不足以证明安全和状态机不变量。

## 是否可进入实施

判定：**需回修后可。当前不可进入 PR1。**

最大的单一风险是：**capture principal 在进入 Brain 前丢失，导致“受限采集令牌”事实上获得 owner 语义输入能力。** 这不只是转写污染，而是可触达任务状态修改、Focus/义务直通、自动接受、可信记忆与回叫 ACK，直接推翻 §3.4 的威胁模型。

再次进入实施评审前，至少应完成：

1. durable principal/provenance 与 capture 工具权限矩阵；
2. capability/`ingressId` 来源绑定，删除启发式 fallback；
3. 单轮在途、速率、transport payload 和 pipeline 队列硬上限；
4. 权威 session lease/歧义拒绝；
5. 无播放端的 unheard 与确认策略；
6. source-aware 独立 final handler及上述交错测试。

## 事实核验覆盖说明

实际全文或核心控制流核对：

- [设计方案](~/WorkSpace/SayDo/docs/plan/2026-08-26-capture-device-ingress.fable.md)
- [hub.ts](~/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts)
- [identity.ts](~/WorkSpace/SayDo/packages/daemon/src/net/identity.ts)
- [capToken.ts](~/WorkSpace/SayDo/packages/daemon/src/net/capToken.ts)
- [index.ts](~/WorkSpace/SayDo/packages/daemon/src/index.ts)
- [hub_client.py](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py)
- [dialog.ts](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts)
- [voiceSessions.ts](~/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts)
- [pipeline.ts](~/WorkSpace/SayDo/packages/contracts/src/types/pipeline.ts)
- [useVoiceChannel.ts](~/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts)
- [docs/09-data-contracts.md §10](~/WorkSpace/SayDo/docs/09-data-contracts.md:984)

为验证副作用和合同边界，另定点核对：

- [project.ts](~/WorkSpace/SayDo/packages/contracts/src/types/project.ts)
- [runtime.ts](~/WorkSpace/SayDo/packages/contracts/src/runtime.ts)
- [runtimeIdentity.ts](~/WorkSpace/SayDo/packages/daemon/src/runtimeIdentity.ts)
- [registry.ts](~/WorkSpace/SayDo/packages/daemon/src/brain/registry.ts)
- [liveTools.ts](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts)
- [growth.ts](~/WorkSpace/SayDo/packages/daemon/src/memory/growth.ts)
- [manager.ts](~/WorkSpace/SayDo/packages/daemon/src/session/manager.ts)
- [callback/ack.ts](~/WorkSpace/SayDo/packages/daemon/src/callback/ack.ts)
- [recoveryOnlyServer.ts](~/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts)
- [recentTranscript.ts](~/WorkSpace/SayDo/packages/daemon/src/api/recentTranscript.ts)
- [confirmVocab.ts](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts)
- [VoiceContext.tsx](~/WorkSpace/SayDo/packages/console/src/shell/VoiceContext.tsx)

本次未修改任何文件，也未运行测试或门禁；结论来自对拟议方案、现有代码与 canonical 合同的静态对账。