# SayDo 工程缺口扫描 · 架构 / 性能 / 工具 / 外部连接 / 交互(Fable,2026-09-05)

> 目的:回答「除了真实用户反馈之外,现在该把精力投到哪里」。只看架构、性能、工具面、外部连接、产品机制与 UI 交互,以及交付节奏本身;**不评真实用户使用体验与反馈**(owner 已在做)。
> 基线:分支 `codex/ecc-research-20260905` @ `bcf8ea8`(本会话 `git rev-parse`);只读静态扫描 + 本会话 `git log` / `wc` / `grep` 计数,**未运行产品、未起 daemon、未跑门禁**。
> 与 `2026-08-28-project-gap-closure-program.md`(下称「总案」)的关系:总案已登记 G-A1–A9 / G-B1–B17,本文**不重复**这些条目;凡与总案重叠处只引用 ID 并补充总案没写的证据。本文列出的 7 条主缺口里,第 1、2、3、4 条总案没有覆盖,第 5、6、7 条只被总案顺带提及。
> 状态:候选建议,不是排产源,不改 canonical;进入实施须经 `IMPLEMENTATION-PLAN-2.md` 唯一串行链。

## 0. 结论

SayDo 的主体代码已经很厚(daemon 63.8k 行、console 28k 行、daemon 测试 53k 行),安全与证据纪律也很密。当前最大的工程缺口不在「少了哪个功能」,而在三处结构性失衡:

1. **产品的第一判定标准(语音首响 P50 ≤ 1.5s)在架构上没有实现路径、在运行上没有测量**。ASR、LLM、TTS 三段全部是「整段完成再交给下一段」,首响采样代码写了两个月没接线。
2. **交付重心倒挂**。8 月 15 日以来文档/证据行数变动是产品代码的 7.6 倍;8 月 28 日之后 20 个提交没有一个新增产品能力;当前唯一排产链 PG-01B → PG-06 六个批次全是 runtime-safety,链尾直接 `owner-stop`,**排产链上没有任何产品能力批**。
3. **owner 狗粮跑的运行形态与公开交付物不是同一个东西**。常驻 launchd 用 `tsx` 直跑源码树,公开 CLI 包是 esbuild 单文件 bundle;狗粮证据不覆盖用户拿到的包。

按投入回报排序的 7 条主缺口:

| # | 缺口 | 维度 | 总案覆盖 | 建议投入 |
|---|---|---|---|---|
| 1 | 语音首响链路全程串行非流式,SLO 无生产测量 | 性能 / 架构 | 无 | 先接线测量(1 天),再做 LLM 流式 + 句级 TTS 流水(3–5 天) |
| 2 | 排产链零产品批,文档/证据产出 7.6 倍于代码 | 交付节奏 | 无(总案本身是该现象的一部分) | owner 决策:给每批治理开销设上限,链上插入产品批 |
| 3 | 两套运行形态(tsx 源码树 vs esbuild bundle) | 架构 / 发布 | 无 | 常驻 runtime 改跑同一 bundle(1–2 天) |
| 4 | 控制面无推送,console 全靠 10s / 30s 轮询 | 交互 / 架构 | 仅在 connector 语境提到 polling | 复用现有 `/ws/voice` 加控制面事件流(2–3 天) |
| 5 | 语音供给单厂商硬编码 + `pipecat-ai` 死依赖 + 本地兜底「文档有、代码无」 | 外部连接 | G-B17 只提 Pipecat 二选一 | 先删死依赖(0.5 天);provider 接口抽象随第 1 条一起做 |
| 6 | CLI 只有 `up` / `status`,无 doctor / upgrade / logs / uninstall | 工具 | G-B12 顺带提到 | `doctor` + `upgrade` 各 1 天 |
| 7 | daemon 组合根 `index.ts` 4,055 行 / 126 import / 46 个路径分支,`executor.ts` 4,897 行 | 架构 / 可维护性 | G-B15 一句「核心模块继续膨胀」 | 不做大重构;新代码禁止再进这两个文件,按 API 前缀拆 handler(增量) |

其余发现(会话 12 轮硬窗口无 gist、测试单文件 6,480 行与 114 处 `vi.waitFor`、门禁脚本 20.6k 行、前端单 chunk 787 KB、45.7k 行草案合同不在构建内)见 §1–§5,均为次级。

