[fail] 2A/0B/0C：A-01 在 `realpath` 不可用时仍可经 symlink 越出；新增 N-02 隐私硬门失败。

| id | 状态 | file:line | 复现命令 | 实际结果 |
|---|---|---|---|---|
| A-01 | partially_closed（A/P1） | [install.sh:39](deploy/saydo-octoooo-com/install.sh:39)、[install.sh:46](deploy/saydo-octoooo-com/install.sh:46)、[install.sh:60](deploy/saydo-octoooo-com/install.sh:60) | `HOME=/tmp SAYDO_HOME=/tmp/../../var/lib/x sh install.sh`；现有目录 symlink 分别以正常 PATH、`PATH=/usr/bin` 运行 | `..` exit 1、正常 symlink exit 1，均在 `mkdir` 前 `[fail]`；但无 `realpath` 时抵达拦截的 `mkdir`，exit 97、无 `[fail]`。 |
| N-01 | closed | [install.ps1:35](deploy/saydo-octoooo-com/install.ps1:35) | `node -e '<path.win32 等价路径模型，四组输入>'` | exit 0；默认 `D:\Profiles\alice\AppData\Local\SayDo` accepted；两个 ProgramData 输入均归一化为 `C:\ProgramData\x` 并 rejected；前缀碰撞 `Locality` 也 rejected。 |
| N-02 | open（A/验收失败） | [prompt:9](prompts/225-monthly-crosscheck-quickstart-final-review.md:9)、[report:19](research/codex-findings/224-monthly-crosscheck-quickstart-rereview.md:19) | `node scripts/check-public-tree-privacy.mjs --fs` | exit 1；两文件触发 `home-windows`。`--ref 3630edf...` 同样 exit 1，确认属于 HEAD，不是未提交 journal 修改。 |

补充边界探针：不存在的合法 `SAYDO_HOME`、symlink 形式的 `HOME=/tmp`、`foo..bar` 均通过校验并抵达拦截的 `mkdir`；归一化后仍在 HOME 内的 `unused/../safe` 会被明确拒绝，但不定为新的 P0/P1。

实际门禁：

- `node scripts/test-install-scripts.mjs`：exit 0，`mutations=18 all red; dynamic no-write checks=4`
- `node scripts/check-active-claims.mjs`：exit 0，`roots=33`
- `node scripts/check-public-tree-privacy.mjs --fs`：exit 1，`hits=2 files=2`
- `bash scripts/check-emoji.sh`：exit 0
- `node scripts/check-doc-links.mjs`：exit 0，`broken=0`
- `sh -n deploy/saydo-octoooo-com/install.sh`：exit 0
- `git diff --check main..HEAD`：exit 0

未运行或无法核验：

- 精确的 `HOME=$(mktemp -d)` 与新建 symlink 场景未运行：只读沙箱中 `mktemp` exit 1，`Operation not permitted`；改用 `/tmp` 和仓内现有目录 symlink 等价复现。
- 未原生运行 Windows PowerShell；本机无 `pwsh`/`powershell`，N-01 仅由源码和 `path.win32` 等价模型核验。