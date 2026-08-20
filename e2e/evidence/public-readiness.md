# public-readiness · 公开就绪修补批证据(2026-08-20)

> 范围 = 模板刷新 + DEPLOY 路径回修 + `just daemon install` 自动生成 pipeline plist。零 canonical / 零合同 / 不改执行器 / 不碰 `~/.saydo` 与 `~/Library`。
> 本文件记录前面三个代码提交的 SHA,不自指。
> 三级标记:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做或沙箱受阻。

## 0. 坐标

- 工作目录:当前独立 clone,分支 `batch/public-readiness`
- 开批 HEAD:`354b0284f099db882df65e4b974bdd1b0629966e`(`chore(license): 以 Apache-2.0 开源,补 LICENSE/NOTICE 与 README 许可证说明`)
- 开批 `git status --short`:仅 `?? docs/plan/IMPL-PROMPT-11-PUBLIC-READINESS.md`(未跟踪,本批未提交)
- 定向基线(开批亲跑):`pnpm --filter @saydo/daemon exec vitest run test/config.test.ts test/launchd-plist.test.ts` → EXIT=0,Tests **31 passed**(config 28 + launchd 3)

代码提交(本文件记录这些 SHA,不自指):

| 项 | SHA | 主题 |
|---|---|---|
| F1 | `122d101556f81ec23b1b7dce0e9c96ae7ee9dc68` | `fix(templates): 配置模板对齐当前实现(七家 CLI 供给 / cursor 执行器 / 两键 tier1)` |
| F2 | `96946e1d32e32a1b749a7d52453dceb715326f60` | `docs(deploy): CLI 产物路径与启动口径对齐 D1 实现` |
| F3 | `f69ea4337b88c4cb516d8b2c5eaaa73607f4918f` | `feat(launchd): install 自动生成 com.saydo.pipeline.plist;无 uv 时 --without-pipeline 仅装 daemon` |

## 1. 三项改动摘要

### F1 模板

- `templates/saydo.config.example.toml`:删 T17 头注;五槽 + API/已接线七家 CLI 双供给;缺省仍四槽 OpenRouter API;注释掉每家一行 CLI 绑定(codex `reasoning` 可选、cursor `model` 必填、grok/gemini/qwen/copilot `model` 可省);`[models.dev]` 改为 `agent="cursor"` + `transport="cli"`;`[tier1]` 两键为注释行(占位真值会 `bin_missing`;不接受 `~`);`[budget].task_max_default = 20`;`[hopper]` 头注改为执行后端候选(生产绑定休眠)。
- `templates/saydo.config.dev.example.toml`:对话 API + 沉思 `cursor_cli` / 廉价 `grok_cli` / 评估 `codex_cli`;两条 ack 显式 `true`;`[models.dev]` 保持 cursor + cli;`[tier1]` 两键为注释行。
- `templates/saydo.env.example`:删 T17;改为「任一已登录 CLI 可零 key」;NTFY 两键注明不在向导白名单、需手改。

### F2 DEPLOY

- §4 `dist/saydo.js` → `dist/cli.mjs`
- §2:`saydo` CLI 只认 `--port`,直起 daemon 才认 `SAYDO_DAEMON_PORT`;控制台入口改 `http://localhost:47100/?token=…`(WebAuthn rpId;`127.0.0.1` 页面 308;`curl /health` 仍 127.0.0.1)
- §4 末:常驻 `just daemon install` 会生成 pipeline plist;无 `uv` 时 `--without-pipeline`

### F3 launchd

- `buildPipelinePlist` 纯函数:Label `com.saydo.pipeline`;ProgramArguments 五元组 `uvBin, run, python, -m, saydo_pipeline`;KeepAlive.SuccessfulExit=false;RunAtLoad;ThrottleInterval=5;两条 pipeline.launchd 日志;Env 含 PATH + SAYDO_HOME,可选 SAYDO_DAEMON_PORT。
- `planInstall` 四态纯函数,命令层只消费计划。
- `cmdInstall`:plist 不存在且找到 uv → 原子写(tmp+rename)开发树 `pipeline/` 并 bootstrap;找不到 uv → `[fail]` + exitCode=1,**不写任何 plist**;`--without-pipeline` → 只装 daemon。已存在则不覆盖,重载同 SAYDO_HOME。
- `cmdDeploy` 语义未改(仍 PlistBuddy 改存量 pipeline plist);不存在时错误文案补「先 just daemon install(会生成)」。

