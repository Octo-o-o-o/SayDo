# SayDo 单仓合并迁移记录

> 日期:2026-07-29
> 状态:迁入、真实目录切换、四路独立复核与 Codex 终审回修已完成;最终活动入口为 SayDo。
> 迁移提交 `f28489d14af78d67d6ed3d223395d172b7e6056c` 已同步至 `origin/main`;
> 本次提交后复核回写未 commit/push。
> Supersedes:`REPO-MERGE-PROPOSAL.md` v2 的时点数据与待拍板状态。

## 1. 结论与边界

后续唯一活动开发仓为 `/Users/wangyixiao/WorkSpace/SayDo`。原 `voice-coding` 的设计、计划、证据、
过程档案、模板、Demo 与品牌资产进入 SayDo;可再生依赖、运行日志、浏览器会话与重复快照不进入 Git，
随原目录整体冻结为冷档。

迁移使用“源快照 → 分层复制与语义合并 → 同卷 rename → 冻结入口 → 旧路径符号链接”的可恢复流程:

1. 原目录先生成全量非目录条目的 SHA-256、字节、类型与 mode 清单，不修改源文件;
2. 迁入副本允许为单仓口径转换，源/目标双摘要与实际物理源路径逐项记录;
3. 根 AGENTS/README/HANDOFF 做语义合并，不机械覆盖;
4. 原目录改名为 `voice-coding.archive-20260729`，README/AGENTS 原文移为 `*.prearchive.md`，
   原位置写只读冻结声明;
5. 旧路径 `voice-coding` 精确指向 SayDo，防遗漏脚本重新产生第二份活动数据。

迁移执行轮未执行 commit、push、pull、rebase 或 reset。迁移基线为
`838aeea4385a41ec58318437bb36a7db5ede635f`，当时本地 `main` 相对 `origin/main` ahead 27，
工作分支为 `codex/merge-voice-coding-20260729`。后续形成迁移提交
`f28489d14af78d67d6ed3d223395d172b7e6056c`，其唯一父提交就是上述基线;本次提交后复核实测
本地 `main`、`origin/main` 与迁移分支均指向该提交。

## 2. 冻结快照与三份清单

| 清单 | 覆盖范围 | 口径 |
|---|---|---|
| `migration/source-prearchive-manifest.tsv` | 迁前 `voice-coding` 全量非目录条目 | `sha256 / bytes / type / mode / path` |
| `migration/migrated-files.tsv` | 161 个 source→target 映射 | source/target 双摘要、双字节、双 mode、转换模式、逻辑源、物理源、目标 |
| `migration/target-change-manifest.tsv` | SayDo 相对基线的 A/M/D 路径(不含清单自身) | baseline/target 双摘要、字节、类型、mode 与状态 |

迁移提交后静止点实测(不随本轮状态文档与评审证据回写重算):

| 项 | 实测值 |
|---|---:|
| 文件 | 2087 |
| 字节合计 | 181,286,599 |
| 普通文件 / symlink / 特殊文件 | 2087 / 0 / 0 |
| mode `0644` / `0755` | 2081 / 6 |
| source manifest SHA-256 | `4f195260f116d2e96dcafd3594080079c13e94ecee119f548d91cfb0747d274a` |
| 迁移映射 | 161 |
| 迁入源字节 | 14,430,700 |
| 迁入目标字节 | 14,448,452 |
| 映射 mode `0644→0644` / `0755→0755` | 159 / 2 |
| `byte-identical` / `transformed` | 86 / 75 |
| migration manifest SHA-256 | `ec60ecc50aa5015f6e635add4788b9bf8a07062796a67822db2a0934c7af5ba2` |

源清单不记录目录节点或目录 mode。迁前目录经同卷 rename 原样保留；当前 archive 有 156 个目录，
其中 1 个空目录位于冷档 `research/spikes/cursor-sdk-tier1/node_modules/.bin`。因此这里的“全量”
只指 2087 个非目录条目，不能据此追溯迁前目录 mode；迁入完整性由 161 映射与 1926 冷档分箱证明。
清单也不记录 macOS xattr；提交后复核确认 xattr 当前仍物理存在，但不能倒推迁前一致性。

冻结前 `source_path` 与 `source_on_disk_path` 相同。冻结后，逻辑 `README.md` / `AGENTS.md`
分别从物理 `README.prearchive.md` / `AGENTS.prearchive.md` 复算，其余 159 项不变。清单脚本遇
FIFO、socket 或 device 等未支持类型立即失败，不会静默漏项。

