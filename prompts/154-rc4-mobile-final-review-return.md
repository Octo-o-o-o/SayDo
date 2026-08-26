# RC4 移动端最终独立复审退回

你是本轮移动端原实施会话。独立零上下文评审对
`70622677bad97b04aa8d8ffb23328576ef639e55..fc6bef39931f82d4b620906736edef58da0b66d9`
的 31 文件完整审查判定 No-Go。请继续在当前 worktree 修复；不得降低真机门、缩小语料、删证据或
把失败改写成说明。不要 commit、push、release、deploy，不调用 subagent。

## P1 必修

1. iOS 在原始 authority 校验前交给 Foundation `URL(string:)`，会把 5 类全角数字、全角/表意
   句点、圈号数字、authority 内 U+200B 归一为 ASCII 私网 IPv4 并接受；Android/Harmony 按原始
   ASCII authority 拒绝。Foundation 解析前先对原始 URL authority 做 ASCII-only、无控制/格式字符、
   无 Unicode 兼容归一化的语法校验。将评审 222-case 差分中的 5 类加入 canonical corpus 与三端原生
   fixture，三端必须同判拒绝；不得只修 iOS 测试适配器。
2. `scripts/mobile-install-common.sh` 的安全删除只检查最终项，不检查父目录链。`.build` 或 Android/
   Harmony 任一固定产物父目录为 symlink 时可把 `rm -rf` 导向仓外。删除前逐级拒绝 symlink，并以
   realpath/物理锚保证候选始终位于真实 `SCRIPT_DIR`/登记构建根内；父级 symlink 时写入/删除前失败，
   外部 sentinel 必须存活。覆盖 iOS、Android、Harmony 三端与最终项 symlink 既有用例。
3. `e2e/evidence/2026-08-22-mobile-shells-device-build.md` 含三类设备标识、private file URL 和真实
   个人 home 路径，却声称不记录标识。改为设备数量/稳定摘要、`$HOME`/`<repo>` 等不解析到个人的
   占位；对全文做类别扫描。扩展 mobile release contract/隐私门禁覆盖 evidence 与相关 docs，失败
   输出也不得回显敏感值。

## P2 必修

4. Android 查询 `ro.kernel.qemu` / `ro.boot.qemu` 后只搜索单词，值 `1` 可绕过。任一 qemu flag
   为非空且非明确安全零值就 fail-closed；增加“只有 qemu=1、其余属性像真机”的用例。
5. Harmony 仅按 model 文本不能证明物理设备。使用本机/SDK 可取得的权威 device-type/emulation
   属性组合；任一信号指向 emulator 拒绝，权威信号缺失、未知或相互矛盾也 fail-closed。不要凭普通
   model 名放行；补可达、普通 model、但缺权威真机证明的拒绝用例。不得硬编码具体设备 ID/型号。
6. iOS `codesign --verify` 后还必须从最终 `.app/Info.plist` 读取并精确比对
   `CFBundleIdentifier=com.octoooo.saydo`、`CFBundleShortVersionString=0.1.0` 和预期
   `CFBundleVersion`（以 project canonical 值为源，避免双写漂移）。签名有效但任一身份/版本错误必须
   在安装前拒绝；fake xcodebuild 需生成 plist，增加三字段各自错误的测试。
7. Harmony evidence 的 13/13 必须明确标成“cached-exact 依赖环境”；fresh clone 当前因
   `@ohos/hypium`/OhmUrl 解析失败 exit 255、无测试计数，不能表述成 fresh reproducibility。

## P3 固定性

- 审查 `.github/workflows/ci.yml` 中 `*-latest`、Node 仅 major、未固定 xcodegen。能用 GitHub 支持的
  版本化 runner/精确 tool version 且不分叉项目 SoT 的直接固定并加 readback；无法真正 immutable 的
  明确保守描述，不能声称完全固定。不要为了这一项引入未经验证的自托管依赖。

## 必跑验证

```sh
node scripts/test-pairing-url-corpus.mjs
node scripts/test-mobile-installers.mjs
node scripts/test-mobile-release-contract.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
node scripts/check-doc-links.mjs
git diff --check 70622677bad97b04aa8d8ffb23328576ef639e55 --
```

并运行三端原生门：Android unit 与 build-only + `apksigner`/`aapt2` identity；iOS 两套 XCTest；
Harmony 在当前 cached-exact 环境跑 `hvigorw test --no-daemon`，若 fresh hydrate 仍红必须如实保留。
另加并回报：222-case 三端差分 0 mismatch、父 symlink 三端外部 sentinel 全存活、Android qemu=1
拒绝、Harmony 缺权威真机证明拒绝、iOS 三种签名有效但身份错误均拒绝、evidence 隐私命中 0。

完成后给出每项 finding 到代码/测试映射、改动 exact-set、真实计数与退出码。任何命令在 Grok
workspace sandbox 因设备/宿主权限失败要和产品失败分开报告，主会话会在宿主重跑。
