# RC4 发布线独立 readback 首次红灯返工

你是原实施会话，继续在当前 worktree 施工。独立只读评审对 prompt 168/172 给出 No-Go；这是本轮首次红灯，必须只修下列确定性问题，不提交、不推送、不联网、不发布，不改无关文件。

## P1-1：匿名 stdin inode 必须被真实证明

当前 `bindHelperStdinFd` 写后只 `unlink(filePath)`，路径若被 rename/replacement，删除的可能不是创建时 inode；现有测试还在 `afterUnlink` 主动删 sidecar，掩盖了问题。

验收：

1. 交给 spawn 前，同一个创建时 fd 必须经 `fstat` 证明 `dev/ino` 不变、普通文件、owner-only、uid 合法、size exact，并且 `nlink === 0`。
2. 优先采用打开并校验空文件后立即 unlink、确认该 fd `nlink === 0`，再通过同一 fd 定位写入的顺序，从根上消除敏感 bytes 的命名窗口；若采用其他顺序，也必须达到等价且可证明的性质。
3. unlink 失败必须在写入敏感 payload 前安全失败；任何失败不得 spawn。
4. rename/replacement 确定性注入不得由 hook 在断言前删除原 sidecar。应证明该情形不可能被接受，且 `spawnCalls === 0`。正常路径必须证明 spawn 收到创建时 fd、`nlink === 0`、从 byte 0 读取 exact JSON。
5. 所有失败路径都只能返回既有通用失败，不得泄漏路径、payload 或注入 sentinel。

## P1-2：close 异常必须 fail-closed

当前 spawn 后 `closeQuietFd` 吞掉 close 异常，仍可能接受 helper 成功信封。

验收：

1. spawn 后交付路径必须记录 close 是否成功；close 抛错后不得接受任何 `ok:true` 或 helper 语义结果，只能返回既有通用失败。
2. close 恰好尝试一次；spawn 抛错时仍尝试 close；原始 close 错误文本不得逸出。
3. 增加确定性用例：spawn 返回合法成功、close 实际关闭后抛错；lower-level 安全失败，并经公共 claim/read/persist/lease 入口分别验证既有安全结果，零 mutation。

## P2：失败元组必须是独立、精确的 op 矩阵

不要再把 `OPEN_NOT_REGULAR` 整组 spread 到四个 op。合法矩阵必须精确为：

- claim 9：`PATH_ILLEGAL/{无 code,OPENAT_UNSUPPORTED,ENOENT,EEXIST}`；`NOT_REGULAR/{ELOOP,ENOTDIR}`；`READ_FAILURE/{无 code,EACCES}`；`CLAIM_FAILURE/无 code`。
- read 9：`PATH_ILLEGAL/{无 code,OPENAT_UNSUPPORTED,ENOENT}`；`NOT_REGULAR/{ELOOP,ENOTDIR,ENXIO}`；`READ_FAILURE/{无 code,EACCES}`；`OVERSIZE/无 code`。
- persist 12：`PATH_ILLEGAL/{无 code,OPENAT_UNSUPPORTED,ENOENT}`；`NOT_REGULAR/{ELOOP,EISDIR,ENOTDIR,ENXIO}`；`READ_FAILURE/{无 code,EACCES}`；`REFUSE_NON_REGULAR/ELOOP`；`LEASE_LOST/无 code`；`WRITE_FAILURE/无 code`。
- lease 9：`PATH_ILLEGAL/{无 code,OPENAT_UNSUPPORTED,ENOENT}`；`NOT_REGULAR/{ELOOP,ENOTDIR,ENXIO}`；`READ_FAILURE/{无 code,EACCES}`；`LEASE_LOST/无 code`。
- `EIO` 保留在负例 universe，但不得出现在任何合法表。

测试 fixture 必须独立写出期望矩阵，不能从生产 `ANCHORED_FAILURE_TUPLES` 自举。应固定断言：`claim=9 read=9 persist=12 lease=9 cross-exclusive-reject=25 cross-shared=92 cartesian-reject=281`，并保持公共入口零 mutation。

## P3：清理非便携 warning

修正测试中以 `XXXXXX` 结尾传给 Node `mkdtempSync` 的模板，消除 5 次门禁中的 portability warning，不降低测试强度。

## 门禁

至少运行：

1. `node scripts/test-release-provenance.mjs` 连续 5 次，全部物理 exit 0，且输出上述精确矩阵计数、无 portability warning。
2. `node scripts/test-release-physical-evidence.mjs`。
3. `pnpm typecheck`。
4. `pnpm lint`。
5. `node scripts/check-emoji.mjs`。
6. `node scripts/check-doc-links.mjs`。
7. `git diff --check`。
8. `actionlint .github/workflows/ci.yml`。

只报告真实改动、真实命令与真实 exit；沙箱限制导致的失败须明确标注，不能写成宿主机绿证。
