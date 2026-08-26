# RC4 移动线独立 readback P2 返工

你是原实施会话，继续在当前 worktree 施工。独立只读评审确认产品路径为正，但发现 Linux 原子交换测试是假覆盖；只修这一项及直接相关测试，不提交、不推送、不联网、不发布。

## 问题

`scripts/test-mobile-release-contract.mjs` 的 Linux `renameat2(..., flags=1)` 使用了 `RENAME_NOREPLACE`，并非 `RENAME_EXCHANGE`。Linux 定义为 `RENAME_NOREPLACE=1`、`RENAME_EXCHANGE=2`。目标已存在时 flag 1 返回 `EEXIST`，使当前所谓 atomic exchange 分支始终回落为顺序 rename。

## 验收

1. 使用正确的 `RENAME_EXCHANGE=2`，不要以魔法数字含混表达；为常量名称和数值增加可判定回归。
2. Linux 可用时必须证明真实调用成功并走原子交换分支，不能把 `EEXIST` 或其他失败静默当成已覆盖；若内核/文件系统确不支持，只能显式记录为 unavailable/fail-closed，不能把顺序 rename 计为 atomic exchange 通过。
3. 测试必须证明两个已存在路径的内容或 inode 被交换，并保持原有产品路径安全回归。
4. 运行 `node scripts/test-mobile-release-contract.mjs`，并保留 pairing/installers、typecheck、lint、emoji、doc-links、diff-check、actionlint 门禁。
5. 如可在现有离线 Linux arm64 环境执行，再跑一次真实 Linux release contract，记录平台、命令、exit 和 atomic exchange 的真实分支输出；不可用就诚实标注，宿主机门禁由主会话补跑。

## 同轮补充 P2：root 下不可读测试不稳定

独立评审还确认 `scripts/test-mobile-release-contract.mjs` 当前以 `chmod(000)` 假设目录一定不可读；Linux UID 0 仍能读取，完整门禁实际为 200/202、exit 1，随后另一个失败是收尾状态级联。

6. 把该反例改为不依赖调用用户权限的确定性失败注入或受控对象类型，必须在 macOS、Linux 非 root、Linux root 下表达同一 fail-closed 合同。
7. Linux root 与非 root 的完整 `test-mobile-release-contract.mjs` 都必须 202/202、物理 exit 0；异常用例还必须证明 cwd 与 FD 均被恢复，不能只让断言消失。

只报告真实改动和真实门禁结果，不改产品实现，不扩大范围。
