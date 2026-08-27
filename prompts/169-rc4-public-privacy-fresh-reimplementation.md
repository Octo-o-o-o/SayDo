# RC4 公开隐私与 journal 摘要：全新会话重做

你是新的 `grok-4.6` 实施会话。上一实施会话在同一批发布级 P1 上第二次独立复审仍红，按仓库制度已废弃；不要 resume、不要继承其推理或替它辩护。只以当前 `<repo>` worktree、仓库规则和下述可复现验收目标施工。

只修改当前 `<repo>` worktree；不要 commit、push、联网、发布、部署、SSH 或启动 subagent；不要修改用户原始 dirty worktree。现有公开脱敏、batch-check、53/54 指纹与其他已绿修复必须保留，除非与本 prompt 明确冲突。

## 最高优先语义：历史正文不可改

`history/README.md` 明定 `PROCESS-JOURNAL.md` 已落盘轮次“正文一律不改”，`docs/06-references.md` 定义它为过程真相源。当前 patch 对该文件做了 71 删/71 增，把旧时点摘要改成当前脱敏副本摘要，违反规则且把多个历史时点压成同一终值。

必须先把 `history/PROCESS-JOURNAL.md` 的已有正文恢复为当前 HEAD 的原字节；不得改写任何既有轮次来让门禁变绿。若确需记录本轮映射，只能用新的追加式记录或独立受校验的结构化分类/映射产物，不得覆盖旧事实。真实错记只能追加 erratum/supersede，不能改旧行。

## P1-A：工作区文件 mode 必须纳入三视图一致性

公开树隐私检查现已比较 HEAD/index/working 的 kind/content，但 working 普通文件的执行位未与 index/HEAD 比较。独立复现把 100644 文件只在 working tree 改为 0755，检查仍 exit 0。

- 将 working 普通文件 mode 规范成 Git mode `100644`/`100755`，与 index stage-0 和 HEAD 精确比较；symlink/non-regular/staged-conflict 继续 fail-closed。
- 补 0644→0755、0755→0644、content 不变 mode 漂移、合法一致 mode、symlink/stage 冲突回归。

## P1-B：裸 home 在字符串末尾/终止标点不得漏检

macOS、Linux、Windows home detector 当前要求后面还有路径分隔符，裸 home 位于 EOF 时 strict/loose/git/binary/redaction 都可返回 0。

- 单一 detector 语义覆盖 home 后为 EOF、空白、常见终止标点/引号/括号，以及正常子路径；Windows 匹配按平台语义大小写不敏感。
- strict、loose、Git 三视图、binary projection 与 redaction 全链补正例；补相邻用户名/占位符/类别描述负例；redaction 要幂等且不残留完整 home。
- fixture 只能运行时分段组装，不得把真实 home、私网地址或设备标识写进待提交文件和失败输出。

## P1-C：journal 的每个 64hex 出现都必须恰好分类一次

独立扫描现有 journal 共 143 个 64 位摘要出现；当前 parser 只产生 90 个 claim，静默遗漏 53，其中至少 32 个是真实仓内 artifact、14 个是日志、7 个是 release/config/build/sourceRevision 等非当前文件身份。当前 `claims=90 ... unresolved=0 drift=0` 因此是假绿。

必须以“每次出现的位置”为 identity，而不是以 hash 值去重：

1. 枚举 journal 全部 digest-shaped 64hex token；每个出现必须恰好落入 `checked-current`、`checked-historical`、`checked-redaction-map`、`skipped-log`、`excluded-non-artifact`、`historical-unverifiable`、`unresolved/drift` 之一。汇总总数必须与 token 出现总数严格相等，未知格式 fail-closed。
2. `checked-current` 必须由当前普通文件的 exact path + lines/bytes/SHA 实测成立。
3. `checked-historical` 必须找到可达 Git 历史中的 exact path/blob，并验证记录的 lines/bytes/SHA；不能因“看起来像旧值”就放行。
4. `checked-redaction-map` 必须由受校验的发布映射同时绑定原摘要、当前脱敏摘要、路径与 redaction policy/manifest 身份；不能只认其中一个 hash。
5. 少数未进入任何现有 ref 的旧中间态不得改写为当前值。若确实无法复原，显式列为 `historical-unverifiable`，绑定 occurrence line/offset、path、旧 stats/digest 和原因；报告独立计数，绝不能计入 checked 或 drift=0 的证据。新增/漂移 occurrence 必须使静态登记失配并 fail-closed。
6. 非 artifact digest 也要有窄类别和机械依据；普通裸 SHA 引用不能被误认成某个附近 artifact claim。

独立遗漏清单至少覆盖这些形态：`docs/09`、report 25、prompt/report 29/47、attempt1、三处 `remote-mobile-w0.md`、`docs/11`、`HANDOFF.md`、PLAN-2、full-acceptance 五份产物、prompt 76、86/87 号成组产物、`cmdeffect-hardening.md`，以及 14 个日志摘要。不要只为这些行写特判；要以全量 token 不变量防将来再漏。

## P1-D：相同 hash 与日志 skip 不得错归属

- 相同 prompt/report hash 的合成反例当前会把两条都归到 prompt。解析必须使用捕获组的精确 start/end offset；同 hash 多次出现仍是不同 occurrence，各自绑定自己的 path/stats/context。
- `logs/../prompts/...` 当前会因字符串前缀被 skipped。所有路径先做纯语法规范化并拒绝绝对路径、NUL、`..` 和逃逸；日志 skip 只允许精确日志文件路径，并机械证明它位于允许的 logs 根、未 tracked 且确实被 ignore。
- 裸 `logs/` 或没有可归属文件名的泛化摘要不能算 skipped；必须 unresolved 或显式 `historical-unverifiable`，并报告原因。
- 增加 same-hash prompt/report、路径穿越、tracked logs、未 ignore logs、bare logs、duplicate occurrence、未知 raw 64hex 回归。

## 已绿合同不得退化

- batch-check 的三态/内部错误无 fallback，index symlink/stages/kind/content 检查，53/54 四个当前脱敏副本指纹归属，公开提交链逐 commit 检查，prompt 隐私零命中。
- 不得把当前缺 final implementation boundary 导致的 `--check`/`--check-bundle` 预期红灯写成通过，也不得创建最终 boundary。

## 门禁

逐条运行并真实报告 exit 与摘要：

```text
node scripts/test-public-tree-boundary.mjs
node scripts/test-public-text-redaction.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-journal-digests.mjs
node scripts/check-journal-digests.mjs
node scripts/test-ios-artifact-policy.mjs
node scripts/test-release-provenance.mjs
node scripts/check-public-tree-privacy.mjs
node scripts/check-doc-links.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
git diff --check
actionlint .github/workflows/ci.yml
```

另报告：journal 64hex occurrence 总数和各分类数（`historical-unverifiable` 不得冒充 checked）、未知/未分类/重复归属数、mode 正反例、裸 home 各链结果、公开扫描文件/二进制/排除/命中数。不得回显隐私样例、绝对路径或本机身份。
