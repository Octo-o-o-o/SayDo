# 场次① 现场清单 · 真人语音体感(Phase 1 出口挂账)

> 目的:戴耳机与 Brain 采访式对话——打断正确、挂起重建无缝、术语识别可用。
> 工程侧全部就绪(音频注入级测试绿);本场次验的是**真麦/真耳朵的主观体感**,AI 无法代跑。
> 时长预估:15-20 分钟。
> **发布证据锁**:场次①至④必须使用同一个已部署的 40 位 runtime SHA；任一场通过后若代码、
> 有效配置或 runtime SHA 改变，既有场次结果不再构成本次发布证据，须从场次①重新开始。

## 0. 修订(2026-07-25 五路面板走查;接线批完成后二次修订——挂账步骤已解锁)

- **console 入口**:浏览器开 `http://127.0.0.1:47100/?token=$(cat ~/.saydo/.cap-token)`(生产形态,推荐);
  47120(vite dev)**接线批修复后也可用**(api.ts 同源化 + vite proxy 转发 API/WS,Playwright 已覆盖)——
  开发热更新时用,体感验收仍建议 47100。token 首次入 localStorage 后可省参数。
- **接线批(HANDOFF §2-9)已完成,原挂账步骤全部解锁**:step 1 "开口即建 draft"(live 工具环已接;
  右栏任务卡草稿可视化仍是空态引导,数据展示 P0 后续)、step 4 挂起重建(SessionManager live 构造 +
  空闲 45s 挂起 + 转写落盘 `~/.saydo/sessions/<id>.jsonl`)、step 5 热词纠正生效(addHotword 工具 +
  asr.hotwords 下发 + recognize 偏置传参)。
- 打断验收口径:"立即停+划线"与"未播完不当已听"(unheard 过滤:被打断句不入 Brain 对话史)都可验。
- `/dev/latency-report` 用法:`curl -s "http://127.0.0.1:47100/dev/latency-report?token=$(cat ~/.saydo/.cap-token)"`。

## 前置(开场前 2 分钟,AI 可代跑)

| 检查 | 命令/动作 | 期望 |
|---|---|---|
| runtime 服务 | `scripts/runtime-preflight.sh <开场前记录的40位-runtime-SHA>` | 单条 fail-fast 同时断言磁盘与两进程 loaded SHA、clean、runtime 路径及 fresh readyz；console 用 47100 生产入口，禁止另起 `just dev` 验到开发树 |
| key 可用 | `bash e2e/spikes/asr-1.0/check-asr-auth.sh` | 流式 sauc + 录音 auc 双资源全通 |
| 耳机 | 系统输入/输出设备选耳机 | 绕开外放 AEC(05 §P0 口径) |

## 步骤与预期

1. **开口即建**:console 对话页(Chat),按住 PTT 说"我想给博客加个 RSS 输出"。
   - 预期:松手后 1-2s 内出转写;Brain 以采访式回应(先问关键问题,不瞎附和);开口即建 draft 项目。
2. **采访环**:连续答 2-3 个问题(目标/范围/验收各一)。
   - 预期:问题带选项(≤3 个)、每问改变 outcome/scope/acceptance(不问废话);问题预算耗尽必停。
3. **打断**:趁 TTS 播报长句时直接插话("等等,不对")。
   - 预期:播报**立即停**;被截断句 unheard 不进事实——Brain 后续引用时不把没播完的话当"你已听到";接续话术自然。
4. **挂起重建**:说"先这样,我过会儿再说",等挂起;约 1 分钟后再开 PTT 说"刚才说到哪了"。
   - 预期:重建第一句 = 原因/进度衔接;上下文连续(packDigest 一致 + turnId 连续),不重新自我介绍、不丢已答信息。
5. **术语体感**:说一句含仓内术语的话(如"把 contracts 包的 digest 测试跑一遍")。
   - 预期:术语命中(热词偏置;合成语料实测 65.3% 术语召回,真人预期更好);误听可用"不是 X,是 Y"纠正并生效。
6. **状态词纪律抽听**:全程留意——执行类表述不得出现"完成/做完"。

## 失败回退(计划风险表:一次针对性返工后复验,再不过上浮拍板)

- 打断不即时/unheard 泄漏 → 查 `voice-hub` watermark 日志(注入级测试是绿的,现场差异先怀疑音频设备缓冲);
- 识别不可用 → 现场把误听词加进热词(2.4 M0 链路)复测;仍差则登记真实误听进 golden 回归集;
- 重建断链 → 保留 `~/.saydo/` 现场数据 + `sessions/<id>.jsonl` 转写,回会话排查;
- 延迟体感差 → 看 `GET /dev/latency-report`(带 capability token)分解表定位段。

