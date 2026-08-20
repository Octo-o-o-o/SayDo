# SayDo 单仓迁移提交后对抗性复核

Findings：A=0，B=3，C=4。本次仅执行只读命令，未修改任何文件，未启动 subagent。

## Findings

### B-1：提交后状态回写尚未形成自洽的已提交记录

当前工作树存在两份修改和一份未跟踪审计 prompt：

```text
$ git status --short --branch
## codex/merge-voice-coding-20260729
 M HANDOFF.md
 M docs/plan/MIGRATION.md
?? prompts/26-repo-migration-post-commit-audit.md
```

`origin/main` 当前提交中的 `MIGRATION.md` 仍是提交前状态：

```text
$ git show f28489d:docs/plan/MIGRATION.md | sed -n '1,8p'
> 状态:迁入、真实目录切换、四路独立复核与 Codex 终审回修已完成;最终活动入口为 SayDo，
> 工作树尚未 commit/push。
```

当前工作树才回写为“已同步至 origin/main，复核回写未提交”，见 [MIGRATION.md:3](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/MIGRATION.md:3)。`HANDOFF.md` 也仅在工作树把 daemon 基线从 686 修为 687；`f28489d` 中仍为 686，当前为 [HANDOFF.md:24](/Users/wangyixiao/WorkSpace/SayDo/HANDOFF.md:24)。

[PROCESS-JOURNAL.md:854](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:854) 至 [PROCESS-JOURNAL.md:870](/Users/wangyixiao/WorkSpace/SayDo/history/PROCESS-JOURNAL.md:870) 的“未 commit、未 push”是 R58/R59 当时的历史事实，不应改写；问题是 journal 到 R59 结束，没有后续轮次记录 owner 授权、提交、push 和本次复核。

影响：当前工作树的状态表述基本准确，但 `origin/main` 和过程 journal 尚未形成一致的提交后记录，会误导只读远端文件的后续审计。

### B-2：`target-change` 对迁移提交准确，但对当前真实工作树复算失败

本次直接执行三个检查：

```text
[ok] archive unchanged outside allowlist: 2085 entries
[ok] migration mapping verified: 161 files
[fail] target change manifest differs from current worktree
target_check_exit=1
```

失败原因是当前两份已修改文档和未跟踪 prompt。独立按 Git 对象复算表明，清单对 `f28489d` 本身完全准确：

```text
manifest_rows=201 unique_paths=201 duplicate_paths=0 statuses={"M":26,"A":175}
git_diff_paths=202 statuses={"M":26,"A":176}
manifest_vs_commit_status_mismatch=0 missing_in_commit_diff=0 extra_in_commit_diff=1
extra_paths=docs/plan/migration/target-change-manifest.tsv
baseline_metadata_mismatch=0 target_metadata_mismatch=0
```

即 201 条清单记录，加上明确排除的清单自身，严格等于提交的 202 个变化路径。但 [MIGRATION.md:223](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/MIGRATION.md:223) 仍写“三个 `check` 均 exit 0”，没有限定为“`f28489d` 静止点”；清单首行也没有目标提交字段。

门禁不能自动发现这一漂移：

```text
$ rg 'design-archive-manifest|verify-design-migration|target-change-manifest' Justfile .github/workflows/ci.yml
manifest_checks_in_ci_exit=1

$ rg 'test-migration-tools' Justfile .github/workflows/ci.yml
Justfile:23:    bash scripts/test-migration-tools.sh
```

本地 `just ci` 包含工具自测，但不包含三份真实清单检查；GitHub Actions 连工具自测也未包含，见 [Justfile:14](/Users/wangyixiao/WorkSpace/SayDo/Justfile:14) 和 [ci.yml:22](/Users/wangyixiao/WorkSpace/SayDo/.github/workflows/ci.yml:22)。

影响：不是迁移数据损坏，而是清单作用域和“当前已通过”表述不稳定。应把它明确钉在 `f28489d`，或在提交后回写静止点重新生成并复验。

### B-3：冷档只有制度冻结，不是文件系统物理只读

冷档规则写的是：

```text
voice-coding.archive-20260729/AGENTS.md:3
> 本目录是 2026-07-29 冻结的只读历史档案
```

但实际权限为：

```text
path=.../voice-coding.archive-20260729 mode=drwxr-xr-x flags=-
path=.../README.md mode=-rw-r--r-- flags=-
path=.../AGENTS.md mode=-rw-r--r-- flags=-

owner-writable files: 2089
owner-writable directories: 156
archive_immutable_paths=0
```

`0644`、`0755` 均允许 owner 写入，目录也允许新增、删除和 rename；没有 `uchg/schg`。冻结脚本只把 tombstone 固定为 `0644`，[freeze-design-archive.mjs:43](/Users/wangyixiao/WorkSpace/SayDo/scripts/freeze-design-archive.mjs:43)、[freeze-design-archive.mjs:222](/Users/wangyixiao/WorkSpace/SayDo/scripts/freeze-design-archive.mjs:222)，没有递归物理加固。

