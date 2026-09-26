# CODEX-AS-SPIKE-01 本地验收与收口

2026-09-23。owner明确授权「本地提交、合并与收口」。状态 LOCAL_GREEN_REMOTE_PENDING，仅指受控协议原型；无push、部署、真实模型或生产接线。

代码提交 `cbfdcde6bace96b68a7d78e3f67a7a8ab0af7d52`。提交前HEAD d0b7edce648fe7b54713bc19fa8af143f9d81628，git-diff-v1 84b6c0fa04e53def946977b99ce8dc6a5c533ca26decfe3bdda886d9a7e4b437。25个候选文件逐一SHA-256核验后原样提交。证据提交只更新记录和排产，不改产品实现。

## 已验范围

固定CLI0.153.3及生成schema来源；隔离stdio driver；有界JSONL/队列/pending及背压；自有task/thread/turn绑定；start/steer/interrupt和终态优先；持久发送意图、unknown拒重发；拒绝优先审批；次数/墙钟边界及所属进程清理。默认产品不加载原型。

fresh只读Codex gpt-6-astra/medium 的review-5为GREEN，无阻断/P2，前后指纹一致。check_delivery --deliver实际exit0、deliverable=true。此前RED均保留。原型108 tests通过，含24个适用ACK组合和16个其他unknown保护组合。

私有证据目录 `~/.codex/tasks/saydo-codex-as-spike-20260923/`，含acceptance、task、review-5、delivery-check、accepted-files及原始日志；不将私有配置/日志复制入Git。

## 完整门禁

以下依次为真实无模型握手、just ci、Playwright、precommit、schedule self-test；同一固定候选均exit0。

| 日志 | exit | 字节 | SHA-256 |
|---|---:|---:|---|
| gate-6-1.log | 0 | 389 | `d9a30d61ce6fbe659e445e3abf00c36f8d7555fd7846bf38d8ad0a4aea1281b9` |
| gate-6-2.log | 0 | 118569 | `8188668aabe2f548e342443d5a6614812e56bde03983d1222b4b75abd40b9e43` |
| gate-6-3.log | 0 | 7081 | `7db0d8a3151665b0b6d403188672dae1b34fd52583808c78b83890fa79046639` |
| gate-6-4.log | 0 | 393 | `37f53aa4dfec524983327e6b4d3ab91e47840160e6f7eac7b3358d1492e42ce0` |
| gate-6-5.log | 0 | 398 | `90a58bdf2d8e346d4f7152dfe006f83365c49b8f37cffb199d4ef5d4cf0cbfff` |

Node3374 passed/21 skipped、Python110 passed、浏览器54 passed；108原型测试已计入Node总数。握手脚本exit0，实际initialize/initialized成功，所属子进程SIGTERM退出，无SIGKILL；不混称子进程exit0。独立报告落盘后emoji检查exit0。

## 历史及边界

累计修复5次、独立首审1次及复审4次、程序恢复2次。初始预算3次修复/3次复审；owner先后具名追加两次各1修复+1复审，有效累计上限5/4，同根追加也记入任务账。角色和原policy快照未改，无活调用。程序恢复为一次未改动HF测试全量复跑及一次review launcher本地metadata纠正；前者根因未确定，后者未发模型调用。旧握手解析/隐私失败、旧RED与修复前失败反例全部保留，不称历史首次全绿。

真实Agent、真实审批效果、MCP/网络/浏览器effect覆盖、重启恢复、设备、远端CI与生产接线not_run。PG-07仍deferred；HF L5仍延期。真实无模型握手不证明生产或真实模型控制。

收口排产revision16，active=none，next=PG-02，last_closed=CODEX-AS-SPIKE-01。PG-02未开工；不借本地收口扩批或自动执行真实模型实验。
