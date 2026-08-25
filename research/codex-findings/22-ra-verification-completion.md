# 22 · R-A 落盘核验复核 + 补完终局追认

审查日期：2026-07-27 至 2026-07-28。
审查对象：`docs/`、`docs.bak-r-a-20260727/`、`history/PROCESS-JOURNAL.md`、21 号报告，以及只读参照仓 `~/WorkSpace/SayDo`。
裁决对象：R-A 域，不替代 W5a/W4 的整批产品验收。

## 一句话结论

**不翻转。维持 `not ready_for_review`。**

R51 确实把 A1–A6 的大部分目标文字和 W4 所需骨架写进 canonical；用户指定的
SayDo `b5d45e9` 基线也确实落了 S3 主链、writing 窄版、readiness 骨架和 proposed TTL
主体。审查期间共享仓又前进到 `edac8d0`，其增量修掉了 writing verify-fail 和 emoji
gate，但没有改变 R-A 总判。原 A1、A5、A6 的核心运行时硬伤可以关闭；R-A 仍有三项
A 级阻断：

1. A2 的 challenge 没有固化 attempt/packageRevision，register 也没有强制绑定可审计 owner intent；
2. A3 的生产 `proposeStart` 硬门仍未 armed，空账本旁路仍在；
3. A4 原项虽正确回收 writing 缺省开值，但新发现的 `pending` 生命周期与 capability gate 冲突尚未裁决：它能绕过 enabled 集并在派发后按 coding 执行。

并发 canonical 回写已同步 A5 API/等价审计声明，并为 A6 选择“`expires_at` 投影即
entry-time 锚”；但仍留下正文节锚自证、verdict 额外/重复项、`insertPackage` 第二写口等
B 级问题。`edac8d0` 的完整 `just ci` 在本沙箱因 Vite 临时目录写入 `EPERM` 而未能独立
验证，journal R53 的绿色只能列为外部过程记录。**A2/A3/pending gate 中任一未关，都不足以
支持“已无已知 A 级硬伤”。**

## 1. 证据边界与实跑结果

### 1.1 仓库坐标

- 初始取证时，SayDo 实跑 `git rev-parse HEAD` 得
  `b5d45e9f7df66f2dad218112edefec0a0af1ddb9`。
- **取证冻结时**，对本报告实际引用的 contracts/daemon/HANDOFF/evidence/justfile 路径执行
  `git diff --quiet HEAD -- packages/contracts packages/daemon/src packages/daemon/test HANDOFF.md
  e2e/evidence/w4-batch.md justfile`，退出码为 `0`；当时 `git status --short` 只有 22 张
  `e2e/screenshots/{dark,light}/*.png` 修改。因此 §2–§7 中未显式标为 `edac8d0` 的 SayDo
  代码事实与行号，均是用 `git show b5d45e9:<path> | nl -ba` 冻结的基线行号。
- 成稿复审期间，共享仓先后出现 `1fc2324`、`edac8d0` 两个新提交；其来源/作者会话本轮未独立
  验证，本审查代理未修改 SayDo。形式审查仍冻结在用户指定的 `b5d45e9`，同时在 §1.4 单列
  当前 `edac8d0` 的只读增量，避免把后续修复倒算进原基线。
- `voice-coding` 不是 Git 工作树，`git status` 返回
  `fatal: not a git repository`；因此不能用 commit 证明 R50 时点，只能用给定快照、当前文件和 journal 交叉核对。

### 1.2 canonical 与固定基线机械检查

本轮亲跑：

```text
python3 提取 docs/09-data-contracts.md 的 §9 首个 sql fence | sqlite3 ':memory:'
exit 0
```

```text
awk '/^```/{n++; last=NR} END{print "current_fences=" n, "parity=" n%2, "last=" last}' docs/09-data-contracts.md
current_fences=46 parity=0 last=1064

awk '/^```/{n++; last=NR} END{print "backup_fences=" n, "parity=" n%2, "last=" last}' docs.bak-r-a-20260727/09-data-contracts.md
backup_fences=47 parity=1 last=971
```

```text
rg -n 'ः|stateःunknown' docs
无匹配

