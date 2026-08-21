# 86 · 本机狗粮 / HANDOFF / PLAN-2 指针层 · 独立对抗性复核

> 评审员:独立会话,与调度会话零上下文共享。只读取证,未做任何写操作(无 commit / 无 deploy /
> 无 `just daemon deploy` / 未改官网 / 未改 HANDOFF / 未起 nested agent)。
> 取证时刻:2026-08-21 00:42–00:55(UTC+8)。
> 分工:本报告**只覆盖 H1–H6 + 内部错位(HANDOFF / PLAN-2 / 本机常驻)**。
> C1–C10 对外文案条目**本报告不裁决**,交另一路评审;见 §3.0 的显式弃权声明。
> 秘密纪律:未写入 cap-token、`.env` 内容、tailnet 主机名/地址、账号邮箱与组织名。

---

## 1. 评审身份与取证范围

### 1.1 本会话真实跑过的命令(全部一次成功,输出已核对)

| # | 命令 | 用途 |
|---|---|---|
| 1 | `git rev-parse HEAD` / `git log -1` | 确认 HEAD |
| 2 | `curl -sS -m 3 http://127.0.0.1:47100/health` | 确认 live `runtimeSha` |
| 3 | `launchctl print gui/$(id -u)/com.saydo.daemon` | 确认 `SAYDO_*` 与常驻程序路径 |
| 4 | `launchctl print gui/$(id -u)/com.saydo.pipeline` | 确认 pipeline 常驻态 |
| 5 | `ls -ld ~/.saydo/runtime` + `ls ~/.saydo/releases` | 确认 runtime 符号链接指向 |
| 6 | `ls`/`rg` 于 `~/.saydo/runtime/packages/**` | 确认是否含 `SetupBootstrapBoundary` / `focus` / `setup_local_only` / mobile 树 |
| 7 | 逐文件 `shasum -a 256` 对比 `git show ada7981c:<path>`(165 个文件) | 常驻树与提交是否漂移 |
| 8 | `git rev-list --count ada7981c..HEAD` | 落后提交数 |
| 9 | `claude --version` / `claude auth status` | CLI 版本与登录态 |
| 10 | `tailscale status --json`(经 `/Applications/Tailscale.app`) | BackendState / Online |
| 11 | `systemextensionsctl list` | 网络扩展状态 |
| 12 | `lsof -nP -iTCP:47100 -sTCP:LISTEN` | 实际监听面 |
| 13 | `rg` 于 `~/.saydo/config.toml`(敏感键已就地打码) | live 配置形状 |
| 14 | `gh run view 32334615753` / `gh run list` | Actions 真实失败原因 |
| 15 | `rg` 于 `~/.saydo/logs/*`、`ls -lt ~/.saydo/backups` | 常驻运行事实与备份链 |
| 16 | `ps -o pid,etime,lstart` (daemon / pipeline) | 进程起始时间 |
| 17 | `git log -S'setup_local_only'` | T19 引入时点 |

### 1.2 读过的文件(按需,未通读全仓)

`prompts/86-status-alignment-review.md`(全文)· `HANDOFF.md`(全文 81 行)·
`docs/plan/IMPLEMENTATION-PLAN-2.md`(§0 锚点 / W5 / remote-mobile-w0 / §8 执行顺序)·
`packages/console/src/components/SetupBootstrapBoundary.tsx` + `.test.ts` ·
`packages/daemon/src/tier1/validateConfig.ts` · `packages/daemon/src/index.ts`(probe 与 t2 段)·
`packages/daemon/src/projects/workspace.ts:234` · `e2e/evidence/w54a-claude-cli.md` §范围 ·
`e2e/evidence/remote-mobile-w0.md` · `e2e/owner-sessions/runtime-deploy.md` ·
`e2e/owner-sessions/session-1..4.md`(状态字段)· `docs/09-data-contracts.md:1145` ·
`docs/11-ui-spec.md:372,403,409` · `docs/review/2026-08-16-now-vs-later.md` ·
`docs/review/2026-08-14-saydo-phase-gap-analysis.md` · `.github/workflows/ci.yml` · `package.json`。

### 1.3 未跑 / 未复核项(诚实声明)

- **未跑** `just t2-pair`、未开手机、未做四页烟测(会产生带令牌 URL,且属 owner 项)。
- **未跑** `just ci`、未跑任何测试(只读取证约束)。
- **未复核** 20961 次 launchd `runs` 的历史分布成因(见 N7,只作观察不下结论)。
- **未复核** live release config digest 的具体值(计算口径在部署脚本内,只读会话未执行)。
- **未评审** C1–C10 全部对外文案条目(分工弃权)。

### 1.4 三层时钟的实测值(全部本会话取得)

| 层 | 实测 | 状态 |
|---|---|---|
| 对外 | 未取证(分工弃权) | 不裁决 |
| 源码 HEAD | `088b8f0cc176bc2be9cf09235a640301dd35cb55`,2026-08-20 13:10:42 +0800 | [ok] 与调度方一致 |
| 本机常驻 | `/health` `runtimeSha=ada7981c67ef3a07e6df0431643bb8b7661e22d4`;`~/.saydo/runtime` 是符号链接 → `releases/ada7981c…`(链接 mtime Jul 31 09:39) | [ok] 与调度方一致 |
| 落后量 | `git rev-list --count ada7981c..HEAD` = **355** | [ok] |
| 常驻树完整性 | 165 个 `packages/daemon/src` + `packages/contracts/src` 文件逐一 sha256 对比 `git show ada7981c:<path>`,**drift=0** | [ok] 常驻树是干净的 ada7981,无就地热补 |

调度方给出的其余本机快照,逐项复核结果:

