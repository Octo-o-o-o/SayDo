# 79 · public-readiness 批 评审 2(返工复核;Grok grok-4.6 xhigh 只读;Codex 配额耗尽回落)

> prompt:`prompts/79-public-readiness-review-2.md`;session `01a01b43-c9db-7bc1-8d41-8b08fe60c763`;门禁由调度方沙箱外实跑(`just ci` EXIT=0,daemon 1520|4)。

先读评审技能、评审 1 报告、返工 diff 与规格，再对照 launchd 源码和测试全文核验 A/B/C。评审 1 已定位。接下来读规格、返工 diff、launchd 源码和测试全文。源码骨架已齐。接下来对照测试、模板、校验器和 git 提交，核验 A/B 是否真锁住。# 79 · public-readiness 批 评审 2(返工复核)

> 对象:`git diff 7382f9c..HEAD`(`.tmp/rework-diff.patch` + 落盘源文件)。基线 `7382f9c72ea7bbeb664b11b9db11fb1078e144e2`;HEAD `39dbaef4c0f37921c55954844abc36b1bc9faa72`。四提交与 `.git/logs/HEAD` 一致:`66412d6` launchd / `e88d9d1` templates / `60e1147` DEPLOY / `39dbaef` evidence。规格:`docs/plan/IMPL-PROMPT-11-PUBLIC-READINESS.md`。对照评审 1:`research/codex-findings/78-public-readiness-review.md`。
> 本会话只读,未跑 vitest / `just ci`。门禁采信调度方: `just ci` EXIT=0(contracts 103 / cli 19 / console 253 / daemon 1520 passed|4 skipped / python 33);定向 config+launchd **51 passed**。

**结论:[ok] 可并入。** 评审 1 的 A1/A2/A3 均已落到命令层与纯计划,B1–B11 与 C 均有对应 diff。无新的 A 级洞。有两处返工引入的 B 级生命周期/路径钉死问题,不阻断并入,登记即可。

---

## ① 评审 1 的 A1/A2/A3

### A1 · 半安装再次 `install` 可重试 — [ok] 已修

评审 1 的死路径是:`wrotePipeline=false` 且 `print` 失败 ⇒ 既不写也不 bootstrap。返工把「要不要装载」收进 `planInstall`,命令层只消费 `pipelineAction`。

- 计划:`packages/daemon/src/launchd/plist.ts:187-192` — `exists && !loaded && !withoutPipeline` ⇒ `pipelineAction: "bootstrap"` + `bindPipeline: true`,不覆盖文件。
- 命令:`cli.ts:178-179` 先 `print` 再入计划;`cli.ts:213-222` 在 daemon bootstrap 成功后对 `"bootstrap"` 调 `bootstrapWithRetry(PIPELINE_PLIST_PATH)`,失败文案仍是「可稍后 just daemon install 重试 pipeline」,此时 plist 仍在、job 未装载,下一轮走同一分支,路径不再是死的。
- `writePlist()` 抛错留下的未装载 pipeline 文件同样 `exists && !loaded`,走同一 bootstrap。
- 用例:`launchd-plist.test.ts:164-169` 钉 `exists:true, loaded:false ⇒ bootstrap`;`:172-177` 钉 `loaded:true ⇒ reload`。

无 uv 时仍先 `exitCode=1` 且不写任何 plist(`plist.ts:194-195` + `cli.ts:189-192`),规格这条没被改坏。

### A2 · `uninstall` 对称清理 pipeline — [ok] 已修