## 2. 门禁表(退出码紧跟命令本身)

| 命令 | 退出码 | 用例数前后 / 摘录 |
|---|---|---|
| 开批定向 `vitest run test/config.test.ts test/launchd-plist.test.ts` | 0 | **31 passed**(config 28 + launchd 3) |
| F1 后 `vitest run test/config.test.ts` | 0 | **28 passed**(it 数未增,断言加在既有 describe) |
| F3 后 `vitest run test/config.test.ts test/launchd-plist.test.ts` | 0 | **41 passed**(config 28 + launchd 13;launchd 既有 3 一字未改 + 新增 10 ≥ 6) |
| `pnpm --filter @saydo/daemon exec tsc --noEmit` | 0 | Done |
| `just ci`(node 段) | node 段绿 | typecheck / lint 无输出 / contracts **103** / cli **19** / console **253** / daemon **1510 passed \| 4 skipped** / emoji-gate self-test pass=11 / color-gate pass=21 |
| `just ci`(python 段 `ci-python`) | **2** | [warn] 实施会话沙箱历史:`uv sync` 失败 `Failed to initialize cache at ~/.cache/uv` / `Operation not permitted`。本 clone 无 `pipeline/.venv`。 |
| `just ci` 整体(实施会话沙箱) | **2** | [warn] 历史红灯;日志 107332 字节,SHA-256 `55be1f2b14865b44a1ba6f48cad73c7b719c7bde622d58127238f18f0c83cfb0` |
| 调度方沙箱外复跑 `just ci`(F1–F3 收口) | **0** | contracts 103 / cli 19 / console 253 / daemon **1510 passed \| 4 skipped** / python **33** |
| `bash scripts/check-emoji.sh`(F1 三模板 + config.test / F2 DEPLOY / F3 launchd 三文件) | 0 | `[ok] emoji gate: clean` |

全量 daemon 开批前未跑(只跑定向 31);收口全量 1510 来自 `just ci` node 段,无「改前全量」对照。

## 3. rg 断言摘录(本会话)

```
rg -n "T17" templates/          → 零命中,EXIT=1
rg -n "claude_code" templates/  → 三处,均在「运行时当前只认 cursor」注释行
rg -n "saydo\.js" DEPLOY-测试机部署清单.md → 零命中,EXIT=1
rg -n "dist/cli.mjs" DEPLOY-测试机部署清单.md → :52 一处
rg -n "LaunchAgents" packages/daemon/test/ → 零命中,EXIT=1(测试未写真实 LaunchAgents)
rg -n "pipeline plist 不存在" packages/daemon/src/launchd/cli.ts → 仅 bindPipelineStateRoot(deploy 路径),文案已补「先 just daemon install(会生成)」
```

`claude_code` 三处原文:

```
templates/saydo.config.example.toml:39:#    运行时当前只认 cursor;claude_code / codex 配了会被拒起执行器,对话不受影响;Claude Code 执行器接入中。
templates/saydo.config.example.toml:40:agent     = "cursor"                # claude_code | codex | cursor(运行时只认 cursor)
templates/saydo.config.dev.example.toml:20:#   运行时当前只认 cursor;claude_code / codex 配了会被拒起执行器,对话不受影响;Claude Code 执行器接入中。
```

## 4. 未做清单

- [fail] 真机 `just daemon install` / `install --without-pipeline` 实跑:属 owner 检查点。本批测试只用纯函数 + 临时数据,未写 `~/Library/LaunchAgents`,未 `launchctl bootstrap/bootout`,未改 `~/.saydo`。
- [warn] `scripts/runtime-preflight.sh` 仍假设 `asr/tts ok`、runtime 树实体 `.git`、pipeline plist 已存在。本批未改该脚本;新机 `install --without-pipeline` 后 preflight 会因缺 pipeline plist / voice 探活失败,属既有运维链,登记不修。
- [fail] `just ci` python 段沙箱内因 `~/.cache/uv` 不可写而红;本 clone 无 `pipeline/.venv` 可回落。node 矩阵绿。
- 未 push;未改 canonical(`docs/01–11` / modules / adr);未改 `packages/contracts`;未改 `config/types.ts` schema;未改执行器 / BYOA / console 业务代码。
- `docs/plan/IMPL-PROMPT-11-PUBLIC-READINESS.md` 与 `docs/site/` 在本 clone 为未跟踪文件,本批未提交、未改 `docs/site` 正文(回写建议见 §5)。

