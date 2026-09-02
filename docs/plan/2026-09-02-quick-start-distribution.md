# 快速启动分发方案:一条命令安装(2026-09-02)

> 状态:已实施并在 macOS(本机)与 Windows(局域网主机)实测;证据见 §6。本文是 `docs/plan/` 的专题方案,不属于合同 canonical;发布合同形状仍以 `docs/release/` 与 `scripts/release-*.mjs` 为准。
> 触发:owner 2026-09-02 要求「官网上用户看到 Mac、Windows、Linux 可以使用,除了从 GitHub 拉代码自己跑,还有什么快速跑的方式?设计完整方案并落地」。
> 排产关系:本方案不改变 PLAN-2 的唯一串行链(`PG-01B` 仍是唯一 next);它是发布/分发面的独立小批,scope 只在 `deploy/saydo-octoooo-com/**`、`README*`、`docs/site/**`、`scripts/test-install-scripts.mjs` 与 CI 接线。

## 1. 现状(实施前)

| 渠道 | 状态 | 门槛 |
|---|---|---|
| 源码:`git clone` + `pnpm install && pnpm -r build` + `just dev` | 可用 | Node 22 + pnpm 10 + (语音要 uv);开发者向 |
| GitHub Release 固定 URL:`npm exec --yes --package=<tgz URL> -- saydo up` / `npm install --global <tgz URL>` | 可用(rc.12 available,六项 smoke + Mac/Windows 实体门) | **必须先自己装 Node 22**;必须能访问 github.com |
| npm registry(`npm i -g @saydo/cli`) | 未发布 | owner 手动发布(本方案不做) |
| Homebrew / Scoop / winget | 未发布 | 需另建 tap/bucket 仓或提交外部 PR |
| Docker | 不适用 | daemon 要驱动本机已登录的 AI CLI、打开本机浏览器、访问本机工作区;容器化会把这三件事全部切断 |

真实阻塞有两条:**Node 22 前置**(普通用户不会先去装 Node),以及 **GitHub 可达性**(本次在 owner 的 Windows 主机实测:`github.com` 直连超时,而 `nodejs.org`、`registry.npmjs.org`、`registry.npmmirror.com`、Cloudflare 站点均 200;08-26 的 rc.12 Windows 实体门当时能过 GitHub,说明这是网络环境差异,不是包的问题)。

## 2. 渠道裁决

| 渠道 | 裁决 | 理由 |
|---|---|---|
| **一条命令安装脚本**(`curl \| sh` / `irm \| iex`) | **采纳,本批落地** | 消掉 Node 前置(缺失时用户目录内准备官方 Node 22);固定版本 + SHA-256 校验;不需要 sudo/管理员;不改系统 Node;可重复执行;卸载 = 删两个目录 |
| **官网 R2 镜像**(`dl.saydo.octoooo.com`) | **采纳,本批落地** | GitHub 不可达时脚本自动回退;镜像文件与 Release 资产字节全等(上传前 `shasum -c SHA256SUMS`),脚本无论从哪里下载都校验同一个钉住的 SHA-256,镜像不构成第二个信任根 |
| npm registry | 保留,owner 手动发布 | 发布权限/2FA 在 owner 手里;发布后只需在文档加 `npm exec --yes --package @saydo/cli -- saydo up` 一行 |
| Homebrew tap / Scoop bucket | deferred | 各需一个新仓库与 owner 决定命名空间;安装脚本已覆盖同样人群 |
| winget / Mac App Store / MSIX | deferred | 需签名/公证或外部审核,超出本批 |
| 单文件可执行(Node SEA) | deferred | `better-sqlite3`/`koffi` 原生依赖在 SEA 下要另做打包与签名;收益(省掉 Node 下载 ~50 MB)不抵复杂度 |
| Docker | 不采纳 | 见 §1 |
| 把安装脚本放进 GitHub Release 资产 | 不采纳 | `release.yml` 与资产 manifest 合同固定 3 个资产(tgz / SHA256SUMS / release-metadata.json),rc.12 是 immutable Release;脚本改由官网 + 公开仓 main 承载,URL 同样稳定 |

## 3. 脚本行为(两端一致)

