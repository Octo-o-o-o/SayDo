# SayDo 公开就绪修补批(public-readiness)· 实施 Prompt(第十一轮交接)

> 背景:官网 Docs 内容稿(`docs/site/2026-08-20-docs-page-content.fable.md` §C.1)核对出三处仓内与实现不符、阻碍外部用户按文档上手的问题:① `templates/` 配置模板头注与 `[models.dev]` 示例陈旧(仍写"T17 四槽均走 API、CLI 接入开发中"与 `agent = "claude_code"`,而运行时七家 CLI 已接线、执行器只认 `cursor`);② `DEPLOY-测试机部署清单.md` §4 的 CLI 产物路径写成 `dist/saydo.js`(实为 `dist/cli.mjs`);③ `just daemon install` 硬要求 `~/Library/LaunchAgents/com.saydo.pipeline.plist` 已存在,而仓内没有生成它的代码——干净新机无法常驻。本批三项全部是**非 canonical、零合同变更**的修补。
> 性质:模板 / 文档 / launchd 常驻纯函数 + 安装命令补全。不涉 09/04/07/10/11 canonical;不碰执行器、BYOA、console 业务逻辑。
> 纪律:两提交法(`fix(...)`/`feat(...)` → `chore(evidence)`);evidence `e2e/evidence/public-readiness.md`;零 emoji(`scripts/check-emoji.sh`);不部署常驻、不 push、不改 `~/Library/LaunchAgents` 下真实文件(安装命令只写单测与 dry-run,真机安装属 owner 检查点);施工 = 独立 clone 分支 `batch/public-readiness`;实施 = Grok 4.6 headless,评估 = 零上下文只读会话。

---

你接手 **SayDo public-readiness 批**。代码仓 = 当前目录(独立 clone,分支 `batch/public-readiness`,基线 `354b028`)。完成判定 = §3 各项验收锚全绿 + evidence 落盘 + §5 对账表。

## 0. 坐标核验(先做,漂移即停并汇报)

| 命令 | 期望 |
|---|---|
| `git log --oneline -1` | `354b028`(chore(license)…) |
| `git status --short` | 仅本文件(未跟踪) |
| `rg -n "T17" templates/` | 三处命中(`saydo.config.example.toml:7`、`saydo.config.dev.example.toml:2`、`saydo.env.example:5`) |
| `rg -n "saydo.js" DEPLOY-测试机部署清单.md` | `:52` 一处 |
| `rg -n "pipeline plist 不存在" packages/daemon/src/launchd/cli.ts` | 两处(`:106` deploy 路径、`:146` install) |
| `rg -n "export function buildLaunchdPlist" packages/daemon/src/launchd/plist.ts` | 命中 |
| `rg -n "describe\(\"两份模板 TOML 解析" packages/daemon/test/config.test.ts` | 命中(模板已有解析 + 校验测试) |
| `pnpm --filter @saydo/daemon exec vitest run test/config.test.ts test/launchd-plist.test.ts` | 全绿(记录用例数作基线) |
| `cat packages/cli/package.json \| rg '"saydo"'` | `"saydo": "dist/cli.mjs"` |

## 1. 必读

1. `AGENTS.md`(硬规则:零 emoji、状态词、契约不分叉、两提交法)、`HANDOFF.md` §0 硬教训 / §4 铁律。
2. `templates/saydo.config.example.toml`、`templates/saydo.config.dev.example.toml`、`templates/saydo.env.example` 全文;`docs/09-data-contracts.md` §11(:995-1143,配置样例与 ModelBinding 词表;**只读**)与 T18b 合同段(:1145-1185);`docs/07-tech-stack-decisions.md` D18(:183-250)。
3. `packages/contracts/src/types/modelbinding.ts`(ModelBinding / DevAgentBinding 形状)、`packages/daemon/src/config/{types,validate,load,envFile,cliProviders}.ts`、`packages/daemon/test/config.test.ts`(模板测试段 :339-393)。
4. `packages/daemon/src/launchd/{plist,cli}.ts` 全文、`packages/daemon/test/launchd-plist.test.ts`、`justfile`(`daemon` 入口)、`scripts/runtime-preflight.sh`(只读,了解 pipeline plist 在运维链里怎么被消费)。
5. `DEPLOY-测试机部署清单.md` 全文;`docs/site/2026-08-20-docs-page-content.fable.md` §4(快速开始,对外口径)与 §C.1-9/10/11(本批三项的来由)。
6. owner 机现行手工 pipeline plist 形态(照此写纯函数;**不要读写 `~/Library/LaunchAgents`**):
   ```
   Label=com.saydo.pipeline;ProgramArguments=[<uv 绝对路径>, run, python, -m, saydo_pipeline];
   WorkingDirectory=<pipeline 目录>;RunAtLoad=true;KeepAlive.SuccessfulExit=false;ThrottleInterval=5;
   StandardOutPath=<logs>/pipeline.launchd.out.log;StandardErrorPath=<logs>/pipeline.launchd.err.log;
   EnvironmentVariables={PATH, SAYDO_HOME[, SAYDO_DAEMON_PORT]}
   ```

