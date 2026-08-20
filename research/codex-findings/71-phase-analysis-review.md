# 71 阶段缺口分析对抗审

> 日期：2026-08-13（对象标题为 2026-08-14 复核版）  
> HEAD：`c5148ab597ba08bd07aff7045418326ce263a180`  
> 评审对象：`/Users/wangyixiao/WorkSpace/SayDo/docs/review/2026-08-14-saydo-phase-gap-analysis.md`  
> 只读；未运行 lint 或测试。

## 终裁

需回修后接受。文档的若干状态判断仍有依据：场次①为 failed、runtime health 仍报告 `ada7981c`、HANDOFF 末次提交为 `97b01f7`、`v0.1.0` 未打、HEAD 版 emoji 脚本会误命中 `saydo.icns`。但当前 HEAD 已与 `origin/main`、`main` 同步，文档仍把旧快照的 `11/268/257` 当成当前事实；并且把“旧发布目标落后主线”写成“ff-only 纪律已破坏、既有四场证据已失效”，把移动评审建议写成已授权、把 B0 排成唯一最核心，行动序也把 B2 放在门禁与 HANDOFF 最小治理之前。必须更新时间锚、收窄 B0 结论、将 B0/B1 并列，重排 B5a/B4/B2/B1，并补入 dogfood 价值、外部解锁、评审开销和商店长周期阻断。

## Findings

### 1. A — `11/268/257` 已不是当前 HEAD 的事实

- 打文档哪一句：§1 第18、22行，§6 第102–103行：“11 条未 push”“268/257 分叉”。
- 证据：

  ```text
  HEAD=c5148ab597ba08bd07aff7045418326ce263a180
  origin/main=c5148ab597ba08bd07aff7045418326ce263a180
  origin/main..HEAD=0
  HEAD..origin/main=0
  ada7981c..HEAD=270
  ada7981c..origin/main=270
  ```

  旧快照才是：

  ```text
  cda99b8..e987f05=11
  ada7981c..e987f05=268
  ada7981c..cda99b8=257
  ```

- 对结论的含义：`11 条未 push`、`继续 push 扩大分叉`、当前主线为 257 等待裁决项已经过时。应明确写成“截至 `e987f05/cda99b8` 的历史快照”，并以当前 `0/270/270` 重算。

### 2. B — 268/257 的归属写反，且不是 Git 分叉

- 打文档哪一句：§0 第10行、B0 第41行：“main=ada+268，远端 257”。
- 证据：旧快照中 `ada7981c..e987f05=268`，其中 268 是 feature HEAD；`ada7981c..cda99b8=257` 才是旧 `origin/main`。当前三 ref 同为 `c5148ab`。另：

  ```text
  git merge-base --is-ancestor ada7981c origin/main => 0
  git merge-base --is-ancestor origin/main ada7981c => 1
  ```

- 对结论的含义：这是线性祖先链上的“发布目标落后主线/基线漂移”，不是两个分支已经分叉。B0 的风险仍存在，但叙事应从“分叉扩大”改为“旧 target 与当前主线前向距离为 270”。

### 3. B — “场次①–④锁 runtime ada7981c”越过了实际状态

- 打文档哪一句：§0 第10行。
- 证据：

  - `e2e/owner-sessions/session-1.md:54-59`：场次① `failed`，有 runtime `ada7981c`。
  - `e2e/owner-sessions/session-2.md:78-84`：`overall=not_run`，runtime 待开场。
  - `e2e/owner-sessions/session-3.md:54-60`：`not_run`，runtime 待开场。
  - `e2e/owner-sessions/session-4.md:85-92`：`not_run`，runtime/Hopper/runner 待核。

- 对结论的含义：只能说“场次①历史尝试使用 ada；规则要求后续场次同 SHA”，不能说四场已经锁定或已有四场证据。

### 4. B — 将 ff-only 条件写成“已被破坏、四场证据已失效”是时序误读

