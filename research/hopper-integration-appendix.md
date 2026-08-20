# Hopper 对接契约附录:验收标题词表 + fake-runner 契约测试 harness

> **来源**:Hopper 侧交付(2026-07-24,应 SayDo owner X1/X3 拍板回传的配合件请求)。
> **快照口径**:本文的词表/字段表是 **`v0.1.0-saydo-baseline.2`** 树的快照(单源 = Hopper `src/core/acceptance/headings.ts` 与 `src/runners/fake-runner.mjs`);SayDo 升级锁定点时按新树重新核对本附录。
> **消费者**:§1 → SayDo C1 TaskCardRenderer(渲染 `DecisionPackage.acceptance[]`);§2 → SayDo P0.5-B 契约测试(§12-2/6/8)。

---

## 1. 验收标准标题格式契约(给 C1 渲染器)

### 1.1 为什么必须按这个格式

Hopper 的 acceptance 闸门逐条核对验收标准,**分母来自任务正文的「验收标题段」下的 bullet 列表**。格式不对的后果链:

- 正文找不到可测验收标准 → **triage 直接判 blocked**(代码任务硬闸,进不了执行队列);
- 标题词不在词表 → 该段不被识别为验收段 → 同上;
- bullet 是空洞判据(见 §1.4)→ 不计入可测分母 → 全空洞时同上。

### 1.2 标题词表(headings.ts 单源,baseline.2 快照)

以下 7 个词(**大小写不敏感**)被认作验收标题:

```
验收标准
完成定义
acceptance criteria
acceptance
definition of done
success criteria
done when
```

**标题行判定正则**(compiler 抽取验收段用):

```
^#{1,6}\s*(?:<词表交替>)(?:\s|$|[:：-])
```

即:**必须是 Markdown 标题行**(`#` 到 `######`),标题词后只允许空白/行尾/冒号/破折号。词表匹配长词优先(`acceptance criteria` 先于 `acceptance`)。

**推荐 C1 固定输出**(最不易出错的形态):

```markdown
## 验收标准
```

或英文卡:`## Acceptance Criteria`。

### 1.3 正确样例(C1 渲染产物应长这样)

```markdown
---
id: saydo-01k0w9...            # SayDo 生成,单路径段(ULID 小写化)
project: my-app
runner: auto
x_saydo:
  dispatch_id: dsp_01K0W9...
  package_id: pkg_01K0W8...
  package_revision: 3
  package_digest: "sha256:..."
  mode: direct_to_review
---
# 给报表页加 CSV 导出

## 背景与目标

财务对账需要把报表页的当前筛选结果导出为 CSV,Excel 能直接打开。

## 约束

- 只改前端与导出 API,不动数据模型。
- 使用现有的 papaparse 依赖,不新增包。

## 验收标准

- 报表页出现「导出 CSV」按钮,点击后下载包含当前筛选结果的 .csv 文件
- 导出文件首行为表头,Excel 双击打开无乱码(UTF-8 BOM)
- 空结果导出时给出提示而非空文件
- 新增导出逻辑有单元测试且 `npm test` 通过

<!-- saydo:dispatch dsp_01K0W9... rev=3 digest=sha256:... -->
```

要点:
- **验收段 = 词表标题 + 其下的 `-` bullet 列表**,每条一行、一条一个可核对断言;
- 每条尽量含**可机械核对的对象**(文件/按钮/命令/行为),Hopper 的逐条 evidence 按 bullet 文本比对 diff/verification;
- 末行 dispatch 注释是 SayDo 的幂等载体(授权变 ⇒ 正文 hash 变,见裁决 §2.1.3),放正文末尾即可,不影响验收段识别。

### 1.4 空洞判据(不计入可测分母,全空洞=等于没写)

类似「测试通过 / 完成 / 同上 / ok / done / 没问题」的 bullet 会被剔除,不算可测标准。C1 渲染时若 `DecisionPackage.acceptance[]` 里有这类条目,应在 SayDo 侧改写为具体断言后再渲染。

### 1.5 已废弃形态(不要用)

正文内 `验收 = ...` / `验收对照 = ...` 的 inline 行是 legacy 兼容(会触发 deprecation 提示),**C1 一律不用**,只用标题段形态。

### 1.6 drop 前预检(配套用法,复述要点)

C1 渲染产物在 drop 前跑:

```bash
hopper lint <file> --json --vault <saydo 专用 vault>
```

**判定必须同时查三处**(注意:`missing_acceptance` 只是 warning,不进退出码!):

