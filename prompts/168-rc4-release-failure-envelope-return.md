# RC4 发布安全：失败信封按 op 精确约束返工

继续原 `grok-4.6` 发布实施会话，只修改当前 `<repo>` worktree。不要 commit、push、发布、部署、联网或启动 subagent；不要修改用户原始 dirty worktree。

零上下文独立复审已确认上一轮有界写入与成功信封的大部分修复，但发现 1 个 P1，因此当前仍是 No-Go。

## 已验证 P1

`viewAnchoredResult(result, op)` 的成功信封按 op 精确校验，失败信封却只用全局 `CONTROLLED_ERRORS` / `ALLOWED_CODES` 并集。于是 `read` 会接受一个属于其他操作语义的 `LEASE_LOST + ENOENT` 组合；`readDeployEvidenceFile` 随后只看 `code === ENOENT`，错误返回 `evidenceFileExists:false`，没有 fail-closed。

独立公共入口最小复现为：read 调用一次、没有抛错、返回“文件不存在”。不要在答复里回显任何本机路径。

## 必须完成

1. 为 `claim`、`read`、`persist`、`lease` 分别定义精确允许的失败信封元组。校验单位是完整 `(error, optional code)` 组合，不能分别用 error 集和 code 集拼成笛卡尔积。
2. 合法元组必须从 Python helper 每个 op 的真实返回路径和 Node 公共调用者合同逐支推导；删除不可达、跨 op 或语义矛盾的组合。`OPENAT_UNSUPPORTED`、不存在、已存在、非普通文件、权限、过大、写入失败、租约失效等都只能出现在有意义的 op/元组中。
3. 失败信封仍须 exact own-data shape：只有 `{ok:false,error}` 或该 op 明确允许的 `{ok:false,error,code}`；不允许 dev/ino/text、额外键、symbol、accessor、revoked/throwing descriptor、非布尔 ok。
4. 公共 `readDeployEvidenceFile`、claim、persist、lease 入口不得仅凭 code 忽略已经被拒绝的错误语义。交叉 op、矛盾元组、缺失/多余字段必须统一安全失败，且 claim/persist 的外部 mutation 调用次数为 0。
5. 增加表驱动回归：
   - 每个 op 的全部合法失败元组逐一接受；
   - 所有合法元组投到其他 op 必须拒绝；
   - 全部受控 error 与 code 的交叉组合中，未显式登记的组合必须拒绝；
   - 独立复审的 `read + LEASE_LOST + ENOENT` 公共入口复现必须改成抛出通用读取失败，不能返回不存在；
   - 合法 `read + PATH_ILLEGAL + ENOENT` 仍按既有合同返回不存在，不能把正常缺失破坏。
6. 保持上一轮 1 MiB UTF-8 写入上限、MAX/MAX+1、原 inode/bytes 不变、目录锚定、single-link regular file、bounded read、状态机恢复和隐私修复不退化。

## 瞬态红灯必须解释

独立评审首次运行 `node scripts/test-release-provenance.mjs` 时出现 `ascii helper claim MAX 未接受`，同一最小复现和完整命令复跑均通过。不得把它直接忽略：

- 在没有并行发布测试的条件下连续运行完整 provenance 至少 5 次，逐次记录 exit；任一次红就定位根因并修复。
- 检查 1 MiB claim 是否可能因 helper stdin/stdout 上限、timeout、短写、父目录 fsync、资源压力或临时路径碰撞产生非确定性。
- 测试失败输出不得泄漏路径或 payload；若确认为外部资源瞬态，也必须有可复核证据，不能仅凭“复跑绿”下结论。

## 门禁

逐条运行并真实报告 exit code/摘要：

```text
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
node scripts/check-doc-links.mjs
git diff --check
```

另报告：每个 op 的合法失败元组数、跨 op/笛卡尔负例数、公共入口矛盾信封结果与 mutation 次数、连续 5 次 provenance 的逐次 exit。不要创建最终 boundary，不要把当前 worktree `--check-bundle` 的预期缺 index 红灯写成通过。
