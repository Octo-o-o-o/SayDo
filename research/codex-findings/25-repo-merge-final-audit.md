# Codex 25 · SayDo 单仓迁移第二轮终验

> 审计日期：2026-07-29
> 审计根：`~/WorkSpace/SayDo`
> 审计角色：独立对抗性审查；不采信 MIGRATION、journal、Codex 24 或 subagent 自报
> 写入边界：真实仓只写本报告；未 commit、push、pull、rebase、reset、clean、删除、解冻或改动真实
> archive/symlink；所有破坏性演练均在 `/private/tmp` 完成
> 最终结论：**No-Go**

## 0. 结论先行

物理切换和冻结源库存本身是完整的：旧路径是精确指向 SayDo 的 symlink，archive 是普通目录；源
2087 项、181,286,599 bytes、SHA-256/type/mode 可全部复算，冻结四路径外 2085 项无漂移；161
条迁移路径唯一，源侧和 frozen manifest 自洽；冷档分箱 `unknown=0`。

但当前状态不能交付，原因不是表达问题，而是五项 A 级：

1. 审计起点并未保持冻结。本轮审计开始时 target-change 已因
   `prompts/25-repo-merge-final-audit.md` 漏项而失败；审计过程中又有本审查进程之外的并发写入，
   多次改动迁移脚本、canonical、模板、测试和证据。最终观察点的 migration check 与
   target-change check 均为红。
2. frozen target-change 只有 195 条；最终报告写入前实际应覆盖 200 条，报告落盘后是 201 条
   （均不含清单自身），且有 22 条已登记路径的摘要/mode 元数据漂移。按 frozen 清单在隔离副本
   回滚 195 条并另删清单自身后，最终仍留下 6 个 A/M 路径，不能回到基线。
3. frozen target manifest 锁定的 freeze 脚本在自身 `unfreeze` 中断后不能续跑；另一个部分
   freeze + mode 漂移场景会先接受错误状态，再形成无法解冻的状态。当前工作树后来修补了这两点，
   但修补没有重建 migration/target 清单，不能作为已关闭证据。
4. frozen MIGRATION 的 S1→S2 链在错误 symlink 已存在时，先冻结 archive，再由 `ln -s`
   跟随 symlink-to-directory 修改错误目录，最后才在 postcheck 失败。当前文档后来补了修改前断言，
   同样未进入稳定清单。
5. 当前 target-change 工具仍看不见 untracked FIFO。故障注入时 Git 枚举为 0 条，工具写清单和
   check 都返回 0；这违反“特殊类型修改前拒绝”，也意味着清单可静默漏项。

当前无 sibling 隔离快照的最新 `just ci` 是绿的，不能抵消上述事实：质量门绿只证明该时点代码测试
通过，不证明迁移库存闭合或回滚完备。

## 1. 审计坐标与移动目标

### 1.1 冻结坐标亲测

执行：

```bash
pwd
pwd -P
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
stat -f '%HT|%Sp|%z|%N' \
  ~/WorkSpace/voice-coding \
  ~/WorkSpace/voice-coding.archive-20260729
readlink ~/WorkSpace/voice-coding
realpath ~/WorkSpace/voice-coding
```

原始输出摘录：

```text
pwd_logical=~/WorkSpace/voice-coding
pwd_physical=~/WorkSpace/SayDo
git_root=~/WorkSpace/SayDo
branch=codex/merge-voice-coding-20260729
head=838aeea4385a41ec58318437bb36a7db5ede635f
Symbolic Link|lrwxr-xr-x|33|~/WorkSpace/voice-coding
Directory|drwxr-xr-x|992|~/WorkSpace/voice-coding.archive-20260729
compat_readlink=~/WorkSpace/SayDo
compat_realpath=~/WorkSpace/SayDo
```

`pwd` 仍显示旧逻辑路径，是 shell 会话从 symlink 入口继承的结果；`pwd -P` 与 Git 根均为 SayDo，
没有第二个活动 Git 根。

三份清单当前文件的 SHA-256 仍与 owner 给定值完全一致：

```text
4f195260f116d2e96dcafd3594080079c13e94ecee119f548d91cfb0747d274a  source-prearchive-manifest.tsv
d3642de4d6e7adf4dd0c753c26b5a4a1159d457a38fe44e78ca70aaf337d55bb  migrated-files.tsv
eb4c76664c7fe1cc9e290f59a0a679778a327250715750eb40170494ff025a5a  target-change-manifest.tsv
```

### 1.2 审计对象在审计期间继续变化

这不是根据 journal 推断，而是同一会话内对真实文件的多次 hash/stat：

| 时点 | `scripts/freeze-design-archive.mjs` SHA-256 | 状态 |
|---|---|---|
| frozen target 清单 | `4cce1305939a06820993e776619d8756d7e146b02bfc5dc0c4359dd6d5491823` | `target-change-manifest.tsv:190` 锁定，7440 bytes |
| 15:44 左右 | `7bb4eaabb06fb812391c4595924ff890f6217f82be1ea4da6ca518088ccd1a99` | 中间修订，存在未定义 `freezeAllowlist`，运行到 precheck 后抛 `ReferenceError` |
| 16:53 观测 | `3157453ceb94bb3025edcd7340a4a350b2790852dc355f1b21ffe333592c01ea` | 已修中断恢复，但还不检查 branch |
| 16:55 后当前 | `e9014237da5f145bd8ea0237339d2a933ed2be7d5c23d4a6e609823a910b890f` | 又补 branch 检查，8587 bytes |

当前脚本的 branch 约束见
`scripts/freeze-design-archive.mjs:28`、`:77-84`；当前状态转换见 `:192-229`。这些后续改动本身有
价值，但 frozen target 清单仍锁定旧 hash，且两个内容清单 check 已红，不能把“文件现在看起来修了”
写成“冻结迁移已通过”。

同一移动目标还造成两次 CI 结论变化：

```text
第一次隔离 just ci:
Test Files  1 failed | 65 passed | 2 skipped (68)
Tests       1 failed | 686 passed | 4 skipped (691)
失败: packages/daemon/test/memory-foundation.test.ts:120
      expect(readFileSync(legacy)).toBe(readFileSync(current))

外部修订把 toBe 改为 toStrictEqual 后，重新覆盖同一无 sibling 快照:
Test Files  66 passed | 2 skipped (68)
Tests       687 passed | 4 skipped (691)
[ok] just ci: node + python matrices green
```

