# IMPL-PROMPT · SC-RELAND-01 consolidation 残余缺陷重落地

- 候选(唯一可写树):`~/.codex/worktrees/saydo-sc-reland-20260925`(git worktree,分支 `codex/sc-reland-01`,HEAD = 本执行卡所在的插批提交)
- 启动:由 supervisor 经 runner 以 one-shot 派发,cwd = 候选根;不要 `cd` 到别处施工
- 只读与禁止:主树 `~/WorkSpace/SayDo` 只读;不 commit / push / merge / rebase / tag,不改 git 配置,不 `pnpm add` 新依赖,不改真实 `$HOME` 下配置,不部署官网,不连真实 SMTP/ntfy/供应商,不跑发布动作,不调用付费模型接口

## 0. 目标与授权终点

2026-09-13 的整合任务(本地 tag `archive/wip-consolidation-20260913`,基线 `49ed96f`)对账出 SC-01…SC-59 一批真实缺陷并做了修复,但从未评审、从未合并,主线此后又前进了两周。本批把**其中仍然有效的独立缺陷修复**按当前 main 重新落地。

授权终点:在候选树内完成代码、测试、canonical 对齐、证据文件与本地门禁,留下**未提交候选**,写完 REPORT 后停止。独立评审、完整门禁复跑、提交与推送由 supervisor 负责。

## 1. 来源与读取方式

