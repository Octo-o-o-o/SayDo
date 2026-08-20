# 首发全量 readback(P0.5 收尾;首发交付点判定文件)· 2026-07-25

> 口径:对照 IMPLEMENTATION-PLAN v2.5 逐步对账;[done]=完成有证据;[adapted]=完成但形态偏离(已注记);
> [owner]=需真人,技术前置就绪;[deferred]=计划内明确顺延(有出处);[skip]=裁定不做(有理由)。
> 运行基线:`just ci` 全绿(contracts 65 + daemon 335);Playwright 8/8;fake-runner e2e 3/3;音频烟测 5/5。

## Phase -1(owner 前置)

[done] 凭据/环境/仓库/Hopper 前置(D① 物理落地 + D② 契约全绿切锁 baseline.2 均已由 AI 完成);
[owner] E:真人音频底板 5 条、dogfood 首个真实项目指定。

## Phase 0

| 步 | 状态 | 注 |
|---|---|---|
| 0.0 | [done]+[deferred] | cursor 钩子门/deny/放行/版本断言有证据(spike+4.0/4.1);resume 机制 spike 已记录(--n chatId),真实多步复验归场次② dogfood;claude_sdk 四能力 = 计划明确顺延至订阅购入(v2.3) |
| 0.1–0.4 | [done] | evidence phase-0.md |
| 0.5 | [adapted] | 人肉手动版改造为 fake-runner 自动化承载(p05.md §4 八条对照 + hopper check oracle 可行性实证);owner 抽查归场次④ |

## Phase 1

| 步 | 状态 | 注 |
|---|---|---|
| 1.0 | [done] | ADR-101;第二家对比=换 provider 门禁非首发([skip] 有出处 Codex 12 A3) |
| 1.1 | [adapted] | Pipecat spike GO(ADR-001);P0 PTT 整段模式未启用 Pipecat 运行时,打断由 hub watermark 承载——ADR-001 后记如实注记,LiveKit 切换条款不触发 |
| 1.2/1.2b/1.3a/1.3b/1.4 | [done] | evidence phase-1.md;1.2b BYOA(笼/tripwire/parser/billing-switch)测试在 byoa.test |
| 场次① | [owner] | 真人语音体感 |

## Phase 2 / Phase 3

全部 [done](evidence phase-2.md / phase-3.md;§4.1 快照器/评估器/工厂/E2 随 Phase 3)。

## Phase 4 / Phase 5

全部 [done](evidence phase-4.md / phase-5.md / gate0-checklist.md / p0-readback.md);
场次②③ [owner];价值证据轨周报已挂(/api/value-report + value-report.test;lane 埋点落 sessions,
dogfood 起回填;检错仪式=dogfood 期 owner 执行项)。

## 外部评审 M1-M11

全部 [done](review-m-batch.md 逐项对账;五路评审 A 级 9 项清零)。

## P0.5

| 项 | 状态 | 注 |
|---|---|---|
| A 契约封闭 | [done] | p05a-contracts.test 12 例 |
| B Hopper 桥 | [done] | p05b-bridge 11 例 + fake-runner e2e 3 例(对锁定二进制);baseline.2 已切锁 |
| C 直达验收档 | [done] | p05c-direct-mode 7 例 |
| D 场次④ | [owner] | 技术前置全绿:八条自动化对照 + trust-report 对真实 run 渲染成功(headless Chrome 截图,emoji 呈现层转换零残留)+ 升级仪式=版本 pin 断言与重跑门禁(4.1 既有);owner 现场过直达档念清单与全链 |
| E Demo 生成器 | [done] | p05e-demo.test + 截图验证 |
| 收尾 | [done] | golden P0.5 4 条;价值证据轨第二锚点=周报口径复核(value-report.test)+ 埋点齐备性检查(gapsInInstrumentation 如实报);本文件=全量 readback |

## 不实施清单(裁定,含理由)

1. claude_sdk 四能力/live-steer——owner v2.3 拍板顺延至 Claude 订阅购入,cursor queued_delta 代偿(时限性已知缺口)。
2. 第二家 ASR 对比 + 300–500 条真实 golden——换 provider 门禁非首发(Codex 12 A3 权威);golden 由 dogfood 真实误听积累。
3. owner 场次①②③④、真人音频底板、review 检错仪式(植入缺陷)——需真人;全部技术前置就绪。
4. Phase 0 末工期滚动重估回写——全部工作已完成,重估无对象(如实记录:实际由单会话马拉松完成,工期口径失效)。
5. 09 §13 reviewTask 返回词"rejected"措辞勘误——挂下轮 canonical 回写(实现按 §6.1 边表落取消链,evidence 已注记)。