0. **只在用户目录内**:安装根目录(`SAYDO_HOME` / `SAYDO_INSTALL_ROOT`)必须位于 `$HOME`(Windows:`%USERPROFILE%` 或可能被重定向到其他盘的 `%LOCALAPPDATA%`)之下,否则在任何 mkdir/下载之前以 `[fail]` 退出;含 `..` 的路径段一律拒绝(POSIX 词法拒绝,Windows 先 `GetFullPath` 消解),POSIX 上再用自带的 `cd -P && pwd -P`(不依赖 `realpath`)按解析后的真实路径复核(symlink 越出同样拒绝;`HOME` 本身是 symlink 如 macOS `/tmp` 时两边同解析、不误拒);确需其他位置须显式 `SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1`。`HOME` 缺失同样在写入前 `[fail]`(Codex 223 A-01/A-02、224 A-01 残留/N-01、225 A-01 残留:无 `realpath` 时的 symlink 越出)。
1. **选 Node**:本机 `node -v` 主版本为 22 → 直接用;否则从 `nodejs.org/dist/index.json` 解析最新 v22,下载对应平台压缩包,按 `SHASUMS256.txt` 校验后解压到 `~/.saydo/toolchain/`(Windows:`%LOCALAPPDATA%\SayDo\toolchain\`)。不改系统 Node、不写系统目录。
2. **下载 SayDo 包**:先试 GitHub Release 固定 URL(连接超时 10 s / Windows 30 s),失败或 `SAYDO_INSTALL_MIRROR=1` 时改用 `https://dl.saydo.octoooo.com/releases/v<ver>/saydo-cli-<ver>.tgz`;两条路径都必须等于脚本内钉住的 SHA-256,否则 `[fail]` 退出。
3. **安装**:`npm install --global --prefix <toolchain>/prefix <tgz>`,依赖(`better-sqlite3`、`koffi`)来自 npm registry;当已回退到镜像(说明 GitHub 不可达)时自动设置 `npm_config_better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3`,否则 `better-sqlite3` 的预构建二进制会去 GitHub 下载而失败。`SAYDO_INSTALL_NPM_REGISTRY` 可覆盖 registry。
4. **启动器**:生成 `~/.saydo/bin/saydo`(Windows:`%LOCALAPPDATA%\SayDo\bin\saydo.cmd`),固定使用第 1 步选定的 Node,不依赖运行时 PATH 上是哪个 node。Windows 批处理按控制台代码页解析(936 / 65001 因机器而异),启动器因此不写任何字面路径:像 npm 的 `.cmd` shim 一样,安装根目录下的 Node 与 `cli.mjs` 都用 `%~dp0..\…`(启动器自身目录)相对引用,文件保持纯 ASCII、与代码页无关;只有 Node 位于根目录之外(如 `C:\Program Files\nodejs`)时才写它的字面路径,含非 ASCII 时按系统 ANSI 代码页写入(Codex 223 A-06;实测非 ASCII 根目录在 936 与 65001 两种代码页下都能启动,见 §6)。
5. **PATH**:默认在 shell 启动文件追加一行带 `# saydo` 标记的 `export PATH`(zsh:`~/.zshrc`;bash:`~/.bashrc` + `~/.bash_profile`;fish:`~/.config/fish/config.fish` 的 `set -gx PATH … # saydo`;其他:`~/.profile`),**整行精确匹配**已存在才跳过(无关注释提到同一目录不算),路径一律加引号(HOME 含空格安全);Windows 把 bin 目录前插到用户级 PATH(`HKCU`,保留原值),不动系统 PATH。`SAYDO_INSTALL_NO_MODIFY_PATH=1` 跳过。(Codex 223 A-03/A-04/A-05)
6. **可选直接启动**:`SAYDO_INSTALL_RUN=1`。
7. 输出只用 `[ok]/[..]/[fail]` 文本标记(零 emoji);`install.ps1` 带 UTF-8 BOM——Windows PowerShell 5.1 以 `-File` 运行无 BOM 的 UTF-8 文件时按 ANSI 解析,中文会破坏字符串终止符(本次实测)。`irm | iex` 依赖响应头 `charset=utf-8`,已在 `_headers` 固定。

安全边界:脚本不收集任何信息、不上传;只在用户目录内写文件;所有下载都校验 SHA-256(Node 用 nodejs.org 的 `SHASUMS256.txt`,SayDo 包用脚本内钉住值);镜像与 GitHub 资产字节全等。

## 4. 版本钉住与刷新纪律

- 脚本内 `SAYDO_VERSION` / `SAYDO_TGZ_SHA256`(`$SaydoVersion` / `$SaydoTgzSha256`)钉住**当前 available 的 Release**。
- 仓内自测 `scripts/test-install-scripts.mjs`(已挂入 `just ci`、`pnpm ci:node`、`.github/workflows/ci.yml` 与 `release.yml` 的 release quality 门)断言:两份脚本钉住同一版本与 digest;下载 URL 与镜像 URL 是固定形态;`e2e/evidence/*-availability.json` 里存在同 tag 的证据、其 `tarballSha256` 与钉住值全等且 `availability` 全部 `available`;`_headers` 对两份脚本声明 `text/plain; charset=utf-8`;`install.ps1` 带 BOM;README 与中英文官网四页都含两个入口;并以 18 个 mutation 自证会红;另有 22 条脚本关键语句的结构不变量(包 digest 校验、安装目标是钉住 tgz、默认根目录、越出用户目录放行开关、PATH 写入/精确匹配/fish、Node 下载校验、启动器路径改写、无 `$MyInvocation`/`-Encoding ASCII`)与 6 项动态无写入检查(`HOME` 缺失、根目录越出 `HOME`、用 `..` 越出、`HOME` 自身含 `..`、以及临时 HOME 内 symlink 越出——分别在带 `realpath` 与 `PATH=/usr/bin` 无 `realpath` 的环境下——都必须在写入前 `[fail]` 且不创建目标目录)。自测不是行为测试:真实安装/启动/停止仍靠两端人工实测(§6)。两份脚本也已加入 `scripts/check-active-claims.mjs` 的 required roots(33 个)。
- **下一个 RC 的刷新点** = availability 翻转提交(rc.12 先例 `410eb84`):实体门通过、`*-availability.json` 落盘后,同一提交里把两份脚本的版本与 digest 改成新 Release,并把新资产上传到 R2 `saydo-releases/releases/v<ver>/`(上传前 `shasum -c SHA256SUMS`)。bump 提交阶段**不改**脚本(新 Release 尚未存在,自测会因缺 availability 证据而红,这是有意的)。
- 旧版本的镜像对象保留(immutable cache),不删除。

## 5. 托管位置

| 物件 | 位置 | 说明 |
|---|---|---|
| `install.sh` / `install.ps1` | `deploy/saydo-octoooo-com/`(Cloudflare Pages 站点根) | 线上 URL `https://saydo.octoooo.com/install.sh`、`/install.ps1`;公开仓 main 同源(`raw.githubusercontent.com` 也可读) |
| `_headers` | 同上 | 两份脚本 `text/plain; charset=utf-8`、`max-age=300` |
| Release 镜像 | Cloudflare R2 bucket `saydo-releases`,自定义域 `dl.saydo.octoooo.com`(zone `octoooo.com`) | 路径 `releases/v<ver>/{saydo-cli-<ver>.tgz,SHA256SUMS,release-metadata.json}`;`Cache-Control: public, max-age=31536000, immutable` |

## 6. 实测证据(2026-09-02)

| 面 | 结果 |
|---|---|
| macOS(Apple Silicon,本机)· 系统 Node 22 路径 | 安装 exit 0 → `saydo status` exit 1(端口空闲)→ `saydo up --no-open` 1 s 内 `/health` `ok:true`(`buildId 0.1.0-rc.12+11036438bc74…`)→ `status` exit 0 attached → SIGINT 1 s 内优雅停止、端口释放、无残留进程 |
| macOS · 无 Node 路径(PATH 只留系统目录) | 脚本从 nodejs.org 下载 v22.23.2 并校验,其余同上,全绿 |
| macOS · PATH 写入 | 在一次性 HOME 上验证:首次写入 1 行、重复执行不重复写 |
| macOS · 强制镜像(`SAYDO_INSTALL_MIRROR=1`) | 脚本走 `dl.saydo.octoooo.com` 下载,SHA-256 通过,安装后 `up`/`/health`(同 buildId)/SIGINT 停止全绿 |
| Windows 10(局域网主机,PowerShell 5.1,本机 Node v22.22.0) · 默认路径 | 首版无 BOM 解析失败(已修);修后正确探测本机 Node 22(修正 PS 5.1 传参丢引号导致的误判);GitHub 下载(该时刻可达)→ 校验 → `npm install` 5 包 → `saydo.cmd status` exit 1 → `up --no-open` 0 s 内 `/health` ok(同 buildId)→ status attached → 写 `runtime/cli-stop-<supervisorPid>` 后 1 s 内优雅停止、端口释放、0 残留 node 进程 |
| Windows 10 · 强制镜像 | 同上,下载源为官网镜像;全绿 |
| Windows 10 · Codex 223 修复后回归 | 非 ASCII 根目录 `C:\Users\<user>\saydo-测试`:安装全绿,启动器纯 ASCII(`%~dp0..\…` 相对引用),在 `chcp 936` 与 `chcp 65001` 两种代码页下 `status` 均返回 `{"kind":"available"}`;越出用户目录的 `C:\ProgramData\…` 在写入前 `[fail]` 且目录未创建;默认根目录 `%LOCALAPPDATA%\SayDo` 安装 → up → `/health` → cli-stop 优雅停止 → 0 残留 |
| macOS · Codex 223 修复后回归 | HOME 含空格 + zsh:写入 1 行、重复执行不重复写、无拆词产生的错误文件;fish:写入 `~/.config/fish/config.fish` 的 `set -gx PATH … # saydo`;rc 里无关注释提到同一目录时仍正确写入;`SAYDO_HOME=/tmp/…` 越出 HOME 在写入前 `[fail]` 且目录未创建;真实安装 → up → `/health` → SIGINT 停止全绿 |
| Windows 10 · GitHub 不可达时的自动回退 | 本会话早些时候该主机 `github.com` 直连超时(`curl` 21 s 无连接),`nodejs.org`/`registry.npmjs.org`/`registry.npmmirror.com`/Cloudflare 站点均 200;自动回退分支按此场景实现;后一时刻 GitHub 恢复可达,故默认路径实测走了 GitHub,回退分支由「强制镜像」用例覆盖 |
| R2 镜像 | `dl.saydo.octoooo.com/releases/v0.1.0-rc.12/saydo-cli-0.1.0-rc.12.tgz` 从 Mac 与 Windows 均 200、1208303 bytes,SHA-256 与 Release `SHA256SUMS` 全等(上传前 `shasum -c` 通过;首次 `wrangler r2 object put` 未带 `--remote` 只写了本地模拟存储,已用 `--remote` 重传并 `--remote` 回读确认) |
| Linux | 未在真实 Linux 主机执行(见 §7) |
| 官网托管形态(Cloudflare Pages preview `preview-crosscheck-20260902`) | `/install.sh`、`/install.ps1` 均 200、`text/plain; charset=utf-8`,线上 bytes 与仓内 SHA-256 全等;macOS 直接 `curl -fsSL <preview>/install.sh \| sh` 全绿;Windows `irm <preview>/install.ps1 \| iex` 全绿——该时刻 GitHub 再次不可达(`基础连接已经关闭`),脚本**自动回退官网镜像**并完成安装(`added 5 packages`;`better-sqlite3` 预构建可能命中本机 prebuild 缓存,npmmirror 分支未单独隔离验证) |

原始日志:本会话 scratchpad 的 `mac-qs-test.log`、`mirror-tests.log`、`win-qs-test2.log`(不入库;关键行已在上表逐字引用)。

## 7. 未做与后续

- npm registry 发布:owner 手动;发布后在 README / 官网 §4.2 加一行 `npm exec --yes --package @saydo/cli -- saydo up`。
- 下一 RC(rc.13):把 PG-01A 收紧后的 console 文案打进包里(rc.12 包内 console 仍是旧文案,官网已是新文案——这是当前唯一的「网站 vs 包」文案差,本方案不掩盖);按 §4 纪律在 availability 翻转时刷新脚本与镜像。
- Linux 真机:脚本的 Linux 分支只经语法与逻辑复核,未在真实 Linux 主机执行(rc.12 的 Linux 覆盖来自 CI 六项 smoke,不是真机);本方案不宣称 Linux 已实测。
- 常驻安装(launchd / systemd / Scheduled Task)与语音 pipeline 仍不在包内,官网文案未变。