最终报告写入前的真实 Git 计数：

```text
tracked_index=399
changed_tracked=26
untracked=175
cached_count=0
candidate_files=574
origin/main...HEAD=0  27
```

这里的 `origin/main` 只是本地已有 remote-tracking ref；本审查未 fetch/pull，不能外推远端服务器实时
状态。HEAD 从始至终保持给定基线，本审查没有 commit 或 push。

## 2. A 级发现

### A-1：migration 与 target-change 已不描述当前工作树

最终观察点亲跑三个 check：

```bash
node scripts/design-archive-manifest.mjs check \
  ~/WorkSpace/voice-coding.archive-20260729 \
  docs/plan/migration/source-prearchive-manifest.tsv \
  AGENTS.md README.md AGENTS.prearchive.md README.prearchive.md

node scripts/verify-design-migration.mjs check \
  ~/WorkSpace/voice-coding.archive-20260729 \
  ~/WorkSpace/SayDo \
  docs/plan/migration/migrated-files.tsv

node scripts/target-change-manifest.mjs check \
  ~/WorkSpace/SayDo \
  838aeea4385a41ec58318437bb36a7db5ede635f \
  docs/plan/migration/target-change-manifest.tsv
```

输出：

```text
[ok] archive unchanged outside allowlist: 2085 entries
[fail] migration manifest differs from current source/target
[fail] target change manifest differs from current worktree
```

独立重算 migration 的 161 个路径集合仍相同，但 10 个 target 摘要/bytes/mode 行已漂移：

```text
demo/saydo-console-demo-atelier.html
demo/saydo-console-demo.html
docs/08-module-design.md
docs/09-data-contracts.md
docs/11-ui-spec.md
docs/plan/REPO-MERGE-PROPOSAL.md
research/business-flows.html
templates/saydo.config.dev.example.toml
templates/saydo.config.example.toml
templates/saydo.env.example
```

独立重算 target-change（按 `HEAD` 对工作树，排除清单自身）：

```text
frozen: rows=195, A=172, M=23, D=0
current: rows=200, A=174, M=26, D=0
only-current=5
metadata-drift=22
```

报告写入前 5 个完全漏项是：

```text
.github/workflows/ci.yml
e2e/spikes/fts-d9/spike-output-batch2.json
justfile
prompts/25-repo-merge-final-audit.md
scripts/test-migration-tools.sh
```

22 个已登记但元数据漂移的路径包括 `AGENTS.md`、两份 Demo、`docs/08`、`docs/09`、`docs/11`、
`docs/plan/MIGRATION.md`、FTS 三件、foundation 代码/测试、emoji 脚本、freeze/target-change
脚本和三份模板。本报告写入后，实际 target scope 为 201（A=175、M=26），第 6 个漏项是
`research/codex-findings/25-repo-merge-final-audit.md`。

影响：迁移映射的内容证明已失效，SayDo 侧全量回滚集合也不再闭合。按题目分级，这是“清单漏项”
和“不可完整回滚”，为 A。

### A-2：按 frozen target-change 实际回滚后仍残留 6 项

在 `/private/tmp/saydo-rollback-25.8752b2/SayDo` 创建基线 clone，覆盖报告写入前 574 个候选文件；
逐行执行 frozen target 的 195 个 A/M/D，并按 MIGRATION 说明另行移除 target manifest 自身。输出：

```text
{"appliedRows":195,"manifestSelfRemoved":true}
remaining_paths=5
 M .github/workflows/ci.yml
 M e2e/spikes/fts-d9/spike-output-batch2.json
 M justfile
?? prompts/25-repo-merge-final-audit.md
?? scripts/test-migration-tools.sh
head=838aeea4385a41ec58318437bb36a7db5ede635f
```

这不是“清单 check 因审计报告自然变红”的形式问题：报告写入前，即使显式处理清单自身，仍有
3 个 tracked M 和 2 个 untracked A 留在 SayDo。本报告再覆盖进同一已回滚隔离副本后：

```text
remaining_paths_after_report=6
 M .github/workflows/ci.yml
 M e2e/spikes/fts-d9/spike-output-batch2.json
 M justfile
?? prompts/25-repo-merge-final-audit.md
?? research/codex-findings/25-repo-merge-final-audit.md
?? scripts/test-migration-tools.sh
```

故 `docs/plan/MIGRATION.md:272-284` 所述 SayDo 回滚策略在最终工作树上不能恢复基线。

### A-3：frozen freeze 状态机不能完整恢复自身中断

frozen target 清单锁定的脚本是
`target-change-manifest.tsv:190` 的 `4cce1305...`。在完整 archive 隔离副本中：

1. 普通 freeze、重复 freeze、普通 unfreeze、重复 unfreeze均可收敛。
2. freeze 在 `AGENTS.md -> AGENTS.prearchive.md` 后、写 tombstone 前中断，再跑 freeze 可收敛。
3. unfreeze 在 `AGENTS.md -> AGENTS.frozen.md` 后、backup 复名之前中断，再跑 unfreeze 和反向
   freeze 均失败：

```text
[fail] archive drift detected
rerun_unfreeze_rc=1
rerun_freeze_rc=1
```

4. 从 frozen 状态人为把 README 恢复成“尚未处理”的 original、令 mode 为 `0600`，再跑 frozen
   freeze 脚本时返回 0；它把错误 mode 的文件变成 `README.prearchive.md`。随后 unfreeze：

```text
[fail] 冻结原文备份与源清单不符
unfreeze_rc=1
```

这个状态必须人工在隔离副本修 mode 才能恢复。修复后再用 source manifest 全量核验，2087 项
SHA/bytes/type/mode 恢复为 0 mismatch，说明演练没有掩盖数据损坏。

当前 `e9014237...` 修订在相同隔离副本中已经做到：

```text
interrupted_unfreeze_resume_rc=0
mode_drift_rc=1
state_before=<digest>
state_after=<same digest>
unchanged=yes
[ok] archive unchanged outside allowlist: 2087 entries
```

当前修订还会在错误 branch 修改前拒绝：

```text
Error: SayDo 不在迁移专用分支:audit-wrong-branch-25
freeze_rc=1
[ok] archive unchanged outside allowlist: 2087 entries
```

但该修订发生在审计中，未进入 frozen target/migration 证明，不能 retroactively 关闭 frozen
版本的 A。