## 收口验证(2026-07-25 收口会话追加;独立对账,不信自报)

- **对账报告**:`closeout-verification.md`——本文件逐节抽验**成立**([done] 实证/[adapted] 注记与 canonical 不冲突/[skip]、[deferred] 出处真实);五路门禁收口会话全量复跑**全绿**(`just ci` 双矩阵 13.7s / Playwright 8/8 / fake-runner e2e 3/3 对锁定二进制 / golden 43 条实数 / 音频烟测 5/5,首跑一次火山服务端瞬时超时重跑即绿)。
- **对账修复**(提交 `0eb96f1`):Gate 0 两处证据问题——G5 audit_log 触发器虚报(DDL v2 补库层不可变 + 3 测试)、G6 privacy 证据链断(prefault 缺省单源 + store_transcript 接线 + 4 测试);RiskBadge 补 shield 图标(11 §2.6)。
- **勘误**:上文 P0.5-A 行"p05a-contracts.test 12 例"实为 **13 例**(收口会话实测;收口前测试有追加,数字未刷新)。
- **欠账清偿**:09 §11 [hopper] expected_version 已回写 `bdd1e548…`(与运行时一致);§13 reviewTask 返回词勘误(`rejected`→`cancel_requested`,按 §6.1 边表)——不实施清单第 5 项**清零**;评审 = 一致性 subagent + Codex 14 攒批(`research/codex-findings/14-canonical-writeback-closeout.md`)。
- **Codex 14 triage**(4A+5B+2C+横切 5,逐条独立核实):A 级全清——预授权子收据认证强度查库继承(防伪造)/protected 分支并集语义/api 缺 model provider 层作废/reviewTask 返回字段名照 §13(代码修复 `e4b6ab3`)+ 切锁回写锚勘误与 05/ADR-001/模板 baseline.2 同步(文档批)+ turn_ref 过约束注记;**登记上浮 owner 三件**:停靠老化调度接线/项目层配置生产加载/retryTask 状态机边(功能建设或 canonical 语义级,收口不擅自扩面)。修复后 `just ci` 双矩阵绿(contracts 65 + daemon 344 passed | 1 skipped——skip 为 SAYDO_SLOW_E2E 门控慢测试 `8fc503a`,合法)。
- **场次支撑**:①-④ 现场清单 `e2e/owner-sessions/session-1..4.md`;ADR-002 复核材料 `e2e/owner-sessions/adr-002-review-brief.md`(残留决策点 = canonical 豁免条款去留,owner 已裁定豁免休眠——`22d9290`)。
- **ASR 项状态更正**:交接指令中"ASR key 就位后补跑 1.0 跑分"一项**实际已完成**(2026-07-24 晚 owner 提供三元组后两轮跑分 + ADR-101 定稿;收口会话烟测复证 key 可用)。
- **impl-readback 回收批**(2026-07-25 下午,代码提交 `5c00505`):owner 侧 /impl-review 对收口工作的对账报告(`research/2026-07-25-saydo-closeout-impl-readback.fable.md`)判"收口交付成立、可合并、无 A 级",其 2B+3C 全部回收——B1 observedModel 非字符串穿透收紧(缺失/null/数字/空串四反例)、B2 作废审计按错误码触发+话术分流(删不可达死分支)、C1 CostText 币种通用式、C2 审计 comments 只存 digest(E3 纪律)、C3 prefault 防踩注记;复审(code-review subagent)判"无 A 无 B、2C":C-1 BYOA 前缀码归一已并入本批,C-2(作废话术入史)经裁决接受(入史与实际播出一致)。**staged 接线家族**(SessionManager live 构造/tier1 操作面 reviewTask 等四函数/live 工具环/停靠调度)统一登记 HANDOFF §2-9"场次② dogfood 接线增量清单"。门禁:`just ci` 双矩阵绿(contracts 65 + daemon **349** passed | 1 skipped,+5 新测试)。

## 首发交付判定

工程侧(AI 可完成的全部)**齐备**:P0 + P0.5-A/B/C/E + 收尾全量 readback(本文件)+ **收口独立对账通过(上节)**。
**首发交付 = 本文件 + owner 场次④(P0.5-D)通过**——场次④是最终发布裁决点，场次①–③仍是必需真人验收。**口径修正(2026-07-25 五路面板)**:"随时可约"基于库层就绪的旧判断——**发起面(live 工具环/bridge 驱动)零生产调用方,场次①–④全部以接线增量批(HANDOFF §2-9)完成为前置**;owner 已拍板严格四场分开(①→②→③→④)。**tag:`v0.1.0-rc.1` 已锚定本收口态**(annotated @ `628f7e4` 推远端;v0.1.0 待场次④)。
