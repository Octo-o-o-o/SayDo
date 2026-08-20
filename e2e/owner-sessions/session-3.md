# 场次③ 现场清单 · P0 总验收(Phase 5 出口挂账)

> 目的:P0 阶段"可日用 + 界面可视"的真人确认——11 页控制台走查 + 真麦故事一 + 延迟实测表，
> 并承载 W4 的 OctoBlog 首篇 writing 全链验收。
> 故事一 x3 已由注入通道稳定复现(story-acceptance.test);本场次 = 真麦体感版 + 界面走查。
> 时长预估:30 分钟。
> **发布证据锁**:本场 runtime SHA 必须与场次①②相同；任一场通过后若代码、有效配置或 SHA
> 改变，四场发布证据失效，须从场次①重新开始。

## 0. 修订(2026-07-25 五路面板走查)

- 前置不变(场次①②已过);**本场必须紧跟场次②**(看板真数据来自②的 dogfood 残留,"禁空壳"才成立)。
- **走查口径预先豁免**:Chat 右栏"任务卡草稿/就绪自省"可视化 P0 是空态引导(无数据源),不按"空壳"判 fail。
- **延迟表结构性口径预告**:P0 链路 = PTT 整段识别 + 非流式 LLM(响应到达近似首 token),EOU→首响 1.0s 目标大概率贴边或超——这是架构口径不是故障;体感结论记录时区分"供应商/架构"与"实现 bug"。
- 审批页"已终局收据再操作 → 置灰不可消费"升为必看项(单次消费的视觉证明)。

## 前置

- 运行 `scripts/runtime-preflight.sh <开场前记录的40位-runtime-SHA>`，保存含双方 loaded SHA
  与 fresh readyz 的 `[ok]` 输出；
  耳机；场次①②已过(本场次是总口径,不重复其细项)。禁止另起 `just dev` 验到开发树。
- OctoBlog writing 项目已创建并绑定 `~/WorkSpace/OctoBlog`；若现场创建，不设置新的项目覆盖，
  创建后重跑 preflight，release config digest 必须仍与场次①②一致，否则四场从①重跑。
- (可选)owner 录真人音频底板 5 条 → 重跑 `pipeline/.venv/bin/python e2e/smoke/audio-smoke-5.py`(替换合成底板,烟测口径转正)。

## 步骤与预期

1. **11 页走查**(console;亮暗各扫一遍,主题切换在顶栏):
   Dashboard(待处理聚合条:ready_for_review 恒首位)/ 对话 / 任务看板(StatusChip 单源四联映射)/
   任务详情(AC 三条证据视图 + S3 合并按钮 = 屏幕强认证样式)/ 记忆(trust 分层徽章)/ 产物(版本链)/
   项目设置 / 审批(终局卡置灰 = 单次消费视觉)/ 通知(升级链时间线)/ 成本(unknown = "还没有确切数字",**禁 0**;订阅 = "订阅额度内")/ 全局设置(gate0 显式状态)。
   - 预期:每页真实功能真数据(禁空壳);零 emoji;状态词合规。
2. **真麦故事一**(01 §5 Tier1 版):开口派单 → 采访 → 拍板 → 后台执行+逐条审批 → 回叫 →
   验收 approve → S3 Touch ID 合并(人工 fallback 另记)→ task_done。
   - 预期:除 S3 合并确认与开麦外不碰键盘。
3. **延迟实测表**:真麦会话 >=20 条后,`GET /dev/latency-report`(带 capability token)。
   - 预期:五段分解(vad_end→asr_final→llm_first_token→tts_first_byte→playout)P50/P90 表;EOU→首包 P50 在内标 1.0s 内(发布上限 1.5s)。M3 埋点采集/分解/端点就绪,>=20 条实测表在本场次产出(p0-readback staged 第 6 条收口)。
4. **音频底板转正**(若步骤 0 已录):烟测尾行从"合成底板"注记转真人底板。
5. **OctoBlog 首篇 writing 全链**:围绕一篇真实文章完成聊题 → 写作 → 逐节
   approve/request_changes → 定稿，并核对 article artifact 版本链。
   - 预期:writing 类型真实生效；逐节裁决不串证据；最终状态与文章质量由 owner 判断。
   - 本项是独立首发验收门；未跑或未通过时，本场 overall 不得记 `pass`，场次④不得解锁。

## 失败回退

- 页面数据异常 → F12 截图 + `~/.saydo/logs/` JSONL 定位(日志/审计分流);
- 延迟超标 → 分解表定位段(ASR 段看火山侧;TTS 段看 doubao 首包;LLM 段看 OpenRouter 路由),供应商侧问题记录不阻塞(SLO 是内标);
- 一次针对性返工后复验,再不过上浮。

## 运行记录

| 字段 | 当前值 |
|---|---|
| status | `not_run` |
| 日期 | 待约 |
| runtime SHA | 待开场记录 |
| release config digest | 待从本场 preflight 原样记录；须与场次①②相同 |
| OctoBlog writing status | `not_run`；只有 `pass` 才允许本场 overall 为 `pass` |
| 故事一合并路径 / origin | 待注明 Touch ID 主路径或人工 fallback，以及 `live` / `fixture` / `test` |
| owner verdict | 待 owner |
| evidence origin | 待注明；本场通过只认 `live` |
| 证据 | 待填写页面走查、任务链、延迟表与 OctoBlog 逐节验收/artifact 引用 |
