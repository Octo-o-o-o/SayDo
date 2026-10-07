# SC-RELAND-01 处置证据

> 2026-09-25 重落地批:把 `archive/wip-consolidation-20260913`(基线 `49ed96f`)对账出的
> SC-04…SC-59 独立缺陷修复,按当前 main 逐项复现、判定并落地仍然有效的修复。
> 候选分支 `codex/sc-reland-01`,全部改动未提交。判定词:`relanded` /
> `already_fixed_on_main` / `superseded` / `not_reproducible`。
> 本文只记实施侧证据;独立复核与完整门禁复跑由 supervisor 负责。

## 处置表

| SC | 判定 | 复现方式 | 修复前 → 修复后 | 涉及文件 |
|----|------|----------|------------------|----------|
| SC-04 | already_fixed_on_main | 逐字比对 `remoteSurface.ts` 与 console `apiErrorFromResponse`:当前 main 已将 `remote_business_forbidden` 落入业务关闭提示分支,不再当通用 403 认证失效 | main 已修,候选未再改 | packages/daemon/src/api/remoteSurface.ts、packages/console(错误映射,main 已有) |
| SC-05 | relanded | 注入永不 resolve 的 connect,`sendEmailSmtp(timeoutMs=10)` 旧版 101ms 仍 pending(来源探针语义) | 连接与 TLS 握手同受总截止时间,超时返回 false 且迟到 socket 回收;`callback-email.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/callback/email.ts、packages/daemon/test/callback-email.test.ts |
| SC-07 | relanded | 子进程在父进程关闭 stderr 读端后调默认 logger 触发 EPIPE exit 1(来源探针) | `process.stderr.on("error")` 隔离日志流错误,不冒进业务、不注册全局 uncaughtException;`logger.test.ts` + `fixtures/logger-stderr-child.mts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/obs/logger.ts、packages/daemon/test/logger.test.ts、packages/daemon/test/fixtures/logger-stderr-child.mts |
| SC-08 | relanded | 20 合法 + 1 NaN 样本旧 `decompose` 返回 `invalid=1,status=pass`;容量为 1 时被拒轮 overflow 计 2 且重新进入 pending | invalid>0 即 `undeterminable`;被拒轮计入 started 并写入 settled 不再回 pending;`latency-report.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/obs/latency.ts、packages/daemon/test/latency-report.test.ts |
| SC-09 | already_fixed_on_main | 检查当前配对/远程入口:现役远程业务全 403,本机配对信息不再生成业务二维码的路径已在 main 收口 | main 已修 | daemon remoteSurface / t2-pair(main 已有,未再改) |
| SC-10 | already_fixed_on_main | `focusBudgetCopy` 按 currency 呈现已在 main | main 已修 | packages/console focusBudgetCopy(main 已有) |
| SC-11 | relanded | `git commit -S --no-verify` 旧分类器把 `-S` 可选参数误作必选取值,返回 `write_worktree` 而非升级 | 按参数语法区分取值形态,复合/签名提交按原合同提升;`tier1-cmd-effect.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/tier1/cmdEffect.ts、packages/daemon/test/tier1-cmd-effect.test.ts |
| SC-12 | already_fixed_on_main | 当前 `memory.m0_confirmed` 路径单连接同事务、区分未保存/结果待核实/凭据拒写 | main 已修 | daemon memory 模块(main 已有) |
| SC-13 | relanded | 逐项比对当前 canonical/计划/站点文稿与 tag 差异:Hopper 现役所有权、Pipecat/自写 WS 管线、CTX 编译器、EMAIL-A 排产、ADR-003 措辞、Tailcat 评估、rc.7 复盘、W5.4 摘要、测试机部署清单、深链落地页等旧表述仍在 | 按 tag 逐文件落地更正(63 个 main 未动文件取 tag 版;13 个 main 已动文件逐 hunk 核对:08/10/11 已有同等更正判已修,a-dialogue、d-presentation、docs/index、en/docs/index、homepage-structure-copy 手工补回;plan/README 已由 main 新版覆盖)。历史原文不改写,只加日期限定补注;ADR-004 workspace 身份、09 §3.3 注释、历史时点补注、release 文档、三端壳 README、版本矩阵说明按下表 DOC-* 行单列 | docs/01-08、10、11、adr、modules、plan、release、review、site;history/DEV-VERSION-LEDGER.md、PROCESS-JOURNAL.md;prompts/;research/;templates/;deploy/saydo-octoooo-com/{docs,en/docs}/index.html、deploy/link-saydo-octoooo-com/index.html 等 |
| SC-14 | relanded | 临时 HTTP 服务驱动生产 `collectDoctor`:`voiceReady=false`+原因未知旧版仍 `all_ok` exit 0;`voiceReady=true`+asr/tts=unknown 矛盾组合同样 all_ok | `/health` 与 `/readyz` 身份比对出 `identity_drift`;未知语音态给 `voice_unknown` 显式警告;矛盾组合不再 all_ok;`doctor.test.ts` 修复后通过。repair-3 复验:identity_drift/voice_unknown 分支系本批候选新增(`git diff HEAD` 可见,非 main 已修;relanded 口径),测试补三种异常回归(voiceReady=false+原因未知 / voiceReady=true+asr/tts=unknown 矛盾 / identity 漂移),断言生产 `collectDoctor` 返回值,修复后 15/15 通过;修复前失败见 A2 节 | packages/cli/src/doctor.ts、packages/cli/test/doctor.test.ts |
| SC-15 | relanded | 临时 daemon+agent 复现:daemon 退出后 CLI 重读 PID 存活 birth 使 HOME 归属检查恒 false,reaper 不执行 | 子代生成即捕获 `processStart`;锁匹配校验 version/PID/instanceId/processStart;畸形、foreign、不可读归属记录一律拒 reap;`supervisor.test.ts`、`run-owned-reap.test.ts` 修复后通过;修复前失败见 A2 节 | packages/cli/src/supervisor.ts、packages/cli/src/emergencyReaper.ts、packages/cli/test/*、packages/cli/test/fixtures/owned-daemon-exit.mjs |
| SC-16 | already_fixed_on_main | 当前 `focuses.ts` 归档审计已写 `refDigest: jcsDigest(reason)`,元数据不含理由原文 | main 已修 | packages/daemon/src/api/focuses.ts(main 已有) |
| SC-17 | relanded | 隔离 PATH 模拟下载/安装,合法 HOME `home-$(touch injected)` 使基线 install.sh 生成的启动器执行 `injected`(基线探针实测 `injected: true`,产物已清) | HOME/SAYDO_HOME 换行引号提前拒绝;启动器/RC 行按 shell 与 PowerShell 语义引用;`test-install-scripts.mjs` 含不变量、mutation 与隔离安装探针,修复后 exit 0;修复前失败见 A2 节 | deploy/saydo-octoooo-com/install.sh、install-core.ps1、install.ps1(纯 ASCII 引导,main 已分层)、scripts/test-install-scripts.mjs |
| SC-18 | relanded | 官网中英文 docs 页 LAN dogfood 步骤、批量关停、卸载/重置与「真实对话」表述仍在当前文件逐字命中;release 合同仍断言「移动浏览器 LAN dogfood」为当前可用 | docs/index 中英版按 tag 18 处内容更正落地(15 hunk patch + 3 手工);§4.7 改为「当前源码暂不开放」;`test-mobile-release-contract.mjs` 同步改断言「已关闭/closed」并新增不可连接措辞禁止项(231 项通过);首页 zh/en 已被 main v4 重写并自带同等边界声明(该部分判 superseded 由 main 覆盖);修复前失败见 A2 节 | deploy/saydo-octoooo-com/docs/index.html、en/docs/index.html、index.html、en/index.html(首页部分 superseded)、scripts/test-mobile-release-contract.mjs |
| SC-19 | relanded | baseUrl 子串识别使路径/相似域名误触发官方专用参数 | `parseProviderBaseUrl` 解析后按 `endpoint.origin` 精确比对,仿冒不触发;`provider.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/providers/openaiCompat.ts、packages/daemon/test/provider.test.ts |
| SC-20 | relanded | 合入语音候选后 `remote-surface-inventory` 检查器 exit 1:3 种语音消息与 5 个 JOURNEY-01 新 HTTP 路由未登记 | 按真实 hub 分派补齐登记(+144 行),保留远程业务拒绝分类;检查器与自测 exit 0;修复前失败见 A2 节 | scripts/remote-surface-inventory.json |
| SC-22 | relanded | 配置 tailnet 时回叫组合根仍生成远程任务深链(生产函数探针) | 深链对齐本机受信入口,提示回到运行 SayDo 的电脑处理;不附能力令牌;`callback-*.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/callback/ntfy.ts、packages/daemon/src/callback/engine.ts、相关测试 |
| SC-23 | relanded | 隐私页「删除应用即删除手机端全部本地数据」保证、条款移动伴侣现役连接表述、link 站「已安装设备上打开」在当前文件逐字命中 | 收窄为应用内删除+卸载不保证清除系统安全存储/备份;补齐远程关闭边界;link 站改本机入口指引。仅源码文案,未部署 | deploy/saydo-octoooo-com/{privacy,en/privacy,terms,en/terms}/index.html、deploy/link-saydo-octoooo-com/index.html |
| SC-24 | relanded | 80 汉字主题旧版生成单 332 字符 encoded-word(341B 物理行,超 RFC2047 75/76 上限) | 按完整 UTF-8 字符拆分折行,长 References 保持合法物理行;`callback-email.test.ts` 修复后通过;修复前失败见 A2 节。未做真实投递 | packages/daemon/src/callback/email.ts、packages/daemon/test/callback-email.test.ts |
| SC-26 | already_fixed_on_main | 当前 `useBoardPageData.ts` 已有 retries gen/appliedGen 机制:旧定向重试不覆盖更新全页,卸载中止已在 main | main 已修 | packages/console/src/hooks/redesign/useBoardPageData.ts(main 已有) |
| SC-27 | relanded | 隔离 HOME+launchctl 桩:kickstart 失败旧版 start 仍 exit 0;bootout 失败仍删 plist 且 exit 0 | 保留可恢复配置、传播非零退出;`launchd-cli.test.ts` 修复后通过;修复前失败见 A2 节。未操作真实常驻服务 | packages/daemon/src/launchd/cli.ts、packages/daemon/test/launchd-cli.test.ts |
| SC-28 | already_fixed_on_main | 当前 setup secret 写入口已拒绝含换行值 | main 已修 | packages/daemon/src/api/setup.ts(main 已有) |
| SC-29 | relanded | 直接执行生产回读片段:Owner 正确但 DACL 仅授另一普通用户、及同时授 Owner 与他人两例旧版均被接受 | 改为原生 DACL/ACE 逐项回读:Owner 校验、DACL 存在/未保护检查、owner-only 文件/目录掩码、规范 SID;`win32-acl-readback.test.ts`(9)、`win32-volume.test.ts`(6)、`home-lock.test.ts`(9)修复后通过;修复前失败见 A2 节。koffi 传参与真实 Windows ACL 未验 | packages/platform/src/win32.ts、packages/platform/test/win32-acl-readback.test.ts、win32-volume.test.ts、home-lock.test.ts |
| SC-30 | relanded | 嵌套 `type=result`(工具参数内/assistant.metadata)旧版被当终态;顶层非零 result 终止语义被误伤 | 仅按完整 JSON 顶层类型判终态;Claude/Cursor backend 与退出策略接线回归通过(Claude 20、Cursor 6、executor 定向);修复前失败见 A2 节。未跑真实 Cursor CLI 产品验收 | packages/daemon/src/tier1/backends/claude.ts、cursor.ts、packages/daemon/test/tier1-claude-backend.test.ts、tier1-cursor-backend.test.ts |
| SC-32 | already_fixed_on_main | 当前确认卡未知 kind 回落已隔离原型属性 | main 已修 | packages/console ConfirmCard(main 已有) |
| SC-33 | relanded | 发布校验失败旧版回显原始 stdout(含敏感路径) | `parseVerifierOutput` 移入 `release-physical-evidence.mjs` 并脱敏,生产只保留正常导入的单一解析;`test-release-physical-evidence.mjs` 修复后通过;修复前失败见 A2 节。未跑实体发布 | scripts/release-physical-evidence.mjs、scripts/test-release-physical-evidence.mjs |
| SC-34 | relanded | 回叫等待期取消后旧版仍继续其他渠道外呼;成功 L0 发送遇冻结时漏写发送审计 | 取消即终止后续渠道;冻结/取消语义修正且发送审计保留;`callback-sweep.test.ts`、`callback-freeze-race.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/callback/sweep.ts、packages/daemon/src/callback/engine.ts、packages/daemon/test/callback-sweep.test.ts、callback-freeze-race.test.ts |
| SC-35 | already_fixed_on_main | 当前 contracts 未确认音频拒绝消息 schema 已有专用分支 | main 已修 | packages/contracts voiceBarrier(main 已有) |
| SC-36 | already_fixed_on_main | 当前 `sidebarLoad` 保留 last-known-good、区分读失败与真空;首载失败不渲染假零 | main 已修 | packages/console/src/shell/sidebarLoad.ts、Layout.tsx(main 已有) |
| SC-37 | already_fixed_on_main | 当前 `captureRegistryEntrySchema` 接受全部合法状态 | main 已修 | daemon/contracts schema(main 已有) |
| SC-38 | relanded | 复合命令与多推送目标旧版丢风险分类 | `cmdEffect` 按 tag 补齐复合命令与多目标解析;`tier1-cmd-effect.test.ts` 修复后通过。09-25 补修(review-1 B1):push 长参数表补齐 git 2.55 全量(含全部 `--no-` 取反形态与 `--verify`),唯一前缀解析沿用;archive `--output`、format-patch `--output-directory`、branch `--delete/--move/--copy` 同机制解析缩写。09-25 补修(rereview-3 B1/P1,详见末节返修补记 repair-5):tokenize 逐词 POSIX 归一化(normalizeShellWord),命令头/git 旗标/子命令/长参数/配置键段名一律按归一化词面识别;展开、未闭合引号、敏感位置通配符 fail-closed。09-25 补修(rereview-4 R4-B1/P1,详见末节返修补记 repair-6):续行按 POSIX 折叠(引号外与双引号内 `\<换行>` 整体删除、前后拼接,repair-5 误换成空格)+键位安全字符集白名单(归一化词面限 `[A-Za-z0-9._/:=@%+,-]`,值位不受约束),按构造闭合不再逐条识别 shell 语法;修复后 328/328。09-25 补修(rereview-5 R5-B1/P1/A3,详见末节返修补记 repair-7):续行拼接整体移除——单引号字符串之外出现 `\n`/`\r`(含 `\<换行>`)的多行命令地板判 install_dependency(至少需确认,不落 S0/S1)并与分段判定取严;命令中任意位置出现归一化 `git` 词按 git-c-exec 最严档;`matchesFrozenVerify` 拒收含换行/回车命令;修复后 cmd-effect 334/334、daemon 全量 2716 pass/6 skip。09-25 补修(rereview-6 B1/P1/A3,详见末节返修补记 repair-8):多行地板叠加 main 式折叠下限——命中地板时对 `command.replace(/\\\r?\n/g," ")` 折叠串走同一单行分类路径取严,任意命令判定不低于 main 式折叠判定;`rm -rf \<换行>/` 恢复 delete_data/S3;修复后 cmd-effect 337/337。09-25 补修(rereview-7 B1/P1/A3,详见末节返修补记 repair-9):main 式折叠下限对所有命令无条件计算;多行地板改为无引号判断(命令任意位置 `\n`/`\r` 即触发,单引号内换行同从严),`hasNewlineOutsideSingleQuotes` 删除;`echo "'" && rm -rf \<换行>/tmp/saydo-review-example` 恢复 delete_data/S3;修复后 cmd-effect 341/341、daemon 全量 2723 pass/6 skip;修复前失败见 A2 节 | packages/daemon/src/tier1/cmdEffect.ts、packages/daemon/test/tier1-cmd-effect.test.ts |
| SC-39 | relanded | git 本地执行配置写被当普通文件修改 | `cmdEffect` 按 tag 补齐配置写分类;同测试文件修复后通过。09-25 补修(review-1 B1):`git config` 长参数按 parse-options 唯一前缀规范化(`--unset-a` 实执 --unset-all、`--rename-se` 实执 --rename-section,原判 read/write_worktree ⇒ 现 S3);歧义/未识别长参数 fail-closed 上浮 S2;`--file/--blob/-f` 缩写与 `=` 形态纳入圈外判定;新增 B1 回归用例 6 项(含临时仓实证 `--unset-a`/`--rename-se`/`--fi` 歧义 129)。09-25 补修(rereview-1 B2/P1/A3,详见末节返修补记):执行配置键表重写为精确键+整节前缀+末段后缀兜底三层(词表按本机 `git help config` 2.55),include.path/includeIf.*/diff.<d>.command、rename/remove-section 涉执行配置节等全部 delete_data;B2 用例 6 项含 gate 整链 S3 deny、stepConfirm 未调用。09-25 补修(rereview-2 B2/P1/A3,详见末节返修补记):`sendemail.` 整节纳入执行配置(修复前 `sendemail.smtpServer` 判 write_worktree 自动放行;本机 git-send-email 对绝对路径 smtp_server 直接 exec);`git help config` 全量 1003 键逐一核对,新增 400 键覆盖(sendemail/fsck/uploadarchive/lfs.customtransfer/tar.<fmt>.command、core.protect*/checkStat/trustctime/ignoreStat、clean.requireForce、diff/mergetool.*.trustExitCode、format.signature/to 等);修复后 317/317 通过。09-25 补修(rereview-3 B1/P1 + R3-P2-01,详见末节返修补记 repair-5):词法层收口——`core.hooksPath""`、`core."hooksPath"`、`g""it` 等引号拼接/包围形态经 normalizeShellWord 与正常拼写等价;`http.` 整节收窄为指定键(postBuffer 等恢复普通写);09-25 补修(rereview-4 R4-B1/P1,详见末节返修补记 repair-6):续行 POSIX 折叠+`-c` `key=` 部分与 config 键/节名/作用域参数键位白名单(归一化词面限安全字符集);git 子命令位不可确定由 S2 升 S3(git-c-exec);修复后 328/328 通过。09-25 补修(rereview-5 R5-B1/P1/A3,详见末节返修补记 repair-7):多行命令一律从严——单引号外 `\n`/`\r` 即不再做续行解析,地板 install_dependency;含归一化 `git` 词一律 git-c-exec S3;合法多行命令(双引号内换行 commit、续行 pnpm 等)按有意从严同样上浮;修复后 cmd-effect 334/334、daemon 全量 2716 pass/6 skip。09-25 补修(rereview-6 B1/P1/A3,详见末节返修补记 repair-8):多行命令判定不低于 main 式折叠判定(地板与 main 式 legacy 取严),`rm -rf \<换行>/` 恢复 delete_data/S3;修复后 cmd-effect 337/337。09-25 补修(rereview-7 B1/P1/A3,详见末节返修补记 repair-9):main 式折叠下限对所有命令无条件计算;多行地板改为无引号判断(命令任意位置 `\n`/`\r` 即触发,单引号内换行同从严),`hasNewlineOutsideSingleQuotes` 删除;`echo "'" && rm -rf \<换行>/tmp/saydo-review-example` 恢复 delete_data/S3;修复后 cmd-effect 341/341、daemon 全量 2723 pass/6 skip;修复前失败见 A2 节 | packages/daemon/src/tier1/cmdEffect.ts、packages/daemon/test/tier1-cmd-effect.test.ts |
| SC-40 | already_fixed_on_main | 当前小样版本切换后迟到响应不覆盖当前预览 | main 已修 | packages/console DemoFrame/相关 hook(main 已有) |
| SC-41 | relanded | POSIX 工作区身份「inode+realpath 即身份」表述过强;inode 仅文件系统内唯一 | ADR-004 与 09 §1 明确 dev 漂移容忍+realpath/ino 为当前兼容锚、不证跨卷身份连续;Windows 用卷序列+文件索引。`workspace.ts` 注释 main 已与 tag 同文(该部分判 already_fixed_on_main) | docs/adr/design/ADR-004-windows-platform.md、docs/09-data-contracts.md、packages/daemon/src/projects/workspace.ts |
| SC-42 | relanded | 注释把 `rmSync(maxRetries:30,retryDelay:100)` 的等待称为约 3s(实际线性重试约 46.5s),并据此称 15s 清理窗覆盖最坏等待 | 更正注释:15s 为晚到 worker 容忍窗,不是文件系统重试上限;`exact-test-roots.test.ts` 修复后通过 | packages/daemon/test/exact-test-roots.ts、exact-test-roots.test.ts |
| SC-43 | already_fixed_on_main | 当前历史转写读失败有显式错误态与重试,不再呈现为空 | main 已修 | packages/console transcript 读取路径(main 已有) |
| SC-44 | relanded | 09-02 月报 696+198 被写成 1071、缺 177 项不可重建、「无缺失引用」不可当全排除;PROCESS-JOURNAL 指纹与 A/B/C 计数不实 | 保留原数字,加日期限定更正(894、不可重建、非全排除);journal 加指纹更正与计数更正 | docs/review/2026-09-02-monthly-docs-commit-crosscheck.md、history/PROCESS-JOURNAL.md |
| SC-45 | already_fixed_on_main | 当前 `liveTools.ts` 已区分 `demoHintDelivered`(提示送达)与 `demoPresented`(实际展示回执,现役恒 false);`instructions.ts` 亦含同等约束 | main 已修 | packages/daemon/src/brain/liveTools.ts、instructions.ts(main 已有) |
| SC-46 | relanded | wrapper 输出未排空旧版按 code 0 成功退出 | `flushStdioThenExit` 等真实 drain、保留原非零失败、排空不全时把 code 0 升为 124、有界等待;`runtime-child-wrapper-flush.test.ts` 修复后通过;修复前失败见 A2 节 | packages/daemon/src/runtimeChildRegistry.ts、packages/daemon/test/runtime-child-wrapper-flush.test.ts |
| SC-47 | relanded | pipeline 独立入口在读 `.cap-token`/`.env` 与构造 ASR/TTS 前不做状态根身份检查 | 新增 `win32_native.py`(ctypes,无新依赖)在读取前执行 `saydo_state_root()`:拒 reparse、非固定盘、subst/映射、非 NTFS、Administrators/SYSTEM 属主与 SID 不匹配;`test_windows_state_root.py`、`test_platform.py` 修复后 36 项通过;修复前失败见 A2 节。未跑 Windows 原生 | pipeline/src/saydo_pipeline/win32_native.py、__main__.py、platform.py、pipeline/tests/test_windows_state_root.py、test_platform.py |
| SC-48 | relanded | 自测提前退出绕过临时目录清理 | 自测补 finally 清理;`test-prompt-scan-completion.mjs` 修复后通过;修复前失败见 A2 节 | scripts/test-prompt-scan-completion.mjs(新增)、相关自测脚本 |
| SC-49 | relanded | dev 启动取消后旧版仍创建新进程;清理失败不报非零 | `createDevController` 可注入 spawn/fetch/时钟;有界健康轮询+总时限、owned-child 追踪、SIGTERM→SIGKILL、取消后不再起子进程、清理失败正确返回非零;`test-dev-lifecycle.mjs` 48 断言修复后通过;修复前失败见 A2 节。保留 main 的 `hasCommand("uv")` 缺省跳过语义 | scripts/dev.mjs、scripts/test-dev-lifecycle.mjs |
| SC-50 | relanded | 收起菜单透明态仍键盘聚焦(390px Tab 探针) | 关闭态 `inert`+`visibility:hidden`;Escape 回焦菜单钮;断点切换清 `is-open`/`inert`;兼容 `addEventListener`/`addListener`;保留展开/外点/Escape/桌面行为。09-25 补修(rereview-3 R3-P2-02):新增现役 Playwright 回归 `e2e/console/site-mobile-nav-focus.spec.ts`(真实 docs/index.html + site.css + theme.js 内联加载,390px 视口)——收起态程序 focus 与连续 Tab 均进不了导航;展开后链接恢复可聚焦;Escape 收拢且焦点回菜单钮、链接再不可聚焦;1280px 桌面断言 inert 清除。`pnpm exec playwright test` 该文件 2/2 通过;修复前失败见 A2 节。未部署 | deploy/saydo-octoooo-com/theme.js、site.css、e2e/console/site-mobile-nav-focus.spec.ts |
| SC-52 | relanded | release-profile 以「另一应用已豁免」假设 Google Play 封闭测试豁免 | `closed_testing_gate: null`;材料/披露矩阵/状态文档标明历史材料与当前源码边界、禁止直接送审 | docs/release/release-profile.yaml、metadata.json、data-disclosure-matrix.md、2026-08-13-*.md、version-matrix.md(边界注) |
| SC-53 | relanded | home-lock 测试旧版不清理自有目录、失败路径遗留子进程 | 测试清理自有目录并覆盖失败路径子进程;`home-lock.test.ts` 修复后通过(9 项) | packages/platform/test/home-lock.test.ts |
| SC-55 | relanded | 边界注入探针:提前 EOF 得空串、读错被吞返回 | 完整读取+关闭失败检查;`test-pairing-url-corpus.mjs` 修复后通过;三端语料用例同步;修复前失败见 A2 节 | scripts/pairing-url-fixtures.mjs、scripts/test-pairing-url-corpus.mjs、scripts/pairing-url-corpus.json |
| SC-56 | relanded | `%A`/`abc%A`/`%a` 等边界在 swift 编译探针下旧版不一致 | iOS `DesktopProfile.swift` 按最后反例修界;三端语料测试(PairingUrlCorpus.kt/.ets/.swift)修复后通过;swift 编译探针验证;修复前失败见 A2 节 | apps/ios/SayDo/DesktopProfile.swift、apps/ios/SayDoTests/PairingUrlCorpus.swift、apps/android/.../PairingUrlCorpus.kt、apps/harmonyos/.../PairingUrlCorpus.ets |
| SC-57 | relanded | 清理按 mtime+宽前缀扫 `$HOME` 临时根,无本轮归属 | 每 worker 登记精确根;先查 leftover 再清扫;坏清单记档;等至多 15s 晚到清理;只扫本批窄前缀归属项;`exact-test-roots.test.ts`、`test-gate-temp-cleanup.mjs` 修复后通过;修复前失败见 A2 节 | packages/daemon/test/exact-test-roots.ts、global-tmp-cleanup.ts、exact-test-roots.test.ts、scripts/test-gate-temp-cleanup.mjs |
| SC-58 | relanded | `runWindowsPhysical` 的 finally 无条件远端 rmdir(旧源码 eval 探针确认会发出) | 远端 rmdir 仅在本 run 创建成功后发送;`test-release-physical-evidence.mjs` eval 行为测试修复前失败、修复后通过;修复前失败见 A2 节 | scripts/post-release-gate.mjs、scripts/test-release-physical-evidence.mjs |
| SC-59 | relanded | stdoutTail 用例旧版为 vacuous(不走真实 verify 路径) | 改写为走真实 verify 读 `verify.json` 的生产 stdoutTail;`tier1-executor.test.ts` 修复后通过 | packages/daemon/test/tier1-executor.test.ts、packages/daemon/src/tier1/executor.ts(确认 runManagedCommand 有界 stdoutTail 已在 main) |
| DOC-ADR004 | relanded | 设计 ADR-004 的 workspace 表仍写 POSIX 硬锚(dev,ino)口径,与 09 §1 现实不一致;FAQ 授权表述与文末「本批不动」冲突(来源「其他核对」) | workspace 身份落为「realpath+ino 兼容锚、不证跨卷身份连续,Windows 用卷序列+文件索引」;FAQ 授权状态按当前实施口径回写。与 SC-41 同改动面 | docs/adr/design/ADR-004-windows-platform.md(与 SC-41 共用) |
| DOC-09-3.3 | relanded | 09 §3.3 签名计数器注释与现役签名链口径不一致(来源「当前未完成」) | 注释按现役口径更正,保留原表述并以日期限定注标明 | docs/09-data-contracts.md §3.3 |
| DOC-TIME-NOTES | relanded | 历史计划/评审/审计报告无 2026-09-13 时点限定,易被当现势结论 | 逐份加「入库注/时点补注/对账限定」blockquote,原文不改写;含 AS-01/02、GAP-02、月度审计九线、codex-findings、site fable、review 历史文档 | docs/review/、docs/plan/、docs/site/、research/monthly-audit-2026-08/、research/codex-findings/、prompts/ 等(纯追加) |
| DOC-RELEASE | relanded | release 文档仍按可提审/可发布叙述 | 商店材料、披露矩阵、提交状态、发布档案加历史边界与当前源码差异注;`closed_testing_gate` 改 `null` 未核实(与 SC-52 同面) | docs/release/release-profile.yaml、metadata.json、data-disclosure-matrix.md、2026-08-13-*.md |
| DOC-SHELL-README | relanded | 三端壳 README 未声明远程业务关闭边界 | 三端 README 各加 2026-09-13 远程业务关闭/壳状态补注 | apps/android/README.md、apps/harmonyos/README.md、apps/ios/README.md |
| DOC-VERSION-MATRIX | relanded | 版本矩阵缺远程业务关闭的源码边界说明 | 矩阵补边界注:远程业务面关闭,壳与发布形态以源码为准 | docs/release/version-matrix.md |

