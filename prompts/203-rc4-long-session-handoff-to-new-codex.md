# SayDo RC4 长会话完整接力

请继续完成 SayDo 最近一周文档/commit 双向对账、缺口修复、交叉评审、集成、发布、官网部署、三桌面快速启动实测、移动真机验证和最终本地清理。不要从头重做，也不要把现有红灯 checkpoint 当成发布候选。

工作区根目录：`~/WorkSpace/SayDo`

开始前完整读取：

1. `~/.codex/AGENTS.md` 与仓库 `AGENTS.md`；
2. `impl-review` skill；
3. 本 prompt；
4. 当前阶段点名的 canonical、实施 prompt、readback 和实际 diff。

全程使用简体中文。任何完成、通过、commit、push、Release、部署和真机结论必须来自新会话真实命令。保留所有用户改动；禁止 reset、checkout、stash、批量清理或 `git add -A`。实施与评估继续零上下文隔离：实施优先 Grok `grok-4.6`/`xhigh`，评审使用两个全新零上下文 subagent 加 Codex `gpt-5.6-sol`/`max`。Release、push、tag、部署和设备分发在 runtime 与 privacy 都取得 Go 前继续冻结。

## 一、已经完成并可复用的成果

### 1. 发布事务线已经独立收口

- worktree：`~/WorkSpace/SayDo-rc4-release-second-red-rebuild-20260823`
- branch：`codex/rc4-release-second-red-rebuild`
- 代码提交：`8b123acc89e5338c4c637270c067fb301ced6576`
- 证据提交 / HEAD：`033bdc8cfa9bf79461334f563cedd02b21015f7c`
- worktree clean。
- 该线已完成发布事务、openat/单 fd、凭证脱敏、Cloudflare 回读、证据原子性等返工和独立复核。本轮不要重新施工；最终集成后只做组合门禁和真实发布回读。

### 2. 三端移动准备线已经独立收口

- worktree：`~/WorkSpace/SayDo-rc4-mobile-readiness-fix-20260823`
- branch：`codex/rc4-mobile-readiness-fix`
- 代码提交：`c56ebdf178bf7abf30d022a7b7c08374f2f07b4b`
- 证据提交 / HEAD：`4fe482b0a4e883f4e6fcb6ae7b1195d51b5e72bd`
- worktree clean。
- 已闭合三端 pairing corpus、安装器合同、Android/HarmonyOS/iOS 构建入口和网站文案边界。开发签名/unsigned 包仍不是商店包，也不得作为 GitHub Release 下载物。

### 3. 发布 + 移动已经进入部分最终集成分支

- worktree：`~/WorkSpace/SayDo-rc4-final-integration-20260824`
- branch：`codex/rc4-final-integration-20260824`
- HEAD：`83ba793bb9622ba3c079c7ae600cd02b0e2f53c8`
- release 分支是该分支祖先；mobile 分支的 5 个提交均被 `git cherry` 判为 patch-equivalent。
- 当前只有一处未提交修正：`docs/plan/2026-08-22-week-audit-faststart-release.fable.md`。它纠正 rc.2/rc.3 远端 tag 已不存在的事实，同时要求不得重建、移动或重跑同名旧 tag，应保留。
- runtime 和 privacy 尚未集成，禁止把该分支当最终候选。

### 4. 桌面快速启动方案已经设计并落到发布候选

当前选择是不依赖 npm registry 的 immutable GitHub Release tgz：

```text
npm exec --yes --package=https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.4/saydo-cli-0.1.0-rc.4.tgz -- saydo up
```

常用安装为从同一固定 URL `npm install --global <tgz>` 后运行 `saydo up`。它面向 macOS、Windows、Linux，启动 daemon + Web 控制台；Windows/Linux 当前是前台服务，语音 pipeline 和 macOS launchd 常驻仍走源码说明。README、rc.4 release notes、官网中英文 Docs 已按“Release 存在且门禁全绿后才生效”的条件文案落地。npm registry 发布可留给 owner 手工做。

### 5. 运行时旧实现已经完成第二轮红灯封存

