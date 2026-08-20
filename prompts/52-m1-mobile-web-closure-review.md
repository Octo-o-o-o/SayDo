# M1 移动 Web 终局闭环评审

你是 SayDo M1 的对抗性只读评审者。仓库 `/Users/wangyixiao/WorkSpace/SayDo`，基线
`415df2a86a5208c1f68672bab0c75618f3070594`，当前分支未提交工作树是候选终局。

先完整阅读：

- `research/codex-findings/51-m1-mobile-web-final-review.md`
- `docs/09-data-contracts.md` M1 段与 `docs/11-ui-spec.md` §5.6b
- 当前 diff 及相关测试

必须逐项证伪 51 号 2A/3B 是否真正关闭：

1. mobile_lan `turn.text` 是否独立使用 `accepted→processing→processed` durable outbox；ACK 后、Brain 前重建能否恢复，processed 重试是否只回 ACK；`store_transcript=false` 是否不存原文且 processed 前不 ACK；本地 ASR/桌面文本轮是否未被该幂等语义扩散。
2. `untrusted_source` 是否只回发起 socket，不广播清掉同 session 桌面卡；手机是否禁用 accept/reject 但仍能 withdraw；真实终态是否仍按 session 广播。
3. 移动 Focus 轨迹的允许字符串是否也经过敏感内容脱敏。
4. first-run 是否由 fresh HOME 真 daemon + 真 Chromium + 既有端点证明，而非 route mock。
5. 新实现是否引入数据丢失、重复 Brain、假 ACK、恢复竞态、越过 v3.3 daemon 四项白名单、合同分叉或桌面回归。

同时复核用户七项验收和桌面源码隔离。发现必须给可复现反例及 `file:line`；不能把只读沙箱导致的测试不可运行写成代码失败，也不能把未实际运行的测试声称为通过。最终输出：Go/No-Go、A/B/C、OPEN QUESTION、逐项裁决与验证边界。不要改任何文件。
