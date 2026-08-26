# AI 供给专题 · 启用补充与坐标刷新（2026-08-26，RC 链 rc.12 收口后）

你是一个对本专题零上下文的新会话。**本文件是 `prompts/204-ai-supply-post-rc4-continuation.md`
的启用补充**：204 仍是任务主体（必读文档清单、四项决策消化、四阶段任务、红线、诚实汇报
全部以 204 为准），本文件只承担两件事——把 204 写作时（2026-08-25，RC4 未收口）的过时
坐标刷新到收口后实况，并给出 204 未覆盖的前置任务。**两文件冲突时，以本文件的实测坐标为准；
但你自己复测后若与本文件也不符，如实报告，不要默默适配。**

## 0. 收口后坐标（2026-08-26 实测，启用前请复测）

- **RC 链已收口于 `v0.1.0-rc.12`**，不是 204 预期的 rc.4。rc.4–rc.9 的 tag 存在但按
  `run_attempt===1` 铁律永久不可用/未发 Release；rc.10/rc.11/rc.12 均为全绿 available，
  **rc.12 是最新**：15 job 全绿、六项 CI fixed URL smoke + 四项真机实体门全过、
  availability 文案已翻转、双站 Cloudflare Pages 已上线。
  详账：`docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md` §1–§17。
- **tag 全部在公开仓**（`github.com/Octo-o-o-o/SayDo`），内部仓/归档仓不打 tag。
  204 门 1 的 `git tag --list 'v0.1.0-rc.4'` 在任何本地仓都是空——那条命令的预期本身不成立，
  改用本文件 §1 的版本。
- **RC4 四条工作线全部并入 main**：runtime、privacy、release（204 门 1 前两条 cherry=0
  已达成）、mobile（2026-08-26 补并，合并提交 `d83c341`；204 实测时为 5 未并——
  那是 RC 会话的收口遗漏，已修）。
- `prompts/203-rc4-long-session-handoff-to-new-codex.md` **已不存在**（未跟踪工作文件，
  未入库即消散）。204 已预留"以届时实况为准"，无需寻找。
- 发布工程新增机制（若阶段 D 碰到发布链路会用到）：发布合同 v2（contentDigest 来源绑定）、
  23 项本地门禁（与 CI release quality 同覆盖 + playwright e2e）、容器 publish 预检惯例。
  要点见记忆文件与 readback §14–§17，不必现在读。

## 1. 修订后的启用门（逐条实测；任一红 = 停，上浮 owner）

1. **四线并入**（204 门 1 修订版）：
   ```bash
   git cherry main codex/rc4-release-second-red-rebuild | grep -c '^+'   # 预期 0
   git cherry main codex/rc4-mobile-readiness-fix      | grep -c '^+'   # 预期 0
   git ls-remote --tags https://github.com/Octo-o-o-o/SayDo.git | grep -c 'v0.1.0-rc.12'  # 预期 ≥1
   ```
2. **active pointer**（204 门 2 原样）：
   ```bash
   grep -n '当前批次指针' HANDOFF.md | head -1
   ```
   2026-08-26 实测仍为 `w54b-wiring`（C1/C2 已入库、C3 未做，**本批未收口**）→ 此门**红**。
   处置按 204 门 2 原指引：读 `docs/plan/IMPL-PROMPT-16-W54B-CLOSEOUT.md` 头部的
   「当前不可执行」警告块，逐条实测其五条阻断——**任何一条未解除就上浮 owner 裁决**
   （w54b 收口 vs 释放 pointer 直接排产本专题，是 owner 的排产决定，不是你的）。
   不要自行收口 w54b，也不要自行改 pointer。
3. **门禁绿**：`just ci`，退出码显式核查（`echo $?` 紧跟命令，禁止管道取尾）。
   注意 mobile 线并入后 `ci:node` 新增了 `test-pairing-url-corpus` /
   `test-mobile-installers` / `test-mobile-release-contract` 三项，2026-08-26 已全绿。
4. **工作区**（204 门 4 修订版）：**不要用主工作区** `~/WorkSpace/SayDo`——它停在
   `codex/week-audit-faststart-20260822` 且有 70 项他人在途改动（2026-08-26 实测，
   从 204 时的 16 项持续增长，说明那边有活跃会话）。照 204 原纪律：不清理、不提交、不整理。
   本专题从 `~/WorkSpace/SayDo-rc4-runtime-final-reimplementation-20260824` 的 `main`
   （与 origin/SayDo-archive 同步）**另建独立 worktree/clone** 起新分支工作。
5. **HANDOFF 坐标快照**：HANDOFF.md 第 47 行的「当前快照」仍是 2026-08-22 的
   （活动树 `6d98a6e`、公开 `2bb9101`）——常驻 runtime 确实仍是 `6d98a6e`（RC 链只发了
   分发包与官网，未升级本机常驻），但公开仓已到 rc.12 之后。启用本专题前先把该行刷新为
   实测现值并注明「rc.12 已收口、常驻未升级」，避免后续会话拿 8-22 的坐标做判断。
   这是十分钟的文档动作，属于你（做完连同阶段 A 一起给 owner 过目）。

## 2. 然后做什么

全部门绿后，从 204 §3 阶段 A（排产，不写代码）开始，逐字遵循 204 的
§2（决策范围）、§4（红线）、§5（诚实汇报）、§6（工作方式）。
特别重申 204 红线 1：**不要再起新一轮「三路零上下文终审」**——评审对象是真实代码+测试。

## 3. 与本专题无关但同期存在的另一条线（不要混入）

RC 链收口后登记了一批**发布工程质量债**（Windows daemon 单测 92 项失败、CI 增设 Windows
单测 job、`tier1-executor.test.ts` 63 处裸 `vi.waitFor` 的结构性 flaky、归档仓 GitHub
Actions 账单致私有仓零 CI、B7-3/B8 后半）。清单见 readback §17 与记忆文件
`saydo-rc-chain-closure-2026-08-26.md`。**它们是独立线，由另外的会话处理**；
本专题会话不顺手修它们（会话纪律：一次一个专题）。若它们的 flaky 干扰你的 daemon 门禁，
按「单独复跑 2 次判定 flaky vs 回归」的惯例处置并如实记录，不展开修复。

## 4. 本文件的证据

§0/§1 全部数值为 2026-08-26 实测（RC 收口会话）：四线 cherry 计数、公开仓 tags 列表、
HANDOFF pointer/快照行号、主工作区 dirty 计数、mobile 合并提交 `d83c341`、
mobile 合同锚修复（版本锚动态化 + 新版首页标签锚，227 项全过）。
若你的复测与此不符，先怀疑「本文件写后又有变化」，用你的实测为准并报告差异。
