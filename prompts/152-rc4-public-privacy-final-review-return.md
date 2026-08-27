# RC4 公开树与隐私链最终独立复审退回

你是本轮公开树隐私链的原实施会话。独立零上下文评审对提交链
`3bafd53cf44e051bdc8ca5d2858d48823d71a6e4 -> 09f7920dadf3b5907e18d955f8612c3ec41da8b5 -> 18d0dc786c8057d96d317872d61ca47d21f5ca87`
判定 No-Go（P0=0、P1=5、P2=1）。请在当前 worktree 继续修复。不能通过缩小扫描范围、
忽略二进制、删历史证据、降低门禁或只改说明来收口。

## 必修 P1

1. `scripts/week-audit.mjs` 的 `implementationBoundary` 仍固定在 `b768089...`，只验证其为
   `HEAD` 祖先，漏掉之后的 `a501692`、`3bafd53`、`09f7920` 等实施提交；而发布报告声称已覆盖
   最终实施 SHA。让冻结边界、commit/docs 双向账本与当前候选一致，且新的实施提交不能在
   `--check` / `--check-bundle` 中静默漏审；重生冻结输出并补回归。
2. `scripts/check-public-tree-privacy.mjs` 对二进制扩展名或任意 NUL 直接返回空 hits，内建
   home/RFC1918/private probes 全被绕过。对所有 blob fail-closed 扫描敏感字节/可判定文本；
   二进制不能成为豁免。补“二进制扩展名含敏感串”和“NUL buffer 含敏感串”隔离用例，均必须拒绝。
3. 文件名未参与隐私扫描，失败日志还原样输出路径。扫描 Git path 本身；任何命中日志不得回显
   敏感文件名、home 或私有 token，只输出稳定脱敏标识或 digest。补“敏感串只在文件名”与
   “内容同时命中也不泄漏路径”的用例。
4. 批量脱敏后至少 40 条 `history/PROCESS-JOURNAL.md` 中 prompt/report bytes 与 SHA-256
   仍指向脱敏前内容，和公开树实际文件不一致。对全量引用做程序化核对并修正为当前公开副本的
   真实行数/bytes/SHA，或采用同等可验证且不失真的双摘要映射；不能抽样。新增自动门禁，今后任一
   journal 引用漂移都失败。
5. `scripts/public-text-redaction.mjs` 的 Windows `C:\\Users\\USER` 只匹配无空格 USER，
   `C:\\Users\\Jane Doe\\project` 会残留 `Doe`。profile 段应匹配到下一路径分隔符，脱敏后
   二次扫描也必须能发现任何残余；补多词、Unicode、空格边界测试。

## 必修 P2

6. 当前把 Markdown destination 改为 `~/...`，研究报告中已有 24 个文件、1152 个 destination
   全部语义失效，`check-doc-links` 又未覆盖该目录。仓内目标改成按源文件解析后真实存在的相对链接；
   仓外私有路径改为非链接的稳定占位文本。扩展文档链接门禁覆盖 `research/codex-findings`，并对
   全量 destination 验证，不能抽样。

## 约束与验证

- 现有 public exclude 只能精确排除 `artifacts/release/copyright` 下登记的 8 个路径；不得扩大。
- iOS 同一显式 device id 的构建/安装合同保持不回退；不得写入任何真机 ID。
- 攻击 fixture 只用合成值；输出和提交文件不得含真实账户名、完整本机路径或凭证。
- 保持最小改动；修正文档和证据中超过真实覆盖范围的断言。
- 必须以当前候选 ref 与过滤后公开树各跑一次真实扫描，并报告 scanned/binary/excluded/hits。

必须原样执行并回报退出码：

```sh
node scripts/test-public-text-redaction.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-ios-build-install.mjs
node scripts/test-release-provenance.mjs
node scripts/check-doc-links.mjs
node scripts/week-audit.mjs --check
node scripts/week-audit.mjs --check-bundle
pnpm typecheck
pnpm lint
pnpm test
node scripts/check-emoji.mjs
bash scripts/check-emoji.sh
git diff --check 3bafd53cf44e051bdc8ca5d2858d48823d71a6e4 --
```

完成后给出每条 finding 到代码/测试的映射、全量摘要核对结果、全量链接核对结果、改动文件清单、
真实测试计数和退出码。不要 commit、push、tag、release 或 deploy；不要调用 subagent。
