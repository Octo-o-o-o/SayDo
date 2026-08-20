# 78 · public-readiness 批 code review(Grok grok-4.6 xhigh 只读会话;Codex 配额耗尽回落)

> prompt:`prompts/78-public-readiness-review.md`;执行 2026-08-20 ~02:40;session `01a01b2d-f85d-7a22-a9dc-5229810a8f20`;原始事件流 `.tmp/grok-78-review.jsonl`(不入库);门禁由调度方沙箱外实跑(`just ci` EXIT=0,daemon 1510|4)。

先读审查技能与规格、diff 导出，再对照源文件做只读对账。规格已定位。接下来读完整 diff 与关键源文件、测试和 evidence。diff 已齐。对照 schema、校验器、launchd 命令层和模板全文做静态核验。继续核对 family 解析、DEPLOY 全文、justfile，以及 `which uv` / uninstall 路径。核对 `cmdInstall` 失败重试、`pnpm` 参数透传，以及 default 模板测试是否真锁住 `dev.agent`。# public-readiness 批 · 对抗 code review

> 对象:`git diff 354b028..HEAD`(读 `.tmp/batch-diff.patch` + 落盘源文件)。基线 `354b0284f099db882df65e4b974bdd1b0629966e`;HEAD `7382f9c72ea7bbeb664b11b9db11fb1078e144e2`(`.git/logs/HEAD` 四提交链与 evidence 三 SHA 一致)。规格:`docs/plan/IMPL-PROMPT-11-PUBLIC-READINESS.md`。
> 本会话只读,未执行命令。门禁数字来自调度方:`just ci` EXIT=0(contracts 103 / cli 19 / console 253 / daemon 1510 passed|4 skipped / python 33);定向 vitest 41 passed;emoji clean;`rg T17|saydo.js` 零命中。

**结论:[fail] 不可并入。** launchd 写入路径有三处 A 级状态机/生命周期/二进制解析缺陷,须返工后再审。

---

## A 级(必修)

### A1 · pipeline bootstrap 失败后,再次 `install` 无法重试装载

- **文件:** `packages/daemon/src/launchd/cli.ts:221-259`
- **问题:** 首次写入 pipeline plist 后 `bootstrap` 失败时,命令打印「可稍后 just daemon install 重试 pipeline」,但重试路径是死的。第二次 `install` 因文件已存在:`planInstall` 不写、`wrotePipeline=false`、`pipelineWasLoaded` 要求 `launchctl print` 已成功——失败态下 print 为 false,于是既不写也不 bootstrap。半安装态(plist 在、job 未装载)只能手删 plist 或手跑 `launchctl bootstrap`。
- **证据:**

```221:259:packages/daemon/src/launchd/cli.ts
  const pipelineWasLoaded =
    !wrotePipeline && pipelinePlistExists && launchctl(["print", pipelineServiceTarget()]).ok;
  // ...
  if (wrotePipeline) {
    const pipelineResult = bootstrapWithRetry(PIPELINE_PLIST_PATH);
    if (!pipelineResult.ok) {
      console.error(`[fail] pipeline bootstrap 失败:${pipelineResult.out}`);
      console.error("[warn] daemon 已装载,未回滚;可稍后 just daemon install 重试 pipeline");
      process.exitCode = 1;
      return;
    }
    // ...
    return;
  }
  if (pipelineWasLoaded) {
    launchctl(["bootout", pipelineServiceTarget()]);
    const pipelineResult = bootstrapWithRetry(PIPELINE_PLIST_PATH);
```

  同型:第一次已写入、随后 `writePlist()` 抛错(tsx 缺失)时,留下未装载的 pipeline plist,后续 install 同样不会 bootstrap。
- **修法:** 存在但未装载、且未带 `--without-pipeline` 时,必须 `bootstrapWithRetry`(不要用「曾经 loaded」当门)。提示「可重试」之前,这条路径要真能走通。补用例:「plist 在、print 失败、withoutPipeline=false ⇒ 仍 bootstrap」(命令层用注入的 `launchctl`/`exists` 桩,或把「是否 bootstrap」收进纯函数,不要只测 `planInstall` 四态)。

### A2 · `install` 新写入的 pipeline plist,`uninstall` 不对称清理