## 5. 对 docs/site Docs 稿的回写建议(文案由调度方改)

对照 `docs/site/2026-08-20-docs-page-content.fable.md`(本 clone 开批后工作树出现的未跟踪目录,本批只读):

- **§4.8**:删「install 前置要求语音管线 launchd plist 已存在、干净新机失败、进行中」。改为:`just daemon install` 在 pipeline plist 不存在时自动生成 `com.saydo.pipeline.plist`(开发树 `pipeline/` + 本机 `uv`);找不到 `uv` 时拒绝并提示 `just daemon install --without-pipeline`(只装 daemon,`/readyz` 报 `voiceReady=false`)。已有 plist 不覆盖。真机安装仍是系统级变更,先过 owner 检查点。
- **附录速查表「常驻」行**:删「install 当前有前置缺口,§4.8」。
- **C.1-9**:模板已对齐当前实现(七家 CLI / cursor 执行器 / `[tier1]` 两键)。Docs 配置示例可改与 `templates/saydo.config.example.toml` 同源;C.1-9 可标已处置,代码 SHA `122d101556f81ec23b1b7dce0e9c96ae7ee9dc68`。
- **C.1-10**:DEPLOY 已改为 `dist/cli.mjs`,可标已处置,SHA `96946e1d32e32a1b749a7d52453dceb715326f60`。
- **C.1-11**:install 已生成 pipeline plist,可标已处置,SHA `f69ea4337b88c4cb516d8b2c5eaaa73607f4918f`。干净新机真机验收仍待 owner。
- **C.4 检查清单**「C.1-9/10/11 模板、DEPLOY 文档、launchd install 缺口回修」:仓内三项已落地;Docs 页正文与 C.1 条目需调度方改。

## 6. 评审 1 返工

对照 `research/codex-findings/78-public-readiness-review.md`。[fail] A1/A2/A3 已修;B1–B11 本批一并修;C 级顺手。测试仍不写 `~/Library`、不真 bootstrap(纯计划 + 临时目录假 uv)。

代码提交(本文件记录这些 SHA,不自指):

| 项 | SHA | 主题 |
|---|---|---|
| A1 A2 A3 B7 B8 B9 C3 C4 C5 | `66412d6625382768e18e79e0dcb5158675fbdf6a` | `fix(launchd): 评审 1 返工——半安装可重试 / uninstall 对称清理 / 不轻信 which` |
| B3 B4 B5 B6 B11 C1 C2 | `e88d9d11a994905009019b46e1cdb7ea6d85d8cd` | `fix(templates): 评审 1 返工——CLI 示例补 model、tier1 改注释、断言锁 cursor` |
| B1 B2 | `60e114745b18c6f34ec8a64b309b0493296410cc` | `docs(deploy): 评审 1 返工——常驻口径指向本节并写清 --without-pipeline` |

逐条:

