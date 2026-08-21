# 状态对齐批 2026-08-21 · 证据

> 性质:中英文对外文案 + 内部状态档案对齐。无运行时代码、无 canonical 合同语义、无部署、无提交。
> 工作树:`chore/status-alignment-20260821` HEAD `088b8f0cc176bc2be9cf09235a640301dd35cb55`(未前进)。
> 本批不以提交收口,不写虚假提交 SHA,不把「文件已修改」写成「已发布」。
> 三级词表:[ok] 本会话真实命令 / [warn] 差距如实 / [fail] 未做或受阻。

## 1. 输入与范围

调度授权:`docs/plan/IMPL-PROMPT-11-STATUS-ALIGNMENT.md`(第十一轮交接)。

终裁与四路评审(本会话实读):

| 文件 | 字节 |
|---|---|
| `research/codex-findings/86-status-alignment-triage.md` | 4556 |
| `research/codex-findings/86-status-alignment-codex.md` | 24802 |
| `research/codex-findings/86-status-alignment-claude.md` | 28637 |
| `research/codex-findings/86-status-alignment-product.md` | 38662 |
| `research/codex-findings/86-status-alignment-runtime.md` | 40818 |

范围:官网成品十页 + 两份源稿 + `HANDOFF.md` + `docs/plan/IMPLEMENTATION-PLAN-2.md` + 开批前 emoji 门点名的两个 prompt 单行。不改 `.github/workflows/ci.yml`、不改 `docs/09` / `docs/11`、不改 live 配置、不改 §2-10 TTS。

开批坐标(本会话核验):

- 分支 `chore/status-alignment-20260821`
- HEAD `088b8f0cc176bc2be9cf09235a640301dd35cb55`
- 调度方给出的常驻 runtime `ada7981c67ef3a07e6df0431643bb8b7661e22d4`、release config digest `2278f7b9358d7dbfc20daaefceedb50b1b92f63a0f97ac2c40bc5a4b424dccac` 写入档案,本会话未重测 live `/health`
- `e2e/owner-sessions/session-1.md` `current_status=failed`; session-2/3/4 = `not_run`

[warn] 第一回合开批时 `86-status-alignment-triage.md` 不在 Grok sandbox;调度方随后恢复文件并用暂存 + stash 建立安全快照。本回合核验六份输入均存在后继续。Grok 自身未执行 `git add` / `git commit` / `git restore`；后验复核收口时，调度方仅运行 `git restore --staged .` 撤销安全暂存、恢复开批前的「无 staged 变更」状态，工作树内容完整保留。

## 2. 实际修改文件清单

本批写入(对照开批状态,仅这些路径出现新的工作区 diff):

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
- `HANDOFF.md`
- `docs/plan/IMPLEMENTATION-PLAN-2.md`
- `prompts/75-official-website-redesign.md`(仅 pictographic 三例)
- `prompts/76-website-docs-review.md`(仅 pictographic 三例)
- `e2e/evidence/status-alignment-20260821.md`(本文件)

开批前已有、本批未改的官网/评审资产仍在工作树:`site.css`、`theme.js`、`apple-touch-icon.png`、`support/`、`_headers`、`en/support/`、`history/PROCESS-JOURNAL.md`、`templates/saydo.config.example.toml`、四路+终裁 86 报告、`IMPL-PROMPT-11`、`e2e/audit-check.mjs`、`e2e/.tmp-site-audit/shot.mjs`。后验收口时 index 已恢复为无 staged 变更。

## 3. 官网旧短语清零

在十个成品页 + 两个源稿搜索下列短语,本会话结果为零命中:

`内测中` / `Closed beta` / `Email to apply` / `数据不出你的设备` / `YOUR DATA NEVER LEAVES YOUR DEVICES` / `不上传任何用户数据` / `No user data is uploaded.` / `实时字幕进行中` / `Silero VAD 进行中` / `接线批在途` / `wiring underway`

保留承诺(隐私页实读):

- 中文:`不运营任何服务器`、Keychain、Keystore 仍在
- 英文:`runs no servers`、Keychain、Keystore 仍在

完成度正向锚:

- 中文首页:Windows/Linux `暂不支持`;三端 App `开发中`;按钮 `邮件订阅进展`
- 英文首页:`Not supported yet`、`no timeline promised`、`In development`、`Email for updates`

