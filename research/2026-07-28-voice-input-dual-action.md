# 语音输入区双动作交互方案(v1.1 定稿)

> v1.1 = v1.0 + 交互评审回修(2A/3B/3C 全采纳,2026-07-28):
> A1 hold 旗泄漏 ⇒ **轮次守恒合同**:PTT 下每个 done_speaking 恰好一个 asr.final(短按/空转写/识别异常发空 final)+ daemon 旗加 TTL 120s 双保险(09 §10 回写);
> A2 intent 单标量 ⇒ **FIFO 队列** {kind, placeholderKey, deadline},final 逐条出队消费,per-entry 超时,setMode 清队列并置遗留占位失败态;
> B1 超时依据改"录音时长+30s(至少 20s)";B2 thinking 置位统一 helper(sendText 也挂 45s 兜底);B3 回写补 09 §10 + 08 §6/demo 同步判定;
> C1 pendingDraft 消费守卫(已打字不覆盖)显式化;C2 快捷键按下时记录动作、keyup 只认 Space;C3 06 术语表三词条。

> owner dogfood 反馈驱动(2026-07-28 晚):①松开录音后无转写反馈,被当卡死;②转写同时出现在对话流与编辑框(语义矛盾:上=已发出,下=可编辑);③"思考中"出现后消失、AI 永不回话(hold 轮被 daemon 拦截但 console 乐观置位)。
> owner 拍板的交互设计:**两个显式动作**——直接发送(语音气泡先行,转写后挂,大模型即刻开干)/ 转写编辑(只进输入框,编辑后才进对话)。

## 0. 现状 bug 根源(代码已核对)

| # | 症状 | 根源 |
|---|---|---|
| 1 | 松开后无反馈 | `stopRecordingToConfirm` 直接置 `confirm` 态,框空、无"转写中"状态(识别 5-10s) |
| 2 | 转写双写(对话流+编辑框) | `useVoiceChannel` 的 `asr.final` 分支不分模式:一律 push transcript;`Chat.tsx` 回填 effect 又从 transcript 读最新 final 进 draftText |
| 3 | 思考中悬挂后消失 | 同一分支 `thinking: final ? true` ——hold 轮 daemon 已拦 Brain,console 仍乐观置位,由兜底定时器清空 |
| 4(隐藏) | "取消"实际直发 | `cancelRecording` 调 `voice.pttUp()`(不带 hold 标志)⇒ daemon 把 final 喂 Brain——取消变成发送 |

daemon 侧两条通路(直发 = `pttUp`/done_speaking 无标志;hold = `stopCaptureHold`/holdForConfirm)**已存在且正确**,本方案 daemon 零改动,全部是 console 交互层状态机补全。

## 1. 交互定义(11 §5.10 三态 → 四态 × 双动作)

**待命态**(idle):
- 主按钮「按住说话 · 松开发送」(主色,大)——动作 A
- 次按钮「按住转写 · 松开可改」(描边,同排)——动作 B
- 打字框+发送(现有);模式切换(免手/PTT,现有)
- 快捷键:空格按住 = A;Shift+空格按住 = B(文本框聚焦时不劫持,现有纪律)

**录音中**(recording):计时 + 电平条(现有)+ 松开去向提示(按 A 进入显示"松开即发送"/按 B 显示"松开后可修改")+「取消」按钮(Esc 同义)。

**转写中**(transcribing,新增,按动作分流):
- A(直发):按钮区回待命;**对话流立刻插入语音气泡占位**「语音 00:22 · 转写中…」(已发出语义,气泡带 spinner)——转写到达后**同气泡**替换为文字(保留时长标签),同时"思考中…"出现(Brain 真正开跑);
- B(编辑):**输入框区**显示「转写中…」spinner,发送按钮禁用(用户此刻手输文字则立即切回可编辑、后到转写不覆盖已输入)。

**待确认态**(confirm,仅 B):转写回填输入框,可改字,发送 → 进对话流 + 喂 Brain(现有 sendText 链)。

