# 73 现在做/可后置 对抗审

> 日期：2026-08-16 11:45 +0800；HEAD：`3197fd8a2b60e4cd948ef2efe9e8fa3a7c5853ca`；全程只读，未运行 lint/测试，未改仓库文件。

## 终裁

需回修后接受。`remote-mobile gate + foreground reconnect + 09 三条 GET 回写`仍是正确、克制的下一候选工程批，但“唯一现在该做且能产生狗粮价值”说得过头。必须先完成最小 B4 治理并经 owner 开批停点；把 A2 从“删一份 visibility”收紧为三类事件单一 owner；补齐 RFC1918、Things、文本、first-run、横屏、来源头与重连连发验收。`native_api`、Claude SDK、R-B、DSH、W6–W9不应塞入本批；四场真人验收则不能简单排到本批之后，应作为独立 owner 轨并行推进。

## Findings

1. A｜不部署使“现在做即真机狗粮”失去事实基础

   - 打建议：[`docs/review/2026-08-16-now-vs-later.md:22`](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:22)、[`:24`](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:24)、[`:56`](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:56) 将价值定义为“真机现在不可用”，同时明确不部署。
   - 证据：`git -C ~/.saydo/runtime rev-parse HEAD` 返回 `ada7981c67ef...`；`git rev-list --count ada7981c..HEAD` 返回 `281`。对 `MobileApp.tsx`、`SetupBootstrapBoundary.tsx`、`mobileLan.ts` 执行 `git cat-file -e ada7981c:<path>` 均 exit 128，说明常驻树连 M1/T19 代码都没有，而不是正在命中 T19 probe 回归。两次 `curl 127.0.0.1:47100/health` 均 exit 7。
   - 对实施范围的含义：代码批仍有“关闭 main 上已知回归”的价值，但不部署就没有常驻狗粮价值。若维持“不部署”，必须把完成定义改成“代码与临时 LAN 证据就绪”；若要称狗粮，需 owner 另批部署时窗并做持久 runtime 真机烟测。

2. A｜B4 必须是开批前置，不能降成批内半小时治理

   - 打建议：建议 [第 37 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:37) 把 HANDOFF/PLAN 关系放在“同批治理”，[第 72 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:72) 直接写指针开批。
   - 证据：PLAN-2 明定唯一排产源和单仓单批规则（[`IMPLEMENTATION-PLAN-2.md:123`](~/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:123)、[`:171`](~/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:171)），批生命周期要求先生成 prompt、owner 停点再实施（[`:172`](~/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:172)），当前顺序仍写“下一工程批=W5 剩余 5.4”（[`:178`](~/WorkSpace/SayDo/docs/plan/IMPLEMENTATION-PLAN-2.md:178)）。HANDOFF 指针虽为空，但末次提交确为 `97b01f7`，没有记录 8 月轨道（[`HANDOFF.md:21`](~/WorkSpace/SayDo/HANDOFF.md:21)）。
   - 对实施范围的含义：施工前先明确更新 PLAN-2 的插队关系和 HANDOFF 状态，再由 owner 确认 `remote-mobile-w0` 开批。仅在本建议或批末补一句，不满足权威源纪律。

3. A｜A2 不只是双 visibility，手动重连也有双 owner

   - 打建议：[第 26 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:26) 和 [第 75 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:75) 把 A2 收成“删 MobileApp 第二份 visibility”。
   - 证据：`MOBILE_RECONNECT_EVENT` 与 `WS_RECONNECT_REQUEST_EVENT` 都是 `"saydo:reconnect-request"`（[`reconnect.ts:12`](~/WorkSpace/SayDo/packages/console/src/mobile/reconnect.ts:12)、[`useVoiceChannel.ts:124`](~/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:124)）。MobileApp helper 同时监听 visibility、native-resume、手动事件（[`reconnect.ts:32`](~/WorkSpace/SayDo/packages/console/src/mobile/reconnect.ts:32)），`useVoiceChannel` 又监听 visibility 和同一手动事件（[`useVoiceChannel.ts:409`](~/WorkSpace/SayDo/packages/console/src/voice/useVoiceChannel.ts:409)）。现有测试只验证三个事件依次触发三次，没有覆盖合并（[`reconnect.test.ts:21`](~/WorkSpace/SayDo/packages/console/src/mobile/reconnect.test.ts:21)）。
   - 对实施范围的含义：维持 A2，但验收形状必须是 visibility、手动、native-resume 归一个 owner，稳定 `reconnect` 引用并短窗口合并；覆盖 `OPEN`、`CONNECTING`、僵尸连接和事件连发。