- 旧 worktree：`~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823`
- branch：`codex/rc4-runtime-recovery-rebuild`
- 第二轮红灯前实现：`2637d30ba5ffeedb6067555e9d816dd02d526e43`
- 失败实现 checkpoint：`848cf38642db487348f284623042345f77f9dec3`
- checkpoint commit：`chore(checkpoint): 固化运行时全新实施第二轮红灯状态`
- 旧实施 session `01a03397-9ddf-7870-93b9-6c68101a1201` 永久弃用，禁止 resume。
- readback：`docs/review/2026-08-24-rc4-runtime-fresh-final-readback.md`
- 正式 Codex 报告：`research/codex-findings/117-rc4-runtime-final-static-verdict.md`
- 结论为 No-Go；R1-R11 的完整验收合同已经固化。

## 二、当前最优先：继续未完成的 runtime 全新重实施

### 1. 稳定坐标与防漂移指纹

- worktree：`~/WorkSpace/SayDo-rc4-runtime-final-reimplementation-20260824`
- branch：`codex/rc4-runtime-final-reimplementation-20260824`
- HEAD：`848cf38642db487348f284623042345f77f9dec3`
- 完整验收 prompt：`prompts/202-rc4-runtime-second-red-final-reimplementation.md`
- 当前 tracked diff：25 文件，`1286 insertions / 576 deletions`
- 产品 diff：`git diff --binary HEAD -- docs packages` 的 SHA-256 应为 `c5ed598c11a7c99d33c4dbaa1e21bc8108d17c8e3d05737120b72af3c0a0e858`
- 完整状态：`git status --porcelain=v1 -z -uall` 的 SHA-256 应为 `f6d38f91af641b7cb9581215fd0a5a36a97aa0a3c402f959a518b6e05727ac69`

新增未跟踪产品/测试文件及 SHA-256：

```text
e406b9e41598d862b43caab0e37e0c06719c4a9bf850fdba4c95cd2b712e2d62  packages/daemon/src/httpJsonBody.ts
4f7b80dc3386c0ebda01ee2dbf2cc377caccec98d7a000a2ea83628d7fac30f2  packages/daemon/test/http-json-body.test.ts
102863760b4d667be90d21e2697e437481b4b4d506e1f822c09093c619bb5a2c  packages/platform/test/fixtures/home-lock-worker.mjs
d47c9ffaf9c3b3f11d3674e4e4fd893780e72a09abf8b3d7adf0e3387aa913ac  packages/platform/test/job-identity.test.ts
```

实施 prompt 的 SHA-256：

```text
5b255dc748874bce78dc88073a3dc332f6a428f3edd74518b9ec7565e36d5562  prompts/202-rc4-runtime-second-red-final-reimplementation.md
```

新会话第一步重新计算这些值。若不一致，先检查差异来源，不得 reset 到这些值。

### 2. 被主动中断的实施会话

- Grok session：`01a0342a-fc21-7c20-ab31-2793254324f3`
- 原始日志：`logs/2026-08-24-rc4-runtime-second-red-final-reimplementation-grok.jsonl`
- 日志：8855 行 / 14030058 bytes / SHA-256 `d7ec478d34415bdf792f7112989cde0c7f5fc8bb592ff68f86ff0ebbf8f0e344`
- owner 请求切换 Codex 会话后，协调会话对该进程发送 Ctrl+C；真实 exit 130。它没有 `end_turn`，不能把它视为已交付。
- 该实现会话不是旧红灯会话。优先用 `grok --resume 01a0342a-fc21-7c20-ab31-2793254324f3` 恢复对话，并继续使用当前 dirty tree；不要加 `--restore-code`。保持 `grok-4.6`、`xhigh`、`--no-subagents`、workspace sandbox、always approve、disable web search。先给它当前六条宿主红灯、lint 六错和下述 macOS 偏离，再让它继续。若 resume 本身出现非配额错误，先诊断，不能直接切换实现通道。

### 3. 当前已落地但尚未验收的主要方向