| 调度方声称 | 复核 | 结论 |
|---|---|---|
| launchd `SAYDO_HOME=~/.saydo` `SAYDO_DEV=1`,无 `SAYDO_MOBILE_LAN` | `launchctl print` 环境块只有 `PATH` / `SAYDO_HOME` / `SAYDO_DEV=1` / `XPC_SERVICE_NAME` | [ok] |
| `[models.dev] agent=cursor` | live `config.toml:15` | [ok] |
| `[t2] tailnet_hosts` 两槽已填 | live `config.toml:75` 两项(内容不写入本报告) | [ok] |
| `listen=0.0.0.0` | live `config.toml:76`;`lsof` 显示 `TCP *:47100 (LISTEN)` | [ok] |
| TTS `zh_female_jitangmei_uranus_bigtts` | live `config.toml:35` | [ok] |
| Tailscale BackendState=Running / Online=True / 扩展 enabled | `BackendState":"Running"`、`"Online":true`、`"TUN":true`;`systemextensionsctl list` 显示 Tailscale Network Extension 处于 `[activated enabled]` | [ok] **已独立复核** |
| `claude` CLI 2.1.220;`loggedIn=true` `subscriptionType=max` | `claude --version` = `2.1.220 (Claude Code)`;`claude auth status` 返回 `"loggedIn": true`、`"subscriptionType": "max"`、`"authMethod": "claude.ai"`、`"apiProvider": "firstParty"` | [ok] |
| Actions run `32334615753` 因 pnpm 版本键冲突失败,不是 billing | 见 H4,原文报错已取得 | [ok] |
| 三端商店占坑 | 未取证(属对外条目,弃权) | 不裁决 |

---

## 2. 分层纪律裁决:哪几条草稿混了层

先说结论:**H 组整体分层比 C 组稳,但仍有两条把「发布门层」误当「本机狗粮层」,一条把已对齐项误列为待办。**

| 条 | 混层判定 | 说明 |
|---|---|---|
| H1 | **半混层** | 「扩展 Running ⇒ 剩手机烟测」把**本机网络状态**直接推到**产品远程面可用性**。漏掉关键限定:今晚才起效的 tailnet 面跑在 **ada7981(7-31)树**上,该树**没有移动壳、没有 T19 首启门**;手机烟测的结论只对 ada7981 成立,不可外推到 HEAD,更不可用于对外文案。 |
| H2 | **混层(发布门 ≠ 本机狗粮)** | HANDOFF §2-1 的 `b201514` 不是「本机狗粮记录」,是**场次①–④ 的发布验收锁**(「任一变化从①重跑」)。把它当成一条过期的运行时快照去「写清三层 SHA」,会漏掉真正的问题:锁已被两次改动作废(见 H2 与 N4),且本仓自己的现场记录早已前移到 ada7981,HANDOFF 落后于**自己的证据文件**。 |
| H3 | 分层正确 | 明确区分「订阅已就位(本机)」与「主流程未接(源码)」,并给出 PLAN-2 指针改法。 |
| H4 | 分层正确 | 自己写明「工程债,不是对外承诺」。 |
| H5 | **预算错配** | 不是混层,是**把唯一已经对齐的条目列成待办**。HANDOFF §2-10 与 §1(2026-07-31 条目)已经把「源码缺省 vs live 覆盖」写得完全准确,无可修。 |
| H6 | **分层最正确的一条** | 明确说的是「HEAD 上的门」对「本机常驻」的影响,并且守住了「禁止 silent 扩合同」。证据比草稿写的还强(见 §3)。 |
| P1 排期 | **缺顺序依赖** | 草稿把「T19 × tailnet 合同」与「是否升常驻」并列为 P1。二者不是并列关系:**合同必须先关**,否则升常驻当场把已配 `[t2]` 的远程面打死(H6)。排期表须写成前置依赖,不是同层清单。 |

---

## 3. 逐条裁决

### 3.0 C1–C10:本报告弃权

按调用方分工,C1–C10(对外首页 / 文档 / 隐私 / 条款 / FAQ / 商店口径 / 徽章用词)**本报告不给 `[ok]/[warn]/[fail]`**,也不给替换句。本会话未读 `deploy/saydo-octoooo-com/**` 与 `docs/site/2026-08-20-docs-page-content.fable.md`,任何对它们的裁决都会是无证据的附和。请以另一路报告为准。

仅有一条跨界提示,供另一路参考(非裁决):**C8 的判断依赖 H6 的实测**——文档若把 LAN 手机面 / Focus 标「现在可用」,那是对 **HEAD** 说话;本机常驻(ada7981)**根本没有移动树、没有 focus 目录**(实测 `~/.saydo/runtime/packages/console/src/mobile` 不存在、`packages/daemon/src/focus` 不存在)。所以「相对源码」这个限定不是可选修辞,是事实要求。

---

### H1 · HANDOFF §2-12 Tailscale 扩展状态过期 — `[ok]`(需补一句限定)

**证据**

- 档案:`HANDOFF.md:51`(§2-12)写「**系统网络扩展待批准**(`systemextensionsctl list` 卡 "activated waiting for user",系统设置-网络扩展里允许 Tailscale 后点 Connect)」。
- 实测:`systemextensionsctl list` 输出行 `Tailscale Network Extension` 状态为 **`[activated enabled]`**,`enabled` 与 `active` 两列均置位。
- 实测:`tailscale status --json` → `"BackendState":"Running"`、`"Online":true`、`"TUN":true`;`/Applications/Tailscale.app/Contents/MacOS/Tailscale` 进程在跑(pid 2137 之外的独立进程)。
- 「不要为此 `just daemon deploy`」**成立且已被事实证明**:常驻的 ada7981 树本身就带完整 T2 薄版——`~/.saydo/runtime/packages/daemon/src/net/t2.ts` 存在,`index.ts:145,214,392,419,461,498` 有 `via="tailnet"` 分支。今晚只改 config + 重启 daemon 就让 tailnet 面起效了,不需要 deploy 新 SHA。

**证伪补充(草稿说「剩手机烟测」,不完整)**

§2-12 的断点清单有四步:填 `tailnet_hosts` + 改 `listen` → deploy 生效 → `just t2-pair` → 四页烟测 + 批一条 S2 + 点 S3 见拒绝话术。实测显示**前两步今晚 00:20 已完成**(见 N4),剩下的是 `t2-pair` + 手机四页烟测。但必须加限定:**这轮烟测跑在 ada7981 上**,该树无移动壳(无 `packages/console/src/mobile`)、无 T19 首启门,手机看到的是 7-31 的桌面 console 在窄视口下的样子。烟测通过**不能**写成「HEAD 的移动面已验」。

**修法(一句)**