- **文件:** `packages/daemon/src/launchd/cli.ts:133-149`(写)、`:262-275`(卸)、`:277-324`(`start`/`stop`/`status` 仍只看 daemon)
- **问题:** 本批让 `install` 原子写入 `~/Library/LaunchAgents/com.saydo.pipeline.plist` 并 bootstrap(`KeepAlive.SuccessfulExit=false`)。`uninstall` 只 bootout/删除 daemon plist。结果:(1) `uninstall` 后语音管线仍常驻、崩溃自启,打已死的 daemon;(2) 文件还在,`planInstall` 见 `exists:true` 直接短路,之后的 `--without-pipeline` 被静默忽略,还可能把残留 job 再 bind/reload。规格虽未点名改 uninstall,但这是本批新写入路径没有逆操作,属于 launchd 安装路径的生命周期缺陷。
- **证据:** `writePipelinePlist` 写 `PIPELINE_PLIST_PATH` 并 `renameSync`;`cmdUninstall` 只处理 `PLIST_PATH` / `serviceTarget()`,零引用 `PIPELINE_LAUNCHD_LABEL`。`planInstall` 对 `pipelinePlistExists:true` 无条件 `{ writePipelinePlist:false, exitCode:0 }`,不看 `withoutPipeline`(`plist.ts:148-151`)。
- **修法:** `uninstall` 对称 `bootout` + 删除 `com.saydo.pipeline.plist`(打印 `[ok]/[warn]`)。`exists && withoutPipeline` 时至少打 `[warn] pipeline plist 已存在,本旗标不拆除;要停语音管线请 uninstall 或手删`。`stop`/`status` 至少报告 pipeline 是否在装载,避免「daemon 停了、管线还在刷」。

### A3 · `resolveUvBin` 轻信 `which` stdout,可把非 uv 路径写入 launchd

- **文件:** `packages/daemon/src/launchd/cli.ts:109-149`、`packages/daemon/src/launchd/plist.ts:104-110`
- **问题:** `execFileSync("which", ["uv"], { env })` 本身经 `PATH` 解析 `which`。假 `which` 可打印任意已存在路径;随后只 `existsSync(found)`(不要求 basename=`uv`、不要求绝对路径、不要求常规文件、不要求 `X_OK`)。该字符串经 `esc` 后进入 `ProgramArguments[0]`,登录自起。PATH 遍历分支有 `isFile()`,`which` 成功路径没有,校验还更弱。相对路径(PATH 含 `.` 时 `which` 可能给 `./uv`)写进 launchd 后,工作目录是 `pipeline/`,解析目标会偏。
- **证据:**

```109:131:packages/daemon/src/launchd/cli.ts
function resolveUvBin(env: NodeJS.ProcessEnv = process.env): string | null {
  try {
    const found = execFileSync("which", ["uv"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    if (found.length > 0 && existsSync(found)) return found;
  } catch {
    // which 未找到或不可用,改走 PATH 手工遍历
  }
  for (const dir of (env["PATH"] ?? "").split(":")) {
    // ... existsSync + statSync.isFile(),仍无 X_OK / isAbsolute / basename
```

  XML 对 `&<>` 有 `esc`,路径里的 `</string>` 不会破 plist;风险是「装错二进制并持久化」,不是 XML 注入。
- **修法:** 不要调裸名 `which`(或只跑 `/usr/bin/which`)。只遍历 `PATH`:跳过空项与 `.`;`join(dir,"uv")`;`stat` 为 file;`X_OK`;`path.isAbsolute`;`basename===uv`。拒绝相对路径。写入前 `realpathSync` 可选,但不要把未校验的 stdout 直接塞进 plist。

---

## B 级

### B1 · DEPLOY 指向不存在的「§F3」

- **文件:** `DEPLOY-测试机部署清单.md:53`
- **问题:** 「见 §F3」是实施 prompt 任务号,DEPLOY 本文只有 §1–§6。外部用户按清单找不到节。
- **修法:** 改成指向本文件 §4 自身,或删「见 §F3」,补一句「生成 `~/Library/LaunchAgents/com.saydo.pipeline.plist`」。

### B2 · `--without-pipeline` 对外口径偏「常规可选」,未写清桌面 Web 语音不可用

- **文件:** `DEPLOY-测试机部署清单.md:50-53`;`cli.ts:205-207,481`
- **问题:** install 当时有 `[warn] … /readyz 将报 voiceReady=false`,清单却写成「无 uv 时用 `--without-pipeline`」,与上一行「Web 语音需 pipeline」未交叉。plist 已存在时旗标被忽略且无提示(见 A2)。未达「静默声称语音可用」的 A 线,但文档会让人当成等价安装路径。
- **修法:** DEPLOY 写明:该旗标只装 daemon;桌面浏览器说话/朗读不可用;iPhone native 语音仍可;已有 pipeline plist 时旗标不拆除。

### B3 · 注释掉的 CLI 示例:gemini/qwen/copilot 无 `model` 会得到 `family=unknown`