## 不搬(§2.2 登记)

| 项 | 原因 |
|----|------|
| SC-01 | 09-13 当时的远端 CI 状态,已过时 |
| SC-02 | PG-02 在途候选;语义证据绑定反例仍 RED,本批不碰 |
| SC-03 | PG-02 在途候选(excerpt drift/写点登记) |
| SC-06 | 语音 review-10 伞状项,JOURNEY-01 已按 2026-09-20 取舍吸收;console 语音 hooks/useVoiceChannel/hub/voiceBarrier 候选改动不搬 |
| SC-21 | PG-02 在途候选(action-ledger schema) |
| SC-25 | PG-02 在途候选(capability-ledger 登记描述) |
| SC-31 | PG-02 在途候选(ci:node 入口接线) |
| SC-51 | deferred `DF-SC51-WIN-STDIO`;`win32_native.py` 命名管道消费、`win32-native-pipe*.test.ts`、`win32-native-pipe-consumer.test.ts` 不搬 |
| SC-54 | deferred `DF-SC54-SPIKE-EVIDENCE`;`e2e/spikes/claude-cli-tier1/**` 不搬 |
| truthPlane.ts / truth-plane.test.ts / 四份 scripts/*.json / truth-plane-vocab.json / check+test action-reachability、capability-ledger、support-matrix / IMPL-PROMPT-pg02-truth-gate.md | 归 PG-02 在途候选,本批不碰 |

## §2.3 历史记录入库

- `docs/review/2026-09-13-consolidation-crosscheck.md`、`docs/review/2026-09-13-consolidation-crosscheck-IMPL-PROMPT.md`、`docs/review/2026-09-12-handoff-attachment-absorption.md` 已入库,顶部各加 `> 2026-09-25 入库注:历史记录,当前处置见 e2e/evidence/sc-reland-01.md。`;本机 home 路径按 `scripts/public-text-redaction.mjs` 的 `redactPublicText` 脱敏(crosscheck-IMPL-PROMPT 命中并替换)。

## 门禁结果(迭代期)

| 命令 | 结果 |
|------|------|
| node scripts/test-install-scripts.mjs | [ok] exit 0(含隔离安装探针 unexpected_command_executed=false) |
| node scripts/test-dev-lifecycle.mjs | [ok] pass=48 fail=0, exit 0 |
| node scripts/test-pairing-url-corpus.mjs | [ok] exit 0 |
| node scripts/test-prompt-scan-completion.mjs | [ok] exit 0 |
| node scripts/test-release-physical-evidence.mjs | [ok] exit 0 |
| pnpm --filter @saydo/platform exec vitest run win32-acl-readback.test.ts win32-volume.test.ts home-lock.test.ts | [ok] 3 files / 24 tests pass |
| pnpm --filter @saydo/daemon exec vitest run(logger/latency/provider/callback-sweep/callback-freeze-race/tier1-backends/tier1-cmd-effect/runtime-child-wrapper-*/launchd-cli/policy-approvals/callback-email) | [ok] 11 files / 135 pass / 1 skip |
| pnpm --filter @saydo/daemon exec vitest run(tier1-executor + 宽组) | [ok] 2 files / 454 pass |
| pnpm --filter @saydo/cli exec vitest run(supervisor/run-owned-reap/doctor) | [ok] 3 files / 35 pass |
| uv --directory pipeline run python -m pytest -q | [ok] 36 pass |
| 基线 install.sh 注入复现 | [ok] `injected: true`(修复前成立,产物已清) |