## 1. 架构

### 1.1 语音链路是三段「批处理」,不是流水线

canonical 把「对话感」定义为流式低延迟 + 可打断(`docs/03-architecture.md:62`,P50 ≤ 1.5s / P90 ≤ 2.5s)。现役实现三段全部串行、非流式:

| 段 | 现役形态 | 证据(本会话实读) |
|---|---|---|
| ASR | PTT 松手 / VAD 终结后,把整段 PCM 封 WAV 交 sauc **整段识别**,拿到终版才发 `asr.final` | `pipeline/src/saydo_pipeline/hub_client.py:6-8`(模块 docstring);`doubao_asr.py:123` `recognize(wav_audio)` 签名 |
| LLM | `chatWithRetry` 一次拿完整回复;请求体无 `stream` 字段;对话档 `maxTokens: 400`,工具环 `maxTokens: 600` 且 `maxSteps` 内**逐步串行往返** | `packages/daemon/src/brain/dialogLoop.ts:411`、`:646`;`providers/openaiCompat.ts:75-117`(body 无 stream;`:47` 默认 30s 超时) |
| 分句 | 分句发生在**完整回复返回之后**:`splitSentences(res.text)` | `dialogLoop.ts:395`、`:437` |
| TTS | 每句 `synthesize()` 把 doubao v3 双向流的所有 chunk `join` 后才返回,pipeline 才发二进制帧 | `pipeline/src/saydo_pipeline/doubao_tts.py:148-158`(`chunks.append` → `b"".join`);`hub_client.py:493` |

后果:用户说完到第一个音节出声的下界 = 整段 ASR 往返 + **完整** LLM 生成(工具轮再乘以步数)+ 第一句完整 TTS 合成 + 传输。这不是调参能解决的,是拓扑问题。

`docs/10-voice-ux-spec.md:16` 规定的「工具调用过渡语(稍等,我整理一下)」在代码中零实现(`grep '过渡语|稍等'` 于 `brain/` `live/` 无命中);在非流式拓扑下也无法实现——过渡语只能在 LLM 返回之后播,失去意义。console 侧的「思考中」秒表(`packages/console/src/pages/Chat.tsx:264`)是这个等待的可见投影。

**建议**(按顺序,前一步是后一步的测量基线):

1. 接线 `obs/latency.ts`(见 §2.1),先拿到真实分段 P50/P90。
2. `openaiCompat` 加 SSE 流式;`dialogLoop` 改为「边收 token 边按句边界切句」,每句一到就 `sendTtsSay`。契约 `tts.say` 已是句粒度(`voice/hub.ts:832`),hub 层 watermark / unheard / barge_in 语义按句承载,**不需要动 09 §10 契约**。
3. TTS 改为 chunk 到达即转发(doubao v3 本就是双向流,当前是人为攒齐)。
4. ASR 流式 partial 是 P1 项(工程 ADR-101),不在本条内;但前三步做完,`asr_final → playout_start` 这段能从「秒级」进入「亚秒」。

验收锚:分段分解表 n ≥ 20,`llmMs`(asr_final → llm_first_token)与 `ttsMs` 分别可见,`totalP50` 有真值(不要求达标,要求有数)。

### 1.2 两套运行形态

- owner 常驻:launchd 用 `tsx` 直跑 `packages/daemon/src/index.ts`(`packages/daemon/src/launchd/cli.ts:83-101`,plist 参数即 tsx cli + `src/index.ts`)。
- 公开 CLI:`saydo up` fork `dist/runtime/daemon.mjs`(`packages/cli/src/supervisor.ts:30`、`:360`),由 `packages/cli/scripts/build.mjs` 的 esbuild 产出。

两者的模块解析、转译、依赖打包、启动路径都不同。HANDOFF §1.1 记录常驻 runtime 仍在 `6d98a6e`(2026-08-22)未随 rc 链升级,本身也说明这条线是独立维护的。狗粮跑源码树意味着 rc.12 包里的任何 bundle 级问题(依赖被 tree-shake 掉、native 模块路径、`import.meta` 差异)只有公开用户会先撞到。