### A-4：frozen S1→S2 链会先修改错误目标，再在 postcheck 失败

frozen MIGRATION 的 hash 由 `target-change-manifest.tsv:49` 锁定为
`06067dbcdb7b0499a27de2f4865e672a990835f7a82fbd43ff32b7e195c23b18`。该版本在 S1→S2 中先运行
freeze，随后直接：

```bash
ln -s "$migration_target" "$migration_source"
```

隔离故障注入把 `migration_source` 预置为指向错误目录的 symlink。macOS 的 `ln -s target
symlink-to-directory` 会跟随该目录链接并在错误目录内创建新链接。实测：

```text
freeze_rc=0
ln_rc=0
source_readlink=<wrong-destination>
wrong-destination/SayDo -> <temp>/SayDo
postcheck_rc=1
```

此时 archive 已被冻结，错误目录也已被修改，违反“危险情况修改前拒绝”。当前
`docs/plan/MIGRATION.md:154-155` 已在 freeze 前同时检查 `! -e` 与 `! -L`，并把 rollback 的
unfreeze/全量 check 移到 unlink 兼容入口之前（`:236-262`）；这是正确方向，但同样属于未入清单的
审计中修订。

### A-5：target-change 对 untracked FIFO 静默漏项

当前工具的候选路径完全来自：

- `git diff --name-only`；
- `git ls-files --others --exclude-standard`。

代码见 `scripts/target-change-manifest.mjs:40-47`。`lstat`/特殊类型拒绝只在路径已被 Git 枚举后才
执行，见 `:59-77`。

在隔离 Git 仓创建一个 FIFO、一个 dangling symlink、一个指向 `/private/tmp` 的 symlink：

```text
git_fifo_entries=0
git_dangling_entries=1
[ok] target change manifest: 170 paths
... audit-dangling-link-25 ... L ...
... audit-outside-link-25 ... L ...
[ok] target change manifest verified: 170 paths
```

FIFO 没有进入清单，write/check 仍为 0；指向仓外的 symlink 也只被记录，没有边界拒绝。真实候选
575 项当前均为普通文件、没有 symlink/FIFO，所以这不是断言真实仓“已有 FIFO”；问题是安全工具
无法兑现题目要求的特殊类型 fail-fast，未来出现此类节点时会形成不可见回滚漏项。

## 3. B/C 级发现

### B-1：emoji 默认门禁排除所有 `.lock` 文本

`scripts/check-emoji.sh:13-15` 把 `.lock` 无条件列入 `BIN_RE`；默认 cached+untracked 枚举本身是
正确的，见 `:31-37`，缺 `rg`、文件缺失/不可读和 scanner 异常也均 fail-closed。

但 `pipeline/uv.lock` 是 461,433 bytes 的 UTF-8 文本。隔离注入一个含禁字符的 `fixture.lock`：

```text
[ok] emoji gate: clean
gate_rc=0
independent_rg_rc=0
```

即门禁放行，而独立 `rg` 命中。当前全 575 候选的独立内容扫描结果仍是：

```text
candidate=575
text=541
binary=34
forbiddenHits=0
```

因此当前仓没有实际禁字符，但质量门存在可复现覆盖洞，列 B。

### B-2：知识底座指针是 generation 4，兼容根文件仍停在 generation 1

一致的部分：

```text
.saydo/knowledge/current -> gen-4
.saydo/foundation/current.json={"generation":4,"manifest":"manifest-gen-4.json"}
AGENTS.md 指针=generation 4
current/{core,inventory,conventions,build-test-run} 与 gen-4 逐文件 cmp=0
inner Git branch=main
inner Git HEAD=8e55c10d6e913208929da7aac08517eb6453df7f
inner Git status="## main"
```

不一致的部分：`.saydo/knowledge/{core,inventory,conventions,build-test-run}.md` 都是普通文件而非
`current/...` symlink，且 4 个 `cmp` 均返回 1；其中
`.saydo/knowledge/core.md:1` 明写 generation 1，而
`.saydo/knowledge/current/core.md:1` 明写 generation 4。当前 foundation 代码和新测试已经要求下一次
bootstrap 把这些 regular files 升级为 compatibility symlink，但真实知识目录尚未迁移。

generation 4 manifest 也不是对当前关键文件的闭合证明：

```text
manifest AGENTS.md: bytes=5448, sha256=9ad3ebec...
actual   AGENTS.md: bytes=5531, sha256=6c0bee07...
manifest justfile:  bytes=1121, sha256=f891a4fb...
actual   justfile:  bytes=1162, sha256=39526680...
```

`packages/daemon/src/memory/foundation.ts:189-193` 先 hash AGENTS，`:217` 发布 generation，
`:220-221` 才回写 AGENTS pointer；generation 变化时，这个顺序天然使 manifest 记录旧指针内容。

`572` 的算术可解释为 frozen 时点的“最终候选集合”：

```text
399 个已跟踪 + target A 172 + target manifest 自身 1 = 572
```

但 `.saydo/knowledge/current/inventory.md:3` 写的是“Git 索引文件:572”，真实 Git index 是 399；
当前最终候选已是 575。故“572 是当时最终候选数”成立，“572 是当前实际 Git index”不成立。

### B-3：frozen 配置模板暗示了 pipeline 不消费的配置面

frozen migration manifest 对应的模板曾包含：

```toml
[secrets]
doubao_tts = "env:DOUBAO_TTS_API_KEY"
volc_app_id = "env:VOLC_APP_ID"
volc_access_token = "env:VOLC_ACCESS_TOKEN"

[voice.tts]
provider = "doubao"
endpoint = "wss://openspeech.bytedance.com/api/v3/tts/bidirection"
resource_id = "seed-tts-2.0"
model = "seed-tts-2.0-expressive"
voice = "zh_female_tianmeiyueyue_uranus_bigtts"
api_key = "env:DOUBAO_TTS_API_KEY"
sample_rate = 24000
```

数值与实现默认值一致，但 `pipeline/src/saydo_pipeline/__main__.py:41-45` 只读
`DOUBAO_TTS_API_KEY`、`VOLC_APP_ID`、`VOLC_ACCESS_TOKEN`；TTS endpoint/resource/model/voice/rate 是
`doubao_tts.py:86-100` 的构造默认值，pipeline 不读取 config TOML。frozen 模板因此误导使用者以为
修改 `[voice.tts]` 会生效。

