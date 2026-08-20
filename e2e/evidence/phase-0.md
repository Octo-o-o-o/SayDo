# Phase 0 证据 · 工程底座与契约包

> 六段式(计划质量门):测试命令+尾行输出 / §12 条目↔测试对照 / golden 通过率 / 截图清单 / 偏离与回写链接 / 代码提交 hash。
> Phase 0 无 golden 对话集(属 Phase 1)、无 UI 截图基线(属 Phase 5),对应段标注"本 Phase 不适用"。

## 1. 测试命令与尾行输出

```
$ just ci            # node + python 双矩阵
packages/contracts test:  Test Files  6 passed (6) / Tests 61 passed (61)
packages/daemon   test:  Test Files  6 passed (6) / Tests 49 passed (49)
[ok] emoji gate: clean
emoji-gate self-test: pass=4 fail=0
python: All checks passed! (ruff) / 1 passed (pytest)
[ok] just ci: node + python matrices green
```

- `sqlite3` CLI 直接执行 DDL v1:`[ok] sqlite3 CLI executed DDL v1 without error`(22 表建成,含 memory_fts 虚表)。
- `just dev` 三进程:daemon `/health` 200、console http 200、pipeline JSONL 启动行各一(0.1 验证)。

## 2. §12 契约测试条目 ↔ 测试对照(Phase 0 覆盖子集)

| §12 条目 | 覆盖测试 | 状态 |
|---|---|---|
| §12-1 digest 确定性/跨状态不变/revision 变则变/grant 篡改拒 | contracts `test/digest.test.ts`(6) | 绿 |
| §12-2 预授权反例 Tier1 子集 ①-⑤/⑨/⑩ + renderSpoken | contracts `test/effects.test.ts`(16) | 绿 |
| §12-3 收据 outcome 转换/单次消费/超时按档/合法组合矩阵 | contracts `test/receipt-sm.test.ts`(12) | 绿 |
| §6.1/§9 task + tier1_run + outbox 状态机 | contracts `test/task-sm.test.ts`(11) | 绿 |
| §12-10 MemoryEvent op×payload / route×adapter / Money / dedupeKey | contracts `test/schemas.test.ts`(9) | 绿 |
| §12-7 Tier1 子集(kill -9 注入:两阶段 binding/journal 重放/tier1 恢复钥匙) | daemon `test/storage-crash.test.ts`(3) | 绿 |
| §12-9 配置/启动子集(校验器反例 + dev 双开关 + family 冲突 + 两模板解析 + effective binding + BYOA 探测逻辑) | daemon `test/config.test.ts`(19) | 绿 |
| TS↔DDL round-trip(§12-9 末项) | daemon `test/storage-roundtrip.test.ts`(7) | 绿 |
| DDL CHECK/NOT NULL/UNIQUE 非法直写被拒(§12-3/4/5/9/10 的 DDL 层) | daemon `test/storage-checks.test.ts`(16) | 绿 |
| JCS(RFC 8785)确定性 | contracts `test/jcs.test.ts`(7) | 绿 |
| E3 日志/审计分流 + 快照备份保留期 | daemon `test/logger.test.ts`(2)/`test/backup.test.ts`(2) | 绿 |

合计 contracts 61 + daemon 49 = 110 测试全绿。

## 3. Golden 通过率

本 Phase 不适用(golden 对话集属 Phase 1;10 §6)。

## 4. 截图清单

本 Phase 不适用(UI 截图基线属 Phase 5;11 §12)。0.1 仅建 UI 底座(tokens.css 照抄 11 §2 + Tailwind v4 + Lucide),App.tsx 为底座验证页。

## 5. 偏离与回写链接

- **无 canonical(09/10/11/ADR)形状改动**——Phase 0 严格照抄 09 schema/DDL/§12。
- 0.5 PoC 证据:`e2e/poc/narrow-loop-manual/RESULT.md`(八条对照 + lint/check JSON)。以既定裁决(§14 A3/A4/A7 已封闭)验证 Hopper 现状,attest 现状与裁决一致,**未发现 09 需改形状项**。
- PoC 实证复述两条已知裁决(无新增合同):① automation 无法自批 needs_human 任务(印证 ADR-001/Codex A5:P0.5 人工合并交接);② `RunSettled.summary_path` 为 `.md`(印证 Codex A2:iframe 受控映射到 .html)。两条均已在 canonical 写明。
- §14 PoC 证据以实施仓 `e2e/poc/` 留证(证据源纪律),canonical 无 additive 需求。

## 6. Gate 0 归属项(Phase 0 落点)

- **无 bypass 铁律**:`validateDispatch`(effects.ts)Gate 0 未关即拒,`gate0Closed` 仅 `enabled && !bypass`;`[gate0].bypass=true` 视为未关(§12-2 ⑩测试覆盖三种未关组合);代码无 bypass 分支。基元级证据:`test/effects.test.ts` 反例⑩。
- **G2 两阶段写基元**(0.3 半边):`dispatch.ts` beginXXX(in-flight)→ 副作用 → complete/transition;`test/storage-crash.test.ts` kill -9 注入证明重放收敛、idemKey 重复拒。完整关闭(跨域半边)在 P0.5-B。

## 代码提交 hash

- 代码提交 SHA:0632a6a91c4cbe3ad7423a76dbd5d2ec0d872432