**建议**:`just daemon deploy` 改为先 `pnpm --filter @saydo/cli build`,常驻 plist 指向同一个 `daemon.mjs`;evidence 里记录常驻 bundle digest 与 release tarball 内 bundle digest 相等。工作量 1–2 天,零 canonical 变更。

### 1.3 语音进程:声明用 Pipecat,实际自建

- `pipeline/pyproject.toml:7` 声明 `pipecat-ai>=1.6.0`;`pipeline/src/saydo_pipeline/*.py` **零** `import pipecat`。工程 ADR-001 后记(`docs/adr/ADR-001-pipecat-interrupt-go.md` 末段)已如实记「P0 未启用 Pipecat 运行时」,但依赖没有随之移除——每次 `uv sync` 都在装一个不用的框架。
- 自建管线 1,198 行,ASR / TTS 各只有一个 Doubao 实现,没有 provider 接口;`__main__.py:1` 明写「TTS=doubao(key 缺失则降级 down)」,`hub_client.py:489` 无 provider 时直接丢句。ADR-001 写的「macOS `say` 兜底成立」在代码里没有对应路径。
- VAD 是能量 RMS + hangover 状态机(`vad.py:1-10` 自述),不是 D2 写的 Silero。

这与 §1.1 是同一件事的两面:要做流式,就得先有 provider 接口。**建议**先删死依赖并回写 07 D2 状态行(0.5 天);provider 抽象随 §1.1 第 2–3 步一起做,不单独立批。总案 G-B17 只提「Pipecat 用 ADR 二选一」,没提死依赖与单厂商。

### 1.4 console:双页面树 + 自制路由 + 无共享 DTO

- `packages/console/src/App.tsx:48-88`:正式路由指向 `pages/redesign/*`,同时保留 `legacy-board` / `legacy-focus` 可达;`pages/` 下 17 个旧页面与 `pages/redesign/` 4 个新页面并存,`components/` 与 `components/redesign/` 同理。redesign 路由里 8 处 `TODO(接线后续批)` 写口未接(`FocusPageRoute.tsx:77-105`、`RecordsPageRoute.tsx:76-121`)——这部分总案 G-A3 已列,PG-01B 会处理,本文不重复。
- 数据层:零第三方状态/请求库(`grep zustand|@tanstack|swr|react-router` 无命中),自制 hash router(`lib/router`);`lib/api.ts` 对 `@saydo/contracts` 的 import 数为 **0**(G-B15 已列)。
- 产物:单 JS chunk 786,600 字节,无代码分割(`packages/console/dist/assets/`)。本地应用,次级。

**建议**:不另立 UI 批;在 PG-01B 处理写口时顺带把 `legacy-*` 路由删掉,减一棵树。DTO 共享按 G-B15 的「新增 API 一律共享 schema」执行即可。

### 1.5 组合根与执行器

`packages/daemon/src/index.ts` 4,055 行、126 个 import、`createServer` 回调内 46 处 `/api` 路径前缀分支(`index.ts:366` 起);`tier1/executor.ts` 4,897 行。`api/` 目录已有 18 个 handler 文件,说明拆分模式存在,只是组合根没有随之瘦身。总案 G-B15 一句「核心模块继续膨胀」带过,没给量。

**建议**:不做重构批(重构在这套评审制度下成本极高)。只加一条机械规则:`index.ts` 与 `executor.ts` 行数只减不增,新 endpoint 必须落 `api/`。可以用一个 10 行的 `scripts/check-*.mjs` 守住,但**不要**再给它配 mutation 自测(见 §5.3)。

### 1.6 45.7k 行草案合同不在构建内

`docs/plan/ai-supply-contracts-draft/` 45,734 行 TypeScript,`tsc` 零诊断但不参与构建(`docs/plan/README.md:48-50`)。PG-02 明确「不下沉全部 45k 行草案」,只提取 safety types。这是一笔会持续腐化的设计库存:每次 `packages/contracts` 演进,草案就多一分漂移,而它没有任何门禁看着。**建议** owner 二选一:冻结为只读归档(移出 `docs/plan/`,不再声明「可 tsc」);或把「草案与 contracts 的类型漂移」做成一个只报不阻断的检查。不建议继续维持「45k 行、零诊断、不构建」的中间态。

## 2. 性能

### 2.1 首响 SLO:采样代码写了两个月,零接线

