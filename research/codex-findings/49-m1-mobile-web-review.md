# No-Go

存在 6 项 A 级问题，其中包括 LAN 权限面越界、审批身份混淆、撤销后产生伪收据、文本静默丢失，以及 CardResolver 误判。当前状态不具备 M1 验收条件。

## A 级：6 项

### A-1. `mobile_lan` WS 继承了桌面 console 的完整控制面

- 代码证据：[voice/hub.ts:110](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:110) 给所有 console peer 开放 `audio.frame`、`tts.playout`、`latency.stage`、`voice.mode`、`confirm.click` 等消息；[voice/hub.ts:383](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:383) 只按 role、不按 `peer.via` 授权；[voice/hub.ts:454](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:454) 和 [voice/hub.ts:487](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:487) 会把音频元数据及二进制麦克风帧转给 pipeline。
- 反例：官方移动树复用主 Provider，连接后会自动发送 `voice.mode`，[useVoiceChannel.ts:389](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:389)；手机仅打开页面就能改 pipeline 采集模式。持 token 的移动 WS 还可自行发送麦克风帧、播放水位或旧 `confirm.click`。
- 规格依据：[v3.2:125](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:125) 明定 M1 话筒只聚焦输入；[v3.3:143](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:143) 要求 daemon 最小白名单。
- 最小修法：在绑定 session 和 dispatch 前按 `peer.via` 加独立上行白名单。`mobile_lan` 只留 `turn.text`、`confirm.decision`、heartbeat；如需 `voice.mode` 绑定，只登记 session，不转发 pipeline；拒绝移动来源二进制帧。

### A-2. 移动裁决来源被抹成 `voice`，可用未配对 LAN 面释放 S2 gate

- 代码证据：`onConfirmDecision` 只传消息、不传来源，[voice/hub.ts:49](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:49)、[voice/hub.ts:429](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:429)；装配层继续丢失来源，[index.ts:2180](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2180)。runtime-effect 分支忽略 `click` channel，并在 [dialog.ts:1583](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:1583) 和 [dialog.ts:1592](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:1592) 硬编码 `via:"voice"`。
- 反例：S2 `runtime_effect` 会进入 pending confirmation 和移动 Today；手机点击“做”后，receipt 被消费、gate 放行，审计却记成语音裁决。用户没有说话，`mobile_lan` 又被 canonical 明定为非设备配对面。
- 规格依据：[docs/09:303](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:303) 的审批矩阵没有 `mobile_lan` 身份档；[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136) 明定该面不等于设备配对。
- 最小修法：把 `peer.via` 传到裁决入口。M1 先对 `mobile_lan + runtime_effect` fail closed，并从移动 attention 排除这类卡；若产品决定允许，须先新增 canonical 的 `decidedVia/authStrength`、DDL 和审计口径，不能伪装成 voice。

### A-3. `withdraw` 解除内存 gate，却把审批 receipt 留在 `pending`

- 代码证据：[dialog.ts:953](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:953) 先撤确认卡，再调用 runtime flow；[approvalFlow.ts:271](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/approvalFlow.ts:271) 只删内存 pending、清 timer、`resolve(false)`，没有任何 receipt 状态迁移。之后 [approvalFlow.ts:239](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/approvalFlow.ts:239) 即使内存项不存在，仍会把数据库 pending receipt 接受并消费。
- 反例：手机点“撤销”后 gate 已返回 false、命令不会执行；桌面审批页仍把该行视为可裁决，[Approvals.tsx:49](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/pages/Approvals.tsx:49)。再点“批准执行”会收到 200 和 `consumed` receipt，但实际命令永远不会跑。
- 规格依据：[v3.3:145](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:145) 要求 withdraw 只撤下当前卡；[docs/09:314](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:314) 的唯一合法 receipt 转换也没有当前这种半态。
- 最小修法：runtime-effect 的 withdraw 只撤 presentation，保留 gate 等桌面裁决或超时；或者先立 `withdrawn` terminal 合同并与 gate 原子终局。补“撤销后再 accept”回归，断言不能出现“receipt consumed、命令未运行”。

### A-4. recovery 模式随 LAN 开关监听 `0.0.0.0`，无认证泄露完整配置诊断

