# Phase 5 · 控制台、Gate 0 复核与 P0 总验收 — 验收证据(2026-07-25)

## 1. 测试命令与尾行输出

- `just ci`:contracts 65 + daemon 331 全绿。
- Playwright:`pnpm exec playwright test` → **8 passed**(G1 无 token 403 / 11 路由渲染+截图 /
  Dashboard fixture 一致 / parked 派生态 / 任务详情 AC+S3 样式 / 成本 unknown 纪律 / 切导航不断会话 / 审批上下文)。
- 音频烟测:`pipeline/.venv/bin/python e2e/smoke/audio-smoke-5.py` → **5/5 术语全命中**(真 sauc,热词偏置)。

## 2. §12 条目 ↔ 测试对照

Phase 5 是复核面:相关 §12 条目全绿见 gate0-checklist.md(每门绑测试名);
新增验收 = Playwright 8 用例 + story-acceptance(故事一 x3 + G5 审计链计数)。

## 3. golden

golden-coverage.test 5/5:合计 43 条(PHASE1 5 + M6 4 + COVERAGE 30 + P05 4)>=20;
§2 P0 场景号全覆盖;逆风齐(Gate0 拒/预算不足/熔断/merge 失败/撤回/不置可否);状态词零违规 + 零 emoji 断言。

## 4. 截图清单

`e2e/screenshots/{light,dark}/` 各 11 张(dashboard/chat/tasks/task-detail/memory/artifacts/
psettings/approvals/notify/cost/settings)——11 §12 首录基线;抽查两张人工核视觉(Soft Glass/
StatusChip/S3 强认证样式/成本 unknown)符合 11 规范。

## 5. 偏离与回写

- one_liner 未持久化到 tasks 列(摘要器按 evidenceDigest 缓存)——卡片回退,api/console.ts 注记。
- M3 五段延迟:采集/分解/报表端点就绪;真麦 >=20 条实测表归场次③(p0-readback staged 清单第 6 条)。
- live 对话环:纯对话形态(工具环 live 接线随场次② dogfood);observedModel 严格口径已接
  (缺失 => 作废+审计+重说)。
- 详细逐域对账见 p0-readback.md(零未解释偏离)。

## 6. 代码提交

`d4df8f2`(5.1+5.2) `0bdc5bc`(emoji 门禁修复) `12c7fcf`(5.3) `1d1552f`(5.4);
评审回修并入 `e8e9876`/`cd4429e`/`e50668e`。
