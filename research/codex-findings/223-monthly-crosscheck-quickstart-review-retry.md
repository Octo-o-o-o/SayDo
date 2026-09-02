[fail] 7A/7B/5C：安装根目录、PATH、Windows Unicode 启动器及公开树隐私存在 A 级问题；当前自测可被 7 个具体 mutation 绕过，发布锚与审计 bundle 也已漂移。

### A

| id | file:line | 复现命令或输入 | 实际结果 | 级别理由 |
|---|---|---|---|---|
| A-01 | `install.sh:32-37`、`install.ps1:29-33` | `SAYDO_HOME=/var/lib/saydo`；Windows：`SAYDO_INSTALL_ROOT=C:\ProgramData\SayDo` | POSIX 校验接受并派生 `/var/lib/saydo/toolchain`、`/var/lib/saydo/bin`；PowerShell 直接把任意 Root 交给 `New-Item`，无用户目录约束 | 与“只在用户目录内写文件”公开承诺冲突；具备权限时可写系统位置 |
| A-02 | `install.sh:14,32` | `env -u HOME -u SAYDO_HOME ... /bin/sh install.sh` | sh/bash exit 1、dash exit 2；原始错误为 `HOME: unbound variable/parameter not set`，没有 `[fail]` | `set -u` 下未经受控错误路径中断 |
| A-03 | `install.sh:139-147` | `HOME='/tmp/saydo user'`，按当前 `rc_files` 循环展开 | 实际得到四个路径片段：`/tmp/saydo`、`user/.bashrc`、`/tmp/saydo`、`user/.bash_profile` | 合法含空格 HOME 会写错文件或中断 |
| A-04 | `install.sh:143-147` | rc 文件只含注释 `# unrelated mention: /tmp/user/.saydo/bin` | 当前 `grep -Fq "$BIN_DIR"` 分支输出 `installer_branch=skip`，不会写入 PATH | 任意无关文本命中即可造成“安装成功但新终端找不到 saydo” |
| A-05 | `install.sh:137-141` | `SHELL=/opt/homebrew/bin/fish` | 当前映射实际输出 `rc_files=/tmp/user/.profile` | fish 不读取该用户启动文件，公开的“新终端运行 saydo”路径失效 |
| A-06 | `install.ps1:122,126-132` | 默认用户路径含非 ASCII，例如 `C:\Users\张三\...` | 启动器把包含 `$CliMjs` 的路径以 `-Encoding ASCII` 写入，非 ASCII 字符会被替换，生成的 `saydo.cmd` 指向不存在路径 | 中文等常见 Windows 用户名会导致默认安装不可启动 |
| A-07 | `history/PROCESS-JOURNAL.md:3450`、对账报告 `:35` | `node scripts/check-public-tree-privacy.mjs --fs` | exit 1：`rfc1918 count=1`，命中 `<lan-ip>`；报告却登记本轮复扫 `hits=0` | `publish-public-snapshot.sh` 明确执行该门，当前候选会阻断公开快照 |

### B

下列 mutation 均调用当前 `checkInstallScripts()`；所有结果都是 `checker_errors=0`。四个 shell mutation另外均为 `sh_syntax=0`。

| id | file:line | 复现命令或输入 | 实际结果 | 级别理由 |
|---|---|---|---|---|
| B-01 | `install.sh:108-109` | 删除 SayDo tgz digest 比较，mutation `sh_skip_tgz_hash` | 自测仍绿 | 可完全跳过 shell 包校验 |
| B-02 | `install.ps1:112-113` | 删除 PowerShell tgz digest 比较，`ps_skip_tgz_hash` | 自测仍绿；自测不解析或运行 PowerShell | Windows 可完全跳过包校验 |
| B-03 | `install.sh:119` | 把安装目标从 `"$tgz"` 改为 `@saydo/cli@latest` | 自测仍绿、shell 语法绿 | 钉住常量仍在，但实际安装非钉住版本 |
| B-04 | `install.sh:32` | 把默认根改成 `/usr/local/share/saydo` | 自测仍绿、shell 语法绿 | “仅用户目录写入”没有执行路径断言 |
| B-05 | `install.sh:147` | 把 PATH 写入语句改为 `:` | 自测仍绿、shell 语法绿 | 完全不配置 PATH 仍假绿 |
| B-06 | `install.ps1:141` | 把用户 PATH 更新改为仅写 `$BinDir` | 自测仍绿 | 可清空用户原 PATH 而不被发现 |
| B-07 | `install.ps1:14` | 插入 `if (-not $MyInvocation.MyCommand.Path) { return }`，令 `irm \| iex` 无操作 | 自测仍绿 | 没有 PowerShell 语法或 `-File`/`irm \| iex` 双模式执行测试 |