- ADR-003 已改为 generation-bound、无歧义 Job 名：`<scope>\\SayDoJob-v1-<lowercase sha256hex>`，digest 输入为 `saydo-job-v1\0 + owner + \0 + run + \0 + generation`。
- `jobIdentity` 正在强制完整 runtime/agent immutable identity、generation、command token、Job 名和 NUL fail-closed。
- `homeLock` 增加跨进程边界、目录 fsync、两独立 Node 进程等待/崩溃释放测试。
- runtime generation/signal 正改为捕获 generation capability，旧代 signal/release 不再动态按裸 PID 查 successor。
- Windows 正补 rollback retain error、Job/process capability 和 NUL 拒绝。
- recovery-only 正抽出 HTTP handled/failed body parser，invalid JSON 后停止业务；prebound ready 改为 await。
- lifecycle 正把 coordinator 提前到首次 bind 前，并把 freeze 后移到 audit/close 后。

这些只是方向，不能写成完成。

### 4. 2026-08-24 23:31 后宿主静止基线

```text
pnpm --filter @saydo/platform test
exit 0；7 files passed；58 passed / 6 skipped

pnpm --filter @saydo/cli test
exit 0；4 files passed；45 passed / 1 skipped

pnpm --filter @saydo/daemon exec vitest run \
  test/lifecycle-disposition.test.ts \
  test/runtime-child-registry.test.ts \
  test/tier1-executor.test.ts \
  test/byoa.test.ts \
  test/restart-policy.test.ts \
  test/startup-failure.test.ts \
  test/tier1-gate-socket.test.ts \
  test/shutdown-deadline.test.ts \
  test/recovery-only-process.test.ts
exit 1；4 files failed / 5 passed；393 passed / 1 skipped / 6 failed

pnpm typecheck
exit 0

pnpm lint
exit 1；6 errors

bash scripts/check-emoji.sh
exit 0

git diff --check
exit 0
```

六条 daemon 失败：

1. `byoa.test.ts`：`pipe_failed 进入 API 与审计且不记录原文`，因 fake spawn 缺 runtime Job identity，`abortAllByoaInvocations()` 被 `runtime job identity missing` 拒绝。
2. `recovery-only-process.test.ts`：restart 后同步 signal 仍落 `reason=restart`，应由 `supervisor_stop` 升级胜出。
3. `recovery-only-process.test.ts`：supervised restart 后同步 prepareShutdown 同样过早固定 restart。
4. `startup-failure.test.ts`：真实 daemon prior-generation owner 在 ready 前回收失败，日志为 `prior_runtime_owner_recover_failed`，health timeout。
5. `tier1-executor.test.ts`：agent 已退出、终态 marker 未落的恢复用例报 `process group error graph contained a hostile value`。
6. `tier1-executor.test.ts`：live owner 已写 success result 的恢复用例报同一 hostile graph 错误。

lint 六错：

- `packages/cli/src/emergencyReaper.ts`：未使用 `commitOwnerReap`；
- `packages/daemon/src/api/recoveryOnlyServer.ts`：未使用 `sendFrame`；
- `packages/daemon/src/runtimeChildRegistry.ts`：未使用 `renameSync`；
- `packages/daemon/src/tier1/executor.ts`：未使用 `renameSync`、`AgentOwnershipRecord`、`throwIfAborted`。

未跑 daemon full，因为九文件组合已红；修复后必须严格串行补跑 prompt 202 的全部门禁。

### 5. 必须优先纠正的额外偏离

`packages/platform/src/process.ts` 当前新增了 macOS `libproc.dylib`/`sysctl`/Koffi 回退，并用硬编码结构体 offset 读取 start/pgid/argv。它是 Grok workspace sandbox 无法执行 `/bin/ps` 后的绕行，但 ADR-003 仍明确规定 darwin birth/anchor 走 `/bin/ps`，失败即 null/fail-closed。该实现扩大 ABI 与安全面、无 canonical 支持，也没有必要。除非 owner 另行明确裁决，应删除这段 libproc 回退并保留 `/bin/ps` 合同；宿主门禁在 sandbox 外运行。不要为了让 Grok sandbox 自测变绿而改生产机制。

