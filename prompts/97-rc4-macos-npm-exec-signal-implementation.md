# RC4 F108 macOS `npm exec` 终止信号实施单

## 1. 已验证问题

候选提交 `b92b0ea39e99537c88a25baed56d0a8c3b772c01` 的本地 tarball 通过

```text
npm exec --yes --package=<local-tarball> -- saydo up --home <temp-home> --port 64124 --no-open
```

在 macOS 前台成功启动，`status`、`/health`、`/readyz`、Web 根页与 SQLite 均正常。但终端只输入一次
`Ctrl+C` 时，前台进程立即输出：

```text
[fail] daemon shutdown forced by repeated signal
```

随后 `saydo status` 为 `available`、端口监听为 0、无遗留进程。由此可判定数据清理成功，但用户可见语义和
`README.md` / `packages/cli/README.md` 的“按 Ctrl+C 优雅停止”合同不成立。Windows 相同字节包此前单次
`Ctrl+C` 可优雅退出，问题集中在 Unix 终端进程组与 `npm exec` 包装层对同一次按键的瞬时重复传播。

## 2. 范围与约束

- 只修改 CLI supervisor 的信号排队实现及其直接测试；除非测试证明必要，不改 daemon 关停协议、发布文案或其他模块。
- 同一种 OS signal 在一个短而有界的去重窗口内重复到达时，只排队一次；窗口必须足够短，且常量和语义可测试。
- 不同 signal 不得互相吞掉。
- 超过去重窗口后再次收到 signal，仍必须进入既有 repeated-signal emergency stop 路径。
- `cli-stop-*` 文件触发的显式控制原因仍按既有合同工作，不得因 OS signal 去重而丢失。
- 保持改动小而聚焦，不提交、不改现有证据文档、不清理工作区。

## 3. 验收标准与门禁

1. 新增确定性单测，至少覆盖：
   - 同一种 OS signal 的瞬时重复只产生一个队列事件；
   - 不同 signal 都保留；
   - 超过去重窗口的同种 signal 仍产生第二个事件；
   - 既有 `consumeCliStop` 合同不回归。
2. `pnpm --filter @saydo/cli typecheck` 退出 0。
3. `pnpm --filter @saydo/cli test` 退出 0。
4. 由主会话重建 tarball 后，真实 macOS `npm exec ... saydo up` 单次 `Ctrl+C` 必须：
   - 不出现 `forced by repeated signal`；
   - supervisor 退出 0；
   - daemon 输出与请求 reason 对应的优雅停止；
   - `status` 为 `available`、监听为 0、无匹配遗留进程。
5. 主会话随后重跑 `just ci`、Windows 快速启动与跨平台发布门禁。

## 4. 交付要求

直接实施并运行第 2、3 项门禁。最终只报告真实修改文件、设计理由、命令与原始结果摘要；不要 commit。