§2-12 改写为「扩展已 `activated enabled`、BackendState Running(2026-08-21 复核);config 两键已填、daemon 已重启生效;剩 `just t2-pair` + 手机四页烟测——**该烟测基线是常驻 ada7981(无移动壳/无 T19 门),结论不外推 HEAD**」。

**级别**:B(档案过期)

---

### H2 · HANDOFF 场次锁仍写 `b201514` — `[warn]`(方向对,描述失真且漏掉真正的坑)

**草稿主张成立的部分**

- `HANDOFF.md:40`(§2-1):「四场必须继续锁定 runtime `b20151440011ce0452417439c2d81745cb5d7d39` 与 release config digest `522e07160563a3de2afafa5517dd6b5a8b418c8e38a76fdd7fad1baf9b3c4660`,任一变化从①重跑」。
- `HANDOFF.md:52`(§2-13 ③):「runtime clean @ `b201514…`…下一步从场次①开始」。
- `HANDOFF.md:34`(§1 2026-07-31 条目):「常驻 runtime **仍** clean @ `b201514…`」。
- 实测 `/health` `runtimeSha=ada7981c…`;`~/.saydo/runtime -> releases/ada7981c…`(链接建立于 Jul 31 09:39)。
- 三处 SHA 与 live 不符,**事实成立**。

**为什么判 `[warn]` 而不是 `[ok]`**

1. **HANDOFF 落后于本仓自己的证据文件,不只是落后于 `/health`。**
   `e2e/owner-sessions/runtime-deploy.md:118` 记 `target SHA = ada7981c…`,`:130` 记
   `deployed runtime SHA = ada7981c…,runtime clean`,并且 **release config digest 已从
   `522e0716…` 变为 `90e35db971e7006303dbbfdb99b6d186e7e8beb5132be760d19531c8acf90207`**。
   也就是说 §2-1 锁的**两个字段都过期了**,草稿只提了 SHA、没提 digest。
2. **「三层 SHA 应写清」这个修法太轻。** §2-1 的 `b201514` 不是描述性快照,是**发布验收锁**,语义是「任一变化从①重跑」。锁面已被 2026-07-31 的授权部署作废一次,又被今晚的 config 变更作废第二次(N4)。正确修法不是「把 SHA 更新一下」,而是**把锁的当前有效基线重新声明**,并写明作废历史。
3. **草稿完全漏掉:场次①已经在 ada7981 上跑过并 `failed`。** 见 N2。只改 SHA 而不补这条,HANDOFF 读起来仍然是「部署门已过,可以开始场次①」——与 `session-1.md` 直接矛盾。

**「未授权不要把 HEAD 灌进 launchd」**:成立,本报告在 §5 单列明确裁决。

**修法(一句)**

§2-1 与 §2-13 的锁字段替换为一个「三层时钟 + 锁作废史」小表(SHA / config digest / 变更时点 / 作废原因),并把 §1 的 2026-07-31 条目改成「当日 09:39 已部署到 ada7981c,记录见 `e2e/owner-sessions/runtime-deploy.md`」。

**级别**:B(档案过期 + 混层),但因与 N2 联动而实际影响发布门判读,triage 时按 A 处理。

---

### H3 · §2-6「下周购入 Claude」过期,PLAN-2 指针应改 5.4-b — `[ok]`(范围应扩大)

**证据**

- 已登录:`claude auth status` → `"loggedIn": true`、`"subscriptionType": "max"`、`"authMethod": "claude.ai"`;`claude --version` = `2.1.220 (Claude Code)`。CLI 版本与 `packages/daemon/test/fixtures/claude-cli/2.1.220/` 的 fixture 版本一致。
- 过期档案(**七处,不是草稿说的一处**):
  - `HANDOFF.md:45`(§2-6):「Claude 订阅(owner 已定档:**下周购入**;W1.7 回填)」
  - `HANDOFF.md:62`(§3 环境状态):「**claude 未登录(顺延)**」← **草稿没点名,见 N3**
  - `HANDOFF.md:21`(§1 批次指针):「下一工程批 = PLAN-2 W5 剩余(**5.4 挂 Claude 订阅**)」
  - `docs/plan/IMPLEMENTATION-PLAN-2.md:17`(§0 外部解锁表):「Claude 订阅=**下周**(CLI-only)」
  - 同上 `:124`:「外部解锁:Claude 订阅(**下周**)→5.4」
  - 同上 `:149`:「最近停点 … **Claude 订阅购入**+`claude` 登录」
  - 同上 `:182`(§8 执行顺序):「下一工程批仍是 **W5 剩余**(5.4 **挂 Claude 订阅**)」
- 「W5.4-a 已收口、主流程未接」**双向证实**:
  - `e2e/evidence/w54a-claude-cli.md:3`:「范围 = … **不改执行器主流程接线、不改 `gateServer.ts`、不改 `config/types.ts`/`validateConfig.ts`/`index.ts` … 不部署常驻**」。
  - `packages/daemon/src/tier1/validateConfig.ts:103-108`:`tier1StartupVerdict` 对 `i.adapter !== "cursor"` 返回 `{start:false, code:"unsupported_adapter"}`,reason 原文「后端执行器未实现(仅 cursor);拒起而非起 cursor 二进制冒充(fail-closed;claude_sdk/codex 随后续批接入)」。
  - live `config.toml:15` `[models.dev] agent = "cursor"`,即本机常驻走的仍是 cursor 执行器。

**修法(一句)**

七处统一改为「Claude Max 订阅已就位(CLI 登录态,零 API key);解锁项 = **W5.4-b 执行器主流程接线**;`tier1StartupVerdict` 目前对非 cursor adapter fail-closed,接线批必须同批放开并配反例」;同时保留「observedModel 豁免仍休眠」不动。

**级别**:B(档案过期),但它是 PLAN-2 唯一的「下一批」指针,不修会让下一个实施会话按错误前提开批,triage 时按 A 处理。

---

### H4 · §2-5 Actions「2026-08 再开」与真实失败原因 — `[ok]`

**证据(本会话 `gh run view 32334615753` 原文摘录)**