## 2. 红线(违反即停)

- 不改 canonical(docs/01–11、modules、adr);不改 `packages/contracts`;不改 `config/types.ts` schema;不改执行器 / BYOA / console 业务代码。
- 模板改动**只能让示例更贴近当前实现**,不得引入 schema 不接受的键;两份 TOML 模板与 env 模板必须继续通过 `test/config.test.ts` 既有断言(允许**只改**第 360-367 行那条对 `dev.agent` 的断言以匹配新示例,其余断言不动)。
- 模板示例里评估档若走 CLI,必须同时示例 `evaluator_same_family_ack` / `evaluator_isolation_ack` 两键并注释清楚;缺省示例优先"评估档 API 异族、无需 ack"的合法形状。
- launchd:`install` 的真实系统副作用(`launchctl bootstrap/bootout`、写 `~/Library/LaunchAgents`)**本批不得在测试里触发**;纯函数 + 命令分支的单测用临时目录与注入的路径 / 函数桩。不改 `deploy` 子命令的既有语义(它仍用 PlistBuddy 改 pipeline plist)。
- 零 emoji;文本标记 `[ok]/[warn]/[fail]`;文档里的路径不得出现本机用户名(用 `~` 或 `<你>`)。
- 不 push、不部署、不碰 `~/.saydo`。

## 3. 任务清单(竖切;每项验收锚可判定)

### 3.1 F1 · 模板刷新(提交 `fix(templates): 配置模板对齐当前实现(七家 CLI 供给 / cursor 执行器 / 两键 tier1)`)

- `templates/saydo.config.example.toml`:
  - 删除"T17 … CLI 订阅接入开发中,配置形状仅为存量兼容"类陈旧头注;头注改为三句:① 五个槽位;② 每个推理槽可 `api`(OpenAI 兼容命名端点)或已接线 CLI(`codex_cli / claude_cli / cursor_cli / grok_cli / gemini_cli / qwen_cli / copilot_cli`,零 key 走订阅;对话档走 CLI = 慢速文本模式);③ 缺省示例 = 四槽 OpenRouter API(一个 key),并给出**注释掉的**CLI 绑定示例每家一行(形状按 `modelbinding.ts`:codex `reasoning` 可选、cursor `model` 必填、grok/gemini/qwen/copilot `model` 可省)。
  - `[models.dev]` 示例改为 `agent = "cursor"`、`transport = "cli"`、`model = "<cursor-agent 可列出的模型名>"`(注释:运行时当前只认 cursor;`claude_code`/`codex` 配了会被拒起执行器,对话不受影响;Claude Code 执行器接入中);并新增 `[tier1]` 段示例两键(`cursor_agent_bin` 绝对路径、`cursor_agent_pinned_version`),注释"两键齐备才启用执行器;不接受 `~`"。
  - `[budget]` 段补 `task_max_default = 20` 注释行(单任务成本封顶缺省;`monthly` 注明当前无执行点);`[hopper]` 段头注改为"执行后端候选(生产绑定当前休眠,可整段留空)",键值保留。
  - 保留 `[voice]` 三行(`asr    = "volc"`、`tts    = "volc"` 原样,测试断言)、`[privacy]`、`[dnd]`、`[gate0]`、`[providers.api.*]` 示例与 family 规则注释。
