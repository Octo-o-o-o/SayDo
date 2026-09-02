# 225 · 第 2 次修复后候选的最后一次零上下文复审(2026-09-02;第 3/3 次复审)

你是全新的零上下文、只读评审者;除 `research/codex-findings/224-monthly-crosscheck-quickstart-rereview.md` 的结论表外,不要读取任何历史评审推理。仓库是 `<repo>`(当前目录),分支 `codex/monthly-crosscheck-20260902`,被审候选是 `main..HEAD`(基线 `main`=`f4d8de9`)。不要修改任何文件,不 commit / push / 部署,不访问真实账号或调用 AI 服务;可运行仓内只读脚本与测试(沙箱若禁止写临时文件,写明「未运行」)。

## 任务(只回答这三件事,尽量短)

1. 224 报告的两条 open 项是否在当前 HEAD 关闭:
   - A-01(`SAYDO_HOME` 用 `..` 或 symlink 越出 `HOME`):`deploy/saydo-octoooo-com/install.sh` 的用户目录约束段;用 `HOME=<mktemp -d> SAYDO_HOME=<HOME>/../../var/lib/x sh install.sh` 与 symlink 场景复现,必须在任何 mkdir 之前 `[fail]`。
   - N-01(Windows 默认根目录在被重定向的 `%LOCALAPPDATA%` 下被误拒):`deploy/saydo-octoooo-com/install.ps1` 的 `$userBases` 段;按源码路径模型核验 `USERPROFILE=<win-home>`、`LOCALAPPDATA=<win-localappdata-on-D>`、Root 未设置时是否 accepted,以及 `C:\ProgramData\x` 与 `<win-home>\..\..\ProgramData\x` 是否 rejected。
2. 第 2 次修复是否引入新的 P0/P1:例如 `..` 词法拒绝误伤合法路径、`realpath` 复核在 `SAYDO_HOME` 尚不存在时的行为、`HOME` 本身是 symlink(macOS `/tmp` → `/private/tmp` 这类)时是否误拒、Windows 双基准是否放开了不该放开的位置。
3. 运行并报告 exit code:`node scripts/test-install-scripts.mjs`、`node scripts/check-active-claims.mjs`、`node scripts/check-public-tree-privacy.mjs --fs`、`bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`、`sh -n deploy/saydo-octoooo-com/install.sh`、`git diff --check main..HEAD`。

## 输出

中文、零 emoji。
1. 一句话结论:`[pass]` 或 `[fail] xA/yB/zC`(只统计仍 open 或新引入的)。
2. 表:`id | 状态 | file:line | 复现命令 | 实际结果`(A-01、N-01 各一行;新发现另起 N-xx 行)。
3. 实际运行过的命令与 exit code。
4. 未运行 / 无法核验的项。