权限边界正向锚:中英首页与文档页均可检索到 S2 上限与 S3 回电脑语义。

档案清零:`HANDOFF.md` 与 `IMPLEMENTATION-PLAN-2.md` 现时态不再出现 `Claude 下周购买` / `claude 未登录` / `5.4 挂订阅` / `Tailscale 扩展待批准` / `可以开始场次 1` / `可以开始场次①`。

## 4. 中英逐组语义对账

| 组 | 中文 | 英文 | 对账 |
|---|---|---|---|
| Win/Linux | 暂不支持、没有明确时间表 | Not supported yet; no timeline promised | [ok] 同义 |
| 三端 App | 开发中、尚未上架、当前无可下载版本 | in development, not in stores, nothing to download | [ok] 同义 |
| 邮件 | 邮件订阅进展;subject 更新通知 | Email for updates; subject SayDo updates | [ok] 同义;不再申请内测 |
| 信任条 | 无账号 · 无云端后台 · 只连你自己配置的服务 | NO ACCOUNTS · NO BACKEND OF OURS · ONLY THE SERVICES YOU CONFIGURE | [ok] 同义;已删绝对离机句 |
| 隐私带 / 一句话版 | 不运营任何服务器;对话/事项/账本在用户设备;产品数据走 LAN 或用户自行配置的加密组网;云端语音/AI/推送由用户电脑直连第三方;开发者不接收 | runs no servers; same data-path split | [ok] 同义;语音不再写成全部留在设备 |
| 不上传 | 不向开发者上传任何用户数据 | No user data is uploaded to the developer | [ok] 主语收窄到开发者 |
| 权限 | LAN 不能批 S2/S3;自行配置的远程面封顶 S2;S3 回电脑 | LAN cannot approve S2/S3; overlay caps at S2; S3 stays on computer | [ok] 同义 |
| 扫码 | 按文档显式打开局域网访问后,可用手机浏览器扫码连接 | After you explicitly enable LAN access as documented, scan with a phone browser | [ok] 首页不暴露环境变量名 |
| Claude | 官方 CLI 能力实测与审批门判定逻辑已验证,尚未接入生产执行链 | capabilities and the gate decision logic have been verified against the official CLI; not yet wired into the production execution path | [ok] 同义;不写接线在途 |
| 实时字幕 / Silero | 规划中 | planned | [ok] 同义;云端级联语音仍为现在可用 |
| 法律生效日 | 2026 年 8 月 21 日 | August 21, 2026 | [ok] |

条款只补「局域网或用户自行配置的加密组网」并改生效日;许可、免责、适用对象、令牌寿命未改。

## 5. HANDOFF / PLAN-2 事实对账

| 事实 | 落点 |
|---|---|
| 批次指针仍为空;下一工程批 W5.4-b | HANDOFF §1;PLAN-2 §0/§7 |
| 三层时钟 HEAD / runtime / digest | HANDOFF 2026-08-21 快照 |
| 场次 1 `failed` @ `ada7981c`;2–4 `not_run` | HANDOFF §2-1;PLAN-2 §0 |
| 00:20 `[t2]`/`listen` 使旧锁作废 | HANDOFF 快照与 §2-1 |
| Actions billing 已恢复;pnpm 版本重复指定 | HANDOFF §2-5;PLAN-2 §0/§2;未改 workflow |
| Claude CLI 2.1.220 / Claude.ai / Max / 零 API key;W5.4-a 纯函数;剩余 5.4-b;observedModel 休眠 | HANDOFF §2-6/§3 |
| Tailscale 扩展已启用;Running/Online;烟测只对 `ada7981c` | HANDOFF §2-12 |
| T19 × tailnet 升常驻前置;禁止 silent 扩 `setup_local_only` | HANDOFF §2-17;PLAN-2 §2/§7 |
| 备份自 08-07 `workspace_identity_changed`;最后成功 `20260806T013953Z` | HANDOFF §2-18 |
| A3-armed 源码收口 ≠ 本机 deep readiness;evaluator=`cursor_cli` unresolved | HANDOFF §3 |
| §2-10 TTS | `git diff` 无该行增删 |
| remote-mobile-w0 不部署常驻 | PLAN-2 该节保留 |

## 6. §4 验收命令、退出码、摘要