“冻结/只读”是仓库协作规则与摘要防漂移口径，不是文件系统强制属性。archive 保持原 mode，
owner 在文件系统层仍可写；任何内容回写都违反冻结规则。源清单复核可发现 allowlist 外非目录条目
的漂移，两份活动 tombstone 则由冻结脚本常量人工精确核验。若以后需要物理不可变、自动 tombstone
检查或离线备份，应作为单独操作设计并再次取得授权，不能直接改 mode/flags 破坏现有回滚口径。

## 3. 文件映射与冷档分箱

| 源 | 数量 | SayDo 目标 | 处理 |
|---|---:|---|---|
| `docs/01–11`、`docs/modules/`、反馈文档 | 17 | `docs/` | canonical 直迁，更新活动链接 |
| 设计 ADR-001 | 1 | `docs/adr/design/` | 与工程 ADR 分序列 |
| 根计划、Prompt、旧迁移方案 | 11 | `docs/plan/` | PLAN-2 保持唯一活动排产源，其余锁版 |
| `research/` | 87 | `research/` | 排除 `*.log`、`node_modules`、`.DS_Store` |
| `history/` | 11 | `history/` | journal 在本仓续写 |
| 根 `.cursor.md` 评审 | 2 | `history/reviews/` | 历史评审归档 |
| `prompts/` | 10 | `prompts/` | 评审输入延续 |
| `templates/` | 3 | `templates/` | 与当前 ASR/TTS 实现对齐 |
| `demo/` | 2 | `demo/` | 功能图标统一为 inline SVG 或纯文本，禁止编码绕过 |
| `assets/` | 13 | `assets/` | 品牌资产入仓，消除旧目录隐性依赖 |
| 旧 archive 根两份文本 | 2 | `history/legacy-archive/` | 可读历史进入主仓 |
| 原 README/AGENTS | 2 | `migration/*prearchive.md` | 保存合并前语义输入 |

未迁入 Git、但由非目录条目源清单继续保护的冷档:

| 内容 | 实测规模 | 理由 |
|---|---:|---|
| `logs/` | 15 文件 / 53,817,561 bytes | 本地评审运行日志 |
| `research/codex-findings/logs/` | 26 文件 / 51,986,019 bytes | 历史 Codex 原始日志 |
| spike `node_modules/` | 1807 文件 / 37,364,723 bytes | 可再生依赖 |
| `archive/2026-07-22-pre-rewrite/` | 46 文件 / 23,221,148 bytes | 重复历史快照 |
| `docs.bak-r-a-20260727/` | 18 文件 / 411,850 bytes | 已被当前 canonical supersede |
| `.playwright-mcp/`、`.DS_Store` | 本地产物 | 非项目源文件 |

以后新的 Codex 日志仍写 SayDo `logs/` 且不入 Git;报告或 journal 记录日志文件名、字节数与 SHA-256。

## 4. 单仓语义调整

- Canonical 统一为 `docs/01–11 + docs/modules/ + docs/adr/`;`docs/09–11` 是实施照抄源，
  `docs/plan/` 不属于合同 canonical。
- `docs/plan/IMPLEMENTATION-PLAN-2.md` 是唯一排产源;本仓使用单一活动批次指针串行开批，
  不再允许合同轮与实现批并行写入。
- ADR 分为 `docs/adr/design/` 设计序列与 `docs/adr/` 工程序列，引用必须带序列限定。
- 配置模板、测试、FTS、emoji 门禁与知识底座均改为仓内自包含路径;活动范围扫描不得读取 sibling。
- `.saydo/knowledge` 由奠基器重建，不手改生成物。
- 历史 research/prompts 与本轮本地审计证据中保留部分本机绝对路径以维持可复现性;数量会随评审
  产物变化，不作为迁移验收常量。本轮未发现高置信密钥。
  若未来公开发布仓库，须另做隐私脱敏，不能把本次“保留证据”解释为公开披露授权。

## 5. 唯一切换命令链

以下命令只适用于本次精确路径、分支与基线。任一 `test` 或 `check` 非零即停止，不覆盖既有 archive、
symlink、backup 或 frozen copy。

### 5.1 S0 → S1:preflight 与同卷 rename

