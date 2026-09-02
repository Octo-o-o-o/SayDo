# PG-01A/C0 独立复审（二轮）报告

> 归档说明（supervisor）：本报告 supersedes 首轮对旧 C0 candidate 的判决；旧 RED 原文仍保留于 logs/pg01a-c0-20260831.HMyzKK/review-1.md。本文件仅归档 C0 二轮判决，不覆盖 C1 候选；仅将 18 个本机绝对链接机械改为仓内相对链接，证据标签中的行号与 manifest 保留；原始 reviewer 输出与摘要见唯一批证据。

## 复审结论

`verdict=GREEN`。

C0-1 至 C0-6 共 6 项全部成立；原唯一 blocker B1 已关闭；三项指定文档门全部 exit 0；未发现 P0/P1 blocker 或 P2 ledger delta。

本结论仅表示 `PG-01A/C0` canonical 一致性复审通过，不表示 C1 已实施、PG-01A 全批通过或产品已交付。C1 仍须由 supervisor 明确释放。

## 复审身份

- task：`project-gap-closure`
- stage：`PG-01A/C0`
- cycle：`owner-continuation-20260831`
- branch：`codex/pg-01a-20260831`
- review scope：`step`
- review ordinal：`2`
- candidate HEAD：`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`
- diff fingerprint：`e0fe7094a6ef940fc2da26ee705dbfc23839bceabe86fd5b9bd8d23be196ef1c`
- implementation SHA/tree：`n/a`，当前仍是 I 前 dirty C0 子阶段
- candidate commit 增量：`0`
- V2 contract：`valid`
- repair 已用：`1`
- 本次为唯一二轮复审；第二次 RED 规则已核对，但本轮为 GREEN

真实命令证据：

- `git log -1 --format='%H%n%s'`

  原始输出：

  `79211f6fec5c6eb092419c1871e35d8eedc4e3e5`
  `chore(evidence): 记录 PG-00 排产导入证据`

- `git rev-list --count 79211f6fec5c6eb092419c1871e35d8eedc4e3e5..HEAD`

  原始输出：`0`

- `python3 ~/.octoworkflow/candidate_fingerprint.py`

  初次及末次输出一致：

  `{"algorithm": "git-diff-v1", "fingerprint": "e0fe7094a6ef940fc2da26ee705dbfc23839bceabe86fd5b9bd8d23be196ef1c", "head": "79211f6fec5c6eb092419c1871e35d8eedc4e3e5"}`

- `python3 ~/.octoworkflow/validate_handoff.py docs/plan/IMPL-PROMPT-PG-01A.md`

  exit 0，原始输出：

  `{"contract_errors": [], "owner_override_reason": null, "owner_override_rules": [], "policy_version": 2, "risk_violations": [], "status": "valid", "unapproved_violations": []}`

## 独立性与读取边界

已完整读取：

- `impl-review/SKILL.md`，143 行
- `prompts/2026-08-31-pg-01a-c0-rereview.md`，46 行
- 原验收合同、PLAN-2 PG-01A 批卡、总案 §20.2/§20.4、owner 决策第 6 节
- 当前三份产品 diff 及必要 canonical 上下文
- 唯一 evidence 与唯一 Deferred P2 ledger

未读取上一轮评审报告、实施 transcript/log、`repair-1.log`、原 repair/review prompt 内容、父会话历史或 credential/history。未派 reviewer、subagent 或语义 child。

按指定 prompt 跳过 skill 第 0 步 fetch；未执行 commit、amend、fetch、push、merge、deploy，也未修改任何文件。末次 status 与 fingerprint 未漂移。

## 改动范围

C0 产品 diff exact-set：

| 文件 | 新增 | 删除 |
|---|---:|---:|
| `HANDOFF.md` | 1 | 1 |
| `docs/06-references.md` | 88 | 0 |
| `docs/11-ui-spec.md` | 25 | 7 |

完整 candidate 另包含 supervisor 维护的 owner 决策、prompt、evidence、ledger 等控制产物；它们仅用于核对身份、授权和计数，未递归审查监督框架。

三份产品路径全部属于 C0 `must_change`，未发现其他产品、runtime、corpus、测试或 UI 实现路径变更。

## C0-1 至 C0-6 对账台账