- **文件:** `templates/saydo.config.example.toml:28-35`
- **问题:** schema 允许 grok/gemini/qwen/copilot 省 `model`(`modelbinding.ts:36-43`)。`validate.ts:151-156` 对 gemini/qwen/copilot 无 model 或解析不出时返回 `family:"unknown"`(不进 violations)。09 口径:传输型 CLI 配置期 unknown 会在自检阻断。把这三家写成无 model 的可粘贴行,用户取消注释后自检红、`validateConfig` 仍 `ok`。grok 无 model 族恒 grok,可以省;另外三家不行。活模板(未注释四槽)校验绿,故不是 A。
- **修法:** grok 可保持无 model;gemini/qwen/copilot 补能解析的 `model=`,或注明「无 model ⇒ family unknown,自检阻断」。评估档那行旁给 ack 两键示例,避免只开 `grok_cli` 却忘 ack(深评保持 unarmed)。

### B4 · `[hopper]` 头注「可整段留空」vs 示例仍是完整生产绑定

- **文件:** `templates/saydo.config.example.toml:77-86`
- **问题:** 规格要求改头注并保留键值,字面做到了。嵌套括号头注 + 仍填 `bin`/`vault`/40 位 SHA,外部用户容易当成上手必填。`hopper` 在 schema 里是 `optional`+`looseObject`,删段确实能过。
- **修法:** 头注改成「生产绑定当前休眠;上手可整段删除。下列仅为占位,不是启动前提」。

### B5 · `saydo.env.example` 头注与下一行互相打

- **文件:** `templates/saydo.env.example:5-6`
- **问题:** 第 5 行「任一已登录 CLI 可零 key」;第 6 行仍写「四个推理槽经 `[providers.api.openrouter]`」,像四槽必须走 OpenRouter。与 default 模板现状相符,与新头注/dev 模板(三槽 CLI)不符。
- **修法:** 改成「仅当对应槽走 API/via=openrouter 时需要」。

### B6 · default 模板 `dev.agent === "cursor"` 断言被短路,锁不住形状

- **文件:** `packages/daemon/test/config.test.ts:367-368`
- **问题:** `validateConfig` 的 `effective` 只填 dialog/thinking/cheap/evaluator(`validate.ts:263-278`),`effective.dev` 恒 `undefined`。`expect(r.effective?.["dev"] === undefined || c.models.dev?.agent === "cursor")` 左支恒真。把 agent 改回 `claude_code`,本测试仍绿。dev 模板那条 `expect(c.models.dev?.agent).toBe("cursor")` 是真锁;default 不是。规格要改的正是这条。
- **修法:** 改成 `expect(c.models.dev?.agent).toBe("cursor")`(可保留 `transport === "cli"`)。

### B7 · deploy「pipeline plist 不存在」新文案实际不可达

- **文件:** `packages/daemon/src/launchd/cli.ts:152-155` vs `:401-419`
- **问题:** 规格要 deploy 缺 plist 时补「先 just daemon install(会生成)」。改的是 `bindPipelineStateRoot`。`cmdDeploy` 先 `PlistBuddy Print :ProgramArguments:0`,文件不存在时抛 PlistBuddy 错,到不了新文案。`cmdInstall` 在 exists 时才调 `bindPipelineStateRoot`,缺文件分支也到不了。deploy 语义未改(仍 PlistBuddy 改存量),不是 A;规格要求的文案是死代码。
- **修法:** `cmdDeploy` 开头 `existsSync(PIPELINE_PLIST_PATH)`,失败再抛带 install 提示的错。

### B8 · `planInstall` 缺第五态;命令层副作用零测

- **文件:** `packages/daemon/test/launchd-plist.test.ts:124-147`;`plist.ts:148-168`
- **问题:** 规格四态有测,用例数 10≥6。[ok] 缺 `{exists:false, uvBin:"/x/uv", withoutPipeline:true}`(实现因先看旗标而不写,但无回归钉)。A1 的「exists 且未装载仍要 bootstrap」完全未覆盖。`resolveUvBin` / `cmdInstall` 无桩测,与「系统副作用可注入」只做到抽出 `planInstall`。
- **修法:** 补第五态;把「是否 bootstrap pipeline」收进纯计划(exists/loaded/withoutPipeline/uvBin),命令层只消费。

### B9 · 写入 pipeline plist 前不检查 `pipeline/` 与 `uv` 可用性

- **文件:** `packages/daemon/src/launchd/cli.ts:133-149`
- **问题:** 不检查 `DEV_ROOT/pipeline` 是否存在,不跑 `uv --version`。坏树 + KeepAlive 会每 5 秒崩一次。`SAYDO_DAEMON_PORT` 从当前 shell 快照进 pipeline plist,daemon plist 不写该键(`writePlist` 只快照 PATH/SAYDO_HOME/SAYDO_DEV)。shell 若导出非 47100,管线打错口,daemon 仍听 47100。
- **修法:** 写盘前 `existsSync(pipelineDir)`;端口只在与 daemon 同源时写入(daemon plist 也写,或两边都不写、让管线走缺省 47100)。

### B10 · evidence 门禁表与调度方收口数字不一致