```
Error: Multiple versions of pnpm specified:
  - version 10 in the GitHub Action config with the key "version"
  - version pnpm@10.33.1 in the package.json with the key "packageManager"
  Remove one of these versions to avoid version mismatch errors like ERR_PNPM_BAD_PM_VERSION
```

- 失败步骤:`node` job 的 `Run pnpm/action-setup@v4`,job 总耗时 6s(整 run 14s)。
- 配置侧对应:`.github/workflows/ci.yml:13-15` 是 `uses: pnpm/action-setup@v4` + `with: version: 10`;`package.json:6` 是 `"packageManager": "pnpm@10.33.1"`。
- **billing 正常的反证**:同一 run 的 `python` job **成功**(11s 完成)。若 billing 未开,两个 job 都不会启动。所以「2026-08 再开 billing」这个待办**已经不再是阻塞项**。
- 连续性:`gh run list` 显示最近两次 run(`32326705894` 2026-08-20T03:01Z、`32334615753` 2026-08-20T05:10Z)**同因失败**,不是偶发。
- 范围提示:这两次 run 的标题是「snapshot: 2026-08-20 from internal …」,即**公开快照仓** `Octo-o-o-o/SayDo` 的 CI。修法要么改本仓 workflow 源再走 `scripts/publish-public-snapshot.sh`,要么直接在公开仓改——**不要在本仓静默改完就当公开仓已绿**。

**修法(一句)**

§2-5 改为「Actions billing 已恢复(2026-08-20 两次 run 均已启动,python job 通过);当前唯一失败原因 = `pnpm/action-setup@v4` 的 `version: 10` 与 `package.json` `packageManager=pnpm@10.33.1` 冲突,一行删 `version` 即可,属工程债,不影响对外承诺」。

**级别**:B(档案过期 + 一行可修的工程债)

---

### H5 · live TTS 仍 jitangmei — `[warn]`(事实对,但「档案写清即可」的行动项**已经做完了**)

**证据**

- live 现状成立:`~/.saydo/config.toml:35` `voice = "zh_female_jitangmei_uranus_bigtts"`。
- **但档案早已写清,无可修**:
  - `HANDOFF.md:49`(§2-10)原文:「**已拍板;源码缺省已落地,live 显式覆盖尚未切换**…源码缺省音色已切 `zh_female_tianmeiyueyue_uranus_bigtts`(代码 `ee5a366`…),但 2026-07-31 现场复核的 live `~/.saydo/config.toml` 仍显式覆盖 `zh_female_jitangmei_uranus_bigtts`;切换 live 配置须由 owner 另行决定,**当前实例不得写成已切**。」
  - `HANDOFF.md:34`(§1 2026-07-31 条目)重复了同一口径,并写明「本次 E9 只纠正文档、未改配置」。

**裁决**:这是 H1–H6 里**唯一已经完全对齐**的一条。把它列入「本周 HANDOFF 清账」是预算错配——本周对它应该**不做任何修改**。真正剩下的风险只在对外文案(是否有页面写了 tianmeiyueyue),那属另一路。

**修法(一句)**

从本周待办移除;若要动,只在 §2-10 补一句「2026-08-21 复核 live 仍为 jitangmei,口径不变」作为时间戳刷新,其余一字不改。

**级别**:C(至多是时间戳刷新)

---

### H6 · T19 `setup_local_only` 会让已配 `[t2]` 的远程 setup 变差 — `[ok]`(实测证据强于草稿)

**HEAD 侧证据**

- `packages/daemon/src/index.ts:1000` 返回 `code: "setup_local_only"`(另有 `:1054`、`:1173`,以及 `packages/daemon/src/api/recoveryOnlyServer.ts:399,408`)。probe 路由在 `index.ts:994`(`u.pathname === "/api/setup/probe"`)。
- `packages/console/src/components/SetupBootstrapBoundary.tsx:14` 定义 `SetupBootstrapKind = "pending" | "loading" | "probe-error" | "wizard" | "app" | "remote-mobile"`;`:27` 只有 `input.probeErrorCode === REMOTE_MOBILE_PROBE_CODE` 才进 `remote-mobile`,否则 `:28` 落 `probe-error`。
- `packages/console/src/components/SetupBootstrapBoundary.test.ts:95-96` 断言标题即
  「`token_mismatch/origin_rejected/host_rejected/setup_local_only` 仍停错误卡」。
- 合同侧已固化:`docs/11-ui-spec.md:403`「`token_mismatch`/`origin_rejected`/`host_rejected`/`setup_local_only` **仍停错误卡**」;`docs/09-data-contracts.md:1145`「…**也不得旁路** `token_mismatch`/`origin_rejected`/`host_rejected`/`setup_local_only`」。

**本机常驻侧证据(草稿没做这一半,这是关键)**

- `rg 'setup_local_only' ~/.saydo/runtime/packages/daemon/src` → **无命中**。
- `rg 'setup/probe' ~/.saydo/runtime/packages/daemon/src/index.ts` → **无命中**(该树根本没有 setup probe 端点)。
- `ls ~/.saydo/runtime/packages/console/src/components | rg -i setup` → **无命中**(该树没有 `SetupBootstrapBoundary`、没有 `SetupWizard`)。
- `ls ~/.saydo/runtime/packages/console/src/mobile` → **目录不存在**。
- `ls ~/.saydo/runtime/packages/daemon/src | rg focus` → **无命中**。
- T19 引入时点:`git log -S'setup_local_only' -- packages/daemon/src/index.ts` → 最早 `e8e987f`(2026-08-10)、`7aa11e2`(2026-08-11),**均晚于 ada7981c(2026-07-31)**。

**结论(比草稿更强)**

今晚刚开的 tailnet 面,跑在**完全没有首启门**的 7-31 树上——手机开 tailnet console **直接进**,不撞任何 probe 门。一旦把常驻升到 HEAD,**同一条 URL 会撞 `setup_local_only` 硬门,整壳挂不起来**。这不是「变差」,是**从可用变不可用**。`docs/review/2026-08-13-mobile-gap-audit.fable.md:25` 早已把它定性为「相对 …更早的 T2 薄版,这是回归」。