- `cli.ts:249-261`:`print` pipeline target → `bootout` → 存在则 `rmSync(PIPELINE_PLIST_PATH)`,`[ok]/[warn]` 成对打印。不再只卸 daemon。
- `exists && withoutPipeline`:`plist.ts:181-184` 返回 `PLAN_IDLE` + `PLAN_REASON_EXISTS_WITHOUT_PIPELINE`;`cli.ts:194` 打出 `[warn] pipeline plist 已存在,本旗标不拆除…`;`bindPipeline=false` / `pipelineAction=none`,旗标不再静默 bind/reload。用例:`launchd-plist.test.ts:189-200`。
- `status`:`cli.ts:313-321` 报告 pipeline plist 路径与是否装载。
- `stop`:`cli.ts:280-290` 卸 daemon 后若 pipeline 仍在装载,打 `[warn] pipeline 仍在装载;要停语音管线请 uninstall`(按评审 1「至少报告」,并不在 `stop` 里拆管线)。

相对原规格「已存在则重载同 SAYDO_HOME」:加了 `--without-pipeline` 时不重载。这是评审 1 要求的偏离,合理。

### A3 · 不再轻信 `which` stdout — [ok] 已修

- `resolveUvBin` 迁到 `packages/daemon/src/launchd/uvBin.ts:7-26`:不调裸名 `which`(全目录仅头注提到);PATH 项必须 `isAbsolute`;跳过空项与 `.`;`join(dir,"uv")` 再验绝对路径且 `basename==="uv"`;`statSync.isFile()` + `accessSync(X_OK)`;命中后 `realpathSync`(失败则退回 candidate)。
- `cli.ts` 已删除旧 `execFileSync("which", ["uv"])`。
- 用例:`launchd-plist.test.ts:236-246` 可执行命中;`248-257` 非可执行跳过;`260-276` 相对 PATH / `.` / 空项跳过,即便 cwd 下有可执行 `uv`。

假 `which` 把非 uv 路径写入 `ProgramArguments[0]` 的面已关掉。副作用见下文新 B1(realpath 钉 cellar)。

---

## ② B1–B11 / C 处置

| 项 | 裁决 | 证据 |
|---|---|---|
| B1 DEPLOY「§F3」 | [ok] | `DEPLOY-测试机部署清单.md:53` 改为「见本节」并写 `~/Library/LaunchAgents/com.saydo.pipeline.plist` |
| B2 `--without-pipeline` 口径 | [ok] | 同段:只装 daemon、桌面浏览器云端语音不可用、系统语音与 iPhone 原生仍可、已有 plist 不拆除。`cli.ts:483-485` usage 同步 |
| B3 注释 CLI 无 model ⇒ unknown | [ok] | `templates/saydo.config.example.toml:32-35` gemini/qwen/copilot 补 `model`;grok 仍可省。`validate.ts:151-156` + `family.ts` 前缀表:`gemini-2.5-pro`→gemini、`qwen3-coder-plus`→qwen、`gpt-5.6-luna`→gpt,取消注释后配置期不是 `unknown`。评估档 CLI 旁给了双 ack 注释行(`:36-37`) |
| B4 hopper 头注 | [ok] | `saydo.config.example.toml:80-81`「上手可整段删除。下列仅为占位,不是启动前提」。schema 仍 `hopper: z.looseObject({}).optional()`(`types.ts:66`) |
| B5 env 头注互打 | [ok] | `templates/saydo.env.example:6`「仅当对应槽走 API/via=openrouter 时需要」 |
| B6 default `dev.agent` 断言短路 | [ok] | `config.test.ts:367-368` 改为 `expect(c.models.dev?.agent).toBe("cursor")` 且 `transport==="cli"`。读的是解析后的 `c.models.dev`,不是恒 `undefined` 的 `effective.dev`;改回 `claude_code` 会红 |
| B7 deploy 缺 plist 文案不可达 | [ok] | `cli.ts:386-388` `cmdDeploy` 开头 `existsSync`,缺则抛 `pipelinePlistMissingMessage`(`plist.ts:144-146`)。用例:`launchd-plist.test.ts:216-219` |
| B8 第五态 + bootstrap 进纯计划 | [ok] | 第五态 `launchd-plist.test.ts:180-186`;A1 两态见上。命令层仍无 launchctl 桩测,与规格「测试只测纯函数 + buildPipelinePlist」一致,不重开 |
| B9 写前查 pipeline 目录 / 端口同源 | [ok] 主诉求 | `cli.ts:113-114` + `plist.ts:197-198` 无目录则不写;`cli.ts:118-125` 两边都不写 `SAYDO_DAEMON_PORT`。用例:`test:203-214`。未跑 `uv --version`(评审 1 修法里有,属残留 C) |
| B10 evidence 门禁表 | [ok] | `e2e/evidence/public-readiness.md:54` 调度方沙箱外复跑 EXIT=0 / python 33;实施会话沙箱红灯留为 `[warn]` 历史。返工 SHA 不自指(`:105-107` 记 66412d6/e88d9d1/60e1147,自身是 `39dbaef`) |
| B11 `[tier1]` 占位走 `bin_missing` | [ok] | 两份模板两键改为注释 + 头注(`saydo.config.example.toml:46-50`,`saydo.config.dev.example.toml:25-29`)。缺两键 ⇒ `tier1StartupVerdict` `not_configured`(`validateConfig.ts:95-101`) |
| C1 括号套括号 | [ok] | 随 B4 消除 |
| C2 多行同槽 | [ok] | `saydo.config.example.toml:28`「不要同时取消多行同槽」 |
| C3 `!uvBin` 死分支 | [ok] | 已删;写盘改消费 `plan.writeUvBin`(`cli.ts:195-197`) |
| C4 tmp 残留 | [ok] | `cli.ts:127-133` `renameSync` 失败 `rmSync(tmp,{force:true})` 再抛 |
| C5 reason 前缀双源 | [ok] | `PLAN_REASON_*` 单源(`plist.ts:135-142`);命令层 `console.log(plan.reason)` |

