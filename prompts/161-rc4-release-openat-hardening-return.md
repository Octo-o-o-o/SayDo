# RC4 发布状态机：openat 与 hostile public API 最终加固返工

继续原 implementation session，只修改当前 worktree；不要 commit、push、联网、发布、部署或调用 subagent。

上一轮已完成主状态机大部分修复，但主机会话逐行复核确认以下红灯仍真实存在。必须根因修复并以公共入口回归，不得只加静态字符串断言。

## P1：hardlink 可把证据持久化变成树外覆盖

`release-openat-posix.py` 对 read/lease/persist 只检查 regular file，不检查 `st_nlink`。
如果既有 evidence 是指向树外普通文件的 hardlink，`persist` 会在同 inode 上 `ftruncate`，从而覆盖外部 sentinel。

要求：claim/read/lease/persist 的有效 evidence identity 必须是单链接常规文件；至少在任何读取可信 identity、租约确认和 truncate 之前都检查 `st_nlink == 1`。hardlink（包括获取租约后再增加链接）必须 fail-closed，外部 sentinel 字节不变。增加真实 filesystem 公共入口回归。

## P1：parent symlink 策略仍可连续跟随

`open_anchored()` 在 `strict == false` 时遇到 symlink 会 follow，却没有在 follow 后进入 strict；因此 root 后可连续跟随多个 symlink。仅为 macOS `/var`、`/tmp` 这类不可由普通用户改写的第一层系统别名保留最小兼容：最多允许第一个 path component 为 symlink，跟随后立即进入 strict；之后任何 parent symlink 一律拒绝。若能以更窄、跨平台且不破坏真实 `tmpdir` 的方式实现，优先更窄方案。增加“允许本机真实 temp root”与“第二个 parent symlink 拒绝、outside 从未创建/读取/改写”的公共入口回归。

## P1：无界 read 与身份精度

1. read 在循环前用 `fstat.st_size` 限制证据最大字节数，并在读取过程中再次严格累计，避免 sparse/增长/竞态绕过。上限须由 Python/Node 同一合同常量验证，超限稳定拒绝，不能 OOM。
2. `st_dev/st_ino` 不得作为 JSON number 越过 JS 安全整数。Python 以规范十进制字符串返回，Node 严格验证非空十进制、长度上限，并以字符串原样送回；Python 严格解析与比较，拒绝 bool、负数、前导符号、指数、超长或额外字段歧义。回归覆盖大于 `Number.MAX_SAFE_INTEGER` 的模拟结果，以及非法 identity 在任何 mutation 前拒绝。

## P1：claim crash durability

新建 claim 已 `fsync(file)`，但未同步包含该目录项的 parent directory。directory-handle primitive 必须在成功创建和写完 claim 后对仍锚定的 parent dir fd `fsync`，且 parent fsync/close 失败均不能返回 fresh lease。不要通过重新按 pathname 打开父目录完成。回归以注入/最小 helper hook 验证失败时不返回 fresh；已创建 claim 不得被危险删除。

## P1：公共入口 hostile Proxy/转换

1. `replaceRegularFileInPlace()` 当前在 try 外执行 `io?.anchored?.persist`，revoked/getter Proxy 可让原生错误逸出。用 own-data descriptor/稳定选择器，仅接受明确 own data callable；未知/hostile 一律新建受控常量错误。
2. `anchoredIo(io)` 当前展开 `{ ...io.anchored }`，会执行 getter/ownKeys；不要 spread 不可信注入对象。逐个以 own data descriptor 读取 `claim/read/persist/lease`，缺项用 default，hostile stable-fail。
3. 导出的 `parseWranglerDeploymentUrl(output, canonicalHost)` 仍直接 `String(output)`；hostile `Symbol.toPrimitive`/revoked Proxy 必须被转换为新受控常量，不能泄漏引擎文本或对象身份。
4. 回归必须直接调用上述公共入口，并覆盖 getter Proxy、ownKeys Proxy、revoked Proxy、throwing `Symbol.toPrimitive`；断言攻击文本、原对象、V8 Proxy 文本均不逸出。

## 其他正确性

- helper 输出只允许一个 JSON 对象；Node 校验 `spawnSync.error`、signal、status、stdout 大小/尾随垃圾，任何异常 fail-closed。
- helper request/result 字段使用 exact allowlist，避免相似字段或 getter 模拟；不打印真实路径/secret。
- 不放宽状态机任何外部动作前的 lease 约束，不恢复 pathname fallback，不改变 Cloudflare 实际部署语义。

## 必跑门禁

1. `node scripts/test-release-provenance.mjs`
2. `node scripts/test-release-physical-evidence.mjs`
3. 在只物化真实目标文件的干净 fixture 运行 `node scripts/week-audit.mjs --check-bundle`
4. `pnpm typecheck`
5. `pnpm lint`
6. `node scripts/check-emoji.mjs`
7. `node scripts/check-doc-links.mjs`
8. `git diff --check`

最终如实列出各 exit code，并单列：hardlink outside sentinel、第二 parent symlink outside、oversize read、large identity、parent-dir fsync failure、四类 hostile API 各自的零泄漏结果。