影响：当前摘要可检测漂移，但不能阻止漂移。“只读历史档案”应改成“制度冻结、文件系统仍可写”，或者另行采用物理只读、不可变标志或独立备份。

### C-1：清单不覆盖目录元数据和 macOS xattr

源清单只记录非目录条目的摘要、字节、类型和 mode；当前有 156 个目录、一个空目录：

```text
156
.../research/spikes/cursor-sdk-tier1/node_modules/.bin
```

此外实际冷档有 192 个带扩展属性的路径：

```text
archive_xattr_paths=192
archive_acl_paths=0
archive_immutable_paths=0

190 com.apple.provenance
28  com.apple.lastuseddate#PS
1   com.apple.FinderInfo
1   com.apple.macl
```

[MIGRATION.md:54](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/MIGRATION.md:54) 已披露目录 mode 不受清单证明，但未披露 xattr。当前 xattr 仍物理存在，没有发现内容丢失；只是三份 TSV 无法证明或监控其迁前一致性。

### C-2：`.saydo/knowledge` 是被外层忽略、无远端的本地嵌套 Git

证据：

```text
$ git check-ignore -v .saydo/knowledge
.gitignore:32:.saydo/  .saydo/knowledge

$ git ls-files .saydo | wc -l
0

$ git -C .saydo/knowledge status --short --branch
## main

$ git -C .saydo/knowledge log -1 --oneline
8c0fcfa foundation generation 5
```

`git -C .saydo/knowledge remote -v` 无输出。五个兼容 symlink 均解析到 `gen-5`，没有 broken/outside link：

```text
saydo_local dirs=55 files=85 links=5 broken_links=0 outside_links=0 special=0
```

这没有漏掉 161 个迁移目标：

```text
mapping_targets=161 commit_blob_absent=0 commit_nonblob=0 changed_since_commit=0
```

但外层 `origin/main`、`target-change` 和 `git revert f28489d` 均不覆盖该嵌套仓；它属于可重建的本地状态，而不是远端迁移提交的一部分。

### C-3：本地 `origin/main` 可证明，在线远端未独立查询成功

本地三条 ref 完全一致，remote-tracking reflog 明确记录 push：

```text
refs/heads/codex/merge-voice-coding-20260729 f28489d14af78d67d6ed3d223395d172b7e6056c
refs/heads/main f28489d14af78d67d6ed3d223395d172b7e6056c
refs/remotes/origin/main f28489d14af78d67d6ed3d223395d172b7e6056c

f28489d14af78d67d6ed3d223395d172b7e6056c update by push
```

但在线查询失败：

```text
$ git ls-remote --heads origin refs/heads/main
fatal: unable to access 'https://github.com/Octo-o-o-o/SayDo.git/':
Failed to connect to 127.0.0.1 port 7897
```

因此可以确认“当前 clone 的 `origin/main` 指向该提交，并有 push reflog”，不能冒充本会话实时读取了 GitHub 服务端。

### C-4：75 个 transformed 映射只证明双端身份，不机械证明语义等价

```text
mapping_mode=byte-identical count=86
mapping_mode=transformed count=75
endpoint_mismatches=0
```

75 个转换主要是路径迁移、canonical 调整、配置收敛和 journal 续写。清单能证明具体源与具体目标，没有证明每项语义转换完整；好在原始字节仍全部留在冷档，因此不存在不可恢复的数据删除。

## A 级阻断核验

### 路径切换正确

```text
path=.../SayDo type=Directory inode=450641874
path=.../voice-coding type=Symbolic Link inode=486766399
path=.../voice-coding.archive-20260729 type=Directory inode=409294432

$ readlink .../voice-coding
/Users/wangyixiao/WorkSpace/SayDo

followed=.../SayDo inode=450641874
followed=.../voice-coding inode=450641874
```

兼容路径精确指向 SayDo；冷档是不同 inode 的独立普通目录。

### 2087 / 161 / 1926 严格守恒

独立 walker 和 TSV 解析结果：

```text
source_rows=2087 source_unique=2087 source_duplicates=0 source_bytes=181286599
archive_physical_non_dirs=2089 archive_normalized_entries=2087 normalized_unique=2087
source_vs_archive_missing=0 extra=0 metadata_mismatch=0

mapping_rows=161 unique_sources=161 duplicate_sources=0 duplicate_targets=0
source_not_in_manifest=0 endpoint_mismatches=0

conservation=2087=161+1926 cold=1926 unboxed=0
cold_bytes=166855899
```

物理 2089 是 2087 个迁前条目加两份 tombstone；将 `*.prearchive.md` 还原为逻辑 README/AGENTS、排除 tombstone 后，2087 项逐项全等。

冷档分箱无未知项：

