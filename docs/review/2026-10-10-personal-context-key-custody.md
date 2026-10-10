# 本机签名密钥托管实施与独立复验

实现提交：`0d658656cb5a740a0c4dc3176d9b6c43985b1462`；基线：`3b471815812830f89784ee6d222173f2258691fe`。本报告是独立证据提交，不自指。

# SayDo 本机密钥托管候选

冻结时尚未提交；实现现已按本报告开头的提交保存。独立树 C:/WorkSpace/Saydo-anyvia-w10-20261010，Git 基线 3b471815812830f89784ee6d222173f2258691fe。manifest 同时保存任务交接 raw base 与 Git base；docs/09 的交接 base 已包含经两路评审但未提交的 19.2.3，不能用 Git base 替代该审批输入。

## 实现边界

v39 持久意图与不可删除、单调状态约束；Owner 严格 provision API 在读正文前后验证本人身份。先同库审计 pending，再调用系统，精确回读与原登记 CAS 后 stored。重复请求仅返回当前事实，不重写；启动 pending 隔离 unknown。生产 main 总是绑定真实 Windows Credential Manager，其他平台明确不可用，registry enable 与 currentPeer 检查完整私钥描述及当前登记。纯元信息测试继续使用无系统仓的 registry，不被描述为生产认证。

撤销先使登记、许可及内存认证失效，再收紧密钥记录；审计清理失败不会恢复登记，不自动物理删除未知凭据。系统仓内存 KeyObject 由运行时管理，不声称可保证物理清零。返回值按 canonical 只含 operationId/state/publicKey/publicKeyDigest，不回传私钥或系统引用；没有连接成功宣称。

生产备份在独立 SQLite 副本内隔离所有非 revoked 登记（包括 registered）、许可与密钥准备记录，原数据库和系统私钥不改。实际恢复演练验证旧凭据仍存在也不能启用。任意手工回拷原数据库、旧备份、独立非备份撤销水位、Mac/Linux 系统仓、完整业务传输和 Owner 可视化管理仍未完成，不据此宣布 W10 全部实现。

## 相邻实际修复

backup.test 的 cwd 随机根不满足现有 home workspace 规则；改成新随机 home 子目录并登记精确测试根，使用生产初始化和本次 managed workspace 的真实 owner ACL，清理前关闭数据库。原红保留，生产权限门未放宽。

dry-run-restore-snapshot 原实现注释承认 home 规则却落仓库，真实子进程 verifiedProjectWorkspace 被拒绝。改成新随机 home 演练目录，调用生产状态根初始化，并对自己新建的项目目录设置实际 owner ACL。原快照摘要和原密钥行不变，演练目录独立，负向损坏项目角色仍被拒绝。该工具仅演练恢复，不是通用恢复权威。

## 证据

- 044554711893Z-saydo-custody-final-v2：4 文件 38/38，source/artifact 双稳定；新增 T10.114–127 共 14 项，backup 15、registry 8、旧迁移 1。
- T126 使用真实 Windows Credential Manager，仅执行本次 create(test) 新 UUID，stored/enable/revoke/留存核对，然后完整 descriptor 精确删除并验证 absent；不枚举或查询旧凭据。其他 OS 故障测试明确使用软件 keyStore，不能算系统故障注入验收。
- T127 生产 snapshot→实际 Node 恢复演练→新库旧授权拒绝，原快照 SHA 和原密钥行不变；原软件私钥保留。不是实际用户恢复。
- 044618723877Z：daemon 类型通过；044145591516Z：生产 lint 无错误，测试文件被现有 eslint 配置忽略（不能称其已 lint）。此后仅测试与恢复工具修正，工具实际执行通过。
- 044640503725Z：既有 test:tools 全部退出 0；044650612883Z emoji 通过；044717760786Z privacy 通过；git diff --check 通过。
- 所有 wrapper 内外源摘要均记录。日志名称、字节、SHA 见 evidence-logs.json；根归档由 root 统一执行。

原红不覆盖：043736 types 新 actor 不属于既有 union，改 daemon；043840/043957/044122 旧 backup fixture 路径与 Windows ACL；044238 实际演练根违反 home 策略。044419/044503 的 T127 失败分别是新测试漏 requiredRoles 与无 session 对应 JSONL，验证器正确拒绝，修正测试输入后原业务断言保留。

## 复验

在 Octoooo 使用现有 run-saydo-check.py 固定 Node22/pnpm10，执行 @saydo/daemon vitest 的 personal-context-key-custody、backup、ddl-v32-v33-backup、personal-context-registry 四文件，maxWorkers/minWorkers=1。T126 会创建且清理仅本次独立 test 凭据，不能在评审中改成 production 或既有目标。审查优先冻结 overlay，只读核 SHA。业务路由尚未装配，不启动日用 daemon。


## 第二冻结增量：CUSTODY-S01