- **A1**:`planInstall` 输入加 `pipelineLoaded`;exists+未装载+未跳过 ⇒ `pipelineAction="bootstrap"`。`writePlist` 抛错留下的半安装走同一路径。用例:`exists:true, loaded:false ⇒ bootstrap` 与 `exists:true, loaded:true ⇒ reload`。
- **A2**:`uninstall` 对称 bootout + 删除 pipeline plist。exists && withoutPipeline ⇒ `[warn] pipeline plist 已存在,本旗标不拆除…` 且 `bindPipeline=false` / `pipelineAction=none`。`status` 报告 pipeline plist 与是否装载。
- **A3**:`resolveUvBin` 不调 `which`;只遍历绝对 PATH;isAbsolute + 常规文件 + X_OK + basename===uv;返回 realpath。临时目录三例:可执行命中 / 非可执行跳过 / 相对 PATH 跳过。
- **B1**:DEPLOY 删「见 §F3」,改「见本节」并写生成 `~/Library/LaunchAgents/com.saydo.pipeline.plist`。
- **B2**:写明 `--without-pipeline` 只装 daemon、桌面浏览器云端语音不可用(系统语音与 iPhone 原生仍可)、已有 plist 不拆除。
- **B3**:gemini/qwen/copilot 补可解析 model;评估档 CLI 旁给双 ack 示例。
- **B4**:`[hopper]` 头注改为「生产绑定当前休眠;上手可整段删除。下列仅为占位,不是启动前提」。
- **B5**:env.example 第 6 行改为「仅当对应槽走 API/via=openrouter 时需要」。
- **B6**:default 模板断言改为 `expect(c.models.dev?.agent).toBe("cursor")` 且 transport===cli。
- **B7**:`cmdDeploy` 开头 `existsSync(PIPELINE_PLIST_PATH)`,缺失抛 `pipelinePlistMissingMessage`(含先 just daemon install)。
- **B8**:第五态 `{exists:false, uvBin:"/x/uv", withoutPipeline:true}`;bootstrap 决策进纯计划(见 A1)。
- **B9**:写前检查 `pipelineDirExists`;daemon/pipeline 两边都不写 `SAYDO_DAEMON_PORT`(缺省 47100)。
- **B10**:见 §2 调度方沙箱外复跑行;实施会话沙箱红灯保留为 [warn] 历史。
- **B11**:`[tier1]` 两键改为注释 + 头注占位值会 `bin_missing`。
- **C**:括号套括号随 B4 消除;CLI 示例加「不要同时取消多行同槽」;删 `!uvBin` 死分支;tmp rename 失败 `rmSync`;reason 前缀常量单源。

门禁(评审 1 返工本会话):

| 命令 | 退出码 | 摘录 |
|---|---|---|
| 返工前定向(F3 收口) | 0 | **41 passed**(config 28 + launchd 13) |
| 返工后 `vitest run test/config.test.ts test/launchd-plist.test.ts` | 0 | **51 passed**(config 28 + launchd 23) |
| `just ci`(本会话) | **2** | node: contracts 103 / cli 19 / console 253 / daemon **1520 passed \| 4 skipped**;python 段仍 `~/.cache/uv` Operation not permitted。日志 106020 字节,SHA-256 `c6bff5e040d781cc2250b822224de26eacc20ef9009b24fbacca8410a6288663` |
| `rg -n "which" packages/daemon/src/launchd/` | 0 | 仅 `uvBin.ts` 头注「不调裸名 which」 |
| `rg -n "LaunchAgents" packages/daemon/test/` | 1 | 零命中 |
| `rg -n "§F3" DEPLOY-测试机部署清单.md` | 1 | 零命中 |
| emoji(改动文件) | 0 | `[ok] emoji gate: clean` |

未做:真机 `just daemon install` / uninstall 实跑(owner 检查点);本会话 python 段仍沙箱红,调度方沙箱外复跑 F1–F3 为 EXIT=0 / python 33(§2);返工后全量 python 待调度方再跑。

评审 2 复核:调度方沙箱外 just ci EXIT=0 / daemon 1520|4 / python 33;zero-context 评审 79 可并入。

## 7. 评审 2 收口

对照 `research/codex-findings/79-public-readiness-review-2.md`。结论可并入;本批收口 B1/B2 与 C1/C2/C3/C5/C6。

代码提交(本文件记录此 SHA,不自指):`5827de2925a3c2f6c13a12128fb691cdc371a096`(`fix(launchd): 评审 2 收口——uv 路径不 realpath、loaded 只看 print、bootstrap 前先 bootout`)。

- **B1**:`resolveUvBin` 返回 PATH candidate,不用 realpath 替换写入值。用例期望改为 candidate。
- **B2**:install 的 `pipelineLoaded` 只看 `launchctl print`;`pipelineAction==="bootstrap"` 前若 print 已装载则先 bootout。uninstall 在 pipeline bootout 失败时不删 plist,`[warn]` + exitCode=1。
- **C1**:`exists:true, loaded:false, withoutPipeline:true ⇒ idle+reason`。
- **C2**:半安装用例钉 `writeUvBin===null`。
- **C3**:写前 `isExistingDirectory`(statSync.isDirectory);不跑 `uv --version`。
- **C5**:§1 `[tier1]` 改为「注释行」。
- **C6**:本段上一行的调度方复核数字。

门禁:定向 vitest **53 passed**(config 28 + launchd 25;评审 1 收口 51 → +2);`tsc --noEmit` EXIT=0;emoji clean;`rg LaunchAgents packages/daemon/test/` EXIT=1。