| # | 命令 | 退出码 | 摘要 |
|---|---|---|---|
| 1 | 十页+两源稿旧短语扫描(python 实读) | 0 | 零命中 |
| 2 | 隐私页保留承诺扫描 | 0 | 中文不运营任何服务器 + Keychain/Keystore;英文 runs no servers + Keychain/Keystore |
| 3 | 完成度正向锚扫描 | 0 | 见 §3 |
| 4 | S2/S3 正向锚扫描 | 0 | 中英首页与文档页均有 |
| 5 | HANDOFF / PLAN-2 现时态清零扫描 | 0 | 六条旧现时态零命中 |
| 6a | `node e2e/audit-check.mjs` | 1 | 预存脚本 `Cannot find package 'playwright'`(从 `e2e/` ESM 解析);本批未改该脚本 |
| 6b | Playwright 启动 bundled Chromium / Chrome.app | 1 | 工作区沙箱 SEGV / Operation not permitted,未取得横向溢出截图像 |
| 6c | `python3 -m http.server 8765` + `curl` 八页 | 0 | 中英首页/隐私/条款/文档全部 HTTP 200;结构标签成对 |
| 7 | `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| 8a | `just ci` | 2 | Node 矩阵已绿(daemon 1665 passed);Python 在 `~/.cache/uv` Operation not permitted。非本批代码引入 |
| 8b | `UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` | 0 | `[ok] just ci: node + python matrices green`;contracts 103 / cli 19 / console 264 / daemon 1665 passed 4 skipped;python 33 passed;emoji 门与自测绿 |
| 9 | `git diff --check` | 0 | 无空白错误 |
| 10 | `git status --short` 对照开批清单 | 0 | 见 §2;未新增临时脚本/截图到 Git 路径(本 evidence 为授权产物) |

## 7. 明确未做

- 未 `git commit`、未 `git push`；Grok 未改 git index，调度方的临时安全暂存已撤销，最终 index 无 staged 变更
- 未 `just daemon deploy`、未 `just t2-pair`、未改 `~/.saydo` / launchd / Tailscale / live 配置
- 未改 `.github/workflows/ci.yml`(只记录 pnpm `version: 10` 与 `packageManager: pnpm@10.33.1` 冲突)
- 未修备份、未改 `docs/09` / `docs/11`、未把 `setup_local_only` 并入 `remote-mobile`、未加 `SAYDO_MOBILE_LAN`
- 未改 HANDOFF §2-10 TTS、未改 live 音色
- 未重写条款适用对象、未改令牌寿命措辞
- 未发布、未部署官网;工作树改动不等于线上
- Grok 沙箱内未取得真实 Chromium 证据(6b)；调度方随后用独立 Playwright MCP 完成后验复核，见 §9。该后验结果不倒填、不冒充 Grok 的 §6 命令门

## 8. emoji 门(开批前已有阻断)

`prompts/75-official-website-redesign.md:16` 与 `prompts/76-website-docs-review.md:8` 的约束句已校正为「禁 emoji / pictographic 符号，但允许 `[ok]` / `[fail]` / `[warn]` 文本状态标记」。这是开批前 `just ci` 已点名的阻断,不冒充本批回归。其余 prompt 正文未改。

## 9. 实施后独立复核与回修验证

> 本节由调度方在 Grok 退出后追加，时间为 2026-08-21 02:04–02:42 +0800；不属于 Grok 的原始自报，也不覆盖 §6 中的沙箱失败记录。

### 9.1 首轮全站后验观察

- 入口：本地静态站 `http://127.0.0.1:8765`，Playwright MCP。
- 覆盖：中英首页、Docs、Privacy、Terms、Support 共 10 页；桌面 `1442×867` 与手机 `390×844`。
- 结果：20 个页面 / 视口组合均无横向溢出；10 页均无 `naturalWidth=0` 图片；浏览器 console 为 0 error / 0 warning。
- 静态复核：10 页 HTML 的重复 id、内部链接、fragment 与静态资源全部通过，`pages=10 links_and_assets=420`。
- 该轮发现经两路独立只读评审 + Codex 对抗复核裁决后，回修了：Docs 的「无云端依赖」绝对句、系统 / 浏览器联网语音例外、tailnet 过满状态、PLAN-2 的 CLI / live steer / 历史 HEAD 口径、HANDOFF 的 observedModel 条件豁免状态与两个 prompt 的文本标记规则。