规格字面要求活 `[tier1]` 两键、以及 `resolveUvBin` 可用 `which`:返工按评审 1 偏离,合理,不记为缺口。

---

## ③ 返工有没有引入回归

### launchd 命令层

主路径形状正确,与纯计划对齐:

1. 新写:`writeUvBin` → 原子写 pipeline → 写 daemon → daemon bootstrap → `pipelineAction==="bootstrap"`。
2. 半安装:`exists && !loaded` → 不覆盖 → bind SAYDO_HOME → daemon 幂等重装 → pipeline bootstrap。
3. 已装载:`reload` = bootout + bootstrap。
4. `--without-pipeline`:不写、不 bind、不 reload;无 plist 时仍只装 daemon。

daemon 自身 `isLoaded()` 仍不看文件是否存在,bootout 后再 bootstrap(`cli.ts:164-166,202-206`)。pipeline 侧不完全对称,见新 B2。

`start` 仍只装载 daemon,不装载 pipeline。评审 1 只要求 stop/status 报告,不升 B。

### uninstall / status 新分支

- uninstall 幸福路径:daemon bootout+删文件,pipeline bootout+删文件。对称。
- status 增加 pipeline 两行,不改变 daemon 探活。
- stop 从「未装载立刻 return」改为继续看 pipeline,避免「daemon 已停、管线还在刷」却毫无提示。管线本身仍常驻,要停靠 uninstall——与 A2 修法一致,不是回归。

`deploy` 仍是 PlistBuddy 改存量 WorkingDirectory/SAYDO_HOME,只是缺文件时提前抛同一句「先 just daemon install」。语义未改成「deploy 代写 plist」。

### 模板能否过 `configSchema` + `validateConfig`

活配置(未注释四槽):

- default:`parseConfigText` → `configSchema.parse`(`load.ts:8-9`)。四槽 OpenRouter API;evaluator `anthropic/claude-sonnet-5` ⇒ family claude,与 dialog/thinking 的 gpt 异族;无 CLI evaluator、无活 `[tier1]`。`config.test.ts:360-368` 锁 `ok===true`、`effective.evaluator.family==="claude"`、`violations.length===0`、`dev.agent==="cursor"`、`transport==="cli"`。
- dev:`SAYDO_DEV=1` 下 `ok===true`,双 ack 为 true(`:371-379`)。`hopper` 为 optional looseObject,占位段不拒启动。