**必须同时说清的反向面(草稿没写,避免片面)**:HEAD 才有移动壳与 LAN `remote-mobile` 旁路(`e2e/evidence/remote-mobile-w0.md:17`)。所以升级不是纯负面,是**拿 tailnet 面换 LAN 移动面**。在 T19 × tailnet 合同拍板前,**两边都不能升**——升了就是在没有合同的情况下替 owner 做了取舍。

**「禁止 silent 扩合同」成立**:`09:1145` 与 `11:403` 都是明文合同,把 `setup_local_only` 纳入 `remote-mobile` 属**语义级变更**,按 AGENTS.md「语义级变更一律先回写本仓 canonical」,必须先改 09/11 再改代码。`docs/review/2026-08-13-mobile-shell-strategy-final.fable.md:153` 已把这条列为待 owner 拍板项。

**修法(一句)**

在 HANDOFF §2 新增一行「**T19 × tailnet 合同(待 owner 拍板;升常驻的前置门)**:HEAD 的 `/api/setup/probe` 对 `via=tailnet` 返 `setup_local_only` 并停错误卡(`index.ts:1000`、`11 §403`、`09:1145`);常驻 ada7981 无此门。**拍板前禁止把常驻升到 HEAD**,否则已配 `[t2]` 的远程面当场不可用」。

**级别**:A(未拍板即升级会造成产品面回归,且属静默扩合同风险)

---

## 4. 草稿没写的错位(本会话新发现)

### N1 · [A] 定时快照备份连续 15 天全失败,档案零记录

- 最后一次成功的调度快照:`~/.saydo/backups/20260806T013953Z`(目录时间 Aug 6 09:39);此后**没有任何新目录**。
- 逐日结构化日志计数(`~/.saydo/logs/daemon-2026MMDD.jsonl`,按 `msg` 精确计数):

| 日期区间 | `scheduled snapshot backup`(成功) | `scheduled snapshot backup failed` |
|---|---|---|
| 2026-08-01 … 08-06 | 每天 1 | 0 |
| 2026-08-07 … 08-16 | **0** | 每天 1(08-16 为 4) |
| 2026-08-17 … 08-18 | 0 | 0(当日无调度窗记录) |
| 2026-08-19 / 08-20 | **0** | 1 / 2 |

- 错误原文(`daemon.launchd.err.log`,本会话 tail 取得):
  `level=error msg="scheduled snapshot backup failed" error="WorkspacePolicyError: 目录在确认期间发生变化"`
- 代码出处:`packages/daemon/src/index.ts:3315` 记录该 error;抛出点 `packages/daemon/src/projects/workspace.ts:234`
  `throw new WorkspacePolicyError("workspace_identity_changed", "目录在确认期间发生变化", expected.path)`。
- 关联纪律:`AGENTS.md` 把 `just backup`(SQLite/JSONL/knowledge 快照备份)列为常用命令;`e2e/owner-sessions/runtime-deploy.md` 把 snapshot + dry-run restore 当作部署门的一部分。
- **判定**:本机狗粮层的数据保护**已停摆 15 天**,HANDOFF / PLAN-2 / journal 均无一字记录。这比草稿列出的任何一条 H 都更接近「会真的丢东西」。同时它还有一个二阶后果:**下一次部署门跑不出合规的 snapshot 证据**——`runtime-deploy.md` 的既有格式要求「snapshot … `entries=4 digests=verified foundation=restorable`」。
- **修法**:HANDOFF §2 新增一行记录事实与最后成功时点;把「排查 `workspace_identity_changed` 导致的备份失败」作为一个独立小工程批候选上浮 owner,**排在升常驻之前**(备份不可用时做部署是高风险)。

### N2 · [A] HANDOFF 未记录「场次① 已跑且 `failed`」

- `e2e/owner-sessions/session-1.md:54` `current_status` = **`failed`**;`:55` 「historical_attempt `failed` / partial;已有真实反馈,不计通过」;`:57` `runtime SHA = ada7981c…`;`:59` 「owner verdict `failed`;聚焦返工已部署,等待 owner 按同一清单从步骤 1 重新复验」;`:100` 「场次①仍维持 `failed`,不能把自动门禁或连接 smoke 写成 owner 真人复验通过」。
- `session-2.md:78` / `session-3.md:54` / `session-4.md:85` 均 `not_run`。
- 而 `HANDOFF.md:40` 仍写「**发布前部署门已通过,可以开始场次①**」,`:52` 写「下一步从场次①开始,不再重复部署」——**读起来像场次①从未开始**。
- 交叉印证:`docs/review/2026-08-14-saydo-phase-gap-analysis.md:11` 已写「B1 四场真人验收悬空(①**failed@ada7981c**、②③④ `not_run`)是发布门未关的根因」。
- **判定**:HANDOFF §1/§2 对**发布门**的状态叙述与本仓现场记录不一致,且方向是「显得比实际好」。这是内部档案里最接近「完成度不诚实」的一条。
- **修法**:§2-1 增写「场次① 已于 ada7981c 跑过并 `failed`(`e2e/owner-sessions/session-1.md:54-59`),返工已部署,待 owner 从步骤 1 复验;②③④ `not_run`」。

### N3 · [B] §3 环境状态「claude 未登录(顺延)」是与 §2-6 相互独立的第二处过期

`HANDOFF.md:62` 原文:「BYOA CLI:cursor-agent 订阅态可用 … / codex ChatGPT 登录可用 / **claude 未登录(顺延)**」。草稿 H3 只点了 §2-6。清账时若只改 §2-6,§3 仍会留一条直接反证。

### N4 · [B] 今晚 live 配置变更 + daemon 重启,tailnet 面是**今晚才上线**的,无档案记录

- `~/.saydo/config.toml` mtime = **2026-08-21 00:20**;daemon 进程 `lstart` = **Fri Aug 21 00:20:52 2026**(`ps -o lstart -p 72885`),取证时 uptime 24 分钟。
- `daemon.launchd.err.log` 中所有 `daemon started` 行,最近 6 次:

```
msg="daemon started" port=47100 listen="127.0.0.1" tailnetHosts=0     (x5)
msg="daemon started" port=47100 listen="0.0.0.0"   tailnetHosts=2     (最新一次)
```