```bash
set -euo pipefail
migration_source=/Users/wangyixiao/WorkSpace/voice-coding
migration_archive=/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729
migration_target=/Users/wangyixiao/WorkSpace/SayDo
migration_baseline=838aeea4385a41ec58318437bb36a7db5ede635f
migration_branch=codex/merge-voice-coding-20260729

test -d "$migration_source"
test ! -L "$migration_source"
test ! -e "$migration_archive"
test ! -L "$migration_archive"
test -d "$migration_target"
test "$(git -C "$migration_target" rev-parse --show-toplevel)" = "$migration_target"
test "$(git -C "$migration_target" branch --show-current)" = "$migration_branch"
test "$(git -C "$migration_target" rev-parse HEAD)" = "$migration_baseline"

node "$migration_target/scripts/design-archive-manifest.mjs" check \
  "$migration_source" \
  "$migration_target/docs/plan/migration/source-prearchive-manifest.tsv"
node "$migration_target/scripts/verify-design-migration.mjs" check \
  "$migration_source" "$migration_target" \
  "$migration_target/docs/plan/migration/migrated-files.tsv"
node "$migration_target/scripts/target-change-manifest.mjs" check \
  "$migration_target" "$migration_baseline" \
  "$migration_target/docs/plan/migration/target-change-manifest.tsv"

mv "$migration_source" "$migration_archive"
test -d "$migration_archive"
test ! -L "$migration_archive"
test ! -e "$migration_source"
test ! -L "$migration_source"
```

S0 = source 普通目录、archive 不存在。S1 = source 不存在、archive 普通目录且尚未创建旧路径 symlink。
若 rename 后要立即撤回，且冻结脚本尚未运行，直接 `mv "$migration_archive" "$migration_source"`。

### 5.2 S1 → S2:冻结、建链接与 postcheck

```bash
set -euo pipefail
migration_source=/Users/wangyixiao/WorkSpace/voice-coding
migration_archive=/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729
migration_target=/Users/wangyixiao/WorkSpace/SayDo
migration_baseline=838aeea4385a41ec58318437bb36a7db5ede635f

test ! -e "$migration_source"
test ! -L "$migration_source"
node "$migration_target/scripts/freeze-design-archive.mjs" freeze \
  "$migration_archive" "$migration_target"
ln -s "$migration_target" "$migration_source"

test -L "$migration_source"
test "$(readlink "$migration_source")" = "$migration_target"
test -d "$migration_archive"
test ! -L "$migration_archive"
test -f "$migration_archive/README.prearchive.md"
test -f "$migration_archive/AGENTS.prearchive.md"

node "$migration_target/scripts/design-archive-manifest.mjs" check \
  "$migration_archive" \
  "$migration_target/docs/plan/migration/source-prearchive-manifest.tsv" \
  AGENTS.md README.md AGENTS.prearchive.md README.prearchive.md
node "$migration_target/scripts/verify-design-migration.mjs" write \
  "$migration_archive" "$migration_target" \
  "$migration_target/docs/plan/migration/migrated-files.tsv"
node "$migration_target/scripts/verify-design-migration.mjs" check \
  "$migration_archive" "$migration_target" \
  "$migration_target/docs/plan/migration/migrated-files.tsv"
node "$migration_target/scripts/target-change-manifest.mjs" write \
  "$migration_target" "$migration_baseline" \
  "$migration_target/docs/plan/migration/target-change-manifest.tsv"
node "$migration_target/scripts/target-change-manifest.mjs" check \
  "$migration_target" "$migration_baseline" \
  "$migration_target/docs/plan/migration/target-change-manifest.tsv"
```

S2 = source 是精确指向 SayDo 的 symlink，archive 是带两份原文备份的普通目录。allowlist 后应核验
2085 项不变:原清单的 README/AGENTS 两项被排除，新增的两份 `*.prearchive.md` 也被排除。

### 5.3 中断状态恢复

- source 与 archive 都不存在:停止，先定位目录，禁止重建空目录。
- source 是普通目录且 archive 也存在:停止，禁止覆盖;用非目录条目源清单判定哪一个是迁前源。
- source 是指向其他位置的 symlink:停止，禁止 `ln -sf`。
- archive 已出现任一 `*.prearchive.md`:再次执行 `freeze` 只允许收敛预期的中断状态;脚本会先做
  按当前 original/tombstone/backup/frozen 状态生成动态 allowlist，再校验所有不应变化的条目。
- S1 已冻结但 symlink 尚未创建:先选择继续创建并 postcheck，或按 §7 运行 `unfreeze` 后再复名。

## 6. 验证与独立评审

