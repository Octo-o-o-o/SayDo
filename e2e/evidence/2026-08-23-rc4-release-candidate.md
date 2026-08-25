# rc.4 发布候选跨平台证据

## 1. 边界与提交

- 基线：内部 main `8602c7324844ede014c577409ae10a834f1a1714`。
- F106/F107 实施：`951249e696afdb38c2c9cb8e4de8b0a26e828f3c`。
- Windows 测试夹具修正：`b92b0ea39e99537c88a25baed56d0a8c3b772c01`。
- F108 CLI signal 修正及最终实施边界：`b768089585d710255d61a693c2489ccf425f446f`。
- 本文与生成账本是证据载体，不进入 implementation boundary，避免 SHA 自引用。

## 2. 文档与实施对账

| finding | 文档合同 | 实施与测试 | 判定 |
|---|---|---|---|
| F106 | 跨平台 checkout 与 source revision 必须同字节 | `.gitattributes` 固定 LF，build 输入纳入该文件；Windows `core.autocrlf=true` 全新 checkout 验证受控源码 CRLF=0 | [ok] |
| F107 | 活动期 pipe 错误失败，收口期 reset 与明确丢弃 pipe 有界消费 | agent、BYOA、受管命令与 runtime wrapper 共用收口判定；Mac/Linux/Windows 回归覆盖 | [ok] |
| Windows 夹具 | 测试必须调用真实受支持 shim 并按平台读真实 basename | Windows 使用标准 npm Node `cmd-shim`，Claude gate drift 读取实际脚本 basename | [ok] |
| F108 | `npm exec` 单次 `Ctrl+C` 必须优雅停止，同时保留真正二次 signal 的 emergency stop | 同种 OS signal 50ms 去重；不同 signal、显式控制原因和窗口后第二次 signal 不吞；四个边界测试加 Mac 真机 | [ok] |

没有发现需要 owner 在“改文档”与“改实施”之间裁决的剩余冲突：F106/F107/F108 都是现有发布与退出合同
强于旧实现，方向可判定为对齐实施到合同。

## 3. 最终发行物

- 文件：`saydo-cli-0.1.0-rc.4.tgz`。
- 字节数：`1146972`。
- SHA-256：`d4ac2e2866a7ffb5191a8d4c3cea97b8581a7ecbe8380f698b42f661a1eb370e`。
- 成员：17 个普通 0644 文件；两次隔离 `npm pack` 字节一致。
- source revision：`043c335d6e6f6f5a293aa2b04a1c7282ff594a5f3249aceb3c60c126f93066b9`。
- build ID：`0.1.0-rc.4+043c335d6e6f.p1-0-0.c043c335d6e6f`。
- `build-release-artifacts --write`、`--check` 与 `post-release-gate --check-candidate` 均 exit 0。

## 4. macOS

- 最终 `just ci` exit 0：contracts 111、platform 13、CLI 24 passed/1 skipped、console 278、
  daemon 1885 passed/5 skipped、pipeline 34；lint、typecheck、emoji、颜色、迁移与实体发布证据自测同绿。
- 完整 Playwright 在 UI 最终实现 `951249e` 后为 36/36 passed，耗时 2.7 分钟；其后只改 Windows
  测试夹具与 CLI supervisor，没有改 UI 或截图资产。
- 最终 tarball 经真实 `npm exec --yes --package=<local-tarball> -- saydo up --no-open` 启动：
  status=`attached`，`/health` ok，`/readyz` coreReady=true、voiceReady=false、reason=`pipeline_absent`，
  console HTTP 200，SQLite 存在。
- 单次 `Ctrl+C` 输出 `daemon stopping reason="cli_sigint"`，前台 exit 0；随后 status=`available`
  （该命令合同 exit 1）、监听为 0，记录的 supervisor/daemon PID 存活数为 0。

首次真机尝试曾暴露 F108：同一次按键输出 `daemon shutdown forced by repeated signal`，虽零遗留但不符合
优雅停止合同。该红灯保留为问题来源，不计入通过；`b768089` 后的最终复验才是上段绿证据。

## 5. Linux