- 打文档哪一句：B0 第39、44、46行：“纪律已被破坏”“不能 tag”“任何新提交让四场证据失效”。
- 证据：

  - `e2e/owner-sessions/runtime-deploy.md:17-22`：开场前 target 必须是 `origin/main` 的后代；若场次期间主线前进导致不能 fast-forward，才使已有证据失效。
  - `e2e/owner-sessions/runtime-deploy.md:24-27`：场次④后允许纯 `chore(evidence)` 子提交。
  - `e2e/owner-sessions/session-4.md:77-79`：该纪律写在“场次④ pass 后、准备发布”的条件中。
  - 当前场次为 `failed/not_run/not_run/not_run`，尚无通过的四场证据可被“失效”。

- 对结论的含义：正确结论是“旧 ada target 当前不满足现行 preflight，发布 target 需重选或由 owner 决定改流程”；不是“既有四场证据已被破坏”。“任何新提交”也应收窄为代码、有效配置、runtime SHA 或会改变 FF 条件的提交。

### 5. B — lint 的“本会话实跑 8 errors”缺少当前时间锚

- 打文档哪一句：§1 第19行、B5 第69行、§6 第106行：“本会话实跑 8 errors”。
- 证据：`history/reviews/2026-08-14-analysis-fact-review.md:11,22-24` 将 8 errors 明确锚在旧 `e987f05/cda99b8` 快照。当前评审按用户要求没有运行 lint；静态 diff 也不能证明错误数已经或尚未变化。
- 对结论的含义：应写“旧快照实跑 8 errors；当前未重跑，静态未见明确修复”。B5 可以保留为待回采门，但不能把 8 当作当前已证实的精确数字。

### 6. B — Playwright `29 failed / 3 passed` 是历史基线，不是当前总套件状态

- 打文档哪一句：§1 第21行、B5 第71行、§6 第108行。
- 证据：`docs/11-ui-spec.md:575` 写的是 2026-08-13 的历史实测。同期过程档案还有不同分母：`history/PROCESS-JOURNAL.md:1217-1221` 记 `9 pass/16 fail`，`:1276-1287` 记 M1 定向 `8/8` 后中止旧桌面套件。
- 对结论的含义：29/3 可作为已登记的历史红线和 T19 缺口，但应标“历史测量，当前未重跑”，不能称当前全套件健康度。

### 7. C（核验通过，非缺陷）— 其余硬锚基本成立，但需区分历史与当前

- 目标句：§6 第104–110行。
- 证据：

  - `curl http://127.0.0.1:47100/health` 返回 `runtimeSha:"ada7981c67ef..."`。
  - `git log -1 -- HANDOFF.md` 返回 `97b01f7... 2026-07-31`。
  - `git tag --list` 仅 `v0.1.0-rc.1`，无 `v0.1.0`。
  - HEAD 版 `scripts/check-emoji.sh` 的扩展名正则不含 `icns`，静态扫描命中 `assets/brand/saydo.icns`；工作区改动加入 `icns` 后门禁输出 `[ok] emoji gate: clean`。这是二进制误扫，不等于发现了 emoji 文字。
  - 场次① failed、②–④ not_run 的状态见 Finding 3。

- 对结论的含义：这些锚可保留；Playwright 和 lint 必须加历史时间界限，runtime 则应说明是服务当前运行版本，不等同于四场已锁定。

### 8. B/C — “8 月唯一新文件、T 系列无排产文件”表述过宽

- 打文档哪一句：§4 第64行、§6 第111行：“8 月唯一新文件是 UI 审计”“T/M/D/移动/上架无排产文件”。
- 证据：

  - `docs/plan/IMPLEMENTATION-PLAN-2.md:4` 明确该文件是唯一排产源；`:40,78,98` 仍有 W2/T2/M1/W7 等旧计划。
  - 当前工作树存在未追踪 `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md`；`git log --diff-filter=A` 本身看不到未追踪文件。
  - 当前确实没有把 T16–T19/M1/D1/移动/上架整合进 8 月新增排产的文件。

