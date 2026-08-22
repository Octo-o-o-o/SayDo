# SayDo 状态对齐批（官网承诺 + 内部事实账本）· 实施 Prompt（第十一轮交接；2026-08-21，owner 已授权开批）

> 编号勘误(2026-08-21 事后,评审 88):本文件与 `IMPL-PROMPT-11-PUBLIC-READINESS.md` 撞用「第十一轮」;12/13 已被 S1/S2 批占用,本批按时间序实为**第 14 轮交接**。原始派发正文与上行自称不改(post-run ordinal erratum),沿革登记于 `history/DEV-VERSION-LEDGER.md` §3。
> 背景：四路独立评审及终裁见 `research/codex-findings/86-status-alignment-triage.md`。本批只把已经确认的事实写回官网、官网源稿、`HANDOFF.md` 与 `IMPLEMENTATION-PLAN-2.md`，不处理需要 owner 另行拍板的工程项。
> 性质：中英文对外文案 + 内部状态档案对齐。无运行时代码、无 canonical 合同语义、无部署。
> 调度分工：实施 = Grok CLI `grok-4.6`、`--reasoning-effort xhigh`、`--always-approve --sandbox workspace`；评估 = 独立只读会话；实施与评估会话隔离。
>
> **2026-08-21 后验勘误（保留原派发正文作为过程证据）**：§3.5 的「observedModel 豁免继续休眠」已被代码与 `docs/09-data-contracts.md` 证伪；正确口径是 BYOA `claude_cli` 的条件豁免已随 T18 落地，Tier1 `claude_code` 不使用该豁免。§3.4 的「LAN 与语音不放行审批」也过度收窄：canonical 明确 voice / `voice_weak` 封顶 S2；正确分面是 LAN 手机面不裁 S2/S3、语音确认封顶 S2、tailnet 配对屏幕面在支持后封顶 S2、S3 只走本机认证屏幕。官网 Docs 的 tailnet 条目还必须区分「开发机 / 旧 runtime 网络底座已就绪」与「当前 HEAD setup probe 仍拒绝配置，尚非受支持入口」。这些项目及云端 / 联网语音绝对句已在实施后独立评审回修，见 `research/codex-findings/87-status-alignment-post-implementation-triage.md`。

---

你接手 **SayDo 状态对齐批**。仓库为调度方当前工作树，分支 `chore/status-alignment-20260821`。工作树已有官网改版与评审产物，必须保留。不得提交、推送或部署。完成判定 = §3 全部要求落盘 + §4 验收锚有真实退出码 + `e2e/evidence/status-alignment-20260821.md` 如实对账。

## 0. 坐标核验（先做；不符即停并汇报）

1. `git branch --show-current` 必须为 `chore/status-alignment-20260821`。
2. `git rev-parse HEAD` 必须为 `088b8f0cc176bc2be9cf09235a640301dd35cb55`。
3. `git status --short` 预期非空；官网文件、评审报告和历史记录已有改动。先保存状态清单，结束时逐项对比，严禁清理、回滚或覆盖既有改动。
4. `HANDOFF.md` 的当前批次指针应为空；本次不以提交收口，因此不要制造虚假的提交 SHA。
5. 调度方在开批前已只读复核：
   - 活动树 HEAD = `088b8f0cc176bc2be9cf09235a640301dd35cb55`；
   - 常驻 runtime = `ada7981c67ef3a07e6df0431643bb8b7661e22d4`；
   - 2026-08-21 当前 release config digest = `2278f7b9358d7dbfc20daaefceedb50b1b92f63a0f97ac2c40bc5a4b424dccac`；
   - `e2e/owner-sessions/session-1.md` 为 `failed`，场次 2–4 为 `not_run`；
   - Tailscale `BackendState=Running`、`Self.Online=true`；
   - Claude CLI 已登录，`subscriptionType=max`；
   - 最近备份目录仍是 `20260806T013953Z`；
   - GitHub Actions run `32334615753` 为 `failure`，workflow 的 pnpm `version: 10` 与根 `packageManager: pnpm@10.33.1` 重复指定。
