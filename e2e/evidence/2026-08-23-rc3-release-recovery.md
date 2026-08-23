# rc.3 首次运行红灯补救证据

## 1. 范围

- 最终实施边界：`57d3e10511a8ccf3d60bd66bc0ab9bdd9a30a83e`。
- `v0.1.0-rc.2` 保持为失败证据，并按发布纪律不得移动。公开 Actions run `32616479767` 与
  `32616480151` 的首次运行失败，未创建 GitHub Release；本轮不移动标签、不重跑旧 run。
- 新候选为 `v0.1.0-rc.3`。npm registry 不在自动发布范围，仍交 owner 后续手动发布。

## 2. 补救实施

1. `better-sqlite3` 升至 `13.0.3`，pnpm `allowBuilds` 只拒绝该包的冗余隐式构建，
   `esbuild` 与 `koffi` 的必要安装脚本继续放行。
2. Windows `.cmd` 统一使用 `cmd.exe /d /s /c` 外层引号与
   `windowsVerbatimArguments:true`；Windows 子进程不使用 detached 进程组。
3. 管理员 token 新建状态目录时，允许把内置 Administrators owner 在同一次 native ACL
   写入中改归当前用户 SID；SYSTEM 和陌生 SID 继续拒绝，readback 精确核对 owner 与 protected DACL。
4. 分发验证器在全部登记 PID 退出后主动关闭本地 stdio 读端并等待 `close`，之后才进行有限
   `EBUSY` 删除重试；Windows agent inventory 夹具改用标准 npm Node shim。
5. Linux 恢复反例先等待 durable `events.jsonl` 行数再断言；受监管命令终止期的 stdout
   `ECONNRESET` 被显式收口，其它 stream error 仍记录并使命令失败。
6. Playwright 状态根移出仓库与用户名路径；亮暗截图改为持久化主题、重载并断言
   `data-theme` 后才落盘，消除“暗色图实际为亮色”和公开图片泄露本机绝对路径的问题。

## 3. 本机与实体 Windows 证据

### macOS

- `just ci`：exit 0。contracts 111、platform 13、console 278、CLI 20 passed / 1 skipped、
  daemon 1883 passed / 5 skipped、pipeline 34 passed；emoji、颜色、迁移工具和实体发布证据自测全绿。
- `pnpm exec playwright test`：36 passed，耗时 2.7 分钟；11 路由亮暗截图均在主题重载和
  `data-theme` 属性断言后生成。22 张 PNG 均可解码，OCR 扫描未检出本机用户名、`/Users/`、
  `WorkSpace` 或本轮工作树名。
- `pnpm --filter @saydo/cli verify:distribution`：exit 0；Node `v22.23.1`，tarball 17 个成员，
  真安装入口为 `saydo`，重复启动 attach、端口冲突、recovery-only、Tier1 恢复和孤儿回收均通过。
- `node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.3`：exit 0，11 个官网/文档锚均为
  `candidate`。

### Windows 11 实体主机

- 从 Git index 导出的最终评审回修源码归档：`39215979` bytes，SHA-256
  `d6854bb4e47fe6debea072bce07db1033261b9c2c30458b660c80d944a3189cf`；上传后逐字节摘要一致。
- 空源码目录与空安装根：Node `v22.22.0`，pnpm `10.33.1`；frozen install 只执行
  `esbuild` / `koffi` 安装脚本，没有执行 `better-sqlite3` 或 `node-gyp`，SQLite 查询返回
  `windows-sqlite-ok=1`。
- platform：4 files、13 tests passed；CLI distribution：exit 0，tarball 17 个成员，安装入口
  `saydo.cmd`，静态资源 200，readiness 为 core ready / voice absent，same-home attach、other-home
  mismatch、并发与端口冲突、Tier1 `restart_pending -> settled_review`、daemon/agent/后代零孤儿均通过。
- 最终四个阶段标记均为 0：install、SQLite、platform、distribution。

## 4. 发布物候选

- `node scripts/build-release-artifacts.mjs --write`：生成
  `saydo-cli-0.1.0-rc.3.tgz`，`1146345` bytes，17 个成员，SHA-256
  `a0f4e7da0166574b1cfda7792efdd8679a41a704a4b336a2e99beeb70a7f5314`。
- `sourceRevision=baf15c4f1391a5ab2bde63d59b0dd0d12c15301ae201a59bb13140cf06dcfbff`，
  `buildId=0.1.0-rc.3+baf15c4f1391.p1-0-0.cbaf15c4f1391`。
- 随后的 `node scripts/build-release-artifacts.mjs --check` 重新构建并逐成员核对，exit 0，
  bytes、SHA-256 与 sourceRevision 均保持一致。
- 以上仍是发布前本地候选；只有公开不可移动 tag、首次 Actions、GitHub Release 与固定 URL
  六项 smoke 全绿后，官网才能从 `candidate` 翻为 `available`。

## 5. 外部实施与评审记录

- Grok 首轮实施日志 `logs/rc3-grok-implementation.jsonl`：`1921653` bytes，SHA-256
  `5171a10f76afb21611b9dfdfea9d6fd525f01e4d10e05504dedcc6bdd0393764`，终态为 `end_turn`。
- Grok Windows ACL 追加尝试在未改文件前因循环输出终止，exit 130；日志
  `logs/rc3-windows-acl-grok.jsonl` 为 `702824` bytes，SHA-256
  `71ab7a68a124dc88f1ca695612e0bae596dc19362b3a3d8acc8fadcc3f000a16`。该尝试不作为实施通过证据。
- 外部 Codex 108 与独立 session 112 均未产生 final；真实日志摘要与 SHA-256 已记录在
  `research/codex-findings/108-*`、`research/codex-findings/112-*`，不得写成通过。
- `rc3_runtime_review` 对 `23c2251` 首轮判 No-Go：SYSTEM/SYSTEM 会绕过 owner 拒绝、Win32
  `BOOL/LPBOOL` 被错误绑定为 1-byte `bool`、两处系统分配 UTF-16 缓冲未 `LocalFree`。`08b7610`
  已把 SYSTEM 判定前移，所有 Win32 BOOL 统一为 32-bit `int32` ABI，并以原始指针解码后在 finally
  释放；实体 Windows platform 13 项与完整 distribution 复验通过。
- `rc3_release_review` 对 `23c2251` 首轮判 No-Go：实施提交尚未重生 rc.3 bundle，且 rc.2 被误写为
  技术不可移动。证据提交将以最终实施 SHA 重生 bundle；文案已改为“按发布纪律不得移动”。

## 6. 尚未完成

- `v0.1.0-rc.3` tag、公开首次 Actions、GitHub Release、Mac/Windows 固定 URL 复验与官网部署。
- iPhone、Android、HarmonyOS 本轮候选包真机验证；HarmonyOS 仍受设备在线与签名 Profile 约束。
- npm registry、商店发布、Windows system service 与 Linux systemd。
