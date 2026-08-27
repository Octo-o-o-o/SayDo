# RC4 公开隐私 fresh session 首次 readback 红灯返工

继续 prompt 169 的原 fresh 实施会话。两路零上下文独立复审均为 No-Go；这是该 fresh session 的首次红灯。只在当前 worktree 修下列可复现项，不提交、不推送、不联网、不发布，不修改用户原始 dirty worktree。

最高规则不变：`history/PROCESS-JOURNAL.md` 已有正文必须与 HEAD 原字节一致。错记只能在受校验的结构化 catalog/erratum 中显式纠正，绝不能回写旧行。

## P1-A：home detector 必须覆盖完整 profile，不得只删前缀

当前复杂 bare home 在 EOF 时虽命中，但只替换 profile 前缀，残留身份后半段；二次扫描因此假绿。已复现：macOS profile 含空格/点，Linux profile 含空格，Windows profile 含空格/括号，均 `redacted=true,residue=true`。

验收：

1. strict、loose、Git path、binary projection 与 redaction 使用同一完整 range 语义；不能只比较 hit count。
2. 覆盖空格、连续空格、点、平衡括号、下划线、数字、Unicode profile，以及 EOF、空白、逗号、句号、分号、冒号、感叹号、问号、单双引号、反引号、右括号等终止符。
3. 每例断言完整 profile range、脱敏后无任一 profile 残片、外部终止标点保留、二次扫描零命中、二次 redaction 幂等。
4. `Shared/Public/Default`、占位符、类别说明、相邻非 home 文本仍是负例；fixture 运行时分段组装，失败输出不得回显样例。

## P1-B：隐私门禁失败也不得泄漏 path/name

当前 scanner 把 Git stderr 拼入错误，sanitizer 只认识当前 home/account；publisher 在 private probe 命中时直接 `git grep -lE` 回显路径。

验收：

1. 所有 Git/文件读取故障只输出固定操作类别、受控错误码与退出码；不得包含原 stderr、cwd、path、basename、home/profile 或 sentinel。
2. private-probe 命中只输出命中计数与不可逆 path ID；不得输出 `git grep -l` 原路径。路径 ID 算法固定、碰撞预算合理，不能让失败信息反推出原 path。
3. fake git stderr、合成候选文件名与 home/path/name sentinel 的 hostile tests 必须断言 stdout/stderr 零原文、零 strict/loose privacy hit。
4. 不得通过吞掉 Git 非零、把执行失败当零命中或删除 private probe 门禁来达成。

## P1-C：filesystem publication scan 必须比较 working/index/HEAD 内容

当前默认 `--fs` 显式 `requireContent:false`，只改 working 内容但 mode/index/HEAD 不变仍 exit 0。

验收：默认 filesystem publication gate 必须启用 exact blob comparison，并分别拒绝 working↔index、index↔HEAD、content+mode 同时漂移；继续拒绝 symlink/non-regular/stage conflict。scanner 读取与最终拟发布索引必须是同一内容身份，不得只扫其中一个视图。

## P1-D：current artifact 必须从同一安全 fd 验证

`currentFingerprint` 用 `statSync` 跟随 symlink，identical-target symlink 会假绿。

验收：

1. 路径及必要祖先先以 `lstat`/等价 no-follow 方式拒绝 symlink、目录、设备和非普通对象。
2. 以 no-follow 打开的同一 fd 读取，前后 `fstat` 核对 regular、dev/ino、mode、nlink、size 不漂移；不得在 stat 与 read 间按路径重开。
3. identical-target symlink、悬空 symlink、目录、FIFO/设备、open 后替换均 fail-closed；正常 current fixture 通过。

## P1-E：冻结全部 journal occurrence inventory，新增 token 必须红

当前只 catalog 49 个 unverifiable；无 path/stats 的新裸 SHA 会按当前树唯一 hash 自动变成 checked，新合法 claim 或 release-config 也可直接放行。

验收：

1. catalog 必须冻结当前全部 143 个 occurrence 的 offset、line、digest、预期类别，以及该类别需要的 path/stats/reason/context identity。任何新增、删除、移位、重复、大小写变化或未登记 occurrence 一律 fail-closed，即使它恰好等于当前 AGENTS.md 或完整合法 claim。
2. 普通裸 SHA 绝不靠 unique-current reverse lookup 自动冒充 artifact claim；所有 checked/excluded/skipped 均需 catalog inventory 与 parser/mechanical proof 双重一致。
3. catalog entry 必须 exact-key schema、全局唯一；line/offset 不可选。对无法可靠解析的历史项绑定可重算的规范化上下文 SHA-256，防同宽 stats/path 漂移、上下文重排或 token 移位。

## P1-F：checked 必须 exact path + lines + bytes + SHA；旧错记显式 erratum

当前 `statsMatch` 接受 `claim.lines === actual.lines + 1`，且 16 个 checked occurrence 缺 line 仍放行。真实 journal 至少三条错记：1584 记录 40 而可达 blob 为 39 行/2260 bytes；1585 记录 147 而可达 blob 为 146 行/12165 bytes；1586 记录 13 而当前文件为 12 行/1211 bytes；hash 均相同。

验收：

