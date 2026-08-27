# RC4 公开边界、journal 与路径隐私：独立复审返工

你在原 `grok-4.6` 实施会话中继续施工。只修改当前 worktree；不要 commit、push、发布、部署，不要创建最终 implementation-boundary JSON，也不要改用户原始 dirty worktree。

本轮输入来自一个与实施零上下文的独立只读复审。复审结论为 No-Go：P1=5、P2=1。下面每一项都已有真实 Git 图或合成输入复现，必须逐项修复并加回归，不得通过放宽规则、吞异常、按报错字符串猜测或让生产代码依赖测试环境变量来变绿。

## P1-1：对象判型失败不得降格为 public

当前 `scripts/implementation-boundary.mjs` 的对象判型会吞掉 `git cat-file -t` 的任意失败；非 commit 对象和 Git 操作故障都会被当作“对象不存在”，然后尝试 public fallback。已复现：注入判型命令失败仍返回 `public_snapshot`；boundary 指向真实 blob 也返回 `public_snapshot`。

必须实现严格三态：

1. boundary SHA 对应 commit：只走 internal 协议；internal 任一失败都不得回落 public。
2. SHA 明确不存在于对象库：才允许继续验证完整 public snapshot 协议。
3. SHA 对应 blob/tree/tag、Git 命令失败、异常输出、重复/含糊输出：一律 fail-closed。

优先采用一次成功命令内可表达 `missing` 的 Git 协议，例如校验 SHA 后经 stdin 调用 `git cat-file --batch-check`，严格解析 `<sha> <type>` 或 `<sha> missing`；不要继续把非零退出码同时解释成“缺对象”和“命令坏了”。新增至少这些回归：真实 commit、真实 blob、tree、tag、明确不存在 SHA、命令启动失败、非零退出、畸形/多余输出。所有错误路径不得泄漏后再进入 public。

## P1-2：working tree、index、HEAD 三方类型与内容必须完全一致

当前只检查 working tree 与 HEAD 的 mode；index 只比 blob SHA。已复现：把 index entry 改成 `120000` 且复用同一 blob，working tree/HEAD 保持普通文件，仍被接受。

必须严格读取 index stage/mode（可用 `git ls-files --stage -z -- <fixed-path>` 或等价无歧义接口）：

- 恰好一个 stage 0 entry；不得有 stage 1/2/3、多 entry、缺 entry或解析残留；
- index 与 HEAD 均为允许的 regular-file mode，且二者 mode 合同一致；symlink、submodule 和特殊 mode 一律拒绝；
- index blob、HEAD blob、working tree 实际字节三方一致；working tree 本身必须是普通文件且不得经 symlink 逃逸；
- Git 命令或解析失败一律抛错。

新增 mode `120000`、非零 stage、多 stage、mode/blob 不一致、缺 index entry 的真实仓库回归。

## P1-3：journal digest 不得跨轮错绑或漏掉应校验 claim

已确认 `history/PROCESS-JOURNAL.md` 的 53 号 prompt/report 误写成 54 号产物摘要：53 实际为 27 行/2613 bytes 与 81 行/8159 bytes，而 journal 写成 53 行/4213 bytes 与 168 行/16258 bytes；现有门禁仍报告 `claims=61 checked=52 skipped=9 drift=0`。journal 中有大量 SHA-256 字面量，当前解析器只覆盖其中一部分，并通过向前 500 字符模糊找编号导致跨轮绑定。

必须：

1. 修正 journal 中 53 号 prompt/report 的行数、bytes、SHA-256，使其与当前真实文件一致；不要复制 54 数据。
2. 重构 `scripts/journal-digest.mjs` 为局部、显式、可判定的 claim 解析；支持“53 prompt/53 报告”这类编号在路径/摘要前出现的现有格式，但不得从任意 500 字符窗口猜最近编号。
3. 每一条本仓 prompt/report/评审产物的“路径 + lines/bytes/SHA-256”摘要必须唯一归属 checked、具有明示合法理由的 skipped，或使门禁报 unresolved；不得静默漏掉、跨条借号或让相邻 53/54 串线。普通文字中仅作引用而非产物摘要的 hash 可以按清晰规则排除，但规则和测试必须能解释。
4. 增加相邻 53/54、相同字段、编号前置、编号缺失、重复/含糊 claim、错误 lines/bytes/hash 的回归；至少一个回归必须证明旧实现会误绿而新实现拒绝。