### 6. runtime 收口顺序

1. 恢复上述 Grok 实施 session，关闭六条失败、lint 六错和 macOS 偏离；保持 registry/identity fail-closed，不能把缺 identity 改成 permit-granting no-op。
2. 按 prompt 202 严格串行跑 platform、CLI、daemon 九文件、daemon full、typecheck、lint、emoji、diff-check、机械检索和残留进程检查。
3. Windows-only 项必须在实体 Windows 走生产适配层；Mac mock/skip 不能冒充通过。
4. 全绿后再启动两个全新零上下文 subagent 和一个全新 Codex `gpt-5.6-sol`/`max` 只读对抗评审。旧三个 reviewer 只审过 `2637d30…`，不能计入新实现评审。
5. A 级全清后按仓库两提交法形成 runtime 代码提交和证据提交；证据记录代码 SHA，不自指。未 Go 不得集成。

## 三、runtime Go 后再做 privacy

- worktree：`~/WorkSpace/SayDo-rc4-f107-readline-review-fix-20260823`
- branch：`codex/rc4-f107-readline-review-fix`
- HEAD：`18d0dc786c8057d96d317872d61ca47d21f5ca87`
- 已有代码提交：`09f7920dadf3b5907e18d955f8612c3ec41da8b5`
- 已有证据提交：`18d0dc786c8057d96d317872d61ca47d21f5ca87`
- 当前 worktree 仍有 98 个 status entry，不能清理或覆盖。
- 新实施唯一输入：`prompts/188-rc4-privacy-second-red-fresh-implementation.md`。这是第二次红灯后的全新会话，禁止 resume 旧 privacy 实施 session。

当前三组 P1：

1. `scripts/week-audit.mjs` 第二个 Git adapter 丢弃 helper 的 stdin/options，使真实 `git cat-file --batch-check` implementation boundary 失败并可能泄漏 owner-home path。
2. CI 等价 checker 只比 12 条子集且靠字符串，可被 folded YAML、`if:false`、`continue-on-error`、`set +e`、heredoc/comment/echo、假 needs、删除真实 gate 绕过；四入口约 25/26/28/29 条并不等价。
3. `ios-artifact-policy.mjs` 漏 sdk-qualified `DEVELOPMENT_TEAM`、`TeamIdentifier`、Apple account/email、40-hex legacy UDID、现代设备 ID 和个人 device name/destination。

按 prompt 188 用全新 Grok session 实施，跑真实 full-history clean candidate、所有 hostile 和完整门禁，再做两个新 subagent + Codex 对抗评审。dirty source 缺最终 implementation-boundary 证据是集成阶段预期红项，不能伪造。

## 四、最终集成、发布、部署和设备验证

runtime 与 privacy 都 Go 后：

1. 回到 `SayDo-rc4-final-integration-20260824`，保留当前 plan 修正，精确集成 runtime、privacy 的代码/证据提交。先比较 patch/树，禁止盲目 merge 或带入 review 临时文件。
2. 跑 `just ci`、CLI distribution、release provenance、public privacy/boundary、站点视觉截图、emoji、diff-check、全树状态和 release plan 的全部总门禁。
3. 重新做最终两个零上下文 subagent + Codex 交叉 review；任何 A 未清继续冻结。
4. 发布顺序不可交换：clean internal SHA 推 `origin/main`；从同一 SHA 生成 clean public snapshot；`public/main` 与不可移动 `v0.1.0-rc.4` atomic push；等待首次 attempt 1 workflow；创建/回读 GitHub Release；固定 URL smoke；availability 原子更新；公开 CI；最后 official Cloudflare deploy/readback。
5. 使用 Cloudflare/wrangler 前读取相应 skill。部署证据文件必须走现有 fresh lease/openat/原子事务，不能手写绕过。
6. 当前远端实况：`origin/main=8602c7324844ede014c577409ae10a834f1a1714`；`public/main=a29f671f79cf5f73452cecd60b092072c72c2aab`；两边均无 `v0.1.0-rc.4`；两个 GitHub 仓库 Release 列表为空。不要把本地候选写成已发布。
7. GitHub Release 出现后，在本机 Mac 用同一 URL 分别测试 `npm exec` 和 `npm install --global`：空 cache/prefix/SAYDO_HOME，启动、health、受保护 summary、console、重复 attach、Ctrl+C、零孤儿。
8. 使用 owner 已给的 `ssh <owner>@<private-ip>` 到实体 Windows；公开证据不得记录用户名、IP、known_hosts 或私有路径。以 `--no-open` 为主，测试 exec/global、启动、health、stop、零孤儿及 Windows-only runtime 门禁。
9. Linux 以公开 GitHub Actions Ubuntu distribution 为发布证据；不要把 CI 写成 systemd 常驻真机验证。
10. iPhone Air、HarmonyOS、Android 只向当前可连接真机推包并启动。历史证据：iOS 曾开发签名装机但本轮仍需复测；HarmonyOS 当前 unsigned 且缺 SayDo Profile；Android 最近无在线 adb 设备。设备离线、需解锁或缺签名材料时保留真实阻塞，不伪造通过。开发签名/unsigned 包不得放 GitHub Release。
11. npm registry 上传留给 owner 手工；不要主动 publish npm。