当前工作树已把两个 TOML 改为 `[voice] engine/asr/tts`，并在
`templates/saydo.config.example.toml:51-58` 明说 pipeline 直接读 env、详细值是实现定档值；两个
模板 `tomllib` 解析成功，daemon `config.test.ts` 27 例通过。这个 live 修订解决语义问题，但正是
migration manifest 10 条漂移中的三份模板之一，未形成稳定迁移证据。

### B-4：工具层不是完整的“精确路径 + symlink 边界”策略

当前 freeze 已检查 basename、同父目录、普通目录、Git 根、branch、HEAD、基线祖先和 source
manifest identity，明显强于 frozen 版本，见 `scripts/freeze-design-archive.mjs:23-96`。但它没有
绑定 owner 给定的两个绝对路径；任意同父目录下名为 `SayDo` 与
`voice-coding.archive-20260729` 的基线 clone 均可执行。这有利于隔离测试，却不是“只接受真实迁移
坐标”的工具合同，应通过显式测试模式或允许根参数区分。

另外，target-change 对指向仓外的 symlink 只记录 link bytes，不检查 resolved target 是否越界；
其 write 模式也不绑定迁移 branch。真实候选当前没有 symlink，因此不升 A，但工具合同仍有 B 级
边界缺口。

### C-1：HANDOFF 仍有三处裸 `ADR-002`

`docs/adr/README.md:3` 明确两套编号序列，引用必须写“设计”或“工程”。但：

- `HANDOFF.md:39` 标题和正文各有裸 `ADR-002`；
- `HANDOFF.md:41` 写“ADR-002 收窄”；
- `HANDOFF.md:67` 写“ADR-002 的实测依据”。

上下文可推断为工程 ADR-002，不会改变实现，列 C。R58 在
`history/PROCESS-JOURNAL.md:858` 写“C1 裸 ADR 清理”，因此该表述也略有过度。

## 4. 物理切换、库存与三份清单

### 4.1 源 2087 项独立复算

没有以 source manifest 自己的总数字作为结论。主审解析每一行，并从真实 archive 重新
`lstat/readFile/readlink/SHA-256`；逻辑 `AGENTS.md`/`README.md` 分别映射到冻结后的
`AGENTS.prearchive.md`/`README.prearchive.md`。结果：

```json
{
  "manifestEntries": 2087,
  "physicalLeaves": 2089,
  "logicalVerified": 2087,
  "mismatchCount": 0,
  "extraPhysical": ["AGENTS.md", "README.md"]
}
```

2089 个物理叶子比逻辑源多 2 个，正好是两个 tombstone；两份 `*.prearchive.md` 代替源清单里的
原 `AGENTS.md`/`README.md`。四个顶层文件均为 mode 0644 普通文件：

```text
AGENTS.md             397 bytes
AGENTS.prearchive.md 2348 bytes
README.md             375 bytes
README.prearchive.md 7297 bytes
```

源清单独立聚合：

```json
{
  "entries": 2087,
  "bytes": 181286599,
  "types": {"F": 2087},
  "modes": {"0644": 2081, "0755": 6},
  "duplicatePaths": 0
}
```

`design-archive-manifest.mjs` 的 walker 对普通文件、symlink 和 mode 都有明确记录，对特殊类型抛错，
见 `scripts/design-archive-manifest.mjs:33-47`；allowlist 是按精确逻辑路径过滤，见 `:62-72`。
真实 frozen archive 的最终 check 为：

```text
[ok] archive unchanged outside allowlist: 2085 entries
```

### 4.2 冷档分箱覆盖全部源项

分箱不是看目录数量抽样，而是把每个 source manifest 路径放入互斥集合：

| 分箱 | 项数 | bytes |
|---|---:|---:|
| migrated | 161 | 14,430,700 |
| logs | 15 | 53,817,561 |
| codex_logs | 26 | 51,986,019 |
| node_modules | 1807 | 37,364,723 |
| archive_snapshot | 46 | 23,221,148 |
| docs_backup | 18 | 411,850 |
| playwright | 13 | 48,450 |
| ds_store | 1 | 6,148 |
| unknown | 0 | 0 |
| 合计 | 2087 | 181,286,599 |

集合求和与源清单完全相同；`migrated` 与冷档无重复、无遗漏。

### 4.3 161 映射的 frozen 清单形状

独立解析 `migrated-files.tsv`：

```json
{
  "rows": 161,
  "sourceUnique": 161,
  "diskUnique": 161,
  "targetUnique": 161,
  "sourceBytes": 14430700,
  "targetBytes": 14435555,
  "contentMode": {"byte-identical": 87, "transformed": 74},
  "modes": {"0644->0644": 159, "0755->0755": 2}
}
```

唯一 physical fallback 恰为两条：

```text
AGENTS.md -> AGENTS.prearchive.md
  -> docs/plan/migration/voice-coding-AGENTS.prearchive.md
README.md -> README.prearchive.md
  -> docs/plan/migration/voice-coding-README.prearchive.md
```

审计开始时（并发修订发生前）migration check 为：

```text
[ok] migration mapping verified: 161 files
```

最终观察点仍是 161 条且路径集合不变，但 10 个 target 元数据已变，所以最终 check 为 1。不能把
“映射集合仍唯一”外推为“内容仍与 frozen 清单一致”。

### 4.4 frozen target 清单与当前候选

frozen 195 行本身的静态形状：

```json
{
  "rows": 195,
  "status": {"M": 23, "A": 172},
  "targetType": {"F": 195},
  "targetMode": {"0644": 188, "0755": 7},
  "symlinks": [],
  "unsafe": [],
  "suspiciousDependencyLogCachePaths": [],
  "atLeast5MiB": [],
  "maxBytes": 1585642
}
```

即 frozen 版本没有 D、越界 path、symlink、依赖/日志/缓存误入或异常大文件。问题是覆盖范围和
摘要已经过时，不是 frozen TSV 内部格式错误。

报告写入前 574 候选、报告写入后 575 候选全部为普通文件；大于等于 1 MiB 只有：

```text
1,585,642 assets/brand/saydo-vertical-poster-v1.png
1,423,670 assets/brand/saydo-social-cover-v1.png
1,146,124 assets/brand/saydo-hero-v1.png
```

没有候选 symlink、FIFO、socket、device、private-key 文件名、`node_modules/`、`.venv/`、cache、
log 或 `.log` 路径。

## 5. 切换、冻结与回滚安全演练