- **含义**:`[t2]` 两槽与 `listen=0.0.0.0` 是**今晚才生效的**。任何「tailnet 面已 dogfood 一段时间」「8-16 起手机可连」的表述都不成立。
- 二阶影响:§2-1 的 `release config digest` 锁**第三次**被动(`522e0716` → `90e35db9` → 今晚未知值),而 HANDOFF 只记录了第一个值。
- **修法**:HANDOFF §1 新增一条「2026-08-21 00:20 live config 变更 + daemon 重启:`listen` 由 `127.0.0.1` 改 `0.0.0.0`、`tailnetHosts` 由 0 变 2;tailnet 面自此启用;config digest 随之变化,场次锁需重新声明」。

### N5 · [B] deep readiness(A3 深评链)在本机常驻上未武装

- err log 原文:`level=warn msg="evaluator provider unresolved (deep readiness pipeline not armed)" error="Error: resolveApiProvider 只处理 api 形态,got cursor_cli(BYOA 走 1.2b 适配器)"`。
- 成因:live `config.toml:12` `evaluator = { provider = "cursor_cli", model = "gpt-5" }`,而 `resolveApiProvider` 只处理 `api` 形态。
- **含义**:HANDOFF §2-15 把 A3-armed 写成已收口(源码层成立),但**本机常驻的深评管线是没起来的**。这条不影响对外承诺,但会影响任何基于「本机 dogfood 已跑深评」的判断。
- **修法**:HANDOFF §2-15 或 §3 补一句「本机 live `[models] evaluator` 配为 `cursor_cli`,深评管线在常驻上未武装(启动 warn 可复现);A3-armed 的收口是源码层结论」。

### N6 · [C] launchd 重定向日志未轮转

`~/.saydo/logs/daemon.launchd.err.log` = **47,074,468 字节**(约 45 MB),持续追加。同目录 `daemon-2026MMDD.jsonl` 已按日轮转。`AGENTS.md` 硬规则 6 / `docs/modules/e-crosscutting.md` E3 写的是「日志可轮转,审计不可变」——launchd 的 stdout/stderr 重定向流目前不在轮转范围内。属卫生问题,C 级。

### N7 · [warn] launchd `runs = 20961`,成因未独立复核

`launchctl print` 显示 `runs = 20961`、`last exit code = 0`,而当前 daemon uptime 只有 24 分钟。本会话**无法判定**这两万次启动的时间分布(可能是长期 KeepAlive 重启循环,也可能是累积计数)。**不下结论**,仅建议:HANDOFF §3 增一行说明「常驻稳定性的取证口径 = `runs` 计数 + `ps -o lstart` uptime + err log 的 `daemon stopping` 行」,让后续会话有统一判据,避免「服务在跑」被误当成「服务稳定」。

---

## 5. 明确裁决:未授权是否允许把 HEAD 灌进 launchd

**不允许。三条独立理由,任一条单独成立即足以否决。**

1. **纪律面已有明文,且不止一处。**
   - `HANDOFF.md:21`:`remote-mobile-w0` 完成定义 = 「LAN `remote-mobile` 代码 + 临时 Chromium/LAN 证据,**不部署常驻、不宣称真机狗粮**」。
   - `HANDOFF.md:68`(§4 铁律):「`just daemon deploy [sha]` … **deploy 会重启 daemon 与 pipeline——批收口后知会 owner 再跑,dogfood 时段不重启**」。
   - `docs/review/2026-08-16-now-vs-later.md:58`:「把常驻 runtime 从 `ada7981c` 推到 HEAD —— **8 月纪律不部署**。本批合入后真机狗粮需另开部署时窗(**owner**)」。
   - `docs/plan/IMPLEMENTATION-PLAN-2.md:182`:「该批**不取代 W5 剩余、不部署常驻**」。
2. **合同面未关门(H6)。** HEAD 的 `setup_local_only` 硬门未拍板;今晚刚启用的 `[t2]` 远程面在 HEAD 上会**当场不可用**。在没有 owner 对「`setup_local_only` 是否纳入 `remote-mobile`」拍板的情况下部署,等于用一次部署动作替 owner 做了 canonical 级取舍——这正是 AGENTS.md「语义级变更一律先回写 canonical」和 H6「禁止 silent 扩合同」要防的事。
3. **证据面会被清零。** §2-1 的场次锁语义是「任一变化从①重跑」;场次① 刚在 ada7981 上跑出 `failed` 并完成返工部署(N2),升常驻会让这条基线**第三次作废**。且 355 个提交跨越尚未裁决的 v0.1.0 范围问题(`docs/review/2026-08-14-saydo-phase-gap-analysis.md:11` 的 B0 未裁决)。

**放行条件(三者齐备,缺一不可)**:① owner 对 T19 × tailnet 合同显式拍板并**先**回写 09/11;② N1 的备份失败先修好(部署门本身要求可验证 snapshot + dry-run restore);③ owner 明确授权部署时窗并接受场次基线重置。

**同样不允许的相邻动作**:在 launchd 里加 `SAYDO_MOBILE_LAN=1`(当前 launchd 环境**没有**这个键,实测确认)。该开关按 `docs/09-data-contracts.md:1145` 会把监听改成 `0.0.0.0` 并开启一整套 LAN 身份门语义,属产品面变更,同样归 owner。

---

## 6. 最终建议(三栏 + 保持不动)

> 说明:本栏**只覆盖内部档案与工程拍板**。对外文案的替换句由另一路给出,本报告不越界。

### 6.1 优先对齐(本周;不需 owner 拍板,纯档案回写)

按「不修会让下一个会话按错误前提开工」排序:

| 序 | 动作 | 依据 | 级别 |
|---|---|---|---|
| 1 | HANDOFF §2-1 补记「场次① 已跑且 `failed`」+ 重声明三层时钟与锁作废史 | N2 + H2 | A |
| 2 | Claude 口径**七处一次改完**(HANDOFF `:21`/`:45`/`:62` + PLAN-2 `:17`/`:124`/`:149`/`:182`) | H3 + N3 | A |
| 3 | HANDOFF §2 新增「备份连续失败」记录行,并把排查列为待排工程批 | N1 | A |
| 4 | HANDOFF §2 新增「T19 × tailnet 合同 = 升常驻前置门」一行 | H6 | A |
| 5 | HANDOFF §1 新增「2026-08-21 00:20 live config 变更 + daemon 重启」条目 | N4 | B |
| 6 | HANDOFF §2-12 Tailscale 行改写(含「烟测基线是 ada7981,不外推 HEAD」限定) | H1 | B |
| 7 | HANDOFF §2-5 Actions 行改写为真实失败原因 | H4 | B |
| 8 | HANDOFF §2-15 或 §3 补「深评管线在常驻未武装」 | N5 | B |
| 9 | HANDOFF §3 补「常驻稳定性取证口径」一行 | N7 | C |