rg -n 'ः|stateःunknown' docs.bak-r-a-20260727/09-data-contracts.md
953: ... stateःunknown ...
```

全 `docs/*.md`、`docs/modules/*.md`、`docs/adr/*.md` 的奇数围栏扫描无输出。

四个专项测试文件也亲跑通过：

```text
pnpm --filter @saydo/daemon exec vitest run \
  test/s3-merge-chain.test.ts \
  test/writing-narrow.test.ts \
  test/proposed-ttl.test.ts \
  test/readiness-skeleton.test.ts

Test Files  4 passed (4)
Tests       67 passed (67)
```

分项为 proposed TTL 8、readiness 12、S3 32、writing 15。**这些绿灯证明现有测试与现有实现一致，不证明下文未覆盖的不变量成立。**

`b5d45e9` 仓级 emoji gate 亲跑失败：

```text
bash scripts/check-emoji.sh
exit 1
[fail] emoji gate: found forbidden pictographic characters:
e2e/evidence/w4-batch.md:35: ... [ok] ...（共 7 个）
```

`just ci` 明确包含该 gate：`b5d45e9:justfile:13-25`。

### 1.3 独立评审完成度

项目制度要求“两路 subagent + 一路独立 Codex + journal”：`AGENTS.md:5-9`。本轮两路只读 subagent 均已返回，分别聚焦 canonical/DDL 与 SayDo 实现；二者共同确认 A3 未 armed 和 `not ready_for_review`，并在 S3 provenance、writing 人评绑定的严重度上给出互补意见。

独立 Codex 按规定模型启动了四种组合：第一次因当前目录不是 trusted repository 停止，后三次
均在 app-server 初始化时被操作系统沙箱以 `Operation not permitted` 拒绝；没有独立 Codex
报告可冒充。原始命令、错误与退出码在
`research/codex-findings/logs/22-ra-verification-completion.log:5-30`。本报告因此明确标注：**Codex 第三路未验证**。

### 1.4 审查期间 moving-HEAD 增量

当前只读复核点为 `edac8d0398f182da638664afe22030ee32f67107`，前两条提交是：

```text
edac8d0 chore(evidence): w4-readback 勘误……
1fc2324 fix(w4-readback): B-3 内容 lint gate……+ B-4 会话建立装配点接线
b5d45e9 chore(evidence): W4 收口……
```

对 `edac8d0` 亲跑四个专项文件得到 70/70（proposed 8、readiness 13、S3 32、writing
17），`bash scripts/check-emoji.sh` 输出 `[ok] emoji gate: clean`。这两个新增提交带来：

- **B-3 已实质关闭**：writing executor 对任一非零 verify exit 走 failed 且 return，不再 settle：
  `edac8d0:packages/daemon/src/tier1/executor.ts:997-1009`；executor 行为反例在
  `edac8d0:packages/daemon/test/writing-narrow.test.ts:312-333`。
- **B-4 的窄义调用点已接入，但端到端生命周期仍未闭合**：LiveDialog 确已新增第三调用点；
  然而生产 `readinessEvidence` 仍固定为 `undefined`，所以新增装配函数仍不 armed：
  `edac8d0:packages/daemon/src/index.ts:915-925`。即使将来 armed，LiveDialog 只在
  `ensured.created` 时调用：
  `edac8d0:packages/daemon/src/live/dialog.ts:72-82`；而新会话在同一步必先创建
  `pending` 项目：
  `edac8d0:packages/daemon/src/live/voiceSessions.ts:58-76`。新增测试则手工把项目改为
  coding 后直接调用 assembly，没有走 LiveDialog 的 pending→promote/rebind 真实顺序：
  `edac8d0:packages/daemon/test/readiness-skeleton.test.ts:244-257`。

完整 `just ci` 在本沙箱已跑到 typecheck/lint 后，因 Vite 写 `.vite-temp` 返回 `EPERM`
而中止；这既不能证明代码红，也不能独立追认当前整仓绿，故标为**未验证**。evidence 的
readiness/writing 计数仍写 12/14：
`edac8d0:e2e/evidence/w4-batch.md:34,45`，与 13/17 实跑结果漂移。

### 1.5 审查期间 canonical 也被并发回写

完成第一轮成稿后，`docs/09-data-contracts.md` 在 2026-07-28 00:46:50 +0800 被另一会话
回写；来源会话本轮未独立验证，本审查代理未修改 `docs/`。本报告最终重新冻结并复核的
current canonical 是：

```text
sha256 34f4dceb96517e51b7372f38cea32bed64764a9f42401854ae1fd21d0ec4809e
lines  1087
fences 46, parity 0, last fence line 1064
§9 SQL fence -> sqlite3 :memory: exit 0
docs/ 中 ः/stateःunknown -> 0 matches
```

并发会话还在 journal 插入了 R53：
`history/PROCESS-JOURNAL.md:774-781`，位置却排在 R52
`history/PROCESS-JOURNAL.md:783-788` 之前。R53 自述 `just ci=0`、B-4 已闭合；前者是过程
记录，本沙箱未能独立复跑；后者若只指“新增 nominal 调用点”可以确认，若指“真实
pending→promote/rebind 生命周期已闭合”则被 §1.4 的读码推翻。故下文以当前文件/代码
重新裁决，不把 R53 的宽口径自述当成替代证据。

## 2. R50 历史结论复核

### 2.1 已落盘清单：确认

以给定快照为 R50 时点载体，以下均能实读：

- §3.3 WebAuthn 合同及 `WebauthnCredential`/`S3Challenge`：
  `docs.bak-r-a-20260727/09-data-contracts.md:185-221`；
- §9 两张新表：
  `docs.bak-r-a-20260727/09-data-contracts.md:551-558`；
- §13 四工具：
  `docs.bak-r-a-20260727/09-data-contracts.md:905-909`；
- writing 窄版与 `WritingSettleProof`：
  `docs.bak-r-a-20260727/09-data-contracts.md:382-404`；
- TTL 实施同步注记：
  `docs.bak-r-a-20260727/09-data-contracts.md:102-110`；
- tailnet S2 对表行：
  `docs.bak-r-a-20260727/09-data-contracts.md:168`。

因此 R50 所说“三块合同主体已落、今早增量未落”的核心区分，与快照一致：
`history/PROCESS-JOURNAL.md:753-758`。

### 2.2 当时未落盘清单：确认，现已被 R51 supersede

在备份快照中：

- `approveMerge` 只有一句“收据非本 task 拒”，没有五步事务/CAS：
  `docs.bak-r-a-20260727/09-data-contracts.md:909`；
- 签发链返回 generic `ApprovalReceipt`，没有 `S3MergeReceipt` 判别型：
  `docs.bak-r-a-20260727/09-data-contracts.md:215`；
- writing 只有 proof 形状，没有 `writingSettleBarrier`：
  `docs.bak-r-a-20260727/09-data-contracts.md:388-404`；
- 四工具仍接受调用方 `rpId/refDigest`：
  `docs.bak-r-a-20260727/09-data-contracts.md:906-908`。

对整个备份目录搜索
`approveMerge.*CAS|五步事务|S3MergeReceipt|按.*type.*分叉`
无匹配。故 R50 的“这些声称未真落盘”可确认。它们后来由 R51 补写，journal 对补写范围有逐项记录：
`history/PROCESS-JOURNAL.md:760-766`。

### 2.3 两处损伤：历史存在、当前已修

- 备份的非法字符在
  `docs.bak-r-a-20260727/09-data-contracts.md:953`；
- 备份的最后一个孤立围栏在
  `docs.bak-r-a-20260727/09-data-contracts.md:971`；
- 当前 `docs/09` 为 46 个围栏且 `docs/` 无 `ः`，与 R51 的修复记录一致：
  `history/PROCESS-JOURNAL.md:764-766`。

**可确认的是“备份有损伤、当前已修”。**“971 围栏究竟由哪一轮历史写入造成”依赖旧会话记录，本轮不能仅凭文件独立证明，故该因果归属标为**未验证**。

## 3. A1–A6 终局追认

| 原项 | canonical 落盘 | `b5d45e9` 对齐（`edac8d0` 增量） | 追认 |
|---|---|---|---|
| A1 · S3MergeReceipt/CAS | 主体已落 | 主路径主体已落 | **核心关闭；留 B 级 DDL 纵深项** |
| A2 · 本机守卫/目标绑定/同步凭据 | 守卫和 BE/BS 条款已落 | 守卫、验签、BE/BS 已落 | **部分，不关闭** |
| A3 · readiness fail-closed | 目标合同已落；未 armed 诚实，第三点过报 | 仍存在未 armed/生命周期旁路 | **不关闭** |
| A4 · writing enabled 回收 | **裁决正确**，effective 为 coding-only | 正式 writing 被挡；另有 `pending` 生命周期冲突 | **原 A4 关闭；新 A 待裁决** |
| A5 · writing settle barrier | API/等价审计已补；正文节锚/输入 exact-set 缺 | 主体已落；verify 已由 `edac8d0` 修复 | **核心关闭；留 B/翻值 gate** |
| A6 · proposed TTL/supersede | 投影锚已定，schema/DDL/反例主体已落 | CAS/索引/扫表/双闸有；第二写口仍在 | **原 A 关闭；留 B 级实现漂移** |

### A1 · S3 判别型与五步 CAS：原 A 关闭；DDL provenance 是 B 级纵深项

已确认：

- `ApprovalReceipt.s3` 六字段与 `S3MergeReceipt` 判别型：
  `docs/09-data-contracts.md:149-170,230-238`；
- approvals 六列和双向 CHECK：
  `docs/09-data-contracts.md:565-594`；
- `approveMerge` 五步合同：
  `docs/09-data-contracts.md:1003-1015`；
- `b5d45e9` 类型判别：
  `b5d45e9:packages/contracts/src/types/approval.ts:32-40,99-139`；
- `b5d45e9` 收据 CAS、任务 CAS、attempt/revision/evidence/tree 全匹配：
  `b5d45e9:packages/daemon/src/tier1/s3Tools.ts:403-477`；
- 状态机对 `waiting→merging` 要求 receipt gate：
  `b5d45e9:packages/contracts/src/statemachines/task.ts:84-96`。

原 21 号 A1 要求的是判别型、五步 CAS、generic screen 不得冒充及迁移/反例：
`research/codex-findings/21-ra-contract-review.md:32-37`；这些在可达生产主链上已经兑现，应追认 A1 核心关闭。

仍有一处 B 级纵深项，但不是同篇矛盾。canonical 所说类型层与 DDL 层“双重不可能”只针对
**缺少 S3 provenance 字段的 generic screen receipt**，在该边界上成立：
`docs/09-data-contracts.md:230-231`；同篇另行说明 raw-DB writer 不在 threat model、DDL
不重复证明 challenge 已消费，并把 `approveMerge` 的 `consumedAt` 复验列为后续小批：
`docs/09-data-contracts.md:235`。实际 DDL 只做 FK/UNIQUE，没有断言目标 challenge
`action='merge' AND consumed_at IS NOT NULL`：
`docs/09-data-contracts.md:571-594,605-611`。`approveMerge` 也只复验
`action='merge'`，不复验 `consumedAt`：
`b5d45e9:packages/daemon/src/tier1/s3Tools.ts:410-420`。

本轮把 canonical DDL 装入 `sqlite3 ':memory:'` 后，成功插入了完整 S3 形收据指向**未消费** challenge，原始输出：

```text
apr_y|<NULL>|pending
```

这不推翻正常 verifier 路径——正常路径确实先 CAS 消费 challenge，再插 receipt：
`b5d45e9:packages/daemon/src/tier1/s3Tools.ts:290-393`；消费点还会再做判别、双 CAS 和全匹配：
`b5d45e9:packages/daemon/src/tier1/s3Tools.ts:403-477`。裸写 SQLite 的主体也能同步伪造 `consumed_at`/任务状态，所以在未把 raw-DB writer 纳入 threat model 前，trigger 不是可信安全边界。该复现只证明“DDL 自身机械证明来源”的措辞过强，不能反向重开原 A1。

**B 级收口：**保留 `docs/09-data-contracts.md:230-231` 对 generic receipt 的断言；按
`docs/09-data-contracts.md:235` 给 `approveMerge` 增 `consumedAt` 一致性复验即可。
若 owner 将来扩张 threat model，再另立 trigger/独立 receipt 表。
`attempt/packageRevision` 固化属于下节 A2，不混回 A1。

### A2 · 本机守卫/同步 passkey：主链成立，challenge 目标绑定不完整

已确认：

- canonical 四断言守卫及同步凭据诚实条款：
  `docs/09-data-contracts.md:241-249`；
- `b5d45e9` 守卫检查 socket peer、精确 Origin、via=local、常量 rpId：
  `b5d45e9:packages/daemon/src/net/s3Guard.ts:25-54`；
- 守卫在所有 S3 路由业务逻辑之前：
  `b5d45e9:packages/daemon/src/api/s3Routes.ts:56-85`；
- WebAuthn 检查 type/challenge/origin、rpIdHash、UP/UV、签名和 signCount，并返回 BE/BS：
  `b5d45e9:packages/daemon/src/tier1/webauthn/verify.ts:83-100,145-183`；
- 注册链将 BE/BS 落凭据和审计且不签 ApprovalReceipt：
  `b5d45e9:packages/daemon/src/tier1/s3Tools.ts:186-256`。

未闭合点：

- canonical `S3Challenge` 没有 `attempt/packageRevision`，`sessionId` 仍可选：
  `docs/09-data-contracts.md:218-227`；
- DDL 同样没有 attempt/revision，register CHECK 不禁止 `project_id`，也不要求 session/owner-intent：
  `docs/09-data-contracts.md:605-611`；
- `b5d45e9` merge challenge 只固化 task/project/evidence/tree，attempt/revision 到验签时才从当前 run 再读：
  `b5d45e9:packages/daemon/src/tier1/s3Tools.ts:138-162,321-363`；
- register challenge 的 session 也是可选：
  `b5d45e9:packages/daemon/src/tier1/s3Tools.ts:122-136`。

本轮 DDL 行为复现：

```text
s3c_reg|register|prj_should_be_forbidden|<NULL>
```

即 register challenge 可带本应为空的 project，且无 session。21 号 A2 要求 merge challenge 绑定当前 task/attempt/package/tree/evidence，注册绑定当前 console session/owner intent：
`research/codex-findings/21-ra-contract-review.md:51-56`；因此不能追认“忠实关闭”。

**最小充分修复：**

- merge challenge 固化 `attempt/packageRevision`；
- register challenge 强制 `task/project/tree/attempt/revision` 全空，并强制一个可审计的
  `consoleSessionId` 或 `bootstrapIntentId` 非空；
- §12 加跨 attempt/revision、register 带 project、register 无 owner-intent 三类 DDL + 工具反例。

把 DDL action CHECK 从未来词表收窄为 `register|merge` 属 B1 纵深项，不列 A2 关闭条件；生产输入本身已由 strict union 限定两值：
`b5d45e9:packages/daemon/src/tier1/s3Tools.ts:103-107`。

### A3 · readinessSkeleton/readinessRef：canonical 目标已落，生产绕过仍在

canonical 已有：

- `readinessRef` 入包 digest：
  `docs/09-data-contracts.md:29,97`；
- fail-closed 目标、三处同源和反例清单：
  `docs/09-data-contracts.md:946,1069`。

current canonical 诚实承认 `covered` 证据映射语义仍留白、provider throw 未持久化、
生产 propose 硬门未 armed，也正确记录 nominal 第三调用点已经写入：
`docs/09-data-contracts.md:1069`。但该句若被理解成真实
pending→promote/rebind 生命周期已经闭合，就超出了 §1.4 的代码证据。

`edac8d0` 仍未 armed：

- `readinessEvidence` 可选，缺省就是未 armed：
  `edac8d0:packages/daemon/src/brain/liveTools.ts:61-66`；
- `skeletonGate` 未 armed 直接返回 `null`：
  `edac8d0:packages/daemon/src/brain/liveTools.ts:149-163`；
- `proposeStart` 只有 `sk` 非空时才拒：
  `edac8d0:packages/daemon/src/brain/liveTools.ts:337-365`；
- `assessReadiness` 未 armed 时仍可落到 `ready,dims:[]`：
  `edac8d0:packages/daemon/src/brain/liveTools.ts:840-857`；
- provider 调用没有 `try/catch`，throw 不会收敛为持久化 `gap_critical`：
  `edac8d0:packages/daemon/src/evaluator/readinessGate.ts:74-94`；
- nominal 第三调用点只覆盖新建 pending 会话，见 §1.4。

这正是 21 号 A3 所报旁路：
`research/codex-findings/21-ra-contract-review.md:58-73`，不是新批次可降级忽略的旁支。

**关闭条件：**

1. canonical 先定义 verified ledger evidence → checklist dim 的确定性映射、证据版本和撤销语义；
2. 生产构造必须注入 evidence provider；未注入/provider 出错也落
   `gap_critical`，不得返回 null；
3. 保留已有 nominal 调用点，并在 pending→promote/rebind 后重装配，使第三消费点覆盖真实
   lifecycle；
4. 删除 `ready,dims:[]` 回退；
5. 对未 armed、provider throw、空账本、重启重建、证据撤销补生产路径反例。

### A4 · enabled_project_types：原 A4 关闭；新发现 pending 生命周期 × capability gate 冲突

**裁决：W4 前回收 writing 缺省开值，不与 owner 拍板冲突。**

owner 拍板的是 writing 使用 Tier1 worktree 交付形态：
`docs/09-data-contracts.md:414-436`；“形态/排期已定”不等于“未完成 gate 即默认启用”。
当前 canonical effective 值是 `["coding"]`，但 §11 的实施状态仍错误登记 B-3 未修：
`docs/09-data-contracts.md:863`；roadmap 也保持 coding-only 口径：
`docs/05-roadmap.md:101`。`b5d45e9`/`edac8d0` 的配置缺省和坏配置回退均为 coding-only：
`b5d45e9:packages/daemon/src/config/types.ts:85-94`、
`b5d45e9:packages/daemon/src/index.ts:817-823`。

所以 R51 对 A4 选择 21 号方案 (a) 是正确的：
`research/codex-findings/21-ra-contract-review.md:85-89`。

但实施门禁没有完全忠实于“type ∈ enabled set”：

- canonical 明说 propose/dispatch 前必须属于 enabled 集：
  `docs/09-data-contracts.md:967-973`；
- `b5d45e9`/`edac8d0` 对 `type='pending'` 无条件放行：
  `b5d45e9:packages/daemon/src/tier1/typeGate.ts:9-22`；
- executor 读取缺失/异常类型时按 coding 处理：
  `b5d45e9:packages/daemon/src/tier1/executor.ts:915-918`；
- 测试将该旁路锁成正例：
  `b5d45e9:packages/daemon/test/writing-narrow.test.ts:61-73`。

这使新建 draft 在未定型时可以越过能力集进入 coding settle，属于 capability gate 的 fail-open。

但关闭方式不能由本报告写死。canonical 同时允许“奠基完成**或首个决策包后**”转正：
`docs/09-data-contracts.md:1062`；若一律要求 propose 前 promote，会静默删除“首包后转正”这一产品路径。

**关闭条件：**先由 owner/canonical 裁决 pending 生命周期。最低安全约束是 pending 不得
`confirmAndDispatch`；是否允许 pending 只生成“不可派发的首包”，或改为 propose 前转正，
需上浮 owner。实现与 §12 随裁决补正反例。writing 仍保持缺省关闭，直到 pending 门、正文
节锚与审计同步项全绿；B-3 已由 `edac8d0` 关闭。

### A5 · writingSettleBarrier：运行时核心关闭；留 B 级正文节锚/输入集合 gate

已确认的正向部分：

- canonical 的 artifact/tree、section exact-set、acceptance exact-set、manual unknown、approve 逐条裁决和原子性五断言：
  `docs/09-data-contracts.md:420-434`；
- §12 反例：
  `docs/09-data-contracts.md:944`；
- `b5d45e9` approve 时覆盖 proof 内全部必需 manual 项，缺项/任一 fail 均拒：
  `b5d45e9:packages/daemon/src/tier1/operations.ts:406-449`。

21 号 A5 要求每条 critical acceptance 绑定人工 review receipt/criteria digest：
`research/codex-findings/21-ra-contract-review.md:103-105`。并发 canonical 回写现已：

- 给 `reviewTask` 同步 `acceptanceVerdicts`；
- 明确选择
  `proof-digest + owner audit + 必需项 fail-closed` 作为 review receipt/criteria digest
  的等价承载，并保留 owner 不接受时另立 `WritingReviewReceipt` 的翻案口：
  `docs/09-data-contracts.md:1020-1029`。

- 实现仍 hash 原始 proof：
  `b5d45e9:packages/daemon/src/tier1/operations.ts:415-450`；
- audit 记 `acceptancePassed` 数量而非另存逐项结果：
  `b5d45e9:packages/daemon/src/tier1/operations.ts:459-463`。

当前行为对当次请求是 fail-closed，且不是“完全不可重建”：proof 的 criteria 集被
`evidenceDigest=H(JCS(proof))` 绑定，approve 对 proof 内全部必需 manual criteria 要求逐条
verdict、缺项/fail 均拒，随后 immutable audit 记
`actor=owner + evidenceDigest + attempt + acceptancePassed`：
`b5d45e9:packages/daemon/src/tier1/operations.ts:419-463`。由这些事实可推导“该 proof 覆盖的全部 manual criteria 均由 owner 判 pass”。

输入 verdict `Map` 本身不拒绝额外 criterion，重复 key 也会覆盖；所以不能宣称
“verdict 输入 exact-set”，只能确认“全部必需项被覆盖”。此外，executor 的
`sectionCoverage` 是把包 plan 的所有 AI 步直接投影成 `drafted`，没有从文章标题/正文机械证明
逐节存在：
`b5d45e9:packages/daemon/src/tier1/executor.ts:1038-1047`；既有 readback 已把这一点登记为
C-1：
`research/2026-07-27-saydo-w4-impl-readback.fable.md:30`。

因此原 A5 的空稿、proof 集合对账、unknown/fail 与 approve 必需项覆盖核心可以关闭；当前
canonical 也已补 API/等价审计声明。但“文章正文漏节已被机械证明不可能”仍不能追认；而
`docs/09-data-contracts.md:1022-1026` 的“exact-set”措辞比实现更强：输入 verdict `Map`
不拒额外 criterion，重复 key 会覆盖。两点均列 B/翻值 gate。

固定基线另有 W4 B-3：writing executor 运行已登记 verify 后，只收集结果，不检查非零退出码：
`b5d45e9:packages/daemon/src/tier1/executor.ts:970-996`；随后生产构造的所有 acceptanceChecks 仍是 manual/unknown：
`b5d45e9:packages/daemon/src/tier1/executor.ts:1038-1052`。
`b5d45e9` 的 `verify fail` 测试只测纯函数合成输入：
`b5d45e9:packages/daemon/test/writing-narrow.test.ts:152-166`，没有 executor 非零退出码反例。该点已由 `edac8d0` 关闭，见 §1.4；下列清单保留为防回归要求，不再算当前缺口。

**B 级/翻值前修复：**

1. 要么实现严格拒绝额外/重复 verdict，要么把 canonical “exact-set”收窄为“覆盖全部
   必需项”；
2. sectionCoverage 绑定可从文章内容重建的节锚，不能由 plan 自证全部 drafted；
3. §12 增加结果篡改、漏项、重复项、旧 attempt、崩溃重放、正文漏节与 executor
   lint-fail 反例。`edac8d0` 已补最后一项，见 §1.4。

只有 owner 不接受 current canonical 的等价审计方案时，才再定义独立
`WritingReviewReceipt/criteriaDigest`；当前不把它列硬门。

### A6 · proposedAt/唯一活跃索引：原 A 关闭；投影锚已对齐，留第二写口 B

canonical 主体齐全：

- `proposedAt`、CAS 关旧、唯一活跃索引、scheduler、approve/dispatch 双闸和禁裸改：
  `docs/09-data-contracts.md:39,97-119,559-564,926`；
- `b5d45e9` 事务关闭旧 proposed 并写锚/投影：
  `b5d45e9:packages/daemon/src/storage/dao/packages.ts:57-86`；
- v11 建列和唯一索引：
  `b5d45e9:packages/daemon/src/storage/ddl.ts:375-405`；
- scheduler 已接：
  `b5d45e9:packages/daemon/src/index.ts:1095-1098`；
- 包状态机已有 expired/superseded：
  `b5d45e9:packages/contracts/src/types/package.ts:72-85`。

原 21 号 A6 的核心风险是没有 expired/supersede、旧包仍可派发：
`research/codex-findings/21-ra-contract-review.md:107-119`。当前 CAS、索引、扫表、双闸已经消除该主漏洞，应追认原 A6 关闭。

并发 canonical 回写已选择“`expires_at` 是进入 proposed 事务内一次写入的不可变
entry-time 锚，配置变更不追溯”，并明确判定读该锚：
`docs/09-data-contracts.md:39,100,105,116`。这与实现 read/sweep 直接读 `expires_at`
的表示法已经对齐：

- `isProposedExpired` 读 `expires_at`：
  `b5d45e9:packages/daemon/src/storage/dao/packages.ts:88-95`；
- sweep 同样直接按 `expires_at`：
  `b5d45e9:packages/daemon/src/storage/dao/packages.ts:98-110`。

但 `insertPackage` 仍允许插入即 proposed，并用 `expiresAt ?? createdAt` 伪造 proposedAt，
形成第二写点：
  `b5d45e9:packages/daemon/src/storage/dao/packages.ts:8-27`；
这与 canonical“首次进入 proposed 事务写一次/唯一写点”冲突：
`docs/09-data-contracts.md:100-101,118,562-564`。contracts 的 `DecisionPackage` 也没有
`proposedAt`，回读不返回它：
  `b5d45e9:packages/contracts/src/types/package.ts:59-68`、
  `b5d45e9:packages/daemon/src/storage/dao/packages.ts:30-42`。
当前实现注释仍称按“`proposed_at + TTL`”判断，也和直接读取不可变 `expires_at` 的代码/
canonical 表示漂移：
`edac8d0:packages/daemon/src/storage/dao/packages.ts:88`。

**B 级收口：**让 `insertPackage` 只接受 draft、进入 proposed 只走
`transitionToProposed`，把 `proposedAt` 类型/回读投影同步，并补配置变更、重启、直接插
proposed 反例。current canonical 已完成 TTL 二选一，不再把锚重算列为默认修法；owner 若翻案，
再同步新增 TTL snapshot 承载。这些不作为本轮 R-A ready 的 A 条件。

## 4. R-A、W5a、W4 多轮回写一致性

### 4.1 已确认落盘

- R51 的 A1–A6 主体、反例和两处损伤修复有过程记录：
  `history/PROCESS-JOURNAL.md:760-766`；
- W5a 八条 canonical 清偿有记录：
  `history/PROCESS-JOURNAL.md:769-772`；
- W4 readback 与八条清偿有记录：
  `history/PROCESS-JOURNAL.md:783-788`；
- W5a 的 v6 decisions、v7 project_settings、v8 retry queue 对应 canonical DDL 在
  `docs/09-data-contracts.md:689-713`；
- module 导航已补 S3、content_done、writing、readiness 和输入区：
  `docs/modules/c-control-bridge.md:50,59`、
  `docs/modules/b-memory.md:37`、
  `docs/modules/a-dialogue.md:48`、
  `docs/modules/d-presentation.md:9`。

本轮没有发现 W5a 八条与 R-A schema 的直接互斥。并发 R53 已修掉一批旧状态句，但仍有
以下残余。

### 4.2 同篇矛盾或漏同步

1. **writing 的主体口径已修，§11 状态注仍旧。**
   `docs/09-data-contracts.md:394,418,437` 已统一为 effective coding-only、独立翻值；但
   `docs/09-data-contracts.md:863` 仍写“缺省翻 writing = W4 收口动作、B-3 待回修”，与
   `edac8d0` 已修 B-3 冲突；`docs/05-roadmap.md:101` 也仍把 verify-fail 写成待补。
   `docs/09-data-contracts.md:47,553` 的“提前批启用”是分期标签，且 553 同句说明门禁前
   仅 coding，不应误删。

2. **S3 generic receipt 断言成立，消费状态复验仍挂账。**
   `docs/09-data-contracts.md:230-231` 只排除缺少 provenance 字段的 generic receipt，
   与 `docs/09-data-contracts.md:235` 的 producer-only threat model 不矛盾；后者登记的
   `consumedAt` 复验仍未实施。

3. **readiness 状态注仍过强。**
   `docs/09-data-contracts.md:1069` 对 nominal 第三调用点“已接线”的窄义描述成立，但未
   限定真实 pending→promote/rebind 生命周期尚不触发，见 §1.4；
   `docs/09-data-contracts.md:948` 仍用“实施批次排产待 PLAN-2”概括已经部分落地、但尚未
   armed 的门，状态粒度也应更新。

4. **A5 exact-set/正文节锚仍未同实现对齐。**
   `docs/09-data-contracts.md:1022-1026` 声称 approve exact-set，实际只覆盖全部必需项；
   `docs/09-data-contracts.md:428-433` 的 sectionCoverage 仍由 plan 集合自证，不绑定正文
   节锚。

5. **WebAuthn UV 文案只修了一半。**
   `docs/09-data-contracts.md:163-164` 已诚实说明 UV 可能是设备密码/PIN；但签发链仍称
   UV 是“已生物/本机强认证”的机械支撑：
   `docs/09-data-contracts.md:245`。实现只断言 UV：
   `b5d45e9:packages/daemon/src/tier1/webauthn/verify.ts:154-160`。

6. **tailnet S2 尚未同步，但 canonical 对此是诚实的。**
   canonical 明确当前实现仍错落 `screen`：
   `docs/09-data-contracts.md:180`；`b5d45e9` HTTP 层计算 `idvVia`，却把 edit/decide 固定传
   `{via:"screen"}`：
   `b5d45e9:packages/daemon/src/index.ts:202,309,325`，receipt 因而签为
   screen 而非 push：
   `b5d45e9:packages/daemon/src/tier1/approvalFlow.ts:128-143`。

7. **过程/证据簿记漂移。**
   R53 排在 R52 前且过早写“B-4 已闭合”：
   `history/PROCESS-JOURNAL.md:774-788`；W4 evidence 的 writing/readiness 测试数仍是
   14/12，实际为 17/13：
   `edac8d0:e2e/evidence/w4-batch.md:34,45`。

并发回写已确实修复、无需再挂账的项目是：S3 tree/refDigest 字段
`docs/09-data-contracts.md:247,253`、v9 迁移状态
`docs/09-data-contracts.md:595`、PackageTransitions/typeGate 未来时态
`docs/09-data-contracts.md:110-111,967-970`、readinessRef verdict
`docs/09-data-contracts.md:97`、credential TS/Id 前缀
`docs/09-data-contracts.md:13,205-214`。

## 5. canonical“已实施”注与 SayDo 固定基线/当前增量对账

### 5.1 可以追认

- **S3 主路径主体**：v9 两表/approvals 六列、WebAuthn 验签核、守卫、四工具、CAS、merge 执行段和 32 个专项测试均有 `b5d45e9` 代码与本轮测试支持：
  `docs/09-data-contracts.md:201`、
  `b5d45e9:packages/daemon/src/storage/ddl.ts:262-339`、
  `b5d45e9:packages/daemon/src/net/s3Guard.ts:25-54`、
  `b5d45e9:packages/daemon/src/tier1/s3Tools.ts:100-256,275-477`。
  追认范围不包括前述 challenge provenance 结构缝。

- **writing 窄版主体**：project/artifact/proof、按类型分叉、artifact/tree、plan 投影层的
  section 集合对账、manual 初始 unknown、approve 必需项覆盖门和 content_done 主干成立：
  `docs/09-data-contracts.md:414-437`、
  `b5d45e9:packages/daemon/src/tier1/executor.ts:970-1059`、
  `b5d45e9:packages/daemon/src/tier1/operations.ts:406-466`。
  追认范围不包括“正文逐节存在”的机械证明和 verdict 额外/重复项严格拒绝；`b5d45e9` 的
  verify-fail 缺口已由 `edac8d0` 修复，见 §1.4。

- **readiness 状态注只能部分追认**：canonical 对“生产未 armed、provider throw 未落行”
  的描述诚实，nominal 第三调用点也确已接入：
  `docs/09-data-contracts.md:1069`。但 `edac8d0` 仍未 armed，且第三点不覆盖真实
  pending→promote/rebind；实现也没有捕获 provider throw：
  `edac8d0:packages/daemon/src/evaluator/readinessGate.ts:74-94`。

- **W5a 主回写**未见与 `b5d45e9`/`edac8d0` 的直接反证；其独立 readback 已判整批成立并列出边界：
  `research/2026-07-27-saydo-w5a-impl-readback.fable.md:24-39`。

### 5.2 不能追认或需限缩

- **proposed TTL 的“投影即锚”表示法可以追认**；不能追认的是“唯一写点”，因为
  `insertPackage` 仍可直接插 proposed，见 A6。
- **`b5d45e9` 的 writing 前置七项全绿不能追认**：evidence 在
  `b5d45e9:e2e/evidence/w4-batch.md:35`
  写七绿；代码没有 verify 非零退出门，独立 readback 已判 B-3：
  `research/2026-07-27-saydo-w4-impl-readback.fable.md:14,27,42`。`edac8d0` 已修该点，
  但 evidence 计数仍漂移，见 §1.4。
- **readiness 三处同源/生产门已落不能追认**：W4 readback 对 `b5d45e9` 明确只有两处：
  `research/2026-07-27-saydo-w4-impl-readback.fable.md:16,28,43`；`edac8d0` 已新增 nominal
  调用点，窄义接线成立，却未覆盖 pending→promote/rebind 真实生命周期，见 §1.4。
- **`b5d45e9` 的收口 `just ci=0` 不能追认**：W4 evidence 自称绿色：
  `b5d45e9:e2e/evidence/w4-batch.md:11`；
  该基线实跑 exit 1，readback 也已记录：
  `research/2026-07-27-saydo-w4-impl-readback.fable.md:7,21,32-35`。`edac8d0`
  已令 emoji gate clean，但完整 `just ci` 在本沙箱因 `EPERM` 中止，当前整仓绿仍未验证。
- **HANDOFF 的“代码/自动化全绿”仍不能独立追认**：
  `edac8d0:HANDOFF.md:32,48`。其中 B-3 已有专项证据，B-4 的真实生命周期仍未闭合，
  完整 `just ci` 又未能在本沙箱跑完。journal R53 报告另一环境 `just ci=0` +
  Playwright 21：
  `history/PROCESS-JOURNAL.md:776-778`，本报告把它列为外部过程证据而非本轮亲验。

### 5.3 未验证

- 真人 Touch ID/真实 platform authenticator 过卡；
- OctoBlog 首篇文章逐节验收；
- owner 是否在过完前置清单后翻 `enabled_project_types`；
- dogfood 常驻 runtime 是否已 deploy 到 `edac8d0`（这是运行状态未验证，不是 owner-gated
  产品验收；执行前需协调 owner 时窗）。

当前 HANDOFF 同一行编号列了四项，但标题仍写“三 owner 触点”：
`edac8d0:HANDOFF.md:48`。其中 Touch ID、OctoBlog、effective writing 翻值是三项产品触点；
deploy 是时窗协调，不是产品验收。标题/编号不一致列 B 级文案同步。本报告不把自动化的
fake authenticator 结果推断成真人通过。

## 6. 21 号 B/C 项终局三分

| 项 | 分类 | 一句理由 |
|---|---|---|
| B1 WebAuthn schema/DDL/测试 | **A2 + canonical 本轮落** | challenge attempt/revision 与 register intent 是 A2；credential 类型/Id 前缀已修，余 action 收窄和签发链 UV 生物识别过报：`docs/09-data-contracts.md:163-164,218-227,245,605-611`。 |
| B2 writing proof/content_done/人评绑定 | **canonical 本轮落 + 翻值 gate** | verdict API/等价审计与 verify 非零门已修；余正文节锚及 verdict 额外/重复项：`docs/09-data-contracts.md:428-433,1020-1027`。 |
| B3 readiness 与 Brain instructions 双源 | **canonical 本轮落 + W4 挂账** | 随 A3 armed 批处理；instructions 仍是通用目标/验收/边界文字，未由类型 registry 生成：`edac8d0:packages/daemon/src/brain/instructions.ts:4-18`。 |
| B4 fallback/tailnet provenance | **W4 挂账** | tailnet 仍签 screen；manual handoff 的一次性 intent 仍应随安全批补，S3 真人过卡仅是 owner 触点：`docs/09-data-contracts.md:180,247`。 |
| B5 结果话术 runtime gate | **W4 挂账** | 仍不是本轮 R-A 合同翻转前唯一阻断；21 号已定位为 runtime gate，而非再改 prompt：`research/codex-findings/21-ra-contract-review.md:148-150`。 |
| B6 配置门/契约漂移 | **canonical 本轮落 + W4 挂账** | enabled 主口径已修，但 §11 B-3 状态句仍旧，`proposed_ttl_hours` 仍可从项目 params 覆盖：`docs/09-data-contracts.md:863`、`edac8d0:packages/daemon/src/config/load.ts:21-42`。 |
| C1 输入区 | **不做（已实施）** | canonical 已标 W4 实施：`docs/11-ui-spec.md:209-214`；本轮不重做。 |
| C2 非法字符 | **不做（已修）** | 当前全 docs 无 `ः`；历史位置仅在备份 `docs.bak-r-a-20260727/09-data-contracts.md:953`。 |
| C3 modules 导航 | **不做（已同步主体）** | S3/content_done/writing/readiness/输入区导航均可实读：`docs/modules/c-control-bridge.md:50,59`、`docs/modules/b-memory.md:37`、`docs/modules/a-dialogue.md:48`、`docs/modules/d-presentation.md:9`。 |

## 7. 翻转为 ready 的剩余条件

### 7.1 必须先完成（R-A 域）

1. **A2 canonical + 实施同批**：merge challenge 固化 attempt/packageRevision；register 强制绑定可审计 owner intent；补跨 attempt/revision 与无 intent 行为反例。
2. **A3 canonical + 实施同批**：定义 evidence→dim 映射，接会话第三点，生产强制 armed，任何 provider 缺失/失败均持久化 `gap_critical`。
3. **新 A · pending 生命周期 × capability gate**：owner/canonical 裁决“首包后转正”是否保留；无论取哪案，pending 都不得 confirm/dispatch，且不能按 coding settle。

原 A1/A5/A6 的运行时核心不再列入 R-A A 级翻转条件；其中 A5 的降级只在 effective
writing 继续保持 disabled 时成立。若要翻 writing 开值，正文节锚与 verdict 严格集合立刻
升级为开值硬门。其余项按下文 B/仓级门收口。

### 7.2 writing 翻值前必须完成

- `edac8d0` 已把内容型 verify 非零退出阻止 settle 并补 executor 级反例；后续不得回归；
- 关闭上述 pending gate，并把 sectionCoverage 绑定正文可重建节锚；
- canonical 已同步 `acceptanceVerdicts` 并选择 proof-digest + owner audit 等价承载；仍需
  令 verdict 输入严格拒绝额外/重复项，或把“exact-set”措辞收窄为“覆盖全部必需项”；
- 把 `docs/09-data-contracts.md:863` 的旧 B-3/开值状态同步为 current；
- 再由 owner 过清单后决定是否在本机 `~/.saydo/config.toml` 把该实例的 effective 值写为 `["coding","writing"]`；编译/坏配置的 fail-closed 缺省仍应保持 `["coding"]`。不需要为尊重 worktree 拍板而扩大产品缺省。

### 7.3 仓级门与 owner 触点（不拿来代替 R-A A 级条件）

仓级门：

- `edac8d0` 已清掉 W4 evidence 的 7 个 pictographic `[ok]`；journal R53 报告该 HEAD
  `just ci=0` 与 Playwright 21，但本沙箱仅独立亲验专项 70/70 + emoji clean，完整 CI 因
  `EPERM` 未复现；
- 更正 HANDOFF/evidence 的测试计数，并把 B-4 限定为“nominal 调用点已接、真实生命周期
  待闭合”；
- runtime deploy 是 agent 的收口动作，但 dogfood 时段执行前须知会 owner，不是 owner-gated 验收。

真正的 W4 owner 触点：

- 真人 Touch ID；
- OctoBlog 首篇逐节验收；
- owner 过前置清单后决定是否翻 `enabled_project_types`。

清单来源：
`edac8d0:HANDOFF.md:48`。同一行列出的 deploy 时窗知会是工程协调，不是第四项产品验收。
这些 owner 触点不能替代前述机械门，也不应在机械门修复前执行 writing 翻值。

## 8. 可机械复验的断言

以下代码块分成“本次审计坐标复现”和“修后关闭门”。每块均自包含并启用
`set -euo pipefail`；负向 grep 一律显式 `if ...; then exit 1`。行为门运行整个目标测试文件，
再读取 Vitest JSON，断言目标用例确实存在且为 `passed`，不使用“`-t` 零匹配也 exit 0”的
假绿路径。

### 8.1 本次审计坐标复现

固定基线存在、修后 HEAD 必须包含本轮只读复核点、canonical 可解析：

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding
SD=~/WorkSpace/SayDo
BASE=b5d45e9f7df66f2dad218112edefec0a0af1ddb9
AUDITED=edac8d0398f182da638664afe22030ee32f67107

git -C "$SD" cat-file -e "$BASE^{commit}"
git -C "$SD" cat-file -e "$AUDITED^{commit}"
git -C "$SD" merge-base --is-ancestor "$AUDITED" HEAD
test $(( $(awk '/^```/{n++} END{print n+0}' "$VC/docs/09-data-contracts.md") % 2 )) -eq 0
if rg -n 'ः|stateःunknown' "$VC/docs"; then
  echo "非法字符仍存在" >&2
  exit 1
fi

python3 - "$VC/docs/09-data-contracts.md" <<'PY' | sqlite3 ':memory:'
from pathlib import Path
import re, sys
s = Path(sys.argv[1]).read_text()
sec = s.split("## 9. SQLite DDL", 1)[1]
m = re.search(r"```sql\n(.*?)\n```", sec, re.S)
assert m, "§9 SQL fence not found"
print(m.group(1))
PY
```

本报告对 `b5d45e9` 亲跑的专项结果是 67/67、emoji exit 1；`edac8d0` 是本轮当前增量
基点，亲跑为 70/70 与 emoji clean。下式允许后续修复提交继续前进，不把 HEAD 锁死：

```sh
set -euo pipefail
SD=~/WorkSpace/SayDo
AUDITED=edac8d0398f182da638664afe22030ee32f67107
OUT=$(mktemp -t ra22-current-tests)

git -C "$SD" merge-base --is-ancestor "$AUDITED" HEAD
(cd "$SD" && bash scripts/check-emoji.sh)
pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/s3-merge-chain.test.ts \
  test/writing-narrow.test.ts \
  test/proposed-ttl.test.ts \
  test/readiness-skeleton.test.ts \
  --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!r.success || r.numPassedTests < 70 || r.numPendingTests !== 0) {
  throw new Error(JSON.stringify({
    success: r.success,
    passed: r.numPassedTests,
    pending: r.numPendingTests,
  }));
}
NODE
```

### 8.2 R-A 三项 A 级关闭断言

**A2：canonical、DDL、SayDo 签发/验签实现和正反行为必须同批成立。**

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding
SD=~/WorkSpace/SayDo

python3 - "$VC/docs/09-data-contracts.md" \
          "$SD/packages/contracts/src/types/approval.ts" \
          "$SD/packages/daemon/src/storage/ddl.ts" \
          "$SD/packages/daemon/src/tier1/s3Tools.ts" <<'PY'
from pathlib import Path
import re, sys
doc, typ, ddl, tools = (Path(p).read_text() for p in sys.argv[1:])
iface = doc.split("interface S3Challenge {", 1)[1].split("\n}", 1)[0]
for token in ("attempt", "packageRevision"):
    assert token in iface, token
assert (
    any(x in iface for x in ("bootstrapIntentId", "consoleSessionId"))
    or re.search(r"\bsessionId:\s*Id", iface)  # 不接受 sessionId?:
)
for text in (typ, ddl, tools):
    assert re.search(r"attempt", text)
    assert re.search(r"package[_A-Z]?revision", text, re.I)
assert re.search(r"bootstrapIntent|consoleSession|sessionId", tools)
issue = tools[
    tools.index("export function issueS3Challenge"):
    tools.index("export function registerWebauthn")
]
verify = tools[
    tools.index("export function verifyS3Assertion"):
    tools.index("export function approveMerge")
]
for text in (issue, verify):
    assert "attempt" in text and "packageRevision" in text
PY

python3 - "$VC/docs/09-data-contracts.md" <<'PY'
from pathlib import Path
import re, sqlite3, sys
s = Path(sys.argv[1]).read_text()
sql = re.search(r"```sql\n(.*?)\n```", s.split("## 9. SQLite DDL", 1)[1], re.S).group(1)
db = sqlite3.connect(":memory:")
db.executescript(sql)
cols = {r[1] for r in db.execute("PRAGMA table_info(s3_challenges)")}
assert {"attempt", "package_revision"} <= cols
intent = next(
    (x for x in ("bootstrap_intent_id", "console_session_id", "session_id") if x in cols),
    None,
)
assert intent

counter = 0
def accepted(extra):
    global counter
    counter += 1
    row = {
        "id": f"s3c_{counter}", "challenge": f"c_{counter}",
        "action": "register",
        "ref_digest": "sha256:" + "0" * 64,
        "expires_at": "2099-01-01T00:00:00Z",
        "created_at": "2026-01-01T00:00:00Z", **extra,
    }
    try:
        db.execute(
            f"INSERT INTO s3_challenges({','.join(row)}) "
            f"VALUES ({','.join('?' for _ in row)})",
            tuple(row.values()),
        )
        db.rollback()
        return True
    except sqlite3.IntegrityError:
        db.rollback()
        return False

assert accepted({intent: "intent_ok"})                         # 合法 register 正例
assert accepted({                                              # 合法 merge 正例
    "action": "merge", "task_id": "tsk_ok", "project_id": "prj_ok",
    "prospective_tree_sha": "b" * 40,
    "ref_digest": "sha256:" + "2" * 64,
    "attempt": 1, "package_revision": 2,
})
assert not accepted({"project_id": "prj_bad", intent: "intent_bad"})
assert not accepted({})
assert not accepted({
    "action": "merge", "task_id": "tsk_bad", "project_id": "prj_bad",
    "prospective_tree_sha": "a" * 40, "ref_digest": "sha256:" + "1" * 64,
})
PY
```

A2 的工具级正反例必须真实执行；下列六个语义用例缺一、skip 或失败均红：

```sh
set -euo pipefail
SD=~/WorkSpace/SayDo
OUT=$(mktemp -t ra22-a2-tests)

pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/s3-merge-chain.test.ts --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = (r.testResults || []).flatMap(f => f.assertionResults || []);
const required = [
  /合法 register.*成功/,
  /合法 merge.*成功/,
  /跨 attempt.*拒/,
  /跨.*packageRevision.*拒/,
  /register.*无.*(?:owner intent|intent).*拒/i,
  /register.*带 project.*拒/i,
];
for (const p of required) {
  const hits = a.filter(x => p.test(x.fullName || ""));
  if (!hits.length || hits.some(x => x.status !== "passed")) {
    throw new Error(`missing/not-passed: ${p}`);
  }
}
if (!r.success) throw new Error("s3 suite failed");
NODE
```

**A3：canonical 先把 evidence→dim 映射、版本/撤销和真实 lifecycle 写成已定合同；生产
必须 armed，provider 失败必须持久化 `gap_critical`。**

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding
SD=~/WorkSpace/SayDo

python3 - "$VC/docs/09-data-contracts.md" \
          "$SD/packages/daemon/src/index.ts" \
          "$SD/packages/daemon/src/brain/liveTools.ts" \
          "$SD/packages/daemon/src/live/dialog.ts" \
          "$SD/packages/daemon/src/evaluator/readinessGate.ts" <<'PY'
from pathlib import Path
import re, sys
doc, idx, live, dialog, gate = (Path(p).read_text() for p in sys.argv[1:])
para = doc[doc.index("**assessReadiness 语义补全**"):doc.index("## 14.")]
for stale in (
    "canonical 留白待定",
    "生产 propose 硬门未 armed",
    "provider throw 转持久化 gap_critical 未落",
):
    assert stale not in para
assert re.search(r"(evidence|证据).*(dim|维度).*(映射|绑定)", para, re.S | re.I)
assert re.search(
    r"(版本|version).*(撤销|revoke)|(?:撤销|revoke).*(版本|version)",
    para, re.S | re.I,
)
assert re.search(r"pending.*(?:promote|转正|rebind).*重?装配", para, re.S | re.I)

decl = re.search(r"const\s+readinessEvidence\b.*?;\n", idx, re.S)
assert decl and not re.search(r"=\s*undefined\s*;", decl.group(0))
assert not re.search(r"if\s*\(!deps\.readinessEvidence\)\s*return null", live)
assert 'return { verdict: "ready", dims: [], blockingCriticals: [], layer: "rules" }' not in live
assert "readinessAssemble" in dialog or "assembleOnSessionStart" in dialog
assert re.search(r"try\s*{.*readinessEvidence", gate, re.S)
assert re.search(r"catch.*gap_critical", gate, re.S)
PY

OUT=$(mktemp -t ra22-a3-tests)
pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/readiness-skeleton.test.ts --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = (r.testResults || []).flatMap(f => f.assertionResults || []);
const required = [
  /provider.*(?:throw|异常).*gap_critical.*落行/i,
  /生产.*未 armed.*gap_critical.*落行/i,
  /LiveDialog.*pending.*(?:promote|转正|rebind).*装配/i,
  /证据.*撤销.*gap_critical/i,
  /重启.*重建.*readiness/i,
];
for (const p of required) {
  const hits = a.filter(x => p.test(x.fullName || ""));
  if (!hits.length || hits.some(x => x.status !== "passed")) {
    throw new Error(`missing/not-passed: ${p}`);
  }
}
if (!r.success) throw new Error("readiness suite failed");
NODE
```

**pending lifecycle：canonical 必须记录 owner 二选一，并至少保证 pending 不能派发、不能按
coding settle；实现行为与 §12 反例同时检查。**

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding
SD=~/WorkSpace/SayDo

python3 - "$VC/docs/09-data-contracts.md" \
          "$SD/packages/daemon/src/tier1/typeGate.ts" \
          "$SD/packages/daemon/src/tier1/executor.ts" <<'PY'
from pathlib import Path
import re, sys
doc, type_gate, executor = (Path(p).read_text() for p in sys.argv[1:])
tests = doc.split("## 12. 契约测试清单", 1)[1].split("## 13.", 1)[0]
assert re.search(r"pending.*不得.*(?:confirmAndDispatch|dispatch|派发)", doc, re.S | re.I)
assert re.search(r"pending.*(?:首个|首).*(?:包|决策包).*(?:允许|禁止|仅允许)", doc, re.S)
assert re.search(r"pending.*(?:dispatch|派发).*拒", tests, re.S | re.I)
assert re.search(r"pending.*coding.*(?:settle|结算).*拒", tests, re.S | re.I)
assert not re.search(r"pending[^\n]{0,160}return\s*;", type_gate)
project_type = re.search(r"private\s+projectTypeOf\b.*?\n\s*}\n", executor, re.S)
assert project_type and '?? "coding"' not in project_type.group(0)
PY

OUT=$(mktemp -t ra22-pending-tests)
pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/writing-narrow.test.ts --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = (r.testResults || []).flatMap(f => f.assertionResults || []);
const required = [
  /pending.*confirmAndDispatch.*拒/i,
  /pending.*(?:executor|执行器).*不.*(?:coding settle|按 coding|settle)/i,
];
for (const p of required) {
  const hits = a.filter(x => p.test(x.fullName || ""));
  if (!hits.length || hits.some(x => x.status !== "passed")) {
    throw new Error(`missing/not-passed: ${p}`);
  }
}
if (!r.success) throw new Error("writing suite failed");
NODE
```

### 8.3 B 级、writing 翻值与仓级门

canonical 状态与 API 同步。下列旧句任一命中即红；generic receipt 的双向 CHECK 断言不在
禁止表中：

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding

if rg -n '\*\*writing 已启用\*\*|\*\*W4 开值\*\*|开值 = W4 收口动作|实施仓现 \*\*v5\*\*|禁 DAO 直改,W4 补谓词|随下一契约同步批接线|实施仓接线时机 = 下一契约同步批|实施批次排产待 PLAN-2|实施待接\(W4\)|前置七项中六项全绿|verify-fail.*机械检查.*才算全绿|第 6 项.*待.*内容 lint fail|已生物/本机强认证' \
  "$VC/docs/09-data-contracts.md" "$VC/docs/05-roadmap.md"; then
  echo "canonical 仍有旧状态/过强措辞" >&2
  exit 1
fi

python3 - "$VC/docs/09-data-contracts.md" <<'PY'
from pathlib import Path
import sys
s = Path(sys.argv[1]).read_text()
review = s.split("reviewTask(i:", 1)[1].split("retryTask(i:", 1)[0]
assert "acceptanceVerdicts" in review
assert (
    ("proof-digest" in review and "immutable audit" in review)
    or "WritingReviewReceipt" in review
    or "criteriaDigest" in review
)
PY
```

S3 producer-only provenance 选择还要求消费端复验 challenge 已消费；目标行为用例必须真实
执行：

```sh
set -euo pipefail
SD=~/WorkSpace/SayDo

python3 - "$SD/packages/daemon/src/tier1/s3Tools.ts" <<'PY'
from pathlib import Path
import re, sys
s = Path(sys.argv[1]).read_text()
b = s[s.index("export function approveMerge"):s.index("export function executeMergeSegment")]
assert re.search(r"ch\.consumedAt|challenge[^\n]*consumed_at", b)
PY

OUT=$(mktemp -t ra22-a1-tests)
pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/s3-merge-chain.test.ts --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = (r.testResults || []).flatMap(f => f.assertionResults || []);
const p = /未消费.*challenge.*approveMerge.*拒|unconsumed.*challenge.*reject/i;
const hits = a.filter(x => p.test(x.fullName || ""));
if (!hits.length || hits.some(x => x.status !== "passed") || !r.success) {
  throw new Error("unconsumed challenge behavior not proved");
}
NODE
```

writing verify、正文节锚、额外 verdict、重复 verdict 必须是四个可区分的行为用例；writing
开值前四者全绿：

```sh
set -euo pipefail
SD=~/WorkSpace/SayDo
OUT=$(mktemp -t ra22-writing-tests)

pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/writing-narrow.test.ts --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = (r.testResults || []).flatMap(f => f.assertionResults || []);
function one(pattern) {
  const hits = a.filter(x => pattern.test(x.fullName || ""));
  if (!hits.length || hits.some(x => x.status !== "passed")) {
    throw new Error(`missing/not-passed: ${pattern}`);
  }
  return hits[0].fullName;
}
const lint = one(/内容 lint fail.*不 settle/i);
const body = one(/正文漏节.*不 settle/i);
const extra = one(/额外.*verdict.*拒/i);
const duplicate = one(/重复.*verdict.*拒/i);
if (new Set([lint, body, extra, duplicate]).size !== 4) {
  throw new Error("四类行为必须由四个独立用例证明");
}
if (!r.success) throw new Error("writing suite failed");
NODE
```

current canonical 已选择“`expires_at` 一次写锚”；除静态唯一写口外，还要证明直接插 proposed
被拒、`proposedAt` 回读、配置变更不追溯及重启扫表：

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding
SD=~/WorkSpace/SayDo

python3 - "$VC/docs/09-data-contracts.md" \
          "$SD/packages/contracts/src/types/package.ts" \
          "$SD/packages/daemon/src/storage/dao/packages.ts" <<'PY'
from pathlib import Path
import sys
doc, typ, dao = (Path(p).read_text() for p in sys.argv[1:])
insert = dao[dao.index("export function insertPackage"):dao.index("export function getPackage")]
readback = dao[dao.index("export function getPackage"):dao.index("export function transitionToProposed")]
assert 'pkg.status === "proposed"' not in insert
assert "transitionToProposed" in dao
assert "proposedAt" in typ and "proposedAt" in readback
assert "expires_at" in doc and "entry-time" in doc and "不信列值" not in doc
expiry = dao[dao.index("isProposedExpired"):dao.index("isProposedExpired") + 900]
assert "expires_at" in expiry
assert "proposed_at + TTL" not in dao
PY

OUT=$(mktemp -t ra22-ttl-tests)
pnpm --dir "$SD" --filter @saydo/daemon exec vitest run \
  test/proposed-ttl.test.ts --reporter=json --outputFile="$OUT"
node - "$OUT" <<'NODE'
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = (r.testResults || []).flatMap(f => f.assertionResults || []);
const required = [
  /直接插.*proposed.*拒/i,
  /proposedAt.*回读/i,
  /配置变更.*不追溯/i,
  /重启.*(?:扫表|sweep)/i,
];
for (const p of required) {
  const hits = a.filter(x => p.test(x.fullName || ""));
  if (!hits.length || hits.some(x => x.status !== "passed")) {
    throw new Error(`missing/not-passed: ${p}`);
  }
}
if (!r.success) throw new Error("TTL suite failed");
NODE
```

证据与过程簿记必须正向对齐；删除旧数字不能冒充修复：

```sh
set -euo pipefail
VC=~/WorkSpace/voice-coding
SD=~/WorkSpace/SayDo

rg -n 'writing.*(?:17 例|17/17)|(?:17 例|17/17).*writing' \
  "$SD/e2e/evidence/w4-batch.md"
rg -n 'readiness.*(?:13 例|13/13)|(?:13 例|13/13).*readiness' \
  "$SD/e2e/evidence/w4-batch.md"
rg -n '(nominal|名义).*调用点.*已接.*pending.*(未闭合|待)|pending.*(未闭合|待).*(nominal|名义).*调用点' \
  "$SD/HANDOFF.md" "$SD/e2e/evidence/w4-batch.md"

python3 - "$VC/history/PROCESS-JOURNAL.md" <<'PY'
from pathlib import Path
import sys
s = Path(sys.argv[1]).read_text()
assert s.index("## R52 ·") < s.index("## R53 ·")
PY
```

最终整仓门必须在同一个 fail-fast shell 中通过：

```sh
set -euo pipefail
SD=~/WorkSpace/SayDo

(cd "$SD" && just ci)
(cd "$SD" && pnpm exec playwright test)
```

## 9. 最终裁决

21 号报告的 `not ready_for_review` **不能翻转**。

可以追认的是：“R51 已把 A1–A6 的主要合同形状落盘；W4 在 `b5d45e9` 实现了主要
竖切且专项 67/67；`edac8d0` 又把 B-3/emoji 修到专项 70/70 与 emoji clean；并发 R53
修掉了一批 canonical 漂移；B-4 nominal 调用点已接入。”不能追认的是：“A1–A6 已忠实
全关、B-4 真实 pending→promote/rebind 生命周期已闭合、
当前整仓 CI 已由本轮独立全绿、R-A 域无已知硬伤。”

下一次申请翻转时，不需要重做本轮所有抽验；以 §7 条件组和 §8 机械断言为收口清单即可。
真人 Touch ID/OctoBlog 属其后的 owner 产品触点，不能拿来替代合同与实现门。