完整 source archive 被 clone 到 `/private/tmp/saydo-final-audit.e2N1Jl/`；演练目标是基线 Git clone，
真实 archive/symlink 从未被写。

### 5.1 故障矩阵

| 场景 | frozen 版本结果 | 当前 live 修订结果 | 判定 |
|---|---|---|---|
| 正常 freeze→重复 freeze | 0 / 0 | 0 / 0 | 可幂等 |
| 正常 unfreeze→重复 unfreeze | 0 / 0 | 0 / 0 | 可幂等 |
| freeze 在 rename 后中断 | 重跑收敛 | 重跑收敛 | [ok] |
| unfreeze 在 active→frozen 后中断 | unfreeze/freeze 均 1 | 重跑 unfreeze=0 | frozen A，live 已补 |
| 部分 freeze + 未处理 original mode 漂移 | freeze=0，后续 unfreeze=1 | freeze=1，状态 digest 不变 | frozen A，live 已补 |
| backup mode 漂移 | 修改前拒绝 | 修改前拒绝 | [ok] |
| backup 内容漂移 | 修改前拒绝 | 修改前拒绝 | [ok] |
| tombstone 内容/mode 漂移 | 修改前拒绝 | 修改前拒绝 | [ok] |
| source manifest identity 错误 | 修改前拒绝 | 修改前拒绝 | [ok] |
| archive 普通文件漂移 | 修改前拒绝 | 修改前拒绝 | [ok] |
| source archive 注入 FIFO | walker 抛错，未生成 backup | 同 | [ok] |
| target basename/Git 根/HEAD 错误 | 修改前拒绝 | 修改前拒绝 | [ok] |
| branch 错误 | frozen 接受 | 当前 `e901...` 修改前拒绝 | frozen 缺口已补但未锚定 |
| 已有错误 source symlink | frozen 链先改 archive/错误目录 | 当前 MIGRATION precheck 拒绝 | frozen A，live 已补 |
| target untracked FIFO | target 工具静默漏项 | 仍静默漏项 | A-5 未修 |
| target dangling symlink | frozen 工具按不存在处理 | 当前记录为 `L` | live 已补 |

### 5.2 源侧完整回滚证明

当前修订在隔离副本完成 freeze/unfreeze 后，重新按 source manifest 对全部 2087 项计算：

```text
[ok] archive unchanged outside allowlist: 2087 entries
mismatchCount=0
```

验证维度是 SHA-256、bytes、type、mode，不是只比文件名或抽样。由此可以证明：在已覆盖的正常和
当前修订中断状态中，source 侧能精确恢复。不能证明 frozen 旧脚本的任意中断态都自动恢复；
A-3 已给出反例。

### 5.3 SayDo 侧回滚证明失败

SayDo 侧没有执行真实回滚；隔离模拟已证明 frozen target 清单回滚后最终残留 6 项。故不能声称
“target-change 全量覆盖”。`docs/plan/MIGRATION.md:274-280` 正确说明 target manifest 不含自身、
A 项删除需 owner 授权、不得使用宽泛 clean；但这些纪律不能补齐清单没有记录的路径。

## 6. 单仓自包含、配置与质量门

### 6.1 活动入口没有 sibling 依赖

严格扫描运行代码、测试、e2e、scripts、templates 与活动入口：

```bash
rg -n \
  '~/WorkSpace/voice-coding|\.\./voice-coding|\./voice-coding' \
  packages pipeline e2e scripts templates \
  README.md AGENTS.md HANDOFF.md docs/plan/IMPLEMENTATION-PLAN-2.md
```

结果 0 命中。泛词 `voice-coding` 的剩余命中属于：

- 迁移脚本预期 basename；
- MIGRATION/冻结备份名；
- history/research/prompts/e2e 历史证据。

没有把历史绝对路径误判成活动依赖。

### 6.2 无 sibling 隔离安装和完整 CI

把报告写入前真实 574 候选逐文件覆盖到
`/private/tmp/saydo-ci-no-sibling.fvYwHz/SayDo`，其父目录没有 `voice-coding`。两边候选的
聚合 digest 相同：

```text
real_candidate=574
snapshot_candidate=574
real_digest=1c0eb62c3322fc785e8f9df331baaa76390805c5755dbe64a4c108ea6eff8671
snapshot_digest=1c0eb62c3322fc785e8f9df331baaa76390805c5755dbe64a4c108ea6eff8671
identical=yes
snapshot_parent_voice_coding=absent
strict_sibling_hits=0
```

安装：

```text
$ pnpm install --offline --frozen-lockfile
Scope: all 5 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 366ms using pnpm v10.33.1
```

最终 `UV_OFFLINE=1 just ci`：

```text
typecheck: exit 0
lint: exit 0
contracts: Test Files 6 passed; Tests 73 passed
daemon: Test Files 66 passed | 2 skipped; Tests 687 passed | 4 skipped
emoji gate: clean
emoji self-test: pass=10 fail=0
migration tools self-test: broken symlinks recorded as L
ruff: All checks passed
pytest: 20 passed in 0.23s
[ok] just ci: node + python matrices green
```

需要诚实保留：第一次对稍早快照执行完整 CI 确实因 `Buffer.toBe` 失败；后来外部修订
`toStrictEqual` 后，最新同内容快照才为绿。最终代码门是绿，审计对象稳定性不是。

### 6.3 配置模板与 pipeline

当前两份模板均能被 `tomllib` 解析，且得到：

```text
saydo.config.example.toml     voice={engine:cascade, asr:volc, tts:volc} has_secrets=false
saydo.config.dev.example.toml voice={engine:cascade, asr:volc, tts:volc} has_secrets=false
```

当前一致关系：

- env 模板：`DOUBAO_TTS_API_KEY`、`VOLC_APP_ID`、`VOLC_ACCESS_TOKEN`，见
  `templates/saydo.env.example:12-15`；
- pipeline 读取同三键，见 `pipeline/src/saydo_pipeline/__main__.py:41-45`；
- TTS：resource `seed-tts-2.0`、model `seed-tts-2.0-expressive`、voice
  `zh_female_tianmeiyueyue_uranus_bigtts`、24 kHz、v3 endpoint，见
  `pipeline/src/saydo_pipeline/doubao_tts.py:86-100`；
- canonical `[voice]` 为 cascade/volc/volc，并明确 pipeline 读 env，见
  `docs/09-data-contracts.md:848-853`；