- 对结论的含义：准确说法应是“唯一排产源停在旧快照，8 月临时轨道没有跨轨映射”；不能说仓库完全没有 T/M 计划，也不能把未追踪评审产物排除后称“唯一新文件”。

### 9. B/C — 阶段判定“不是建造，门是瓶颈”压扁了仍在施工的工程

- 打文档哪一句：§2 第33行：“工程成熟度高于过程成熟度，门是瓶颈不是建造”。
- 证据：

  - `docs/plan/IMPLEMENTATION-PLAN-2.md:53,69,74,78,95,100` 仍列 W5/W6/W7/W8/W9 未实施或待触发。
  - `mobile-shell-strategy-final.fable.md:78-105` 明写 A1/A2 本周工程施工尚未做。
  - `docs/release/2026-08-13-store-submission-status.md:31,146` 生产壳、源白名单、审核夹具仍未完成。
  - `history/PROCESS-JOURNAL.md:1279-1282` 说明 M1 仅验证真实 daemon 下行，不是付费 LLM/provider 调用。

- 对结论的含义：应改为“首发主体部分收口，但体验工程、生产壳和真实价值证据仍在建”。“体验真相化”也只能限定为下行/装配真相，不能暗示产品价值已经验证。

### 10. B/C — B2 的“唯一工程杠杆、范围锁死、无需 owner”外推过度

- 打文档哪一句：§0 第11行、B2 第54行、B0/B2 核心判断第81行。
- 证据：

  - `mobile-shell-strategy-final.fable.md:4-9` 自称 SoT 方案建议，并注明 HEAD 锚已过期。
  - `mobile-shell-strategy-final.fable.md:151-159` 明确 LAN 第0步不依赖 tailnet 等第1–5项；未拍板时验收只认 LAN。
  - `docs/plan/IMPLEMENTATION-PLAN-2.md:171-172` 规定每批须有 owner 停点确认、HANDOFF 指针和合同门。
  - `mobile-gap-audit.fable.md:25-29` 的“唯一 Critical”只是在移动体检范围内，不是全项目发布排序。
  - 生产提审还要求 HTTPS、源白名单、签名、隐私/版本口径、审核夹具，见 `docs/release/2026-08-13-store-submission-status.md:31`、`docs/release/2026-08-13-app-materials.md:32-43`。

- 对结论的含义：B2 应称“移动评估壳当前唯一 Critical、可与 owner 决策并行的施工项”，不是全项目唯一杠杆，也不是自动获得实施授权，更不等于生产提审已解锁。

### 11. C — 漏掉 dogfood 价值轨、外部解锁和评审开销

- 打文档哪一句：§2 第33行、核心判断第81行，以及 §3 缺口表整体。
- 证据：

  - `docs/plan/IMPLEMENTATION-PLAN-2.md:21` 明定 dogfood 价值优先；`:107-109` 要求 dogfood/访谈数据触发后续电话；`:135-138` 列 owner 触点、Claude/OpenAI/Apple Dev/billing/server 外部解锁和评审往返为真实关键路径。
  - `e2e/owner-sessions/session-2.md:65,78-88` 将场次②作为价值轨起点，但当前 overall/Touch ID 均 `not_run`。
  - `history/PROCESS-JOURNAL.md:1425-1437` 记录 R69 评审耗时 1,524,890ms 且只产方案、未实施。

- 对结论的含义：若分析覆盖“体验真相化”阶段，必须列“真人价值证据尚未启动”和“评审吞噬发布时窗”两个 C 级缺口；按产品战略视角，零 dogfood 数据甚至应与 B0/B1 同层供 owner 排序。

### 12. B — 行动序把 B2 放在门禁和最小治理之前

- 打文档哪一句：§4 第85–88行，先 B2，再 B5、B4。
- 证据：

  - 目标自身 §3 第69–73行承认 lint/emoji 红、UI 无 evidence、工作树脏。
  - `docs/plan/IMPLEMENTATION-PLAN-2.md:171-172` 要求开批前已有前批 evidence/readback、HANDOFF 指针空、本批合同门落地。
  - 当前 `git status --short` 为 12 个 tracked modified、14 个未追踪顶层项。

