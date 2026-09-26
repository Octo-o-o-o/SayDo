> 2026-09-25 入库注:历史记录,当前处置见 e2e/evidence/sc-reland-01.md。

# 2026-09-12 附件吸收:逐项取舍与已实施界限

> 附件:`SayDo_Codex_Handoff_2026-09-12`。本文件记录最初入口批的取舍,以及随后为安全续接补上的 09 §10.1 合同修订与接线边界;不是排产源,也不再声称「全程不改合同」。本批不开工 PG-02。docs/08 草图整体 tsc 失败只说明原定义不完整,本任务不扩修整份架构文档。

## 1. 吸收什么

| 附件项 | 裁决 | 本批落点 |
|---|---|---|
| White Edition 层级/留白/可读性 | 吸收到已改区域 | Focus 右栏说明、窄屏安排按钮、Chat 续接条、TaskModal 状态行;沿用现行纸上账本 token,不改全站品牌 |
| Focus 安排点击 → 真实实体 | 吸收 | `resolveFocusLocate` 开 TaskModal;缺失 toast,不跳到空位置 |
| 期待沟通 | 吸收为草稿续接 | `expectationChatDraft` + `pendingAnchor` 进 `#/chat-new`;不自动发送;不写 durable expectationId(产物派生,无调整口可对) |
| 主题续接必须先锚定 | 吸收 | `planChatSend` / `canSendThemedContent`;锚定失败留当前草稿;发送成功才消费当前 owner 的 sessionStorage 副本 |
| Records 续推标题 | 吸收 | `resolveLaneTitle`;合成线 `{id:"__main__", title:"主线"}` 传 `laneTitle:"主线"`,不用 laneId |
| 任务弹窗真实状态 | 吸收 | `parseTaskDetailPayload` 认 `getTaskDetail.task`;详情与 task-context 分离;终态不默认叫停/steer |
| 确认卡实体一致 | 吸收 | `confirmCardMatches(receiptId)` |
| 文本/语音发送失败留稿 | 吸收 | 文本/系统语音/云端 PTT/handsfree 共用当前 session 身份 |
| Fork | 诚实提示 | 不伪造已实现;用户文案不提实施术语 |

## 2. 明确不吸收 / 不重做

| 项 | 原因 |
|---|---|
| 附件 mockAuth、模拟进度/成本/计时器、场景跳转 | 演示逻辑,禁止进生产路径 |
| EMAIL-A / GAP-02 | 已收口,不重做 |
| PG-02、`direct_to_review`、移动 merge、记忆/ASR 重构 | 各自批次与验收 |
| 真实邮件 / 真机 / 语音体验 | 本批本地基线不覆盖 |
| daemon `.../expectations/:id/adjust` | 派生期待没有 durable id,不得调用 |
| 新增状态机或重复 retry/blocked UI | 复用 TaskDetail 取消集合与详情页 |
| 放宽 `mobileFocusDetailSchema` | 合同形状不动;只在消费端投影后再校验 |

## 3. 当前已有能力(本候选)

- Focus 侧栏安排打开对应 obligation 的 TaskModal;产物/项目仅在节点存在时滚动。
- TaskModal:先拉真实详情,再单独 POST task-context。Focus 未挂 Chat WS、session 不存在时详情仍可见,办结/叫停等独立写口可用;发送必须当前 session + nonce 且发送成功,可重试不丢稿。不自动创建会话。
- 「我期待一个 X」与期待组编辑:只带 Focus 标题进对话草稿。
- Chat:`POST /api/sessions/:sessionId/focus-anchor`,新 console 必须已握手 `peerId`/`daemonEpoch` 才进入屏障:本地停采(不先发 `voice.mode`),`voice.anchor_prepare` 后再带 `requestId` 写锚;缺握手保稿等待,不超时改走 legacy HTTP。无 pending 的普通对话可发。跨 Chat 卸载用共享串行所有权,旧 POST 不能晚覆盖新 focus,也不能把旧草稿写回共享存储。
- **主题锚定语音屏障 = 本候选已接线处理链**(合同 09 §10.1 / 10 §3-9 / 11 §5.10)。同条 console WS:`hello.ack.peerId/daemonEpoch` → 停采/`done_speaking{captureId,captureIntent}` → `voice.anchor_prepare` → daemon 关门 → pipeline `voice.quiesce`/`voice.quiesced` → HTTP apply(`requestId`,无 `voicePeerId`) → `voice.mode ptt` + `quiesceRequestId` → `rearmed`。PTT 按 `captureId` 认轮;HF 不消费 PTT FIFO;失败标记跨空 tail/切模式保留,仅合法当前 epoch discard 后清;新 HF final 必 `recognitionOutcome:"ok"`。`pendingAnchor` 在 HTTP/`prepared`/`rearmed` 时不清未发送草稿;`turn.text` 桌面路径以 `turn.text.result.accepted` 为接收,rejected/unknown 保稿。未实现/未验:真实麦克风与云 ASR、完整 `just ci`/全 Playwright(主控冻结后跑)、docs/08 草图整体补全、`via=mobile_lan` 业务 HTTP、Gate0/S3 扩大。无 pending 时免手/PTT 普通路径仍可用。
- TaskModal task-context 跨弹窗串行写:同会话关 A 开 B 时,B ready 排在 A 的 POST/cleanup 之后;旧 A 不得 UPSERT 覆盖 B,也不得用旧 nonce DELETE 掉 B。
- 主题草稿发送成功会清 sessionStorage 里当前 owner 副本;下一次编辑只写新稿,离开重进不回填已发送文本;不清其它 owner 新稿。
- Records「在此线续推」用真实线标题。
- TaskModal 确认卡文本与按钮共用 Receipt + session 身份;重试与首次建立共用失效代,关闭后迟到成功会 DELETE nonce。
- 桌面 1440 走 redesign Focus;viewport 390 切独立 MobileApp。手机消费 `GET /api/focuses/:id` 的 daemon 全量包(含 events 额外字段、repos/artifacts),先投影再走现有 `mobileFocusDetailSchema`。`getMobileFocusDetail` 投影函数仍存在;LAN `via=mobile_lan` 的 HTTP 业务 `/api/**` 现役为 403(`remoteHttpBusinessDecision` / `mobile_lan_route_rejected`),合同 `docs/11-ui-spec.md` §5.6b 标 designed/deferred(DF-REMOTE-REOPEN)。390px 本机截图只证明本机窄视口 MobileApp,不能证明 LAN 业务入口可用。
- 手机入口:Focus → 主线泳道 → 安排卡,可查看并办结/放下真实 obligation。
- CLI **源码** `packages/cli` 已有 `saydo doctor`;**发布包 v0.1.0-rc.12**(tag `7a9b6e8`,2026-08-26)只有 `up`/`status`/`open`。