4. A｜当前验收清单会让 A1/A2 假绿

   - 打建议：[第 32–34 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:32) 实际只钉了 bootstrap 单测、Today RFC1918 用例和横屏。
   - 证据：现有横屏测试 [`console.spec.ts:158`](~/WorkSpace/SayDo/e2e/console/console.spec.ts:158) 使用本地 `open()`，不是 RFC1918；真正 LAN 用例分别是 first-run（[`:182`](~/WorkSpace/SayDo/e2e/console/console.spec.ts:182)）、Today（[`:195`](~/WorkSpace/SayDo/e2e/console/console.spec.ts:195)）和文本链（[`:211`](~/WorkSpace/SayDo/e2e/console/console.spec.ts:211)，没有 Things。Today 用例只断言 Origin/Referer，没有 WS 或 `Sec-Fetch-Site`。Codex 70 的可派工条件明确要求 Today、Things、文本、first-run、横屏、API/WS 三类来源头及二维码 RFC1918 预检（[`70-mobile-together-scope-review.md:117`](~/WorkSpace/SayDo/research/codex-findings/70-mobile-together-scope-review.md:117)）。
   - 对实施范围的含义：补定向用例和真机/浏览器证据，不必修全套 29 条桌面 e2e。若只跑 Chromium，不得宣称 WKWebView 或真机狗粮已验证。

5. C｜四场真人验收不进工程批，但不应进入普通“后置队列”

   - 打建议：[第 45 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:45)。
   - 证据：场次①仍为 `failed`（[`session-1.md:54`](~/WorkSpace/SayDo/e2e/owner-sessions/session-1.md:54)），②③④均为 `not_run`（[`session-2.md:78`](~/WorkSpace/SayDo/e2e/owner-sessions/session-2.md:78)、[`session-3.md:54`](~/WorkSpace/SayDo/e2e/owner-sessions/session-3.md:54)、[`session-4.md:85`](~/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:85)），④仍定义为最终发布裁决点（[`session-4.md:5`](~/WorkSpace/SayDo/e2e/owner-sessions/session-4.md:5)）。既定行动序要求选 target/preflight 后约①，并与 LAN 竖切并行（[`2026-08-14-saydo-phase-gap-analysis.md:92`](~/WorkSpace/SayDo/docs/review/2026-08-14-saydo-phase-gap-analysis.md:92)）。
   - 对实施范围的含义：四场不加入 `remote-mobile` 代码批；但 owner 对 v0.1.0 target、部署时窗和场次①的动作应并行启动，否则发布门继续零进展。

6. B｜worktree 的“两棵/落后 47”成立，脏区定性过窄

   - 打建议：[第 12 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:12)。
   - 证据：`git worktree list --porcelain` 确为两棵，`git rev-list --count 946cc68..HEAD` 确为 `47`。但 detached worktree 有 25 个 tracked 改动，`git diff --stat` 为 `70 insertions(+), 75 deletions(-)`，涉及 console 组件、tokens、门禁脚本、三端元数据；其中 `vite.config.ts` 还把固定端口改成环境变量，并非 token/文案。
   - 对实施范围的含义：未发现独立已提交的 SayDo 功能分支，但“只是 token/文案小改”应删除。该 worktree 清理仍不并入本批。

7. B｜Focus 与 runtime 口径应区分 HEAD、配置缺省和已部署树

   - 打建议：[第 13 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:13)、[第 16 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:16)。
   - 证据：HEAD 中 `focus.stage` 确实缺省 0（[`config/types.ts:97`](~/WorkSpace/SayDo/packages/daemon/src/config/types.ts:97)），stage 0 写闸存在（[`focus/stage.ts:65`](~/WorkSpace/SayDo/packages/daemon/src/focus/stage.ts:65)），live wiring 也已接入 `index.ts`。但 `ada7981c` 中两个 Focus 文件均不存在；当前 `/health` 又不可达。
   - 对实施范围的含义：应写成“HEAD 已实现、缺省 stage 0；旧常驻树未包含该实现”，不能把它简写成已部署生产仅关开关。结论不影响本批。

