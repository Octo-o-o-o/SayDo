# SayDo 研究文档入库与 GAP-02 残项实施 Prompt(2026-09-09 晚)

> 用途:交给一个全新会话。本文自足。写作依据:Fable 于 2026-09-09 对 main `c9f9c52`(GAP-02-consolidation 已合并、已推私有归档、公开快照 `53a3cd2`)逐项复核 `IMPL-PROMPT-2026-09-09-gap-consolidation.md` §2 九条与 §3,结论:九条全部落地,只剩下面列出的残项;另发现一个更大的档案缺口——2026-09-05 起的研究与核验回写文档从未入库。

## 0. 起点与授权

先读 `AGENTS.md`、`.octoworkflow/project-profile.md`、`docs/README.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 顶部指针块(应为 `active=none, next=PG-02, last_closed=GAP-02-consolidation`)、`docs/plan/2026-08-28-project-gap-owner-decisions.md` 第 11 节、`e2e/evidence/gap-02-consolidation.md`。启动时 `git status --short`、`git log -1 main`、`git worktree list`。

**主树现状(必须先弄清再动手):** `~/WorkSpace/SayDo` 检出的是 `codex/ecc-research-20260905`,停在 `bcf8ea8`(落后 main 二十余个提交),工作树挂着 33 个未跟踪文件和 6 个修改文件。其中:

- 33 个未跟踪文件(`docs/plan/2026-09-05-*`、`docs/plan/2026-09-07-soc-agent-*`、`docs/plan/2026-09-08-deepseek-harness-sd-borrowing.md`、`docs/plan/2026-09-08-email-channel-*`、`docs/plan/IMPL-PROMPT-engineering-*`、`docs/plan/archive/`、`docs/review/2026-09-05-project-gaps-Astra.md`、`research/{astra-gap,astra-gap-synthesis,ecc,ecc-astra,ecc-final,engineering-unified}/`、`research/codex-findings/2026-09-05-*`)是有价值的研究档案与核验回写,main 里没有任何版本。
- 6 个修改文件里,`docs/plan/README.md`、`research/README.md`、`docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md` 的改动有价值(索引与 2026-09-09 状态注);`AGENTS.md`、`.octoworkflow/project-profile.md`、`history/PROCESS-JOURNAL.md` 的改动是 `bcf8ea8` 时期的旧版本,**不能盖到 main**(main 上这三个文件已演进;主树 journal 的 R129「ECC 调研」条目与 main 的 R129「PG-01B」同号冲突)。
- `docs/plan/IMPL-PROMPT-2026-09-09-gap-consolidation.md` main 已有,主树副本内容相同,不重复入库。

授权边界:owner 把本文交给你即授权 §1–§3 全部条目(含本地 commit)。合并到 main、push、公开快照、PLAN-2 指针改动是 owner checkpoint,交付候选后停下问一次。不做真实 provider 付费调用、真实邮箱发送、全局配置。状态词:门禁跑完说“执行和检查都跑完了,等你验收”,合并后才说“交付了”。自检不算独立 GREEN。

## 1. 研究档案与核验回写入库(文档批,不改产品代码)

目标:把主树的有价值未入库内容以 explicit pathspec 落到基于 main 的新分支,一次 `chore(docs)` 提交;旧版本文件不带入。

1. 从 main 建 worktree/分支(建议 `docs/research-ingest-20260909`)。用 `git -C ~/WorkSpace/SayDo show :path` 或直接复制文件,把上面 33 个未跟踪路径**逐个**复制进去;`git add` 只用显式路径列表,禁止 `git add -A`。
2. `docs/plan/README.md`:以 main 版本为底,把主树版本新增的条目手工并入(缺口收敛 Prompt 入口行、工程缺口与 ECC 节、邮件通道评估节、其它借鉴评估里的 soc-agent/SD 两行、08-13 状态注指针);不删除 main 已有的 GAP-02/AS 行。`research/README.md` 同法。
3. `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md`:main 版本 + 主树末尾的「状态注(2026-09-09)」表。
4. journal:主树 R129「ECC 调研与双项目借鉴方案(2026-09-05)」正文改编号为 R151 追加到 main journal 末尾(标明“补记,原稿写于 2026-09-05”),不改动 main 的 R129–R150。`AGENTS.md`、`.octoworkflow/project-profile.md` 主树版本丢弃。
5. 校验:`bash scripts/check-emoji.sh`、`node scripts/check-doc-links.mjs`(注意 `docs/plan/archive/` 内的跳转页与 `docs/plan/2026-09-05-engineering-unified.astra.md` 内的相对链接在干净分支上必须 0 broken)、`node scripts/check-active-claims.mjs`、`node scripts/check-public-tree-privacy.mjs --fs`(研究目录含探针脚本与日志摘录,确认无 secret、无绝对家目录路径进入公开树白名单范围)、`git diff --check`。
6. 入库后主树可以 `git checkout main`(先确认主树已无未提交差异),并删除已合并的 `sd-harness-borrow` 分支与 `../SayDo-wt-sd-borrow` worktree(先 `git worktree list` 确认它指向 main 同一提交)。

验收:干净分支上四项文档门全绿;`git show --stat` 只含上述路径;journal 编号连续。

## 2. GAP-02 残项(小,合在一个 `feat(gap-02-residual)` 提交)

### 2.1 移动端确认卡不认 `memory` kind

现状:`packages/console/src/mobile/pages/CardPage.tsx:152` 按钮恒为「做 / 不要」,渲染的是 attention 行 `item.title`,不是 daemon 的 `prompt_text`;`docs/11-ui-spec.md:517` 已定 memory 卡口径「记 / 不用记」,`pages/Chat.tsx:64-68` 桌面端已按 kind 分文案。R142 记录说“由 daemon 句子承载”,与代码不符。

目标:CardPage 按 confirm kind 取文案(与 `Chat.tsx` 共用同一映射函数,放 `components/redesign/` 或 `lib/`,不复制),`memory` 显示「记 / 不用记」,未知 kind 回落「确认 / 不」;卡正文优先 `prompt_text`(若移动卡数据面没有该字段,先核 `mobile/pages/CardPage` 的数据来源并在 09 §15 对齐,不臆造字段)。

验收:console 单测覆盖 memory 与未知 kind;`docs/11-ui-spec.md` 移动卡段补一句。

### 2.2 VIEW-01 测试与重试粒度补齐

现状:`hooks/redesign/` 只有 `useBoardPageData.test.ts`、`pageLoader.test.ts`、`useRefreshSignal.test.ts`;`useReviewPageData`/`useFocusPageData`/`useRecordsPageData` 无测试;Board 的 `onRetryDetail={reload}`(`BoardPageRoute.tsx:77`)是整页重拉,不是单 Focus 定向重试。

目标:三页 hook 各补一条“事件失效触发重取 + 卸载后无残留”用例;Board 增加单 Focus 定向重试(只重拉该 detail,不重拉列表),失败仍保留占位。

验收:console vitest 通过;Playwright `redesign-refresh` 用例扩一条定向重试。

## 3. 邮件出站通道阶段 A:合同与批卡候选(owner 决策单第 11 节已同意进入排产候选)

依据 `docs/plan/2026-09-08-email-channel-consolidated.fable.md` §4.1 与决策单第 11 节的缺省登记(邮件与 ntfy 并列可选;阶段 B 后议;Web Push/CalDAV 不另开)。本节只做到“可审查候选”,插批位置与实施授权由 owner 在候选交付后决定。

1. canonical 先行:`docs/04-key-mechanisms.md` §4 升级链 L1 加“邮件(可选,与 ntfy 并存)”;`docs/07-tech-stack-decisions.md` D11 补一句;`docs/09-data-contracts.md` §6.3 outbox 行增 `thread_message_id`(可空,additive;迁移写法遵守 PG-05 的“生产迁移前可恢复点”红线——本批只写 DDL 草案与迁移文件,不在无恢复点的情况下对真实库执行);`docs/modules/c-control-bridge.md` C4 依赖行补 email。
2. 批卡:按 PLAN-2 现役批卡格式写 `EMAIL-A-outbound` 卡(depends_on、A-ID、deferred exact-set 含阶段 B/Web Push/CalDAV、scope roots `packages/daemon/src/callback/**`、`index.ts` SweepDeps 注入点、`voice/redactor.ts` 复用、setup secret 面、对应测试;focused gate 列 callback 测试文件;full gate `just ci`)。**不改指针、不插链**,只把卡放在 PLAN-2 候选区并在本文 §5 交付时问 owner 插批位置。
3. 代码候选(可与批卡同分支,单独提交):`SweepDeps.email` 投递对象,SMTP submission(587/STARTTLS 或 465),凭据经 `/api/setup/secret` 落 OS 机密存储;每任务一线程(`Message-ID`/`In-Reply-To`/`References`);正文按 10 §1 状态词,标题与阻塞原因经 `redactText`;深链只带路由不带 token;事件只发 ready_for_review / blocked / failed / approval_request;投递失败不写 notified;两者都未配置时 L1 只剩桌面通知并 warn。SMTP 客户端优先 Node 内置能力或已存在依赖,新增依赖先列出许可与体积让 owner 看。
4. 验收:单测覆盖渲染经 redactor、线程头、DND 路径只发一次、失败不写 notified、未配置降级;真实发送实测标 `not_run`(需 owner 提供临时邮箱凭据)。

## 4. 待 owner 具名(本文不授权)

- **GAP-02 独立零上下文评审**:GAP-02 批评审只有自检(`e2e/evidence/gap-02-consolidation.md` 明写“无独立零上下文评审”)。若 owner 要补,用 `/impl-review` 对 main `c9f9c52` 的 I 链做一次只读复核;不阻塞本文其它条目。
- **PG-02**:PLAN-2 唯一 next,交接 prompt 已在 `prompts/2026-09-06-pg02-opus-handoff.md`;本文不吞并,需 owner 具名开批。
- DSH D-01 已登记为 PG-04 同批候选;Console WS `?token=` 归 `DF-REMOTE-REOPEN`;两者不在本文动。

## 5. 门禁与交付

- §1 只跑文档门;§2/§3 代码提交后跑 `pnpm -r typecheck`、受影响 vitest、`just ci`、`pnpm exec playwright test`(跑完 `git checkout -- e2e/screenshots`)。**`just ci` 期间不要并发启动另一个 vitest。**
- journal 从 R152 起顺延(R151 留给 §1 的 ECC 补记)。
- 交付物:逐条裁决表、`git diff --stat`、门禁输出与日志 bytes/SHA-256、not_run 清单、owner checkpoint 清单(§1 合并、§2 合并、§3 插批位置与是否实施、是否补独立评审)。不把候选说成交付。