注释示例(B3 面):gemini/qwen/copilot 的 model 均可被 `familyFromModelName` 解析,配置期不会落到 `validate.ts:153-155` 的 `unknown`。grok 无 model 仍恒 grok(`:139-149`)。

本会话未再跑 vitest;上述为静态对照。调度方定向 51 passed 与这条形状锁一致。

### 测试是否真锁住形状

| 断言 | 是否锁住 |
|---|---|
| default `dev.agent==="cursor"` | [ok] 真锁。改回 `claude_code` 必红 |
| `planInstall` 原四态 + 第五态 + A1 bootstrap/reload + exists+withoutPipeline + 无 pipeline 目录 | [ok] 锁计划输出,不锁 `launchctl` 副作用(规格如此) |
| `buildPipelinePlist` Label / 五元组 / KeepAlive / 日志 / 端口缺省不写 / `&<>` | [ok] 既有用例还在,B9 补了 daemon/pipeline 都不写端口 |
| `resolveUvBin` 可执行 / 非可执行 / 相对 PATH | [ok] 锁「不信相对项、要 X_OK」;[warn] 同时把「返回 realpath」钉死(`:242`),PATH 项若是 Homebrew symlink,测试不允许改回写 symlink 本身 |
| `exists && !loaded` 未断言 `writeUvBin===null` | 缺口,见 C。当前实现是 `PLAN_IDLE` 的 null,命令层却按 `writeUvBin` 而不是 `writePipelinePlist` 决定写盘——计划与命令的键不一致,测试没钉 |

既有 `buildLaunchdPlist` 三例未改。`rg LaunchAgents` 在 `packages/daemon/test/` 仍应为零(测试用临时目录,不写真实 LaunchAgents)。

---

## 新发现

### A 级

无。

### B 级

**B1 · `realpathSync` + 「已存在不覆盖」会把 Homebrew cellar 路径写死**

- 文件:`uvBin.ts:21-24`;`cli.ts:187-192`(exists 则不重写 ProgramArguments);`launchd-plist.test.ts:242` 把 realpath 当成期望。
- 问题:评审 1 写「realpath 可选」。实现选了 realpath。macOS 上 `/opt/homebrew/bin/uv` 的 realpath 是 `/opt/homebrew/Cellar/uv/<ver>/bin/uv`。`brew upgrade uv` 后旧 cellar 消失,KeepAlive 每 5 秒打空路径。因为 exists 路径只 bind `SAYDO_HOME`、不更新 `ProgramArguments[0]`,`just daemon install` 重载也修不好,必须 uninstall 再装(或手改 plist)。
- 对比:旧 `which` 通常给出 prefix symlink,升级后仍指向新 cellar。这是 A3 修复的回归面,不是「又写入非 uv 二进制」。
- 修法(若做):写入 plist 用校验过的 PATH 项(绝对路径 + basename `uv` + 常规文件 + X_OK),realpath 只做等价确认,不替换写入值;exists 重装若发现 ProgramArguments[0] 不可执行再重写。测试不要把 realpath 串当成唯一合法返回。

**B2 · uninstall 在 pipeline `bootout` 失败后仍删 plist;install 用 `exists && print` 判断 loaded,「job 在、文件无」无法恢复**

