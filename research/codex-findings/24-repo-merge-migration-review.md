# Codex 评审 24：双目录合并迁移终审

## 总体结论

**不通过。**

当前迁入内容本身没有发现静默漏掉的普通文件，运行代码与测试也已不再读取相邻
`voice-coding`；但收口证据和破坏性切换流程尚未闭合：

- 现有 `migrated-files.tsv` 与校验脚本已处于不同 schema 代际，35 个目标文件的存档摘要也已漂移，
  当前校验真实失败；
- 回滚说明只覆盖 161 个源迁入目标，未覆盖本轮另 30 个 SayDo 原生修改/新增路径，也未恢复冷档
  README/AGENTS 原文；
- `MIGRATION.md` 没有给出带前置断言、冻结、符号链接、四路径 allowlist、失败恢复和最终状态断言的
  完整切换命令，现有冻结脚本的目标约束也不足。

这三项均直接影响“没有数据丢失且可以完整回滚”的主目标，属于 A 级阻断。完成 A 级回修并重生成
所有最终清单后，需要再跑本报告末尾的最终复核项，才具备重新判定“通过/有条件通过”的条件。

## 评审快照与范围

- 分支：`codex/merge-voice-coding-20260729`
- `HEAD` 与评审基线：均为
  `838aeea4385a41ec58318437bb36a7db5ede635f`
- `git rev-list --left-right --count origin/main...838aeea`：`0 27`
- 报告落盘前工作树：20 个 tracked 修改、171 个 untracked 文件
- 报告落盘前路径加内容指纹：
  `dceaf709e8e52f05396b9c229931ba81d56adfdfdc4802d942950a08b0e9e7a0`
- 快照稳定性：2026-07-29 12:59:17 与 12:59:32 两次计算一致；最后一个被评审文件的 mtime 为
  12:53:14。此前确有外部并发回修，本报告按该稳定后的最终内容复核。
- 物理切换现状：`../voice-coding` 是普通目录，`../voice-coding.archive-20260729` 不存在；
  这与 [MIGRATION.md](../../docs/plan/MIGRATION.md) 第 4 行声明的“待源目录切换”一致。
- 本次未启动 subagent，未提交、推送或执行目录切换。除本报告外，本评审未修改工作区文件。

## A 级发现

### A-1 最终迁移映射不可复验，文档还记录了错误的源清单 SHA

[fail] 当前两份清单与校验器不在同一代：