### 9.2 回修后定向视觉复核

| 页面 | 视口 | 断言 | 结果 |
|---|---|---|---|
| `/docs/` | 1442×867 | 无横向溢出、无坏图；云端例外、tailnet `setup probe`、联网语音、非穷举出网路径四锚存在 | `[ok]` |
| `/en/docs/` | 1442×867 | 同上，英文四锚与中文同义 | `[ok]` |
| `/privacy/` | 390×844 | 无横向溢出、无坏图；设备端 / 联网处理条件与「不保存音频」存在 | `[ok]` |
| `/en/privacy/` | 390×844 | 同上，英文与中文同义 | `[ok]` |

Playwright 生成截图名：`DocsZH_20260821-0242_PASS.png`、`DocsEN_20260821-0242_PASS.png`、`PrivacyZH_20260821-0242_PASS.png`、`PrivacyEN_20260821-0242_PASS.png`。截图由浏览器工具会话持有，未写入 Git 路径，不把临时工具产物冒充仓内发布证据。

### 9.3 回修后门禁

| 命令 | 退出码 | 摘要 |
|---|---:|---|
| `git diff --check` | 0 | 无空白错误 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| 10 页静态链接 / id / fragment / 资源审计 | 0 | `pages=10 links_and_assets=420` |
| 状态与隐私关键锚脚本 | 0 | `files=8 assertions=30` |
| `UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` | 0 | `[ok] just ci: node + python matrices green`；Python 33 passed |

### 9.4 首次收口后的迟到复核回收

> 时间：2026-08-21 02:46–02:52 +0800。两路只读复核在首次收口后返回；本节只记录对当前工作树重放后仍成立的增量。

1. A 级：Docs 与历史实施 prompt 把「语音不放行审批」写死，与 `docs/09` 的 voice / `voice_weak` ≤ S2 及 `docs/10` 的 S2 封闭肯定词表冲突。已改为 LAN 不裁 S2/S3、语音确认封顶 S2、tailnet 配对屏幕面在支持后封顶 S2、S3 只走本机认证屏幕；prompt 以顶部后验勘误保留原派发正文。
2. B 级：LLM 深研在正文写「进行中」、总表写「规划中」。packages 与 PLAN-2 均无实施命中，统一为「规划中」，并把当前奠基词条改回确定性机械管道。
3. B 级：HANDOFF 的备份失败结论补注本机 `~/.saydo/logs` / `~/.saydo/backups` 现场取证；仓内无可复跑原始日志。

追加验证：

| 门禁 | 结果 |
|---|---|
| 迟到回修锚点 | exit 0，`files=5 assertions=25` |
| `git diff --check` | exit 0 |
| `bash scripts/check-emoji.sh` | exit 0 |
| 10 页静态链接 / id / fragment / 资源审计 | exit 0，`pages=10 links_and_assets=420` |
| `UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` | exit 0；contracts 103、console 264、daemon 1665 passed / 4 skipped、Python 33 passed |
| 中英 Docs Playwright 定向复核 | 1442×867 均无横向溢出、无坏图；0 console error / warning；新口径存在、旧口径消失 |

Playwright 生成截图名：`DocsZH_20260821-0251_LATE_PASS.png`、`DocsEN_20260821-0251_LATE_PASS.png`。截图由浏览器工具会话持有，未写入 Git 路径。

结论：实施与检查已跑完，等 owner 验收；本节收口时未提交、未推送、未部署。

## 10. 收口提交(2026-08-21,owner 授权合并推送)

owner 授权「合并所有本地分支与 worktree 到 main 并推送 GitHub」后,收口会话先完整复核:分支 / worktree 盘点(全部本地分支与 detached worktree 提交均已在 main)、HANDOFF / PLAN-2 / 模板 / 两稿 / 首页成品 diff 逐项对照终裁、`e2e/audit-check.mjs` 与 `e2e/.tmp-site-audit/shot.mjs` 因被本 evidence 与 IMPL-PROMPT-11 点名而保留入库、`UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` 重跑 exit 0、10 页静态审计 `pages=10 links_and_assets=420`,复核零新增发现。站点与文档实施落码提交 `1679078bdd44ef9b8034e3f926c990e39b8825a8`;本 evidence 与评审档案随后以证据提交入库(两提交法,证据不自指)。