- **文件:** `e2e/evidence/public-readiness.md:51-53`
- **问题:** 三代码 SHA 与 `.git/logs/HEAD` 一致(F1 `122d101556f81ec23b1b7dce0e9c96ae7ee9dc68` / F2 `96946e1d32e32a1b749a7d52453dceb715326f60` / F3 `f69ea4337b88c4cb516d8b2c5eaaa73607f4918f`),不自指。[ok] 实施会话把 `just ci` 记成整体 EXIT=2、python 段红;调度方沙箱外为 EXIT=0 / python 33。这是时序差,不是假 SHA,但收口证据仍停在红灯。
- **修法:** 加「调度方复跑」行:命令、EXIT=0、python 33,保留原沙箱红灯为 [warn] 历史。

### B11 · `[tier1]` 占位两键让执行器走 `bin_missing` 而不是 `not_configured`

- **文件:** `templates/saydo.config.example.toml:44-47`(dev 模板 `:26-28`);`packages/daemon/src/tier1/validateConfig.ts:94-102,48`
- **问题:** 规格要示例两键。占位 `/absolute/path/to/versions/<ver>/cursor-agent` 两键都非空,`tier1StartupVerdict` 不走 `not_configured`,走 `bin_missing`,每次启动 `log.error` + 审计。daemon 仍起,对话不受影响,不是 schema 红。复制即用的模板噪声偏大。
- **修法:** 两键改注释行,或头注写清「占位值会使执行器以 bin_missing 拒起,须换成真实 `versions/<ver>/`」。

---

## C 级

1. `templates/saydo.config.example.toml:77`「Hopper(执行后端候选(生产绑定当前休眠,可整段留空))」括号套括号。
2. 同文件 `:29-35` 七家示例复用 dialog/thinking/cheap 槽,取消注释会互相覆盖;可写成「按需替换,不要同时取消多行同槽」。
3. `cli.ts:209-216` 在 `plan.writePipelinePlist` 下再判 `!uvBin`,与 `planInstall` 重复,属死分支。
4. `writePipelinePlist` 的 `${plist}.${pid}.tmp` 在 `renameSync` 失败时无清理。
5. `planInstall` 的 withoutPipeline `reason` 无 `[warn]` 前缀,命令层又手写一串,两处会漂。

---

## 已核对、本批不成立的 A 焦点

| 焦点 | 裁决 |
|---|---|
| 活模板 schema/validate 会红 | [ok] 未注释四槽 + `[models.dev]`/`[tier1]` 能过 `configSchema`+`validateConfig`;调度方 `config.test.ts` 绿。问题在注释示例与测试短路(B3/B6),不在活配置拒解析。 |
| `deploy` 语义被改 | [ok] 仍 PlistBuddy 改存量 WorkingDirectory/SAYDO_HOME,仍先要求 plist 存在。只改了共享 helper 文案且不可达(B7)。 |
| 既有测试超规格改动 | [ok] `config.test.ts` 只动允许的 `dev.agent` 串,并按规格加了 `violations.length` 与 ack;新断言加在同一 describe。`launchd-plist.test.ts` 既有三例未改,只追加。 |
| `planInstall` 四态 / 用例数 / `rg` | [ok] 四态有测;launchd 3+10=13;调度方 `T17`/`saydo.js` 零命中;`claude_code` 三处均在「运行时只认 cursor」注释。 |
| XML `&<>` 注入 | [ok] `esc` 覆盖元素文本;测试含 `&<>`。 |
| emoji | [ok] 调度方 gate clean;抽查改动文件无 pictographic。 |
| evidence SHA | [ok] 与 `.git/logs/HEAD` 一致。数字问题见 B10。 |

PATH 快照进 pipeline plist 与既有 daemon plist 同类;未单独升 A。假 `which` 把**非 uv** 路径写入是额外面,见 A3。

---

## 总评

**[fail] 需返工,不能并入。**

模板刷新与 DEPLOY 路径替换大体按规格落地,契约/校验活路径未红,`deploy` 子命令语义未改,四态纯函数有测。阻塞在 launchd 写入:

1. **A1** 半安装不可恢复,且与命令自己的「可重试」矛盾。
2. **A2** 新写入的 LaunchAgent 没有卸载逆操作,`--without-pipeline` 在 exists 时失效。
3. **A3** `which` stdout 未校验就进入登录自起的 `ProgramArguments`。

返工最小集:修 `cmdInstall` 对「存在但未装载」的 bootstrap; `uninstall` 清理 pipeline job+plist;收紧 `resolveUvBin`;给这三条加可桩测试。B1/B2/B6/B7 建议同批改(文档悬空引用、无效断言、死文案)。B3/B4/B5/B10/B11 可登记或顺手。

未做:真机 `just daemon install`(规格定为 owner 检查点);本会话未跑 vitest/`just ci`(用调度方结果)。