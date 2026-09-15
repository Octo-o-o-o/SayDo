# rc.13 发布链与官网部署证据(2026-09-15)

owner 2026-09-15 授权:「都按你的建议对应(修 CI 红、发 rc.13、Windows 真机回归),并推送完整更新到两个仓库的 main」。本文件记录从 rc.13 bump 到 availability 翻转、安装脚本刷新、官网 production 的整条链;安装/首启门槛收敛批本身的证据见 `e2e/evidence/quickstart-2026-09-15.md`。

## 提交链(internal main,父 `0f7d67a`)

| 提交 | 内容 |
|---|---|
| `8fb99bd` / `34143ab` | 门槛收敛批 I / E(见 quickstart 证据) |
| `6a9e0aa` | Windows 安装脚本拆 ASCII 引导 + BOM 核心;ci.yml setup-android `packages: platform-tools`;reaper 用例 POSIX 进程组回收 |
| `768ee40` / `7a562fe` | bump 0.1.0-rc.12 → rc.13(候选态措辞、tracked manifest 冻结、release.yml tag)/ 账本 |
| `eed2cf1` / `73ffe64` | version-matrix 记 rc.13 候选(CI `test-mobile-release-contract` 判红)/ 账本 |
| `412338f` | `--verify v0.1.0-rc.13` 证据 `2026-09-15-rc13-release-verify.json` + 账本 |
| `2564ea5` | `--write-availability` 通过:11 处锚翻可用态、实体门四项证据、安装脚本改钉 rc.13、version-matrix available、账本 |
| `216e4dd` | 官网/README 删去「包无 --help / doctor 未发布」的 rc.12 时代说明 |

## CI 红修复

私有归档与公开仓自 2026-09-05 起所有 push 的 `ci` 均红。根因两处,均在 `6a9e0aa` 修:

- `android shell`:`android-actions/setup-android` 缺省 `packages: tools platform-tools`,Google 仓库已下架 `tools` → `Failed to find package 'tools'`。显式 `packages: platform-tools`。
- `node`:`packages/cli/test/emergency-reaper.test.ts`「持锁时不得 unlink」在 ubuntu 容器稳定超时。tsx 会 fork 真正执行 worker 的孙进程,只 SIGKILL tsx 父进程时孙进程成为孤儿继续持锁,waiter 永远拿不到锁;POSIX 上改 `detached` 起进程组并整组 SIGKILL。

私有归档 `ci` run 34928676546(`73ffe64`)首次全绿(9 job);公开仓 `ci` run 34929194125(快照 `3e851cd`)全绿。

## rc.13 Release

| 项 | 值 |
|---|---|
| 公开快照 + tag | `bash scripts/publish-public-snapshot.sh public v0.1.0-rc.13 73ffe64…`:release.yml 全历史零 run、active tag ruleset、隐私探针 scanned=2143 hits=0;原子推送 `3e851cd128714ef2cfe87817c968c1574d5b8d4b` → `public/main` + `v0.1.0-rc.13` |
| release workflow | run 34929194176:snapshot / quality node+python+e2e / 三平台 distribution / publish prerelease / 六项 fixed-URL smoke(mac·win·ubuntu × exec·global)/ mark available 全绿 |
| Release | https://github.com/Octo-o-o-o/SayDo/releases/tag/v0.1.0-rc.13,publishedAt 2026-09-15T04:37:54Z;tgz sha256 `541193d2289831874cf52ac8ef587a0347d07b95daf802802f4ffb1382e80c22`(1244313 B),tracked manifest `docs/release/v0.1.0-rc.13-assets.json`(entryCount 17,contentDigest `f553d9ff…`) |
| `--verify` | `e2e/evidence/2026-09-15-rc13-release-verify.json` |
| `--write-availability` | Mac(本机 Node v22.23.2)exec/global + Windows(ssh owner 私有配置中的局域网 Windows 主机,Node v22.22.0)exec/global 四项 `ok:true`,`e2e/evidence/2026-09-15-rc13-physical/`;`2026-09-15-rc13-availability.json` 11 处 `available` |
| R2 镜像 | 三资产 `shasum -c SHA256SUMS` 通过后 `wrangler r2 object put --remote` 到 `saydo-releases/releases/v0.1.0-rc.13/`(immutable cache);`dl.saydo.octoooo.com` 回读 200,tgz sha256 全等、SHA256SUMS 字节全等 |
| 安装脚本 | `install.sh` / `install-core.ps1` 钉 `0.1.0-rc.13` + 上述 sha256;`test-install-scripts` pinned rc.13,mutations=26 全红 |

## 官网部署(Cloudflare Pages `saydo`,wrangler OAuth)

| 阶段 | 分支 | 部署 | 内容 |
|---|---|---|---|
| preview(拆分脚本回归) | `preview-quickstart-20260915` | `ae38bd97` | Windows 真机 `irm <preview>/install.ps1 \| iex`(有 Node 18 s / 无 Node 强制镜像 15 s)全绿 |
| preview(rc.13 可用态) | `preview-rc13-20260915` | `cea70169` → `b3740ccb` | 四页 200;三脚本 SHA 与仓内全等;可用态锚 zh/en 各 1;`rc.12` 残留 0;`cli failed` 残留 0;Mac 隔离 HOME 从 preview 装 rc.13 → `help`/`doctor`/`--no-open` 提示如预期;Windows 从 preview 装 rc.13 → `help`/`doctor` 正常 |
| production | `main` | `9063b77c`(commit `216e4dd`;上一 production `3d6328bb`/`8fb99bd`)| https://saydo.octoooo.com:`/ /en/ /docs/ /en/docs/` 200(本机 curl 两次 `SSL_ERROR_SYSCALL` 瞬断,重试 200);`install.sh`/`install.ps1`/`install-core.ps1` 线上 SHA-256 与仓内全等(`224b3834…`/`b290713a…`/`eb13b99c…`);可用态锚 zh/en 各 1;`rc.12`/`cli failed` 残留 0;Mac 隔离 HOME 与 Windows 真机(ssh)各从线上 `install.sh`/`irm install.ps1 \| iex` 装到 rc.13,`saydo help` 正常,Windows 测试目录清理后无残留 |

## not_run / 如实登记

- `saydo-link` 站未改动未重部署。
- Linux 仍只有 CI 六项 smoke(非真机)。
- 本文件与 journal R164 在 production 部署后追加提交(evidence 提交不自指);本批无独立零上下文评审(owner 直接授权路径);Windows 真机回归由实施者经 ssh 执行。
- CI 红修复的 ubuntu 结果以私有/公开 CI 绿为证;reaper 用例根因判断(tsx 孙进程孤儿)基于 Linux 进程语义推断 + CI 绿,未在容器内单独复现。
