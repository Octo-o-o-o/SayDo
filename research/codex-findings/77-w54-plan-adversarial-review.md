# 77 · W5.4 方案 v2 对抗评审(Grok grok-4.6 xhigh 只读会话;Codex 配额耗尽回落)

> prompt:`prompts/77-w54-plan-adversarial-review.md`;执行:2026-08-20 ~01:40–02:10;session `01a01b15-f553-75a1-91a6-ec00762db269`;原始事件流 `.tmp/grok-77-w54-review.jsonl`(不入库)。

先读评审技能与方案全文，再对照 daemon/contracts 与 canonical 找硬冲突。方案已读完。接下来对照 daemon/contracts 与 canonical，逐条核验安全与契约主张。继续读执行器门链、cmdEffect、BYOA 解析与 canonical 合同段。# 77 · W5.4 方案 v2 对抗评审

> 日期: 2026-08-20  
> 通道: Codex `gpt-5.6-sol` 配额耗尽后,按 review 回落链由 Grok `grok-4.6` 只读执行  
> 对象: `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` (v2) + `docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md`  
> 对照: `packages/daemon/src/tier1/{executor,gate,gateScript,gateServer,adapter,approvalFlow,cmdEffect,validateConfig}.ts`、`providers/byoa/{parsers,processFailure,billing,cage}.ts`、`packages/contracts/src/types/{task,modelbinding}.ts`、`docs/09` §9/§11/§12-4/§12-9、`docs/04` §5/§6、`docs/03` §5、`docs/07` D8/D18、设计 ADR-001、工程 ADR-002、`e2e/poc/tier1-live-executor/RESULT.md`  
> 立场: 找会导致返工或安全退化的问题,不给好评

## TL;DR

**不能按当前 IMPL-PROMPT 开 W5.4-a。** [fail]

方案把附录 A 的 17 次 spike(多数不是终版 argv)直接当成 §3 机制的已证前提,再把「hook allow 绕过 Claude 自身权限流」(S3)写进 Bash 的常规放行路径,同时让文件工具在 `realpath` 失败时落到 S2→allow。这三条叠在一起,会把 S4/S12 测到的圈外防线拆掉。IMPL-PROMPT 的阻塞红停/不停指令自相矛盾,B3 还要在 09 词表回写前进 `kind='tier1.run'`。

A 级 10 条,B 级 12 条,C 级 6 条。W5.4-a 开批前至少改完下方「必须先改」。

---

## A 级

### A-01 · 文件圈判定:未存在路径 `realpath` 失败 → 判不出 → S2 → hook `allow` → 绕过 Claude 圈外拒写

**文件:** `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:157-160`、`:39-43`(S3/S4); `IMPL-PROMPT-10-W54A-CLAUDE-CLI.md:71`; Node `fs.realpathSync` 语义; `packages/daemon/src/policy/engine.ts:41,64-66`

**问题:** `fileToolToEffect` 规定「`realpath` 归一;判不出 ⇒ `install_dependency`」。Write/Edit 的目标经常是**尚未存在的新文件**。Node `realpathSync` 在路径不存在时抛 ENOENT,于是每个圈内新文件都会变成 S2。S2 获批后脚本输出 `permissionDecision: "allow"`。S3 已测:**hook 一旦 allow,就没有第二层**——圈外写不再被 Claude 自拒。

触发链:

1. `Write` `./new.ts` 或 `~/evil` 或中间目录尚不存在的路径 → `realpath` 失败  
2. effect = `install_dependency` (S2)  
3. 用户按「装依赖/执行」批准,或话术被 `describeEffectForSpeech` 说成执行命令  
4. hook 返回 allow  
5. Claude 的圈外写拒绝(S4)被绕过,文件落在 realpath 从未证明「在 worktree 内」的位置

**证据:**

- 方案 §3.3:`realpath` 归一后圈内 `write_worktree`、圈外 `delete_data`、**判不出 `install_dependency`**;S0/S1 文件 → `no_decision`,S2 → allow/deny。  
- 方案 S3:allow 后 `permission_denials=[]`,命令执行。  
- 方案 S4:仅在 hook **不裁决**时,圈外写才被 Claude 拒。  
- `computeRisk`: `install_dependency` 基线 S2;`touchesSensitiveData` 只升到 S2,不会拦 allow。  
- IMPL B2 表驱动要求「圈内」用例,但**没有**「目标文件尚不存在」这一条,假绿概率高。

**修法:**