6. 若仓内证据与上述值冲突，不自行择一，停止并把冲突写入报告。
7. 开批前 `just ci` 已运行：类型检查、lint 和 1665 个 daemon 测试通过，随后 emoji 门因两个既有未跟踪 prompt 含禁用符号而退出 1：
   - `prompts/75-official-website-redesign.md:16`
   - `prompts/76-website-docs-review.md:8`
   本批允许把这两处符号改成 `[ok] / [fail] / [warn]` 文字，除此之外不得改这两个 prompt。

## 1. 必读（按序）

1. `AGENTS.md`、`HANDOFF.md` §4、`research/codex-findings/86-status-alignment-triage.md`。
2. 四路原始评审：
   - `research/codex-findings/86-status-alignment-codex.md`
   - `research/codex-findings/86-status-alignment-claude.md`
   - `research/codex-findings/86-status-alignment-product.md`
   - `research/codex-findings/86-status-alignment-runtime.md`
3. 官网成品与源稿：
   - `deploy/saydo-octoooo-com/index.html`
   - `deploy/saydo-octoooo-com/en/index.html`
   - `deploy/saydo-octoooo-com/privacy/index.html`
   - `deploy/saydo-octoooo-com/en/privacy/index.html`
   - `deploy/saydo-octoooo-com/terms/index.html`
   - `deploy/saydo-octoooo-com/en/terms/index.html`
   - `deploy/saydo-octoooo-com/docs/index.html`
   - `deploy/saydo-octoooo-com/en/docs/index.html`
   - `docs/site/2026-08-20-homepage-structure-copy.fable.md`
   - `docs/site/2026-08-20-docs-page-content.fable.md`
4. 内部证据：
   - `e2e/owner-sessions/session-1.md`
   - `e2e/owner-sessions/session-2.md`
   - `e2e/owner-sessions/session-3.md`
   - `e2e/owner-sessions/session-4.md`
   - `e2e/owner-sessions/runtime-deploy.md`
   - `e2e/evidence/w54a-claude-cli.md`
   - `.github/workflows/ci.yml`
   - `package.json`
   - `packages/daemon/src/index.ts` 的 `setup_local_only`
   - `packages/console/src/components/SetupBootstrapBoundary.tsx` 及测试。

## 2. 红线（违反即停）

- 全仓零 emoji；执行状态不得写“完成/做完”，未提交的本批只能写“实施与检查已跑完，等 owner 验收”。
- 不执行 `git commit`、`git push`、`just daemon deploy`、`just t2-pair`；不改 `~/.saydo`、launchd、Tailscale 或任何 live 配置。
- 不改 `.github/workflows/ci.yml`；只在档案中记录其已确认的 pnpm 版本冲突。
- 不修备份故障；只把已确认事实和“部署前置”写进档案。
- 不改 `docs/09-data-contracts.md`、`docs/11-ui-spec.md` 或任何其他 canonical；T19 × tailnet 仍待 owner 拍板。
- 不把 `setup_local_only` 静默并入 `remote-mobile`，不启用 `SAYDO_MOBILE_LAN`。
- 不改 `HANDOFF.md` §2-10 TTS，不改 live 音色。
- 保留“SayDo 不运营任何服务器 / SayDo runs no servers”及 Keychain / Keystore / HarmonyOS 安全存储承诺。
- 不重写条款适用对象，不改令牌寿命措辞；这两项仍属后续 owner / 法律口径决策。
- 只允许修改 §3 列出的文件，以及 §3.7 明列的两个 prompt 单行。不得格式化整份 HTML 或 Markdown，不得碰现有 CSS、JS、图片、审计脚本和其他未授权文件。

## 3. 任务清单

### 3.1 官网中英文承诺对齐

允许修改：

- `deploy/saydo-octoooo-com/index.html`
- `deploy/saydo-octoooo-com/en/index.html`
- `docs/site/2026-08-20-homepage-structure-copy.fable.md`

要求：