原 custody-20261010T044759Z 包不改。独立安全 reviewer 的实际两 SQLite 连接反例证明：currentPeer 中系统读取阻塞期间，第二连接已撤销登记而旧读取仍返回。原 oracle SHA170719268c3d2be296cc765ac2db650e8c267e4e5f9faeb73b29cac128ebb326；原红日志 SHAe14d12f96d9d30990158bee9d0efee02e1f024ec6062de7f652b0092c0ab70c1，均保留。

修复 assertReady 在真实 store.load 与私钥摘要核验之后重新读取完整登记及原 key intent，JCS 精确比较全部身份/state/revision/描述/OS事实，同时再核持久时间水位期限。任何变化拒绝，不用当前新 revision 替换原授权。此修复不替代各业务 final writer 的独立复核，不宣称防御同用户任意篡改系统仓。

T10.128 新增作者反例覆盖分别撤销登记/密钥记录；045217559728Z 两文件23/23通过，包含真实新test凭据与恢复工具相邻旅程，source/artifact双稳定。045239附近独立 types/lint 均退出0，具体日志摘要在 evidence-logs。审查者原 oracle 未改独立复验 1/1，证据 artifacts/w10-saydo-custody-review-security/fixed-evidence.json；旧backup15/旧migration1源码未变，沿用044554通过，不冒称本次重跑全38。


## 第三冻结增量：完整系统调用期限

本版扩为14路径，新增 clock.ts 原始基线，旧044759/045329冻结不改。root指出固定墙钟下成功load跨期，作者T129真实红045452029469Z（Saydo输入稳定；外层Octoooo sourceChanged=true如实保留）；独立reviewer S02进一步证明失败load跳过elapsed，原红留在security目录。作者T133另证系统create跨期仍错误stored，050235094951Z双稳定红。上述均已修复，不把此前局部绿当完整期限验证。

时钟仍仅一次wall观察，外层保留performance原起点；阻塞OS调用成功/失败均观察非负、有限、不倒退且safe-int的单调差值。provision全流程共用该scope，durable intent仍先独立同库审计事务，beforeWrite前检查已耗期限，最后仍对原登记/意图CAS。create/load失败原异常以cause或Aggregate保留，不自动重写。assertReady同时保留load后的完整行身份复核。

外层业务事务结束后独立提交已观察到的最低水位，故enable回滚不复活过期登记。提交失败保留原业务错误和clock错误；未提交最低水位在当前Db实例内保留，下一操作先尝试提交，否则继续拒绝。它不是跨进程独立持久证明，不声称磁盘永久失败后仍可证明已持久化水位。没有测试中修改production clock跳过分支。

最新050416254323Z：6文件62/62通过（custody T114–134共21、backup15、events13、registry8、journal4、旧迁移1），source/artifact双稳定。050438600054Z types与050438599522Z lint均双稳定通过。T130同事务enable失败水位；T131真实SQL触发器拒绝提交双错及后续拒绝；T132失败load与提交失败组合；T134分别beforeintent零写、create失败和load失败跨期unknown及水位。之前no-unsafe-finally lint红045836保留，控制流改为退出finally后显式处理结果/原错/水位提交，无规则屏蔽。

冻结时待独立 reviewer 核对；最终 S01/S02 原 oracle 与 clock 扩大面的复核结论见下节。业务19.2.4仅在Octoooo ignored目录提案，尚未混入此冻结源码，未称业务连接完成。


## 最终独立核对

第三冻结14路径ZIP SHA `f6b0be7ba20758ab131a28df861ef45584387ea8e7f4f5f9aaf4e2d58dce89ce`，manifest SHA `41c4ab6fa0621b493c764bfe2411667de3b6c20e40e09a7ed3250ec145c36d27`。安全reviewer核所有14当前源码与冻结字节一致、ZIP CRC通过；未修改的S01/S02原反例最终2/2通过（第三包独立证据third-frozen-verified.json）。独立反例为软件OS屏障与真实SQLite，不升级为真实OS故障注入证据。另一reviewer对原13路径完成生产接线/恢复边界只读审查；后续clock扩大面另经根读审及原安全反例核对，不把旧报告冒称新14路径全重审。

最终实现新增T10.114–134共21项；六文件62/62通过。最后实现提交前emoji、privacy、git diff --check通过（050703992546Z/050703992053Z）；生产lint和daemon类型通过。实际Windows只有本次随机测试命名空间，不触碰用户已有凭据。未跑完整daemon启动或双方生产业务握手，没有宣称W10/完整Anyvia验收。

以下日志在本轮Anyvia实施任务的 `artifacts/w10-saydo-development/` 外部证据目录保存；不把*.log加入SayDo Git。所有重要原红保留，表中SHA用于精确取回，旧原失败不可删除重写。