## 五、暂缓但必须保留的战略方案

主 worktree `~/WorkSpace/SayDo` 当前在 `codex/week-audit-faststart-20260822`，HEAD `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`。本 prompt 写入后的稳定读取为 2 个 tracked modified、163 个 untracked，共 165 项；其中 `.playwright-mcp` 临时截图描述文件数量可能自行变化，所以新会话应重取而不是把总数当不变量。其余项目包括约 4.8 万行的 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`、大量 prompts/reports/probes 和两张站点截图。该树不是当前 RC4 集成树，禁止清理、提交到 RC4 或顺手整理。

该方案只形成设计，没有实施生产代码。Phase 0 仍被 active pointer/dirty canonical/PLAN-2 坐标和十项 owner 决策阻断：排产坐标、Execution Agent plane 归属、evaluator 同 family 降级、Claude 订阅、LAN discovery、secret/付费边界、扩展交付边界、registry 信任域、SDK/runtime 演进、合同编译资源基线。默认推荐见方案 §14。除非 owner 先回答并完成具名排产，不得实施这条战略线。

## 六、worktree 与清理纪律

当前 `git worktree list` 有 20 个条目。以下 dirty 树必须保留：

- 主 worktree：当前读取 165 项，其中本交接 prompt 是最后新增的一项；`.playwright-mcp` 数量可能变化；
- runtime 新实施：30 项；
- runtime 旧 readback 树：37 个未跟踪 prompt/report；
- privacy：98 项；
- final integration：1 项；
- `/private/tmp/saydo-final-review.r5QcMt`：35 项；
- `/private/tmp/saydo-release-public-check.6GsIzi`：14 个 staged 项；
- `~/WorkSpace/SayDo-runtime-baseline-check-20260823`：3 项。

这些临时树是否可删必须在最终发布后逐个证明：分支已成为最终 main 祖先或 patch-equivalent；所有 tracked/untracked/staged 文件与已保留提交/证据逐项一致；没有独有用户改动。清理前再次 `git worktree list`、branch ancestor、status、必要文件 hash；只清本地，不删除远端历史分支。当前不要清理任何一个。

## 七、新会话第一轮应输出的状态

先用真实命令复核 runtime 指纹、进程为零、远端 main/tag/Release 状态和各关键 worktree status。随后明确回复 owner：

- 当前继续点是 runtime 六条失败，不是 release/deploy；
- release/mobile 已独立收口，final integration 只缺 runtime/privacy；
- 没有 push/tag/Release/deploy/device final test；
- 接下来会恢复 Grok runtime session，修绿、宿主门禁、三路独立评审，再进入 privacy。

然后直接继续，不要再次要求 owner 重述目标。只有战略十项决策、真实签名/设备解锁、商店或 npm registry 外发等无法从仓库判定的事项再上浮确认。