1. Windows / Linux：统一为“暂不支持、没有明确时间表”；英文为同义的 `Not supported yet; no timeline promised`。不得再出现“内测中 / Closed beta”。
2. iOS / Android / HarmonyOS：统一为“开发中、尚未上架、当前无可下载版本”；英文同义。不得声称已有 beta 包或正在接收测试者。
3. Hero、状态区、五个平台徽章、申请说明和邮件按钮同批修改。按钮改成“邮件订阅进展 / Email for updates”，mailto subject 也从 beta access 改为更新通知。
4. 首屏信任条：
   - 中文：`无账号 · 无云端后台 · 只连你自己配置的服务`
   - 英文：`NO ACCOUNTS · NO BACKEND OF OURS · ONLY THE SERVICES YOU CONFIGURE`
   删除 `数据不出你的设备 / YOUR DATA NEVER LEAVES YOUR DEVICES` 的绝对承诺。
5. 隐私带必须说明：
   - 对话、事项和账本数据保存在用户设备；
   - 手机与电脑的产品数据通道为用户自己的局域网或用户自行配置的加密组网；
   - 用户自行启用的云端语音、AI 上游和推送由用户电脑直连第三方；
   - 开发者不接收这些数据。
6. FAQ 的“云服务”答案写成“没有开发者运营的云端后台”，避免与用户自行配置的第三方 AI / 语音 / 推送并列时自相矛盾。
7. 手机沟通面权限写清：
   - LAN 连接不能审批 S2 / S3；
   - 用户自己的 tailnet 远程面审批封顶 S2；
   - 合并、删除等 S3 始终只在电脑上。
   中英文首页的介绍段、架构节点和相关说明保持同义。
8. “手机扫码即连”收窄为“按文档显式打开局域网访问后，可用手机浏览器扫码连接”，不在首页暴露环境变量名。
9. Claude Code 卡统一为：
   - 中文语义：官方 CLI 能力实测与审批门判定逻辑已验证，尚未接入生产执行链。
   - 英文语义：capabilities and the gate decision logic have been verified against the official CLI; it is not yet wired into the production execution path.
   不得写“接线在途 / wiring underway”。
10. 同步源稿中的对应承诺；源稿不得继续保留“数据不出设备”“内测中”“审批门已落地、接线中”等会在下次生成时复活旧口径的句子。

### 3.2 隐私政策与条款中英文对齐

允许修改：

- `deploy/saydo-octoooo-com/privacy/index.html`
- `deploy/saydo-octoooo-com/en/privacy/index.html`
- `deploy/saydo-octoooo-com/terms/index.html`
- `deploy/saydo-octoooo-com/en/terms/index.html`

要求：

1. 四页生效日期统一更新为 2026-08-21 / August 21, 2026。
2. 隐私政策一句话版：
   - 保留“不运营任何服务器 / runs no servers”；
   - 对话、事项、账本保存在用户设备；
   - 产品数据在用户自己的 LAN 或用户自行配置的加密组网内传输；
   - 用户自行启用的云端语音、AI 上游和推送由用户电脑直连第三方。
   不要再把“语音”笼统写成全部留在设备或全部只走 LAN。
3. “不上传任何用户数据 / No user data is uploaded”限定为“不向开发者上传 / No user data is uploaded to the developer”，并列明用户自行配置的 AI、可选云端语音、可选推送适用用户与第三方的协议。
4. 权限表“本地网络 / Local network”一行与存储传输列表中的物理范围同步为 LAN 或用户自行配置的加密组网。
5. 保留系统语音识别、Keychain、Android Keystore、HarmonyOS 等价安全设施的已有真实承诺。
6. 条款只把连接范围从“局域网”补成“局域网或用户自行配置的加密组网”，并更新生效日期；不趁机改写许可、免责、产品适用对象或令牌寿命。

### 3.3 文档页中英文完成度对齐

允许修改：

- `deploy/saydo-octoooo-com/docs/index.html`
- `deploy/saydo-octoooo-com/en/docs/index.html`
- `docs/site/2026-08-20-docs-page-content.fable.md`

要求：

