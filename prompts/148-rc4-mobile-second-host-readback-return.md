# RC4 移动端第二次主会话 readback 退回

你是原移动端实施会话。只在当前 worktree 修复，不提交、不推送、不发布、不部署，不改无关文件。继续遵守原计划、仓库 AGENTS.md 与本会话既有约束；禁止 subagent。

## 本轮可判定验收目标

### M1 单一共享 pairing corpus 必须被三端真实执行

当前 `scripts/test-pairing-url-corpus.mjs` 只用 Node reference parser 执行 JSON，再用 `corpus:<id>` 注释字符串证明原生测试“覆盖”。这不能证明 Android/iOS/Harmony 的 parser 真正执行同一组输入；注释存在即可假绿。

要求：

1. 保留一个 canonical corpus SoT，但生成三端可编译的 fixture；三端各自的原生测试必须遍历该 fixture 的每一个 case 并调用真实 parser，断言 accept/reject、token、name。
2. 生成器/门禁必须在内存生成期望 fixture 并逐字节核对已提交 fixture，检测漏 case、重复 id、篡改输入/期望、陈旧生成物；不得退回 grep/注释标记。
3. corpus 与生成 fixture 不得静态包含完整 RFC1918/ULA 地址。将输入和期望地址拆成 segments/parts，测试运行时拼接；这既测试真实私网地址，又能通过公开树隐私门禁。
4. 覆盖 ASCII trim、BOM/NBSP、raw `@`/空白/括号/NUL/non-BMP、合法 percent UTF-8（BMP/non-BMP）、非法/截断/overlong/surrogate UTF-8、duplicate token、userinfo/fragment。三端行为必须一致。
5. 在本机能运行的原生测试必须真实运行；不能运行的 runner 必须如实报告，不得用 Node reference 自测替代原生执行证据。

### M2 Android 工具链与身份校验确定化

1. `apps/android/gradle/wrapper/gradle-wrapper.properties` 为 Gradle 8.11.1 bin 增加官方校验值：
   `distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6`
2. `android_first_build_tool` 目前 glob 重复且按文件系统顺序取首个版本。改为跨 macOS/Linux 可重复地选择最高合法 build-tools 版本；显式 `SAYDO_APKSIGNER` / `SAYDO_AAPT2` 仍优先。增加多个乱序假版本的测试。
3. `aapt2 dump badging` 的 `versionName` 必须结构化/精确提取后与工程值做字符串相等比较；禁止把未转义版本放进 grep regex。applicationId 同样精确比较。
4. 假工具测试必须证明错误签名、错误 package、近似/regex 欺骗 version、旧 build-tools、模拟器/查询失败都会 fail-closed。

### M3 Harmony 验证不得输出 profile 内容

当前 `verify-profile` 未传 `-outFile`，官方工具会把 verification result 和 profile 内容输出到 console，可能包含设备信息。

要求：

1. `verify-app` 与 `verify-profile` 的 stdout/stderr 均重定向到权限受限的临时目录，不把原始输出回显。
2. `verify-profile` 显式传 `-outFile` 到临时文件；验证输出文件为普通非 symlink、非空、大小有上限，并按实际格式结构化解析到足以证明成功。失败只给稳定摘要。
3. fake verifier 测试必须精确断言 `verify-app -outCertChain -outProfile`、`verify-profile -inFile -outFile` 参数与顺序/目标，证明 profile 正文和唯一敏感片段不会出现在 stdout/stderr。
4. 若 target-id 合同刻意限定 USB 风格字符集，在 README 明确说明 USB 真机目标，不暗示支持含冒号的网络 target；诊断文本、模拟器与 probe 失败仍必须拒绝。

### M4 文档与公开隐私一致

继续保持官网只声明“移动浏览器通过 LAN dogfood 可用”；三个原生 shell 是开发候选、当前没有公开真机包下载。Harmony 的 `12/12` 只能标为 implementation self-report/unverified。所有新增 corpus/fixture/测试均须通过公开树隐私扫描。

## 必跑门禁

逐条运行并记录真实退出码与摘要：

```text
node scripts/test-pairing-url-corpus.mjs
node scripts/test-mobile-installers.mjs
node scripts/test-mobile-release-contract.mjs
pnpm --filter @saydo/android test
本机可用的 iOS 单元测试命令
本机可用的 Harmony 单元测试命令（不可用则给原始阻塞证据）
node scripts/check-emoji.mjs
pnpm typecheck
pnpm lint
git diff --check 70622677bad97b04aa8d8ffb23328576ef639e55 --
```

若当前分支已包含公开树隐私脚本，也对当前候选树运行它；若尚未集成，则至少用等价扫描证明新增文件无完整 RFC1918/ULA/本机路径/设备标识。完成后只报告改动文件、关键设计、逐条门禁退出码、剩余风险；不要宣称移动真机验证或发布完成。