- 代码证据：[recoveryOnlyServer.ts:201](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:201) 在身份门之前返回完整 `input.violations`；[recoveryOnlyServer.ts:485](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:485) 在 `SAYDO_MOBILE_LAN=1` 时绑定 `0.0.0.0`。Violation 可含 `slot/message/fix`，[validate.ts:8](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:8)。
- 反例：活动配置非法时，LAN 任意主机无需 token、无需私网 Host/Origin 校验即可请求 `/readyz`，取得模型槽、错误原因和修复处方。
- 规格依据：[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136) 只豁免“无业务 payload”的 health/readyz；v3.3 要求最小访问面。
- 最小修法：recovery-only 保持 loopback；或把无认证 `/readyz` 收窄为状态布尔值，完整 violations 只放在本机受信 setup API。增加 recovery 进程级反例。

### A-5. 文本仍存在断线竞态下的静默丢失

- 代码证据：[MobileApp.tsx:39](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/MobileApp.tsx:39) 在调用 `voice.sendText` 后无条件清空 draft 并跳 Chat；[useVoiceChannel.ts:699](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:699) 在 WS 非 OPEN 时直接返回，且返回值为 `void`。
- 反例：渲染时 dstat 还是 online，但 socket 在点击前刚关闭；`sendText` 静默返回，随后草稿被清空、页面跳转，用户文本永久丢失。
- 规格依据：[v3.3:152](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:152) 明定断线禁发且“不再静默丢文本”。
- 最小修法：让 `sendText` 返回明确的 enqueue 结果；只有成功时清空和跳转，失败保留 draft、切 offline 并显示回执。补 socket 在点击前关闭的回归。

### A-6. CardResolver 会把账本中仍存续的 obligation 判成 stale

- 代码证据：泳道从当前 Focus 快照构造并缓存 obligation，[LanePage.tsx:27](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/LanePage.tsx:27)；Card 页也取到了当前 snapshot，[CardPage.tsx:53](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:53)。但 resolver 只承认终态 snapshot，[cardResolver.ts:43](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:43)，非终态只要不在 attention 就落 stale，[cardResolver.ts:60](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:60)。
- 反例：green/gray obligation 被 ack 后会从 attention 过滤，[attention.ts:442](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/attention.ts:442)，但仍是 `status:"open"`。从泳道点开时，页面错误显示“已不在待办里”，尽管同次 Focus 快照证明它仍存续。
- 规格依据：[v3.3:151](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:151) 只允许真实 stale 使用模糊回执；[v3.3:154](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:154) 要求五态判别联合。
- 最小修法：当前 snapshot 为非终态时返回 live/read-only，stale 只用于 attention 消失且当前实体也无法证明存续的情况。补“已 ack、仍 open”的 L3 到 L4 回归。

## B 级：8 项

### B-1. M-Confirm 精确文案失真，并伪造统一“泳道捡回”能力

- 代码证据：[CardPage.tsx:138](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:138) 把 `prompt_text` 改写成“按「…」继续”；[CardPage.tsx:148](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:148) 对所有确认声称“可从泳道捡回”。实际只有单条 `focus_obligation` 才生成 downgrade payload，[confirm.ts:365](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/confirm.ts:365)。
- 反例：runtime approval 也会看到“泳道捡回”，但没有 Focus/泳道降格路径。
- 规格依据：[docs/11:221](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:221) 要求“做”的副文字逐字复述 `prompt_text`，且不得伪造现有数据不能证明的内容。
- 最小修法：副文字直接渲染 `item.title`；删除通用泳道承诺，除非 attention 明确投影了可证明的确认 kind。

### B-2. `missing` 状态声明零动作，UI 却始终提供“去泳道看”

- 代码证据：[cardResolver.ts:66](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/cardResolver.ts:66) 返回 `allowedActions:[]`；[CardPage.tsx:155](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/pages/CardPage.tsx:155) 的通用状态页仍无条件渲染链接。
- 反例：直接访问不存在的 `/m/card/task/nope`，按钮文案是“去泳道看”，实际 `back` 为 `/m`，既违反权限联合又误标目标。
- 规格依据：[v3.3:154](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:154) 要求每态显式允许动作。
- 最小修法：按 `resolution.allowedActions` 渲染；missing 不显示动作，只有具备真实 focus/lane 目标时才显示 `open_lane`。