- `packages/daemon/src/obs/latency.ts` 定义了五段时间戳 `LatencyTrace`(vad_end → asr_final → llm_first_token → tts_first_byte → playout_start)、分段分解与 P50/P90 计算,文件头注明「计划 M3/A-1;03 §3 SLO 的第一次实测落点」。
- 全仓 `grep LatencyTrace|vadEndMs|llmFirstTokenMs` 在 `obs/latency.ts` 与测试之外 **零命中**。生产从未产出一条 trace。
- 这条缺口不是新发现:`research/saydo-improvement-scan-2026-07.md:13`、`:61`、`:70` 在 7 月就把「首响 SLO 全 P0 计划无分段实测落点」列为 A 级,并给出了正是这五段时间戳的建议。修法被执行成了「写一个类型文件」,然后停在那里。唯一实测是 phase-1 的 TTS 首包 p50=202ms / p90=382ms 与 `/dev/say` 全链 732ms(`e2e/evidence/phase-1.md:15`),只覆盖最后一段。
- `dialogLoop.ts:411-412` 已经在记 `arrived = nowMs()`,说明 llm 段时间戳的采集点是现成的。

**建议**:1 天。hub 收 `asr.final` 记 `asrFinalMs`,dialogLoop 记 `llmFirstTokenMs`(非流式下 = 完整返回时刻,先如实记),pipeline 在 `tts.say` 收到与首个二进制帧发出各记一次,console `tts.playout` 回报已有 watermark 机制可复用。落 JSONL,`/api/value-report` 出分解表。**在 §1.1 动手前必须先有这个数**,否则流式改造没有验收基线。

### 2.2 对话上下文:12 轮硬窗口,无蒸馏

`brain/dialogLoop.ts:314`、`:367`:进模型的历史固定 `history.slice(-12)`。会话状态 `historyOf` 返回全量数组(`live/voiceSessions.ts:340`),但模型只看最后 12 轮。采访式澄清动辄十几轮,第 13 轮起用户早先说的约束就从模型视野消失,除非已经经 `remember` / readiness 确认落盘。PLAN-2 §1 W5 5.11 的「会话滚动 gist 蒸馏」被 PG-00 处置为 `inventory_deferred`。

这不是性能问题,是长对话质量的机制缺口;放在这里是因为它与 §1.1 共用 dialogLoop 改造面。**建议**随流式改造一起做最小版:超出窗口的轮次由廉价模型压成一段 gist 注入 system,不进 09 契约。

### 2.3 测试与门禁的耗时结构

- daemon 测试 133 个文件 53,293 行(源码 63,813 行,比值 0.84);最大单文件 `test/tier1-executor.test.ts` **6,480 行**;`vi.waitFor` 114 处,L-7 已登记结构性 flaky(`e2e/evidence/w54b-batch.md` §18.4)。
- `just ci` 实测 128–161 s(journal R126 / R127);`vitest` `maxWorkers: 4`(`packages/daemon/vitest.config.ts`)。
- `ci-node` 在 typecheck / lint / test 之后串行跑 15 个 node 门脚本(`justfile` ci-node 段);`scripts/` 共 20,585 行 mjs/sh,其中 15 个 `test-*` 是「门禁的自测」,多数还带 mutation 反例。

这一层没有正确性问题,但它是每个批次的固定税:每加一个 checker 就加一个自测,每个自测再加 mutation,CI 时间与维护面单调增长。**建议**:门禁脚本设总量上限,新增 checker 必须替换或合并一个旧的;`tier1-executor.test.ts` 按 describe 拆 4–6 个文件(纯搬运,不改断言)。

### 2.4 其他(次级,记录不排)

- 前端单 chunk 787 KB(§1.4)。
- 奠基是阻塞式深研(`docs/04-key-mechanisms.md:24`),`memory/foundation.ts:224` 有 `token_budget_exhausted` 截断,但没有「奠基预计耗时 / 进度」的机械口径。owner 视角属真实使用体验,本文不展开。

## 3. 工具与外部连接

### 3.1 Brain 工具面全内向