```
blocking 非空
OR result.classification ∈ {blocked, conflict, draft, plan_needed, research, deferred}   # 非 ready 即不派
OR result.execution_decision == "needs_human"
```

任一命中 ⇒ 不 drop,回对话补料。`result.risk` 同时可读(medium/high 提前知道执行路径,见 X3 边界)。

---

## 2. `HOPPER_FAKE_SPEC` fake-runner 契约测试 harness

### 2.1 机制(为什么它能测出契约漂移)

设置环境变量 `HOPPER_FAKE_SPEC=<spec.json 绝对路径>` 后:

1. `loadSettings` 把该 vault 的 runners 整体覆盖为单一 `fake` profile(生产无此 env,永不误触);
2. 真实 CLI 的 `run next` / `run <task-id>` / `drain` / `daemon` 走**完整生产路径**——调度闸门 → worktree 创建 → prompt 编译 → 执行 → post-run 四闸门 → RunSettled → 投影写回,**只有 runner 子进程换成 `node fake-runner.mjs`**(按 spec 脚本行动);
3. dist 构建自带 `dist/runners/fake-runner.mjs`(build 产物清单强制项)——**SayDo 锁定的二进制副本开箱即用,零额外安装**。

所以 SayDo 的契约测试可以对**锁定二进制**在 CI 里确定性地跑通全闭环(drop→triage→执行→post-run→RunSettled→review→merge),零 LLM 成本、零网络。mock 出来的 Hopper 测不出契约漂移;fake-runner 跑的是真 Hopper,只有 agent 是假的。

### 2.2 spec.json 字段全表(fake-runner.mjs 单源,baseline.2 快照)

```jsonc
{
  // —— 核心 ——
  "status": "completed" | "needs_review" | "blocked" | "failed",   // runner 自报终态(缺省 completed)
  "summary": "一句话总结",                                          // 缺省 "fake runner done"
  "changedFiles": [{ "path": "src/a.ts", "content": "..." }],       // 写进 worktree 的文件(相对路径)
  "deleteFiles": ["src/b.ts"],                                      // 从 worktree 删除的文件

  // —— 故障注入 ——
  "sleepMs": 60000,                 // 输出前挂起:> 任务 timeout 时触发 timeout 终态;配合 cancel 测取消链
  "exitCode": 1,                    // 进程退出码
  "stdoutMode": "json" | "invalid" | "empty",
                                    // invalid/empty ⇒ Hopper 兜底为 failed{invalid_structured_output}

  // —— 闸门对抗 ——
  "attemptPush": true,              // 尝试 git push(验证 push 隔离 wrapper 拦截)
  "runnerReportedVerification": [   // runner 自报验证(Hopper 恒标 trusted:false,不影响真闸门)
    { "command": "npm test", "exitCode": 0, "summary": "..." }
  ]

  // 另有 echoEnv/echoEnvToFile 与 env HOPPER_FAKE_PIDFILE:Hopper 内部测试基建,SayDo 无需使用
}
```

### 2.3 SayDo 契约测试的场景矩阵(spec → 期望可断言结果)

| spec | Hopper 全链结果(断言点) |
|---|---|
| `{status:"completed", changedFiles:[...]}` | 事件链 RunReserved→…→RunnerFinished{completed}→四闸门→**RunSettled{final_status:"review"}**;`review show --json` evidenceDigest 非空;`20-Runs/Summaries/<runId>.md` 存在 |
| `{status:"blocked", summary:"缺少 API 契约"}` | RunnerFinished{blocked} → 投影 blocked → RunSettled{final_status:"blocked"};blocked 三来源之 runner 自报(reason) |
| `{status:"failed"}` | 投影 failed → RunSettled{final_status:"failed"};summary 文件不产生(runner 级失败无 post-run) |
| `{sleepMs: 大于 timeout}` + 短 `task_timeout_minutes` | timeout 终态;RunSettled{runner_status:"timeout"} |
| `{sleepMs:10000}` + 并发 `hopper cancel` | executor 轮询 cancel → RunnerFinished{cancelled} → RunSettled;cancel settled 判据用例 |
| `{stdoutMode:"invalid"}` | failed{invalid_structured_output}(坏输出兜底) |
| `{attemptPush:true}` | push 被 wrapper 拦截(raw.log 记 blocked);post-run push 检测不触发 |
| `{changedFiles:[{path:".env",...}]}` 或触 forbidden 路径 | RiskReevaluated{blocked, guardrail_*} → 投影 blocked(守门级 blocked 用例) |
| completed 且 verification 命令失败(repo 的 `npm test` 预置 exit 1) | VerificationFinished{failed} → 投影 failed(闸门失败≠完成 用例) |