### B-3. 桌面 hash 缩窄视口后落入移动 404

- 代码证据：[router.ts:15](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/router.ts:15) 只识别 `/` 和 `/m/*`；[App.tsx:136](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/App.tsx:136) 在窄屏直接把该解析结果交给移动树。
- 反例：桌面停在 `#/today`、`#/focus/:id` 或 `#/chat-new` 后缩到 390px，会显示“移动页面不存在”，而不是对应移动页。
- 规格依据：[v3.3:154](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:154) 要求 `matchMedia` 实时切树。
- 最小修法：增加桌面到移动的反向映射或窄屏 fallback；补宽到窄切换并同时断言 Provider/WS 不重建。

### B-4. dstat 没有接入真实重连开始事件，离线时话筒也无法履行“聚焦输入”

- 代码证据：[dstat.ts:29](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/dstat.ts:29) 的 hook 从未 dispatch 已定义的 `connect_start`；已连接后关闭只进 offline，直到重新 open。与此同时 [MobileChrome.tsx:74](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/MobileChrome.tsx:74) 禁用了整个 input，而话筒唯一逻辑仍只是 focus。
- 反例：网络仍显示 online、WS 正在指数重连时，dstat 一直显示 offline；离线点击话筒无法聚焦 disabled input，也不能保留本地草稿。
- 规格依据：[docs/11:221](/Users/wangyixiao/WorkSpace/SayDo/docs/11-ui-spec.md:221) 只要求非 online 禁止发送，并要求话筒行为是聚焦输入。
- 最小修法：把 VoiceChannel 的重连尝试投影为 `connect_start`；输入框保持可编辑，仅发送按钮禁用。

### B-5. LAN canonical 与实际边界存在两处分叉

- 代码证据：[identity.ts:65](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:65) 对缺失 Origin 一律放行；[identity.ts:23](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:23) 接受 ULA IPv6 Host，但 [mobileLan.ts:7](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/net/mobileLan.ts:7) 只监听 IPv4 `0.0.0.0`。
- 反例：带私网 Host 和 token、但没有 Origin 的原始客户端会通过；反之 `[fd12::20]` 会被身份函数判为合法，却根本连不到 IPv4 listener。
- 规格依据：[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136) 承诺同 Host Origin 和 ULA 可达。
- 最小修法：按当前 v3.3 的 `0.0.0.0` 口径先删除 ULA 承诺及 allowlist；明确并统一缺 Origin 的策略，若 canonical 维持三道必备则对 `mobile_lan` fail closed。

### B-6. 移动 Focus 详情返回 UI 不消费的原始敏感字段

- 代码证据：[console.ts:505](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:505) 的完整详情包含原始 event payload、sessionId、repo note 和 artifact ref；[console.ts:622](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:622) 原样解析 `ref_json`。该 ref 合法包含任意 `path`，[artifacts.ts:18](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/artifacts.ts:18)。移动页只使用方向、obligation、lane 和轨迹摘要。
- 反例：产物 ref 中的本机完整路径会随 Focus 详情走 LAN 明文返回，即使移动页面完全不展示它。
- 规格依据：[v3.3:143](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:143) 要求 daemon 最小增量面；[docs/09:1136](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1136) 明示这是明文临时边界。
- 最小修法：为 `mobile_lan` 返回专用最小 Focus DTO，移除 repos、artifacts、sessionId 和未消费的原始 payload。

### B-7. CardRef 与四状态 DTO 没有进入 contracts，且 CardRef 缺并发身份

- 代码证据：[types.ts:95](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/types.ts:95) 的 CardRef 只有 kind/entityId/navigation hint；规格要求的 `revision|digest` 缺失，[产品方案:39](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:39)。四状态又分别定义在 [types.ts:21](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/mobile/types.ts:21) 和 [console.ts:343](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:343)。
- 反例：同一实体 ID 在缓存后发生 revision 变化，当前 CardRef 无法表达或检验该并发变化，只能靠启发式 stale。
- 规格依据：仓库硬规则要求 09 已有形状统一由 `@saydo/contracts` 导出；[focus.ts:1](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/focus.ts:1) 也声明 daemon 不应私定义合同形状。
- 最小修法：在 contracts 增共享 CardRef、mobile attention/focus DTO 和 fourState schema；daemon 与 console 都 import。若 M1 明确不要 revision/digest，应先把它命名为仅本地适配类型并回写 canonical。