`brain/liveTools.ts` 注册 32 个工具,全部是项目锚定、任务、确认、记忆、Focus、本地项目文件读面;没有 web fetch / search、没有 MCP client、没有仓外文件。总案 G-B11 已列 Tool/Connector Plane,本文补一条总案没写的事实:**执行 agent 侧是事实上的「外部工具后门」**——Tier1 后端(`claude -p` / `cursor-agent`)自带 web、文件工具且 egress `uncontrolled`(`docs/05-roadmap.md` Gate 0 表「secret/egress 隔离」行、G-B2)。所以「SayDo 没有外部工具」在对话层成立、在执行层不成立,两层口径要分开写。

### 3.2 模型供给:一个 HTTP adapter + 四个 CLI

- HTTP:只有 `providers/openaiCompat.ts`(Bearer + `/chat/completions`);`grep '/v1/messages|anthropic-version'` 零命中,即没有 Anthropic Messages adapter(G-A4 已提「Anthropic Messages adapter 前隐藏官方直连」)。
- CLI:`claude_cli` / `codex_cli` / `cursor_cli` / `gemini_cli`(`config/cliRuntime.ts:15-19`)。
- 本地推理(ollama / llama.cpp / MLX):零引用。07 D3 三档模型都假定云端或 CLI 订阅;「离线可用」不在任何合同里,这是诚实的,但要意识到语音 + 本地 agent 的产品形态天然会被问「能不能不联网」。

**建议**:不扩 provider 名单(总案 G-A7/A8 正在收紧 admission,此时扩是逆行)。只做一件事:`family.ts` 已支持 qwen / llama / mistral 前缀,把 `openaiCompat` 对 `base_url=localhost` 的路径走通并写一条 e2e(ollama 兼容 `/v1/chat/completions`),让「本地模型」从零变成 `conditional`。半天。

### 3.3 语音供给:单厂商

ASR = 火山 sauc,TTS = 豆包 v3,均无第二实现、无本地兜底(§1.3)。07 D4 写「第二家对比待 OpenAI key」,D5 写「本地兜底链 Kokoro → piper → say」,代码里一条都没有。这意味着语音功能对单一云厂商的可用性、配额与价格变动零冗余。**建议**随 §1.1 的 provider 接口一起,先把 macOS `say` 接成 TTS 兜底(ADR-001 已验可用,18 个中文音色),让「回叫永远发得出声」从文档承诺变成代码。

### 3.4 通知与桌面

`callback/desktop.ts:73-76`:darwin 走 osascript,win32 走 toast,其余平台直接落 ntfy。Linux 无桌面通知实现(HANDOFF §2-5b 已记)。次级,记录即可。

### 3.5 CLI 表面

`packages/cli/src/options.ts:5`、`:32`:子命令只有 `up` 与 `status`。没有:

- `doctor`(诊断 Node 版本、端口占用、`~/.saydo` 权限、配置合法性、provider 可达);
- `upgrade`(install.sh 钉住 rc.12,用户升级只能重跑安装脚本);
- `logs`(日志在 `~/.saydo` 下按天 JSONL,用户要自己找);
- `uninstall` / `backup` / `restore`(backup 只有源码树 `pnpm --filter @saydo/daemon backup`)。

总案 G-B12 把这些写进「owner 二选一」的产品级分发批里。本文认为 `doctor` 与 `upgrade` 不该等那个批:两者各 1 天,不改产品语义,直接降低第一次失败时的支持成本。

## 4. 产品机制与 UI 交互(不含真实用户反馈)

### 4.1 等待反馈

§1.1 已述。补一点:非流式拓扑下,console 只能给「思考中 N 秒」秒表,不能给「正在说」;流式改造后可以把已到句子先上屏再出声,这是 UI 层零成本的收益。

### 4.2 控制面轮询

- `shell/Layout.tsx:317` 每 10s 拉 attention outbox,`:323` 每 30s 拉 focus spaces;`pages/Today.tsx:119`、`pages/Board.tsx:164` 各 30s;mobile `hooks.ts:24` 也是轮询。
- 推送通道只有语音 WS(`/ws/voice`);控制面状态(任务状态变化、审批到达、回叫)没有服务端推送。任务从 `running` 到 `ready_for_review` 在看板上最多迟 30s 出现;审批卡最多迟 10s。
- 总案只在 connector 合同语境提了一次 polling(`:536`),没把它当产品交互缺口。