- [MIGRATION.md:32](../../docs/plan/MIGRATION.md#L32) 记录源清单 SHA 为
  `16ea7152dc50442e08c124d2543416f765fd05bd30bd9ec468adc40d22a742c5`，
  但当前文件实测为
  `4f195260f116d2e96dcafd3594080079c13e94ecee119f548d91cfb0747d274a`。
- [migrated-files.tsv:1](../../docs/plan/migration/migrated-files.tsv#L1) 仍是旧的 7 列格式，
  没有 source/target mode；[verify-design-migration.mjs:89](../../scripts/verify-design-migration.mjs#L89)
  到第 90 行已经生成 9 列新格式。
- 对旧清单逐项重算，161 个源文件均未漂移，但 35 个目标文件的 SHA/字节数已不同于清单。
- 真实复验输出：

```text
[ok] archive unchanged outside allowlist: 2087 entries
source_check_exit=0
[fail] migration manifest differs from current source/target
migration_check_exit=1
[fail] target change manifest differs from current worktree
target_change_check_exit=1
```

最后一个失败还说明 `target-change-manifest.mjs` 虽已新增，但对应 manifest 尚不存在。

影响：当前不能用仓内证据证明最终 161 个迁入目标的内容、字节数和 mode，也不能证明评审看到的工作树
就是准备切换的工作树。此时执行切换，会把“最终回修后重生成”留到破坏性操作之后。

最小修复：

1. 所有回修及本报告落盘后停止其他写者；
2. 用当前 9 列脚本重生成 `migrated-files.tsv`，更新 `MIGRATION.md` 中两份清单的真实 SHA、列定义和
   生成命令；
3. 生成并纳入 `target-change-manifest.tsv`，再分别执行三个 `check`，三个退出码必须都是 0；
4. 在切换前和切换后各保存一次完整原始输出，不只抄写结论。

### A-2 回滚清单漏掉 30 个 SayDo 侧路径，也没有恢复冷档原 README/AGENTS

[fail] [MIGRATION.md:117](../../docs/plan/MIGRATION.md#L117) 到第 125 行把 SayDo 侧回滚依据限定为
`migrated-files.tsv`；该文件只描述 161 个来自旧目录的 source→target 映射。本轮实际工作树有
191 个路径，实测结果为：

```text
changed_tracked=20
untracked=171
worktree_scope=191
migrated_targets_in_scope=161
uncovered_by_migrated_manifest=30
```

漏掉的 30 项包括根 `README.md`、`AGENTS.md`、`HANDOFF.md`，工程 ADR，e2e 证据，运行代码/测试，
四个迁移脚本和两份迁移清单。完整集合可由以下命令复现：

```bash
git diff --name-only -z 838aeea
git ls-files --others --exclude-standard -z
```

[target-change-manifest.mjs:34](../../scripts/target-change-manifest.mjs#L34) 到第 40 行已经具备覆盖这类
tracked/untracked 目标的雏形，但 `MIGRATION.md` 未引用它，仓内也没有它的产物。

此外，[freeze-design-archive.mjs:85](../../scripts/freeze-design-archive.mjs#L85) 到第 98 行会把源
README/AGENTS 改名为 `*.prearchive.md` 并写入冻结声明；回滚文档只说移除 symlink 后把 archive
改回 `voice-coding`，没有执行 `unfreeze`。照文档操作会得到一个名字恢复、入口文件仍是 tombstone
的旧目录，不是迁移前状态。

影响：所谓“回滚”既不能恢复 SayDo 基线，也不能恢复旧目录的活动入口原文；执行者可能在认为已经
回滚后继续使用半迁移状态。

最小修复：

- 把最终 target-change manifest 作为 SayDo 侧完整路径清单，区分 A/M/D，并明确基线恢复方式；
- 回滚顺序明确调用并校验 `freeze-design-archive.mjs unfreeze`，再做精确 symlink 移除和 archive
  复名；
- 在一次隔离副本演练中验证“切换→回滚”后：旧目录全量 manifest 与基线一致、SayDo 相对
  `838aeea` 只剩明确允许保留的评审/审计产物。

### A-3 原子切换与冻结没有形成可安全执行、可恢复、可复验的命令链

[fail] [MIGRATION.md:13](../../docs/plan/MIGRATION.md#L13) 到第 19 行只有操作叙述，没有精确的
preflight、冲突检查、`rename`、symlink 创建、冻结脚本调用、阶段状态判断或中途失败恢复命令。
第 40 至 48 行的两个复验命令也不能直接用于冻结后状态：

- 冻结会把 `README.md`、`AGENTS.md` 变成新内容，并新增
  `README.prearchive.md`、`AGENTS.prearchive.md`；
- [design-archive-manifest.mjs:60](../../scripts/design-archive-manifest.mjs#L60) 到第 64 行只有
  显式传入 allow-path 才会排除这些变化；
- `MIGRATION.md` 给出的命令没有传四个路径，因此冻结后的“全量 manifest 漂移检查”必然报红。

迁入校验器虽然在
[verify-design-migration.mjs:77](../../scripts/verify-design-migration.mjs#L77) 到第 86 行会在冻结后
暗中读取 `*.prearchive.md`，但输出仍在第 112 至 113 行把 `source_path` 写成 `README.md` /
`AGENTS.md`。独立审计者按 TSV 所列路径取文件时，读到的是 tombstone，而不是被摘要的物理文件。

安全约束也不足：

- [freeze-design-archive.mjs:21](../../scripts/freeze-design-archive.mjs#L21) 只检查 archive basename
  以 `voice-coding.archive-` 开头；
- 第 24 至 25 行只要求两个参数是目录，没有验证 archive 的预切换 manifest，也没有验证 target
  是 `SayDo` 的 Git 根和预期基线。

影响：输错一个同名前缀目录即可改写该目录的 README/AGENTS；切换中断时没有文档化状态机；按当前
文档跑 postcheck 会得到预期外失败，容易诱发临场跳过门禁或错误重生成源清单。

最小修复：

- 在 `MIGRATION.md` 写出唯一、可复制的状态机式命令链，至少覆盖：
  “旧目录存在且非 symlink、archive 不存在、SayDo Git 根/分支/基线正确、三个 manifest check
  通过”→“同卷 rename”→“冻结”→“创建并核验 symlink”→“四路径 allowlist 源复验”→“迁入/目标
  清单复验”；
- 冻结脚本绑定精确 archive basename/父目录、SayDo Git 根和清单身份；
- 映射清单增加 `source_on_disk_path`，使冻结后每一列都能被独立复算；
- 每个阶段写明可判定状态和对应恢复分支，拒绝覆盖已存在的 archive、symlink、backup 或
  frozen copy。

## B 级发现

### B-1 emoji 门禁从任意 cwd 可运行，但扫描器错误仍会假绿

[warn] 本轮新增的仓根锚定
[check-emoji.sh:8](../../scripts/check-emoji.sh#L8) 到第 9 行有效；然而第 17 和第 19 行把 `rg` stderr
丢弃，且没有传播 `rg`/`xargs` 的异常退出码。真实反例：

```text
PATH=/usr/bin:/bin bash scripts/check-emoji.sh
[ok] emoji gate: clean
no_rg_emoji_exit=0

bash scripts/check-emoji.sh __definitely_missing_file__
[ok] emoji gate: clean
missing_file_emoji_exit=0
```

这会让 [justfile:21](../../justfile#L21) 和 CI 在扫描器缺失、路径错误或文件不可读时仍显示
`[ok]`。

最小修复：显式检查 `rg`；区分 `rg` 的“无匹配”退出码 1 与真正错误；不要吞 stderr；让任一输入
路径不存在/不可读时失败；为“无 rg、缺失文件、不可读文件”补自测。

### B-2 迁入模板仍是 spike 前 ASR/TTS 口径，单仓模板无法配置当前运行实现

[warn] 路径已经修到仓内，但模板内容没有同步当前实现：

- [saydo.env.example:13](../../templates/saydo.env.example#L13) 仍要求 `VOLC_API_KEY`，第 14 行把
  `VOLC_APP_ID` 称为旧方案，且完全没有 `VOLC_ACCESS_TOKEN`；
- 实际 pipeline 在
  [__main__.py:43](../../pipeline/src/saydo_pipeline/__main__.py#L43) 到第 45 行只读取
  `VOLC_APP_ID + VOLC_ACCESS_TOKEN`，缺任一个就禁用 ASR；
- [saydo.config.example.toml:56](../../templates/saydo.config.example.toml#L56) 仍写“D4 待 spike”和
  `VOLC_API_KEY`；第 68 行以及
  [saydo.config.dev.example.toml:48](../../templates/saydo.config.dev.example.toml#L48) 仍默认
  `jitangmei`，而当前 adapter 缺省是
  [doubao_tts.py:91](../../pipeline/src/saydo_pipeline/doubao_tts.py#L91) 的 `tianmeiyueyue`。

现有模板测试
[config.test.ts:238](../../packages/daemon/test/config.test.ts#L238) 到第 255 行只验证 TOML 解析与模型
绑定，不会发现语音凭据和 voice 漂移。

影响：在只有 SayDo 的新环境按模板配置，会得到 TTS/ASR 说明与实际运行不一致，ASR 很可能静默
显示为 disabled。

最小修复：按工程 ADR-101 和 pipeline 现状更新三份模板；增加测试断言环境变量名、ASR 二元凭据与
当前默认音色，不只测 TOML 可解析。

### B-3 FTS 迁移回跑通过放宽 oracle 掩盖了真实回归

[warn] 基线
`838aeea:e2e/spikes/fts-d9/run.mjs:55` 对“产物库”的期望来源是
`["08", "modules/b"]`；当前
[run.mjs:55](../../e2e/spikes/fts-d9/run.mjs#L55) 扩成
`["02", "04", "05", "08", "modules/b"]`。当前记录的 top5 为：

```text
["05-roadmap.md","04-key-mechanisms.md","04-key-mechanisms.md",
 "02-product-definition.md","05-roadmap.md"]
recorded_hit=true
old_oracle_hit=false
baseline_oracle_total=19/20
```

[RESULT.md:9](../../e2e/spikes/fts-d9/RESULT.md#L9) 仍只报告 20/20，没有说明验收 oracle 被改变。

影响：迁移改变语料位置/段落后，本应暴露的召回退化被同时修改测试期望消掉，20/20 不能作为等价
迁移证据。

最小修复：恢复原 oracle 并调查排名变化；若产品语义确实允许新来源，应把 oracle 变更作为独立、
有理由和 before/after 数据的设计变更，不能混在迁移回跑中。

### B-4 当前唯一排产源在 canonical 内仍有两个旧计划权威指针

[warn] [docs/plan/README.md:7](../../docs/plan/README.md#L7) 与
[docs/05-roadmap.md:5](../../docs/05-roadmap.md#L5) 已明确
`IMPLEMENTATION-PLAN-2.md` 是当前排产/分期源；但：

- [docs/08-module-design.md:7](../../docs/08-module-design.md#L7)
- [docs/10-voice-ux-spec.md:5](../../docs/10-voice-ux-spec.md#L5)

仍把 `IMPLEMENTATION-PLAN.md` 称为分期裁决。旧计划又被
[docs/plan/README.md:13](../../docs/plan/README.md#L13) 明确定义为历史锁版。

影响：实施者按不同 canonical 入口会得到不同排产权威，形成计划双真相源。

最小修复：两处统一指向 PLAN-2；如果旧计划仍承担某段历史裁决，明确限定为“历史出处”，不得再写
当前裁决。

### B-5 单仓并行规则与唯一批次指针互相矛盾

[warn] [IMPLEMENTATION-PLAN-2.md:123](../../docs/plan/IMPLEMENTATION-PLAN-2.md#L123) 允许文件集不重叠
的合同轮和纯实现批并行，却要求每批开工都看到唯一 HANDOFF 指针为空；第 172 行再次要求单批生命周期
清空指针。与此同时，第 178 行明确排出 `W5 ∥ R-B ∥ A5-armed ∥ UI`。

[HANDOFF.md:21](../../HANDOFF.md#L21) 更明确写的是“实施仓单会话串行，非空就停”。单个标量既无法
登记多个合法并行批，也无法表达各自文件锁；照现协议，计划允许的并行永远无法开批。

影响：下一轮不是错误串行，就是绕过指针并重演本轮已经发生的并发写入风险。

最小修复：二选一并写成唯一规则：彻底单批串行；或把指针改为可容纳多个批次及显式文件面锁的登记表，
开批检查“无路径冲突”而不是“全局为空”。

### B-6 活动入口提前宣布切换完成，HANDOFF 仍混有旧双仓操作口径

[warn] 当前物理状态仍是“源目录待切换”，但：

- [README.md:6](../../README.md#L6) 已写“资产已统一到本仓”；
- [HANDOFF.md:8](../../HANDOFF.md#L8) 已写旧目录“仅为冻结冷档”；
- [IMPLEMENTATION-PLAN-2.md:130](../../docs/plan/IMPLEMENTATION-PLAN-2.md#L130) 已写“仓库合并已执行”。

真实检查却是：

```text
voice-coding=directory
archive=absent
```

而宣称自己是“单一真相”的 [HANDOFF.md:5](../../HANDOFF.md#L5) 仍在第 28、37、49 行使用“设计库
会话攒批/代跑/同步”的活动口径。

影响：在评审通过到原子切换之间，活动入口对当前状态作出错误陈述；后续会话也可能继续寻找一个被定义
为冷档的“设计库会话”。

最小修复：切换前统一标成“迁入已落盘、物理切换待完成”；只有 postcheck 全绿后再原子更新为“已
切换”。清理当前 HANDOFF/canonical 的活动措辞，但保留
[docs/plan/README.md:13](../../docs/plan/README.md#L13) 已明确锁版的历史 prompt 原文。

### B-7 research/history 索引指向不存在的迁前快照，history 自述也已过期

[warn] [research/README.md:3](../../research/README.md#L3) 和
[history/README.md:3](../../history/README.md#L3) 都指向 SayDo 中不存在的
`../archive/2026-07-22-pre-rewrite/`。该快照实际只计划保留在冷档。

[history/README.md:1](../../history/README.md#L1) 又把整个目录称为“只读”，第 7 行仍称 journal 只有
16 轮、截至 07-22；实际命令
`rg -c '^## R[0-9]+' history/PROCESS-JOURNAL.md` 返回 66，内容已到 R57，且存在重复 R54/R55 标题。
这也与 [MIGRATION.md:58](../../docs/plan/MIGRATION.md#L58) 的“journal 在本仓续写”冲突。

影响：证据/过程入口给出断链和错误维护规则，妨碍独立审计及后续轮次编号。

最小修复：索引改指 `docs/plan/MIGRATION.md` 中的冷档位置；明确“历史文件只读，但
PROCESS-JOURNAL 继续追加”；按真实现状更新轮次说明，并先处理重复轮次编号。

### B-8 清单脚本仍会静默忽略特殊文件，冻结后的映射也不够自描述

[warn] [design-archive-manifest.mjs:33](../../scripts/design-archive-manifest.mjs#L33) 到第 46 行只处理
directory、symlink、regular file，没有 `else` 拒绝 FIFO/socket/device 等类型。当前源目录实测
特殊项为 0，所以本轮没有因此漏数据；但在目录仍活动的切换窗口里新出现特殊项时，`check` 会静默
忽略并继续报 `[ok]`。

此外，前述 `verify-design-migration.mjs` 会把冻结后的物理
`README.prearchive.md`/`AGENTS.prearchive.md` 伪装成逻辑 `README.md`/`AGENTS.md` 写入 TSV。

影响：门禁不能证明“所有路径类型均已看见”，映射也不能仅凭 TSV 独立复算。

最小修复：manifest walker 对不支持的类型立即失败，并选择是否记录目录及目录 mode；迁入 TSV 同时
记录逻辑源路径和实际取摘要的物理源路径。

## C 级发现

### C-1 ADR 双序列规则已建立，但裸编号和索引路径尚未清干净

[warn] [docs/adr/README.md:3](../../docs/adr/README.md#L3) 要求每次引用都写“设计/工程”，但活动文档
仍有多处裸 `ADR-101`，例如
[HANDOFF.md:25](../../HANDOFF.md#L25)、
[docs/07-tech-stack-decisions.md:71](../../docs/07-tech-stack-decisions.md#L71) 和
[docs/09-data-contracts.md:850](../../docs/09-data-contracts.md#L850)。
索引第 9 行在设计 ADR 表内也只写文件名 `ADR-001-execution-layer.md`，没有写
`design/ADR-001-execution-layer.md`。

当前编号尚能靠上下文判定，不构成阻断；建议按新规则清理活动入口和 canonical，历史证据不必机械
改写。

### C-2 迁入文本保留了较多本机绝对路径，应明确公开仓隐私取舍

[warn] 对 tracked+untracked 文本扫描，52 个文件包含 `/Users/wangyixiao`，主要分布在
research、prompts 和 docs。未发现高置信密钥，但公开仓会暴露用户名和本机目录结构。

最小建议：历史证据若需保持原貌，在迁移说明中明确接受该披露；活动 README/HANDOFF/命令尽量改用
仓根相对路径或占位符。不要为了美观批量改写历史原始证据。

## 已核验无问题

- [ok] 源快照当前可完整分箱。对 2,087 项、181,286,599 bytes 的源清单与
  `migrated-files.tsv` 做集合分区，结果为：

```text
migrated          161    14430700
logs               15    53817561
codex_logs          26    51986019
node_modules      1807    37364723
archive_snapshot    46    23221148
docs_backup         18      411850
playwright          13       48450
ds_store             1        6148
unknown              0           0
```

- [ok] 当前源清单的 2,087 项全为普通文件；mode 分布为 2,081 个 `0644`、6 个 `0755`；源目录
  symlink 0、特殊类型 0。源 `check` 退出 0。
- [ok] 161 个映射 source/target 路径均唯一；源文件对旧清单漂移为 0。按物理文件实测 mode，
  159 项 `0644→0644`、2 项 `0755→0755`，mode mismatch 为 0。
- [ok] 源清单分区数字与 [MIGRATION.md:29](../../docs/plan/MIGRATION.md#L29) 到第 35 行及第 90 至
  95 行的数量/字节相符；未发现某个现有普通文件落在迁入或冷档分类之外。
- [ok] 运行代码、测试、spike、smoke、scripts 和 templates 中没有旧 sibling 路径。真实输出：

```text
[ok] no sibling voice-coding path in runtime/test/spike/template scope
template_default=/Users/wangyixiao/WorkSpace/SayDo/templates exists=true
fts_default=/Users/wangyixiao/WorkSpace/SayDo/docs exists=true
```

- [ok] 两份 TOML 模板与四份相关 JSON 均可解析；这里仅证明语法，B-2 所述语义问题仍存在。
- [ok] knowledge 活动指针为 `.saydo/knowledge/current -> gen-2`，`current/core.md` 存在且其
  [第 16 至 29 行](../../.saydo/knowledge/current/core.md#L16) 已吸收单仓规则。旧的 flat
  `knowledge/core.md` 仍是 generation 1，但当前 AGENTS 指向
  [AGENTS.md:88](../../AGENTS.md#L88) 的 `current/core.md`，未发现运行消费者回退旧 flat 文件。
- [ok] `git diff --check 838aeea --` 退出 0；四个迁移脚本和 FTS 脚本的 `node --check` 退出 0；
  两个 shell 脚本 `bash -n` 退出 0。`git diff --check` 不覆盖 untracked 文件，不能替代最终
  暂存集检查。
- [ok] 用当前可用 `rg` 显式扫描 tracked+untracked 范围时 emoji 门禁退出 0；B-1 是错误路径的
  fail-open，不是已发现禁用字符。
- [ok] 536 个文本文件的高置信密钥模式扫描命中 0；untracked 路径没有
  `node_modules`、日志、`.venv`、playwright 缓存、coverage、私钥后缀或 `.DS_Store`。
- [ok] 13 个迁入资产均被 `file` 识别为 PNG，共 11,622,824 bytes，单文件最大 1,585,642 bytes；
  未发现不应入 Git 的异常大依赖缓存。
- [ok] untracked symlink 为 0，未发现迁入侧 symlink 指向仓外。
- [ok] `docs/plan/README.md` 已把旧 `IMPLEMENTATION-PLAN.md` 与 `IMPL-PROMPT*.md` 定义为历史锁版；
  这些文件内的旧绝对路径属于追溯材料，不应被当作当前运行依赖，也不建议机械改写。
- [ok] 设计 ADR 搬到 `docs/adr/design/` 后，其到 history、research 和 `docs/09` 的三处相对路径
  均可解析到现有文件。

## 仍需最终执行后复核

以下项目当前没有通过证据，不能把旧轮次记录的结果外推到本工作树：

1. [fail] 完成三项 A 级回修后，重生成 source、migration、target-change 三份最终 manifest；
   更新文档中的真实 SHA、条目数、字节数、mode 口径，并让三个 `check` 都退出 0。
2. [fail] 在隔离副本演练一次完整“切换→postcheck→回滚→全量摘要复原”；当前冻结/解冻脚本只做了
   静态语法和代码检查，没有运行态证据。
3. [fail] 执行并记录 `just ci` 的 node/python 双矩阵。本评审遵守“除报告外不修改文件”的只读
   限制，没有运行可能写 `.venv`、缓存或测试产物的完整 CI。
4. [fail] 在不挂载相邻 `voice-coding` 的隔离副本中运行模板测试、关键 daemon/pipeline 测试和
   启动 smoke，证明没有由环境残留掩盖的 sibling 依赖。
5. [fail] 修复 emoji gate 的 fail-open 后，复跑 tracked、完整暂存集、缺失文件、不可读文件和
   无 `rg` 五类用例；最终门禁必须对扫描错误报 `[fail]`。
6. [fail] 对全部新增 Markdown 做可靠的相对链接检查；特别核验 research/history 冷档指针和 ADR
   双序列索引。本评审的轻量正则检查会把复杂表格语法误识别为链接，不能充当最终证据。
7. [fail] 两份 Demo 做本机 headless Chrome 截图并人工检查首屏、路由、字体降级和 console error。
   本评审尝试只读浏览器加载本地 `file://` 页面时被浏览器 URL 策略拒绝，没有形成视觉通过证据。
8. [fail] 重新运行 FTS batch1，按未放宽的基线 oracle 解释“产物库”回归；若决定改 oracle，补独立
   设计依据和 before/after 记录。
9. [fail] 按 [MIGRATION.md:82](../../docs/plan/MIGRATION.md#L82) 重建 `.saydo/knowledge`，核验
   generation、repoHead、`current` symlink、core/conventions/inventory 与根 AGENTS 指针一致。
   当前 `current/conventions.md` 第 92 行仍嵌有 generation 1 的旧 flat 指针。
10. [fail] 真正执行切换后，核验旧路径是精确指向 SayDo 的 symlink、archive 是普通目录、四个冻结
    路径与 allowlist 一致、冷档其余 2,087 项无漂移；随后才把 README/HANDOFF/PLAN-2 的状态改成
    “已执行”。
11. [fail] 最终 `git status`、暂存集和目标清单逐路径对账；确认本地 `*.log` 仍被忽略，提交集不含
    日志、缓存、真实 `.env` 或本机运行状态。不要使用 `git add -A` 代替明确 pathspec。

## 收口判定

[fail] 当前不能执行原目录归档与兼容 symlink 切换。先修 A-1、A-2、A-3，再处理 B-1、B-2、
B-3、B-4、B-5、B-6 这些会直接影响门禁、单仓运行或下一批开工的事项；其余 B/C 可在不破坏证据
原貌的前提下同轮收敛。所有最终执行项有真实退出码和文件摘要后，再进行一次短复核。