- daemon config 测试 27/27。

所以 live 配置口径一致；B-3 只针对 frozen 模板和未更新 manifest。

### 6.4 FTS 原 oracle 没有被放宽

`e2e/spikes/fts-d9/run.mjs:57` 的“产物库”预期仍严格为 `["08","modules/b"]`。在最新无 sibling
隔离快照亲跑：

```text
D9_SPIKE_DONE batch1 0.95 hits 19 / 20
files=17
paras=519
queries=20
hitAt5=19
misses:
  query=产物库
  top5=05,04,04,02,05
```

`e2e/spikes/fts-d9/RESULT.md:9-12` 和 `:21-30` 如实区分历史 20/20 与迁移后 19/20，没有改 oracle
或伪装满分。

### 6.5 emoji、Markdown、密钥和大文件

emoji：

- 默认脚本实际枚举 cached+untracked；
- 自测 10/10；
- 独立全候选内容扫描 540 文本 + 34 二进制，禁字符 0；
- `.lock` 覆盖洞见 B-1。

活动 Markdown 本地链接检查范围为根 3 文件、docs 01-11、modules、两套 ADR、活动 plan 三件、
research/history/brand README，共 30 文件。跳过 fenced code、HTTP、mail、fragment-only，
按 CommonMark 无空格 destination 检查相对文件存在性：

```json
{"files":30,"localLinks":73,"broken":0}
```

未机械验证 fragment anchor 和外部 URL，列入未验证项。

高置信密钥：

```text
gitleaks 8.30.1
候选树: scanned 6.28 MB, generic findings=2
archive: scanned 120.67 MB, generic findings=3
```

候选两条分别是 RFC WebSocket 标准示例 nonce header 和 Codex 24 报告里的 FTS 文件名数组；archive
三条均是历史 log 中 minified 依赖源码的 `createMemoKey=...`。报告使用 `--redact`，未输出疑似
secret。逐条人工 triage 后高置信真实凭据为 0，但不能把 gitleaks 原始退出码写成 0：两次均因
generic rule 命中返回 7。

候选 575 文件没有异常特殊类型或大文件；最大文件 1.59 MB，见 §4.4。

### 6.6 Demo headless Chrome

因两份 Demo 在审计中发生摘要漂移，使用本机浏览器从只读 HTTP server 打开：

```text
GET /demo/saydo-console-demo.html 200
title="SayDo 控制台 · 结构示意 Demo(Mock)"
warn/error console logs=[]

GET /demo/saydo-console-demo-atelier.html 200
title="SayDo 控制台 · 结构示意 Demo(Mock)· Atelier"
warn/error console logs=[]
viewport=2160x1154
body scrollWidth=2150, scrollHeight=1155
```

两份首屏均实际截图目视核验：侧栏、开始区、待处理聚合、项目卡无明显遮挡/断裂；Atelier 没有水平
溢出。DOM 导航与 `docs/08-module-design.md:163-191` 的全局区、当前项目区、Dashboard、审批、
通知、成本、设置和项目级对话/任务/记忆/产物/设置一致；超 P0 元素有就地分期文字。

## 7. 文档、canonical、知识底座与 R58

### 7.1 唯一活动仓、排产和 ADR 序列

以下活动文档都明确 SayDo 是唯一活动仓：

- `README.md:6-14`；
- `AGENTS.md:3-15`；
- `HANDOFF.md:7-8`；
- `docs/plan/MIGRATION.md:1-12`；
- `docs/plan/IMPLEMENTATION-PLAN-2.md:123-124`。

PLAN-2 纪律一致：

- `docs/plan/README.md:7`：PLAN-2 是当前唯一排产源；
- `:13-14`：旧 plan/prompt 是锁版历史；
- `IMPLEMENTATION-PLAN-2.md:123`：单仓任何时刻一个活动批次；
- `HANDOFF.md:21`：当前批次指针为空，非空时其他批停。

ADR 双序列索引见 `docs/adr/README.md:3-22`：设计位于 `docs/adr/design/`，工程位于
`docs/adr/` 根；编号可重复，引用必须带序列。除 C-1 的 HANDOFF 三处裸写外，活动索引和链接没有
发现分叉。

当前包含 `~` 的候选文件共 53 个：

```text
HANDOFF 1
docs 10
e2e 1
history 1
prompts 10
research 30
```

绝大多数位于历史证据、prompt 或迁移说明；`docs/plan/MIGRATION.md:97-99` 已如实说明数量会随评审
增长、保留绝对路径是为了证据复验、未来公开发布须另做脱敏。当前措辞没有继续把旧计数写死。

### 7.2 R58 的结构与证据诚实性

`history/PROCESS-JOURNAL.md:854-861` 包含：

- 输入；
- 行动；
- 两路 subagent 与 Codex 24 的评审/triage；
- 验证；
- 物理切换；
- 产出与结论。

Codex 24 产物亲测：

```text
research/codex-findings/24-repo-merge-migration-review.md
  419 lines / 23,862 bytes
  sha256=197636adba5933af328a56552547f8fad4840bd678be16a99083aa954bace457

prompts/24-repo-merge-migration-review.md
  42 lines / 2,889 bytes
  sha256=395ce3a3dfb035e45c3882f44914aa9736dd328d5415bdceba0426ee2de6549a

logs/24-repo-merge-migration-review.log
  13,378 lines / 1,194,946 bytes
  sha256=721c7feb7fd4b433c1c4b126fc4e2a65141908aee2e21257e8ef297c5ab6ad6f
  gitignored by *.log
```

R58 明确把 Codex 24 的人工终止写成 exit 1，没有冒充正常退出；MIGRATION
`docs/plan/MIGRATION.md:284` 也明确“本轮不实际演练 SayDo 工作树回滚”，没有把未运行项写成通过。

但 R58 是历史时点记录，不是当前绿证：

- 它记录 daemon 686；live 修订后是 687；
- 它记录 emoji 自测 8/8；live 修订后是 10/10；
- 它记录三清单均绿；当前 migration/target 均红；
- 它记录最终候选 572；最终已经 575；
- 它写裸 ADR 已清，HANDOFF 仍有三处。

这些差异有的来自审计中并发修订，不应倒推 R58 在写入时蓄意造假；但后续不能继续引用 R58 的
“最终”结论作为当前验收结论。

### 7.3 知识底座结论

综合 §3 B-2：