| 验证 | 当前证据 |
|---|---|
| 源全量清单 | 2087 项，`check` exit 0 |
| 161 项映射 | 10 列清单，冻结后 `check` exit 0 |
| 冻结状态矩阵 | F0–F4 5/5、U0–U6 7/7;解冻后 2087 项逐字节/mode 复原 |
| 拒绝与中断安全 | original/tombstone/backup/frozen 内容、类型、mode 漂移及错误分支/基线在修改前拒绝;detached descendant 可安全解冻 |
| 活动代码/测试/template sibling 扫描 | 0 命中 |
| 无 sibling 的隔离副本完整 CI | exit 0;模板 27/27 passed |
| daemon 针对性回归 | 687 passed / 4 skipped |
| emoji 错误路径与 untracked 自测 | 11/11 passed;覆盖缺少 `rg`、untracked、实体、JS escape 与 lockfile |
| FTS oracle | batch1 19/20;batch2 12/12;“产物库”排序回归保留原判据 |
| 活动 Markdown 本地链接 | docs 评审 GFM AST 29 files / 107 links / 73 local;纳入本迁移记录复跑为 30 files / 73 local，均 0 broken |
| Demo headless Chrome | 两份 HTTP 200;四项关键条件均为 `user_stated→confirmed`;console 0 warning/error |
| 源高置信密钥扫描 | 0 命中 |
| 真实目录切换 | source=SayDo symlink;archive=普通目录;四路径 allowlist 外 2085 项无漂移 |
| 四路 subagent | 清单、运行时、回滚安全、文档/Demo 四个互补视角独立复核;最终 A=0，均为 Go |
| Codex 24 | 初审 3A/8B/2C;3A/8B 全修，C1 修复、C2 登记 |
| Codex 25 | 终审 5A/4B/1C;清单、状态机、路径边界、FIFO、知识兼容、配置与话术问题全部回修 |
| 完整 `just ci` | 迁移提交后发布前回修静止点 exit 0:contracts 73、daemon 700/4 skipped、Python 25、emoji 11/11 |
| 知识底座 | generation 5 complete;候选快照 575 文件;四个 legacy root 链接均指向 `current`;AGENTS 指针一致;内层 knowledge Git clean;外层 index 未变 |
| 最终三份清单 | source allowlist 2085、migration 161、target-change 236，三个 `check` 均 exit 0 |

Codex 24 报告为 `research/codex-findings/24-repo-merge-migration-review.md`。运行日志
`logs/24-repo-merge-migration-review.log` 为 1,194,946 bytes，SHA-256
`721c7feb7fd4b433c1c4b126fc4e2a65141908aee2e21257e8ef297c5ab6ad6f`;报告写入成功后进程长时间无
新增输出，本轮人工终止并记录 exit 1，不把它写成正常退出。

Codex 25 终审报告为 `research/codex-findings/25-repo-merge-final-audit.md`，共 1,087 行 /
44,220 bytes，SHA-256
`320ee9682ed00c3e320582e0bc78fe84f7c9c4c1ccdca61e5780d38a6deaf26e`。Prompt 位于
`prompts/25-repo-merge-final-audit.md`，80 行 / 4,700 bytes，SHA-256
`0e958a9a2325c4359603feda014e0a026d76fa0b346449d2a61092d432ddee44`；日志
`logs/25-repo-merge-final-audit.log` 为 39,217 行 / 2,537,827 bytes，SHA-256
`e0480a97b1a17c67681a60571f609e2b1b6391230369ba8a9ed0dffc732f32aa`。进程 exit 0。

### 6.1 提交后复核

提交后复核由两个只读 subagent 分别从“文件系统/清单守恒”和“Git/活动依赖/可运行性”复算，
两路均为 A=0。共同实证:源 2087 项 = 迁入 161 项 + 冷档 1926 项，冷档 `unknown=0`;
兼容路径跟随后与 SayDo inode 相同，archive 是独立普通目录;活动代码、配置、模板、canonical 与
PLAN-2 对 sibling/archive 的运行依赖为 0;内层 knowledge Git clean。

独立 Codex 26 报告为 `research/codex-findings/26-repo-migration-post-commit-audit.md`，325 行 /
13,181 bytes，SHA-256
`2d960cdae9a5b5867182418c33a35bd00a332bba8733f81f9045411bd4915d29`。Prompt 位于
`prompts/26-repo-migration-post-commit-audit.md`，35 行 / 2,244 bytes，SHA-256
`f9f6bb7acc305f8f6d8bdb06a1daeff800aac77f670e28736746b15b8fef10cf`;日志
`logs/26-repo-migration-post-commit-audit.log` 为 91 行 / 477,296 bytes，SHA-256
`07073af78b1568e46937c49f4234e9aeec61fe711fce3c3736eadf94369e6be7`，进程 exit 0。

