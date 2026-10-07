# 托管 CI 的 ripgrep 依赖回修

代码提交：`5fb897c5128cce18c7beda61eeb5e391a299cc09`。两轮精简已在私有 main `59f71c5e` 与公开快照 `3f48fbf2` 推送后，两个托管 Node job 均在 memory-retrieval 两项真实测试失败：`spawn rg ENOENT`；工具/发布专项、Python、浏览器 E2E 已通过。本次保留原失败事实，不把已合并/本地通过混称托管全绿。

第一轮删除了原名“Install emoji gate scanner”的 apt 安装步骤，但 `packages/daemon/src/memory/retrieval.ts` 仍实际启动 rg。这是本轮误删共享运行依赖。回修仅在 ci.yml 的 Node job、pnpm install前恢复安装 ripgrep，步骤名和注释改为仓库检索运行依赖。不恢复退役门、不跳过测试、不改产品或断言。

一名 fresh 非作者 reviewer 只读核验根因、真实消费者与3行diff，无范围内阻塞；YAML解析、emoji和差异卫生通过，前后 git-diff-v1 `cdbf3b63502f8f467138a962abd81203a76888b0ab96f454b25224ce38409a37` 一致。本证据提交时修复后托管CI尚未运行；新SHA推送与终态记录在外部最终报告，不预支通过。

原始证据位于仓外任务目录 `saydo-gates-round2-20261007`，日志不入Git。

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `public-ci-failed.log` | 180799 | `829577fecaa2cb791946de2ee964a6295fe453a9554653719c2e550b99d4f3bb` |
| `private-ci-failed-final.log` | 241489 | `349d2b0f8d682435bb1eb652cd76aedae83ac97ffe25a8228e8bf7f75b1f1593` |
| `remote-ci-initial-result.json` | 2981 | `59978a325242bdffd686bc67e85e80469c110cdf7da48b3a7cfe231645843a98` |
| `ci-ripgrep-fix.md` | 1424 | `e16777107e22c1ace90754730d223ca8090a2b801c5f0f1a53874f03530d3c5c` |
| `ci-fix-review.md` | 1688 | `c4a099c8d0964bcefdb87d4272aecca574ddb0ba04dca335d2a3ea2e7c0c57d6` |