```text
research node_modules       count=1807 bytes=37364723
legacy archive remainder    count=46   bytes=23221148
research logs               count=26   bytes=51986019
docs backup                 count=18   bytes=411850
root logs                   count=15   bytes=53817561
playwright captures         count=13   bytes=48450
root .DS_Store              count=1    bytes=6148
```

### README/AGENTS 原文备份正确

```text
source manifest:
15: d615aefe... 2348 F 0644 AGENTS.md
161:d43b1b17... 7297 F 0644 README.md

archive backups:
d615aefe... AGENTS.prearchive.md
d43b1b17... README.prearchive.md
2348 644 AGENTS.prearchive.md
7297 644 README.prearchive.md
```

冻结 README 指向唯一活动仓并明确两份原文位置，见冷档 [README.md:3](/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729/README.md:3)；制度规则见冷档 [AGENTS.md:3](/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729/AGENTS.md:3)。除“物理只读”措辞外，入口和备份声明正确。

### 提交拓扑正确

```text
f28489d14af78d67d6ed3d223395d172b7e6056c
838aeea4385a41ec58318437bb36a7db5ede635f

commit=f28489d14af78d67d6ed3d223395d172b7e6056c
parents=838aeea4385a41ec58318437bb36a7db5ede635f
subject=chore: 合并 voice-coding 到 SayDo 单仓
```

提交只有指定父提交；本地 `main`、迁移分支及 `origin/main` 均指向它。

### 活动范围没有 sibling/archive 依赖

对 runtime、配置、模板和测试代码扫描：

```text
runtime_config_template_exit=1
runtime_test_exit=1
canonical_sibling_exit=1
plan2_sibling_exit=1
```

这里 `rg` exit 1 表示零命中。迁移/回滚工具中的 archive 坐标是其职责本身，不是运行时依赖。旧绝对路径仍存在于历史 research、prompts、e2e evidence 和已锁版 `IMPL-PROMPT-*` 中；这些是历史材料，且当前旧路径会跳转到 SayDo，不是活动 sibling 读取。

### Git 忽略、symlink、未跟踪和特殊类型未造成源内容漏迁

```text
source_type=F count=2087
tracked_symlink_count=0
untracked_count=1
workspace_excluding_deps ... broken_links=0 outside_links=0 special=0
mapping_targets=161 in_target_change=161 absent_from_target_change=0
```

唯一未跟踪项是本次审计 prompt。全部 161 个目标既在迁移提交中是 blob，也全部进入 `target-change`；源冷档无 symlink 或特殊文件。

## 本会话门禁账

实际运行并通过：

```text
archive check:                 2085 entries [ok]
migration mapping check:       161 files [ok]
migration scripts Node/bash -n migration_syntax_exit=0
git diff --check current:       exit 0
git diff --check 838aeea..f284: exit 0
commit-object target复算:       0 mismatch
```

实际运行但失败：

```text
target-change check against current worktree: exit 1
git ls-remote origin/main: network/proxy failure
```

明确未运行：

- `just ci`
- `bash scripts/test-migration-tools.sh` 的运行时自测
- `unfreeze` 或任何实际回滚演练

原因是用户要求“禁止修改任何文件”。`just ci` 会执行 `uv sync`，[Justfile:25](/Users/wangyixiao/WorkSpace/SayDo/Justfile:25)；工具自测会 `mktemp`、创建 Git 仓、写文件、建 symlink/FIFO，[test-migration-tools.sh:5](/Users/wangyixiao/WorkSpace/SayDo/scripts/test-migration-tools.sh:5)。本报告没有把历史文档中的 CI/self-test 结果冒充成本会话实跑。

## 最终判定

**Conditional Go。**

迁移数据完整性本身成立：A=0，2087 项全部可恢复，161 项迁入目标全部进入迁移提交，1926 项冷档无未知分箱，活动代码和唯一排产源不依赖旧 sibling。可以继续以 SayDo 作为唯一开发仓，也应继续保留冷档。

“提交后审计已最终封账”仍需满足：

1. 为提交、push 和本次复核追加 journal 轮次，并把当前 `HANDOFF.md`、`MIGRATION.md` 状态回写形成明确提交。
2. 将 `target-change` 明确钉在 `f28489d` 并提供 commit-object check，或在最终回写静止点重新生成；不能继续声称当前工作树三个 check 全绿。
3. 将冷档表述改为“制度冻结但物理可写”，或真正增加物理只读/不可变与独立备份。
4. 若希望远端 CI 支撑迁移工具结论，应把 `test-migration-tools.sh` 纳入 Actions；真实 archive 清单检查则需单独的本机迁移门禁。

剩余未覆盖边界是目录元数据、xattr、75 项语义转换、嵌套 knowledge 的本地独立历史，以及本会话无法在线读取 GitHub 服务端；因此不能表述为“绝对没有风险”。