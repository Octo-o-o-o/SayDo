# RC4 public/privacy 第二次红灯：全新会话事实绑定与边界重做

你是全新的实施会话。不要读取任何 Grok/Codex/评审日志，不要 resume 旧会话，不要提交、推送、联网或触碰用户原始 dirty worktree。只在本文件所在 worktree 施工。

先完整读取适用 `AGENTS.md`、`prompts/169-rc4-public-privacy-fresh-reimplementation.md`、`prompts/176-rc4-public-privacy-fresh-readback-return.md` 及当前实现。当前真实 journal/catalog 数据大体正确，但独立 hostile readback 证明校验器可被伪造。以下 P1 必须全部机械关闭，不能靠当前样本假绿。

## 1. home range 与四视图计数必须同一语义

- 为 macOS `/Users/<profile>`、Linux `/home/<profile>`、Windows `C:\\Users\\<profile>` / `C:/Users/<profile>` 定义一套明确、可测试、最小脱敏的 profile segment grammar。
- 同时覆盖合法的空格、连续空格、点、括号、Unicode、数字、下划线、连字符 profile，以及普通空格/Tab/ASCII 标点/常见 Unicode 标点后接外部文本的终止。
- 必须新增并通过两类相反 fixture：
  1. 合法含空格 profile 被完整替换且零 residue；
  2. 简单 profile 后的普通空格 + 外部文本和 8 种常见 Unicode 终止标点后的 suffix 原样保留。
- 若裸 home 在 EOF 的空格归属存在歧义，必须在代码注释/测试中给出确定规则；不得用无限扩展到整句解决。优先用后续 path separator、引号/边界、已知 profile probe 等可证明信息识别含空格 segment。
- 同一输入中每个绝对 home occurrence 在 strict、loose、git-path、binary projection 的 category/count 必须一致；当前 Git 路径重复计数必须消除。二次扫描 clean，redaction 幂等。

## 2. `--fs` 三视图 exact-set 必须拒绝 untracked

- working/index/HEAD 必须 path exact-set + mode + content exact。不能只遍历 index/HEAD 并集后把 clean untracked 当普通扫描输入。
- 任意 `git ls-files --others --exclude-standard` 结果都要受控 fail-closed；文件名/路径/用户名不得出现在 stdout/stderr，只允许稳定错误类别与 32hex path ID。
- hostile fixtures：clean untracked、index-only、working-only、content drift、mode drift、symlink/stage conflict 全部拒绝；干净已提交树扫描为绿。

## 3. journal exception 必须机械证明事实

### erratum

- `historical-erratum` 不能由 catalog 覆盖 mechanical mismatch。
- catalog 每条 erratum 必须同时冻结 journal 记录值与真实 `actualPath`、`actualLines`、`actualBytes`、`actualSha256`、reachable commit SHA、Git blob identity。
- verifier 必须从指定 reachable commit/path 读取 blob，重算 Git blob、lines/bytes/SHA-256，并证明 reason：`erratum-line-count` 只能 lines 不同且 bytes/SHA 与记录一致；bytes/hash 或其它事实不符必须 fail-closed。
- 当前 line 1584/1585/1586 的真实值分别为 39/2260、146/12165、12/1211，commit `f0900784f354e3c5b72b0c238bc4b2bfb98cd212`；不要盲抄，自己用 Git 重算后写 catalog。

### unverifiable

- 每一种 reason 都必须有机械、互斥语义，不能只核 occurrence identity/context：
  - reachable hash/path 但 journal 缺 exact stats，应证明可达与缺失字段，归 incomplete-stats；
  - journal 无 path，应证明 parser 事实为 missing-path/bare，而不能声称 unreachable；
  - 声称 unreachable 时必须按完整 reachable history/path/blob 搜索证明没有 exact tuple，且不能忽略内部 mismatch。
- catalog reason 与机械分类不符、可达项伪装 unreachable、不存在 blob伪装 erratum、错误 actual stats、未消费 mismatch，全部 `failClosed=true`。

### redaction map / inventory

- `redactionMap` 每项必须被恰好一个 occurrence 消费；无效、无人引用、重复或 extra entry 一律 fail-closed，禁止 `filter()` 静默丢弃。
- original claim 的 lines/bytes/SHA 必须与 map original identity exact；只对 SHA 不对 stats 不得 checked。
- policy + 独立 manifest 的 path/SHA/bytes（如 schema 需要）完整绑定。
- 143 occurrence exact inventory、新增/删除/移位/new valid claim/new release-config、same-hash prompt/report 等现有合同不得回归。

## 4. safe regular file 增加真实 open-after-replace 竞态

- 保留祖先 `lstat`、`O_NOFOLLOW`、同 FD 读、前后 `fstat` 与最终 path inode 校验。
- 增加可重复 hostile fixture：文件 open 后、read/fstat/path recheck 前替换路径对象，必须以受控 `current-file-replaced`（或 canonical 等价）拒绝，读取不接受替代 bytes，FD/临时对象全部清理。

## 5. availability transition 冻结 before/after blob

- 四个 production HTML 继续不得进入通用 evidence allowlist。
- 为这一次 RC4 candidate→available 转换冻结 exact path set，以及每页 before/after 的 SHA-256、bytes（需要时 Git blob/mode）。validator 必须证明 parent 恰为 canonical before，child 恰为 canonical after，且只发生一次单 parent 变换。
- parent 预埋额外 `<script>` 后再做文字替换必须拒绝；wrong-before、wrong-after、单字节漂移、漏页、重复 transition、额外 path 全部拒绝；四页真实 canonical candidate→available 正例通过。

## 6. 历史 Markdown 只做隐私相关最小变换

- generic transformer 只能改 privacy-sensitive destination（仓内绝对 home path → 存在的 repo-relative；仓外 home path → 明确 external/非本机身份形式）。
- 无隐私的 relative destination 必须 byte-for-byte 保留，即使它当前 broken；禁止 generic transformer 把它改成 `file://`，也禁止测试 canonicalizer 剥 scheme 制造假绿。
- 必须断言所有非敏感 destination multiset 原样不变、link count 不变、正文除目标 span 外不变。
- 若 04/24 等历史链接需因仓库迁移修复，使用少量明确、可审查的路径映射并证明目标存在；不能把不存在路径伪装成 external。重新从 HEAD 生成 corpus，保持最小 diff。

## 7. 删除 production rewrite 能力并补 CI

- 从 production `journal-digest.mjs` 删除 `rewriteJournalDigests` export/实现；测试改为验证 CLI `--write` exit 2 与 journal 前后 blob/SHA 不变，不从 production import rewrite。
- `.github/workflows/ci.yml` 与本地等效门禁必须实际运行 `test-historical-markdown-redact.mjs`、open-swap hostile、journal hostile fixtures。

## 必跑门禁

至少运行并如实报告：public-tree boundary、public-text redaction、public-tree privacy、journal self-test/check、historical Markdown、week-audit boundary、doc-links、iOS policy、release provenance、typecheck、lint、emoji、`git diff --check`、actionlint。

未提交树的真实 `--fs` 因三视图不一致应受控 exit 2；请另建完全隔离的临时已提交副本证明同一扫描 exit 0，且不改当前 worktree 的 Git 历史。不得把预期 dirty 红灯写成“全绿”。
