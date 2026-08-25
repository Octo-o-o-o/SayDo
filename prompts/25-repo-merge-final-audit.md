# Codex 25 · SayDo 单仓迁移第二轮终验

你是独立对抗性审查者。请在 `~/WorkSpace/SayDo` 对已经执行的
`voice-coding → SayDo` 单仓迁移做第二轮终验。不要相信 MIGRATION、journal、上一轮 Codex 或
subagent 的自报，所有事实必须亲自读文件或运行只读命令核验。

## 写入边界

- 除最终报告 `research/codex-findings/25-repo-merge-final-audit.md` 外，禁止修改任何文件。
- 禁止 commit、push、pull、rebase、reset、clean、删除、解冻或改动真实 archive/symlink。
- 可在 `/private/tmp` 创建隔离副本做故障注入与回滚演练。
- 报告使用简体中文，给出实际命令输出、文件:行号、A/B/C 分级及明确 Go/No-Go。

## 冻结坐标

- Git 根:`~/WorkSpace/SayDo`
- 分支:`codex/merge-voice-coding-20260729`
- HEAD/基线:`838aeea4385a41ec58318437bb36a7db5ede635f`
- 旧兼容路径:`~/WorkSpace/voice-coding`
- 冻结目录:`~/WorkSpace/voice-coding.archive-20260729`
- source manifest:
  `docs/plan/migration/source-prearchive-manifest.tsv`
  SHA-256 `4f195260f116d2e96dcafd3594080079c13e94ecee119f548d91cfb0747d274a`
- migration manifest:
  `docs/plan/migration/migrated-files.tsv`
  SHA-256 `d3642de4d6e7adf4dd0c753c26b5a4a1159d457a38fe44e78ca70aaf337d55bb`
- target-change manifest:
  `docs/plan/migration/target-change-manifest.tsv`
  SHA-256 `eb4c76664c7fe1cc9e290f59a0a679778a327250715750eb40170494ff025a5a`

## 必审范围

1. **物理切换与库存**
   - 旧路径是否为精确指向 SayDo 的 symlink，archive 是否为普通目录。
   - 源 2087 项/181,286,599 bytes/type/mode 是否完整，冻结四路径外 2085 项是否无漂移。
   - 161 映射是否路径唯一、摘要/字节/mode/physical fallback 可独立复算。
   - target-change 是否覆盖本轮所有 A/M/D，是否有漏项、误入依赖/日志/缓存、大文件、symlink 越界。
   - 冷档分箱是否 unknown=0；迁入与冷档是否覆盖全部源项且无重复遗漏。

2. **切换、冻结与回滚安全**
   - 审查四个迁移脚本和 `docs/plan/MIGRATION.md` 的命令链。
   - 检查精确路径/Git 根/分支/基线/manifest identity、特殊类型、fail-fast、allowlist。
   - 在隔离副本演练 freeze/unfreeze、重复运行、中断状态、backup 内容或 mode 漂移、错误 symlink、
     错误目标与特殊文件，确认所有危险情况修改前拒绝。
   - 证明回滚后 2087 项 SHA/bytes/type/mode 精确复原；SayDo 侧回滚范围由 target-change 全量覆盖。

3. **单仓自包含与质量门**
   - 扫描运行代码、测试、e2e、scripts、templates 与活动入口是否仍依赖 sibling `voice-coding`。
   - 在没有 sibling 的隔离副本中验证 install/config/template/关键测试或完整 `just ci`。
   - 核验配置模板与当前 pipeline 的 ASR/TTS 凭据及默认音色一致。
   - 核验 emoji 默认门禁覆盖 cached+untracked，错误路径 fail-closed。
   - 核验 FTS 原 oracle 19/20 的记录没有被再次放宽或伪装成满分。

4. **文档、canonical 与知识底座**
   - README/AGENTS/HANDOFF/PLAN-2/MIGRATION/research/history 是否都把 SayDo 定为唯一活动仓。
   - PLAN-2 唯一排产、单批串行、工程/设计 ADR 双序列、活动 Markdown 链接是否一致。
   - 历史绝对路径与隐私取舍是否如实登记；不得把历史证据中的旧路径误判成活动依赖。
   - `.saydo/knowledge` generation/current/current.json/AGENTS/core/conventions/inventory/inner Git 是否一致，
     572 是否正确解释为最终候选 Git index。
   - R58 是否记录输入/行动/评审/产出/结论，且未把未运行项目写成通过。

5. **最终可交付性**
   - 亲跑三个 manifest check、`git diff --check`、四脚本语法、全候选 emoji、Markdown 本地链接、
     高置信密钥与异常大文件检查。
   - 能安全运行时亲跑 `just ci`;若不运行必须明确说明，不能外推旧结果。
   - 检查实际 Git index、commit/push 边界与 target-change A/M/D 计数。

## 分级与收口

- A:数据丢失、错误目标修改、不可完整回滚、清单漏项、活动仓仍双写、证据伪绿。
- B:会误导后续开发/部署、质量门覆盖缺口、活动文档或配置语义漂移、重要证据不可复验。
- C:不阻断但值得修的表达/维护性问题。

报告最后必须列:

1. A/B/C 总表；
2. 三份清单与物理状态的亲测结果；
3. 尚未验证的项目；
4. 明确的最终结论:`Go`、`有条件 Go` 或 `No-Go`；
5. 若不是无条件 Go，给出最小修复与复验命令。