| 验收项 | 状态 | 独立取证与判断 |
|---|---|---|
| C0-1 公开四态与证据绑定 | `[ok]` | [docs/06-references.md:132](../06-references.md) 要求每条声明唯一取 `supported/conditional/preview/unsupported`，并绑定 candidate、路径、条件；[docs/06-references.md:143](../06-references.md) 明确隔离 09 任务状态、`semanticSupport`、`VoiceTransport` 和 probe 事实；四类证据在 [docs/06-references.md:150](../06-references.md) 分别定义。`docs/09` 实测仍只有其原有 `semanticSupport?: "supported" \| "unsupported" \| "unclear"`，未形成运行时枚举分叉。 |
| C0-2 双人群、语音可选与安全红线 | `[ok]` | [docs/06-references.md:163](../06-references.md) 和 [docs/11-ui-spec.md:574](../11-ui-spec.md) 均把开发者与普通用户表述为目标而非已验收事实；文本与语音分开取证；语音可选不降低 Gate 0、S3、授权或审计要求。既有 `VoiceTransport` 与“语音未配置（可选）”合同保持不变。 |
| C0-3 权益、兼容性、模型身份、时延和数据边界 | `[ok]` | [docs/06-references.md:156](../06-references.md) 禁止从 `logged_in` 推断订阅、免费或工具能力；[docs/06-references.md:161](../06-references.md) 要求模型身份未知时拒绝，并排除兼容端点等同工具或 Structured Outputs；[docs/11-ui-spec.md:429](../11-ui-spec.md)、[docs/11-ui-spec.md:440](../11-ui-spec.md)、[docs/11-ui-spec.md:471](../11-ui-spec.md) 同步移除秒级、费用和“数据不出设备”总括承诺。 |
| C0-4 LIVE 与 986 source 安全降级 | `[ok]` | [docs/06-references.md:167](../06-references.md) 明确 `LIVE` 只表示需要当前来源，不表示 connector 已实现；[docs/06-references.md:169](../06-references.md) 将 986 个对象定义为 unresolved requirement，禁止充当 readiness、逐条伪改 valid 或修改 600 题范围/标签。当前 diff 没有 corpus 路径。 |
| C0-5 Q0 truth report 合同 | `[ok]` | [docs/06-references.md:179](../06-references.md) 至 [docs/06-references.md:208](../06-references.md) 覆盖唯一路径、`schema_version="1"`、完整 I commit/tree、`expected_total=986`、逐对象八字段、aggregate、三项 disposition、确定性 `source_id`、RFC 6901 转义、UTF-8 字节序、exact coverage 和不得回写源对象。B1 的条件已精确修正，详见下节。 |
| C0-6 只收紧声明 | `[ok]` | 产品 diff 只有三份文档；[HANDOFF.md:49](../../HANDOFF.md) 如实记录 `active=PG-01A,next=none`、C1 未开工和 SHA/tree 为 `n/a`。未修改 CLI、网络、权限、状态机、模型行为、UI 代码或布局，历史段落仍保留。 |

台账计数：`[ok]=6`、`[warn]=0`、`[fail]=0`、偏离 `0`。

## 原 blocker B1 处置

B1 已关闭。

当前 [docs/06-references.md:171](../06-references.md) 将 `A-RAG-01`、`A-RAG-02`、`B-VAL-01` 三项当前安全缺省统一为 `owner_downgraded_with_public_limit`。

关键条件位于 [docs/06-references.md:189](../06-references.md)：

- 当 `unresolved_count>0` 时，三项 disposition 必须全部逐字为 `owner_downgraded_with_public_limit`；
- 明确禁止 `closed`；
- 明确禁止 `blocks_expansion`。

[docs/06-references.md:208](../06-references.md) 同时规定 Q0 报告不写 `repo_status`，且 unresolved 存在时 G-A1 不得记为 `repo_status=closed`。因此原先允许 `blocks_expansion` 穿过 Q0 disposition 的歧义已经消除，且未放松 C0 其他合同。

## 质量复审发现

- P0：无。
- P1：无。
- P2：无。
- 未发现 canonical 命名空间分叉、范围漂移或历史证据改写。
- C0 没有修改测试、门禁脚本或计数基线，不存在通过放宽断言制造假绿的改动。
- 对 114 条净新增产品行检查了 `fromCharCode`、`eslint-disable`、`@ts-ignore`、测试 `skip/only` 与编码 codepoint；未发现绕过。唯一词法命中来自普通文案 `read-only`，不属于测试修饰符。
- 未运行破坏性 mutation：当前 prompt 明确只允许三项文档门并禁止 C1 mutation；本阶段也未新增或修改任何门禁实现，因此不把 mutation 记成已验证事项。

## 门禁结果

| 命令 | exit | 原始输出 |
|---|---:|---|
| `bash scripts/check-emoji.sh docs/06-references.md docs/11-ui-spec.md HANDOFF.md` | 0 | `[ok] emoji gate: clean` |
| `node scripts/check-doc-links.mjs` | 0 | `[ok] active document links: files=119 broken=0` |
| `git diff --check` | 0 | stdout 为空 |

门禁计数：3/3 exit 0。

## 未运行事项

按 C0 合同明确未运行：

- typecheck、`just ci`、full gate
- C1 corpus validator、active-claim checker、Q0 writer/checker 或 mutation
- Playwright、浏览器账号、live 产品、connector、产品 AI
- 麦克风、passkey、手机、托管 CI、release/distribution
- commit、push、merge、deploy
- workflow-final P2 sweep

这些未运行项不属于当前 C0 step 验收，不以本地文档门替代其后续证据。

## Deferred P2 ledger delta

`p2_ledger_delta=[]`

- 新增：无
- 更新：无
- promoted：无
- final sweep：未启动，符合 `review_scope=step`

## 修复清单与交接

修复清单为空，无返工去向。

交由 supervisor 校验 manifest、更新持久计数，并在保持同一 PG-01A 总预算的前提下决定是否明确释放 C1。本 reviewer 不自行启动 C1 或后续阶段。

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 2,
  "candidate_head": "79211f6fec5c6eb092419c1871e35d8eedc4e3e5",
  "diff_fingerprint": "e0fe7094a6ef940fc2da26ee705dbfc23839bceabe86fd5b9bd8d23be196ef1c",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "c0-emoji",
      "exit_code": 0,
      "summary": "[ok] emoji gate: clean"
    },
    {
      "name": "doc-links",
      "exit_code": 0,
      "summary": "[ok] active document links: files=119 broken=0"
    },
    {
      "name": "git-diff-check",
      "exit_code": 0,
      "summary": "[ok] stdout empty; no whitespace errors"
    }
  ],
  "stop_reason": null
}
```