- 对结论的含义：应拆成 B5a（选定发布范围后，把该范围的代码/门禁/evidence 变绿）和 B5b（分类、授权、推送、归档）。B4 的最小 HANDOFF/跨轨指针也应在开 B2 前完成；不能先在过期指针上 pin HEAD，再事后治理。

### 13. B/C — 把 B1 真人验收排到最后，浪费稀缺 owner 时窗

- 打文档哪一句：§4 第89行。
- 证据：

  - `e2e/owner-sessions/session-1.md:21-27` 已列 runtime preflight、ASR key、耳机等前置。
  - `session-2.md:55-64` 要求 Touch ID 主路径真人过卡、Tier1 两键/A3 语义。
  - `session-3.md:39-42` 要求 OctoBlog 逐节验收。
  - `session-4.md:19-29,85-94` 要求 Hopper/vault、真 runner、精确 CI 和 runtime SHA。

- 对结论的含义：选定 target 并完成最小 preflight 后，应立即约场次①，和 B2/B4 并行；后续按①→②→③→④依赖推进，而不是等所有工程收口才寻找 owner。

### 14. B — 第1步把 tailnet 未决误写成 LAN/B2 的总前置

- 打文档哪一句：§4 第85行、B3 第58行。
- 证据：`mobile-shell-strategy-final.fable.md:151-159` 明确 LAN 第0步独立于 tailnet；tailnet 只决定是否额外纳入 `setup_local_only`。`HANDOFF.md:50` 则记录 Tailscale 系统扩展为“activated waiting for user”，需要系统批准、配置、部署和手机烟测。
- 对结论的含义：v0.1 范围问题需 owner 拍板；LAN 施工和验收不必等待 tailnet 答复。应把 tailnet 扩展列为并行外部阻断，而不是阻塞全部后续移动动作。

### 15. C/B — B6 和 owner 清单漏掉商店硬前置及长周期动作

- 打文档哪一句：B6 第77行、§5 第98行。
- 证据：

  - `docs/release/2026-08-13-store-submission-status.md:19-23,31`：App Store 英文名 `SayDo` 被占，version SoT 未建，`0.1` spike 不可提审。
  - `:69-73`：英文后缀、加密豁免、EU DSA 待决。
  - `:90-92,141-146`：软著材料未生成、ICP/夹具/生产壳/提审执行未完成。
  - `docs/release/2026-08-13-app-materials.md:32-43`：软著 50–75 工作日（加急 7–15）→备案→审核，是关键路径，且送审须生产壳。

- 对结论的含义：B2 不能被写成“恰是提审工程前置”。软著、备案、名称/版本、DSA、加密、AI 申报和公网审核夹具应立即并行启动；owner 清单也应补齐这些决策。

### 16. C — 8 月材料中的残余工程风险未上浮

- 打文档哪一句：B5 缺口表和“核心问题”段没有列非发布阻断残余。
- 证据：

  - `history/PROCESS-JOURNAL.md:1202-1205`：同毫秒 ULID 字典序推断插入序，曾出现反序，需改 rowid/显式 ID 去抖。
  - `history/PROCESS-JOURNAL.md:1374-1377`：外部进程可越过 setup 并发改 pending 的 TOCTOU 观察，终局保留 C=1。

- 对结论的含义：这两项不必升为发布阻断，但若文档声称已覆盖 8 月已知缺口，应标为“接受的 C 级残余”或明确排除在当前威胁模型之外。

## 对 B0 的专项裁决

ff-only 的机械部分成立：`ada7981c` 是当前 `origin/main` 的祖先，按 `runtime-deploy.md:17-22`，它不再满足“target 必须是 origin/main 后代”的开场条件。因此旧 ada 不能直接作为当前运行册的发布 target。