- 来源代码:`git diff 49ed96f archive/wip-consolidation-20260913 -- <path>`、`git show archive/wip-consolidation-20260913:<path>`(tag 在本仓 refs 中,worktree 可直接读)。该 tag 提交的父提交是暂存区快照,内容以 tag 本身为准。
- 来源对账报告:`git show archive/wip-consolidation-20260913:docs/review/2026-09-13-consolidation-crosscheck.md`(每个 SC 的复现方式、根因与修复进度)。
- 来源任务记录(只读,仓外):`~/.codex/tasks/saydo-consolidation-20260913/` 下各 `*-result.md`、`*-summary.json`、`*-before.json` / `*-after.json` 探针原始记录与 `continuation-state.json`,用来把文件映射到 SC、找原复现探针。不要全文读原始日志。
- 当前合同:`AGENTS.md`、`docs/09-data-contracts.md`(形状权威)、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`docs/modules/e-crosscutting.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 本批卡。

来源里的结论、测试计数与「已通过」表述都是历史自检,不是证据。一切以你在当前候选上实际运行的命令输出为准。

## 2. 范围

### 2.1 逐项处理(复现后搬)

SC-04、05、07、08、09、10、11、12、13、14、15、16、17、18、19、20、22、23、24、26、27、28、29、30、32、33、34、35、36、37、38、39、40、41、42、43、44、45、46、47、48、49、50、52、53、55、56、57、58、59,以及报告「其他核对」「当前未完成」两节中的文档对齐项(设计 ADR-004 workspace 身份、09 §3.3 签名计数器注释、历史证据/评审/计划文档的时点补注与引用更正、release 文档、三端壳 README 与版本矩阵说明)。

对每一项,按顺序:

1. **在当前候选基线上复现**。优先用来源里的测试或探针,改写成本仓测试套件中的回归用例(vitest / pytest / 脚本自测);文档项用逐字比对当前文件内容。
2. **判定**,四选一:`relanded`(缺陷仍在,已修)、`already_fixed_on_main`(当前 main 已由后续批修好,给出文件:行或通过的测试)、`superseded`(相关代码/文档已被后续批重写或删除,原缺陷不再成立,给出依据)、`not_reproducible`(按来源方式无法复现,说明尝试了什么)。
3. `relanded` 的项:以来源修复为参考,在当前代码上实现最小修复;回归用例必须在修复前失败、修复后通过(在 REPORT 里记修复前失败的命令与输出摘要)。来源修复本身若在报告里被标为仍有缺口(如 SC-56 首修后的 `%A`/`%a`/`abc%A` 越界、SC-33 第二次回修、SC-30 Cursor 横向补查、SC-21 类的第二次回修结论),以报告里最后的反例为准修到位,不要照搬旧的半成品。
4. SC-10 已见 `focusBudgetCopy` 按 currency 呈现,核实后大概率是 `already_fixed_on_main`;SC-35/37 的语音 schema 项 JOURNEY-01 曾读过,仍要在当前 contracts 上复现再判定。

### 2.2 不搬(只在证据文件里登记一行原因)

- SC-01:09-13 当时的远端 CI 状态,已过时。
- SC-02、03、21、25、31,以及 `packages/contracts/src/types/truthPlane.ts`、`packages/contracts/test/truth-plane.test.ts`、`scripts/{action-ledger,capability-ledger,support-matrix,gate-id-registry}.json`、`scripts/truth-plane-vocab.json`、`scripts/{check,test}-{action-reachability,capability-ledger,support-matrix}.mjs`、`docs/plan/IMPL-PROMPT-pg02-truth-gate.md`:归 PG-02 在途候选,本批不碰。
- SC-06:语音 review-10 的伞状项,JOURNEY-01 已按 2026-09-20 取舍吸收;来源里 console 语音 hooks、`useVoiceChannel`、hub/voiceBarrier 等语音候选改动不搬(除非某条独立 SC 复现后确需改同一文件)。
- SC-51(Windows 命名管道 stdio 失败/有界关闭)与 SC-54(历史 CLI spike 判定证据):deferred 为 `DF-SC51-WIN-STDIO`、`DF-SC54-SPIKE-EVIDENCE`。对应的 `win32_native.py` 命名管道消费、`packages/platform/test/win32-native-pipe*.test.ts`、`packages/daemon/test/win32-native-pipe-consumer.test.ts`、`e2e/spikes/claude-cli-tier1/**` 不搬。若某条在范围内的 SC(例如 SC-47 状态根身份)在来源里与这些文件同一改动,只搬属于该 SC 的部分。

### 2.3 历史记录入库

把来源中的 `docs/review/2026-09-13-consolidation-crosscheck.md`、`docs/review/2026-09-13-consolidation-crosscheck-IMPL-PROMPT.md`、`docs/review/2026-09-12-handoff-attachment-absorption.md` 作为历史记录收入 `docs/review/`,原文不改;每份文件顶部加一行 `> 2026-09-25 入库注:历史记录,当前处置见 e2e/evidence/sc-reland-01.md。` 本机 home 路径按 `scripts/public-text-redaction.mjs` 的规则脱敏为 `~`(可用该模块的 `redactPublicText`)。

## 3. 验收项(原编号,REPORT 按此逐条判定)

- **A1 处置全覆盖**:§2.1 列出的每个 SC 与文档对齐项在 `e2e/evidence/sc-reland-01.md` 的处置表中恰好一行,含判定、复现方式、修复前/后结果与涉及文件;§2.2 每项一行原因。
- **A2 回归用例**:每个 `relanded` 的代码缺陷都有进入现役测试入口(`pnpm test` / `uv ... pytest` / `just ci` 所调脚本自测)的回归用例,修复前失败、修复后通过。纯文档项以内容比对为证。
- **A3 范围守恒**:§2.2 列出的文件与语音候选改动未被搬入;未新增依赖;未改 WS 词表语义与 DDL;不放宽 Gate 0 / S3 / TTS 脱敏 / 审计不可变;远程业务面保持关闭。
- **A4 合同一致**:改到的行为与 09/10/11 及 e-crosscutting 一致;若 canonical 本身需要改,先改 canonical 并在证据里说明;09 已有类型一律 import `@saydo/contracts`,不重定义。
- **A5 文档时点补注**:历史证据/评审/计划文档只加日期限定的补注或更正,不改写当时结论与原数字;每处补注核对过当前文件内容,不再适用的来源补注不搬。
- **A6 站点与发布文案**:`deploy/**`、`docs/site/**`、release 文档的更正与当前远程关闭合同、逐步确认合同一致;SC-50 键盘焦点修复保留展开/Escape/桌面行为;不部署。
- **A7 历史记录入库**:§2.3 三份文件已入库、加注、脱敏。
- **A8 证据文件**:`e2e/evidence/sc-reland-01.md` 含处置表、门禁命令与退出码、`not_run` 清单(至少:Windows 原生 API、三端真机、官网部署、真实外发、发布动作),状态词用 `[ok]/[warn]/[fail]`。
- **A9 门禁**:§4 全部命令在最终候选上 exit 0。
- **A10 硬规则**:零 emoji;执行状态不说「完成」;日志与审计分流、敏感 payload 只记 digest;无 secret、无本机 home 绝对路径进入候选。

## 4. 门禁命令(cwd 均为候选根)

工具绝对路径:`/opt/homebrew/opt/node@22/bin/node`(v22)、`~/.local/bin/pnpm`(10.33.1)、`/opt/homebrew/bin/just`、`uv`(`just ci-python` 内调用,用 `command -v uv` 取实际路径)。依赖已由 supervisor 在候选里装好(`pnpm install --frozen-lockfile`、`uv --directory pipeline sync`);如需重装只用这两条。

迭代期(受影响即跑):

```bash
pnpm -r typecheck
pnpm lint
pnpm --filter @saydo/daemon exec vitest run <受影响测试文件...>
pnpm --filter @saydo/cli exec vitest run <...>
pnpm --filter @saydo/console exec vitest run <...>
pnpm --filter @saydo/platform exec vitest run <...>
pnpm --filter @saydo/contracts exec vitest run
uv --directory pipeline run python -m pytest -q
node scripts/schedule-pointer.mjs --check
node scripts/schedule-pointer.mjs --self-test
bash scripts/check-emoji.sh
node scripts/check-doc-links.mjs
node scripts/check-public-tree-privacy.mjs --fs
node scripts/check-active-claims.mjs
git diff --check
```

最终(候选不再改动后按顺序跑,各自记退出码):

```bash
just ci                     # 覆盖 typecheck/lint/全部 vitest/节点脚本自测/emoji/色值/隐私 --ref HEAD/ruff/pytest;不覆盖浏览器
pnpm exec playwright test   # 覆盖 e2e 浏览器;不覆盖真机与官网部署
just precommit              # 覆盖 emoji/文档链接/隐私 --fs/排产指针
```

`check-public-tree-privacy.mjs --ref HEAD` 只扫已提交树;未提交改动的隐私由 `--fs` 覆盖,两者都要绿。Swift(SC-56)若本机有 `swift` 工具链,用它编译运行最小用例;没有就在 `not_run` 写明,并保证共享 generator 与 Kotlin/ArkTS fixture 的测试在 `just ci` 中覆盖。

## 5. 交付物与 REPORT

- 候选内:代码、测试、文档与 `e2e/evidence/sc-reland-01.md`,全部**不提交**。
- 候选外 REPORT:`~/.codex/tasks/saydo-sc-reland-20260925/impl/REPORT.md`(目录已建好;不要写进候选树,否则改变候选指纹)。按顺序含:
  1. `git rev-parse HEAD` 与 `git status --porcelain` 的原样输出,以及 `python3 ~/.octoworkflow/candidate_fingerprint.py` 输出;
  2. 每条门禁的命令原文、退出码、通过/失败计数、日志路径(日志放同目录)与 sha256;没跑的列 `NOT_RUN` 并给原因;
  3. A1–A10 逐条 完成/部分/未做/偏离;
  4. 已知缺陷、绕过、假设,以及任何你认为需要 owner 决定的事项。

## 6. 何时停下

- 遇到需要业务取舍的冲突(例如当前 canonical 与来源修复互相矛盾且无法由 09 裁决)、需要新依赖、需要真实外部服务或凭据时:不要自行决定,记入 REPORT 第 4 部分,跳过该项继续其余项。
- 全部项处置完、门禁跑完、REPORT 写完即停止。不要自审、不要派 reviewer、不要提交。
