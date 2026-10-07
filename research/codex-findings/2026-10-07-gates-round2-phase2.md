# 第二轮门禁精简第二阶段与本地清理

代码提交：`c6e621c45aabe5642796546a4c2080ea1584bc9f`。第一阶段已完整提交 `2f628516`/`d93cb42f` 后，才启动两名新的只读 reviewer 评估和交叉 challenge。双方同意只补现有 shell 安装 harness 两项，实施核验均无范围内阻塞。

## 最小补足

仅改 `scripts/test-install-scripts.mjs`，新增98行、删除4行。真实运行当前 install.sh：错误 digest 必须正常非零退出、报告包校验失败，且未调用 npm、未生成 CLI/launcher/shell 配置；成功场景记录完整 NUL argv，核对唯一固定版本 tgz、用户 prefix、下载落盘/摘要输入/npm 消费的文件路径与内容。原有路径注入、launcher、PATH 验证保留。

不补 legacy 风险表：现有 cmd-effect 的核心 S0–S3、敏感标记、具体反例与整链 deny/零确认已有独立期望。没有重建历史快照、静态库存、manifest、额外框架或 required CI。PowerShell/SSH、Node 下载、周审身份与恢复合同不扩入本轮。

受控 curl/SHA/npm 只证明 shell 控制流和实参/fixture 绑定，不证明真实散列算法、网络、发布包可安装或供应链全链验收。产品代码与生产安装脚本均未改。

## 验证

安装 focused 通过；两名非作者 reviewer 各自独立选择运行安装专项，均 exit 0。冻结 diff 指纹 `ad8f04132a24dbf031bc6d39bc20faabd71c722ef123c148d29919f3587e40d1` 派发/收回一致。

另在外置临时副本对实际 install.sh 做两次一次性突变：绕过坏 digest 拒绝、改装 registry/latest，均被新增断言捕获并 exit 1（这是预期负向结果，不是候选失败）。突变副本已移除，没有将突变框架加入仓库。

主持最终 `pnpm test:release` exit 0（45.180秒）、`just precommit` exit 0（2.013秒）。本阶段仅安装测试文件变化，沿用第一阶段 Node3954pass/21skip、Python159pass、tools通过证据，不重复产品全门；浏览器仍沿用第一轮66pass，未写成本轮重跑。真实平台/设备/provider与部署未验边界不变。

## 本地清理

对可识别的SayDo开发/评审副本做Git、改动与忽略文件盘点，归档后移除101个旧副本，其中38个登记worktree、24个含未提交改动；另删3条已合入main的旧分支。每个副本保存状态/refs/binary patch/index patch、非缓存文件归档，必要时保留独立Git bundle；删除前核对文件SHA-256和符号链接目标。依赖/语言缓存不作为恢复必要数据。当前main、实施候选与本轮review树保留到合并验证后再收回。

一次清理遇到共享alternates对象库已被移除而停止；由已备份独立bundle恢复对象、重新核对status/diff/index后继续成功。初次失败日志保留。恢复包位于仓外 `SayDo-task-artifacts/cleanup-20261007`，完整清单与本地绝对路径只保存在外部 `cleanup-report.md`/`cleanup-result.json`。另一项目OctoWorkFlow的借用证据副本以及测试/运行fixture仓保留，不声称全盘所有.git已删除。

本证据提交时尚未合并/推送。后续将按授权快进main、推送私有归档，并通过现有隐私过滤脚本同步公开快照；实际远端SHA/托管CI回执记录在外部最终报告，不预写通过。

## 原始证据

外置目录 `saydo-gates-round2-20261007`；日志不入Git。

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `phase2-proposal.md` | 7866 | `e04eb2b582fda219f1198216b383294b12a3b5272ad15e1223753372ed0b42e9` |
| `phase2-review-a.md` | 3335 | `7db0f923b444a78e6a98ece139296598e64a999ead97d120cd3019a74c7724bf` |
| `phase2-review-b.md` | 3911 | `0ad029b7e06f6164543a36b61cdb2d365be6d8966660fe7ff7e00a5268957811` |
| `implementation-phase2.md` | 3710 | `29cf5a915fdfa8fb9ad142696ec7f4d360df8f881805a1326656dc123cb2ebee` |
| `phase2-install-focused.log` | 132 | `fb0ae75bd113f45c85f029ebc302f83c67d859ae6a8c34e6b110241b04b7eedd` |
| `phase2-mutation-digest-bypass.log` | 670 | `66b52637b6d4d0e4a741eeea3372376a6950dee0cbbb938048f36edfd62ea7a9` |
| `phase2-mutation-npm-latest.log` | 1006 | `9caae085c180e6c0ece372508813dd269db7551a2f967af63de021220b7a2976` |
| `phase2-implementation-review-a.md` | 2665 | `2c59c6354b7064df727d32c755e6ee1b51577527d6e95bb0fab26210c0bfae07` |
| `phase2-implementation-review-b.md` | 2686 | `ac86f56ac031c95bb8a4318cb6a313951d5efdcb00c5bd9b9bfdceb61ea4677d` |
| `phase2-final-release.log` | 11863 | `4b410c78c27488a15c4c7fb4de0a96f11510932272b14ae090017634ee5abf74` |
| `phase2-final-precommit.log` | 251 | `70ecdcce916d6e94088349b8aea8e6fd1416d66927c1dcd6dcdfd7539a16b31f` |
| `cleanup-prepare.log` | 126 | `4de1166146a7e8547a86be1c5242eee53a8700ea807a33001928ac18e31c7949` |
| `cleanup-remove.log` | 1047 | `3eccadb029a1d48cf28d3a3308dfdd5250bb0bd99c87c5a44c4e6081a4686098` |
| `cleanup-remove-resume.log` | 67 | `ebfeb059b3a1ecbf50a2e72c12d1069965ff6abcab963ac35503616b69b75b86` |
| `cleanup-result.json` | 35833 | `3205404c56fcecd8073846bae26e61944261dbb3ab3984a0ec1b8cb5269884f8` |
| `branches-cleaned.json` | 403 | `096b0ffcd39c9f943aa6503b68a55a95731381e0eef0a20887fe886e124f7e92` |
