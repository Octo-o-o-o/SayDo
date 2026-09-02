# 224 · 修复后候选的全新零上下文复审(2026-09-02;第 2/3 次复审)

你是全新的零上下文、只读评审者;不要读取 `prompts/222`、`prompts/223` 或 `research/codex-findings/223-*` 以外的任何历史评审推理。仓库是 `<repo>`(当前目录),分支 `codex/monthly-crosscheck-20260902`,被审候选是 `main..HEAD`(基线 `main`=`f4d8de9`)。不要修改任何文件,不 commit / push / 部署,不访问真实账号或调用 AI 服务;可运行仓内只读脚本与测试(沙箱若禁止写临时文件,写明「未运行」)。

## 任务

上一名 reviewer(`research/codex-findings/223-monthly-crosscheck-quickstart-review-retry.md`,你可以读它的表格,但不要继承它的推理)给出 7A/7B/5C;实施方声称已修 A-01…A-07、吸收 B-01…B-07、修 C-02/C-04/C-05。你只回答两件事:

1. **逐条复核**这 7 条 A 与 7 条 B 是否在当前 `HEAD` 上真的关闭:对每条给出 `closed | still_open | partially_closed` 与 file:line 证据;A 用最小动态复现(可用 `mktemp -d` 的 HOME/SAYDO_HOME、`SAYDO_INSTALL_NO_MODIFY_PATH=1`、`sh -n`/`dash -n`、只走到下载前的分支),B 用你自己写的 mutation 打 `scripts/test-install-scripts.mjs` 的 `checkInstallScripts()` 或直接运行该脚本。
2. **回归**:修复本身是否引入新的 P0/P1(例如根目录约束误伤合法默认路径、`grep -Fxq` 对既有旧标记行的兼容、fish 分支、Windows `%~dp0` 启动器、`release.yml` 新增步骤、active-claims roots 扩到 33 后对两份脚本正文的误杀)。运行 `node scripts/test-install-scripts.mjs`、`node scripts/test-active-claims.mjs`、`node scripts/check-active-claims.mjs`、`node scripts/check-public-tree-privacy.mjs --fs`、`bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`、`sh -n deploy/saydo-octoooo-com/install.sh`。

## 输出

中文、零 emoji、尽量短。
1. 一句话结论:`[pass]` 或 `[fail] xA/yB/zC`(只统计仍 open 或新引入的)。
2. 表:`id | 状态 | file:line | 复现命令 | 实际结果`(A-01…A-07、B-01…B-07 各一行;新发现另起 N-xx 行)。
3. 实际运行过的命令与 exit code。
4. 未运行 / 无法核验的项。