**本周明确不做**:§2-10 TTS 段(H5,已对齐)。

### 6.2 后续对齐(需 owner 拍板;写明依赖顺序,不是并列清单)

```
T19 × tailnet 合同拍板 ──┬─→ 09/11 回写 ─→ 代码实施 ─→ (才可能)升常驻
                          └─→ 在此之前:禁止 deploy HEAD、禁止加 SAYDO_MOBILE_LAN

N1 备份修复 ──────────────────────────────→ (部署门前置,与上面并行但同为前置)

W5.4-b Claude 执行器接线 ─────────────────→ 独立轨,不依赖上面两条

手机 tailnet 烟测(just t2-pair + 四页)──→ 现在就能跑,但结论只对 ada7981 有效
```

1. **T19 × tailnet 合同**:`setup_local_only` 是否纳入 `remote-mobile`。拍板后**先**回写 `docs/09-data-contracts.md:1145` 与 `docs/11-ui-spec.md:403,409`,再动代码。**这是升常驻的硬前置。**
2. **N1 备份 `workspace_identity_changed` 排查**:建议排在升常驻之前,理由是部署门本身要求可验证 snapshot。
3. **是否升常驻 / 是否开 `SAYDO_MOBILE_LAN`**:依赖 1 与 2;当前答案是**否**(§5)。
4. **W5.4-b Claude 执行器接线开批**:订阅已就位,唯一未解的是 `tier1StartupVerdict` 的 fail-closed 需同批放开并配反例。
5. **手机 tailnet 烟测**:可即刻进行(config 与监听已就绪);报告中只写步骤名,配对 URL 含令牌不入档。**结论必须标注基线 = ada7981**。
6. **Actions 一行修**(删 `.github/workflows/ci.yml:15` 的 `version: 10`):要走公开快照仓通道,别在本仓改完就当公开仓已绿。
7. **真人场次 ①–④ / S3 Touch ID / OctoBlog**:先定基线树(现场记录锁 ada7981,若升常驻则全部重跑)。

### 6.3 改承诺的具体句子(内部档案替换句,可直接抄)

**(1) `HANDOFF.md:40` §2-1 锁字段** —— 替换为:

> 四场验收基线 = **三层时钟**:HEAD `088b8f0`(2026-08-20)· 常驻 runtime `ada7981c`(2026-07-31 09:39 部署,记录 `e2e/owner-sessions/runtime-deploy.md:118-130`)· live config digest 已随 2026-08-21 00:20 的 `[t2]`/`listen` 变更再次改变(历史值:`522e0716…` → `90e35db9…` → 当前待重算)。
> **场次① 已于 `ada7981c` 跑过并 `failed`**(`e2e/owner-sessions/session-1.md:54-59`),聚焦返工已部署,等待 owner 按同一清单从步骤 1 复验;②③④ `not_run`。
> 锁语义不变(任一变化从①重跑),但**当前锁面自 2026-08-21 起需重新声明**。

**(2) `HANDOFF.md:45` §2-6 Claude 订阅** —— 替换为:

> **Claude Max 订阅已就位**(2026-08-21 复核:`claude` CLI 2.1.220,`auth status` `loggedIn=true`、`subscriptionType=max`、零 API key)。硬约束不变(只经 CLI 登录态消费,不配 `ANTHROPIC_API_KEY`,不与其他项目共用席位)。
> W5.4-a 已收口但**纯函数层未接线**(`e2e/evidence/w54a-claude-cli.md:3` 明写不改执行器主流程/`gateServer.ts`/`validateConfig.ts`);`tier1StartupVerdict` 对非 cursor adapter 仍 fail-closed(`packages/daemon/src/tier1/validateConfig.ts:103-108`)。
> **剩余解锁项 = W5.4-b 执行器主流程接线**,不再挂「没买订阅」。09 §11 规则 2 的 observedModel 豁免**仍休眠**(不变)。

**(3) `HANDOFF.md:62` §3 BYOA CLI 行** —— 替换为:

> BYOA CLI:cursor-agent 订阅态可用 / codex ChatGPT 登录可用 / **`claude` 已登录(Max 订阅,CLI 2.1.220;2026-08-21 复核)**。

**(4) `HANDOFF.md:44` §2-5 Actions** —— 替换为:

> **GitHub Actions billing 已恢复**(2026-08-20 两次 run 均正常启动,`python` job 通过)。当前 `node` job 失败的唯一原因 = `pnpm/action-setup@v4` 的 `version: 10`(`.github/workflows/ci.yml:15`)与 `package.json:6` 的 `packageManager: pnpm@10.33.1` 冲突,报错 `Multiple versions of pnpm specified`。**一行删 `version` 即可;这是工程债,不构成对外承诺变更**。修在公开快照仓生效需走 `scripts/publish-public-snapshot.sh` 通道。本地 `just ci` 双矩阵仍是唯一实质门禁。

**(5) `HANDOFF.md:51` §2-12 T2 组网** —— 替换为:

> **Tailscale 已就绪**(2026-08-21 复核:`systemextensionsctl list` 显示 Tailscale Network Extension 为 `activated enabled`;`BackendState=Running`、`Online=true`、`TUN=true`)。
> `~/.saydo/config.toml` 的 `[t2].tailnet_hosts` 两槽与 `listen=0.0.0.0` 已填并**于 2026-08-21 00:20 随 daemon 重启生效**(启动日志 `tailnetHosts=2`;此前每次启动均为 `listen=127.0.0.1 tailnetHosts=0`)。**该生效不需要 `just daemon deploy`**——常驻 `ada7981c` 树本身含 T2 薄版(`net/t2.ts`)。
> 剩余 = `just t2-pair` + 手机四页烟测 + 批一条 S2 + 点 S3 见拒绝话术。
> **限定:本轮烟测基线 = 常驻 `ada7981c`,该树无移动壳、无 T19 首启门;结论不得外推到 HEAD,也不得写进对外文案。**

