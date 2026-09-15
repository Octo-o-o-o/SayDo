# 安装部署与首启门槛收敛批(2026-09-15)

owner 2026-09-15 直接授权:「看一下现在安装部署 SayDo 的方式是否最便捷、用户门槛最低(含首启 onboarding),不够好就设计方案并对应,完成后把最新使用流程更新到官网」。本批是 owner 点名的直接修复批,不在 PLAN-2 唯一串行链内,不占 active/next(指针仍 `active=none next=JOURNEY-01`)。

## 身份

| 项 | 值 |
|---|---|
| 分支 | `quickstart-20260915`(worktree `../SayDo-wt-quickstart`,父=main `0f7d67a`) |
| I 提交 | `8fb99bd` |
| 官网部署 | Cloudflare Pages 项目 `saydo`:preview `aa3e3a03`(分支 `preview-quickstart-20260915`)→ production `3d6328bb`(分支 `main`),两者均绑定 commit `8fb99bd`;`saydo-link` 未改动未重部署 |
| 评审 | 无独立零上下文评审(owner 直接授权路径);本文件由实施者自记 |

## 一手实测发现(修复前;隔离 HOME,官网线上 install.sh + rc.12 包)

| # | 现象 | 判定 |
|---|---|---|
| 1 | PATH 无 Node 22 时脚本去 nodejs.org 下载,无进度、无连接超时、无镜像;本机一次 5 分钟后 `curl (28) SSL connection timeout` 失败 | 脚本缺陷(镜像只覆盖 SayDo 包,不覆盖 Node) |
| 2 | 有 Node 22 时安装 12 秒完成,启动器/PATH 行/校验均正确 | 正常 |
| 3 | rc.12 包 `saydo --help` / `saydo` / `saydo doctor` / 任何错误命令都只打印 `[fail] cli failed`,exit 0 或 1;rc.12 的 options.ts 只有 up/status/open,README 与官网写的 `saydo doctor` 在包里不存在 | 包与文档不一致;用法错误被 untrusted 投影吞掉 |
| 4 | `saydo up --no-open` 不给任何控制台地址或下一步;直接开 `http://localhost:47100` 得「访问凭证已失效」 | 引导缺口 |
| 5 | daemon started 日志 `bootPromote=[object Object]` | 日志缺陷 |
| 6 | 首启向导:零供给机器上空态只有一句「登录一个本机 CLI,或添加 API 直连」,折叠区为空,拿不到任何命令 | 引导缺口(docs/11 §5.8a 原空态条款即如此) |
| 7 | 逃生口进入主页后顶栏显示「语音就绪」,而包内无语音 pipeline(readiness `voiceReady=false`) | 与 docs/11 §5.7 三态(无会话=「开始对话」)不符 |
| 8 | 官网:`~/.saydo/daemon.log` 不存在(实为 `logs/daemon-<日期>.jsonl`);「tsx 冷启动」只在源码形态;§4.1 漏 curl/tar;§4.2 漏 `SAYDO_INSTALL_ALLOW_OUTSIDE_HOME`;关停命令只有 POSIX;`just` 命令未标注仅源码;§4.4 描述的「资源画像四步」与现役融合页不一致 | 文档过时/遗漏 |
| 9 | `just dev` 无条件拉起 `uv`,未装则持续报错 | 开发者路径摩擦 |

## 对应(全部在 `8fb99bd`)

- canonical 先行:`docs/11 §5.8a` 空态条款修订(逐家列可粘贴修复行,数据来自 probe,console 不维护第二份命令表)。
- `packages/cli`:`help`(`--help`/`-h`/无参数)打印用法 exit 0;未知命令/参数打印首行原因 + 完整用法 exit 1(不再投影成 `cli failed`);`--no-open` 打印「在另一个终端运行 saydo open」提示,不打印带凭证地址(避免落进被重定向的日志)。
- `packages/daemon`:未安装的已接线 CLI 的 `fixHint` 带上 `CLI_CATALOG.loginHint`(命令形写「运行 `x` 登录」,句子形原样接入);`bootPromote` 展平为可读串。
- `packages/console`:`EmptySupplyHints`(空态逐家修复行 + 「装好并登录后点『重新检测』」);顶栏无会话恒显「开始对话」。
- `install.sh` / `install.ps1`:Node 下载先官方源、10–15 秒连不上改用 `npmmirror.com/mirrors/node`(仍按官方 SHASUMS256 校验),`SAYDO_INSTALL_MIRROR=1` 两处都直走镜像;`-#` 进度、`--connect-timeout`、`--retry`;收尾提示改为「1. 准备 AI 供给 2. saydo up」。
- `scripts/dev.mjs`:无 `uv` 时跳过 pipeline 并 `[warn]`。
- 官网中英文 docs / 首页 / README:见 I 提交 message;新增 §4.4a「从零到第一句话:验收清单」供 owner 照单人工验收。