- `templates/saydo.config.dev.example.toml`:头注同步("T17…"删);四槽示例改为 owner dev 机实况形状之一(对话 API + 沉思 / 廉价 / 评估 CLI,评估档走 CLI 时两条 ack 显式 `true` 并注释),`[models.dev]` 保持 cursor + transport cli,新增 `[tier1]` 两键示例;其余段保留。
- `templates/saydo.env.example`:删"T17…"句;把"dev 机缺省四槽 OpenRouter"改为"任一已登录 CLI 可零 key;要秒级对话或全 API 再填下列任一 key";补 `NTFY_TOPIC/NTFY_SERVER` 注释"不在向导白名单,需手改";其余键不变(测试断言 `VOLC_APP_ID=` / `VOLC_ACCESS_TOKEN=` / `DOUBAO_TTS_API_KEY=` 仍存在、无 `VOLC_API_KEY`)。
- **验收锚**:`pnpm --filter @saydo/daemon exec vitest run test/config.test.ts` 全绿(含"两份模板 TOML 解析与 P0 语音固定配置"三条;`dev.agent` 断言按新示例改为 `"cursor"`,其余不改);额外新增断言(同文件该 describe 内):default 模板 `validateConfig` 的 `effective.evaluator.family === "claude"` 且 `violations.length === 0`;dev 模板在 `{ SAYDO_DEV:"1" }` 下 `ok === true` 且 `c.models.evaluator_same_family_ack === true && c.models.evaluator_isolation_ack === true`(若 dev 模板评估档走 CLI);`rg -n "T17" templates/` 零命中;`rg -n "claude_code" templates/` 只允许出现在"运行时只认 cursor"的注释行。

### 3.2 F2 · DEPLOY 清单回修(提交 `docs(deploy): CLI 产物路径与启动口径对齐 D1 实现`)

- `DEPLOY-测试机部署清单.md` §4:`node packages/cli/dist/saydo.js` → `node packages/cli/dist/cli.mjs`;§2 补一句"`saydo` CLI 只认 `--port`,直起 daemon 才认 `SAYDO_DAEMON_PORT`";§2 控制台入口改用 `http://localhost:47100/?token=…`(WebAuthn rpId 绑定,`127.0.0.1` 页面请求会 308 归一;`curl /health` 仍可用 127.0.0.1);§4 末补一行"常驻(`just daemon install`)当前会自动生成 pipeline plist(见 §F3),无 `uv` 时用 `--without-pipeline`"。
- **验收锚**:`rg -n "saydo\.js" DEPLOY-测试机部署清单.md` 零命中;`rg -n "dist/cli.mjs" DEPLOY-测试机部署清单.md` ≥ 1;`bash scripts/check-emoji.sh DEPLOY-测试机部署清单.md` clean。

### 3.3 F3 · launchd 安装补全 pipeline plist(提交 `feat(launchd): install 自动生成 com.saydo.pipeline.plist;无 uv 时 --without-pipeline 仅装 daemon`)