### C

| id | file:line | 复现命令或输入 | 实际结果 | 级别理由 |
|---|---|---|---|---|
| C-01 | `post-release-gate.mjs:113-120,193-200` | 机械统计全部 11 个 availability replacement | 仅 `README.md` 为 `before=0 after=0`；其余十项均为 `after=1` | 当前 availability 状态机在 README 锚处必抛错 |
| C-02 | `.github/workflows/ci.yml:52-53`、`release.yml:64-77` | `rg test-install-scripts .github/workflows/*.yml` | 普通 CI 有安装自测；`release.yml` 没有该命令 | release workflow 与普通 CI 独立，新增自测未进入发布质量门 |
| C-03 | `week-audit.mjs:98`、对账报告 `:71` | `node scripts/week-audit.mjs --check-bundle` | exit 1：首先报 `history/PROCESS-JOURNAL.md` 内容漂移；manifest 还缺 `install.sh`、`install.ps1`、自测脚本，且 `.gitignore`、`_headers`、`ci.yml` digest 均不匹配 | 报告声称已重生成 bundle，但当前 release.yml 第 76 行必红 |
| C-04 | `check-active-claims.mjs:12-52` | `node scripts/check-active-claims.mjs` | exit 0，`roots=31`；安装脚本不在 roots，规则也不覆盖“仅用户目录、不改系统、校验 SHA、无需 Node”等新增承诺 | 新公开安装承诺没有进入 active-claims 约束面 |
| C-05 | 对账报告 `:3,11` | `git log --since=2026-08-02 --oneline \| wc -l` | 当前为 `572`，报告为 `565` | 报告未绑定冻结 HEAD，当前候选上的月度数量断言已不可复现 |

`test-release-provenance.mjs` 使用的两个官网 marker 当前仍可机械命中：中文首页第 522 行、英文首页第 525 行。

### 实际命令与 exit code

```text
git diff main..HEAD                            exit 0（38 files）
git diff --check main..HEAD                    exit 0
/bin/sh -n install.sh                          exit 0
/bin/bash --posix -n install.sh                exit 0
/bin/dash -n install.sh                        exit 0

HOME unset + /bin/sh                           exit 1
HOME unset + /bin/bash --posix                 exit 1
HOME unset + /bin/dash                         exit 2
mutation harness                               exit 0（7 项 checker_errors=0）

node scripts/check-active-claims.mjs            exit 0
node scripts/test-release-provenance.mjs        exit 1（EPERM，见下）
TMPDIR=/tmp node scripts/test-release-provenance.mjs
                                                exit 1（EPERM）
node scripts/week-audit.mjs --check-bundle      exit 1
availability replacement 机械计数               exit 0
当前官网 marker 检索                            exit 0
publication manifest digest 对照                exit 0
```

D 指定命令：

```text
node scripts/check-public-tree-privacy.mjs --fs exit 1
  [fail] path=history/PROCESS-JOURNAL.md category=rfc1918 count=1
  [fail] public-tree-privacy hits=1 files=1

node scripts/check-doc-links.mjs                exit 0
  [ok] active document links: files=131 broken=0

bash scripts/check-emoji.sh                     exit 0
  [ok] emoji gate: clean

node scripts/test-install-scripts.mjs           exit 0
  [ok] install scripts pinned to v0.1.0-rc.12; mutations=8 all red

git log --since=2026-08-02 --oneline | wc -l    exit 0
  572

git tag                                         exit 0
  14 个：archive/pg-01a-c1-red-20260831、
  archive/week-audit-evidence-20260823、v0.1.0-rc.1 至 rc.12

git worktree list                               exit 0
  仅当前 worktree @ eb64832，分支 codex/monthly-crosscheck-20260902

git branch --list                               exit 0
  codex/monthly-crosscheck-20260902、main
```

### 未运行 / 无法核验

- 本机没有 `pwsh`，未动态执行 `install.ps1`；Windows A 项来自当前源码的确定性路径/编码行为。
- 沙箱禁止创建任何临时文件。`test-release-provenance.mjs` 两次均在 `mkdtemp` 处因 `EPERM` 退出；这不是产品断言失败。
- 因同一限制，未执行完整假 Node/npm 安装、PATH 文件落盘或真实安装；只做了无写入分支复现、三种 shell 语法检查和内存 mutation。
- 未运行 `post-release-gate` 实际模式、`release.yml`、`publish-public-snapshot.sh`，避免写证据、外部访问或推送；其锚点、接线和当前阻断门均按源码机械核验。
- 未联网下载、未访问真实账号、未调用 AI 服务，也未做全月 SHA 重扫。