### 2.4 最小可跑示例(bash,对锁定副本)

```bash
HOPPER=~/.saydo/hopper-dist/bin/hopper.mjs
export HOPPER_VAULT=$(mktemp -d)/vault
node $HOPPER init "$HOPPER_VAULT" >/dev/null

# 契约测试用 sandbox repo(package.json 带 "test": "exit 0")
REPO=$(mktemp -d) && git -C "$REPO" init -q -b main
printf '{"name":"t","version":"1.0.0","scripts":{"test":"exit 0"}}' > "$REPO/package.json"
git -C "$REPO" add -A && git -C "$REPO" -c user.email=t@t -c user.name=t commit -qm init
node $HOPPER --json link-project --project app --repo "$REPO" --no-inbox >/dev/null

# drop 一个符合 §1.3 格式的任务卡 → scan 推进到 ready
TID=$(printf '# 加文件\n\n创建一个文件。\n\n## 验收标准\n- 新文件 src/new.txt 存在' \
  | node $HOPPER --json drop --project app --stdin | jq -r .task_id)
node $HOPPER --json scan >/dev/null

# fake spec + 生产路径定向执行
SPEC=$(mktemp -d)/spec.json
printf '{"status":"completed","changedFiles":[{"path":"src/new.txt","content":"hi"}]}' > "$SPEC"
HOPPER_FAKE_SPEC=$SPEC node $HOPPER --json run "$TID"

# 断言:末事件 RunSettled、final_status=review
tail -1 "$HOPPER_VAULT/.hopper/events.jsonl" | jq -e '.type=="RunSettled" and .payload.final_status=="review"'
```

以上示例已在 baseline.2 树上实跑验证通过(2026-07-24)。`run <task-id> --json` 的输出形态:执行成功 `{executed:[{taskId,runId,status,runnerStatus,finalStatus,runner}]}`;未执行 `{skipped:[{taskId,reason,...}]}`(机器可读 skip reason)。

### 2.5 注意事项

- `HOPPER_FAKE_SPEC` 会把该次进程的 runners **整体**覆盖为 fake——契约测试用独立临时 vault(如上例),别对着 SayDo 的常驻专用 vault 设它。
- fake-runner 不产生 token/cost 读数(cost 恒 unknown 路径)——成本相关契约测试(last_run_cost 的 known:false 分支)正好用它;known:true 分支需真 runner,不进 CI。
- timeout 用例把 `.hopper/config.yml` 的 `scheduler.task_timeout_minutes` 调小(≥1,分钟粒度),配合 `sleepMs` 触发。
- 每个 spec 文件一次性使用(内容即脚本),不同用例写不同 spec 文件即可并行。

---

## 3. 回执后增补(2026-07-25,应 SayDo 回执第 3/4 条)

### 3.1 `last_run_cost` known:true 字段样例(回执小请求①)

`hopper show <task-id> --json` 的 `last_run_cost` 读 `.hopper/runs/<runId>/runner-result.json` 的可选字段 `costUsd`(number)。两态形状:

```jsonc
// known:true —— costUsd 存在且为 number
{
  "known": true,
  "value": 0.1234,                          // 即 runner-result.json 的 costUsd,单位 USD
  "currency": "USD",
  "as_of": "2026-07-25T02:33:00.000Z"       // runner-result.json 的 mtime(ISO)
}
// known:false —— fake runner / codex 模型未登记单价 / 文件缺失 / costUsd 非 number
{ "known": false }
```

`value` 的可信度按 runner 分(SayDo 展示话术可区分):**claude = CLI envelope 实报**(`total_cost_usd` 直取);**codex = token 用量 × 单价表估算**(估算口径;模型不在单价表 → `costUsd` 缺失 → known:false)。上面的数值是构造样例(字段形状/语义从源码单源导出);场次④真跑 claude 后 `hopper show` 自会给出真实 known:true 实例。

### 3.2 `RunSettled{recovery:true}`(dead-owner 兜底)端到端触发法(回执小请求②;已实测)

**机理**:该路径要求「活跃 run(RunReserved 无 RunnerFinished)+ owner 进程已死」,由 `hopper cancel` 的 dead-owner 兜底分支 emit。黑盒序列(2026-07-25 对 baseline.2 实跑通过):

