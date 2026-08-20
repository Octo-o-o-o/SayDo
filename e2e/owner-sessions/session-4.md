# 场次④ 现场清单 · P0.5-D 窄闭环 bridge 版(首发交付的最终发布裁决点)

> 目的:05 §3 八条验收在**真实 Hopper(锁定副本)+ 真 runner** 经 bridge 现场跑通(0.5 手动版与
> fake-runner 自动化版已各过一遍,本场次是 owner 亲验版)+ 直达档念清单 + trust-report 展示 + 升级仪式演练。
> **首发交付 = final-readback + 本场次通过**(final-readback §首发交付判定)。
> 时长预估:45-60 分钟。
> **发布证据锁**:本场 runtime SHA 必须与场次①②③相同；任一场通过后若代码、有效配置或 SHA
> 改变，四场发布证据失效，须从场次①重新开始。

## 0. 修订(2026-07-25 五路面板走查;先做本节再开场)

- **硬前置(原清单漏写)**:HANDOFF §2-9 接线增量批已完成——直达档念清单与 drop→run 的发起方是 SayDo 语音链/bridge,接线前本场步骤 2/3 不可达。
- **本清单一切 `hopper` 命令禁止裸敲**——PATH 上的 `hopper` 是全局 npm 副本(未断言、缺省 vault),会打错目标。开场先建别名,后文所有 `hopper ...` 一律替换为 `hopper-locked ...`:
  `alias hopper-locked='HOPPER_VAULT=~/.saydo/hopper-vault node ~/.saydo/hopper-dist/bin/hopper.mjs'`
- step 3 的 `<task-id>` 来源:`hopper-locked list --json` 取最新 drop 的 id(或任务详情页 HP 徽章旁的 id)。
- budget 预调的配置文件位置:测试仓内 `.hopper/config.yml`(vault 侧无此文件)。
- 建议插入 10 分钟安全演示(安全路建议):(a) 临时改 `~/.saydo/config.toml` expected_version 一位 → bridge capabilities 断言 fail-closed 拒 dispatch,改回;(b) ready∧risk-high 任务 → 投影 blocked 且 bridge 拒代跑/拒自动 retry;(c) approve 后确认全程无自动 merge,owner 亲手合并 → MergeProof watcher 才 task_done。

## 前置(AI 可代跑,现场开场核验)

| 检查 | 命令 | 期望 |
|---|---|---|
| runtime 服务 | `scripts/runtime-preflight.sh <开场前记录的40位-runtime-SHA>` | 单条 fail-fast 断言磁盘与两进程 loaded SHA、clean、runtime 路径及 fresh readyz |
| 锁定副本 | `git -C ~/.saydo/hopper-dist rev-parse HEAD` | `bdd1e548f9359789497a797eda24398beba68ac5`(baseline.2) |
| 运行时切锁 | `rg -n expected_version ~/.saydo/config.toml` | 同上 SHA |
| 专用 vault | `ls ~/.saydo/hopper-vault` | 存在;**绝不与用户日常 vault 共用**(裁决红线) |
| 独立测试仓 | 用 PoC 同款独立小仓(红线⑦:禁外部副作用) | 非 dogfood 真仓 |
| 真 runner | `codex login status` 或 `cursor-agent status` | 订阅态可用(fake-runner 已全绿,本场次跑真的) |
| 门禁基线 | `(cd ~/.saydo/runtime && just ci)` | 在本场精确 runtime SHA 上双矩阵绿，不从活动开发树代跑 |

### 前置补(Hopper appendix §3.3 九条精粹,2026-07-25 回执后新增;按踩坑概率)

| 检查 | 说明 |
|---|---|
| `hopper doctor --json` | runner 可用性;**记录 `claude --version`/`codex --version`**(CLI 版本机器全局、不随 Hopper 锁定——留归因锚) |
| budget 预调 | `.hopper/config.yml` 缺省 daily $5/per-task $2/hard 关——真跑几单触 WARN 噪音,按场次预期先调 |
| meta_runner 开着 | triage/acceptance/docs 的 LLM 复核计入 usage meta 桶——**开着才是完整验收**(--no-llm 会行为降档) |
| 目标 repo 有 lockfile | 否则 fresh worktree 不注入 npm ci,verification 因缺依赖失败 |
| timeout 口径 | task 30min(真 claude 大任务贴边)/verification 10min;额度紧 runner 可能降 low-risk-only 或 skip(机器可读 reason) |
| 风险白名单 | 在场 run 放行 low+medium,**high 一律不自动**(X3);push 被 wrapper 拦是预期非异常 |
| approve 门 | acceptance=needs_human 须 `--waive kind:target --reason ...`(SayDo 实测);merge 三重门拒时不发 Merge 事件、投影留 review |
| cost 读数 | 真 claude run 后 `hopper show --json` 给 `last_run_cost{value,currency:USD,as_of}`(claude=实报/codex=估算)——顺验 SayDo 分币种记账 |

## 步骤与预期