1. “实时字幕 / live captions”和“Silero VAD”从“进行中 / in progress”统一降为“规划中 / planned”。
2. 保留当前能量 VAD、语义 EOU、“说完了”兜底和云端级联语音“现在可用”的主状态，不得整体降档。
3. Claude Code 执行器细句统一为“第一批官方 CLI 能力实测 + 审批门纯函数层已收口；生产执行主流程接线是下一步”，不得写“接线批在途”。
4. 文档里的沟通面说明与官网权限边界一致：tailnet 审批封顶 S2，LAN 与语音不放行审批，S3 始终回电脑。
5. 保持 Windows / Linux FAQ 的“暂不支持、无明确时间表”原口径。
6. 成品页和源稿同批同步；英文必须与中文语义等价，不做逐字硬译。

### 3.4 `HANDOFF.md` 事实账本对齐

只修改 `HANDOFF.md`，保留历史记录但把“当前”口径改正：

1. 当前批次指针收口后仍为空。下一工程批把 5.4 写成 **W5.4-b 生产执行主流程接线**；Claude 订阅不再是阻塞。
2. 新增 2026-08-21 当前快照，明确三层时钟：
   - 活动树 HEAD `088b8f0cc176bc2be9cf09235a640301dd35cb55`；
   - 常驻 runtime `ada7981c67ef3a07e6df0431643bb8b7661e22d4`；
   - release config digest `2278f7b9358d7dbfc20daaefceedb50b1b92f63a0f97ac2c40bc5a4b424dccac`。
   写清 2026-08-21 00:20 `[t2]` / `listen` 变更已使旧场次锁再次作废，owner 尚未重新声明四场基线。
3. 场次 1 行必须写：场次 1 已在 `ada7981c` 上运行且结果为 `failed`，返工已部署，待 owner 从步骤 1 复验；场次 2–4 为 `not_run`。不得再写成“可以开始场次 1”或“场次 1 尚未开始”。
4. GitHub Actions：billing 已恢复；2026-08-20 run 能启动且 Python job 通过，Node job 因 pnpm 版本重复指定失败；本地 `just ci` 仍是实质门禁。只记录，不改 workflow。
5. Claude：
   - CLI 2.1.220，已用 Claude.ai 登录，Max 订阅，零 API key；
   - W5.4-a 只收口纯函数层，未接生产主流程；
   - 剩余是 W5.4-b；
   - observedModel 豁免继续休眠。
   清掉 §1、§2、§3 中所有“下周购买 / 未登录 / 挂订阅”的现时态。
6. Tailscale：
   - Network Extension 已启用；Backend Running、Online；
   - `[t2].tailnet_hosts` 与 `listen=0.0.0.0` 已于 2026-08-21 00:20 随既有 runtime 重启生效；
   - 剩余是 `just t2-pair` + 手机四页烟测 + S2 / S3 边界烟测；
   - 结论只适用于 `ada7981c`，不得外推 HEAD。
7. 新增 T19 × tailnet 前置门：HEAD 对 tailnet setup probe 返回 `setup_local_only`，console 只旁路 `mobile_lan_route_rejected`；owner 拍板并先回写 09 / 11 之前，禁止升常驻、禁止加 `SAYDO_MOBILE_LAN`。
8. 新增 `[warn]` 备份事实：自 2026-08-07 起定时快照连续因 `workspace_identity_changed` 失败；最后成功为 `20260806T013953Z`；该修复是下一次部署门前置，但本批不修。
9. 环境状态补一句：源码的 A3-armed 已收口不等于本机 deep readiness 已武装；当前常驻 evaluator 为 `cursor_cli`，启动日志仍有 unresolved warning。
10. §2-10 TTS 一字不动。

### 3.5 `IMPLEMENTATION-PLAN-2.md` 排产指针对齐

只修改 `docs/plan/IMPLEMENTATION-PLAN-2.md`：