## 基线已知失败(不计入本批回归)

- `~/.codex/tasks/saydo-sc-reland-20260925/baseline-ci.log` 中 supervisor 于同一 HEAD 预跑的 `just ci` 红项,见 REPORT.md 引用清单。

## not_run

- [warn] Windows 原生 API(koffi/ctypes 实机):SC-29 ACL 回读与 SC-47 状态根检查只经注入边界与源码级测试,未在 Windows 执行。
- [warn] 三端真机:SC-56 只经 swift 编译探针与语料测试,无设备验证;iOS/Android/HarmonyOS 壳均未真机复测。
- [warn] 官网部署:deploy/** 仅源码文案与脚本,未部署、未做线上验证。
- [warn] 真实外发:无真实 SMTP、ntfy、provider 调用;SC-05/22/24 只到传输/组合层测试。
- [warn] 发布动作:无 release、store 提交、商店送审;release 文档为草稿/历史材料对齐。
- [ok] 最终门禁(repair-2 复跑,2026-09-25):`pnpm exec playwright test` 全量连续两次 54 passed、exit 0(日志 `repair-2/gate-playwright-1.log`、`gate-playwright-2.log`);`just ci` exit 0(首跑误中 `voice-hf-terminal-lifecycle` 负载抖动一项,该文件与 HF 路径本批零改动,单跑 9/9 与第二跑全绿;`gate-just-ci-2.log`);typecheck/lint/emoji/`git diff --check` 全绿。逐条退出码与哈希见 repair-2 REPORT。
- [fail→已收口] 首轮最终门禁曾 `pnpm exec playwright test` 全量 exit 1:`journey-01-seven-step.spec.ts:193` 失败,干净基线 54/54 通过(09-25 更正:撤回原"隔离重跑 4/4 pass 判 flaky"结论)。根因与修复见下节「返修补记」。

## 返修补记(repair-2,2026-09-25;根因 journey01-running-fixture-blocked,A3/A9)

- 根因:`journey-01-seven-step.spec.ts` 的 `seedConfirmNegativeSurface` 直接 INSERT 复制 `running` fixture 任务行,`updated_at` 继承 fixture 的 `2026-07-25T02:00:00.000Z`——对合同这是「步界停靠已两个月」的不可能态。`runParkSweep`(`packages/daemon/src/live/scheduler.ts` `STEP_BOUNDARY_TIMEOUT_MS=30_000`,`packages/daemon/src/index.ts` 15s 一拍)按 09 §6.1 把逾期 `paused_step_boundary` 转 `blocked` 并落 `parked_deadline`;console 把 `blocked` 映射为「停靠等你/去回答」,渲染不出「这一步行」。
- 实证:独立复现探针观测到插入后 10.8s 被 audit 动作 `task.step_boundary_timeout` 翻转,`parked_deadline=+72h`(与失败快照「09-27止」吻合);spec 内诊断打印确认断言前任务仍为 `paused_step_boundary` 时即用例通过。scheduler/sweep/transitionTask 等翻转路径代码在本批 diff 中为零改动。
- 为何基线过、候选败:翻转只发生在「插入点撞上 15s tick 前的约 2s 页面取数窗口」时。本批改动使全量前 39 用例累计耗时漂移约 +4.5s,相位移入命中带;基线靠相位侥幸避开——原测试依赖的是不被保证的时序条件,而非产品语义。
- 判定与修法:产品行为合同正确,不改产品代码;修测试隔离——种子 `updated_at: now`(「刚停靠」的真实形状,合同保证 30s 窗口内不会被转 blocked)。断言、超时、重试、用例语义均未动;不新增单测(`park-scheduler.test.ts` 已覆盖 30s 边,复跑 5/5)。

## 返修补记(repair-3,2026-09-25;根因 git-exec-config-keyset,rereview-1 B2/P1/A3 + P2-01…P2-04)

- B2 根因:`cmdEffect.ts` `isGitExecConfig` 用手写精确表+少量正则,`git config include.path`、`diff.<driver>.command` 等执行配置键漏判为 `write_worktree`,经 `policy/engine.ts`→`tier1/gate.ts` S1 自动放行;`git -c` 与 `git config` 两路共用该函数。
- 修复前复现(新 B2 用例首跑 5/6 失败):`git config include.path ../evil.config`→write_worktree;`git -c include.path=x status`→install_dependency;`git config foo.bar.somecommand x`→write_worktree;`git config --rename-section foo include`→write_worktree;整链 `git config include.path ../evil.config`→effect write_worktree。修复后全部 `delete_data/git-c-exec`,gate `deny`/S3,`stepConfirm` 未调用。
- 修法:`isGitExecConfig` 重写为三层——精确键(core.fsmonitor、ssh.variant、imap.tunnel、init.templateDir、instaweb.*/web.browser/help.browser 等末段不命中兜底者)+整节前缀(alias./protocol./difftool./mergetool./url./pager./include./includeif./browser./man.)+末段后缀兜底(command|cmd|program|helper|driver|hook|hookspath|editor|pager|askpass|sshcommand|textconv|clean|smudge|process|path|uploadpack|receivepack|proxy);`isGitExecSection` 改按节头判定(include/includeif/diff/gpg/pager/sendemail/submodule 等 34 个),rename 目标节同样命中。键名大小写不敏感,子节任意。
- 段操作:`--rename-section`/`--remove-section` 及缩写(`--rename-se`/`--remove-se`)与动词形式,源节或目标节命中执行配置节一律 delete_data。
- 回归:`tier1-cmd-effect.test.ts` 新增 B2 describe 6 项(词表全量写入、-c 内联、兜底虚构键、段操作、普通键/只读查询正例、整链 gate),修复后 311/311 通过。
- P2-01(SC-14):`doctor.ts` 已含修复——identity_drift/voice_unknown 分支系本批候选新增(relanded;repair-3 当时记录为 already_fixed_on_main 系表述错误,rereview-4 R4-P2-01 指出后按 `git diff HEAD` 更正);`doctor.test.ts` 补三用例断言生产 `collectDoctor` 返回值,15/15 通过。
- P2-02:`docs/11-ui-spec.md` §12.1 与 §13 表删去不存在的「09 §17.2 (b)」引用,标明 PG-02 在途;`docs/06-references.md` §8 同类 §17/`truthPlane`/`truth-plane-vocab.json` 引用补在途标注(未新造 09 章节)。
- P2-03:`docs/plan/2026-08-15-default-runner-decision.md` 三处被替换的原结论(rc 漂移暴露、max_tokens 成本保证、未做网络调用)恢复原文并追加 `2026-09-25 更正`;同法恢复 `ai-supply-owner-decisions`(导语「一项未签」、推荐理由草案)、`rc4-runtime-final-reimplementation-readback`(并发竞争结论、3s 等待口径、127 归因)、`monthly-audit-2026-08/README`(R114 计数依据)、`audit-line9-misc`(11 个 merge)、`87-status-alignment` triage(B 4 计数)、`mobile-shell-strategy-final`(20 份工时口径)、`DEV-VERSION-LEDGER`(公开边界注意)、`store-submission-status`(豁免两条)、`data-disclosure-matrix`(「今日」表述与最后更新戳)。全批再核:其余带删除行的历史文档(canonical 03/04/07/09/modules/adr、站点 fable 文稿、release 材料/profile、templates、deploy 页面)为现役合同/文稿在途更正,非历史结论替换,保留。
- P2-04:本表补 DOC-ADR004 / DOC-09-3.3 / DOC-TIME-NOTES / DOC-RELEASE / DOC-SHELL-README / DOC-VERSION-MATRIX 六行,不再并入 SC-13。