## 4. 未验界限与证据口径

- 本修复跑 focused 单测(contracts 屏障 schema、daemon VoiceHub 处理链、pipeline HF final/失败标记、console voiceAnchorFlow/回执门)、console lint/typecheck、Python 相关 tests、`pnpm exec playwright test e2e/console/real-entry.spec.ts`。截图另存仓外任务目录 `evidence/repair11-browser/`,不覆盖 repair10 基线。完整 `just ci`、全 Playwright、`just precommit` 由主控冻结后跑。完整语音硬件/云 ASR 仍未验。本修复不是独立 GREEN。
- e2e 里这些是**受控故障注入/夹具**,不是真服务端全链:
  - `focus-anchor` 503 / 离线 abort:续接失败与离线草稿。
  - Focus GET 注入无时间线锚点的产物:验证不会跳到空位置。
  - `GET /api/attention` 先用 API 快照再静态追加 running/done 任务:只保证今天页有确定入口;弹窗仍请求真实 `/api/tasks/:id`。拦截不用在途 `route.fetch`,避免用例结束后拖垮下一条。
- 手机 390 测的是独立 MobileApp 消费边界:先投影 daemon 全量 Focus 再走现有 schema,从 Focus → 主线泳道 → 安排卡查看并给出办结/放下。不是把桌面 RailSummaryStrip 缩到窄屏冒充手机,也不把 viewport 改成 900。
- 未做托管 CI、真机、真实邮件、真实语音、S3 合并。
- 决策包 / standby / interview / 完整 Focus composer 仍是 toast 占位。
- 未 commit。

## 5. 附件全文件分组覆盖

证据源:`/opt/saydo-fixture/handoff-attachment`。下表按组给出去向,不逐张复述图片,也不宣称附件能力已全部落地。

| 分组 | 附件内路径 | 去向 / 本批处置 |
|---|---|---|
| 根清单 | `README.md`、`FILES_AND_CHECKS.md`、`CODEX_START_PROMPT.md` | 交接索引与完整性清单。只作证据源,不进生产路径;实施以本仓 `docs/01–11` 与现有入口为准 |
| 01–17 主题文档 | `docs/01_SESSION_DECISIONS.md` … `docs/17_HISTORICAL_QA_RECORDS.md` | 01/06/07/09 的层级、入口与「能点≠已接线」进入本文件 §1 取舍;02/03/05/11/12 商业/竞品/架构/实验/排产不吸收;04/10/13/15/16 作对照与未验界限;08 mock 状态禁止进生产;14 HTML 索引只对照原型;17 历史 QA 不重跑、不把旧 pass 当本批验收 |
| archives | `archive/SayDo_最终建议与行动路线_2026-09-11.md`、`SayDo_最终综合建议_2026-09-11.md`、`SayDo_最终合并建议与行动路线_v2_2026-09-11.md`、`SayDo_Demo_使用与演示指南.md`、`SayDo_Demo_检查说明.md`、`SayDo_White_Edition_说明与检查.md` | 原文层,字节不改。建议/路线不改本仓排产;Demo 指南与检查说明只对照原型边界 |
| HTML 原型 | `references/previous_demo/SayDo_Investor_Demo.html`、`references/white_edition/SayDo_Investor_Demo_White_Edition.html` | 视觉/留白参照。不移植 mockAuth、模拟进度/成本/计时器;White 已改区域见 §1 |
| 概念图 | `references/concept_images/*.png`(9 张) | 早期概念,文字有已知错误。不逐张落地;不继承项以附件 06 为准 |
| 初版预览 | `references/previous_demo/previews/*.png`(5 张) | 旧演示截图,只作对照,不当生产 UI |
| White 预览 | `references/white_edition/previews/*.png`(5 张) | 已认可视觉参照,吸收到已改区域的留白/层级,不改全站品牌 |
| 检查 JSON | `references/previous_demo/checks/检查结果.json`、`references/white_edition/checks/qa_report.json`、`type_checks.json` | 历史检查归档。未重跑,不把其中 pass 写成当前入口已验 |