重新运行真实 journal checker，并报告 claims/checked/skipped/unresolved/drift；只有 drift=0 且 unresolved=0 才算通过。

## P1-4：用户 profile 必须匹配到完整路径分隔符

当前字符白名单会漏掉 POSIX `_svc`、Windows 数字开头 profile；对连续空格或括号 profile 只替换首段，留下账户残片，而残片二次扫描又为 0 hit。

统一修复 `scripts/public-text-redaction.mjs` 及 scanner 使用的同一权威 helper：

- POSIX Users 段与 home 段后的 `<profile>` 必须取到下一个 `/`；Windows Users 段后的 `<profile>` 必须取到下一个 `\\`，不得用字母数字白名单截断；
- 覆盖数字、下划线、连字符、点、连续空格、括号与 Unicode profile；
- 仅在完整 profile 段精确等于明确允许的系统共享账户（现有 `Shared`/`Public`/`Default` 合同）时排除，不得用前缀排除；
- replacement 必须移除完整 profile 且保留可用路径形状；再次 redaction/scan 必须幂等且零残留；
- 文本、路径名、binary/排除模式使用相同核心判定，scanner 不得因 redactor 同样漏检而自证清白。

增加上述所有反例，以及 profile 后有空格、括号、Markdown 标点但路径分隔符仍明确的用例；不得把真实本机身份写进 fixture 或输出。

## P1-5：public snapshot 链的每个 commit 都必须是合法 snapshot

当前只严格验证 baseline 与 HEAD，中间 commit 仅做 path allowlist。已复现：合法 public baseline → 普通非 snapshot evidence commit → 合法 current snapshot，仍返回 `public_snapshot`。

必须从唯一 baseline 到 HEAD 逐 commit 验证完整链：

- 每个 commit 都满足同一 SayDo public snapshot subject/body/trailer/tree/filter 合同；不得只验证首尾；
- 每个 commit 只能有 0 或 1 个 parent，parent 必须与链中上一合法 snapshot 精确衔接；merge、分叉、多个 baseline、普通 evidence 外壳、畸形 metadata 一律拒绝；
- 每一步 tree/allowlist/privacy/实施泄漏检查都 fail-closed；不得让后一个合法 snapshot 洗白中间普通提交；
- 继续保留已通过的普通/root/merge/octopus 逐 parent 路径并集防泄漏能力。

新增合法多代 snapshot 链、普通中间 commit、merge、错误 parent、错误 metadata、错误 tree/filter、多个候选 baseline 的真实 Git 图回归。

## P2：未跟踪 prompt 也必须先脱敏

`prompts/110-rc4-release-cloudflare-real-readback-return.md` 仍有 1 个 macOS home 与 1 个 operational UUID 命中。只在该 prompt 中用语义占位符（如 `<repo>`、`$HOME`、`<session-id>`、`<device-id>`）替换，保持命令/验收含义。随后扫描本 worktree 全部准备提交的 prompt；对 146/157 等文件中的真实 session/device UUID 也做同样处理，若是明确的合成测试 fixture 则保留并在扫描规则中有可审查依据。不得回显原身份值，不得使用 `git add -A`。

## 验收标准与门禁

除新增针对性 fault probes/真实 Git 图回归外，必须逐条运行并真实报告 exit code 与摘要：

```text
node scripts/test-week-audit-boundary.mjs
node scripts/test-public-text-redaction.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-journal-digests.mjs
node scripts/check-journal-digests.mjs
node scripts/test-ios-build-and-install.mjs
node scripts/test-release-provenance.mjs
node scripts/check-doc-links.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
git diff --check
```

另用隔离临时仓库证明五个 P1 的原始复现全部从“错误接受”变成拒绝，并证明合法 internal/public 两种路径仍被接受。扫描完整候选树与全部准备提交 prompts，命中必须为 0；不要只扫描 tracked HEAD。

`week-audit --check` 与 `--check-bundle` 在最终 boundary JSON 尚未创建时只允许因为该文件缺失而失败；若还有其他 drift 就继续修。不得创建伪造 boundary 让它们变绿。

## 边界

- 只做上述确定性修复，不处理 AI supply 商业/战略计划。
- 不删除或覆盖用户文件，不改其他 worktree。
- 不 commit，不 push，不联网，不发布，不部署。
- 最终答复逐项给出修改文件、测试命令、真实 exit code 与仍存限制；不要把代理自述当成主机证据。
