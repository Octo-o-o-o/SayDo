# RC4 公共隐私线二次返工：内部边界与公开快照双模式

继续同一公共隐私施工 session，只在当前 worktree 修改，不 commit/push/release/deploy。先读
`prompts/157-rc4-public-privacy-boundary-and-ios-return.md` 的实现与当前 diff。

## 新确认的发布级反例

SayDo 公开仓不是私有历史的镜像。`scripts/publish-public-snapshot.sh` 用 `git commit-tree` 把内部
HEAD 的公开树投影为一条独立 public snapshot 链。真实当前对象证明：

- public main `a29f671f79cf5f73452cecd60b092072c72c2aab` 的 subject 声明来源 internal
  `8602c7324844ede014c577409ae10a834f1a1714`；
- internal `09f7920dadf3b5907e18d955f8612c3ec41da8b5` 不是该 public commit 的祖先；
- public commit 有自己的 public parent。

因此，当前只接受“证据提交第一父提交等于 internal implementationBoundary”的 helper 会让
公开 Release CI 中的 `node scripts/week-audit.mjs --check-bundle` 必然失败。不能通过简单跳过历史
校验解决，否则后续公开快照中的未审代码可被放过。

另外，当前 `isAllowedEvidencePath` 把整个 `deploy/`、`artifacts/`、任意位置 `.md` 都视为证据，
会允许任意网站实现或可执行载体越过边界；helper 也未明确拒绝 boundary symlink、index-only
漂移和 merge evidence commit。

## 必须实施的双模式协议

### 1. internal-history 模式

当 JSON 记录的 internal boundary commit 在当前仓库可验证时，保持并加固 157 的协议：

- boundary 文件必须是 regular file，拒绝 symlink/目录/设备文件；working tree、index、HEAD 三者
  blob 必须一致。
- boundary 路径在 `HEAD` 的 full history 中恰好只被一个 commit 触及。
- 引入 evidence commit 必须恰好一个 parent；该 parent 等于 JSON SHA。merge commit 一律拒绝。
- 引入 commit 只含冻结的 evidence exact policy 路径。
- boundary 后每个 commit 都枚举，任何非允许路径拒绝。
- `head` 参数必须贯穿 path history、blob、ancestor 与 leak 枚举，不能一半固定到 HEAD。

### 2. public-snapshot 模式

只有在当前 HEAD 被严格识别为 SayDo public snapshot 时才允许进入，不能把任意 internal 校验错误
回落成 public 模式：

- subject 必须精确匹配 `snapshot: YYYY-MM-DD from internal <40sha>`；body 中唯一
  `public-tree: <40sha>` 必须等于 `HEAD^{tree}`，唯一 `filter-version:` 必须为
  `public-exclude-v1`；commit 必须恰好一个 parent（仓库首个 snapshot 可显式定义 root 例外，若
  不需要则统一单 parent）。
- boundary 文件仍必须 regular、working/index/HEAD blob 一致；JSON boundary 与 ledger、integrity、
  semantic、publication manifest 中的 implementationBoundary 必须相同。读取这些文件失败或字段
  缺失均 fail closed。
- 在 public history 中 boundary 路径仍只能由一个 commit 引入且永不修改。该引入 commit 必须也
  是合法 public snapshot；它作为公开代码基线，而不是伪称其 parent 等于 private SHA。
- 从该 public baseline 之后到当前 HEAD 的每个 public commit 均枚举改动；任何非冻结 evidence
  policy 路径都拒绝。这样首个投影可承载已在 internal 严格验证的完整树，后续代码变化仍会红。
- 当前 HEAD 如果不是合法 public snapshot，或 private boundary object 实际存在但 internal 协议
  失败，不得走 public 模式。
- helper 返回明确 `mode: internal_history | public_snapshot` 以及可审计的 public source SHA / baseline
  commit；输出不得把 public commit、public tree、private boundary 混称同一对象。

### 3. internal → public 生成门

`scripts/publish-public-snapshot.sh` 在生成临时 index / public tree 之前，必须对 clean internal HEAD
真实运行 `node scripts/week-audit.mjs --check-bundle`，且排在隐私扫描和任何 push 之前。失败立即
停止。`scripts/test-release-provenance.mjs` 或等价自测需机械锁住顺序，不能只 grep 命令存在。

公开模式并不替代内部严格证明：它只接受由上述 publisher 合同生成的快照形状，并以 boundary
首次出现的 public commit 作为后续漂移基线。

## 证据路径策略收窄

禁止再允许整个 `deploy/` 或 `artifacts/`。按本轮真实后边界写入需要冻结最小 policy：

- 文档/报告载体：root 的明确文档文件、`docs/`、`research/`、`history/`、`prompts/`、
  `e2e/evidence/`，并限制为实际证据所需的非可执行扩展（如 `.md/.json/.txt`；按仓内事实补齐，
  不允许 `.mjs/.js/.ts/.sh/.html` 泛化进入 research/docs）。
- post-release availability 会有意改写的公开页面只能允许当前
  `post-release-gate.mjs` 冻结的 exact paths：
  `deploy/saydo-octoooo-com/index.html`、`deploy/saydo-octoooo-com/en/index.html`、
  `deploy/saydo-octoooo-com/docs/index.html`、`deploy/saydo-octoooo-com/en/docs/index.html`。
  不得允许同目录其它 HTML/JS/资产。README 与 docs source 按上条文档规则。
- `.github/`、`scripts/`、`packages/`、`apps/`、package/lock/config、任意其它 deploy/artifact 文件始终
  算 implementation。
- 若现有真实 evidence 需要额外路径，逐个 exact 说明并加正反测试，不能恢复前缀级放行。

## 必须新增的反例

除 157 的 19 项外，至少覆盖：

1. synthetic internal happy path；
2. synthetic public snapshot happy path（private SHA object 不存在）；
3. public baseline 后 docs/evidence-only snapshot 通过；
4. public baseline 后 `scripts/` 或非 exact deploy 页面变化拒绝；
5. exact availability 四页变化按冻结 policy 通过；
6. 非 snapshot HEAD 不得 public fallback；
7. internal boundary object 存在但 parent/mixed/one-shot 失败时不得 public fallback；
8. boundary committed symlink 拒绝；
9. index-only boundary 漂移拒绝；
10. merge evidence commit 拒绝；
11. boundary path 经 merge 或 full-history 第二次修改拒绝；
12. `research/evil.mjs`、`deploy/.../evil.html`、`artifacts/evil` 都是 implementation；
13. public-tree 重复/缺失/错 SHA、filter 重复/错误、subject 错、manifest boundary 错均拒绝；
14. publisher 中 audit check 在 tree creation/push 前，且失败不能继续。

## 门禁

仍运行 157 的全部门禁。当前 internal 未提交状态下，真实 boundary 文件尚未创建，所以
`week-audit --check-bundle` 应只因该事实 fail closed；其它自测必须绿。特别报告：

```text
node scripts/test-week-audit-boundary.mjs
node scripts/test-release-provenance.mjs
node scripts/test-ios-build-and-install.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-public-text-redaction.mjs
node scripts/test-journal-digests.mjs
node scripts/check-journal-digests.mjs
node scripts/check-doc-links.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
git diff --check
node scripts/week-audit.mjs --check-bundle
```

完成后列出协议、exact evidence policy、真实退出码与主代理的两提交操作步骤。不要自行 commit。