1. **握手断言展示**:bridge 首调 `hopper capabilities --json`。
   - 预期:commit = `bdd1e548…` 断言过(漂移则 fail-closed 拒 dispatch——可现场演示:临时改 config expected_version 一位,观察拒起,改回)。
2. **直达验收档念清单**(P0.5-C,10 #12):语音派单选"一口气跑完"。
   - 预期话术:"选一口气跑完的话,这几件出圈的事先跟你确认:{逐条 spokenForm}。都可以吗?哪件不行单说哪件。"(>3 项转屏幕);owner 用封闭肯定词表确认 → preauthorized 子收据签发;**试一次含糊答复**("嗯再说吧")→ 不消费、复述再问。
3. **drop→run 全链**(真 runner):lint 预检(classification/execution_decision)→ drop(stdin 两阶段)→ scan → `hopper run <task-id>` → 等 RunSettled。
   - 预期:排队/执行态在任务详情可见(HP 路由徽章);中途**不叫人**。
4. **八条现场对照**(05 §3;逐条打钩):
   | # | 验收 | 现场判据 |
   |---|---|---|
   | ① | 语义 = "执行和闸门已结束等验收" | 回叫与界面全程无"完成"字样;投影 ready_for_review = "等你验收" |
   | ② | 一句"好"不直转 approve+merge | 验收与合并是两个独立动作;S3 merge 无语音路径 |
   | ③ | 回叫等 settle barrier | RunSettled 消费+廉价复核(evidenceDigest+summary)后才叫 |
   | ④ | 事件重放幂等/gap/损坏行 | (已由 §12-8 承载)现场可 kill bridge 重启看断点续读 |
   | ⑤ | bridge 重启只回叫一次 | 步骤④重启后不重复叫 |
   | ⑥ | verify 失败报"闸门阻断"非"完成" | 若真 run 闸门红,话术走 #30 分支(可顺验;绿则跳过) |
   | ⑦ | 禁外部副作用 | 全程独立测试仓 + 专用 vault;push 由 Hopper 门拦 |
   | ⑧ | 全链审计可追 | console 意图链:谁说的→哪张卡→哪次 drop→哪个事件→哪次回叫(G5 贯通视图) |
5. **trust-report 展示**:任务详情 iframe 打开真实 run 的报告。
   - 预期:`.md` 受控映射同名 `.html` 载入;呈现层零 emoji(勾叉转 [ok]/[fail] 文本标记);原始文件未被改动(证据 digest 不变)。
6. **验收与合并**:review approve(注意:acceptance=needs_human 时须 `--waive` 才绑定——p05.md §4b 实证)→ requestManualMerge 人工合并 → MergeProof → task_done。
   - 顺验:`hopper show --json` 的 `last_run_cost` 真实形状(known:true;fake-runner 恒 null,本场次是首次真值,C8 per-task 对账入账)。
7. **升级仪式演练**(4.1 版本 pin):模拟升级——改 expected_version 断言目标 → 启动断言拒 → 走"重跑门禁仪式"(spike run.sh + 六类 golden 全绿才换)→ 还原。
   - 预期:无断言旁路;演练后 `(cd ~/.saydo/runtime && just ci)` 仍绿。

## 失败回退

- 握手/断言失败 → 检查 hopper-dist 是否被动过(`git status`),重 build;
- 真 runner 行为与 fake spec 不一致 → **对账发现优先记录**(事件形态差异是最有价值的现场产出),按 C3 total mapping 兜底档处理,回会话修;
- 念清单/词表误伤 → 记录原话进 golden 回归集;
- 一次针对性返工后复验;再不过 ⇒ 上浮拍板。**本场次通过 = 首发交付判定成立。**

本场 `pass` 后，若要发布：先 `git fetch origin main`，再确认 `origin/main` 仍可
`--ff-only` 到本场同一 runtime SHA，main 移动后 HEAD 必须仍是该 SHA；`v0.1.0` 只可指向
该精确 SHA。任何 merge commit、rebase 或新代码提交都会让四场证据失效。

## 运行记录

| 字段 | 当前值 |
|---|---|
| status | `not_run` |
| 日期 | 待约 |
| 场次① status / runtime SHA / config digest | 待核对 `pass` / 同一 SHA / 同一 digest |
| 场次② status / runtime SHA / config digest | 待核对 `pass` / 同一 SHA / 同一 digest |
| 场次③ status / runtime SHA / config digest | 待核对 `pass` / 同一 SHA / 同一 digest |
| OctoBlog writing status / evidence | 待从场次③核对 `pass` / 逐节验收与 artifact 引用；否则本场不得 `pass` |
| 本场 runtime SHA / config digest / Hopper SHA | 待开场记录；runtime SHA 与 config digest 必须与前三场相同 |
| owner verdict | 待 owner；只有 `pass` 才解锁 `v0.1.0` |
| evidence origin | 待注明 `live` / `fixture` / `test`；本场通过只认 `live` |
| 证据 | 待填写八条判据、真 runner、成本与 MergeProof 引用 |
