# RC4 public/privacy 新会话第一次 readback 返工

继续当前 fresh 实施会话 `01a031ae-e63b-74a2-90fe-9bf25c0cb5c8`，只在本文件所在 worktree 施工。不要读取 `logs/`、旧 review/report 或其他实施会话解释；不要提交、推送、联网或触碰用户原始 dirty worktree。以 `prompts/179-rc4-public-privacy-second-red-fresh-implementation.md`、`prompts/184-rc4-privacy-second-red-new-session-closeout.md` 和当前代码为输入。宿主 clean candidate tree 在本 prompt 落盘前为 `53cfe23b1f6e57893ffd02ba0676d6273bd3e27f`；本轮改动后必须重算，禁止继续引用旧 tree。

两路零上下文 readback 在真实 full-history clean candidate 上稳定复现以下六个 P1。全部关闭，并补不能由产品实现或字符串同义自证的 hostile 回归。

## P1-1：historical fixed-point 自测漏比当前候选

当前自测 exit 0、`pass=23 fail=0 corpus=241 changed=0`，但把 `baseHead` 变换期望与当前 241 文件逐字、正文、完整 destination multiset 对账时 exit 1：路径集合虽相同，`research/codex-findings/24-repo-merge-migration-review.md` 唯一 content/body/destination mismatch；期望 destination 46、实际 45，全库期望 1569、实际 1568。

该文件移除指向 `.saydo/knowledge/current/core.md` 的不可发布 broken link 是正确方向，不能恢复可点击私有链接。应把这次受控历史修订作为显式、冻结、可审计的 transform/catalog 条目，而不是让 generic transformer 的期望仍保留旧 destination。

- 自测必须从冻结 base bytes 计算“generic transform + 显式受控修订”的唯一期望，再逐文件比较当前 bytes、去 destination 正文与完整 destination multiset；不得只比较派生结果自身。
- 显式条目绑定 path、before/after digest/bytes/mode 与精确替换理由；任意额外删 link、改正文、换 path 或遗漏新 historical 文件都必须红。
- 当前正确结果应闭合为 241/241 全量一致，不能用忽略该文件或放宽 multiset 解决。

## P1-2：Git 内部错误不得借 stderr 文本伪装 missing

`classifyGitFailure` 对所有 status 128 使用宽泛正则；`fatal: bad file` 会让失败的 `git log` 变成空历史、失败的 `ls-files` 变成 ignored/skipped，最终 cataloged `historical-unverifiable` 以 `failClosed=false` 通过。

- 按精确 Git 子命令、退出码和可证明语义分类。`git log` 与 `ls-files --error-unmatch` 的 128 一律 internal error；不能因为 stderr 含 `bad file` / `does not exist` 就降成 missing。
- 只有确有“查询对象不存在”合同的子命令和精确状态才允许 missing；未知 stderr、伪造 stderr、signal/null status 全 fail-closed。
- 新 hostile 必须覆盖 log、ls-files、ls-tree/cat-file/rev-list 相邻命令，特别是 status 128 + `fatal: bad file`，断言 `git-error`、skip=0、failClosed=true。

## P1-3：CI 等价门必须验证真实 active invocation，并覆盖 release workflow

当前 checker 只 `text.includes`。在隔离 clone 中把 just/workflow 命令注释掉、package 改成 `echo node ...` 后，真实 invocation 均为 0，checker 仍 exit 0 报 12/12/12。与此同时 release.yml 的 node quality 只执行 12 项中的 3 项，缺 9 项；atomic main+tag 后 release workflow 不等待 main CI，可先发布 immutable prerelease。

- 使用结构化、可执行的单一 gate manifest/runner，或对 just/package/YAML 做严格 active-command 解析；注释、echo、字符串、heredoc 文本、命令前后附加吞错操作都不能算执行。
- local `just ci`、package `ci:node`、`.github/workflows/ci.yml`、`.github/workflows/release.yml` 四个表面必须执行同一完整边界集合，release publish 必须 needs 该完整 gate 或验证绑定同 SHA 的 CI 成功。
- checker 同时验证 checkout `fetch-depth: 0`、release 完整 12 项、精确一次/允许的顺序和 fail-fast；增加 comment-only、echo-only、missing release gate、duplicated/`|| true` hostile。

## P1-4：`--ref` 只允许普通 blob mode

发布脚本真实使用 `--ref`。当前 ref 枚举接受 `120000 blob` symlink，并对 `160000 commit` gitlink 直接 continue；真实 clean commit 下二者 `--ref` 都 exit 0，而 `--fs` 都 exit 2。

- `--ref` 与 `--fs` 同合同，只允许 `100644` / `100755` 且 type=blob；symlink、gitlink、特殊/未知 mode/type 全部 fail-closed，不得跳过。
- 加真实合成 commit hostile，分别证明 symlink/gitlink 在 `--ref` exit 非零且错误不回显路径/探针；普通 modes 计数不回归。

## P1-5：iOS artifact policy 必须覆盖完整 tracked `apps/ios/**`

当前门只读 build script 与 README，tracked `apps/ios/project.yml` 仍有非空 literal `DEVELOPMENT_TEAM`，门却 `pass=11 fail=0`；向 project.yml 注入固定 36 字符 device ID 也假绿。

- 删除公开项目里的账户/team literal；新增显式 `SAYDO_IOS_DEVELOPMENT_TEAM`（或同等受控环境入口），与 device id 一样在 xcodegen/build/install 前 fail-fast，并只通过 xcodebuild 参数消费。
- 从 Git tracked exact-set 枚举完整 `apps/ios/**` 普通文件，扫描 team/account、固定 device id、本机路径和公开隐私命中；symlink/非普通/未枚举文件 fail-closed。
- hostile 在 project.yml、pbxproj/配置/脚本/README 任一位置注入都必须红；同一 env 绑定 build/sign/install，错误文本不回显实际值。

## P1-6：release boundary 不能依赖主 CI 竞态

`.github/workflows/release.yml` 的 publish 只 needs 本 workflow 四个 job，而 quality-node 缺新边界门。修复时优先让 release workflow 自己执行共享完整 gate，再由 publish needs；若选择验证 main CI，则必须绑定 exact tag SHA、指定 workflow/run attempt、完整 jobs 成功且无竞态。不得仅在 equivalence checker 中把 release.yml 字符串算进去。

## 完整候选复核

1. 重新用临时 index 生成 source tree，再以完整历史 clone + 隔离 commit 重建；source/fixture tree、1425 左右全量 paths、mode/bytes 必须精确相等，数字以本轮实际输出为准。
2. clean committed candidate 上运行 journal、doc-links、historical fixed-point、public text、privacy `--fs`/`--ref`（真实 Git common-dir private probes）、CI equivalence、iOS policy、release provenance、workflow 静态检查。
3. dirty source 的 untracked exact-set 红灯与最终 implementation boundary 缺失仍是主集成阶段预期；不得伪造 boundary 或写成绿。
4. `history/PROCESS-JOURNAL.md` HEAD/index/working blob 必须继续完全一致，禁止 rewrite。

## 必跑门禁

至少如实运行并报告六组新增 hostile；doc-links；journal self-test/check；public-text；boundary；privacy；historical fixed-point；week-boundary；CI gate equivalence；iOS build/install 与 artifact policy；release provenance；typecheck；lint；`bash scripts/check-emoji.sh`；`git diff --check`；actionlint；以及 exact clean full-history candidate。完成后列每个 P1 的代码/测试证据、新 tree、真实退出码与唯一预期红项；不要提交。