1. checked-current/historical 只能在 journal claim 与安全实测的 exact path、lines、bytes、SHA 全部相等时成立，不允许 +1 或缺字段。
2. 上述三条不得改 journal，也不得继续计入 checked。以 catalog 中 exact occurrence/context、记录值、实际值、可达 commit/path/blob 与固定 erratum reason 显式列为 `historical-unverifiable` 或单独的非 checked correction 类别；汇总必须独立显示，不能冒充 `drift=0` 的 checked 证据。
3. 其余缺 path/line/bytes 的 occurrence同样不能称完整 checked；若原事实无法补证，进入有 context identity 的 honest unverifiable/correction，而不是猜测。
4. 未登记 mismatch 仍是 unresolved/drift 并 exit 1；只有逐项冻结、可复核的 immutable erratum 才可使总门禁通过。

## P1-G：两条真实历史 blob 必须从 unverifiable 转为 checked-historical

独立复核已找到：journal line 940 的 prompt 29 digest 在 commit `f0900784...` 的 `prompts/29-project-status-final-review.md` 可达（43 行/2213 bytes）；line 1158 的 report 47 digest 在 commit `e92566f...` 的 `research/codex-findings/47-t17-truthful-firstrun-review.md` 可达（84 行/10402 bytes）。完善 parser/catalog binding，独立通过 exact path/stats/SHA 验证，不能继续列 unverifiable。

## P1-H：historical-unverifiable 必须绑定完整事实

当前只按 offset/hash（line 还可选）查表，未比较解析出的 path/lines/bytes/reason；同位数 stats 漂移仍假绿。

验收：每条强制 exact line、offset、path（含显式 null）、recorded lines/bytes（含显式 null）、digest、枚举 reason、context SHA；parser 可得字段必须与 catalog exact 相等。补 path/stats 同宽漂移、上下文重排、token 移位、reason/nullable 字段漂移反例。

## P1-I：redaction map 必须强绑定 policy 与非自引用 manifest

当前 `policySha256`、`manifestSha` 可缺，错误 manifest 也能得到 checked-redaction-map。

验收：

1. 设计无哈希自引用的独立 redaction manifest/规范化 identity；每个 map entry 强制 exact policy path+SHA、manifest path+SHA/identity、artifact path、原/现 SHA 与原/现 lines/bytes。
2. 缺失/错误 policySha、manifest、manifest identity、额外字段、路径漂移全部 fail-closed。保留原摘要可达历史验证与当前脱敏文件验证。
3. 当前 map 为 0 也必须有 hostile fixture 证明完整正例和上述负例，不能靠空集合跳过合同。

## P1-J：四个生产 HTML 只能做受约束 availability transition

当前 `isAllowedEvidencePath` 对四个 deploy HTML 仅按路径放行，边界后可注入任意 `<script>` 并冒充证据。网站发布又确实需要 post-release candidate→available 文案变换，因此不能简单放宽，也不能静默删除官网更新。

验收：

1. 四个 HTML 从通用 evidence path allowlist 移除。边界后只有一个单 parent、受机器验证的 availability transition 可修改它们。
2. 每个变更必须从冻结 candidate blob/内容精确变成冻结 available blob/内容，只允许 `post-release-gate` 已登记 replacements；mode、其它字节、文件集合与 parent/child identity 精确验证。
3. 任意 script/style/attribute/text 额外字节、漏页、多页外 HTML、重复 availability transition、merge 携带、从错误 before 状态开始，全部算 implementation leak。
4. 抽出无副作用的共享 availability spec 或冻结 before/after blob identity，避免 validator import 有执行副作用的 deploy 脚本。补 exact transition 绿例与 `<script>`/单字节漂移红例。

## P2：历史 prompt/report 必须最小脱敏并保留链接

当前 27 个历史 prompt/report、573 个变更行均不是对 HEAD 的最小 redaction；有效 Markdown links 被改成普通文本，link 门禁因此看不见“链接消失”。

验收：

1. 先逐文件恢复到 HEAD 原内容，再基于最终 detector 做最小、可重放变换；只改敏感 home/profile 或把仓内绝对 destination 规范成存在的 repo-relative destination。
2. 保留原 label、Markdown link/image 结构、非敏感 link multiset、段落与换行。变换后所有 destination 均存在或属于明确外部/锚点；不能靠删除链接、改 inline code、整段重写规避。
3. 增加对全部受改历史文件的机械证明：diff 等于规范化 redaction 变换；非敏感链接 multiset 完全一致；链接数不能下降；doc-links 仍 0 broken。

## P2：删除生产可达的 journal rewrite 能力

CLI `--write` 已拒绝，但 `rewriteJournalDigests()` 仍导出且自测把改写旧正文当正例。删除该生产 export/实现，或隔离为测试私有且无法接受真实 journal；测试改为断言不可改。任何脚本不得调用历史正文 rewrite。

## 必跑门禁与报告

保留 prompt 169 的全部门禁，并新增：

- hostile complex-home range/residue corpus；
- fake-git/private-probe zero-leak；
- current symlink/non-regular/open-swap；
- working/index/HEAD content drift；
- full 143 inventory 与 append/delete/move/new-valid-claim/new-release-config；
- exact stats 与三条 erratum；
- 两条 reachable historical；
- unverifiable context drift；
- redaction manifest identity；
- availability exact transition/script injection；
- 历史 Markdown link multiset/minimal transform。

最终必须报告真实 occurrence 总数与所有类别计数；明确列出 checked、skipped、excluded、unverifiable/corrected、unresolved、drift、unknown、duplicate。不得把 unverifiable/corrected 算进 checked 或写成“全部历史事实验证通过”。