## 返修补记(repair-4,2026-09-25;根因 git-exec-config-keyset 二修,rereview-2 B2/P1/A3 + P2-03/A5)

- B2 根因残留:repair-3 三层词表未含 `sendemail.` 节;`git config sendemail.smtpServer /tmp/sendmail-probe` 判 `write_worktree`,经 gate S1 自动放行。本机 git 2.55 `send-email` 源码:`file_name_is_absolute($smtp_server)` 时直接 `exec($smtp_server, @sendmail_parameters)`;`sendemail.<identity>.smtpServer` 三段形式同源漏判。
- 修复前复现(新用例首跑 6 失败/311 通过):`git config sendemail.smtpServer /tmp/x`、`sendemail.work.smtpServer`、`sendemail.toCmd`、`sendemail.ccCmd`、`sendemail.headerCmd`、`-c sendemail.smtpServer=… send-email` 均 `write_worktree`;整链 decide S1 allow、零确认。
- 修法:`sendemail.` 整节纳入执行配置前缀(覆盖 `smtpServer`/`smtpServerOption`/`smtpEncryption`/`smtpServerPort`/`smtpUser`/`smtpPass`/`smtpAuth`/`toCmd`/`ccCmd`/`headerCmd`/`sendmailCmd`/`confirm`/`identity` 及全部 `<identity>` 三段变体,含文档外自定义键 fail-closed);只读 `--get`/`--list`/无值查询仍 `read`。
- 系统性自查:`git help --config` 导出 1003 有效键(1005 原始行 - 脚注 1 - 空行 1)逐一核对命令/程序/路径/URL 重写/凭据/信任与检查弱化面;命中键数 489(较 repair-3 新增 400),含 `fsck.*`、`uploadarchive.*`、`lfs.customtransfer.*`、`tar.<fmt>.command`、`imap.*`、`core.protectHFS/NTFS/checkStat/trustctime/ignoreStat`、`clean.requireForce`、`diff.trustExitCode`、`mergetool.<m>.trustExitCode`、`format.signature`、`format.to`、`gc.repackFilterTo`、`http.*`、`credential.*`、`trace2.*`、`gitcvs.*`、`hook.*`、`filter.*`、`mailmap.*` 等;后缀兜底扩至 exec/socket/handler/plugin/extension/daemon/service/resolve/env/username/password/secret/sender/exitCode 等词族(`to` 后缀因误伤 `gc.auto`/`maintenance.*.auto` 撤下,改用精确键)。`GIT_EXEC_SECTION_HEADS` 扩至 68 节头(rename/remove-section 源与目标同判),`tar`/`lfs` 为文档键表外手工补入(tar.<fmt>.command 真实执行键;lfs 自定义传输 agent/path/args)。
- 回归:`tier1-cmd-effect.test.ts` B2 用例扩至 sendemail 全系(含 identity 三段)、`-c` 内联 send-email 整链 deny、新覆盖键代表样例、普通写与只读正例保留;修复后 317/317 通过。
- P2-03(A5):`2026-08-19-w54-claude-cli-tier1.fable.md` 四处被替换原文(导语表「比 cursor 多什么安全面」行、R-3 行、B1 锚 `acceptEdits`、D3 项)恢复 v2 原文并各追加 `2026-09-25 更正` 块(表后块 / 列表缩进块);该文件 diff 现为零删除行。机械检查(`check-append-only.py`,删行须原样保留):`docs/plan/**`、`docs/review/**`、`e2e/evidence/**` 非新建文件、`research/**` 共 44 个改动文件,删除行数 0,违规 0。

