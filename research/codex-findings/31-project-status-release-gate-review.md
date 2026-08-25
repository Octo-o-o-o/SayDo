## 结论

`A=2, B=1, No-Go`

审计静止点：`2026-07-30 01:35:44 +0800`。

### A-1：快照恢复语义仍非真正 fail-closed

- 当前只检查“JSONL 文件 → SQLite session”，没有验证 SQLite session 缺失 JSONL 是否确由隐私策略允许。[snapshot.ts:169](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:169)、[snapshot.ts:191](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:191)
- `SnapshotOptions` 及生产调用均未携带 `store_transcript` 或逐 session 留存意图。[snapshot.ts:40](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:40)、[index.ts:1238](~/WorkSpace/SayDo/packages/daemon/src/index.ts:1238)
- 现有测试先创建非空 `turns.jsonl` 和对应数据库行，随后删除文件，未设置任何 privacy 标记，却明确期待备份与 verifier 通过。[backup.test.ts:95](~/WorkSpace/SayDo/packages/daemon/test/backup.test.ts:95)、[backup.test.ts:129](~/WorkSpace/SayDo/packages/daemon/test/backup.test.ts:129)、[backup.test.ts:265](~/WorkSpace/SayDo/packages/daemon/test/backup.test.ts:265)。这会把真实转写丢失与 `store_transcript=false` 混为一谈，违反 canonical 的条件式豁免。[09-data-contracts.md:989](~/WorkSpace/SayDo/docs/09-data-contracts.md:989)
- 严格谓词仍有分叉：发布路径接受任意整数 generation，[snapshot.ts:230](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:230)；verifier 拒绝 `<1`，[verify-snapshot.mjs:187](~/WorkSpace/SayDo/scripts/verify-snapshot.mjs:187)。`isSnapshotBackupDue` 复用前者，[snapshot.ts:633](~/WorkSpace/SayDo/packages/daemon/src/backup/snapshot.ts:633)，因此可能把严格 verifier 会拒绝的快照视为近期成功点。

结果是 completed manifest 仍可能发布不可严格证明的恢复点，并抑制补跑。

### A-2：TTS 零音频返回仍能把 readiness 置绿

启动探活正确使用 `bool(audio)`，[__main__.py:75](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/__main__.py:75)；但运行路径在检查音频是否非空前直接设置 `_tts_ready=True` 并发送帧。[hub_client.py:392](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:392)

真实 provider 在 session 结束但没有任何 audio chunk 时会返回 `b""`，不会抛错。[doubao_tts.py:148](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/doubao_tts.py:148)。下一轮 health 随后可报告 `tts:"ok"`，而 `/readyz` 直接信任该状态。[index.ts:156](~/WorkSpace/SayDo/packages/daemon/src/index.ts:156)。因此“运行调用失败后不假绿”尚未闭合。

### B-1：deploy 的 Python 准备与等待预算仍不一致

- 切换前只执行 `pnpm install`、console build 和 clean 检查，随后立即切 runtime；没有在 release 树预装、锁定验证 pipeline Python 环境。[cli.ts:253](~/WorkSpace/SayDo/packages/daemon/src/launchd/cli.ts:253)、[cli.ts:271](~/WorkSpace/SayDo/packages/daemon/src/launchd/cli.ts:271)
- 真实 plist 命令输出为：
  `Array { /opt/homebrew/bin/uv, run, python, -m, saydo_pipeline }`

  因此首次 `uv` 解析/同步发生在 runtime 已切换之后，与运行册“锁定依赖安装失败不切 runtime”的承诺不符。[runtime-deploy.md:66](~/WorkSpace/SayDo/e2e/owner-sessions/runtime-deploy.md:66)
- ready 等待在 daemon 快速返回 503 时约为 `20 × 500ms`，[cli.ts:222](~/WorkSpace/SayDo/packages/daemon/src/launchd/cli.ts:222)，但合法启动探活允许最长 20 秒。[__main__.py:65](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/__main__.py:65)。因此一次仍在允许时限内的成功探活，也可能被 deploy 提前报告失败。

pipeline 的 bootout/bootstrap 及最终同 SHA readyz 成功门本身已闭合；剩余问题是预切准备和等待窗口。

当前阶段判断仍诚实：HEAD/main/origin/main 均为 `f28489d…`，工作树有 48 条未提交记录；runtime 实测为 `838aeea4385a41ec58318437bb36a7db5ede635f`；四场均为 `not_run`，[session-1.md:54](~/WorkSpace/SayDo/e2e/owner-sessions/session-1.md:54)、[session-2.md:78](~/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:78)、[session-3.md:54](~/WorkSpace/SayDo/e2e/owner-sessions/session-3.md:54)、[session-4.md:85](~/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:85)；`git show-ref --verify refs/tags/v0.1.0` 返回 `fatal: ... not a valid ref`。

只读检查结果：`pnpm typecheck`、`pnpm lint`、`git diff --check`、shell/Node/Python 语法检查均 exit 0；当前候选 strict verifier 输出：

```text
[ok] snapshot=~/.saydo/backups/20260729T163416Z entries=4 digests=verified foundation=restorable extras=0
```

按限制未执行会创建隔离临时根的 dry-run，也未运行本报告后才刷新的完整 `just ci`；两者未被判作失败。