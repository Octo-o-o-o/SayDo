# HANDOFF-3:UI 修正批施工交接(给 demo 作者 AI · 2026-08-09)

> 你的前两批(组件库/页面拼装)与对齐轮均已验收合并入 main 并推 GitHub。本批=五件独立 UI 修正(遗留清单 L1-L5),彼此无依赖,总量约半天。工作坐标:**~/WorkSpace/SayDo**(注意:仓库已改名并直连 GitHub,原 SayDo-console-build 已删),分支 main 直接施工(小修正批,commit 分件)。HANDOFF-1 的纪律门禁(tsc/test/build/emoji/状态词三级)与禁改域(daemon 逻辑/VoiceContext 语音逻辑)继续有效;**本批可读 daemon API 但不改 daemon 代码**。

| # | 修正 | 要点 |
|---|---|---|
| L1 | **思考中>20s 计时提示**(reasoning 模型 30-90s 常态,用户视角=死) | 对话页"思考中…"占位超 20s 后追加计时("已想了 N 秒,reasoning 模型想得久是常态");45s 兜底文案已有,勿动其逻辑,只在占位组件内加计时呈现 |
| L2 | **活跃会话段误标"中断"** | timeline 的 session_segment endTs=null 时:该 session 若为当前活跃会话(前端可知当前 sessionId)显示「进行中」;非活跃才显示「中断,截至最后事件时间」 |
| L3 | **会话段时间戳本地化** | ISO 原文改「今天 15:02 – 17:40」式(跨天带日期);全站已有 fmtTime 类惯例,复用 |
| L4 | **侧栏 focuses 同页不刷新** | 侧栏列表对 focus 创建/变更的感知:最简=轮询 30s 或订阅现有 ws 事件通道(若有 console 事件,查 useVoiceChannel 里的既有消息型复用);不发明新通道,轮询兜底即可 |
| L5 | **设置页模型槽位读真配置** | 硬编码表格改为读 daemon 配置 API(查现有 /api/ 是否有 config/models 端点;**若无端点,此件降级为「标注 数据待接线 的占位」并在汇报中说明**——不改 daemon) |

门禁:pnpm --filter @saydo/console exec tsc --noEmit / test / build 三绿+emoji gate;commit 中文分件;不 push(义骁或既白验收后推)。完成后汇报:五件逐项状态(含 L5 是否降级)+门禁真实输出。