```bash
# 前置同 §2.4(init/link/drop/scan)。fake spec 用长挂起:
printf '{"status":"completed","sleepMs":300000}' > "$SPEC"

HOPPER_FAKE_SPEC=$SPEC node $HOPPER --json run "$TID" & RUN_PID=$!   # 后台起 run
until rg -q RunnerStarted "$HOPPER_VAULT/.hopper/events.jsonl"; do sleep 0.2; done
kill -9 $RUN_PID          # 模拟宿主真崩溃(owner_pid 死,锁不释放)
sleep 65                  # 关键:等 scheduler.lock lease 过期(默认 60s)
node $HOPPER --json cancel "$TID"   # stale 锁接管 → dead-owner 兜底

tail -1 "$HOPPER_VAULT/.hopper/events.jsonl" | jq -e \
  '.type=="RunSettled" and .payload.recovery==true and .payload.runner_status=="cancelled" and .payload.final_status=="failed"'
```

产出事件链:`CancelRequested → RunnerCancelled → RunnerFinished{cancelled} → RunSettled{final_status:"failed", runner_status:"cancelled", runner_outcome:"cancelled", evidence_digest:null, summary_path:null, recovery:true}`。

**两个坑(第一次实跑踩到,如实登记)**:

1. **必须等 lease 过期再 cancel**。kill -9 后死进程仍"持有"`scheduler.lock`(lease 60s);立刻 cancel 会走 mutation 排队,30s 后返回 `expired`(0 事件)。且该 expired 请求**保留在队列**,之后任一 drain/mutation 会把它补 applied——测试脚本里若先 expired 过一次,注意后续断言别数重。
2. **cancel 必须先于 `hopper reconcile`**。reconcile 先跑会把崩溃 run 补成 `RecoveryRecorded`+failed 终态(此路径**不发 RunSettled**——即文档乙 §1.1 声明的 SIGKILL 残余边界),之后 cancel 变 no-op。生产语义没变:SIGKILL 崩溃的 settle 兜底仍是「超时 → reconcile → RecoveryRecorded」;`RunSettled{recovery:true}` 只覆盖「崩溃后由 cancel 收尸」这条支路。

### 3.3 P0.5-D 真跑前检查单(回执第 4 条"若真实 runner 下还有其它需预知的配置")

按踩坑概率排序:

1. **runner CLI 前置**:claude/codex CLI 已安装且已登录(继承机器登录态,Hopper 不管理凭据);先跑 `hopper doctor --json` 看 runner 可用性。**runner CLI 版本是机器全局的,不随 Hopper 锁定**——Hopper 侧有每日 drift CI 盯真机 flag,但你们机器上的 CLI 版本 Hopper 管不到;场次④前记录 `claude --version`/`codex --version` 便于事后归因。
2. **budget 闸门缺省值会拦真跑**:缺省 `daily_budget_usd: 5.0`、`per_task_budget_usd: 2.0`(事后告警)、`hard_budget_enabled: false`(只告警不硬拦)、`daemon_requires_budget: true`。真跑几个任务就可能过 $5 日线——WARN 不拦在场 run,但把 `.hopper/config.yml` 的 budget 段按场次预期调好,免得读数噪音。
3. **meta_runner 也烧真钱**:triage/acceptance/docs 的 LLM 复核是 Hopper 自身调用(计入 `hopper usage --cost` 的 meta 桶)。全链真跑建议开着(这才是完整验收);要省则全局 `--no-llm`(triage 走纯规则、acceptance 走确定性,行为降档)。
4. **usage gate**:入口会刷新真实用量读数(2.5s 超时降级保守并发);额度紧张时 runner 会被降为 low-risk-only 或 skip(skip reason 机器可读,与 fake 路径同形)。
5. **timeout 口径**:`task_timeout_minutes` 缺省 30(真 claude 大任务可能贴边),`verification_timeout_minutes` 缺省 10。
6. **风险白名单(在场 run)**:`run <task-id>`/`run next`/`drain` 默认放行 low+medium,**high 一律不自动执行**(与 X3 边界一致;daemon 只 low)。
7. **verification bootstrap**:fresh worktree 里 Node 生态命令自动注入安装步(有 lockfile 才注入:npm ci / pnpm install --frozen-lockfile / yarn install --frozen-lockfile)。目标 repo **没有 lockfile 则不注入**,npm test 会因缺依赖失败——场次④选 repo 时确认 lockfile 在。
8. **push isolation 照常生效**:真 runner 在 worktree 里 `git push` 会被 wrapper 拦(预期行为,raw.log 留痕),不用当异常。
9. **结构化输出无需你们配置**:喂真机的 strict schema 由 Hopper 内部处理(`toStrictJsonSchema`),SayDo 零配置面。