- generation/current/current.json/AGENTS pointer/inner Git 的主指针一致；
- current 与 gen-4 四文档一致；
- legacy 四文档仍是 generation 1 普通文件；
- manifest key-file digest 与当前 AGENTS/justfile 不一致；
- `572` 仅能解释为 frozen 时点的最终候选集合，不能叫当前 Git index。

因此知识底座不是 A 级数据丢失，但会误导后续奠基/检索消费者，维持 B。

## 8. 最终质量门与 Git 边界

### 8.1 必跑门汇总

| 门 | 亲测结果 |
|---|---|
| source manifest check | exit 0，allowlist 外 2085 |
| migration manifest check | exit 1 |
| target-change manifest check | exit 1 |
| `git diff --check`（真实 tracked diff） | exit 0 |
| 隔离快照暂存全部当前变更后的 `git diff --cached --check` | exit 0 |
| 四个 Node 迁移脚本 `node --check` | 4/4 exit 0 |
| emoji 三个 shell 脚本 `bash -n` | 3/3 exit 0 |
| 全候选 emoji 独立扫描 | 575 项，0 命中 |
| 活动 Markdown 本地文件链接 | 73 links / 30 files，0 broken |
| 高置信密钥 | 人工 triage 0；gitleaks generic 2+3，原始 exit 7 |
| 异常大文件/依赖/log/cache/special | 0；最大 1.59 MB |
| FTS batch1 | 19/20，oracle 未放宽 |
| 无 sibling offline install | exit 0 |
| 无 sibling `UV_OFFLINE=1 just ci` | 最新快照 exit 0 |
| 两份 Demo headless | HTTP 200，console 0 warn/error，首屏目视正常 |

四个 Node 迁移脚本是：

```text
scripts/design-archive-manifest.mjs
scripts/freeze-design-archive.mjs
scripts/verify-design-migration.mjs
scripts/target-change-manifest.mjs
```

最终脚本 SHA-256 观测值：

```text
3ce0a20a650355eff6e3fa59cde61e6e4666b63e3ae21c491623444aecb0776e  design-archive-manifest.mjs
e9014237da5f145bd8ea0237339d2a933ed2be7d5c23d4a6e609823a910b890f  freeze-design-archive.mjs
cddbdce4c98d4c57051874edba299f256825a0ec82cb4ba9587b7fdb54d4a145  verify-design-migration.mjs
3a1c357f368bd734450b58b600705124298a21e4f8edd520562af4abf859106f  target-change-manifest.mjs
```

这些值不等于 frozen target 中至少 freeze/target 两行记录的值，正是 A-1 的一部分。

### 8.2 实际 Git index、候选与提交边界

报告写入后的最终计数：

```text
HEAD=838aeea4385a41ec58318437bb36a7db5ede635f
branch=codex/merge-voice-coding-20260729
tracked index files=399
cached changes=0
changed tracked=26
untracked=176
candidate=575
current change set including target manifest self: A=176, M=26, D=0, total=202
current target scope excluding target manifest self: A=175, M=26, D=0, total=201
```

相较 §1.2 的报告前快照，untracked/candidate 和 target scope 均增加 1，唯一新增项就是本报告。
这不会修复 frozen 清单，反而应在最终再生成 target manifest 时被明确纳入。

没有 staged 变更，没有新 commit；HEAD 与起点相同。本审查没有执行任何 push/pull/fetch/rebase/
reset/clean，也没有操作真实 archive/symlink。

## 9. A/B/C 总表

| 级别 | ID | 发现 | 当前状态 |
|---|---|---|---|
| A | A-1 | 审计对象持续变化；migration/target 两个 check 红，10 个迁移 target 漂移、最终 target 漏 6 且 22 元数据漂移 | 未关闭 |
| A | A-2 | 按 frozen target 195 条加清单自身回滚，最终仍残留 6 项 | 未关闭 |
| A | A-3 | frozen freeze 脚本不能恢复自身 unfreeze 中断，部分 freeze 可吞 mode 漂移 | live 已修，未重建清单/稳定复验 |
| A | A-4 | frozen S1→S2 对错误 symlink 先改 archive/错误目录，后置失败 | live 文档已修，未重建清单/稳定复验 |
| A | A-5 | target-change 对 untracked FIFO 静默漏项 | 未关闭 |
| B | B-1 | emoji 门禁无条件排除文本 `.lock` | 未关闭 |
| B | B-2 | knowledge 主指针 gen-4，但 legacy 根文件 gen-1；manifest key digest 和“Git index 572”口径不一致 | 未关闭 |
| B | B-3 | frozen 模板暗示 pipeline 不消费的 `[voice.tts]` 配置面 | live 已修，migration 清单未更新 |
| B | B-4 | 工具层未完成绝对路径/仓外 symlink 的显式边界策略 | 未关闭 |
| C | C-1 | HANDOFF 三处裸工程 ADR-002 | 未关闭 |

总计：**A=5，B=4，C=1**。

## 10. 三份清单与物理状态亲测结果

| 对象 | identity | 内容复算 | 最终判定 |
|---|---|---|---|
| 旧兼容路径 | symlink，33-byte link text，精确指向 SayDo | `readlink`/`realpath` 均为 SayDo | [ok] |
| frozen archive | 普通目录，非 symlink | logical 2087 全 SHA/bytes/type/mode mismatch=0；物理 2089 仅多两 tombstone | [ok] |
| source manifest | SHA 与冻结值一致 | 2087 / 181,286,599 / F 2087 / mode 2081+6；allowlist 外 2085 | [ok] |
| migration manifest | SHA 与冻结值一致 | 161 路径仍唯一；最终有 10 个 target 行漂移 | [fail] |
| target-change manifest | SHA 与冻结值一致 | frozen 195；最终应为 201，漏 6、元数据漂移 22；模拟回滚残留 6 | [fail] |
| 冷档分箱 | 不依赖文档自报 | 8 个互斥箱覆盖 2087，unknown=0 | [ok] |

## 11. 尚未验证的项目

1. 没有在真实 archive 上执行 unfreeze/freeze；写入边界禁止这样做。完整 178 MB 副本已做字节/type/
   mode 往返。