### B-8. 新测试没有证明关键验收链

- 代码证据：
  - 进程测实际连接 `127.0.0.1`、仅伪造私网 Host，[mobile-lan-process.test.ts:8](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/mobile-lan-process.test.ts:8)；且子进程继承外层 `SAYDO_MOBILE_LAN`，[daemonProcess.ts:64](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/helpers/daemonProcess.ts:64)。
  - first-run E2E 完全 route mock，[console.spec.ts:149](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:149)。
  - “自愈”用例让 WS 始终失败，只证明再次超时，没有成功重连，[console.spec.ts:168](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:168)。
  - 视口测试只测窄到宽，[console.spec.ts:130](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:130)。
  - withdraw 测试只断言 gate=false 和卡消失，未查 approvals 行或后续重复裁决，[tier1-approval-live.test.ts:108](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-approval-live.test.ts:108)。
- 反例：A-1 至 A-6 均可在现有断言下漏过。
- 规格依据：[v3.3:154](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:154) 和 [v3.3:156](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-11-SayDo移动端完整方案-v1.md:156) 要求路由、dstat、真 LAN 链及默认关闭行为。
- 最小修法：补真实非 loopback 连接、Origin/token 反例、WS per-via 权限、真实 first-run、两方向视口切换、成功重连，以及 withdraw 后 receipt/gate 的二次裁决测试；默认关闭进程必须显式清掉继承环境变量。

## C 级：0 项

没有仅属建议而不影响合同或验收的发现。

## 已核实的通过点

Provider 的确位于分树外，[App.tsx:136](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/App.tsx:136)、[App.tsx:150](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/App.tsx:150)；桌面既有源码只有 `App.tsx` 被改。移动 CSS 选择器均受 `.m-root` 约束。Today 直接使用 `/api/attention`；attention 已投影 durable `expiresAt`；Focus 四状态当前由单个 CTE 聚合。未发现新增 emoji、执行状态禁词或 TTS 明文敏感信息。

## 验证边界

- 基线实读：`git rev-parse HEAD` 为 `415df2a86a5208c1f68672bab0c75618f3070594`。
- `pnpm typecheck`、`pnpm lint`、`git diff --check` 退出码均为 0。
- 同 emoji 门禁 Unicode 区间直接扫描无命中。
- `scripts/check-emoji.sh` 因只读沙箱禁止 `mktemp` 而未得出门禁结论。
- Vitest 因只读沙箱禁止创建 `.vite-temp`/系统临时目录，未执行任何测试，不能写成“测试通过”。
- 未修改任何文件；末次 `git status` 与评审开始时一致。

## 施工 triage 与终局改判（2026-08-11）

- 原 6A/8B 全部吸收：LAN 身份门加入不可伪造的 socket peer、严格 RFC 1918 Host/同源浏览器来源与真实进程反例；`mobile_lan` WS 缩到文本/定向裁决/会话登记/心跳，runtime gate 不由手机释放，withdraw 只撤 presentation；recovery-only 不消费移动开关。
- CardResolver 补齐五态与每态允许动作，非终态 obligation 保持 live、missing 零动作、无真实 Focus 目标不伪造泳道入口；移动 DTO、四状态与 confirm outcome 统一进入 contracts，Focus 详情改为最小脱敏投影。
- 路由改为宽窄屏双向映射，Provider 留在分树外；dstat 首连与每次重连均有界回 offline，离线只禁发送；first-run 改用独立 fresh HOME 真 daemon，不再以 route mock 充证据。
- 施工中一度为消息回执引入 durable outbox，终审证明其跨 Brain/tool 无法保证精确一次且超出 v3.3 daemon 四项白名单；最终删除整组 `turn.accepted`/outbox/额外迁移，移动输入直接复用分树外既有 VoiceProvider `turn.text`，不改变桌面协议。
- 最终验证：`pnpm ci:node` exit 0（contracts 91、console 86、daemon 1042）；M1/first-run Playwright 8/8；daemon M1 定向 139/139；结论改判 **Go，A=0/B=0/C=0**。