- Debian `node:22-bookworm` 独立容器，Node `v22.23.2`、pnpm `10.33.1`。
- F107 后 daemon 全套 1883 passed/7 skipped，无 Vitest unhandled `ECONNRESET`。
- 最终 runtime-child + tier1-executor：2 files、111/111 passed，exit 0。
- 最终 CLI：typecheck exit 0、24 passed/1 skipped；distribution exit 0，17 个成员、同一 source/build
  identity，static HTTP、recovery-only、owner/attach、Tier1 restart/resume 与零孤儿全绿。
- 该证据不等同 Linux systemd 常驻安装；rc.4 只承诺前台包。

## 6. Windows 实体主机

- 通过 owner 私有 SSH 锚连接；公开证据不记录地址、用户名或 known_hosts 路径。
- Windows 10，Node `v22.22.0`、pnpm `10.33.1`。最终 Git bundle 为 `52371974` bytes、SHA-256
  `995c87981906e6a762e6417e83805752d9e5e8969def8b9a773568b331ca04c0`；传输前后摘要一致。
- 以 `core.autocrlf=true` 全新 Git checkout，HEAD 精确为 `b768089585d710255d61a693c2489ccf425f446f`，
  status 0 行；`supervisor.ts` CRLF=0，目标文件属性为 `text:auto` + `eol:lf`。
- 空 `node_modules` frozen install exit 0，安装后 status 0 行。最终 CLI typecheck、24 passed/1 skipped、
  distribution 均 exit 0；安装入口为 `saydo.cmd`，source/build identity 与 Mac/Linux 相同。
- daemon 最终代码边界 `b92b0ea` 下，临时修正 SSH token 默认 owner 后运行 runtime-child +
  tier1-executor：2 files、111/111 passed，exit 0。修正仅作用于该 PowerShell 进程 token，不改系统 ACL。
- 最终 tarball 传输前后同为 `1146972` bytes 与
  `d4ac2e2866a7ffb5191a8d4c3cea97b8581a7ecbe8380f698b42f661a1eb370e`。真实前台启动后 status attached、
  health ok、coreReady=true、voiceReady=false、localhost console 200、IP host canonical redirect 308、
  SQLite 存在。单次 `Ctrl+C` 输出 `daemon stopping reason="cli_sigint"` 且 SSH 前台 exit 0；随后
  status available、监听 0、daemon PID false、supervisor PID false、匹配进程 0。

第一次 Windows 定向测试在测试 setup 前因 SSH token 新对象默认 owner 为 Administrators 停止；同一进程
临时改默认 owner 后跑出 109/111，两个红灯分别是自写 `.cmd` 夹具不受支持和硬编码 `.sh` basename。
二者修正为标准 shim 与平台 basename 后 111/111。前两次失败不计入通过，但保留了修正因果链。

## 7. 评审与发布状态

- Grok F108 实施日志：`1504789` bytes，SHA-256
  `cadac83a2881a3fd3715524111fb9ae8e2c37f9e080a469de7ba3e8e5b511793`，`stopReason=end_turn`。
- 外部 Codex 108/112 早先两次均未产出 final；对应字节数与摘要见总报告，不能写成 Go。
- rc.4 两路新的零上下文最终评审与本次实施后的外部 Codex 交叉 review 尚未运行；运行前不推送。
- GitHub tag、首次 Actions、Release、固定 URL、availability 与官网部署尚未执行；本地 tarball 结果不能
  冒充线上字节结果。

## 8. 尚未自动替代的边界

1. W5.4-c 真 Claude hooks/live conformance。
2. 四场真人语音体验、S3 真人过卡与主观听感。
3. Windows Scheduled Task、Linux systemd、Windows 通知/SAPI TTS。
4. HarmonyOS 签名 Profile 与离线设备；iPhone/Android/HarmonyOS 结果须在发布后按真实设备状态续写。
5. npm registry 与三家移动商店发布。

## 9. 发布证据防护回修

- 本节描述的目录句柄锚定、owned error 不可变快照、状态机 catch 隔离与 tracked-only
  publication 仍是未提交 worktree 回修，**待主会话完成代码提交后再用真实新 SHA 回写**。
  不得把旧 SHA `85c9a51` 当成已覆盖本轮补丁的证据。
- 当前结论：独立评审与主会话探针仍曾对 parent-swap TOCTOU、owned error 重放、
  persistFailed Proxy 与 untracked prompts 冻进 bundle 判红；本轮按这些红灯改代码，
  通过情况以主机门禁实际退出码为准，不在此预先写成已发布。
- tag、Release、正式部署继续等待独立评审和集成门禁。