| 日志文件 | 字节数 | SHA256 |
|---|---:|---|
| `20261010T043346149240Z-custody-initial.log` | 319 | `c5cbe69e6ecfd83456d9993bc1b0284ca3b09b068b6237fe8f644517278b16b4` |
| `20261010T043713257724Z-custody-http.log` | 383 | `6b2575748ca177d5a5d44d5eaed00360f92a16e90dbd586dba468e4d2e476333` |
| `20261010T043740413328Z-custody-types.log` | 624 | `3e97a30c359114d85253a30502b13dcb3b640f194f599cadb3a11037c25f33d2` |
| `20261010T043844210056Z-custody-backup.log` | 7313 | `34549c2c9e3ab82f23eb2e22e3a4f7f57447a2fb268c174077f0ab4379adcb2d` |
| `20261010T043854580641Z-custody-types-v2.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T044002351750Z-custody-backup-v2.log` | 3941 | `425968a0d1032051abdfb6f0edd555191adf30ab8ffbceebca6f9aa105b83380` |
| `20261010T044125931091Z-custody-native-backup.log` | 3890 | `b4058f8b2685d61a642c57fabc80351acf7e728babcb6fa22b4dd8a3b40de8cf` |
| `20261010T044149261453Z-custody-lint.log` | 366 | `eeb727d27ee0bd0c445c8894e07a55e33a9e63eababae73010766674ccfd44c5` |
| `20261010T044149262315Z-custody-types-final.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T044241099380Z-custody-backup-final.log` | 19708 | `bd27e63a75aa17dd6427b9685b8969e69d6c29b29d50c5475defd61793b2439a` |
| `20261010T044259745325Z-custody-privacy.log` | 67 | `0323048e9a168f8aae9efa7e800c410606ecfffb472bbead2ed207fed3653246` |
| `20261010T044259747979Z-custody-emoji.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| `20261010T044422528585Z-custody-restore-tool.log` | 6525 | `da4cdfb035b75fec049f20fa0f2d42fff729e966027496b5da3b36022d13b063` |
| `20261010T044440184676Z-custody-types-tool.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T044506238773Z-custody-final-suite.log` | 3400 | `fe6a31538ec5b103192871e5c6dec33c811d8ab655b06af5200193b5cbc511d8` |
| `20261010T044557884020Z-custody-final-v2.log` | 935 | `0efea7316f3ce958a4e32c6b96db345bc3bd0344ed71eb3b6d65d905d5acfda2` |
| `20261010T044622542130Z-custody-types-last.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T044643616228Z-custody-tools.log` | 4842 | `933ce49ab7de970f46cb0dda612a5cb7ac799a919f40a5ce5196bad5d3bbe49c` |
| `20261010T044653907654Z-custody-emoji-final.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
| `20261010T044720656823Z-custody-privacy-final.log` | 67 | `0323048e9a168f8aae9efa7e800c410606ecfffb472bbead2ed207fed3653246` |
| `20261010T045220973193Z-custody-race-fixed.log` | 740 | `bfbca66322c40d0866e8b724ae063d9280655f0b525f29945c53e449683f814f` |
| `20261010T045243096919Z-custody-race-lint.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `20261010T045243096955Z-custody-race-types.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T045454806828Z-custody-expiry-red.log` | 2999 | `7451f1ccb519b9f49fef2ede5114255a2122bc00283c692e98485fcc5f803f17` |
| `20261010T045657332489Z-custody-expiry-fixed.log` | 860 | `30566709a9db25a51a99e25634761bd1393647ba3eeeef6b18e88ac4962929b5` |
| `20261010T045731382609Z-custody-clock-types.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T045839907394Z-custody-clock-lint.log` | 389 | `d6d94c77a4c76db19fd56fcb69a741b094e6cdbc73b3579a66a7e316e5af4ea9` |
| `20261010T045930929218Z-custody-clock-final.log` | 973 | `1892887754dbd932a0e5e43bbe61f9c57d88f0c9ab2da0600356b15af61c2dd6` |
| `20261010T050018529897Z-custody-clock-lint-v2.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `20261010T050124545682Z-custody-clock-error-fixed.log` | 976 | `70a025891a3ea6bb620efb76374dd68ff8d77b58ce3aede1857d364da7ba8e75` |
| `20261010T050141997485Z-custody-clock-error-lint.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `20261010T050141997621Z-custody-clock-error-types.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T050239642702Z-custody-prepare-expiry-red.log` | 3533 | `1478103754a1af0bc999edfd28642ba0d5992daedad5661a3165f9e0f15cc591` |
| `20261010T050326111988Z-custody-prepare-expiry-fixed.log` | 976 | `c1d5f4a25032995b65d822e6790e22707b3d54f9bfa22de94e63a60c7fd57f55` |
| `20261010T050419516225Z-custody-complete-fixed.log` | 1407 | `4cdeefdbfff183bee08b8681e286c7eb70b4b4303fc6d26467ee7c2d0853061c` |
| `20261010T050442781816Z-custody-complete-types.log` | 104 | `d8e6dfc36e67c336f99cb0094f3d296aebeecc1ea58cf1c713feeef436d41003` |
| `20261010T050442783361Z-custody-complete-lint.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `20261010T050707160502Z-custody-commit-privacy.log` | 67 | `0323048e9a168f8aae9efa7e800c410606ecfffb472bbead2ed207fed3653246` |
| `20261010T050707177705Z-custody-commit-emoji.log` | 23 | `e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3` |