## 门禁(worktree,HEAD `8fb99bd`)

| 门 | 结果 |
|---|---|
| `pnpm typecheck` / `pnpm lint` | [ok] |
| `pnpm --filter @saydo/cli test`(含新增 help 用例) | [ok] 5 文件全过 |
| `pnpm --filter @saydo/console test` | [ok] 43 文件全过(`setupWizardUx` 25 例,含新增空态 2 例) |
| `pnpm --filter @saydo/daemon test` | 首跑(`just ci` 内)2 文件 14 例红:`memory-foundation` 13 例 `ENOENT mkdtemp .../saydo-t-ylNeWK/...`(并行用例清掉了共享临时目录)、`recovery-only-process` 1 例「等待进程证据超时」;两文件单独复跑 39/39 绿;全量复跑 **137 文件 2327 例全绿**。与本批改动无交集 |
| `just ci` | 首跑因上述 daemon 红而 exit 1;contracts 13 / platform 7 / console 43 / cli 5 文件全过;daemon 复跑全绿后未再整体重跑(python 矩阵未受本批影响,本批无 Python 改动) |
| `node scripts/test-install-scripts.mjs` | [ok] pinned v0.1.0-rc.12;mutations=21 all red;dynamic no-write checks=6 |
| `bash scripts/check-emoji.sh` / `node scripts/check-active-claims.mjs`(roots=33)/ `node scripts/check-doc-links.mjs`(156/0)/ `git diff --check` | [ok] |
| 开发树产物实测(fresh HOME) | `help`/`bogus`/`up --bogus` 输出如预期;`up --no-open` 打印 saydo open 提示;`bootPromote="configPromoted=false ..."`;PATH 剥离 CLI 后向导空态逐家列出 7 家修复行;逃生口后顶栏「开始对话」、页面无「语音就绪」 |
| 官网 preview `aa3e3a03` | `/ /en/ /docs/ /en/docs/` 200;`install.sh`/`install.ps1` 200 `text/plain`,线上 SHA-256 与仓内全等(`247c9060…` / `1d1240a4…`);隔离 HOME 端到端安装:有 Node 路径 [ok];`SAYDO_INSTALL_MIRROR=1` + 无 Node 路径 [ok](从 npmmirror 取得 Node v22.23.2 并校验通过,SayDo 包走 dl 镜像) |
| 官网 production `3d6328bb`(https://saydo.octoooo.com) | 四页 200(`/en/docs/` 一次本机 SSL 瞬断后重试 200);脚本 SHA-256 与仓内全等;锚点:zh/en `4.4a` 各 1、首页「装前备好一个 AI 供给」1、可用性 marker zh/en 各 1、`daemon.log` 残留 0;隔离 HOME 从线上端到端安装 [ok] |

## not_run / 范围外如实登记

- **rc.12 用户拿不到 CLI/console/daemon 改动**:官网安装脚本仍钉 v0.1.0-rc.12;`help`、`--no-open` 提示、向导空态、顶栏标签只在开发树,须 rc.13 发布才到用户手里。官网已按 rc.12 实际行为写(明说无 `--help`、`doctor` 未发布)。
- **rc.13 发布前置**:`.github/workflows/release.yml` 触发 tag 硬编码 rc.12 需改;私有归档与公开仓最近所有 push 的 CI 均红——`android shell` 的 `setup-android` 动作失败(`Failed to find package 'tools'`)、`packages/cli` 的 `emergency-reaper` 用例在 ubuntu 容器 20 秒等待超时;两者与本批无关,但会挡发布链。
- `install.ps1` 改动未在 Windows 真机回归(not_run;本机无 pwsh);Linux 真机仍未执行(沿用既有 not_run)。
- 未做:npm registry / Homebrew / Scoop 发布(owner 待决);Windows/Linux 常驻;向导主链 Playwright 用例。
- 分支未合并、未 push;官网 production 已从 `8fb99bd` 部署(与 2026-09-02 先例相同:部署绑定的 commit 随后 ff 入 main)。
