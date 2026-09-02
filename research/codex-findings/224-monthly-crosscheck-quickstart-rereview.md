[fail] 2A/0B/0C：A-01 仍可通过 `..` 越出 HOME；另新增 N-01，重定向后的合法 `%LOCALAPPDATA%` 默认路径会被 Windows 约束拒绝。

| id | 状态 | file:line | 复现命令 | 实际结果 |
|---|---|---|---|---|
| A-01 | partially_closed | [install.sh:32-44](deploy/saydo-octoooo-com/install.sh:32)、[install.ps1:29-41](deploy/saydo-octoooo-com/install.ps1:29) | `HOME=/tmp SAYDO_HOME=/tmp/../var/lib/saydo-224 sh install.sh` | 直接 `/var/lib` 会 `[fail]`；但含 `..` 时越过校验并走到 `mkdir /var/lib/...`，仅因只读沙箱失败。 |
| A-02 | closed | [install.sh:32-34](deploy/saydo-octoooo-com/install.sh:32) | `env -u HOME -u SAYDO_HOME sh install.sh` | sh、dash 均 exit 1，输出受控 `[fail] 缺少 HOME`。 |
| A-03 | closed | [install.sh:143-160](deploy/saydo-octoooo-com/install.sh:143) | 含空格 HOME 的 PATH 分支 harness | 输出完整 `.bashrc`、`.bash_profile` 两个参数，无拆词。 |
| A-04 | closed | [install.sh:143-150](deploy/saydo-octoooo-com/install.sh:143) | 无关注释、旧精确标记分别输入 `grep -Fxq` | 无关注释不匹配；旧标记精确匹配，兼容且幂等。 |
| A-05 | closed | [install.sh:153-161](deploy/saydo-octoooo-com/install.sh:153) | `SHELL=/opt/homebrew/bin/fish` 分支 harness | 映射到 `.config/fish/config.fish`，生成 `set -gx PATH ...`。 |
| A-06 | closed | [install.ps1:133-147](deploy/saydo-octoooo-com/install.ps1:133) | 中文用户名启动器模型 | Node/CLI 均变成 `%~dp0..\...`；启动器纯 ASCII，不含中文 HOME。 |
| A-07 | closed | [PROCESS-JOURNAL.md:3450](history/PROCESS-JOURNAL.md:3450) | `node scripts/check-public-tree-privacy.mjs --fs` | exit 0，`scanned=1961 ... hits=0`。 |
| B-01 | closed | [test-install-scripts.mjs:69](scripts/test-install-scripts.mjs:69) | digest 校验替换为合法 `:` | checker red；`sh -n` exit 0。 |
| B-02 | closed | [test-install-scripts.mjs:80](scripts/test-install-scripts.mjs:80) | PS digest 条件改为 `$false` | checker red：缺少 PS 包 digest 校验。 |
| B-03 | closed | [test-install-scripts.mjs:70](scripts/test-install-scripts.mjs:70) | `"$tgz"` 改为 `@saydo/cli@latest` | checker red；`sh -n` exit 0。 |
| B-04 | closed | [test-install-scripts.mjs:71](scripts/test-install-scripts.mjs:71) | 默认根改为 `/usr/local/share/saydo` | checker red；`sh -n` exit 0。 |
| B-05 | closed | [test-install-scripts.mjs:74](scripts/test-install-scripts.mjs:74) | PATH 写入替换为 `:` | checker red；`sh -n` exit 0。 |
| B-06 | closed | [test-install-scripts.mjs:84](scripts/test-install-scripts.mjs:84) | 用户 PATH 改为仅 `$BinDir` | checker red：缺少保留原 PATH 的语句。 |
| B-07 | closed | [test-install-scripts.mjs:92](scripts/test-install-scripts.mjs:92) | 插入 `$MyInvocation` 短路 | checker red：禁止依赖 `$MyInvocation`。 |
| N-01 | still_open（P1） | [install.ps1:29-36](deploy/saydo-octoooo-com/install.ps1:29) | `USERPROFILE=<win-home>`、`LOCALAPPDATA=<win-localappdata-on-D>`，Root 未设置 | 默认 Root 为 `D:\...\SayDo`，但只按 USERPROFILE 判断，模型结果 `accepted=false`，代码必达 `Fail`。 |

### 实际命令与退出码

- 独立 B-01…B-07 mutation harness：exit 0；7/7 checker red，四个 shell 变体 `sh -n=0`。
- A-01 直接越界：sh/dash exit 1，受控 `[fail]`。
- A-01 `..` 绕过：sh/dash exit 1，原因是沙箱拒绝 `mkdir`，不是安装器约束。
- A-02 缺 HOME：sh/dash exit 1，受控 `[fail]`。
- A-03、A-05 分支 harness：exit 0。
- A-04 无关注释与旧标记探针：均 exit 0。
- A-06/N-01 路径模型：exit 0。
- `node scripts/test-install-scripts.mjs`：exit 0。
- `node scripts/test-active-claims.mjs`：exit 1，`mkdtemp EPERM`。
- `node scripts/check-active-claims.mjs`：exit 0，`roots=33`。
- `node scripts/check-public-tree-privacy.mjs --fs`：exit 0，`hits=0`。
- `bash scripts/check-emoji.sh`：exit 0。
- `node scripts/check-doc-links.mjs`：exit 0。
- `sh -n deploy/saydo-octoooo-com/install.sh`：exit 0。
- `/bin/dash -n deploy/saydo-octoooo-com/install.sh`：exit 0。
- `git diff --check main..HEAD`：exit 0；最终工作树干净。

### 未运行或无法核验

- 沙箱禁止临时写入，A-03/A-04/A-05 的完整安装落盘夹具及 `test-active-claims.mjs` 的 mutation 阶段未运行。
- 本机没有 `pwsh`、`powershell`、`fish`；A-06 为源码加路径模型核验，未做原生 Windows/fish 执行。
- 未执行远端 `release.yml`；新增本地步骤对应的 `test-install-scripts.mjs` 已绿。