但文档把这件事说成“纪律已经被破坏”并不成立。现有规则是在场次④通过后检查 FF；当前状态是① `failed`、②–④ `not_run`，尚无已通过的四场证据被破坏。`runtime-deploy.md:24-27` 还允许场次④后的纯 evidence 子提交。这里应使用“发布基线漂移、旧 target 不再满足 preflight、需重选 target”而不是“Git 分叉”或“全部新提交均使证据失效”。

B0 不配独占“最核心”。它是 B1 的基线选择前置，但 B1 才是当前直接的发布门状态：①失败，②–④未跑。更准确的排序是 B0 与 B1 并列；选定 target 后两者可联动推进。若采用产品价值视角，“真人 dogfood/价值数据尚未启动”也应由 owner 与这两个发布门一起排序，而不是把 B2 的移动评审 Critical 外推成全项目最核心。

此外，文档把两条路径写得过于对称。`docs/plan/IMPLEMENTATION-PLAN-2.md:4,116,146` 已给出“部署→场次→v0.1.0”的默认时序，R64–R68 多次明确“不部署、不改常驻 runtime”。更稳妥的表述是：7 月 31 日候选是默认路径，是否把 8 月批次纳入是尚未记录的 owner 例外裁决。

## 对行动序的专项裁决

原 1–5 顺序有三处实质问题：

1. 第1步应拆成“先确认发布范围/target；tailnet 问题可并行”。LAN 第0步不依赖 tailnet，不能让一个扩展项阻塞全部移动施工。还应补当前更近的 owner 触点：Touch ID、OctoBlog、Hopper/runner/CI、系统网络扩展批准。

2. 第2步 B2 不应先于 B5a 和最小 B4。先 pin 一个 lint/emoji 红、无 evidence、HANDOFF 指针过期的 HEAD，会把脏坐标写成批次真相。建议：

   - 先完成 owner scope/target 选择；
   - 做最小 B4：恢复 HANDOFF 当前批次指针、写清 PLAN-2 与 8 月跨轨关系；
   - 在选定范围上做 B5a：门禁、代码/evidence 配对、必要 readback；
   - 再开 B2，补真实 LAN/RFC1918、横屏、请求头、二维码 host、09 payload/隐私边界证据；
   - B5b 的工作区分类、推送和归档可后置，且不能把 `deploy/`、`artifacts/`、`.zcode/` 等生成物一概按代码提交。

3. 第5步 B1 不应“最后”。完成 target 与 preflight 后，应尽早约场次①，并与 B2/B4 并行；再依次推进②、③、④。软著、备案、名称/版本、审核夹具和公网可达等长周期工作也应并行，而不是等移动线收口。

建议的最小改序为：

`owner scope/target -> 最小 B4 跨轨治理 -> B5a 选定范围门禁/evidence -> 约场次①并行 B2 -> 依赖推进②③④；B5b、软著/备案/审核夹具并行收口`。

## 证伪

以下句子按当前 HEAD 或现有合同语义不能原样保留：

1. §0 第10行：“场次①–④锁 runtime ada7981c”。
2. §0 第10行、B0 第41行：“main=ada+268（远端 257）”。
3. §1 第18行、§6 第102行：“8 月以来 11 条未 push”。
4. B0 第44行：“ff-only 已被破坏，不能 tag”。
5. B0 第39行：“任何新提交让四场证据失效”。
6. B0 第46行：“没有任何文档裁决两条路线，继续 push 就扩大分叉”。
7. §0 第11行、核心判断第81行：“本周工程侧唯一有杠杆是 B2”“B2 是两条路都必需且不依赖 owner”。
8. §2 第33行：“门是瓶颈，不是建造”。
9. B2 第54行：“69/70 已锁死范围”。
10. B6 第77行：“提审硬原因工程前置恰是 B2+冻桥+R-B”。
11. §4 第85行：“两问未答则后续移动边界均不确定”。
12. §4 第86–88行所隐含的顺序：“先 B2，后 B4/HANDOFF 治理”。
13. §4 第89行：“B1 放到最后再约场”。
14. §1 第19行、§6 第106行：“本会话/当前 HEAD 实跑 8 errors”；应改为旧快照历史实测。
15. B5 第71行、§6 第108行未加时间限定的“Playwright 29/3”。
16. §0 第12行、B5 第73行的“工作树 12+8”作为当前固定数量。
17. §6 第111行：“8 月 docs/plan 唯一新文件是 UI 审计”；至少应限定为某一 tracked 快照，并说明未追踪文件不在该统计内。
---