**建议**:复用现有 hub 的 console peer,加一类 `state.changed {kind, id, revision}` 下行消息,前端收到后按 kind 触发既有 `load()`。不动 REST 形状,不动 09 契约(消息不带业务 payload,只带 id + revision)。2–3 天。

### 4.3 键盘与可达性

console 键盘处理 10 处,`aria-*` / `role` 172 处。语音产品的「显式轮次按钮」(说完了 / 重听)是 canonical 一等交互(`docs/02-product-definition.md:40`),但没有全局热键;总案 G-B7 已列无障碍,本文只补「热键」一条:PTT / 说完了 / 重听三个动作给可配置热键,半天。

### 4.4 其他已被总案覆盖的交互项

G-A3(redesign 写口 TODO、`¥0` 伪投影)、G-B4(首启暴露内部供给结构)、G-B7(locale 硬编码 zh-CN)。不重复。

## 5. 交付节奏(不是 owner 点名的维度,但是最大的缺口)

### 5.1 量化

| 指标 | 数值 | 来源 |
|---|---|---|
| 产品代码(daemon/console/contracts/platform/cli/pipeline) | 约 102k 行 | `wc -l` |
| 文档 + 研究 + prompt + journal + evidence | 约 126k 行(docs 27.4k / research 70.6k / prompts 15.9k / history 7.1k / evidence 5.4k) | `wc -l` |
| 门禁与工具脚本 | 20.6k 行 | `wc -l scripts/*` |
| 草案合同(不构建) | 45.7k 行 | `wc -l` |
| 8 月 15 日以来行数变动:代码 vs 文档/证据 | 64,961 vs 491,680(1 : 7.6) | `git log --numstat --since=2026-08-15` |
| 8 月 28 日以来提交 | 20 个;产品能力新增 **0**(仅安装脚本、claim 降级、流程文档、评估文档) | `git log --since=2026-08-28` |
| 当前排产链 | `PG-01B → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop`,六批全为 runtime-safety / gate-truth / audit / db / admission | `IMPLEMENTATION-PLAN-2.md:25` |
| 一个 S 级批次的评审成本样本 | PG-01A(claim-only,规模 S):R120–R126 七个 journal 回合,C1 零上下文复审 ordinal 到 4、FG-1 另 1–2 轮,跨 08-31 → 09-02 三天 | `history/PROCESS-JOURNAL.md:3365-3429`;`HANDOFF.md:59` |

### 5.2 判断

安全底座与证据纪律是对的,总案九条 A 级也确实该关。问题是**没有任何一条产品线在排队**:PG-06 收口后是 `owner-stop`,W5.4-c(真 Claude hook 冒烟)是 `conditional_release_evidence`,W6(多任务并行)、W7(语音移动完整版)、W8 全部 `inventory_deferred`(`IMPLEMENTATION-PLAN-2.md:40-53`)。按当前节奏(一个 S 级批 4 天、M 级批更长),PG-01B → PG-06 走完之后,产品与今天相比的差异只有「更诚实的 claim、更硬的门」,没有一个用户可感知的能力变化。同时 §1.1 / §2.1 这类核心机制缺口,因为不在总案的 A/B 编号里,连候选队列都进不去。

流程本身也在自我增殖:每个 checker 配自测、每个自测配 mutation、每个批次配 focused gate + full gate + 两次 fingerprint + evidence + readback + journal。这些都有道理,叠起来就是 7.6 : 1。

### 5.3 建议(全部归 owner 决策,本文不代拍)

1. **给每批治理开销设上限**:例如「每批新增 checker ≤ 1、自测 ≤ 1、evidence 正文 ≤ 300 行」,超出即拆批或砍。
2. **在链上插入产品批**:PG-02 之后、PG-03 之前插一个 `VOICE-01`(§2.1 测量 + §1.1 流式,4–6 天);PG-04 之后插 `RUNTIME-01`(§1.2 统一 bundle + §3.5 doctor/upgrade,3–4 天)。两批都不改 09 契约、不放宽 Gate 0 / S3,风险等级 L1。
3. **合并批次**:PG-04(audit)与 PG-05(db)都在 storage 面,scope roots 相邻,合并能省一轮完整门禁 + 一轮 readback。
4. **草案合同处置**(§1.6)与 `pipecat-ai` 删除(§1.3)作为「减法小批」一起做,零评审成本。

## 6. 已被总案覆盖、本文不重复的项