1. 禁止对完整目标路径 `realpathSync`。对现存最长祖先 `realpath`,再拼未存在后缀;祖先也不存在 → **S3 deny**,不是 S2。  
2. 「判不出」一律 S3 deny,永不准 hook allow。  
3. 只有 `realpath` 证明前缀落在 worktree 内,才允许 `no_decision`。  
4. B2 表驱动必含:新文件圈内、新文件圈外、断链中间目录、symlink 指向圈外后再 Write。

---

### A-02 · 圈外写在分类上是 S3,在响应/安全矩阵上又是「S2 获批才 allow」——后一条会拆掉 S4

**文件:** 方案 `:157-160`、`:160` 响应映射、`:215` §4 表; `packages/daemon/src/policy/engine.ts:46` (`delete_data` = S3)

**问题:** 同一节把圈外 `file_write` 标成 `{kind:"delete_data",target:"write-outside-worktree"}`(S3,语音永不放行),紧接着又写 S2 话术「要改 worktree 外的文件,批准吗」以及 §4「S2 获批才 allow」。实施若按响应映射做,圈外写会走 hook allow,与 S4「第二层只在 hook 不 allow 时存在」直接相反。

圈外 Read(D14)是否定 deny,还算自洽。圈外 Write 不是。

**证据:** `delete_data` 在 `BASE_RISK` 为 S3;`decideCommand` 对 S3 恒 deny(`gate.ts:56`)。方案自己的 effect 表已经把圈外写送进这条路,S2 文案是死代码——除非实施把圈外降成 S2,那就是安全退化。

**修法:** 删掉圈外文件的 S2 通道。圈外 Write/Edit/NotebookEdit/Read 一律 deny,且脚本输出 deny 而不是 allow。S2 只留给**圈内敏感基名**(`.env*` 等),话术必须是「敏感文件」而不是「worktree 外」。§4 表改成与 effect 表同一句话。

---

### A-03 · 把 hook 超时落回 Claude 权限流误当成门; `exit 0` + `acceptEdits` 让敏感圈内写在超时路径自动放行;与 09 律③硬冲突

**文件:** 方案 `:30`、`:54-55`(S15/S16)、`:154`、`:220`; `docs/09-data-contracts.md:1137` 律③; `packages/daemon/src/tier1/gate.ts:6`; `packages/daemon/src/policy/engine.ts:64-66`; `cmdEffect.ts:94` `SENSITIVE_PATH_RE`

**问题:** 09 与 `gate.ts` 的 fail-closed 律③是「超时 = deny」。Claude 官方与 S15/S16 是「超时 = 不阻断,走 Claude 自身权限流」。方案承认不能把超时当门,补偿是 `curl 110 < hook 120` 且脚本自返 deny。但同一段又规定 **`exit 0`(不用 exit 2)**。文档写明 `exit 2` 才阻断;进程被 timeout 杀掉、jq/curl 缺失、非 2 的非零退出,都是非阻断。

在 `--permission-mode acceptEdits` 下,超时落回路径对**圈内写是自动放行**(S4 圈内成功)。圈内 `.env` / `*.pem` 本应 `touchesSensitiveData` → S2,超时后不会上浮,直接写盘。S15 只测了无害 Bash `echo`,没有测 Write `.env`。

**证据:**

- 09:1137:「③ 钩子同步阻塞轮询 daemon 决策(**超时 fail-closed=deny**)」。  
- S15: hook `timeout:10`、脚本 sleep 40 后 deny → `echo spike-timeout` **照跑**,`permission_denials=[]`。  
- S16: 同一超时路径对 `mkdir`/`touch` 是 Claude 问=拒,不是脚本 deny 生效。  
- 方案 `:154`:「脚本 `exit 0`(不用 exit 2)」。  
- `acceptEdits` + 圈内写成功是 S4 的前提。

**修法:**

1. 09 为 `claude_code` 单列律③:vendor 超时 ≠ deny;脚本必须在 timeout 前写出 deny;**失败路径同时 `permissionDecision:deny` + `exit 2`**。  
2. B-10 阻塞红加: `acceptEdits` + Write 圈内 `.env` + hook 超时 ⇒ 文件**不得**落盘(若仍落盘,P0 不能对敏感文件 `no_decision`/acceptEdits)。  
3. 启动自检不能替代这条:自检过了,运行中 jq 仍可能被 PATH 漂移搞掉。

---

### A-04 · §1.2 实测被后续条款误用:`*` matcher + `acceptEdits` + 五工具终版 argv 并不是附录 A 测过的组合