Codex 初判 A=0/B=3/C=4、Conditional Go。Triage:

- B1 提交后状态未回写:修正本文件与 HANDOFF，并在 journal 追加 R60;本次未获 commit/push 授权，
  因此回写保留在迁移分支工作树，不冒充已进入远端;
- B2 当前工作树相对旧 target-change 漂移:本轮所有证据落盘后刷新 migration/target-change 两份
  派生清单并复验;原清单对 `f28489d` 的 201 项加清单自身与提交 202 路径严格同集;
- B3 archive 物理可写:已在本节前明确“制度冻结”边界，不擅自 chmod/chflags;
- C1 目录 mode/xattr、C2 本地 nested knowledge、C4 transformed 语义均登记为证据边界;
  C3 的在线远端查询在 Codex 沙箱因本机代理失败，但主会话 `git ls-remote` 实测
  `refs/heads/main=f28489d14af78d67d6ed3d223395d172b7e6056c`;
- GitHub Actions 补入 `scripts/test-migration-tools.sh`;真实 archive 不存在于远端 runner，
  三份生产清单仍由本机迁移审计复核。

## 7. 回滚

### 7.1 冷档与旧路径回滚

S2 回到迁前 S0 的精确顺序:

```bash
set -euo pipefail
migration_source=/Users/wangyixiao/WorkSpace/voice-coding
migration_archive=/Users/wangyixiao/WorkSpace/voice-coding.archive-20260729
migration_target=/Users/wangyixiao/WorkSpace/SayDo

test -L "$migration_source"
test "$(readlink "$migration_source")" = "$migration_target"
test -d "$migration_archive"
test ! -L "$migration_archive"

node "$migration_target/scripts/freeze-design-archive.mjs" unfreeze \
  "$migration_archive" "$migration_target"
node "$migration_target/scripts/design-archive-manifest.mjs" check \
  "$migration_archive" \
  "$migration_target/docs/plan/migration/source-prearchive-manifest.tsv"

# archive 恢复并通过全量校验前始终保留兼容入口；失败时用户仍可继续进入 SayDo。
test -L "$migration_source"
test "$(readlink "$migration_source")" = "$migration_target"
test -d "$migration_archive"
test ! -L "$migration_archive"
unlink "$migration_source"
test ! -e "$migration_source"
test ! -L "$migration_source"
mv "$migration_archive" "$migration_source"
test -d "$migration_source"
test ! -L "$migration_source"
test ! -e "$migration_archive"
test ! -L "$migration_archive"
node "$migration_target/scripts/design-archive-manifest.mjs" check \
  "$migration_source" \
  "$migration_target/docs/plan/migration/source-prearchive-manifest.tsv"
```

`unfreeze` 只会接受预期 original/tombstone/backup/frozen 状态；每个中断态都按动态 allowlist
校验尚未处理或已恢复的 original，恢复 README/AGENTS 原字节并删除临时 frozen copy。兼容 symlink
必须保留到 unfreeze 与源清单复核都通过之后，任何拒绝都不能先让旧入口消失。若进程恰在
`unlink` 后、`mv` 前中断，已经通过 exact check 的 archive 仍完整存在；先按上述 symlink 断言确认
source 确实缺失，再执行 `mv "$migration_archive" "$migration_source"` 并重复末端 source 清单校验，
或者把 source symlink 精确重建到 SayDo 后再择机回滚，禁止创建空目录占位。

### 7.2 SayDo 工作树回滚

`migrated-files.tsv` 只证明 161 个源映射，不能作为 SayDo 全量回滚清单。SayDo 侧依据是
`target-change-manifest.tsv` 所记录的全部 Git 可表示 A/M/D 路径，**不含清单自身**:

- `M` / `D`:从基线 `838aeea` 恢复其精确路径;
- `A`:只在 owner 再次明确授权删除后，按清单逐项移除，并把
  `docs/plan/migration/target-change-manifest.tsv` 自身作为额外一项显式处理；不使用宽泛 glob 或递归工作区清理;
- 迁移现已形成并推送独立提交 `f28489d`;若 owner 明确授权撤销，SayDo 侧使用
  `git revert f28489d14af78d67d6ed3d223395d172b7e6056c`，不得改写既有历史;
- Git 提交回滚与 §7.1 的物理目录回滚是两个动作，分别确认、分别验收，不互相暗含授权。

迁移轮与本次提交后复核都不实际演练 SayDo 工作树回滚;本次复核只回写审计证据，不 commit/push。
