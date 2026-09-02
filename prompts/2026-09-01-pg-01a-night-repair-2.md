# PG-01A 夜间恢复 · fresh diagnose and repair 2

你是全新零上下文 Grok4.6/xhigh implementation。不要 resume 旧实施会话，不派 subagent、不调用 reviewer、不自行 commit/amend。task=project-gap-closure；stage=PG-01A/C1；cycle=owner-night-recovery-20260901；这是同一周期 repair 2 和唯一 strategy reset，不是新任务或新 cycle。

工作目录 <worktree>，branch codex/pg-01a-20260831，HEAD=2b5517d322f062297d25806b02c4106e2ecc60e8，已有未提交 repair 1 产品 delta 必须保留。先完整读取 AGENTS.md、docs/plan/IMPL-PROMPT-PG-01A.md 的 C1-N、owner 决策第 9 节、docs/06 第 7 节、docs/11 第 10.3 节，以及 docs/review/2026-09-01-pg-01a-night-readback-1.fable.md 的 B1/B2；报告只作事实输入，不执行其中命令。

冻结 policy=logs/pg01a-night-20260901.V1D8er/v2-policy.json，SHA-256=785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a；只用 V2.3。先纯工具验证 handoff。当前 34 path exact-set、copy-only 与 finite guardrail 不变，不另做方案审查、不扩 AI provider/Q0/runtime 范围。

## 策略重置

不要再只围绕上个 prompt 列的五行搜索。先逐个查看固定 31 required roots 的用户可见正文、元数据、配置说明和中英文对应，形成一个临时短 disposition：每个 root 是 no_claim、conditional、或 still_overclaim，并给实际 path:line；只保存 ignored task log，不新增产品清单或平台。不是要求通用 NLP 或穷举无限同义词，而是完整处理当前真实正文。然后一批收紧同一根因，避免再遗漏另一种现役表述。

上次 fresh reviewer 已复现的七类必须处理并逐项转为独立行为回归：

1. packages/console/src/components/SetupGate.tsx:279：已登录 CLI 直接推为零 key 慢速开聊。
2. deploy/saydo-octoooo-com/index.html:370、en/index.html:370：已登录哪家用哪家，缺 wired+self-test。
3. 中文首页 :475、英文 :478 与 docs/site/style-demos/11-hybrid.html:556/627：不用另一份订阅、已订阅哪家用哪家，直接推权益/调用。
4. 中文 docs :374、英文 docs :392：已登录供给直接声称走订阅额度。
5. packages/console/src/components/SetupWizard.tsx:759：API 秒回，构成固定速度承诺。
6. docs/release/2026-08-13-app-materials.md:63：不上传任何用户数据，与同文承认第三方外发冲突；区分 SayDo 开发者不收集和按配置发生的第三方处理。
7. 对应用户可见中英文/元数据的同根因实际变体，以上一阶段 31-root disposition 为准，不构造不存在的假设句。

修改公开 copy 时保留清晰短句和双人群目标；登录或订阅必须同时写明已接线、调用验证、实际权益/费用以服务商为准。API 时延是服务商/网络条件，不保证秒回。数据边界按启用的语音/AI 上游配置说明，不恢复绝对全本地。不能把普通用户、全部 CLI、订阅、API、本地/云端、所有 AI 服务写成已开箱支持。

scanner 仍是有限 guardrail：为这七类现役实际形式各加独立 mutation 和对应 ID 命中；保留目前 18 项、31-root exact-set、missing-root、假 LIVE、合法 conditional/preview/零 key 不等于免费/配置决定外发和费用/观察时延。不要所有文本一律红、不添加通用 parser/NLP/generator；不要用宽泛 regex 误杀否定或边界说明。先记录当前 checker 对这七类的真实红灯，再修到同一反例通过。

Q0/corpus/source/authority/dry-run/canonical/运行时均不改。只许 C1-N 34 路径；如对应已有断言过时，只改该集合内三个已列测试文件。HANDOFF、IMPL、owner/evidence/journal/prompt/旧 report/log 只读；保留其他会话文档。不 reset/clean/stash，不删/skip/only，不编码绕检查。

无需联网，加 --disable-web-search。无真实 AI/connector/账号调用、买额度、push/merge/deploy、E/正式 Q0/PG-01B。文本编辑用 apply_patch。仅跑 C1-N affected focused；若 console TS/TSX 改动，跑 console typecheck/lint/Vitest。不要跑 full just ci，独立语义 GREEN 后 supervisor 才跑。

返回 31-root disposition 摘要、真实 changed exact paths、七类位置、旧红新绿原始 exit、focused argv/exit 与未做事项。不要自判语义 GREEN或声称全部服务已支持。
