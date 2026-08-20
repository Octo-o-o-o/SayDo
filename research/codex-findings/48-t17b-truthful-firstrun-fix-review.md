# 初审 No-Go；triage 回修后 Go

Codex 对抗评审在分支 `fix/t17-truthful-firstrun`、HEAD `e92566f09b732a7fe943dd93dc01464237808e14` 的未提交 T17b 工作树上初审发现 A 级 2 项、B/C 级 0 项。评审结束后两项均按最小修法回修并进入最终门禁；本报告保留原发现，不把初审改写成已通过。

## 47 号报告逐项初审结论

| 项 | 初审结论 | 摘要 |
|---|---|---|
| A1 | 部分闭合 | 自救死锁、远程入口已修；但“先列出”未由 HTTP 协议约束，且整行清除未向用户明示。 |
| A2 | 闭合 | recovery-only 已在独立 composition root 提前分支。 |
| A3 | 部分闭合 | 正常响应冲突会审计，但组合畸形响应可先返回 `invalid_response` 绕过审计。 |
| A4 | 闭合 | 首跑资格在 bootstrap/setup audit 前持久化。 |
| A5 | 闭合 | 稳定回放、durable 接纳后消费 marker 与 recovery 拒收均已实现。 |
| A6 | 闭合 | origin 在 JSONL、挂起重建和 talking-session 进程恢复中保留。 |
| B1 | 闭合 | BYOA 当前时态与 UI 文案已校正。 |
| B2 | 源代码层闭合 | 真实进程、HTTP/WS 与 mount/reload 测试已存在；Codex 只读沙箱未能实际执行 Vitest。 |

## A 级初审发现

### A-01：正文形状可抢先返回，绕过 observedModel 审计

- 初审证据：模型检查当时位于内容/tool 解析之后。缺 `model` 且 `choices=[]`、不可解析 `model` 且 tool call 畸形、预期 Claude/响应 GPT 且 `choices=[]` 三种输入都返回 `invalid_response`，审计回调数组为空。
- 后果：结果仍 fail-closed，但缺不可变拒绝审计，违反 `docs/09-data-contracts.md` 的“缺失、不可解析、冲突均拒绝并审计”。
- 最小修法：JSON 解析后立即完成 model 校验与审计，再解析正文/tool；增加三组合反例。

### A-02：清除接口不强制先列出，且整行删除未明示

- 初审证据：GET 与 POST 之间没有 receipt/digest 绑定；本机调用方可直接 POST 已知非法 projectId。DAO 整行 `DELETE`，混合“非法 dialog + 有效 budget”的行会连同有效字段消失，而 UI 只显示 projectId。
- 后果：未落实“必须先列出”，并形成未充分告知的整行误删风险。
- 最小修法：GET 签发绑定当前行 digest 的 receipt，POST 强制 receipt；若整行删除，UI 与请求体必须列出受影响字段并要求 `deleteWholeOverride` 明确确认；DAO 参数改为必填。

## Triage 与回修证据

### A-01 [Fixed]

- `packages/daemon/src/providers/openaiCompat.ts:123-147` 已把 missing/unresolved/mismatch 校验及审计前移到正文/tool 解析之前。
- `packages/daemon/test/provider.test.ts:141-177` 增加三种“模型异常 + 正文异常”组合反例；`slot-resolvers.test.ts:132-182` 继续锁定四槽显式 endpoint family 冲突与逐槽审计。

### A-02 [Fixed]

- `packages/daemon/src/api/recoveryOnlyServer.ts:260-287` 签发五分钟随机 receipt，保存每行 `SHA-256(projectId + NUL + overrides_json)` 与受影响顶层字段。
- `recoveryOnlyServer.ts:314-400` 强制 `receipt + projectIds + deleteWholeOverride:true`，并复核 receipt、重复 ID、当前仍非法与 row digest；receipt 成功后单次消费。
- `packages/daemon/src/config/projectOverrides.ts:151-164` 把 `requestedProjectIds` 改为必填，仅删显式点名且仍非法的行。
- `packages/console/src/components/SetupGate.tsx:127-175` 明示逐项目受影响字段与“删除整份覆盖”；`packages/console/src/lib/setupApi.ts:517-575` 锁定请求形状。
- `packages/daemon/test/recovery-only-process.test.ts:286-352` 覆盖未先列出、缺整行确认、行变化后旧 receipt、刷新 receipt 成功及数据库行删除。

## 评审时实际命令与限制

- `pnpm typecheck`、`pnpm lint`：exit 0。
- 四槽 inline probe：四槽均返回 `observed_model_family_mismatch` 并产生逐槽审计。
- 组合畸形 inline probe：初审真实复现三种 `invalid_response` 且审计为空。
- 混合 override SQLite probe：初审真实复现整行删除、`remaining:null`。
- Codex 只读沙箱内 Vitest 两次均因 `.vite-temp`/系统临时 `ssr` 目录写入 `EPERM` 未进入测试；不把它记为测试通过。

## 回修后独立复核与最终门禁

- 两路独立差分终复核均判 A=0/B=0、Go；contract 提出的“valid receipt 但缺 `deleteWholeOverride`”加固项也已补进真实进程负例。
- `pnpm ci:node` exit 0：contracts 87、console 65、daemon 1030 passed/4 skipped，typecheck/lint/emoji gate 全绿。
- first-run Playwright 定向验收 1 passed（10.1s）。

## 结论

对抗初审的 2A 已全部 Fixed；结合两路独立终复核与最终门禁，T17b 最终结论为 **Go**。