## 71 号 triage(owner 会话,2026-08-13 深夜)

原判:需回修后接受。triage 后**终局改判 Go**。

| 编号 | 处理 | 落点 |
|---|---|---|
| F-01 A(11/268/257 过时) | 吸收。已重采:当前 0 未 push,HEAD=origin/main=c5148ab,ada7981c..main=270 | 终版 §1-#1/#2、§6 |
| F-02/F-03 B(归属写反、非分叉) | 吸收。268=旧 feature HEAD、257=旧 origin/main;ada7981c 是 main 线性祖先 ⇒ 改为基线漂移 | 终版 §1-#2、§3-B0 |
| F-04 B(场次锁越界) | 吸收。改为规则四场同 SHA;①历史尝试 failed@ada7981c;②③④ not_run | 终版 §1-#4 |
| F-05 B(ff-only 时序误读) | 吸收。改为发布时点条件;结论=旧 target 不满足现行 preflight,需重选或 owner 改流程 | 终版 §1-#3、§3-B0 |
| F-06 B(lint 缺时间锚) | 吸收并重跑:当前 HEAD(c5148ab)实测仍 8 errors(测试文件行号 199:66) | 终版 §1-#5、§6 |
| F-07 B(Playwright 历史基线) | 吸收。加历史时间限定,不称当前全套件健康度 | 终版 §1-#6、§6 |
| F-08 C(其余硬锚成立) | 确认,已保留 | 终版 §1-#11 |
| F-09 B/C(8 月唯一新文件过宽) | 吸收。补 deepseek-harness 评估文件(23:17 未追踪)与未追踪口径 | 终版 §1-#8、§6 |
| F-10 B/C(门是瓶颈压扁工程) | 吸收。改为首发主体收口,体验/生产壳/价值证据仍在建 | 终版 §2 |
| F-11 B/C(B2 外推过度) | 吸收。降格为移动评估壳范围内唯一 Critical;70 号报告存在(未 git 追踪)且收窄范围;开批走 PLAN-2 纪律 | 终版 §1-#10、§3-B2 |
| F-12 C(漏 dogfood/解锁/评审开销) | 吸收。dogfood 零数据、评审开销、C 级残余均补;外部解锁按场次前置不单列 | 终版 §3 补充缺口 |
| F-13 B(行动序) | 吸收。重构:owner 决策→最小 B4→B5a 转绿→约场次①并行 B2→长周期并行 | 终版 §4 |
| F-14 B/C(B1 排最后) | 吸收。约场次①与 B2 并行,依赖推进②③④ | 终版 §4-#4 |
| F-15 B(tailnet 总前置误写) | 吸收。tailnet 为并行外部阻断,LAN 竖切不依赖 | 终版 §3 补充缺口 |
| F-16 C/B(商店长周期漏) | 吸收。软著 50-75 工作日、en-US 被占、DSA、夹具入长周期并行清单 | 终版 §3-B6、§5 |
| F-17 C(残余 C 级风险) | 吸收。ULID 反序与 TOCTOU 记已接受残余 | 终版 §3 补充缺口 |

与 subagent 发现的差异裁决:战略 subagent 的 B3(70 号报告未落盘)不成立——报告存在(8-13 22:50,未 git 追踪);其 push 矛盾亦不成立(批内不 push、合并会话 push 是既有流程)。均已按此口径写入终版。

终版:docs/review/2026-08-14-saydo-phase-gap-analysis.md。终判 Go,OPEN QUESTION=0。