## 运行记录

| 字段 | 当前值 |
|---|---|
| current_status | `failed` |
| historical_attempt | `failed` / partial；已有真实反馈，不计通过 |
| 日期 | 2026-07-31 09:40 +0800；历史尝试 2026-07-30、2026-07-26 |
| runtime SHA | `ada7981c67ef3a07e6df0431643bb8b7661e22d4` |
| release config digest | `90e35db971e7006303dbbfdb99b6d186e7e8beb5132be760d19531c8acf90207` |
| owner verdict | `failed`；聚焦返工已部署，等待 owner 按同一清单从步骤 1 重新复验 |
| evidence origin | `live` |
| 证据 | `history/PROCESS-JOURNAL.md` R47/R56/R57 |

### 2026-07-30 live 观察

- 首轮转写为“我想给博客加一个 RSS 输出。”；ASR 约 2.44 秒出 final，中文准确。
- “OctoBlog”被识别为“Oct block”；owner 评价中文很好、英文稍差。
- Brain 首次问“新事情，还是接着哪个项目继续？”属于合理的归属确认。
- owner 随后语音回答 OctoBlog，并再以文字明确输入 `~/WorkSpace/OctoBlog`，Brain 仍第三次
  重复同一归属问题；右栏没有项目草稿进展，因此步骤 1 的“归属定锚后进入采访”未成立。
- 生产库只有新建 pending draft，OctoBlog 目录真实存在但未登记为 project；生产代码中
  `reanchorDraft` 只有 lifecycle 原语，没有 live tool/API 调用点，也没有现役项目登记写口。
  当前系统要求 Brain 确认归属，却没有可消费该确认的生产动作，构成重复追问闭环缺口。
- 首轮 latency trace：ASR final 约 2.44 秒，收音结束至 playout 约 12.79 秒；应分别评价
  识别反馈与整体回应体感，不能把后者写成 1–2 秒。

### 2026-07-31 聚焦返工状态

- 判断：首次询问项目归属合理；用户已经给出明确路径后继续问同一问题不合理。英文
  “OctoBlog”误听是 ASR 热词候选，但不是重复追问的根因；明确路径应成为更强的机械身份源。
- 本地工作树已实现：显式路径轮在进入 Brain 前由 daemon 预路由；exact 已登记路径直接
  进入封闭确认；`resolveProject` 对含路径、零匹配、多匹配 fail-closed；旧异步轮不得再调
  工具或口播，tool 内 provider 返回后也必须在写草稿/候选/包前重验现势；通用归属问题先
  落 durable 状态再尝试 TTS，孤立 `reserved` 重启后保守阻断重复问。
- durable accept 与 post-commit 事件投递、readiness/Pack 重建已拆成不同错误域；后两者
  异常只报告 degraded，不再把已提交的项目归属说成“这轮没改”。生产和测试共用真实双
  revision 重建器。
- daemon/pipeline 心跳新增 `stateRootDigest`，preflight 将对账实际运行中的
  `SAYDO_HOME`，不再只信磁盘 plist。
- 两路最终独立复审均为 A=0、B=0、C=0。Codex 终验 45 找到前句末尾 connector 的边界
  误判，最小回修并补负例后，终验 46 判可放行：A=0、B=0、C=0。
- 最终 `just ci` exit 0：contracts 73 passed、console 2 passed、daemon 781 passed /
  4 skipped（68 files passed / 2 skipped）、Python 31 passed；typecheck/lint、emoji
  gate、自测 11/11、migration tools 与 ruff 全绿。
- 修复代码已提交并部署为 `ada7981c67ef3a07e6df0431643bb8b7661e22d4`。最终快照
  `/Users/wangyixiao/.saydo/backups/20260731T013926Z` 通过摘要、SQLite `quick_check`
  与真实 consumer 隔离恢复演练；临时恢复根已移入 Trash。
- 部署后 preflight 对账 daemon/pipeline loaded SHA、状态根、fresh readyz 与 clean
  runtime；pipeline 重连成功，ASR/TTS 均为 `ok`，现役 SQLite `quick_check=ok`。
  console voice hello/ack smoke 通过，未 dispatch、未消费审批。
- 场次①仍维持 `failed`，不能把自动门禁或连接 smoke 写成 owner 真人复验通过；下一步必须
  由 owner 从步骤 1 重新开始。push/tag 仍未授权。