**文件:** 方案 `:38-56`、`:123-135`、`:144-146`、附录 A `:369-378`; IMPL `:55-57`

**问题:** 设计把安全建立在「`*` 让所有工具进脚本」+「圈内文件 hook 不裁决,交给 acceptEdits」上。附录 A 实际是:

| spike | permission-mode | matcher | tools |
|---|---|---|---|
| S1–S3 | **default** | **Bash** | Bash,Read |
| S4 | acceptEdits | **Write\|Edit\|MultiEdit\|NotebookEdit**(只记日志) | Write,Read |
| S15/S16 | acceptEdits | (timeout 脚本,Bash) | Bash |

**没有一次**同时满足终版:`acceptEdits` + `--tools "Bash,Read,Write,Edit,NotebookEdit"` + matcher `*` + 内联 `--settings` + `--setting-sources ""`。

`*` 若按正则编译会直接非法(`RegExp("*")`)。若该版本 hook 注册失败,行为退回 S15:无害 Bash 自动跑、圈内写自动跑、门等于没装。方案却把 S1「hooks 可由命令行注入」和 S4「Claude 拒圈外写」写成终版机制的已证前提。

阶段 A 声称「全部按 §3.2 终版 argv 重跑」,但验收只写 RESULT 阻塞红全 `[ok]`,没有「hook stdin 对 Bash **和** Write 都出现、`matcher` 实际为 `*`」的可判定 grep。

**修法:**

1. 附录 A 不得再被引作终版证据;标「非终版 argv」。  
2. 阻塞红加硬锚:终版 argv 下 Bash 与 Write 的 hook-input.json 必须各有一条;`tool_name` 对、`matcher` 侧可观测(或至少两次 PreToolUse)。  
3. `*` 若该版本不匹配,改用文档/实测真正匹配全集的 matcher,禁止用未测的 `*` 当封闭集。

---

### A-05 · 「复用 `parseClaudeLine`」与现行解析器行为硬冲突:init / `rate_limit_event` / 并行 `tool_use` 会被吞掉

**文件:** IMPL `:70`; 方案 `:170`、`:164`; `packages/daemon/src/providers/byoa/parsers.ts:200-211,218-225,236-244,32-34`

**问题:** `parseClaudeLine` 今天是:

- 多块 `tool_use` **只保留最后一块**(`:210 toolUse = block`)  
- `type==="system"` **一律 ignore**,注释写明 init 不消费、observedModel 不在 system.init(`:240-242`)  
- `rate_limit_event` ignore(`:32-34,:244`)

方案 §3.4 与 B1-b 却要:逐块 `tool_started`、`system/init` → init(含 `apiKeySource`)、`rate_limit_event` → rate_limit。若实施按字面 `parseClaudeLine(line)`:

- `apiKeySource !== "none"` 的立即终止**永远不触发**(HANDOFF #6 机械化落空)  
- canary 左值漏计并行工具  
- 限流拒绝态看不到

这不是风格问题,是安全断言被空实现。

**修法:** IMPL 改成「**禁止**调用 `parseClaudeLine`。只复制块级循环,分叉产出 init/tool_started×N/rate_limit/result」。单测必须用 `tool_use_multi` fixture 断言两块都计,并用 `init` fixture 断言 `apiKeySource` 字段存在。

---

### A-06 · `cost_entries.kind='tier1.run'` + `requests=num_turns` 与 09 词表/§11-5 硬冲突;W5.4-a B3 就要落库

**文件:** 方案 `:93`、`:194`、`:268`; IMPL `:72`; `docs/09-data-contracts.md:860-864,1182,1203,1213`; `packages/daemon/src/storage/ddl.ts:169-172`; `packages/daemon/src/cost/ledger.ts:25-55,89-93`

**问题:** 方案 1.3-8 写「CHECK 只约束 source」——DDL 层面是对的(`source='subscription' ⇒ known=0 ∧ amount IS NULL`)。合同词表不是这样:

- §9:`kind` 是**前缀词表** `llm.<slot>` / `asr.seconds` / `tts.chars` / `hopper.run`;§12-4 有**非法 kind 反例**  
- §11-5 / T18b:订阅行 `kind` 以 `llm.` 为前缀;「每个真实进程请求逐行落账且 `requests=1`」  
- 现有实现:`recordCliSubscriptionInvocation` → `kind: llm.${slot}`,`requests: 1` 逐次一行

`kind='tier1.run'` 是词表外值;`requests=num_turns` 会把一轮里的工具回合算成「已用 N 次」,和 07 D18「已用 N 次」展示纪律冲突。IMPL 写明本批不改 09,同时又要求 B3 用内存 DB 插入该 kind 并断言 CHECK 通过——CHECK 过只说明没撞 source 约束,会把非法 kind 训练成「已合法」。

`subscription_retry_queue.slot="tier1"` 同样不在四槽词表里。DDL 无 CHECK,09 §11-5 的 slot 语义是 dialog/thinking/cheap/evaluator。可进 B,但 kind 已经是 A。

**修法:** W5.4-a **不要**插入 `tier1.run`。二选一,开批前写进方案:

- (a) P-5 先回写 09,再让 B3 落库;或  
- (b) B3 只测纯函数返回值,不 `INSERT`;接线批与合同同一天落地。  

`requests` 恒 1,`num_turns` 进 meta。不要复用四槽 `recordCliSubscriptionInvocation`,这一点方案是对的,但新 kind 必须先进 §9。

---

### A-07 · 验收锚互相矛盾:B-9 停/不停;W5.4-c `permission_denials` 等式 vs 三方对账

**文件:** 方案 `:260`、`:289`、`:164`; IMPL `:64`、`:86`

**问题:**

1. 方案 §6:阻塞红「任一红 ⇒ 停止、不进 B」,清单含 **B-9**;括号里又写「红 ⇒ `finishPolicy` 必须 `wait_exit_then_kill`」(这是改设计再继续)。IMPL 检查点 5:**B-9 红后继续(不停)**。实施会话无法判定该停还是该抽 cursor seam。  
2. §3.3 三方对账:「多出的 = Claude 自身 deny,先观察不 trip」。W5.4-c 可判定数字却要求 `permission_denials` 数 **=** 门 deny 数。S4 在 hook 不裁决时已经产生 `permission_denials` 且门未 deny。两条锚不能同时为真。

**修法:** B-9 从阻塞红挪到设计调整级,与 IMPL 检查点 5 对齐;阻塞红只留「终版 argv 下门是否还在」类。W5.4-c 改为 `permission_denials.length >= 门 deny`,多出的写入审计,禁止用等式当绿门。

---

### A-08 · B-14 不能支撑「`--settings` 内联 hooks 不会被 worktree 配置覆盖」

**文件:** 方案 `:128`、`:219`、`:260`; IMPL `:58`; `packages/daemon/src/providers/byoa/cage.ts:74-81`(BYOA 已用 `--setting-sources ""`,但那是 `dontAsk` + 空 tools,不是 hooks)

**问题:** 终版安全依赖 `--setting-sources ""` 挡住 worktree 里 agent 可写的 `.claude/settings.json`。B-14 只要求:放一个会写 `leak.log` 的 PreToolUse + `permissions.allow` 放行,期望不触发。这证不了:

- `disableAllHooks: true` 是否关掉命令行注入的 hooks  
- `additionalDirectories` 是否把圈外目录变成 Claude 眼中的圈内(S4 圈外拒写被拆)  
- `permissions.defaultMode` / `allow` 与 `*` matcher 谁优先  
- managed/policy 层是否永远覆盖 `--settings`  
- `--settings` 与 `--setting-sources ""` 是 merge 还是 replace(S1 证明 hooks **能**注入,不证明 **不会被覆盖**)

S13 只看到 `plugins=[]`、`mcp_servers=[]`,不是 hooks 完整性证明。

**修法:** B-14 升为矩阵,全是阻塞红: `disableAllHooks`、`permissions.allow` 放行 Bash、`additionalDirectories: ["/tmp"]` 再 Write `/tmp/x`、`hooks` 覆盖 matcher。任一仍生效 ⇒ 不能声称命令行 hooks 是唯一门,P0 就要改注入方式(例如官方若提供「仅 CLI settings」的更强旗标,或失败则停)。

---

### A-09 · D14「圈外 Read deny」被 Bash `cat` S0 + hook **allow** 穿透;S12 被后续条款当成已收口

**文件:** 方案 `:99`(D14)、`:152`、`:216`、S12 `:51`; `cmdEffect.ts:20-22,1059-1062`; `gate.ts:55`; 方案 S3 `:42`

**问题:** D14 把圈外 Read 工具收成 deny,并写「与 cursor Read 无门持平」。同一 agent 的 Bash `cat /etc/hosts` / `cat ~/.ssh/id_rsa` 仍是 `READ_ONLY_HEADS` → `kind:"read"` → S0 → `decideCommand` allow。方案对 Bash **必须显式 allow**(否则 acceptEdits 下变更类 Bash 会被 Claude 问=拒)。S3 已证 allow 会绕过 Claude 的权限询问。于是 S12「Read `/etc/hosts` 被 Claude 自拒」在终版 Bash 路径上不成立。

§4 把这登记成「两面口径不一致,P1 沙箱清偿」。对外口径却是 P0 已收口圈外读。这是条款误用,不是诚实残余能盖住的:新做的文件门只挡 Read 工具,Bash 显式 allow 把 Claude 第二层也拆了。

`cat .env` 会因 `SENSITIVE_PATH_RE` 升 S2;`cat /etc/passwd`、`cat ~/.claude/projects/<other>/...jsonl` **不会**。

**修法:** P0 与 D14 对齐:绝对路径 / `~` / `$HOME` 的只读词头按圈外 Read 同样 deny(或至少 S2,且 **不准 hook allow**,只能 `no_decision` 让 Claude 自拒——但 no_decision 对「无害 cat」可能仍自动放行,故圈外绝对路径应直接 deny)。B2 cmdEffect 表驱动加 `cat /etc/hosts`、`cat ~/.ssh/config` 与 Read 工具对照。§4 不得再写「圈外 Read 残余在 claude 面收口」。

---

### A-10 · IMPL「零行为变化 / 既有测试一字不改」与 B1-a 接口必增、B2 全局收紧 cmdEffect 互相否决;cursor canary 有被顺手改坏的路径

**文件:** IMPL `:45-47`、`:69-71`; 方案 `:119`、`:164`、`:274`; `packages/daemon/src/tier1/executor.ts:77-91,556-569,1163-1169`; `packages/daemon/test/tier1-executor.test.ts:1153-1162`

**问题:** 这是开批就会立刻返工的验收矛盾,不只是措辞。

- B1-a 要给 `AgentProcessHandle` 增加 `stderrTail()`,给 `realAgentSpawner(backend)` 换签名。测试里的 fake handle 与 `realAgentSpawner().spawn({...})`(`tier1-executor.test.ts:1153`)在方法变为必选时 **typecheck 红**,和「一字不改」互斥。  
- B2 收紧 `cd`/`pushd`/agent CLI 词头是 **cursor 路径也会变的行为变化**(只升不降可以,不能再叫零行为变化)。  
- C2 写「canary 左值换 `tool_result`」且「既有 37 零改动」。cursor 事件是 `tool_call` + `subtype=started` + `shellToolCall`,没有 Claude 的 `user.tool_result`。全局改左值 ⇒ cursor 绕门时左值不再涨 ⇒ **04 §6:189 不可降级的 canary 对 cursor 失效**。现有用例「shell started 而 gate 为零」(executor 测试 `:466`)会假绿或必须改测试。

`realAgentSpawner` 测试脚本靠 result 行后 `setInterval` 不退、`kill_on_result` 收口。默认 `finishPolicy` 若被 Claude 的 `wait_exit` 污染,该测试会挂死。

**修法:**

1. 删掉整批「零行为变化」这句话,改成三句可判定的:cursor argv/解析/kill_on_result 不变;cmdEffect 只升不降且既有 223 断言不改期望;canary **按 backend 分左值**,cursor 仍 `shellStarted`。  
2. `stderrTail` 做成可选,或测试 fake 允许缺省空实现且 **允许** 测试文件加这一行——不要写「一字不改」。  
3. C2 明确禁止改 `checkCanaries` 的 cursor 分支。

---

## B 级

### B-01 · W5.4-a 抽 cursor seam 时,`AgentSpawner.spawn` 仍无 `settingsJson`/`sessionId`/`maxTurns`

**文件:** `executor.ts:96-103,1035-1041,2030-2037`; 方案 `:107-116`

B1-b 的 `buildArgv` 需要这些字段,但认领 spawn 今天只传 `binary/model/prompt/cwd/env`(+恢复时 `resumeChatId`)。W5.4-a 又规定不改执行器主流程。结果是 claude `buildArgv` 在本批**不可能被真实 spawn 用到**,只能单测。IMPL 没写清「本批只提交纯函数,spawn 接线留 b」。实施很容易把字段塞进 `spawn()` 并改所有 fake——与「37 零改动」冲突。

**修法:** IMPL 写死:W5.4-a 不改 `AgentSpawner.spawn` 入参;claude argv 只经单测。接线是 C2 的第一项。

### B-02 · `--force` 词表在方案正文与 IMPL 锚不一致

**文件:** 方案 `:162`; IMPL `:71`

§3.3 把 `--force` 与 bypass 旗标并列 ⇒ S3。IMPL 立即改口:「`--force` 只在 agent CLI 词头语境」,并要求 `npm run build --force` 仍 S1、`git push --force` 仍 S3。按方案正文扫全局 `--force` 会升档一批本应保持的包管理器命令(降档扫描看的是 computeRisk,升过头不会被「降档 0」抓住)。

**修法:** 方案正文与 IMPL 使用同一句:bypass 旗标封闭表不含裸 `--force`;`--force` 仅当词头 ∈ agent CLI 集合。

### B-03 · agent CLI 词头未规定在剥 wrapper/sudo 之后判定

**文件:** 方案 `:162`; `cmdEffect.ts:229-257,912-917`

`env claude -p`、`sudo claude`、`timeout 10 claude` 若只看第一词头,仍是 S2。嵌套无监管 agent 正是这条收紧要打的点。

**修法:** 与现有 wrapper 剥皮同一层判定;表驱动加 `env claude -p`、`timeout 1 cursor-agent -p`。

### B-04 · `cd` 无参数 / `cd ~` / `pushd` 无参数未定义

**文件:** 方案 `:162`; `cmdEffect.ts:136-146`

`cd` 无参数进 `$HOME`,按 pathClass 应圈外。只写「目标圈外 S3」会让实施把空目标当成未知 S2。

**修法:** 空目标、`~`、`-` 一律圈外 S3。

### B-05 · B-14/B-15/B-12 与生产 env 纪律没写成快照锚

**文件:** IMPL `:59-60`; `executor.ts:106-116`; 方案 `:137`

生产 `strippedAgentEnv` 已剔除 `ANTHROPIC_*` / `CLAUDE_CODE_OAUTH_TOKEN`。B-15 却要在 spike 注入 `ANTHROPIC_API_KEY=sk-invalid-spike`。B1-b 快照只锁 argv,不锁 env。实施若把 spike 的 `env -i ... ANTHROPIC_API_KEY=...` 抄进 `realAgentSpawner`,G4 被拆。D13 的 `DISABLE_AUTOUPDATER`/`SHELL=/bin/sh` 若写进全局 `strippedAgentEnv`,cursor 的 Bash 也会变。

**修法:** B1-b 增加 env 封闭集:允许名单 ∪ `{DISABLE_AUTOUPDATER:1,SHELL:/bin/sh}`(仅 claude backend);断言键名不含 `ANTHROPIC`/`CLAUDE_CODE_OAUTH`/`CURSOR` token。SHELL 覆盖不得进 cursor backend。

### B-06 · 续跑/限流重放想 `--resume`,与今天「续跑永远新会话」冲突,且会改到 cursor

**文件:** 方案 `:181-183,195`; `executor.ts:1034-1041`; `operations.ts:545-571`

认领路径 spawn **不传** `resumeChatId`(只有 `recoverAttempt` 传)。`retryTask` 对 blocked 是 `blocked→running`,再被「running 无活跃 run」捡起走新会话。C2 若按四元组给所有 adapter 加 resume,cursor 续跑语义变了,37 例里恢复用例会偏。

**修法:** `--resume` 四元组仅 `adapter==="claude_code"`;cursor 保持现状。限流 replayer 写明是「新 attempt + 可选 resume」还是「同 run 续」,不要口头调用 `retryTask` 了事。

### B-07 · `native_session_confirmed` 无 DDL 位置,方案允许「列/标记」二选一

**文件:** 方案 `:171`; `ddl.ts:183-191`; 09 §9 `tier1_runs`

「新列/标记」会分叉。恢复链、reconciler、C2 测试会对着不同形状写。09 对 `tier1_runs` 状态有 CHECK,加列是迁移,加内存标记则崩溃丢失确认位,可能对未确认钥匙 `--resume`。

**修法:** 开批前定一:additive 列 `native_session_confirmed INTEGER NOT NULL DEFAULT 0`,W5.4-b 迁移;W5.4-a 不碰 DDL。

### B-08 · `[tier1].agent` 与 `[models.dev].agent` 双源;项目 override 仍只允许 `cursor`

**文件:** 方案 `:86,201-203`; `config/types.ts:26-32,70-74`; `projectOverrides.ts:24`; `validateConfig.ts:94-108`; `index.ts:2406-2413`

D2 要把选择键换成 `[tier1].agent`,缺省 `claude_code`,devMode 未显式时回落 `models.dev.agent`。`readDevAdapter` 今天只读后者,缺省 cursor。`dev.agent` override schema 仍 `z.enum(["cursor"])`。C1 允许既有 config-validate 13 例只改两处,但缺省翻转会让非 devMode 机器在未配 claude 键时从 `unsupported_adapter` 变成尝试起 claude——和「dev 机零行为变化」不是同一集合。

**修法:** 写明非 devMode 缺省翻转的生效条件(必须 claude_bin/pin/identity 齐,否则 not_configured 不认领,不得半套启动)。override 放开 `claude_code` 的测试锚写进 C1,不要只在散文里。

### B-09 · `classifyClaudeRunOutcome`: `error_max_turns` 既 failed 又「verify 照跑」不可判定

**文件:** 方案 `:177,268`; `executor.ts:1265-1267`

今天非零退出直接 `finalizeFailure`,不跑 verify。方案要求 `error_max_turns` ⇒ failed `max_turns`,同时又「worktree 留、verify 照跑」。failed 与 settleCoding 互斥。B3 表驱动 ≥12 没有说明期望终态是 `settled_failed` 带 verify 证据,还是先 verify 再 failed。

**修法:** 选定一种:failed 且 **不** 跑 verify(与现网一致,worktree 留着人看);或跑 verify 仅入审计、状态仍 failed。不要「照跑」这种无法写 expect 的词。

### B-10 · 阶段 A 未要求断言 `system/init.tools` 恰好五件、不含 `Task`

**文件:** 方案 `:47`(S6 默认含 Task)、`:91`; IMPL `:55`

P0 不开 Task 的理由是子代理内工具可能不进外层 hook(B-3 只记录)。若 `--tools` 在某版本被忽略,S6 那张全量表会回来,内层 agent 共用登录态且无门。终版 argv 重跑若不 grep init.tools,绿不了这条。

**修法:** 阻塞红:init.tools 的集合等于 `{Bash,Read,Write,Edit,NotebookEdit}`(允许超集里再被脚本 deny,但 **不得含 Task**)。含 Task ⇒ 停,不要进 B。

### B-11 · `recordTier1SubscriptionRun` 的 meta 四键与 `usage_unavailable` 可同时为真,口径不清

**文件:** 方案 `:194`; 09 §11-5; `ledger.ts:71-77`

「tokens 四键」+「`usage_unavailable` 标记」并写。09 说 CLI 不回 usage 时四键记 0 并标 `usage_unavailable`。Claude `result.usage` 有真实值。实施可能恒写 `usage_unavailable:true` 或漏四键。

**修法:** 有 `result.usage` 则四键用真值、不得标 unavailable;缺 usage 才 0 + 标记。B3 分两例。

### B-12 · 产品缺省 `claude_code` 与 07:248 ToS 观察项、HANDOFF #6「单机 owner 自用」范围未做分发闸

**文件:** 方案 `:33,86`; `docs/07-tech-stack-decisions.md:248`; ADR-001 路径一「产品缺省 = Claude」

§1.1 正确地把 ordinary use 限制在单机 owner。D2 仍把缺省打成产品缺省 `claude_code`。分发形态下这就是「第三方产品代用户走订阅凭据」,与抓取的 legal 页冲突。本批不代答可以,但不能让 C1 把缺省写进 `configSchema` 还不带「非分发/非多租户」注释与启动警告。

**修法:** `[tier1].agent` 缺省在 dogfood 阶段保持「显式配置,无键则 cursor/not_configured」,产品缺省只写 09/ADR 附注,等 ToS 复核;或缺省 `claude_code` 但 setup 自检必须显示「仅 owner 本机自用,禁止代用户登录」。

---

## C 级

### C-01 · 术语三分写了,正文仍用 backend/adapter/transport 互换

方案术语段定义 adapter=`claude_code`、transport=`cli`、BYOA provider=`claude_cli`,但 §3.1 接口字段叫 `adapter: AdapterKind`,§0 又说「backend 只指 adapter 的实现对象」。实施会把 `claude_cli` 填进 `tier1_runs.adapter`(CHECK 只许 `claude_code|cursor|codex`)。

**修法:** 全文 `tier1_runs.adapter` / `DevAgentBinding.agent` 只出现 `claude_code`;`claude_cli` 只出现在 BYOA 四槽。

### C-02 · 「canUseTool 等价」在 07 D8 回写里会把 live steer 一并洗掉

P-1 要把「不走 CLI」改成 hook 等价。03:110 的矩阵把审批和 steer 分成两格。若 D8 一行写「hooks = canUseTool 等价」而不保留「live steer 仍 SDK 独有」,后续会按字面以为 0.0(b) 四能力已齐。

**修法:** P-1 强制两句并列,禁止用「等价物」单句收口。

### C-03 · IMPL 坐标把 vitest 条数和 `grep it(` 混在一张表,cmdEffect「223」对不上 `^\s*it\(`

`tier1-cmd-effect.test.ts` 大量是 `it.each` 行(PLAN 32 + review-1 46 + review-2 32 + 返工表 + O-1 17)。`grep -cE '^\s*it\('` 会远小于 223。漂移时实施会以为测试被删了。

**修法:** 坐标行写成 `vitest run ... | 223 passed`,不要暗示 223 个 `it(`。

### C-04 · `gate-claude.sh` 与 `gate.sh` 输出协议不同,drift guard「两脚本 digest 集合」易被做成「只对当前 adapter 一张」

cursor 输出 `{permission:allow|deny}`;claude 输出 `hookSpecificOutput.permissionDecision`。drift 必须按 run.adapter 选期望正文。写成「集合」会让 cursor run 用 claude 脚本过校验或反过来。

### C-05 · 附录 A 含本机绝对路径叙事(`transcript_path`,`/Users/…/.claude/projects/...`)

阶段 A fixture 已要求删路径。附录本身仍有用户目录形态,复制进 RESULT 会撞 secret scan。提示实施:RESULT 摘录必须先脱敏。

### C-06 · `finishPolicy` 名称 `wait_exit_then_kill` 未定量 N

方案 `:114`「result 后等自然退出 ≤ N s」。N 未定。B-9 无论红绿,C2 都会各写各的。定一个数(例如 5s,与现 SIGTERM 升级窗一致)写进接口注释。

---

## 证伪/不成立(避免下轮重复踩)

- **「CHECK 会拒 `kind='tier1.run'`」不成立。** `ddl.ts:169-172` 只约束 `source`/`known`/`amount`。冲突在 09 词表与 §12-4,不在 SQLite CHECK。  
- **「`--setting-sources ""` 会连 `--settings` 一起关掉」与 S1 矛盾。** S1 同时传了两者且 hook 触发。剩下的问题是覆盖,不是注入失败。  
- **「W5.4-a 改 `gateServer.ts` union」不是本批范围。** IMPL 红线已禁接线;B2 用假 server 测脚本是合法的。A 级问题在脚本语义与 `fileToolToEffect`,不在本批改 socket。  
- **cursor 抽取本身不必然破坏 canary**,只要 `shellStarted` 计数仍留在 cursor `parseLine`/consume 路径。危险的是 C2 把左值做成全局 `tool_result`。

---

## 总评

**结论:不能开 W5.4-a。** [fail]

不是「spike 不够多」,而是方案把未测组合当成已证,又把 hook `allow` 接到会拆掉第二层的位置。W5.4-a 的 B2 一旦按原文落地 `fileToolToEffect`+三态脚本,b 批接线会把洞送到真 agent。

**开批前必须改(写入 v3 方案 + IMPL,不要口头补):**

1. A-01/A-02:`realpath` 祖先算法;判不出与圈外 **永 deny**;删圈外 S2/allow。  
2. A-03:失败路径 `deny`+`exit 2`;B-10 加敏感 Write 超时反例;09 律③ claude 行改写列入 P-4,不能等 c 批。  
3. A-04:终版 argv 的 `*` 对 Bash 与 Write 的 hook 触发作为阻塞红硬锚;附录 A 降级为非终版。  
4. A-05:禁止 `parseClaudeLine()`;写分叉清单。  
5. A-06:B3 不插入 `tier1.run`,或先回写 09。  
6. A-07:B-9 停/不停选一个;删 `permission_denials == 门 deny` 等式。  
7. A-08:B-14 覆盖矩阵。  
8. A-09:圈外绝对路径只读词头与 Read 工具同口径。  
9. A-10:取消「零行为变化/一字不改」;canary 分 backend;cmdEffect 收紧单独说「只升不降」。

**改完这些之后,W5.4-a 可以按「阶段 A spike(调度方真跑)→ B1-a cursor 抽取 → B1-b/B2/B3 纯函数」开。** 合同左栏 P-1…P-5 仍应在 W5.4-b 前落地;其中律③与 kind 词表不要拖到 b 才发现已经写入测试。

Codex `gpt-5.6-sol` 配额恢复后建议用同一输入再跑一轮,本报告不替代那次;本轮已用当前 `main` 源码证伪/坐实上述坐标,不依赖方案自述。