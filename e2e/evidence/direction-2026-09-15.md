# 方向登记批收口证据(2026-09-15)

本批为文档/排产/演示资产登记批,无产品代码改动。授权来源 = owner 决策单第 13 节(六项裁决);触发材料 = 外部 ChatGPT Pro 交接包(`SayDo_Codex_Handoff_2026-09-12`,分析基线 `f4171a60` 2026-09-09)的逐项核对与四路只读交叉核验。

## 身份

| 项 | 值 |
|---|---|
| 分支 | `direction-20260915`(worktree `../SayDo-wt-direction`,父=main `49ed96f`) |
| 批性质 | canonical + 排产登记 + 资产归位;非产品批,不占 active/next 之外的新批 ID |
| 插批 | `JOURNEY-01` 入唯一串行链(EMAIL-A-outbound 后、PG-02 前),指针 revision 9→10 |
| 证据 | 本文件 + journal R162 |

## 决策落实对照(决策单第 13 节)

| 决策 | 落点 | 状态 |
|---|---|---|
| ① White Edition = 产品 UI 新方向 | `docs/11-ui-spec.md` 设计基因行 + 新增 §0.2(方向合同 5 要点 + 迁移规则 5 条);`packages/console/src/styles/tokens.css` 迁移注(现值冻结至迁移批);`AGENTS.md` demo 条款 | [ok] |
| ② 首批验证样本保留非技术用户 | `docs/11 §10.3` 口径不变,无文件改动;分歧已登记决策单 | [ok](不改) |
| ③ 插 `JOURNEY-01` 参考旅程批 | PLAN-2 批卡 + 链串 + 断言 + 指针 revision 10;`scripts/schedule-pointer.mjs` EXTRA_BATCH_IDS 与两处冻结串、self-test 变异串同步;HANDOFF 生成块 `--render` 重投影 + 现役行 | [ok] |
| ④ White 资产入 `demo/` | `demo/saydo-investor-demo-white-edition.html`(含来源/性质头部注)+ `demo/white-edition-previews/`(5 PNG)+ `demo/white-edition-checks/`(2 JSON,历史自检非产品证据) | [ok] |
| ⑤ deferred 重议触发条件补登 | PLAN-2「deferred 项重议触发条件」节(7 个 DF + DF-WHITE-FULL-MIGRATION + 三条通则);来源标注外部包 docs/02 §9 与统一方案既有定义 | [ok] |
| ⑥ JOURNEY-01 后跑四场真人验收 | 决策单登记为排期意向;`e2e/owner-sessions/` 场次① failed @ `ada7981c`、②–④ not_run 未变,发布证据锁条款不动 | [ok](登记) |

## 门禁

| 门 | 结果 |
|---|---|
| `node scripts/schedule-pointer.mjs --check` | [ok] `active=none next=JOURNEY-01 last_closed=EMAIL-A-outbound revision=10` |
| `node scripts/schedule-pointer.mjs --self-test` | [ok] 六坏例全非零 |
| `node scripts/check-doc-links.mjs` | [ok] `files=156 broken=0` |
| `bash scripts/check-emoji.sh` | [ok] `emoji gate: clean` |
| `bash scripts/check-hardcoded-colors.sh` | [ok] `color gate: clean`(tokens.css 仅加注释,色值零改动) |
| `node scripts/week-audit.mjs --check` | [ok] `main=115 all_refs=131 extra=16 paths=434 docs=219` |
| `git diff --check`(父 `49ed96f`..HEAD) | [ok] 无空白问题 |
| headless Chrome 截图 `demo/saydo-investor-demo-white-edition.html` | [ok] 1440x1000 与 390x844 两视口渲染正常(首屏、侧栏、底部 tab 均可见;截图不入库) |
| `just ci` / playwright | **not_run**(无产品代码改动;focused 门如上) |

## 复核修订(2026-09-15,Claude 二次核对;非独立零上下文评审)

原候选三提交 `97e6f20`→`e1e6a75`→`36c05e4` 经逐项核对后重建为本链,内容修订三处,其余逐字保留:

- `docs(direction)` 提交 message 含 U+2713 字符,违反 docs/11 §0 原则 5(commit message 同禁);重写 message,文件内容不变。
- `docs/11 §0.2` 要点 2 近黑色阶写作 `#252`(三位 hex 实为 `#225522`,非近黑);按方向实物 `--ink:#252525` 改正。
- `docs/11 §0.2` 迁移规则 2 引用 `§2.7 写死色值门禁`,实际节号为 §2.7a(§2.7 是品牌朱准则);改正。
- 本文件门禁表原三行写「见本提交门禁日志」但无日志入库亦无字节数/SHA-256 登记;改为实跑结果。

复核时另核实:`103 个演示动作 ID` = demo `handleAction` 内 103 个 case 分支(静态提取,与交接包口径一致);Focus 页 6 个 toast 占位与 TaskCard 8 个动作开 TaskModal 不带语义,与 `FocusPageRoute.tsx` 一致;批卡 scope roots 与决策单引用路径全部存在;公开快照 `public/main`=`4ef4759`,树差异仅 `artifacts/release/copyright/` 8 文件。

## 范围外如实登记

- JOURNEY-01 **未开工**:批卡已立、合同待执行卡;Focus 页 6 toast + 8 modal 占位动作本批未接线。
- 全仓 White 换肤未做:`DF-WHITE-FULL-MIGRATION` deferred;`tokens.css` 色值零改动。
- 外部包其余建议分类归档(已落地/已 defer/不采纳),不逐条立项;其批编号建议未采用。
- 四场真人验收仅能 owner 执行,本批不宣称任何验收结论。
- 无独立零上下文评审(文档登记批,评审制度未具名)。