- 文件:`cli.ts:249-258`(uninstall:print **不**看文件,bootout 失败仍 `rmSync`);`cli.ts:179`(install:`pipelineLoaded = pipelinePlistExists && print.ok`);`cli.ts:213-214`(bootstrap 前不 bootout)。
- 问题:daemon 侧 `isLoaded()` 不看文件,bootstrap 前若已装载会先 bootout。pipeline 侧一旦文件被删而 job 仍在,计划看见 `exists:false` 会走「新写 + bootstrap」,不会先 bootout,bootstrap 会被「already loaded」挡住。触发面:uninstall 打了 `[warn] pipeline bootout:…` 仍删文件;或手删 plist 但 job 还在。不是 A1 那种「命令叫你重试、重试是死的」幸福路径,需要 bootout 先失败(或手删),故不升 A。
- 修法:install 的 loaded 与 uninstall 一样只看 `print`;`pipelineAction==="bootstrap"` 前若 print 已装载则先 bootout(与 daemon 对齐);uninstall 在 bootout 失败时不要删文件,或删前再 print 确认已卸。

### C 级

1. `exists && !loaded && withoutPipeline` 无单独用例(实现因旗标优先而安全;若有人把 exists 分支挪到旗标前面,loaded:true 那条仍红,loaded:false 会漏)。
2. 半安装用例未钉 `writeUvBin===null`;命令层只看 `writeUvBin`(`cli.ts:195`)。计划若以后在 exists 路径填上 uvBin,会违反「已存在不覆盖」且测试不红。
3. 未检查 `pipeline/` 是目录、未跑 `uv --version`(B9 残留)。坏树 + KeepAlive 仍可能 5 秒崩一次。
4. `start`/`restart` 仍不管 pipeline;只 `stop` 警告。
5. evidence §1 仍写活 `[tier1]` 两键,与 §6 返工(已改注释)不一致,属档案漂移。
6. evidence §6 返工门禁仍记实施会话 `just ci` EXIT=2;调度方本次已是 EXIT=0 / daemon 1520|4 / python 33,收口数字在调度方侧,不在文件里。

---

## 已核对、本轮不成立的焦点

| 焦点 | 裁决 |
|---|---|
| A1 重试仍死 | [ok] `exists && !loaded` ⇒ bootstrap,命令层消费该动作 |
| A2 uninstall 仍只卸 daemon | [ok] 对称 bootout+删文件;withoutPipeline 不再静默重载 |
| A3 仍调 `which` | [ok] 源码仅头注;PATH 绝对项 + basename + X_OK |
| 活模板 schema/validate 会红 | [ok] 静态对照 + 测试锁 evaluator=claude / violations=0 / cursor;注释示例 family 可解析 |
| `deploy` 语义被改 | [ok] 仍改存量 plist;只把缺文件文案提前到入口 |
| 既有 launchd 三例 / config 其余断言 | [ok] 未改结构;只动允许的 `dev.agent` 断言并加 transport |
| 无 uv 仍写 plist | [ok] `exitCode=1` 在 `writePlist` 之前 return |
| 测试写真实 `~/Library/LaunchAgents` | [ok] 测试用临时目录;resolveUvBin 三例在 `os.tmpdir()` |
| evidence 返工 SHA 自指 | [ok] `39dbaef` 记录前三个 SHA |
| emoji / 契约分叉 / canonical | [ok] 抽查改动文件无 pictographic;未改 `packages/contracts` 与 `config/types.ts` schema |

未做:真机 `just daemon install`/`uninstall`(规格定为 owner 检查点);本会话未跑 vitest/`just ci`(用调度方结果)。

---

## 总评

**[ok] 可并入,不必再为评审 1 的 A 级返工。**

A1 半安装可重试、A2 uninstall 有逆操作、A3 不再把 `which` stdout 写进登录自起,这三处都有源码行号与测试钉。B1–B11 与 C 均落地。活模板仍能过 schema+validate;B6 断言不再短路。

并入后登记(不挡):Homebrew `realpath` 把 cellar 版本钉进「永不覆盖」的 pipeline plist(新 B1);uninstall bootout 失败仍删文件,与 install「loaded 必须先有文件」不对称(新 B2)。若要修,优先 B1(桌面机 `brew upgrade uv` 后语音管线会静默崩),B2 次之。