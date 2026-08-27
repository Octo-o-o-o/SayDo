# RC4 当前公开候选树本机身份与私网信息清理实施单

## 1. 已证实问题与目标

独立对抗审查已证明，当前 RC4 候选树中的文档、过程档案、prompt、研究 JSON 和少量测试/脚本仍包含真实本机
用户主目录、账户标识及私网地址。公开快照现有探针没有覆盖这一整类信息，因此当前候选不得发布。

本轮目标是把“当前将要公开的树”清理为零命中，并让以后周审计从历史 diff 生成的 excerpt 在落盘前确定性脱敏。
只改当前树，不重写、删除或移动既有公开 tag/历史，不执行 commit、push、release 或 deploy。

## 2. 清理合同

- 对全部 version-controlled 当前文本文件做完整枚举，不得抽样；排除公开脚本已经声明只留私库的软著材料目录。
- 将真实 macOS、Linux、Windows 用户主目录改为平台中性的占位表示；将真实个人账户标识改为 `<account>`，
  将 RFC1918 私网地址改为 `<private-ip>` 或语境等价的明确占位符。保留文档原意、命令结构和平台说明。
- 不应把项目名、公开 GitHub 组织名、公开域名、合法 loopback 地址或必要的协议示例误删。
- 文档/报告采用最小替换，不整段改写；代码与测试若原本有意验证绝对路径或私网格式，必须在运行时由无敏感的
  片段构造测试值，保持测试覆盖，同时确保源码静态扫描不含真实/拟真用户 home 与私网地址。
- 特别检查 `packages/daemon/test/` 下的 home/path fixture、`scripts/freeze-design-archive.mjs`、发布 metadata 注释，
  以及 `research/week-audit/2026-08-22-semantic-review.json`；这只是已知入口，不是扫描范围上限。

## 3. 生成器必须先脱敏再截断/哈希

- 抽出单一共享的 public-text redaction helper，供 `scripts/week-audit.mjs` 与
  `scripts/refine-week-audit-evidence.mjs` 的 `safeExcerpt` 共用，禁止两份规则继续分叉。
- redaction 至少覆盖三类平台 home 与 RFC1918 地址，且必须在 whitespace normalize、长度截断和 excerpt 落盘之前执行。
- 正则/fixture 本身不能被自身扫描命中；使用转义或运行时片段组合构造反例，不在源文件中直接写一个会命中的完整样本。
- 为 redaction helper 增加确定性自测：三平台 home、三个 RFC1918 网段、大小写变体、句中/标点边界、公开域名与
  loopback 保留、重复调用幂等。
- 用 refiner/周审计的既有生成顺序重新生成相关 JSON/Markdown；确认历史 blob 身份/hash 证据仍真实，只有展示 excerpt
  被脱敏。不得手改生成 JSON 来绕开生成器。

## 4. 公开树硬门

- 新增 `scripts/check-public-tree-privacy.mjs`（或同等单一实现），可对显式 Git ref 和公开 exclude exact-set 扫描：
  - 三平台用户 home；
  - RFC1918 地址；
  - Git 私有探针文件中的 owner-specific 正则，匹配按大小写不敏感执行。
- 扫描必须完整遍历候选树的全部普通文本 blob；二进制要明确识别/报告，不能因解码异常把扫描命令失败误判为零命中。
  输出只给 path、规则类别和计数，不回显敏感原文。
- `scripts/publish-public-snapshot.sh` 在生成/推送快照之前调用该硬门，传入显式 expected internal SHA 和与公开过滤器
  完全相同的 exclude exact-set；任一命中或扫描错误均拒绝发布。
- 增加自测覆盖：每类命中、大小写 private probe、排除目录只排 exact-set、文件名含空格/非 ASCII、二进制、
  scanner 自身不自命中、Git 命令失败非零退出。自测不得输出 fixture 的敏感文本。

## 5. 当前树零命中验收

实施后对当前全部 version-controlled + 本轮拟提交文件执行程序化全量检查，分别给出文件数和命中数：

1. 真实本机账户标识（大小写不敏感）为 0。
2. 三平台真实或拟真用户 home 为 0（占位符不计）。
3. RFC1918 字面地址为 0（占位符不计）。
4. `node scripts/check-public-tree-privacy.mjs <显式候选 ref>` 的 fixture/self-test 通过；由于工作树尚未提交，另用同一
   detector 对当前 filesystem 输入跑一次，不得只扫描旧 HEAD。
5. `node scripts/refine-week-audit-evidence.mjs`、`node scripts/week-audit.mjs --write`、
   `node scripts/week-audit.mjs --check` 和 `node scripts/week-audit.mjs --check-bundle` 全部退出 0。
6. 所有因动态构造而改动的代码/测试运行对应最小单测，并跑 `pnpm typecheck`；不得用 skip 或放宽断言换绿。
7. `bash -n scripts/publish-public-snapshot.sh` 退出 0，且程序化确认发布脚本确实调用新硬门。

## 6. 文档一致性顺手收口

- `docs/review/2026-08-22-week-audit-report.md` 中旧公开树摘要必须明确写成可重算的 public tree object digest，
  不得误称为 commit；若同时引用 public snapshot commit，两个对象和用途分别写清。
- 在 remediation cross-links 中为实施提交 `951249e696afdb38c2c9cb8e4de8b0a26e828f3c` 补上
  `e2e/evidence/2026-08-23-rc4-release-candidate.md` 的双向关联，并通过 canonical 生成器重生 ledger，禁止只手改派生输出。
- 当前运行时/发布/隐私修复会改变最终 implementation boundary；本轮先保持生成器可重生，最终冻结 SHA 由主会话完成
  代码提交后再更新，不能继续声称旧边界覆盖新代码。

## 7. 交付

直接实施，不提交、不推送、不发布、不部署。最终报告真实改动文件、全量扫描的精确文件数/命中数、门禁退出码与
任何仍需 owner 判断的内容；不得打印被清理的敏感字符串。
