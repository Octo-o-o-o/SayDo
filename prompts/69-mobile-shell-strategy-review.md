你是对抗评审。只读,不改仓库文件。不要把 AGENTS.md 评审制度理解成要再起一层 Codex。

<task>
交叉评审两份移动端材料,裁决「最终该加什么工作、按什么顺序」,不要做摘要合并。

实施仓:~/WorkSpace/SayDo
HEAD 以 git rev-parse 为准。工作树可能有未提交文件,只读。

材料 A(浅战略,画布;不是 markdown):
~/.cursor/projects/Users-<account>-WorkSpace-SayDo/canvases/mobile-shell-strategy.canvas.tsx
主张:保持薄壳;不要三套原生产品 UI;加码堆在生产配对、iOS CallKit/PushKit、Android 原生语音、4.2 演示夹具、鸿蒙权限对齐;相对工时 20 份=配对5+来电5+安卓语音4+上架夹具3+鸿蒙2+原生UI0。当前态写成「能真机看页面、iOS 能按住说话」。

材料 B(深体检):
~/WorkSpace/SayDo/docs/review/2026-08-13-mobile-gap-audit.fable.md
主张:远程 console(mobile_lan + tailnet)被 SetupBootstrapBoundary 永久挡住是唯一 Critical;本周只修 setup 旁路+回前台双击重连;CallKit/Android 语音/生产配对/演示模式现在做回报不完整;不要 Capacitor 重写、不要三套 Today。

不要把 ~/WorkSpace/OctoDesk 的审计当 SayDo 证据。
</task>

<grounding_rules>
每条 finding 必须有本会话读到的 file:line 或命令输出。凭画布/体检原文「写过」不算证据。
宁降不升。材料 B 是同一仓另一会话写的,允许证伪它,不要护短。
材料 A 的行数声称(iOS 2064 / Android 905 / 鸿蒙 1195 / React 移动 2824)请用 wc -l 复验。
</grounding_rules>

<research_mode>
重点核验并给出硬矛盾裁决:

1. 当前态:材料 A「能真机看页面、iOS 能按住说话」vs 材料 B「T19 后门住所有非 local console」。读 SetupBootstrapBoundary、SetupContext、mobileLanApiAllowed、index.ts 对 GET /api/setup/probe 的 tailnet 分支。本机窄视口 via=local 是否掩盖。若 B 成立,A 的 20 份工时分配是否把唯一阻断漏成 0。

2. 薄壳 vs 三套原生 UI:对照 docs/02 §7、docs/03 §8、docs/07 D12、docs/modules/d D2、packages/console/src/mobile、三端 apps/。D12 仍写 Capacitor 而仓里已是自写壳——这是该回写文档,还是该退回 Capacitor?

3. CallKit/PushKit 现在加码:对照 D11、modules/d D2 开放项(VoIP 政策)、W7.3 前置(R-B 配对合同、Apple Developer、ADR-003)。没有生产配对/APNs 凭据面时,做 CallKit 得到的是完整产品形状还是半截?

4. Android 原生语音 1–2 周:nativeBridge.ts 是否只认 webkit.messageHandlers.saydoNative;Android 有无等价桥。键盘听写是否已覆盖 M1。1–2 周是否低估(权限/音频会话/中文识别探针/origin+nonce)。

5. 生产配对作为「必须且只实现一次」:与当前占坑战役(docs/release/2026-08-13-store-submission-status.md 勿传 spike)是否冲突;4.7 源白名单能否在完整 Noise 协议之前先对齐 iOS allowsProfileURL。

6. 4.2 演示模式:DEC-9 审核夹具是否已选家里 Mac mini;演示模式是否前置。

7. 材料 B 的 A2「去双击但保留 iOS resume 强制」是否站得住,会不会把僵尸 OPEN 和健康 OPEN 混为一谈。

8. 材料 B 把 CallKit 放进「不要做」是否过杀——战略上该不该做,只是不该本周做?

输出终稿必须能直接当「方案建议」用:本周做 / 本周不做 / 触发线后再做 / 需要 owner 拍板。不要再给一份愿望清单。
</research_mode>

<structured_output_contract>
Markdown,简体中文,零 emoji(勾叉用 [ok]/[warn]/[fail])。

# 69 移动外壳战略交叉对抗审
> 日期/HEAD/只读

## 终裁
一段:采纳哪条战略主轴、推翻哪条工时分配、本周唯一完成定义。

## Findings
编号 A/B/C。每条:标题、打哪份材料、证据 file:line、对最终方案的含义。

## 硬矛盾裁决表
列:议题 / 材料 A / 材料 B / 代码终审 / 方案建议

## 证伪
两份材料里被推翻的句子,原文+实际情况。

## 可派工条件
若终裁「可派工」,列出最小范围;若「需修订」,列出终稿必须改掉的处方。
</structured_output_contract>

<default_follow_through_policy>
缺真机照片时标 [warn],不要因此否掉代码已锁死的机制结论。不要问 owner 问题;把该上浮的拍板写成「需 owner 拍板」条目。
</default_follow_through_policy>

<dig_deeper_nudge>
若发现材料 B 的 Critical 链有旁路(peeked/forceMobile/first-run/via 误标 local),必须写清旁路是否真能进 MobileApp,不能停在「看起来像」。
</dig_deeper_nudge>