8. C｜`native_api` 可后置，但“Brain 四槽能跑”不是执行器缺口的反证

   - 打建议：[第 46 行](~/WorkSpace/SayDo/docs/review/2026-08-16-now-vs-later.md:46)。
   - 证据：默认 Runner 决策明确把 Brain 供给与执行层分开（[`2026-08-15-default-runner-decision.md:12`](~/WorkSpace/SayDo/docs/plan/2026-08-15-default-runner-decision.md:12)），当前只有 Cursor Tier1 是生产执行器（[`:31`](~/WorkSpace/SayDo/docs/plan/2026-08-15-default-runner-decision.md:31)），本轮也明确未改执行层（[`:126`](~/WorkSpace/SayDo/docs/plan/2026-08-15-default-runner-decision.md:126)）。
   - 对实施范围的含义：`native_api` 不应并入 2.5 份移动批；但若目标变成“无 Cursor 订阅也能执行”，它可能比未部署的移动代码更有价值，排序需 owner 拍板。其 19–29 人天和安全/恢复 spike 足以支持独立立项。

## 对「唯一本批=remote-mobile」的专项裁决

按字面不成立；收窄为“完成 B4 与 owner 停点后，下一候选小型工程批是 `remote-mobile-w0`”则成立。

本批应加：

- A2 三类事件单一 owner及连发测试。
- RFC1918 产品二维码、Today、Things、文本、first-run、横屏、API/WS 来源头证据。
- 09 三条 GET 与 payload/隐私边界回写。

本批不应加入完整 T19 29 条修复、`native_api`、Claude SDK、R-B、DSH、W6–W9，也不加入 CallKit、Noise、ADR-003。

常驻不部署会让本批失去持久狗粮价值：代码可合入、临时 daemon 可验收，但手机日常仍不会得到新能力。要么删掉“狗粮完成”措辞，要么增加 owner 授权的部署后真机烟测作为外部出口。

## 证伪

- [fail] “录制 worktree 脏区只是 token/文案小改”被 tracked diff 推翻。
- [fail] “当前真机正在被 T19 probe 门挡住”不适用于常驻 `ada7981c`；该树没有 M1/T19 文件。
- [fail] “A2 等于删第二份 visibility”不完整；手动重连事件同样双监听。
- [fail] “Today RFC1918 加一次横屏足以验收”被终稿/Codex 70 的 Things、文本、first-run、来源头和二维码预检要求推翻。
- [warn] “本会话探活 runtime/pipeline 同 SHA”本轮不可复现；只验证到静态 runtime worktree 为 `ada7981c`，服务当前连接拒绝。

未被推翻：两棵 worktree、落后 47、09 三路径零命中、三个分支均为 HEAD 祖先、`SetupBootstrapKind` 无 `remote-mobile`、SetupContext 丢 code、HANDOFF=`97b01f7`、仅有 `v0.1.0-rc.1`。历史 M1/first-run 曾 8/8，但发生在 T19 前；“T19 后当前源码预期红”没有过时，只能表述为未重跑的源码推断。

## 可派工条件

1. 开工前完成 B4：PLAN-2 写入 8 月临时轨道与 W5.4 的顺序关系，HANDOFF 回写现状并设 `remote-mobile-w0` 指针，pin 当时干净 HEAD/合同摘要，owner 停点确认。
2. 运行时代码范围维持：A1 `remote-mobile` 直挂移动树；A2 单一重连 owner；09 三 GET 合同回写。
3. 定向验收补齐 RFC1918、Things、文本、first-run、横屏、来源头和事件连发；不救全套 29 条桌面 e2e。
4. 明确出口：不部署则写“代码就绪、未进入常驻狗粮”；要宣称狗粮则需 owner 部署授权和真机烟测。
5. 四场验收另走并行 owner 轨；先裁决 v0.1.0 target，再部署/preflight，从场次①开始。

## Triage(主会话 2026-08-16)

owner 本会话指令「更新建议并开始实施」视为 `remote-mobile-w0` 开批停点。

| # | 级别 | 吸收 |
|---|---|---|
| 1 | A 不部署无常驻狗粮 | 吸收。完成定义改为代码 + 临时 LAN 证据;不宣称常驻真机已可用 |
| 2 | A B4 开批前置 | 吸收。本批先写 HANDOFF 指针与 PLAN-2 跨轨,再动代码 |
| 3 | A A2 三类事件双 owner | 吸收。visibility/manual/native-resume 单一 owner + 短窗口 |
| 4 | A 验收假绿 | 吸收。定向补 Things、first-run、LAN 横屏、来源头;不救 29 条桌面 e2e;不宣称 WKWebView |
| 5 | C 四场验收 | 吸收为并行 owner 轨,不进本代码批 |
| 6 | B worktree 脏区 | 吸收措辞,不并入本批 |
| 7 | B Focus/runtime 口径 | 吸收措辞 |
| 8 | C native_api | 吸收:不并入本批;「Brain 能跑」不证伪执行器债 |

未吸收为范围扩张:CallKit/Noise/ADR-003/`setup_local_only` 旁路/部署常驻/救桌面 29 红。