## 返修补记(repair-5,2026-09-25;根因 shell-word-normalization,rereview-3 B1/P1 + R3-P2-01/R3-P2-02)

- B1 根因:`tokenize` 把引号原样留在词里、`unquote` 只剥整词外层一对引号——shell 执行前的引号去除在分类时没发生。生产反例 `git config core.hooksPath"" ./hooks` 判 `write_worktree`,经 `decideCommand` S1 allow 零确认放行;shell 实执的是 `git config core.hooksPath ./hooks`。
- 修复前复现(新 B3 用例首跑 4 块失败/320 通过):`core.hooksPath""`、`core."hooksPath"`、`core.hooks'P'ath`、`core.hooksP''ath`、`--unset"-all"`、`--glob""al`、`"--"global"`、`g""it`/`gi"t"` 命令头、`"-"c"` 旗标包围、`"$KEY"`、`core.hooksPath"$X"`、`core.hooks*`、未闭合引号 `"core.hooksPath` 等 13+ 形态分别落 write_worktree/read/install_dependency 而非执行配置 S3;`git "-c" core.hooksPath=./h status` 为 S2。
- 修法(按类别收口于词法层):新增 `normalizeShellWord`——单引号全字面;双引号内仅 `\$` `` \` `` `\"` `\\` `\<换行>` 转义;引号外 `\` 转义下一字符;相邻片段拼接。tokenize 同步修反斜杠(转义空格不断词、双引号内 `\"` 不提前闭合)。命令头、git 全局旗标、子命令、config 长短旗标、配置键与段名、scope 参数、sed/awk 脚本体、`sh -c`/`eval` 脚本、路径参数全部改用归一化词面;`env/sudo` 等包裹命令递归重组仍 join 原始词,词界不变。
- fail-closed:词内引号外或双引号内 `$`/`` ` ``、未闭合引号、词尾悬空反斜杠 ⇒ dynamic;引号外 `*`/`?`/`[` ⇒ glob。命令头 dynamic/glob ⇒ `head=""` 落 install_dependency 最严档(S2,不落 S0/S1);git 全局旗标位不可确定 ⇒ cExec;git 子命令不可确定 ⇒ `sub=""`;git config 任一词不可确定 ⇒ `git-c-exec` S3;push refspec 不可确定 ⇒ `push-unresolved-dest`;`$HOME`/`$DIR` 等路径 outside/unknown 语义经 pathClass 原样保留。
- R3-P2-01:`http.` 整节前缀移除,改 `GIT_HTTP_EXEC_LEAVES` 末段白名单(proxy、sslCAInfo、sslCAPath、sslCert、sslKey、sslCertPasswordProtected、cookieFile、curloptResolve、extraHeader;`http.<url>.<同名键>` 同判);`http.delegation` 等普通键恢复 `write_worktree`,兜底后缀命中的 `sslVerify`/`userAgent` 等仍执行配置;`--rename-section foo http`/`--remove-section http` 仍 deny(节内可注入 proxy)。

> 2026-10-03 普通整合勘误：上段保留 repair-5 历史原文；`http.delegation` 实际是 GSSAPI/Kerberos 凭据委派，不能作为普通传输键。当前 docs/04 §5.1 将该键及 URL 子节的写入/删除/临时覆盖归 S3，普通 `--get` 查询保留既有读语义；此次具名修复不重开 SC 原轮次或其余 `DF-TIER1-SHELL-01`。

- R3-P2-02(SC-50):新增 `e2e/console/site-mobile-nav-focus.spec.ts` 2 用例进现役 `pnpm exec playwright test` 覆盖目录;真实 docs/index.html + site.css + theme.js 内联 setContent,390px 断言收起不可聚焦/展开恢复/Escape 回焦菜单钮,1280px 断言断点回桌面清 inert;该文件 2/2 通过,`e2e/screenshots` 已还原。
- 回归:`tier1-cmd-effect.test.ts` 新增 B3 describe 4 项(拼接/包围/反斜杠反例 20 条、不可确定 fail-closed 14 条、decideCommand 整链 4 条 deny/零确认、合法引号正例 9 条锁修复前判定值)与 B3-P2 describe 3 项(http 执行键/普通键/查询与段操作);修复后 324/324 通过,daemon 全量 2706 pass / 6 skip。

## 返修补记(repair-6,2026-09-25;根因 shell-word-normalization 二修,rereview-4 R4-B1/P1 + R4-P2-01)

- R4-B1 根因:`commandToEffect` 用 `command.replace(/\\\r?\n/g," ")` 把续行换成空格——POSIX 中引号外 `\<换行>` 是续行、整体删除且前后直接拼接;`git config core.hooks\<LF>Path ./hooks` 实执写 `core.hooksPath`,分类器却看到 `core.hooks` 与 `Path` 两词判 `write_worktree`,经 `decideCommand` S1 自动放行零确认。此前五轮评审逐轮各发现一种绕过写法(长参数缩写、执行键表、sendemail、引号拼接、续行),逐条识别 shell 语法无法收口。
- 修复前复现(新 B4 用例首跑 4 块失败/324 通过;临时探针逐条直读 `commandToEffect`+`decideCommand` 留证):LF 与 CRLF 续行键位、`gi\<LF>t` 命令头、`con\<LF>fig` 子命令、`-c core.hooks\<LF>Path=./h`、`sh -c` 脚本体内续行各落 `write_worktree`/`install_dependency` 而非执行配置,生产反例整链 `allow`(S1 自动放行,stepConfirm 零调用);`core.hooks{Path,}`、`~/x`、`core.hooksPath\ x`(反斜杠转义空格,修复前竟判 `read`/S0)同漏;`$IFS`/`$'..'`/通配/未闭合等既有 fail-closed 形态不受影响。
- 修法(按构造闭合):`foldLineContinuations` 按 POSIX 删续行(引号外与双引号内 `\<LF>`/`\<CR><LF>` 整体删除;单引号内字面保留);键位安全字符集白名单——命令头(含 sudo/env 等包装后的真实命令)、git 全局旗标、git 子命令、git 长短旗标(`--opt=v` 只看 `=` 前名部)、config 键/节名/作用域参数、`-c` 的 `key=` 部分,归一化词面必须只含 `[A-Za-z0-9._/:=@%+,-]`,否则按不可确定 fail-closed(命令头 ⇒ install_dependency 最严档不落 S0/S1;git 键位 ⇒ `delete_data`/git-c-exec S3)。构造保证:归一化词面只剩安全字符 ⇒ shell 对该词不再做任何展开/变换,分类所见即实参。值位(config 值、`commit -m` 消息、`log --format=` 格式串、`--get-regexp` 模式参数等)不受约束,保持既有判定。
- 口径说明:白名单作用于 POSIX 归一化后的词面(原始词经引号去除的残留字符),引号/转义语法本身不算不安全——与 repair-5 锁定的 `git config "user.name" "A B"`(S1)、`g""it`(S3)等正例相容;纯原始词检查会破坏这些锁定正例,故不采用。
- 判定变化(从严方向,均有用例锁):git 子命令位不可确定 S2→S3(`git "$SUB" …`、`git conf*g …`);键位含空白/非 ASCII 字符的命令从严(`git config core.hooksPath\ x` 修复前 read/S0 ⇒ S3,`git config user．name x` 修复前 write_worktree/S1 ⇒ S3);单引号内续行因跨段未闭合引号 fail-closed 至 S3。
- 回归:`tier1-cmd-effect.test.ts` 新增 B4 describe 4 项(续行 7 条、非引号类变换 8 条、decide 整链 2 条 deny/零确认、正例 7 条锁修复前判定);修复后 328/328,daemon 全量 2710 pass / 6 skip。
- R4-P2-01:SC-14 行结果列与 repair-3 补记 P2-01 的 already_fixed_on_main 表述更正为 relanded 口径(`git diff HEAD` 证实 identity_drift/voice_unknown 为候选新增分支);SC-38/39 行同步 repair-6 修订。

## 返修补记(repair-7,2026-09-25;根因 shell-word-normalization 三修,rereview-5 R5-B1/P1/A3)

- R5-B1 根因:repair-6 的 `foldLineContinuations` 按 POSIX 删除 `\`+换行,但未区分被转义的反斜杠——`echo x \\<LF>git config core.hooksPath ./hooks` 中 `\\` 是字面反斜杠,随后 LF 是真实命令分隔,rereview-5 在 /bin/sh 与 /bin/zsh 实测第二行被执行(`INTERCEPTED_GIT <config> <core.hooksPath> <./hooks>`);折叠却把第二行并进 echo 参数判 `write_worktree`,经 `decideCommand` S1 自动放行零确认。
- 修法(owner 选定最保守规则,不再尝试解析续行):`commandToEffect` 最前面用单引号态状态机检查原始命令串——单引号字符串之外出现 `\n`/`\r`(含 `\<换行>`)即地板判 `install_dependency`(S2,至少需确认,不落 read/S0/S1),与常规分段判定取严者;命令中任意位置出现归一化 `git` 词(含被引号/反斜杠拆开后归一化得到的 git,整词/basename 判定,大小写不敏感)按 git 执行配置最严档 `delete_data`/git-c-exec(S3)。`foldLineContinuations` 与续行折叠路径整体删除;`matchesFrozenVerify` 拒收含 `\r`/`\n` 的命令(防 `\s+` 折叠把第二行藏进"与冻结 argv 相同"的 S1 假象)。单行命令判定与 repair-5/6 完全一致。
- 判定变化(从严方向,均有用例锁):多行命令一律上浮——`echo a<LF>echo b` write_worktree/S1→install_dependency/S2、`ls<LF>pwd` read/S0→S2;`rm -rf \<LF>/` delete_data/S3→S2(不再折叠还原 `rm -rf /`,仍不落 S0/S1,需确认);`git commit -m "a<LF>b"` install_dependency/S2→git-c-exec/S3、`git commit -m "line1\<LF>line2"`(双引号内续行)write_worktree/S1→S3;`pnpm test \<LF> --run` 保持 S2(现经多行地板)。单引号内换行是字面量、不触发地板(`sh -c '…<LF>…'` 判定与修复前一致)。这是有意的从严变化:合法多行命令现在要求确认或更严。
- 既有断言改动 2 处:`rm -rf \<LF>/` 表行 delete_data/S3→install_dependency/S2(repair-7 多行地板,从严不再折叠还原被删命令);B4 正例 `git commit -m "line1\<LF>line2"` write_worktree/S1→delete_data/S3(双引号内换行不豁免,git 词最严档)。
- 回归:`tier1-cmd-effect.test.ts` 新增 B5 describe 6 项(R5-B1 反例与同类 6 条、无 git 词多行地板 5 条、单引号内换行 2 条、decide 整链 4 条、从严锁定 4 条、单行正例 6 条);修复前 B5 4 块 + B4 正例 1 条断言失败留证(`prefix-test.log`:R5-B1 反例 `write_worktree`、整链 `write_worktree`/S1 放行形态、`git commit -m "a<LF>b"` 仅 install_dependency 等),修复后 cmd-effect 334/334,daemon 全量 2716 pass/6 skip。

## 返修补记(repair-8,2026-09-25;根因 multiline-monotonic-floor,rereview-6 B1/P1/A3)

- B1 根因:repair-7 移除续行折叠改设多行地板后,`rm -rf \<换行>/` 只命中 `install_dependency` 地板(S2,经逐步确认可 allow);main(HEAD `90e0777`)的 `commandToEffect` 先做 `command.replace(/\\\r?\n/g," ")` 折叠再分类,同一命令判 `delete_data`(S3 deny)——候选判定低于 main,属相对放宽。
- 修法(单调下限):`commandToEffect` 命中多行地板分支时,另对 main 式折叠串走同一单行分类路径得 `legacy`,与「地板 + 分段判定 + git 词最严档」经 `maxDescriptor` 取最严者(`touchesSensitiveData` 任一携带)。分类主路径抽为 `classifyCommandText` 供两处共用、不带地板避免递归;单调规则:多行命令判定不低于 main 式折叠判定。单行路径、白名单与归一化、其它文件产品代码均不动;单引号内换行不触发地板、也不触发 legacy。
- 修复前复现(新/恢复用例首跑 4 块失败/333 通过,留证 `~/.codex/tasks/saydo-sc-reland-20260925/repair-8/prefix-test.log`):review-1 表行 `rm -rf \<LF>/` 恢复 delete_data/S3 断言前实判 install_dependency/S2;B6 续行 S3 用例(`rm -rf \<LF>~`、`rm -rf \<LF>$HOME`、`git push --force \<LF>origin main`)同漏;整链 decide `rm -rf \<LF>/` 实判 install_dependency;单调自检循环抓 26 条 S3→S2 放宽(rm/find/tee/chmod/ln/cp/mv/install/sh -c/sudo/env/nice/bash -lc/ksh -c/curl -o/wget -O/npm publish/eval 等续行版)。
- 回归:`tier1-cmd-effect.test.ts` review-1 表行恢复 delete_data/S3,新增 B6 describe 3 项(续行版 S3 用例 4 条、整链 decide deny 零确认、三表全部单行用例首空格插 `\<换行>` 的单调自检);修复后 337/337,daemon 全量见 repair-8 REPORT。

## 返修补记(repair-9,2026-09-25;根因 multiline-monotonic-floor 二修,rereview-7 B1/P1/A3)

- B1 根因:repair-7 的 `hasNewlineOutsideSingleQuotes` 是简化的单引号态状态机,不处理双引号——`echo "'" && rm -rf \<换行>/tmp/saydo-review-example` 中 `"` 内的字面 `'` 被当作单引号串开始,换行判为"单引号内" ⇒ 不触发多行地板,也不计算 repair-8 的 main 式折叠下限;候选判 `install_dependency`(S2,经逐步确认可放行),main(HEAD `90e0777`)折叠后判 `delete_data`(S3 deny)——相对 main 放宽的第二轮。
- 修法(照 owner 派发合同,不再做任何引号状态判断):① main 式下限无条件计算——所有命令 `out = maxDescriptor(classifyCommandText(command), classifyCommandText(command.replace(/\\\r?\n/g," ")))`,单行两路同值、判定不变,`touchesSensitiveData` 任一携带;② 多行地板改无引号判断——命令任意位置出现 `\n`/`\r` 即触发:含归一化 `git` 词按 git-c-exec 最严档(delete_data/S3),否则 install_dependency(S2)地板,与①取最严;`hasNewlineOutsideSingleQuotes` 删除(无其它调用者),不再保留任何引号状态机决定是否从严。
- 修复前复现(新/扩展用例首跑 4 块失败/337 通过,留证 `~/.codex/tasks/saydo-sc-reland-20260925/repair-9/prefix-test.log`):rereview-7 原反例实判 `install_dependency`(期望 `delete_data`);整链 decide 同判 install_dependency;`sh -c 'a\nb' ; git status` 实判 S2(换行在单引号内,旧机不触发 git 词最严档);扩展单调自检抓 26 条 `echo "'" && ` 前缀变体 S3→S2 放宽(变体一"首空格插续行"零违规)。
- 回归:`tier1-cmd-effect.test.ts` 新增 B7 describe 4 项(原反例 + 4 条双引号内单引号多行同类一律 S3、原反例 HEAD 式折叠判定同为 S3、`sh -c 'a\nb'` 至少 S2 从严锁定 + 引号外独立 git 词 S3、整链 decide deny 零确认);B6 单调自检扩展为两变体×双下限(首空格插 `\<换行>` 与前置 `echo "'" && ` 再插续行,断言不低于单行版与 HEAD 式折叠判定)。
- 既有断言改动:B5 `it` 标题 1 处改述("单引号内换行不触发地板"→"repair-9 起引号内换行也触发地板,判定不变"),断言值未变;无其它既有断言因第②条从严需要修改(修复后 341/341 全绿:单引号内换行的分段碎片本就因未闭合引号落 install_dependency 档,git 词类形态原已 S3)。
- 门禁:`pnpm --filter @saydo/daemon test` 2723 pass/6 skip exit 0;`pnpm -r typecheck`、`pnpm lint`、`check-doc-links.mjs`(166 文件 0 broken)、`check-emoji.sh`、`check-public-tree-privacy.mjs --fs`(2304 扫描 0 hit)、`git diff --check` 均 exit 0;逐条输出与指纹见 `~/.codex/tasks/saydo-sc-reland-20260925/repair-9/REPORT.md`。

## 返修补记(repair-10,2026-09-26;根因 legacy-classifier-floor,rereview-8 B1/P1/A3)

- B1 根因:最近三轮 RED(续行折叠、引号骗过换行检测、动态命令头)同一模式——候选新规则在部分路径上替换了 HEAD 的判定,而不是与之取严;repair-8/9 的「main 式折叠下限」复用的仍是候选自己的 `classifyCommandText`,不是 HEAD 真实判定。rereview-8 生产反例 `"/bin/${PWD:+.}/rm" -rf /tmp/saydo-review-example`:HEAD(`90e0777`)按 basename 剥到 `rm` 判 `delete_data`(S3 deny),候选把含展开的命令头判不可确定落 `install_dependency`(S2,经 `decideCommand` 逐步确认可放行)——相对 main 放宽第三轮。
- 修法(按构造闭合「相对 main 放宽」一类问题):新增 `packages/daemon/src/tier1/cmdEffectLegacy.ts` = `git show 90e0777:packages/daemon/src/tier1/cmdEffect.ts` 原样拷贝(仅 `commandToEffect`→`legacyCommandToEffect` 改名、`classifySegment` 去导出、删去候选不再需要的 `matchesFrozenVerify` 导出;分类逻辑/正则/表/常量逐位未改,文件头注明不得在此修改分类行为)。`commandToEffect` 最终返回前对**所有**命令无条件 `maxDescriptor(candidate, legacyCommandToEffect(command))`,`touchesSensitiveData` 任一为真即携带——任意命令判定不低于 HEAD。
- 修复前复现(留证 `~/.codex/tasks/saydo-sc-reland-20260925/repair-10/prefix-probe.log` 与 `prefix-test.log`):原反例与续行变体实判 `install_dependency`(期望 delete_data);整链 decide 同判 install_dependency;新单调性质用例(993 条语料 × 4 变体)首跑抓出 198 条 candidate<legacy 违规——`"/bin/${PWD:+.}/<head>"` 包壳整族在候选判 install_dependency,而 HEAD 按真实命令头判 delete_data/send_external/deploy。
- 回归:新建 `packages/daemon/test/tier1-cmd-effect-monotonic.test.ts`(6 用例)——rereview-8 原反例与续行变体回 S3、动态命令头变体 3 条(单调断言+明示判定)、993 条语料(tier1-* 测试文件全部命令样字符串字面量,脚本提取)× 4 变体(原样/首空格插 `\<换行>`/前置 `echo "'" && `/命令头包 `"/bin/${PWD:+.}/<head>"`)逐点单调、`legacyCommandToEffect` 与 `git show 90e0777` 固化快照逐位一致、单行正例锁修复前判定。
- 既有断言改动 4 处:`git config get <key>` 子命令式只读查询(`core.hooksPath`/`--al user.name`/`include.path`/`sendemail.smtpServer`)由 read/S0 从严为 write_worktree/S1——HEAD(90e0777)不识 `get` 子命令动词、按普通键写判,下限取严;S1 仍自动放行零确认,行为面不变。`git config get` 语义化识别(读查询回 S0)不在本批,见 DF-TIER1-SHELL-01。
- 门禁:`pnpm --filter @saydo/daemon test` 2729 pass/6 skip exit 0;逐条门禁输出与指纹见 `~/.codex/tasks/saydo-sc-reland-20260925/repair-10/REPORT.md`。

## 评审各轮 shell/git 分类反例清单与当前判定(repair-10 登记;DF-TIER1-SHELL-01 分界)

「已收口」= 候选当前判定不低于 HEAD(`90e0777`)且达应有档;「转 DF-TIER1-SHELL-01」= HEAD 上同样存在、候选未更松的固有绕过,单调下限按构造不改变两边判定,按批卡 deferred exact-set 转后续批。判定列为 `kind`/risk;实测经 `commandToEffect` + `computeRisk` 直读。

| 轮次 | 反例(命令词面;`\<LF>` 表示反斜杠续行) | 当前候选判定 | 处置 |
| --- | --- | --- | --- |
| review-1(B1 git 长参数前缀缩写) | `git config --unset-a core.hooksPath`、`--rename-se harmless core`、`--rename-s harmless credential`、`--unset-all core.hooksPath`、`--rename-section harmless core`、`--glob/--sys/--fil/--fil= <圈外路径> user.a b` | delete_data/S3(执行键与涉执行节段操作);歧义 `--un`/`--fi`/`--l`/`--re` 与未识别 `--frobnicate` fail-closed install_dependency/S2 | 已收口 |
| review-1(B1 push 侧) | `git push --de origin old`、`git push --mir origin`、`git push --rep=origin release` | delete_data/S3 | 已收口 |
| rereview-1(B2 执行配置键表) | `git config include.path ../evil.config`、`git -c include.path=x status`、`git config foo.bar.somecommand x`、`git config --rename-section foo include`、`git config diff.demo.command ./evil` | delete_data/S3(git-c-exec) | 已收口 |
| rereview-2(B2 二修 sendemail/全键审计) | `git config sendemail.smtpServer /tmp/x` 及 `sendemail.work.*` 三段、`toCmd`/`ccCmd`/`headerCmd`/`sendmailCmd`、`-c sendemail.*=… send-email`;`git help config` 全键审计新增覆盖键(fsck/uploadarchive/lfs.customtransfer/tar.<fmt>.command 等) | delete_data/S3(git-c-exec) | 已收口 |
| rereview-3(B1 POSIX 词归一化) | `git config core.hooksPath"" ./hooks`、`core."hooksPath"`、`core.hooks'P'ath`、`--unset"-all"`、`--glob""al`、`g""it`/`gi"t"` 命令头、`git "-c" core.hooksPath=./h status`、`"$KEY"`、`core.hooksPath"$X"`、`core.hooks*`、未闭合引号 `"core.hooksPath` | delete_data/S3(键位/git 位不可确定按执行配置);`git "-c" …` 等 fail-closed install_dependency/S2 | 已收口 |
| rereview-4(R4-B1 续行与键位白名单) | `git config core.hooks\<LF>Path ./hooks`(LF/CRLF)、`gi\<LF>t`、`con\<LF>fig`、`-c core.hooks\<LF>Path=./h`、`sh -c` 体内续行、`core.hooks{Path,}`、`core.hooksPath\ x`(转义空格)、`user．name`(全角点)、`git "$SUB"`、`git conf*g` | delete_data/S3(归一化词面出安全字符集即不可确定,git 键位 git-c-exec) | 已收口 |
| rereview-5(R5-B1 转义反斜杠+真换行) | `echo x \\<LF>git config core.hooksPath ./hooks`、`sh -c 'echo a<LF>git config core.hooksPath ./h'` | delete_data/S3(git 词最严档) | 已收口 |
| rereview-6(B1 多行 vs main 折叠) | `rm -rf \<LF>/`、`rm -rf \<LF>~`、`rm -rf \<LF>$HOME`、`git push --force \<LF>origin main` 及单调自检抓出的 26 条续行变体 | delete_data/S3 | 已收口 |
| rereview-7(B1 双引号内单引号骗过状态机) | `echo "'" && rm -rf \<LF>/tmp/saydo-review-example`、`echo "'" && git config core.hooks\<LF>Path ./h`、`echo "a'b" \<LF> rm -rf ~`、`printf '%s' "'" ; rm -rf \<LF>/`、`echo "'" && git push --force \<LF>origin main` | delete_data/S3 | 已收口 |
| rereview-8(B1 动态命令头) | `"/bin/${PWD:+.}/rm" -rf /tmp/saydo-review-example` 与续行变体;`/bin/r"m" -rf /tmp/x` | delete_data/S3(候选经词归一化对 `/bin/r"m"` 比 HEAD 更严) | 已收口 |
| rereview-8(同类动态命令头,HEAD 固有绕过) | `"$(command -v rm)" -rf /tmp/x`、`${RM:-rm} -rf /tmp/x` | install_dependency/S2——HEAD(90e0777)同判 S2,两边同漏,候选未更松 | 转 DF-TIER1-SHELL-01 |

## 修复前失败证据(A2,2026-09-26)

方法:supervisor 在候选树外的独立检出 `~/.codex/worktrees/saydo-sc-reland-prefix` 上执行,该检出 HEAD 为 `90e0777`(main 等价代码),只覆盖候选的测试文件(46 个,清单 `~/.codex/tasks/saydo-sc-reland-20260925/prefix-check/testfiles.txt`)后逐条实跑;候选树未改动,指纹仍 `9e48bece…`。SC-48/57 另把本批修复过的测试基础设施换回 main 版本再跑候选新测试,以复现修复前行为。逐项原始日志与汇总在 `~/.codex/tasks/saydo-sc-reland-20260925/prefix-check/`(SUMMARY.md + 原始日志,文件名与 SHA-256 见末节);实施者已逐项核对表中结果与原始日志一致(vitest JSON 逐文件断言计数、脚本 `[fail]` 明细与 exit 码、swift/pytest/playwright 输出)。修复后对应门禁为 gate-10(同一候选指纹 `9e48bece…`):gate-10-1 `just ci` exit 0、gate-10-2 `just precommit` exit 0、gate-10-3 `pnpm exec playwright test` 56 passed exit 0。

| SC | 修复前命令(main 等价检出) | 修复前结果 | 修复后对应门禁 |
|----|--------------------------|------------|----------------|
| SC-05 | vitest callback-email.test.ts | [fail] 6 failed / 24 | gate-10-1 [ok] |
| SC-07 | vitest logger.test.ts | [fail] 1 failed / 7 | gate-10-1 [ok] |
| SC-08 | vitest latency-report.test.ts | [fail] 3 failed / 15 | gate-10-1 [ok] |
| SC-11/38/39 | vitest tier1-cmd-effect.test.ts | [fail] 53 failed / 341 | gate-10-1 [ok] |
| SC-14 | vitest doctor.test.ts(cli) | [fail] 3 failed / 15 | gate-10-1 [ok] |
| SC-15 | vitest supervisor.test.ts + run-owned-reap.test.ts(cli) | [fail] 2/19 + 3/4 failed | gate-10-1 [ok] |
| SC-17 | node scripts/test-install-scripts.mjs | [fail] exit 1(12 项 [fail]:install.sh/ps1 缺引用与拒换行等关键语句) | gate-10-1 [ok] |
| SC-18 | node scripts/test-mobile-release-contract.mjs | [fail] exit 1(5 failed / 226 passed) | gate-10-1 [ok] |
| SC-19 | vitest provider.test.ts | [fail] 2 failed / 18 | gate-10-1 [ok] |
| SC-20 | node scripts/check-remote-surface-inventory.mjs(main 数据) | [fail] exit 1:5 个 HTTP 路由 + 3 个语音 WS 消息(`voice.quiesced` 等)未登记;同一检查器对候选登记数据 exit 0 | gate-10-1 [ok] |
| SC-22 | vitest t2-thin.test.ts + callback-email.test.ts(tailnet 深链用例) | [fail] t2-thin 2 failed / 16,含「配置 tailnet 仍只给本机受信入口」;callback-email 的 tailnet 用例在该文件 6 failed 中 | gate-10-1 [ok] |
| SC-24 | vitest callback-email.test.ts | [fail] 同 SC-05 文件,6 failed / 24 | gate-10-1 [ok] |
| SC-27 | vitest launchd-cli.test.ts | [fail] 3 failed / 6 | gate-10-1 [ok] |
| SC-29 | vitest win32-acl-readback.test.ts + win32-volume.test.ts(platform) | [fail] 9/9 + 6/6 failed | gate-10-1 [ok] |
| SC-30 | vitest tier1-claude-backend.test.ts + tier1-cursor-backend.test.ts | [fail] 1/20 + 1/6 failed | gate-10-1 [ok] |
| SC-33/58 | node scripts/test-release-physical-evidence.mjs | [fail] exit 1(main 版 `release-physical-evidence.mjs` 无 `parseVerifierOutput` 导出,SyntaxError) | gate-10-1 [ok] |
| SC-34 | vitest callback-freeze-race.test.ts + callback-sweep.test.ts | [fail] 6/7 + 1/17 failed | gate-10-1 [ok] |
| SC-46 | vitest runtime-child-wrapper-flush.test.ts + runtime-child-wrapper-syntax.test.ts | [fail] 4/12 + 1/4 failed | gate-10-1 [ok] |
| SC-47 | uv --directory pipeline run python -m pytest tests/test_windows_state_root.py | [fail] collection error:`saydo_pipeline.win32_native` 不存在(main 无状态根检查),pytest exit=2 | gate-10-1 [ok] |
| SC-48 | node scripts/test-gate-temp-cleanup.mjs + main 版 color/emoji/migration/privacy 自测 | [fail] exit 1:gate-temp-cleanup pass=18 fail=13(成功/强败路径残留、skip 标记缺失等) | gate-10-1 [ok] |
| SC-49 | node scripts/test-dev-lifecycle.mjs | [fail] exit 1(main 版 `dev.mjs` 无 `DEFAULT_HEALTH_TOTAL_MS` 导出,SyntaxError) | gate-10-1 [ok] |
| SC-50 | pnpm exec playwright test e2e/console/site-mobile-nav-focus.spec.ts | [fail] 1 failed / 2(收起态 inert 断言失败) | gate-10-3 [ok] |
| SC-55 | node scripts/test-pairing-url-corpus.mjs;node scripts/test-prompt-scan-completion.mjs | [fail] exit 1(11 failed / 216 passed)/ exit 1(main 版无 `setPromptTreeBoundHooksForTests` 导出,SyntaxError) | gate-10-1 [ok] |
| SC-56 | swiftc 分别编译 main 与候选 `DesktopProfile.swift`,同输入对照 | [fail] main 接受原始 a+U+0301 输入并吞掉组合符(token=["61"]);候选 REJECT | gate-10-1 [ok](语料自测含三端用例;swiftc 对照探针非仓库门禁) |
| SC-57 | vitest exact-test-roots.test.ts + main 版 exact-test-roots.ts/global-tmp-cleanup.ts | [fail] 5 failed / 7(main 版无 `sweepStaleExactRoots`/`isOwnedTestRoot`/runId 落盘) | gate-10-1 [ok] |

补充说明(同一覆盖跑的其它观察,不影响上表):

- vitest-daemon 覆盖跑总 85 failed / 704:除上表所列,`policy-approvals.test.ts` 另失败 1 项(多目标 push 含 protected 分支期望 S3 实得 S2,属 SC-38 多推送目标同族);`tier1-cmd-effect-monotonic.test.ts` 在 main 检出上文件级加载失败(`cmdEffectLegacy.js` 为候选新增模块,main 不存在,属预期)。
- `exact-test-roots.test.ts` 在 vitest-daemon 覆盖跑中 7/7 通过是因为候选版 `exact-test-roots.ts`/`global-tmp-cleanup.ts` 一并覆盖;SC-57 行是换回 main 版基础设施后的独立实跑(`sc57-prefix.log`)。

不适用修复前失败的项(A2 规定纯文档/注释项以内容比对为证):

- SC-13/23/41/42/44/52、DOC-*:纯文档/注释对齐,以内容比对为证。
- SC-53:测试自身清理卫生(只改测试文件,产品行为未变)。
- SC-59:测试断言强化为观察生产返回值(main 生产行为已正确,见处置表)。

原始日志(`~/.codex/tasks/saydo-sc-reland-20260925/prefix-check/` 下)文件名、字节数与 SHA-256:

- `pytest-platform.log` 98 bytes `fcd476841e8af121ff907e81a92a59579b64c007b70cb79f9d096806f703fc7e`
- `pytest.log` 1125 bytes `36d616081c541a1e0dfd75bf1c6d03c87901e3356a838efff13c938121b55751`
- `sc-map.json` 2094 bytes `00cf7a62331ad0d7efd3e3f3aa5b8465e8b009cb5b0fc7ce33014183f554a113`
- `sc20-candidate.log` 71 bytes `7c413e5e18145636179f2e0bda6352a2b47903ce4b37b201fe3b7fb982688bcd`
- `sc20-prefix.log` 536 bytes `487f1ab85c93fd9ffce4337f4cba045e93cba7ece400cbeb7916a4d8bf9033ab`
- `sc48-prefix.log` 1578 bytes `261767396ba783ab115ca493f1de199edfb3a227238d4f48e2e7615b6812f7cd`
- `sc50-prefix.log` 1750 bytes `bca73c38d339dc167a0fb0c27ee40044faf725072ce46a64c399d19c28085f42`
- `sc56-swift.txt` 507 bytes `ba1e285fa1ef68d357fdf8a1c9f546903e98789bb44f80f00a5b39bc0e3d5690`
- `sc57-prefix.log` 5188 bytes `95bb182cc41b57c33e68b606ea96cd12231cd64caa3c4611051237f0103dcd2d`
- `test-color-gate.mjs.log` 940 bytes `03dc88d1a72c32c61f99d41b2dcfe7c20829f3454858f6c77eba621ecb637fac`
- `test-dev-lifecycle.mjs.log` 668 bytes `39676c6bb4e07ef366f5f12fc5b060664707d4135ac95002bdd6fd509f12ccb4`
- `test-emoji-gate.mjs.log` 536 bytes `bbb46a0632b148769ce3989ec8130ea0daaacdbd8d8a03ef9e9e0f5d3c020542`
- `test-gate-temp-cleanup.mjs.log` 1394 bytes `bb1fd92a4059d6787ec9fd4dd004b4e510e1cd3a0a07e629e9b07f9649f80d8d`
- `test-install-scripts.mjs.log` 838 bytes `014567b6eaeadc0553115b5447facd24bb91db825c7ae1192a04fff5ac15f7d1`
- `test-migration-tools.mjs.log` 81 bytes `452017d7d11aa75e4dcca1f8b0e5c194755044b1e4402828a70275acc0c5b679`
- `test-mobile-release-contract.mjs.log` 12715 bytes `1152a8d2cfefa76fcba6c143a2e07f7dcd9d1603368ca11ec8779a1e61734d94`
- `test-pairing-url-corpus.mjs.log` 10749 bytes `b5401f3f2faca13b78f9938e2c2b2a9754e57014341f2bc43e9486b7894e3aa4`
- `test-prompt-scan-completion.mjs.log` 643 bytes `1e59a92c1387488231007510a80b50a9c25b5c1560151239d1c30fcf75a31171`
- `test-public-tree-privacy.mjs.log` 816 bytes `8f7228e4e615b8b61c6fc5caa374155d7f3056eddafda3e1b1ccd725936f3ec0`
- `test-release-physical-evidence.mjs.log` 615 bytes `82eb1dd191d08a63367260b5a0e358e390ceb67ab4ec69e41f68381a709bf492`
- `vitest-cli.json` 21471 bytes `a11ab7c96728459f4b3ea8ddb2a4be936ad5545e5bad82c2d4668c76422313c8`
- `vitest-cli.log` 2438 bytes `dce9c248c8085a8385416036449b56f0dde6d945179f111d5dd70ababcff35bc`
- `vitest-daemon.json` 351529 bytes `eba6a6ba8782690d5008ff33e0baf119a3b47343a02289faf5ec42479b28b2e1`
- `vitest-daemon.log` 962 bytes `f84537ac838a172c6f529cf92ac11971305ccb19b765e90182cbe932fae28222`
- `vitest-platform.json` 53629 bytes `ef01562eaef4b5674929b48e84a62909279fd61bebcaf8409b8c315ac3430245`
- `vitest-platform.log` 113 bytes `3b3e3038f3a0d6db227b83031b3627020cd9a681ca5aae624b6870cd847ce849`

## 边界声明

- 所有 `relanded` 修复为「历史修复在当前代码的最小重落地」;来源标记仍 RED 的项(SC-02 语义绑定、SC-51、SC-54)未搬,按 §2.2 登记。
- 历史自测/评审绿不当作当前证据;当前证据仅为上表迭代期命令与最终门禁记录。
- 远程业务面保持关闭;Gate 0/S3/TTS 脱敏/审计不可变未放宽;未新增依赖;未改 WS 词表语义与 DDL。

## 收口(2026-09-26)

- 代码提交 I:`f8405cff0805bb3ca6c1328fb3c0921468f8e947`(父 = 插批提交 `90e07777c3771996dcdaacaea3e6e378409794b6`)。本证据文件与 journal 随其后的 E 提交入库,不自指。
- 独立验收:rereview-10 [ok] GREEN,`acceptance_complete=true`,blockers 为空。评审角色因 Codex 配额用尽按 owner 2026-09-26 指示与 policy 回落链改为 Claude `claude-opus-5-5` fresh 只读会话(非作者、非 supervisor)。此前 review-1、rereview-1..9 的 RED/INCOMPLETE 均已按根因返修,记录在任务目录 `~/.codex/tasks/saydo-sc-reland-20260925/`。
- 完整门禁(候选 git-diff-v1 `3ed19b06b673f4071b35bbf279c89de942fc7ddc56b8223ae437a9f5772f725b`,即 I + 本文件与 journal 的未提交态):`just ci` [ok] exit 0;`just precommit` [ok] exit 0;`pnpm exec playwright test` [ok] 56 passed exit 0(gate-11-*)。
- 额度:实施 1、返修 11、复审 11(含 1 次 Codex 配额失败记程序重试);owner 追加授权 8 次,记录 `owner-extension-1..8.json`。
- 延期 P2(rereview-10,不阻塞,不在本批改动):`P2-SC56-REPRO-TEXT`(本文件 SC-56 行复现描述应以 prefix-check 为准:main 对 `%A`/`%a`/`abc%A` 已拒绝,差异只在原始组合符);`P2-SC48-55-MAP`(A2 节与处置表对 `test-prompt-scan-completion.mjs`、`test-gate-temp-cleanup.mjs` 的 SC 归属不一致);`P2-SC59-VERDICT`(SC-59 为测试强化,判定宜为 already_fixed_on_main + 测试补强);`P2-SWIFT-COMMENT`(`DesktopProfile.swift` 百分号截断注释与 `limitedBy` 返回 nil 的实际语义不符,代码正确)。
- deferred:`DF-SC51-WIN-STDIO`、`DF-SC54-SPIKE-EVIDENCE`、`DF-TIER1-SHELL-01`。
- not_run:Windows 原生 API、三端真机、官网部署、真实 SMTP/ntfy、发布动作;远端 CI 以推送后公开快照仓结果为准。

## 2026-09-27 双向审计勘误（当前整合候选）

保留上表与 09-26 收口时的原始判定；以下纠正其四项 P2，不改变历史评审或门禁结果。

- **P2-SC56-REPRO-TEXT**：SC-56 的有效差异是原始 `a+U+0301` 输入被 main 吞掉组合符，候选拒绝。`%A`、`%a`、`abc%A` 在 main 已被拒绝，不是修复前独有反例。以本文件 A2 的 Swift 对照记录为准。
- **P2-SC48-55-MAP**：SC-48 对应 `test-gate-temp-cleanup.mjs` 及 color/emoji/migration/privacy 自测的退出与临时目录清理；SC-55 对应 `pairing-url-fixtures.mjs` 的读取完成/关闭错误传播及 `test-prompt-scan-completion.mjs`，配对语料测试为同模块回归；SC-57 对应 daemon 的 `exact-test-roots`/`global-tmp-cleanup` worker 归属。不得把三组测试互换为缺陷证据。
- **P2-SC59-VERDICT**：产品行为判定为 `already_fixed_on_main`，本批只是加强 `tier1-executor.test.ts` 对真实 `verify.json.stdoutTail` 的断言，不能把测试补强写成产品修复。
- **P2-SWIFT-COMMENT**：已校准 `DesktopProfile.swift` 的说明：超过 end 返回 nil；恰好到 end 表示百分号后仍有两位，是否有效由十六进制检查决定。本次仅改注释，没有重跑原生设备。
