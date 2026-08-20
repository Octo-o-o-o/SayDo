你是对抗评审。只读,不改仓库文件。不要通读 docs/09 全文;核对合同时用 rg 定位片段。不要把 AGENTS.md 评审制度理解成要再起一层 Codex。

<task>
对抗性评审《现在做 / 可后置 · 2026-08-16 更新建议》:
docs/review/2026-08-16-now-vs-later.md

实施仓:/Users/wangyixiao/WorkSpace/SayDo
HEAD 以 git rev-parse 为准(预期 3197fd8)。工作树可能含本建议未提交文件,只读。

裁决对象:这份建议主张「唯一现在该实施的工程批 = LAN remote-mobile 第 0 步」,并把 native_api / Claude SDK / 四场验收 / R-B / DSH / W6-W9 全部后置。

你的工作:
1. 独立复核建议 §0 修正表与 §1 机制主张(worktree 两棵/落后 47、Focus stage 0、09 三路径零命中、SetupBootstrapKind 无 remote-mobile、probe 丢 code、双 visibility、runtime=ada7981c、HANDOFF 97b01f7)。可以跑只读 git 与 curl 127.0.0.1:47100/health;不要跑全量 lint/测试。
2. 攻击「现在只做 remote-mobile」是否错误处方。反例候选:常驻 runtime 仍是 ada7981c 且 8 月不部署 ⇒ 合入 main 对真机零收益;既有 M1 LAN Playwright 是否已绿(建议写「T19 后预期红」是否过时);HANDOFF 指针/PLAN-2 单批纪律是否被破坏;是否该先做 B4 治理而不是功能;是否该先修 T19 29 条 e2e;native_api 是否其实比进壳更值;把四场验收后置是否让发布门永远关不上。
3. 找遗漏:第 0 步同批是否还缺「不做则 A1 假绿」的项(对照终稿 docs/review/2026-08-13-mobile-shell-strategy-final.fable.md §3 与 Codex 70)。不要把 CallKit/Noise/ADR-003 塞回来,除非代码证明完整回报链已具备。
</task>

<grounding_rules>
每条 finding 必须有本会话读到的 file:line 或命令输出。凭建议「写过」不算证据。宁降不升。允许证伪建议,不要护短。区分 A 事实错误影响结论 / B 不影响主结论 / C 价值排序分歧。
</grounding_rules>

<structured_output_contract>
Markdown,简体中文,零 emoji(勾叉用 [ok]/[warn]/[fail])。

# 73 现在做/可后置 对抗审
> 日期/HEAD/只读

## 终裁
一段:建议可接受 / 需回修后接受 / 不可接受。列出必须修正的事实与必须调整的实施范围。

## Findings
编号。每条:级别、标题、打建议哪一句、证据、对实施范围的含义。

## 对「唯一本批=remote-mobile」的专项裁决
是否成立;若否,本批应加/应删什么。常驻不部署是否让本批失去狗粮价值。

## 证伪
建议里被推翻的句子。

## 可派工条件
最小范围清单(越短越好)。若接受建议原范围,明确写「维持」。
</structured_output_contract>

<default_follow_through_policy>
不要问 owner 问题;该上浮的写成「需 owner 拍板」。不要建议修改 AGENTS.md 评审制度。不要实施代码。
</default_follow_through_policy>