G-A2(门禁三套非同构)、G-A3(动作真相)、G-A5(DB 前向拒绝)、G-A6(远程 token)、G-A7/A8(admission / probe)、G-A9(audit 原文)、G-B2(沙箱)、G-B3(备份)、G-B6(移动壳)、G-B13(live canary)、G-B14(logger 背压;本会话核对 `obs/logger.ts:59` 确为逐条同步 `appendFileSync`,总案描述准确)、G-B15(DTO 镜像)、G-B16(release 钉 rc.12)。

## 7. 建议投入顺序

| 顺序 | 项 | 工作量 | 前置 | 收益 |
|---|---|---|---|---|
| 1 | §2.1 首响采样接线 | 1 天 | 无 | 产品第一判定标准有真值;后续所有语音改造有基线 |
| 2 | §1.3 删 `pipecat-ai` + §1.6 草案冻结 | 0.5 天 | 无 | 减法,零风险 |
| 3 | §1.1 LLM 流式 + 句级 TTS 流水 + §2.2 最小 gist | 3–5 天 | 1 | 首响拓扑从「批处理」变「流水线」;长对话不丢上下文 |
| 4 | §1.2 常驻改跑 bundle | 1–2 天 | 无 | 狗粮 = 交付物 |
| 5 | §3.5 `doctor` / `upgrade` | 2 天 | 4 | 支持成本 |
| 6 | §4.2 控制面推送 | 2–3 天 | 无 | 看板 / 审批实时 |
| 7 | §3.2 本地模型 conditional + §3.3 `say` 兜底 | 1 天 | 3 | 单厂商冗余 |
| 8 | §5.3 流程上限与批次合并 | owner 决策 | 无 | 释放产能 |

1–5 合计约 8–11 天,全部 L1、零 09 契约变更、不放宽任何安全不变量。

## 8. 自查记录(第二遍 review)

对 §0 表 7 条与 §1–§5 每条逐一核对四问:证据是否本会话实读到 file:line;是否与总案重复;是否有可判定的验收锚;排序是否站得住。结果:

- **删除 2 条**初稿里的项:「会话历史无界导致性能问题」——核对 `dialogLoop.ts:314` 发现进模型的是 `slice(-12)`,不是无界,已改写为 §2.2 的质量缺口;「配置面复杂」——`templates/saydo.config.example.toml` 只有 9 节 26 键,不成立。
- **降级 3 条**为次级:前端 bundle 单 chunk(本地应用,无实际影响)、Linux 桌面通知(HANDOFF 已记)、奠基阻塞无进度口径(属真实使用体验,owner 排除)。
- **补强 1 条**:§2.1 补上 7 月 improvement-scan 已把同一缺口列为 A 级的证据,说明这是「已知两个月未做」而非新发现,排序据此升到第 1。
- **核对总案重叠**:用 `grep` 对总案检索「首响|latency|P50」「轮询|poll|SSE」「Pipecat」「tsx」,确认第 1、3、4 条总案未覆盖(latency 仅出现在成本税与 SLA 泛指两行 `:1232` `:1255`;polling 仅 `:536` connector 语境;Pipecat 仅 G-B17 二选一;`tsx` 命中全为 `.tsx` 文件名)。
- **第二遍逐条回核 file:line 后修正 6 处**:PG-01A 样本原写「R118–R126 九回合 / 4 轮复审 / 4 天」,按 journal 标题实为 R120–R126 七回合、C1 ordinal 到 4 + FG-1 另 1–2 轮、三天(R117–R119 属总案本身);旧页面数 22 → 17(`ls pages/*.tsx` 去测试);ci-node 门脚本 20 → 15;W5.4-c 处置词 `inventory_deferred` → `conditional_release_evidence`;`obs/logger.ts` / `docs/02` / `doubao_tts.py` 三处行号按 `grep -n` 校正。
- **未做**:未运行任何门禁或产品;所有「工作量」是粗估,不是承诺;§5 的判断是基于计数的推断,owner 若认为当前阶段就该只做安全底座,则 §5 不成立、§1–§4 仍成立。
- 本文件已过 `bash scripts/check-emoji.sh`(`[ok] emoji gate: clean`)与 `node scripts/check-doc-links.mjs`(`broken=0`)。