- `packages/daemon/src/launchd/plist.ts`:新增纯函数 `buildPipelinePlist(i: PipelinePlistInput): string`(`PipelinePlistInput = { uvBin, pipelineDir, logsDir, pathEnv, saydoHome, daemonPort? }`),输出与 §1-6 形态逐键一致(Label `com.saydo.pipeline`;`ProgramArguments=[uvBin,"run","python","-m","saydo_pipeline"]`;`KeepAlive.SuccessfulExit=false`;`RunAtLoad`;`ThrottleInterval=5`;两条 log 路径;`EnvironmentVariables` 含 `PATH`、`SAYDO_HOME`,`daemonPort` 给定时加 `SAYDO_DAEMON_PORT`);XML 转义复用现有 `esc`;导出 `PIPELINE_LAUNCHD_LABEL`。
- `packages/daemon/src/launchd/cli.ts`:
  - 新增 `resolveUvBin(env)`:按 `PATH` 查 `uv`(`execFileSync("which",["uv"])` 或手工遍历 PATH),找不到返回 `null`。
  - `cmdInstall(opts: { withoutPipeline: boolean })`:若 pipeline plist **不存在**:`withoutPipeline=false` 时 → `resolveUvBin()`;找到 ⇒ 用 `buildPipelinePlist` 原子写 pipeline plist(`pipelineDir` = 开发树 `DEV_ROOT/pipeline`,与 daemon plist 同为"开发树安装",`deploy` 再切 runtime 树——保持现状语义;`pathEnv`/`saydoHome` 与 daemon plist 同源);找不到 ⇒ 报 `[fail] 未找到 uv,语音管线无法常驻;如只要文本/控制面,用 'just daemon install --without-pipeline'` 并 `exitCode=1` **不写任何 plist**;`withoutPipeline=true` 时 ⇒ 跳过 pipeline(打印 `[warn] 未安装语音管线常驻(--without-pipeline);/readyz 将报 voiceReady=false`),只写 daemon plist 并 bootstrap。若 pipeline plist **已存在**:行为与现状一致(不覆盖、重载同 SAYDO_HOME)。
  - `install` 之后若本次新写了 pipeline plist,bootstrap 它(复用 `bootstrapWithRetry`),失败 exitCode=1 并如实打印(daemon 已装载的状态不回滚,打印提示)。
  - `cmdDeploy` 的 `pipeline plist 不存在` 分支保留,但错误文案补一句"先 `just daemon install`(会生成)"。
  - 参数解析:`just daemon install --without-pipeline`(`justfile` 的 `daemon *args` 已透传,`cli.ts` 的参数分发处接受该旗标;其它未知旗标仍报用法)。
  - 系统副作用函数(`launchctl`、写 plist)须可注入 / 可桩(最小改动:把 `cmdInstall` 拆成"决定要写什么"的纯函数 `planInstall({pipelinePlistExists, uvBin, withoutPipeline})` 返回 `{ writePipelinePlist: boolean; reason?: string; exitCode: 0|1 }`,命令层只消费计划;测试只测纯函数 + `buildPipelinePlist`)。
- **验收锚**:
  - `packages/daemon/test/launchd-plist.test.ts` 新增 ≥ 6 用例:`buildPipelinePlist` 的 Label / ProgramArguments 五元组顺序 / WorkingDirectory / KeepAlive.SuccessfulExit=false / RunAtLoad / 两 log 路径 / Env 含 PATH+SAYDO_HOME / 给 daemonPort 时含 SAYDO_DAEMON_PORT、不给时不含 / 特殊字符 `&<>` 转义;`planInstall` 四态:`{exists:true}` ⇒ 不写;`{exists:false, uvBin:"/x/uv", withoutPipeline:false}` ⇒ 写;`{exists:false, uvBin:null, withoutPipeline:false}` ⇒ 不写 + exitCode 1 + reason 含 `--without-pipeline`;`{exists:false, uvBin:null, withoutPipeline:true}` ⇒ 不写 + exitCode 0。
  - 既有 `launchd-plist.test.ts` 用例一字不改全绿;`just ci` 双矩阵绿(沙箱内 python 段若因 `~/.cache/uv` 只读而红,如实记录,调度方沙箱外复跑)。
  - 不得出现对 `~/Library/LaunchAgents` 的真实写入(测试用临时目录;`rg -n "LaunchAgents" packages/daemon/test/` 只允许字符串断言)。

### 3.4 F4 · evidence(提交 `chore(evidence): public-readiness`)

- `e2e/evidence/public-readiness.md`:坐标、三项改动摘要、门禁表(命令 + 退出码 + 用例数前后)、`rg` 断言输出摘录、未做清单(真机 `just daemon install` 实跑属 owner 检查点;`scripts/runtime-preflight.sh` 仍假设 asr/tts ok 与实体 `.git`,本批未动,登记)、对 `docs/site` Docs 稿 §4.8 / §C.1-9/10/11 的回写建议(文案由调度方改)。
- 两提交法:F1/F2/F3 各自独立提交,evidence 单独提交且引用前三个提交的真实 SHA。

## 4. 检查点(必须停等调度方)

1. 若 F1 发现现行 schema 不接受某个你认为"应当示例"的键 ⇒ 不改 schema,改示例并在 evidence 登记。
2. 若 F3 需要改 `deploy` 子命令语义才能自洽 ⇒ 停,汇报方案。
3. 任何 canonical 改动冲动 ⇒ 停。

## 5. 诚实汇报

对账表(完成 / 部分 / 未做 三态 + 真实 commit hash + 门禁退出码显式核查 `cmd; echo EXIT=$?` + 用例数前后);每个"完成"指到本会话真实输出;没做的写"没做"。