2. 没有在真实 SayDo 工作树执行回滚；隔离模拟已经证明 frozen target 范围不完整。
3. 没有验证 Git 远端服务器的实时状态；只读了本地 `origin/main` ref，且 pull/fetch 不在授权范围。
4. 没有使用真实 ASR/TTS 凭据调用供应商；只验证模板、实现默认值、env 键和自动化测试。
5. Markdown 只验证本地文件目标存在；未验证 fragment anchor 和外部 URL 可达性。
6. gitleaks generic 命中经人工判为示例 nonce/源码/证据文本；没有向外部供应商验证任何凭据是否有效，
   也没有打印 secret。
7. 云端 GitHub Actions 因项目既有 billing 边界未运行；验证的是最新隔离本地 `just ci`。
8. 当前 live 修补发生在审计中；虽然对 freeze 中断、错误 branch、配置和测试做了针对性复验，但未在
   一个新的 immutable tree/manifest 组合上重跑全部故障矩阵。

## 12. 最终结论

**No-Go。**

物理 source/archive 数据安全，单仓方向成立，最新代码 CI 也能通过；但交付判定看的是“当前候选是否
被清单完整描述、危险切换是否修改前拒绝、是否可按证据完整回滚”。当前三个条件分别被 A-1/A-2、
A-4/A-5、A-2/A-3 的实测反例击穿。

不能给“有条件 Go”，因为 target rollback 已被实际证明不完整，migration/target 两个必跑 check
当前为红，且审计期间仍发生无清单并发改写。必须先停止写入、形成新冻结点并复验。

## 13. 最小修复与复验命令

### 13.1 最小修复

1. **先静止工作树。** 停止所有会修改 SayDo 的进程/会话；在至少两次间隔观测中确认 candidate
   path+content digest 不变。不要一边审计一边继续回修。
2. **owner 决定是否接受审计中 live 修补。** 若接受，以当前 freeze/MIGRATION/配置/测试为新候选；
   若不接受，逐项回退到 owner 指定版本。未获 commit 授权前继续保持工作树状态，不用
   `reset --hard`/`clean`。
3. **修 target-change 特殊节点枚举。** 在 Git 候选枚举之外先做独立 `lstat` walker：
   - `.git` 和明确 ignore allowlist 外发现 FIFO/socket/device 即修改前拒绝；
   - dangling symlink 仍记录 link bytes；
   - 对仓外 symlink 明确选择“拒绝”或登记的受控 allowlist，并加反例；
   - self-test 至少覆盖 FIFO、socket、dangling、仓外 link、mode/content 漂移。
4. **锚定迁移工具坐标。** freeze 当前 branch/HEAD/source identity 检查应保留；绝对真实路径与测试
   clone 应通过显式 test-root 模式区分。target write/check 也应绑定 migration branch/基线。
5. **重建内容清单。** source archive 未漂移，source manifest 不需要重写；对稳定 live target
   重写 `migrated-files.tsv` 和 `target-change-manifest.tsv`，纳入 prompt、本报告、CI/FTS/justfile/
   migration-tools 等全部路径。target manifest 自身继续作为明确额外回滚项。
6. **修 emoji `.lock`。** 不按扩展名一刀切；先用 NUL/UTF-8/content sniff 判断文本，并新增
   `fixture.lock` 反例。
7. **重建知识底座。** 把 legacy 四文件升级为 `current/...` compatibility symlink；修复
   publish/AGENTS pointer/hash 顺序或对 managed pointer 做规范化；稳定 candidate 上生成新
   generation，并把“Git 索引”改成“候选文件集合”或真实 index 数。
8. **文档收口。** HANDOFF 三处补“工程”；给 R58 增加后续审计修订记录，不能覆盖历史原始结果；
   frozen 模板 live 修法被 owner 接受后再更新 migration 证明。

### 13.2 建议复验命令

下列 `write` 命令会修改清单，只能在 owner 接受最终候选、工作树静止后执行；本审查未执行：

```bash
set -euo pipefail
repo=~/WorkSpace/SayDo
archive=~/WorkSpace/voice-coding.archive-20260729
baseline=838aeea4385a41ec58318437bb36a7db5ede635f

test "$(git -C "$repo" branch --show-current)" = codex/merge-voice-coding-20260729
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline"

node "$repo/scripts/design-archive-manifest.mjs" check \
  "$archive" "$repo/docs/plan/migration/source-prearchive-manifest.tsv" \
  AGENTS.md README.md AGENTS.prearchive.md README.prearchive.md

node "$repo/scripts/verify-design-migration.mjs" write \
  "$archive" "$repo" "$repo/docs/plan/migration/migrated-files.tsv"
node "$repo/scripts/verify-design-migration.mjs" check \
  "$archive" "$repo" "$repo/docs/plan/migration/migrated-files.tsv"

node "$repo/scripts/target-change-manifest.mjs" write \
  "$repo" "$baseline" "$repo/docs/plan/migration/target-change-manifest.tsv"
node "$repo/scripts/target-change-manifest.mjs" check \
  "$repo" "$baseline" "$repo/docs/plan/migration/target-change-manifest.tsv"

git -C "$repo" diff --check
node --check "$repo/scripts/design-archive-manifest.mjs"
node --check "$repo/scripts/freeze-design-archive.mjs"
node --check "$repo/scripts/verify-design-migration.mjs"
node --check "$repo/scripts/target-change-manifest.mjs"
bash -n "$repo/scripts/check-emoji.sh"
bash -n "$repo/scripts/test-emoji-gate.sh"
bash -n "$repo/scripts/test-migration-tools.sh"
bash "$repo/scripts/check-emoji.sh"
bash "$repo/scripts/test-emoji-gate.sh"
bash "$repo/scripts/test-migration-tools.sh"

cd "$repo"
pnpm install --offline --frozen-lockfile
UV_OFFLINE=1 just ci
node e2e/spikes/fts-d9/run.mjs docs batch1
```

最后必须在新的 `/private/tmp` 全量副本重复：

```text
normal freeze/unfreeze
repeat freeze/unfreeze
freeze 每个 rename/write 边界中断
unfreeze 每个 rename/unlink 边界中断
backup/tombstone content 与 mode 漂移
错误 source symlink（含 dangling 和 symlink-to-directory）
错误 branch/HEAD/Git root/target/manifest identity
source 和 target 的 FIFO/socket/device
target dangling/仓外 symlink
按新 target 清单回滚后 git diff 为 0
source 回滚后 2087 项 SHA/bytes/type/mode mismatch 为 0
```

只有新的 immutable candidate 上三清单 check 全绿、两个回滚结果均为 0 mismatch、完整 CI 仍绿，
才可重新评为 Go。