**(6) `HANDOFF.md` §2 新增行 · T19 × tailnet 合同(升常驻前置门)**:

> **T19 × tailnet 合同(待 owner 拍板 · 升常驻的硬前置)**:HEAD 的 `GET /api/setup/probe` 对 `via=tailnet` 返 403 `setup_local_only`(`packages/daemon/src/index.ts:1000`),console `SetupBootstrapBoundary` 只把 `mobile_lan_route_rejected` 旁路成 `remote-mobile`(`SetupBootstrapBoundary.tsx:27`;反例 `.test.ts:95-96`),合同见 `docs/09-data-contracts.md:1145` 与 `docs/11-ui-spec.md:403`。常驻 `ada7981c` **没有**该门(无 probe 端点、无 boundary、无 mobile 树)。
> **结论:拍板并回写 canonical 之前,禁止把常驻升到 HEAD,禁止在 launchd 增加 `SAYDO_MOBILE_LAN`。** 否则已配 `[t2]` 的远程面从可用变不可用,且构成静默扩合同。

**(7) `HANDOFF.md` §2 新增行 · 定时备份失败**:

> **[warn] 定时快照备份自 2026-08-07 起连续失败**:最后一次成功 `~/.saydo/backups/20260806T013953Z`;此后逐日日志均为 `scheduled snapshot backup failed` / `WorkspacePolicyError: 目录在确认期间发生变化`(抛出点 `packages/daemon/src/projects/workspace.ts:234` `workspace_identity_changed`;记录点 `packages/daemon/src/index.ts:3315`),15 天零成功。
> 影响:dogfood 数据保护实际停摆;且**下一次部署门无法产出合规 snapshot 证据**(`e2e/owner-sessions/runtime-deploy.md` 要求 `entries/digests/foundation` 字段)。建议作为独立小工程批上浮 owner,排在任何部署动作之前。

**(8) `docs/plan/IMPLEMENTATION-PLAN-2.md` 四处指针** —— 统一替换:

- `:17` 外部解锁表 → 「Claude 订阅=**已就位**(CLI-only,Max);Actions billing=**已恢复**(剩 workflow pnpm 版本键冲突);OpenAI key=可选;`CURSOR_API_KEY`=无额度」
- `:124` → 「外部解锁:Claude 订阅(**已就位**)→ **5.4-b 接线**;OpenAI key→7.4/7.6;`CURSOR_API_KEY` 购入→5.9;服务器→W8 挂起轨 T3;**Actions 已恢复**→CI 云端;Apple Developer→7.3」
- `:149` 最近停点 → 「A3 门语义已确认;**场次① `failed`@`ada7981c`,待 owner 复验**;T2 组网已就绪待手机烟测;**Claude 已登录,待 5.4-b 接线**」
- `:182` 执行顺序尾句 → 「下一工程批仍是 **W5 剩余**,其中 5.4 的口径改为 **5.4-b 执行器主流程接线**(订阅已就位,5.4-a 纯函数层已收口);该批**不部署常驻**,升常驻另需 T19 × tailnet 合同拍板」

### 6.4 保持不动

| 项 | 理由 |
|---|---|
| `HANDOFF.md:49` §2-10 TTS 段 | 已完全准确(源码缺省 vs live 覆盖分得清清楚楚),H5 的行动项已完成 |
| `HANDOFF.md:68` §4 铁律速查 | 本次取证未发现任何一条与实现不符 |
| launchd 当前形态(`ada7981c` + `SAYDO_HOME` + `SAYDO_DEV=1`,**无** `SAYDO_MOBILE_LAN`) | 见 §5 |
| live `config.toml` 的 TTS 音色 | 听感归 owner |
| `docs/09-data-contracts.md:1145` / `docs/11-ui-spec.md:403` 的 `setup_local_only` 合同 | 未拍板前一字不动 |
| PLAN-2 「`remote-mobile-w0` 不部署常驻」的完成定义 | 该定义正是当前该守的纪律,不是过期项 |
| `e2e/owner-sessions/session-1..4.md` 的状态字段 | 是真相源,应该让 HANDOFF 去对齐它们,不是反过来 |

---

## 7. 总评

**整体判定:需收窄。**

三条理由:

1. **方向基本正确,但把「档案刷新」当成了主要工作量。** H1/H3/H4 都是真实过期,但它们本身不改变任何决策;真正会改变决策的是 H6(升常驻会打死远程面)、N2(场次① 其实 failed)、N1(备份停摆 15 天),其中后两条草稿完全没有。
2. **有一条(H5)是已经对齐的,列进待办是浪费本周预算。**
3. **H2 的修法太轻,P1 排期缺前置依赖。** 「三层 SHA 写清」不足以修复一个已被三次作废的发布验收锁;「T19 合同」与「升常驻」不是并列项,是前置与后继。

**如果本周只做三件事,做这三件:**

1. **HANDOFF §2-1 一次改到位**:补记「场次① 已跑且 `failed`@`ada7981c`」+ 三层时钟 + 锁作废史(N2 + H2 + N4)。这是唯一一条会让人对发布门产生错误判断的内部错位。
2. **Claude 口径七处一次改完**(HANDOFF 三处 + PLAN-2 四处,H3 + N3)。这是唯一一条会让下一个实施会话按错误前提开批的错位。
3. **把「备份连续 15 天失败」上浮 owner**(N1)。这是唯一一条会真的丢数据、并且会卡住下一次部署门的错位。

**本周明确不要做的三件事:**

1. 不要 `just daemon deploy` / 不要把 HEAD 灌进 launchd / 不要加 `SAYDO_MOBILE_LAN`(§5)。
2. 不要改 §2-10 TTS 段(H5 已对齐)。
3. 不要在 T19 × tailnet 合同拍板前碰 `docs/09-data-contracts.md:1145` 或 `docs/11-ui-spec.md:403` 的 `setup_local_only` 条款。

---

*本报告只读取证,未做任何写操作。C1–C10 未评审,见 §3.0。*