**取消语义(修 bug 4)**:取消 = 彻底丢弃——console 走 hold 信号(pipeline 需要轮次边界收尾,daemon hold 分支不喂 Brain),本地 captureIntent=cancelled,后到的 final **静默丢弃**(不进对话流、不进输入框);对话事实层零痕迹(hold 轮 daemon 本就不落对话转写)。

**超时兜底**:transcribing 95s 无 final(对齐 pipeline 识别总超时 90s + 余量)——A:气泡替换为「转写失败 · 点击重试」(点击删气泡回待命);B:输入框恢复待命 + 错误提示条。均不留悬挂 loading。

**免手档(hands_free)不变**:asr.final 直接进对话流 + thinking(现行为;VAD 自动断轮天然是"直发"语义)。

## 2. 实现设计(全部 console 侧)

### useVoiceChannel.ts

- 新状态:`captureIntent: null | "send" | "edit" | "cancelled"`(ref+state);暴露 `beginCapture(intent)` / `endCapture()`(松开)/ `cancelCapture()`。
- `endCapture`:A ⇒ `pttUp()`(直发链)+ 对话流 push 占位 `{ turnId: local-<ts>, text: "", final: false, transcribing: true, durationSec }`;B ⇒ `stopCaptureHold()`。
- `asr.final` 分支按 intent 路由(PTT 整段识别无 partial,分支互斥干净):
  - `send`:找到占位气泡 ⇒ 替换(text=转写、turnId=真 id、transcribing=false)+ `thinking=true` + 清 intent;
  - `edit`:**不碰 transcript、不碰 thinking**——`pendingDraft` 状态置转写文本 + 清 intent(Chat 消费进 draftText);
  - `cancelled`:静默丢弃 + 清 intent;
  - `null`(免手/其他):现行为(进对话流 + thinking)。
- `TranscriptItem` 扩 `transcribing?: boolean; durationSec?: number`。
- 超时:beginTranscribing 时起 95s 定时器,final 到达清除;触发 ⇒ intent 对应清理(A 置气泡 failed 态 / B 置 `pendingDraftError`)。

### Chat.tsx

- `inputState` 扩:`"idle" | "recording" | "transcribing" | "confirm"`(transcribing 仅 B 占用输入区;A 的转写中不占输入区——占位在对话流气泡上)。
- 录音中记录当前动作(A/B)供提示与松开分流;`cancelRecording` 改走 `cancelCapture()`(修 bug 4)。
- 待确认回填改为消费 `voice.pendingDraft`(**删除现"从 transcript 读最新 final"的回填 effect**——问题 2 的另一半根源)。
- 气泡渲染:`transcribing` 项显示「语音 {mm:ss} · 转写中…」+ spinner;失败态「转写失败 · 点击重试」;正常语音轮带小字时长标签(owner 的"语音下面挂着文字"呈现)。

### daemon / pipeline

零改动(两条通路已在;hold 轮不落对话转写、不喂 Brain 已实施)。

## 3. canonical 回写(同批)

- 11 §5.10:输入区三态 → **四态 × 双动作**表(上文交互定义收敛进规范;气泡占位/超时兜底/取消语义)。
- 10 §3(桌面输入交互):补双动作语义句(直发=低摩擦主路径;转写编辑=纠错通道;取消=零痕迹)+"转写中"反馈纪律(任何异步等待必须有状态呈现,不允许静默等待)。

## 4. 测试

- Playwright(console):A 档松开 ⇒ 气泡占位出现 ⇒(注入 asr.final)⇒ 气泡替换+思考中;B 档 ⇒ 输入框转写中 ⇒ 回填可编辑 ⇒ 发送才进对话流;取消 ⇒ 后到 final 零 UI 变化;超时 ⇒ 失败态。
- hub 注入通道(inject)喂 asr.final 驱动(现有测试设施)。

## 5. 边界与不做

- 免手档交互不动;S2/审批环不动;移动端(T2)沿用桌面语义待后批;
- 占位气泡不落 daemon 侧持久(纯 console 呈现;对话事实以 daemon 转写为准——直发轮 daemon 本就落转写);
- "语音气泡可点播放原音频" P1(audioSegmentRef 留口,09 §1 已有)。