1. 开头“当前状态”、§0 场次、外部解锁、W2 owner 补验、W5 标题和 5.4 行、§2 解锁图、§4 关键路径与风险、§5 最近停点、§7 当前执行顺序中的现时态全部统一。
2. Claude = 订阅已就位；W5.4-a 纯函数层已收口；下一项为 W5.4-b 生产执行主流程接线。
3. Actions billing = 已恢复；剩 workflow pnpm 版本冲突，修复须走公开快照仓通道。
4. 场次 1 = `failed` @ `ada7981c`，待 owner 复验；场次 2–4 = `not_run`。
5. T2 = 组网已就绪，待手机烟测；结论只对 `ada7981c`。
6. 新增依赖顺序：T19 × tailnet 合同拍板并回写 canonical + 备份恢复可用，二者都是任何升常驻动作的前置；本批不改 canonical、不修备份、不部署。
7. 保留 `remote-mobile-w0` 的“不部署常驻”完成定义。

### 3.6 证据

创建 `e2e/evidence/status-alignment-20260821.md`，至少包含：

- 输入与范围；
- 实际修改文件清单；
- 官网旧短语清零结果；
- 中英逐组语义对账；
- HANDOFF / PLAN-2 事实对账；
- §4 每条命令、退出码和摘要；
- 明确未做：commit、push、deploy、live config、T19 canonical、备份修复、workflow 修复、TTS。

不写不存在的提交 SHA，不把“文件已修改”写成“已发布”。

### 3.7 既有 emoji 门阻断

只修改：

- `prompts/75-official-website-redesign.md`
- `prompts/76-website-docs-review.md`

分别把开批前门禁点名的三个 pictographic 示例替换成 `[ok]`、`[fail]`、`[warn]`。不得改其他内容。证据中明确标注这是开批前已有阻断，不冒充本批回归。

## 4. 验收锚（逐条运行并记录真实退出码）

1. 旧承诺清零：在本批十个官网成品页与两个源稿中搜索以下短语，预期无旧语义命中：
   - `内测中`
   - `Closed beta`
   - `Email to apply`
   - `数据不出你的设备`
   - `YOUR DATA NEVER LEAVES YOUR DEVICES`
   - `不上传任何用户数据`
   - `No user data is uploaded.`
   - `实时字幕进行中`
   - `Silero VAD 进行中`
   - `接线批在途`
   - `wiring underway`
2. 保留承诺：中英隐私页仍可检索到“不运营任何服务器 / runs no servers”与 Keychain / Keystore。
3. 完成度正向锚：中英首页分别存在 Windows / Linux 的“不支持”状态、三端 App 的“开发中”状态和更新邮件按钮。
4. 权限边界正向锚：中英首页和文档页均能检索到 S2 上限与 S3 回电脑语义。
5. 档案清零：`HANDOFF.md` 与 `IMPLEMENTATION-PLAN-2.md` 的现时态段落不再出现“Claude 下周购买 / claude 未登录 / 5.4 挂订阅 / Tailscale 扩展待批准 / 可以开始场次 1”。
6. HTML / 页面审计：
   - `node e2e/audit-check.mjs`
   - 使用已有本地静态站点或 `python3 -m http.server` 临时服务，至少验证中英首页、隐私页、条款页、文档页均无页面错误和横向溢出；不要覆盖现有审计脚本。
7. `bash scripts/check-emoji.sh`
8. `just ci`
9. `git diff --check`
10. 结束前核对 `git status --short`：除本批允许文件外，所有开批前已有文件状态必须保持原样；不得新增临时脚本、截图、日志到 Git 路径。

## 5. 检查点

- 发现任何建议需要修改 09 / 11 canonical、`setup_local_only` 代码、workflow、live 配置或条款适用对象时，停止该分支，继续其他明确项，并在报告列为“待 owner”。
- 发现中文与英文无法保持同一产品事实时，不自行选一个市场口径；记录冲突并停止对应句。
- `just ci` 若失败，先判断是否本批引入；不得删除既有测试或放宽门禁。

## 6. 汇报格式

最终只返回：

1. `DONE`、`DONE_WITH_CONCERNS`、`NEEDS_CONTEXT` 或 `BLOCKED`；
2. 修改文件清单；
3. 验收命令与退出码摘要；
4. 未做清单；
5. `e2e/evidence/status-alignment-20260821.md` 路径。

不得声称已提交、已部署或已发布。
