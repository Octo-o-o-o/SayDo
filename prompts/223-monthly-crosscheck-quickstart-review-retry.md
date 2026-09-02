# 223 · 月度对账 + 快速启动分发批的零上下文对抗评审(重试,收窄范围;2026-09-02)

前一次派发(`prompts/222`)在 1500 秒硬超时内未产出结论(只留 ignored 事件流)。本次是全新会话、范围收窄、必须在有限步数内给出结论;先输出已确认的发现,不要为了穷尽而不收口。

你是零上下文、只读的对抗评审者。仓库是 `<repo>`(当前目录),分支 `codex/monthly-crosscheck-20260902`,被审候选是 `main..HEAD` 的五个提交(`babd864`、`f35c234`、`b46daed`、`d1cd29c`、`eb64832`),基线 `main` = `f4d8de9`。不要修改任何文件,不要 commit / push / 部署,不要访问真实账号或调用任何 AI 服务;可以运行仓内只读脚本与测试。

## 必读(只读这些,不要通读全仓历史)

1. `AGENTS.md` 的「硬规则」节。
2. `git diff main..HEAD` 全文(约 30 个文件)。
3. `docs/plan/2026-09-02-quick-start-distribution.md` §3、§4。
4. `docs/review/2026-09-02-monthly-docs-commit-crosscheck.md` §1、§3。

## 评审维度(按优先级;A 与 B 必须完成,C 与 D 尽力)

A. **安装脚本正确性与安全**(`deploy/saydo-octoooo-com/install.sh`、`install.ps1`):能让用户机器出现用户目录之外的写入、跳过 SHA-256 校验、装上非钉住版本、在 `set -eu` 下静默中断、路径含空格出错、PATH 误写(重复/写错文件)、Windows 用户 PATH 破坏、`irm | iex` 场景下与 `-File` 场景行为不一致——这些是 A 级。请用本机 `sh`(bash 3.2 兼容模式)/`dash`(如有)做静态与最小动态检查(可用临时 `HOME` 与 `SAYDO_HOME` 指向 `mktemp -d`,`SAYDO_INSTALL_NO_MODIFY_PATH=1`;不要联网下载时可以只走到下载前的分支或用 `sh -n`)。
B. **自测空洞**(`scripts/test-install-scripts.mjs` + `justfile` / `package.json` / `.github/workflows/ci.yml` 接线):列出「脚本坏了但自测仍绿」的具体场景,每条给一个能证明的 mutation。
C. **公开承诺与发布合同副作用**:新增文案是否触发或应触发 `scripts/check-active-claims.mjs`(运行它);`scripts/post-release-gate.mjs` 的 availability 替换表与 `scripts/test-release-provenance.mjs` 的 marker 是否仍能在当前文件上命中(只报「当前树上哪一条锚句已找不到」这一类可机械证明的结论,不展开设计讨论);`.gitignore`、`_headers`、`ci.yml` 改动对 `release.yml`、`week-audit --check-bundle`、`publish-public-snapshot.sh` 的影响。
D. **对账报告 §1/§3 的可机械核验断言**:只跑这些命令并对照报告:`node scripts/check-public-tree-privacy.mjs --fs`、`node scripts/check-doc-links.mjs`、`bash scripts/check-emoji.sh`、`node scripts/test-install-scripts.mjs`、`git log --since=2026-08-02 --oneline | wc -l`、`git tag`、`git worktree list`、`git branch --list`。不做全月 SHA 重扫。

## 输出(必须在完成 A、B 后尽快落笔;C、D 未完成的项写「未运行」)

中文、零 emoji。结构:
1. 一句话结论:`[pass]` 或 `[fail] xA/yB/zC`。
2. A / B / C 三张表:`id | file:line | 复现命令或输入 | 实际结果 | 级别理由`。
3. 实际运行过的命令与 exit code。
4. 未运行 / 无法核验的项。

不输出修复代码;每条发现必须可从当前产品代码、正式脚本或声明支持的输入到达。
