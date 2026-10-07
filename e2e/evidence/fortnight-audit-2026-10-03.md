# 2026-10-03 SayDo 整合与双向审计

状态：最新代码I `f8d74a121037b5bc5482f927b62f93771cab059e` 本地just ci/PW退出0（Node3865通过/21跳过，Python160，PW64）；最后两fresh对已读I12/I13/I14范围PASS_SCOPED，整体RED/INCOMPLETE。root另补固定E七门实际0；作者旧NOT_RUN、旧8RED/预算/600及20原字节未恢复保留，GitHub push/cleanup未执行。

## 范围与保全

审计范围为 2026-09-19 至 2026-10-03 的 46 个原提交、160 个文档路径（149 个原提交来源及 11 个未提交来源独有文档）。整合入口 `d023ffce`，本地来源快照整合后 main 已到 `53be7405954bbb7e2cad299cd59f5aa3ee2dad02`；后续修复仅在独立候选，尚未合回、push、公开发布或部署。

38 个冲突逐项裁决并保全来源：旧 fortnight 的 164 项现实运行修订保留，truth-plane/checkers/contracts 采用较新的 2026-10-03 合同，C14/D1 没有回滚；canonical 仅裁决冲突段，非冲突运行修订保留；journal 追加双方独有过程，已吸收重复段不重放。三份 CI clone 产品代码字节等价，受控 ours 多父提交登记吸收；两份 owner 审读专用输入完整归档，不引入产品树。foundation 脱敏版本与其旧同义内容保全，不重复 journal。来源 bundle/tar/index 保留，尚未清理来源。

主持对 12 个非 main 输入做 blob/mode 读回，原 source 匹配；两个 owner17 输入的原有 CRLF 与最初 tar 字节相同。ignored 运行态不在此读回范围，保全不等于实现语义通过。

## 文档与提交双向核对

完整逐项矩阵见 [160 文档／46 提交初轮矩阵投影](fortnight-audit-2026-10-03-matrix.json)。原件为任务外 `evidence/audit/bidirectional-semantic-matrix-initial-reviewed.json`，1,469,150B，SHA-256 `5b3de26ab1b7b96d997c8034dd42c3434e34e1dea0c1296cc2cf9dbbfbf59f92`。160 个文档行、46 个原提交行保留每名初轮 reviewer 的实际全文/diff/选段/程序层级、FAIL/WARN 和未建立项目；仅固定 I2，后继修正待新 fresh review。投影递归将真实当前任务根替为 `$TASK`、真实用户 home 替为 `~`，未检出明确 credential 格式；保留完整结构/数值/全部 actual extent/FAIL/WARN/unverified。投影不是字节同一原件，原件未修改。文档视角实际全文 45 份，其余为差异、选段或机械核对；不能宣称 160 份全文语义审读通过，也不能把机械映射升为全部实现接受。大 journal/机械库存与历史大件的剩余语义限制原样保留。

已修的确定事实口径包括：完整开发历史位于私有 SayDo-archive，公开 SayDo 为快照；公开 release tag ruleset 21510845 已 active，贡献主线分支保护仍未切换；canonical 范围包含 docs/modules 与 docs/adr。module-card 的 durable owner 与目标 DAO 归口分开，四项 dual_write_gap 仍未收拢，Python/WS+RMS 为现役，Pipecat/Silero 为目标。HANDOFF 的 rc.4 与旧候选“未合 main”限定历史时点；PG 执行卡与累积 evidence 加现役索引而保留旧预算、原 RED；AS 隐私证据的 dirty 说明限定冻结前时点；旧手机 LAN 部署步骤标为历史，现役 PG-01B 业务路径仍 403。

RF repair-3 的历史 725 分母实为 636/14/15/4/55/1，原 658 不属于该历史提交分母；当前机械库存另计，不沿用旧数。CTX 仅把“有效 11/16”纠为“未退役 11/16，不代表当前有效”，三份派生摘要由现役 renderer 重建；原日期、600 题、退役 57/未退役 543 及原五项退出集合不变。

## 普通实现修正与局部证据

六文件现役 Focus 控制台 API 同根因已回修：状态、既有 Focus 事件/投影与主同连接 SQLite 审计统一外层 immediate 事务；unknown/file/同文件第二连接 sink 在任何状态写入前 409 拒绝。resolve/defer、Focus create/archive/abandon/fork/reopen、artifact create/realize、四空间写、expectation adjust/withdraw、lane create/retire/unretire/redo 与既有 waiting 共20入口；body/schema/enum 不变。abandon 的全部 active activation 关闭搬入锁窗，不再吞真正关闭失败，生命周期/衍生义务/audit 同时回滚；只读与 redo preview 不被能力门误拒，可选 directionIgnored 保留。逐入口代码 bytes/SHA、故障前/后与实际覆盖见 [同库原子修复证据](fortnight-audit-2026-10-03-api-atomicity.json)。新回归106例加5份旧文件共173 PASS，type/lint exit0；真实 SQLite 全表快照，函数/API返回值实测，不冒称作者 HTTP network 或原生验收。

- 等待依赖 set/clear 在同一 FocusWriteTx 锁内核 semanticAuthority；提供 capturedEpoch 时围栏，不提供时锁窗内现读，HTTP body 没有新增 epoch。无变化 clear 同样检查权限，合法 no-op 不改 updated_at。主 SQLite audit sink 与状态/event 同事务；非同库 sink 前置 409，避免状态已写但审计失败。clear 不冒用 woken 或造新 event。该拒绝边界先单独冻结 canonical `a97b9dfd` 并由双视角核一致，才实施。真实 SQLite 负例核等待列、updated_at、focus_event、audit 均不变；audit trigger 故障回滚 set/clear/task，非同库 sink fail-closed。权限 no-op 首次新增负例实际 3 FAIL，修后 dependency/isolation 共 45 PASS。
- Playwright 默认 owned mkdtemp 唯一状态根；47188/47189/47120 启动前拒占，ready 需本轮 child 存活和新 HOME 的 token/identity 证明。父端 fd 在 spawn 后 finally 关闭。runtime 写入本 run evidenceRoot，real-entry/journey/console 默认各自从它派生，证据留存、状态仅回收 owned 根；显式 env 可兼容，默认不更新 tracked 截图。单测 journey 默认当前 workspace 唯一 artifacts 根。真实 TCP 占用与外国 HTTP 200 负例、两轮唯一目录/保留邻轮 sentinel 已跑；固定 `f32d64ef` 的完整 Playwright 已实际 64/64 PASS；后继证据更新不改这个测试对象。
- 两个历史 harness 仅修隔离装配：journey 正/负模式 owned 唯一状态、既有证据拒覆写、端口拒占；旧 Cursor smoke 默认 mktemp，显式既有根拒绝。实际局部负例/初始化前缀和 shell 语法通过；付费 CLI、真实 provider、旧正式 journey/smoke NOT_RUN。
- Windows stdio dispose 的 pending/disposed/异常明确传播；pending 不 emit close 或释放 consumer lease，异常/期限记 contamination 并可见；production teardown 在资源实际 disposed 前不关 job/process handle 或丢 owner。TS fake/unit 两文件 105 PASS、1 SKIP；不重启旧 SC51 原生/observer，不宣称 Windows/native 证明通过。
- RF volatile 承诺用真实隔离 Git 仓验证：首次 clone 前提失败保留；前提修正后 baseline exit0，只新增一个 owned WT，旧 checker 唯一失败为 matrix denominator drift。修正后增加/移除 WT 都 exit0。稳定类仍 fresh exact-set，legacy 清单、具名处置和 A 行只取同一落盘快照；正例同步 JSON/MD/A，快照缺失、A 单面篡改、具名处置孤儿均实际拒绝，17 个 mutation case 全部符合预期，原稳定 source/effect 负例保留。

I4 时点 RF 宽产品源 852，其中 849 六语言 source_corpus 字节绑定，3 kts 参与有限文件写词表；ProcessBuilder/keytool/debug.keystore 副作用不由该绑定/词表证明，RF-10 Android 构建验证仍 future。16 类、645 注册候选点、1369 处置键（1280 verified_semantics、14 excluded_nonproductive、15 migration_only、4 dual_write_gap、55 declared_only、1 observed_fact）。本轮 7 新注册均测试装配/模拟，逐点读后登记；31 个初次及 54 个后继坐标迁移核直接 owning handler/function/分支与 region 相等，源哈希更新只登记 source census。两条旧 win32 guard 坐标迁入 test helper 后不再扫描命中，原处置保存外部历史；不删除真实 Windows 清理分支、不把 1369 当业务运行通过。legacy 落盘快照以本次生成 A 行为准、具名 selected 17，未声称全部产品语义已验。六 API 回修另有10个纯导入后移的 WS fixture坐标、5个具名表写事务边界与14份机械 corpus 摘要更新，注册/处置总数不变；不把摘要刷新升为全文件语义接受。

## 原始失败与 latest 分开

完整精确 argv、即时 exit、日志字节与 SHA、候选基线和实际环境的脱敏投影见 [门禁索引](fortnight-audit-2026-10-03-gates.json)；精确原件保留任务外 implementation，同名原件字节摘要在索引中，原日志不入 Git。I3 全基线绑定 `f32d64ef`/产品706；六 API 回修 I4 全基线绑定产品 `b2ffc364`。后继证据更新不冒充原测试对象，E 不自指。

| 阶段 | 实际结果 | 当前解释 |
|---|---|---|
| 首轮 full-baseline-01 | 44 argv：29 PASS / 15 FAIL | 原失败保留，非本候选新 full |
| I2 完整普通基线 | 41 argv：39 PASS / 2 FAIL | RF volatile fixture 与 just ci rg ENOENT；8 个旧 PG/CTX 阻断未重跑，不少记原失败 |
| I2 Playwright | 64/64 PASS | 仅固定旧 I2，部分制品污染旧目录，见下；不继承为新候选 PASS |
| I2 just ci | daemon 2744 PASS / 2 FAIL / 6 SKIP | memory-retrieval 两例 spawn rg ENOENT；Python fail-fast NOT_RUN，不能称双矩阵通过 |
| 新普通 focused-13 | 9 argv 全 PASS | dependency/isolation 45、装配负例、typecheck/lint 等；基于工作稿，不是 clean 新 ref 全门 |
| RF focused-17 | 7 argv 全 PASS | 真实 WT 增减、write/check、17 mutation、transport/effect、doc-links、emoji |
| 证据入跟踪后 freeze-check-18 | 6 argv 全 PASS | 仅派生库存、链接、emoji、隐私与 diff；不代替 full |
| 完整矩阵投影入跟踪后 evidence-check-20 | 7 argv 全 PASS | 只更新真实派生 census；RF/链接/emoji/隐私/diff/precommit，不代替产品full |
| 完整 ordinary final-I3-19 | 41 argv 全 PASS | 实际对象 clean `f32d64ef`，不继承到后继证据 ref；8 个旧 PG/CTX 首次 FAIL 保留 |
| 固定546六 API故障前 | 17 FAIL / 2 PASS / 71 SKIP | 17 API ABORT及2 activation故障共19实际；archive两例是正确回滚对照，其余原失败保全 |
| I4 focused-25 / RF-26 | 3 / 4 argv 全 PASS | 173测试/type/lint；精确RF write/check、diff、emoji，非独立验收 |
| I4 证据入跟踪后 check-28 | 7 argv 全 PASS | 派生 census、RF、链接、emoji、隐私、diff、precommit；不冒新产品 full |
| 完整 ordinary final-I4-27 | 41 argv 全 PASS | 实际 clean `b2ffc364`；Node3728 PASS/21 SKIP、Python151 PASS、PW64 PASS；旧8红门未重跑 |

本次完整普通门开始 `2026-10-03T11:19:44.643276Z`、结束 `11:32:54.599412Z`，41 个即时 exit 全为0；整段约790秒，小于2100秒runner限额。`just ci`日志131582B/SHA `741564809b462c7457b6aeb4be929f4f0fe8804c7e8827a05c762fb658aca1ed`，PW日志8258B/SHA `42735d44c0b4c4abc7a8336e5429316ee93ee3e736c46fba219371adac673fd6`；其它逐门原日志文件名/字节/SHA均在链接索引。门禁前后HEAD=f32、clean、fingerprint一致，113 tracked图像逐字节摘要未变。

focused-17 可证开始 `2026-10-03T11:00:14.018072Z`、结束 `11:03:25.065683Z`。模型实际采样入口/终态与连续活跃时长未建立，记 unknown，不能拿子 runner 的有限时长冒作整个实现调用满足上限。原生作者派发 `07:38:27.023Z`、followup `07:51:20.848Z` 已由宿主读回，followup 不冒称新模型 turn；原 opaque prompt 不复制/解密。旧 PG/SC 预算不因收口或续接重置。

rg 缺失已定位为 runner PATH：实际本机 rg 为 15.2.0（4030432B），本次 PATH 显式包含其真实目录。新完整 `just ci` 的两矩阵均实际运行：contracts155、platform121（14 SKIP）、CLI74（1 SKIP）、console505、daemon2767（6 SKIP）PASS，共3622 Node PASS、21 SKIP；Python ruff通过、pytest151 PASS。Playwright64 PASS，precommit及原适用ordinary required全部exit0。I2 CLI reap 五例及 distribution 本机通过证明已吸收 CI-FIX 修订，不证明远端已跑修正。

I4 完整普通门实际开始 `2026-10-03T12:25:05.800035+00:00`、终态 `2026-10-03T12:37:22.774345+00:00`，41 exit0；`just ci` 原日志 127903B/SHA `99cd9a39f353b1ecf2b2ac791b4f21e41309abffe49544087a8a70f4add831c9`，PW 8261B/SHA `9011442f1b0f1d5419975576538f361a67398b9e29422896de253d00b6958580`。各 argv、即时 exit、实际 HOME/SAYDO_* 与日志摘要见门禁索引；Node contracts155/platform121（14SKIP）/CLI74（1SKIP）/console505/daemon2873（6SKIP），Python ruff与151pytest实际运行。I4前后同HEAD/clean/fp、113 tracked图像和20已知旧覆盖路径当前字节均未变，只证这些具名范围，原旧20字节未恢复。第9保守原生派发窗口截止12:45Z，12:40停止新增执行；作者首次可证时钟12:01:29Z，模型采样入口仍unknown，不重置PG/SC资源。

## 历史证据覆盖事故

三处自动输出默认路径误写旧任务，共 **20 个原有 PNG/JSON 被覆盖，原字节未恢复**：journey browser 8 个、real-entry 11 个、daemon journey 1 个。逐文件原/现路径、首次与最后 mtime、birthtime、当前字节与 SHA、是否覆盖、保全位置见 [20 项覆盖明细](fortnight-audit-2026-10-03-historical-overwrites.json)。当前文件与本轮副本已保全，旧目录未删除，旧 RESULT/task.json 未改。

已知原 board-kanban 292339B/SHA `31b457fb776cc469a196846aaa8e0daeefe603cbcbaec8639733df511a5539b3`、board-lanes 253663B/SHA `d6e8b828651f1b66ff5e88b24082746aaffbdb08c42d586dbe1796da05e9d962`，13 份归档和已知可见副本未找到原字节；Time Machine 无可用 snapshot/backup，379 个可达 Git 图像对象中两原 SHA 对应对象为 0。其余原值也未建立，不能猜测恢复。**这 20 项当前字节不能继续证明原轮截图/JSON；不据此撤销旧日志所证曾运行测试事实或改旧结论。** tracked 截图早先本轮值先保全后恢复基线。主持另外实际核本次 full 后113 tracked图像未变、这20条已知旧覆盖路径未再次覆盖（外部 `post-full-baseline-I3-19-output-preservation.json`）；只证这些已知路径，不证明所有 ignored/外部路径不变，原旧字节仍未恢复。

输出入口普查原件 `test-output-route-census-final-18.json`：433 个受跟踪 code 文件，258 个命中文件/3031 行模式命中，逐项分类；本范围未再发现旧 .codex/tasks 硬编码输出。模式含字符串/注释，别名可能漏报，不是完整 AST 或全部运行隔离证明。当前 PW 及上述两个 harness 的重点 owning source 已读取并有局部运行；历史 narrow-loop-manual、旧 walkthrough 截图再生成器、claude spike 等不在本次普通 CI/PW 入口，可能有固定历史输出，明确 NOT_RUN，不能声称所有历史脚本安全。每条 runner 的实际 HOME/SAYDO_* 以其 receipt 为准；新 receipt 的 HOME 仍为用户根，状态由显式 SAYDO_HOME/worker/owned root 控制，不声称所有 command HOME 为外部隔离目录。

## 未决与非本轮通过

PG-02/D1 保持 RED：合并后 product_source_mismatch 原失败与 frozen 旧产品 ref 保留；不重建台账指纹漂绿、不改 source-proof/算法、不新增 native build/install/observer 证明。旧 action checker 时间/日志与旧 ledger 尺寸失败保留，未重复无变化的 95 秒扫描。当前 action-ledger 精确为 916049B、SHA `95c054ccce59d84000d62546206272d68670543f0d290ab96674f2fdd24dc0ca`，不是曾误记的 1026042，也不是 3.6MB 原始扫描日志。

CTX09/12/16 到期仍 FAIL；五份退役 exact-set 不扩，原来源/日期/600 分母与 Q0 历史不改，见 [到期结构观察](../../research/customer-question-corpus/expiry-observation-2026-10-03.md)。四个 dual_write_gap 与未来 RF-01..11 不趁机施工。真实 provider/设备、Windows native、D1 observer、安装、公开发布、部署均 NOT_RUN 或待原授权，局部 fixture/TS fake 不认证这些能力。

公开 GitHub 当前信号分开：私有 run 36232389634/d023 因 billing 未启动 8 jobs；公开 run 36232419283/88aa 的 Node 与三 OS distribution 失败，Python/Android/iOS/fresh-origin E2E 成功。未改 Billing、未触发公开发布。本机站点仅 I1 的 10 HTML ×1280/390 共20截图 PASS，键盘导航/焦点/404/溢出等检查无错误，不证明部署或托管 CI。

待收口事项：冻结证据后的两名 fresh 只读最终交叉 reviewer，再按 owner 授权由主持合 main/GitHub/清理；旧PG/CTX/native阻断及预算现势继续保留。本文不自审、不宣称完整交付。

## 当前 run 验收引用的普通回修

产品 I `b6685686bca4393dfaff81e9c870f799015ee83f`。固定721的新发现经作者真实 SQLite 复现：缺失/空runId与同run旧attempt审计均由 getTaskDetail 投影pass，handleTaskAction的真实review函数返回200并推进批准态；otherRun解析失败但详情仍pass，批准409。此为生产函数与SQLite实测，真实网络HTTP未运行；不能把此前fake SQL探针当生产证明。原前置导入装配失败31/32、完整旧状态33/34及工作稿35失败均保留在[本轮逐门证据](fortnight-audit-2026-10-03-run-binding.json)。before34十项测试运行前未记录源码SHA、当时新文件untracked未纳入git diff摘要；外部重建源只按明确编辑序列复原，不冒称事先存证字节。

新writing/coding批准审计显式runId；读取显式runId必须精确本轮，缺字段只允许完整旧writing审计在当前task/run/attempt/tree/package/完整JCS摘要/批准态/逐manual裁决的合取下绑定，空字段拒绝。详情核对最新proof的task/run/attempt/tree/packageRevision与验收exact-set；不合法或解析失败保持unknown，错误writing proof不返回裁决输入。scope只取最新run，当前terminal审计冲突不能借旧scope保pass或批准。现有09/11合同足够，本轮未创建状态/字段schema/商业形状。

修后真实SQLite 12项绑定回归与真实writing executor/settle/approve一项新增回归通过；writing使用fake agent但实际SQLite与Git，新writer显式runId、完整旧writing兼容和错误旧审计反例均实际运行。选择五个文件75测试、typecheck/lint全exit0；console详情状态unknown由实际API投影检验，完整console基线另实际运行；没有把unit当真实网络或provider。RF稳定注册点exact-set不变，source摘要/坐标只更新机械语料，独立增量来源见本轮JSON，不冒整文件语义接受。旧四dual_write_gap保留；本轮机械宽产品源853、六语言绑定850，差额3kts仍仅有限词表、不证明keytool副作用。

完整普通门在clean I开始 `2026-10-03T13:40:36.058487+00:00`、终态 `2026-10-03T13:53:16.140040+00:00`，41/41 exit0，Node 3741PASS/21SKIP、Python pytest 151PASS、PW 64PASS。just ci原日志133208B/SHA `9cff2f971c27dd2276841a6910c566ee07c1377c7cebc4be23b249a8a3844445`；PW 8259B/SHA `7675504199fbd5cccd6d76082be8266df6ace6907cd182902cf82a5d1407f10a`。每门实际argv/HOME/SAYDO_*与原日志摘要均保全；HOME仍实际用户根，不假称全HOME隔离。113受跟踪图像与20已知旧覆盖路径当前字节前后相同=True，只证这些路径，原旧20字节未恢复。

本轮工具可证首次时钟13:21:07Z，模型采样入口unknown；宿主累计观察12次原生派发工具调用，不当modelturn/default额度/V4机器回执，旧PG/SC/CTX资源不重置。13:55停止新执行/14:00硬终态。宿主回执中的固定721 code PASS_SCOPED/文档GREEN_SCOPED仅其实际范围，文档新取证迟14秒、13:26:57关闭迟于13:25，原546文档closing迟44秒也保留；这些不等于新I验收。本轮未合main/push/清理，真实Windows/native/provider/paidCLI/旧正式journey未运行，8旧红门未重跑。

I5 后继证据入跟踪后的7项检查（RF派生/检查、链接、emoji、隐私fs、diff、precommit）全部exit0；原日志摘要见门禁索引。该检查对象为证据工作稿，不冒充产品full重跑或新独立验收。

## 当前终态一致性的普通回修

产品I `6fb614d6fe5dbe523b563b47c0a9b046e2f8dcef`。固定0d6 fresh的新反例由作者重新设计真实SQLite夹具复现，不执行reviewer命令。原44的immutable audit删除夹具失败、46的tuple形状错误及47的console/type失败保留；修正夹具45实际12个产品反例（coding9/writing3），34个控制通过；手工待裁决unknown、agent_claim无ref与合法空AC，均曾绕过同task/run终态冲突/重复/state失配而批准。修正UI反例48使用旧E真实生产源码与本轮测试，运行前保存各源字节SHA，9个实际反例/15控制通过；44/46的夹具错误不冒产品证明。具体源、原日志bytes/SHA、每门argv见[终态修复证据](fortnight-audit-2026-10-03-terminal-conflict.json)。SQLite通过生产函数/API返回封装验证；未称真实网络HTTP，UI是生产mapper与静态渲染。

统一helper保留0条历史terminal兼容；同当前task/run多条、冲突或单条与run.state失配拒绝。coding与writing批准均独立于AC/evidenceRef检查，并在事务内重读最新attempt/terminal后再写状态、outbox、依赖与owner audit。manual/agent_claim未知本身保持合法，合法空AC与单terminal、缺旧terminal、当前writing artifact/Git/JCS和已证明旧writing无runId兼容均有正控制。两生产UI以最新run的evidence_conflict全局禁批准，不依逐AC数量；旧冲突不污染合法新run，redesign mapper不借旧run或错误attempt的proof供证。已有09/11足够，无新业务类型。

clean I6上的定向SQLite67、console61通过，type/lint exit0。完整41普通门开始 `2026-10-03T14:34:43.336872+00:00`，终态 `2026-10-03T14:47:20.901681+00:00`，41/41 exit0；Node 3773PASS/21SKIP、Python pytest 151PASS、PW 64PASS。just ci日志132925B/SHA `78ac46ef6908470a8e91f42af8d6453b236e5d1264180518e04c5d4f7cf3eb7b`；PW 8258B/SHA `37cfeb44cd0f6e1e85e5147278155a3ff4ac371a098154a45512c0dc950ad16a`。当前机械宽源856、六语言绑定853，3kts有限词表边界不变；13份源摘要、8个具名owning block增量说明、坐标/稳定注册exact-set保留，四dual_write_gap不改，hash刷新不冒全文件语义接受。

本次preflight真实 `2026-10-03T14:34:43.089198+00:00`，先clean HEAD/fingerprint/113图像+20已知旧覆盖路径当前字节，再首child；prepared与每门时钟自产回执，launch_requested=UNKNOWN。原I5-39 preflight晚首child约58秒的限制保留，不覆写旧产物；旧每门HEAD/空tracked diff不等于完整启动前untracked指纹。full后113+20具名路径相同=True，只证此范围，原20字节仍未恢复。实际HOME仍用户根，SAYDO_*逐回执，不假称全HOME外部隔离。

实际first-tool 14:15:07.916430Z，模型入口/active UNKNOWN；宿主累计观察15次原生派发工具调用，非modelturn/formal V4额度。14:50停止新执行、15:00硬终态，原PG/SC/D1/CTX预算不变。旧0d6 fresh FAIL仅作发现与旧ref事实，新I待另派fresh验收；8旧红门不重跑，真实Windows/native/provider/付费CLI/旧正式journey及专项真实网络HTTP未验。本轮不合main/push/清理。

I6 后继证据工作稿的RF派生/检查、链接、emoji、隐私fs、diff、precommit七门均exit0；实际回执和原日志摘要见终态修复JSON。该工作稿检查不冒产品full重跑或独立验收。

## 草稿持久化、语音归属与敏感日志普通回修

产品I7 `2ff6fa9f86d751f150760f0a77bf591a7da6268a`，仅Python测试导入排序及RF机械派生校准后的I7b `d0af3030347c3eaa5e4f7bb2c327b1c7eb5ae2c8`。SUP01–10按09§10.1、11§5.10和E3现有合同对齐，没有新增schema/业务类型/远程权限。草稿写失败前置阻断并保留当前稿、所有串行异常结算、未知旧队列拒覆盖/ACK、provider与Hub诊断只记安全type/digest、queued PCM和HF旧稿/回执/ACK接收资格按录音owner绑定；ADR校准私有billing8job未启动与公开旧失败。具体每项实际scope、before/after/夹具限制、源码SHA、逐门argv/clock/exit/log bytes/SHA见[本轮证据](fortnight-audit-2026-10-03-voice-storage.json)。

作者自主before容量两项真实FAIL、HF/PTT换sid queued音频两项真实FAIL、坏ACK实际FAIL，旧Hub真实logger raw bare canary stderr/JSONL均true；首次unclosed JSON输入阴性不证伪真实回显。focused修正后console67、daemon18、Python71通过，type修正后exit0；首次fixture/type失败保留。legacy HF orphan自测遗漏holdForConfirm前提，未形成pending，该例不能证明有效orphan缺陷闭合；代码按合同限制matched闭合项，仍需新fresh有效前提验证。所有Storage/ASR/provider/WS接收资格均故障注入或合成状态，不称真实provider/native/browser/握手验收。

I7首轮justci因Python测试import排序失败，Node3791PASS/21SKIP、pytest未运行；PW64PASS。受控SIGSTOP/SIGINT及进程130、15个终态/26未运行原回执保留。I7b clean preflight真实16:39:25.450537Z先于首child `2026-10-03T16:39:25.540141+00:00`，本轮末child `2026-10-03T16:48:57.849455+00:00`；41条中23通过/1失败/17未运行，未运行：required-28, required-29, required-30, required-31, required-32, required-33, required-34, required-39, required-40, required-41, required-42, precommit, rf-fixtures, rf-fixture-mutations, release-provenance, release-physical, notices。I7b Node3791PASS/21SKIP、Python160PASS、PW64PASS以实际日志摘要为准；每门HOME仍用户根，SAYDO_*和独有输出逐回执，不假称全HOME隔离。

本轮full后13具名旧边界源、113受跟踪图像和20已知旧覆盖路径当前字节全部相同；只证这些路径，原20字节未恢复。RF仅真实source/注册坐标与库存派生更新，不将hash/宽词表当全副作用语义接受，4 dual_write_gap保留。14个历史diff补核的实际121完整/4部分/880未读hunk限制保留，不升160/46全语义通过。SUP-FOCUS-PARTIAL-11仅接收未施工，旧8PG/CTX首次红门不重跑；未合main/push/清理。first-tool15:57:15Z，16:50停止新增/17:00终态，model entry/active UNKNOWN；20次原生工具派发观察不是modelturn/formal V4额度，不抵销旧资源。

## Focus 单条详情失败的诚实任务投影

产品I8 `45e4598890e4853a1380cb628e76b649df4ae934`，唯一新增产品范围SUP-FOCUS-PARTIAL-11。依据09§15.2.3/11§5.9，绑定成员以Focus读口为准，详情只按同id补齐；单条GET失败仍显示真实绑定任务标题/status，缺详情卡与上下文明确提示并提供重读/读详情，未知包/project/attempt/风险/成本/证据不展示，Route其他TaskAction拒写。完整详情恢复原动作，合法包独立读口不因另一任务缺详情被伪造或删除。未新增schema/DB/远程权限，`detailUnavailable`仅只读视图可选字段。

作者执行前保全新测试原源及9输入字节摘要。生产helper/loader/fetch500故障注入5FAIL/1正常控制，修后35局部测试/type/lint通过；实际空、部分多任务、错id/外来包、GET恢复和无危险按钮控制均保留。Route写口守卫是实际生产静态核对，不冒真实交互；真实HTTP网络/新专项浏览器故障未验。两次准备装配错误（semantic dict误当list、ps误匹配自身shell literal及缺manifest）只立即拒启动，未启动重复产品child。完整细节、owning blocks/SHA、各argv/clock/exit/log bytes/SHA见[本轮证据](fortnight-audit-2026-10-03-focus-partial.json)。

clean I8 preflight `2026-10-03T17:08:07.415772+00:00` 在首child `2026-10-03T17:08:07.539478+00:00` 前；末child `2026-10-03T17:21:27.573764+00:00`。41门实际41通过/0失败/0未运行；Node3797PASS/21SKIP、Python160PASS、PW64PASS，launch_requested UNKNOWN。本轮NOT_RUN：无。普通基线不认证旧8红门、托管CI或真实设备/provider。

13旧边界源、113受跟踪图像、20旧覆盖路径当前字节full后均相同；原20字节未恢复，不扩大为全部ignored/所有外部路径不变。7份源仅实际具名delta与测试语料SHA更新，稳定注册exact-set无变化，4dual_write_gap保持；RF宽源与3kts有限词表边界不变。旧I7b required27超时/17NOT_RUN及16:50:36晚收尾、其E新增后小门未运行保留，本次不改原失败。16:54:20首工具/17:30停新执行/17:40硬终态，model entry/active UNKNOWN；无formal V4回执，不清零旧资源，未合main/push/清理。

I8后继证据工作稿的RF生成/检查、链接、emoji、隐私fs、diff与precommit七门实际7项exit0；其余[]。逐门argv/logbytesSHA已入本轮JSON；工作稿门不冒产品full或独立验收。固定新E只读复核使用从I8实际复制并SHA绑定的隐私检查器，结果在本轮任务外fixed-E8-81即时回执；本文不自指E或提前填其PASS。

## 风险来源、离线自测、包状态及M0未知写入结果回修

产品I9b `8e796be6a5eb8c68c017b25906376c318c1777ba`（此前I9 `229037b16e549ea814086c2bf7271b71d9051215`完整41）；I9b只复用权威RiskLevel import/re-export，null只读投影保留，完整just ci/PW/41在I9b NOT_RUN，不继承旧结果。风险canonical先固定 `a3833035e57db8377e6d43d7dc589ba6fa7c9cf9`，双视角限定文案一致后才实施。合法显式S0–S3保留；缺失/null/invalid显示未知，不从状态或最大收据造任务风险，不改09枚举/DDL/S3强认证。离线mutation先验正常基线，并逐case要求目标诊断；损坏baseline和无关错误不能假绿。Focus同id/revision权威包状态保留，缺status任务body不造proposed/不跨revision借状态；draft/proposed/approved/expired/superseded仅proposed有批准入口，旧direct拒绝保持。非共享sink的generic ledger.add异常无法确认rollback时persist unknown；默认同连接assembler及显式拒绝none、真实rollback none保持。两EOF恰1LF与九插批ID注释校准不改行为。

作者before：风险9FAIL/4PASS及真实SQLite/S1投影；离线坏baseline旧mutation返回0；包正常详情approved→proposed及三非proposed卡按钮反例；真实MemoryLedger非共享先写1行却none。CJS装配、Focus fixture缺字段、payloadOf作用域及两次错误manifest准备失败原稿/日志保留，不当产品证明。修后风险SQLite/helper/SSR、包三种真实强状态、五态/不同revision/外来task、离线7目标诊断和故障基线控制、M0真实21例均有实际回执；没有冒作者真实HTTP/浏览器/provider运行。逐argv/输入源SHA/首失败/latest在[本轮证据](fortnight-audit-2026-10-03-risk-offline.json)。

clean I9（非后继I9b）preflight `2026-10-03T18:48:25.113428+00:00`在首child `2026-10-03T18:53:05.575968+00:00`前；末child `2026-10-03T19:05:42.855422+00:00`。本轮41门实际41通过/0失败/0未运行；Node3822PASS/21SKIP、Python160PASS、PW64PASS，全部以真实摘要/exit为准，launch_requested UNKNOWN。未运行：无；失败：无。I8的3797/21/Python160/PW64保留原轮次，未继承为I9。

本轮full后13旧源、113受跟踪图像和20旧覆盖路径当前字节一致；20原字节未恢复。RF宽源863/六语言860（另3kts有限词表），12份具名源码摘要仅按真实owning块/测试变化刷新，稳定注册exact-set及4dual_write_gap不变，不能把hash或宽词表当全副作用证明。初160/46阅读层级/FAIL/WARN/未核项目与原14diff 121/4/880限制保留，宿主/E8两视角新增范围独立记录不升整体PASS。18:11:16首工具、19:15停新执行/19:25硬终态；model entry/active UNKNOWN、native dispatch观察24不是modelturn/formal V4，不清零旧预算。未合main/push/清理/部署，待新固定ref两fresh只读验收。

I9b类型复用差异的typecheck/lint/相关console实际3门exit0，6文件74PASS；作者此前口述75已纠正，原日志不改。I9b完整just ci/PW/41为NOT_RUN，I9 full41结果不继承。E9证据工作稿RF生成/检查、链接、emoji、隐私fs、全时期diff、precommit七门实际7项exit0；提交后固定E只读检查另由本轮任务外fixed-E9-103回执记录，不在本文自指E或提前填PASS。

## 决策包canonical模式保全与历史临时receipt索引说明

产品I10 `538357b3b547ad8e91399e5a76ce89b6ae90d15a`，先文案 `1cd95e311cda50db069bd8a5d92277d425b2ebae` 两fresh固定文本PASS_TEXT_SCOPE后实施。DAO/两API保留mode，mapper曾丢mode，导致同id/revision旧direct包卡片误画逐步并允许批准回调；后端direct_mode_not_wired原本拒绝，问题是UI失实，不冒权限绕过。只读投影引用canonical类型，合法mode优先于selectedMode，Focus同revision补齐保全合法模式，direct按钮及回调拒绝；旧UI/direct、现役不置可否每步问你和无selector保持，没有新枚举/DDL/S3权限。

作者新before源在执行前保全：6例5FAIL/1PASS及真实SQLite/DAO/digest/合法Focus绑定→两个GET函数→lookup→Card SSR/实际callback四对照，direct observer approve各1、DB不变；after六门exit0、相关53PASS及四SQLite对照通过。函数读口与observer回调，不是作者HTTP/浏览器/后台批准写入。RF第一次准备因新测试untracked，严格5源断言失败且未生成manifest，后续FileNotFound无child；纠正跟踪顺序后真实发现5源，不放宽checker，原错误保留。[本轮证据](fortnight-audit-2026-10-03-package-mode.json)记录每个argv、clock、输入与日志bytes/SHA。

clean preflight `2026-10-03T20:02:38.420679+00:00`在首child `2026-10-03T20:02:38.529372+00:00`前；末child `2026-10-03T20:10:11.618496+00:00`。新just ci/PW实际2通过/0失败/0未运行；Node3829PASS/21SKIP、Python160、PW64，launch_requested UNKNOWN。本轮完整41 NOT_RUN，不继承I9/E9任何全门PASS；E9 fresh长TMPDIR和别名realpath失败及重试原记录保留。

E9风险JSON原271 raw_bindings只代表当时各读时点，作者本轮读回270匹配/1漂移：write-evidence-I9-101b-write.temporary.json历史203B/SHA1a0e7117a91214323edf86b939383c715017db42dc8f2319364ed71df3ff4cf4，退出cleanup更新后255B/SHAacf333dc19e7bfdd4765d62fa4493ec2afcfe7092a3557f95c4d81cbec964862，terminal463记的是正确最终255。保留203历史摘要，不重构原字节/时间，不称旧271全当前吻合；107原日志/full41/fixed7未因此变化。新E索引排除自身活跃临时envelope，终态元数据任务外另记。

13旧源/113图/20旧current full后同SHA，20原bytes仍UNRECOVERED，不扩大为全ignored/所有外部路径。RF5源真实摘要、861六语言/864宽源及15稳定类exact-set，4dual gaps保持；3kts有限词表不当完整副作用证明。19:42:41首工具、20:25停止新增/20:35硬终态，model entry/active UNKNOWN/native派发观察27不是modelturn或formal V4，旧资源与第24迟exec不抹。作者不自审，未合main/push/cleanup/provider/native/付费CLI/部署。

最终I10b `9eb01747104d77b8eeef46ca2dda4d9b29c83562` 追加PTT测试装配修正，原edit缺hold被registerDoneSpeaking拒绝，新增返回断言真实before 3PASS/1FAIL；本人额外preparing广播断言错误的中稿3/1也保留，未冒产品缺陷。改true并核forward/captureId及公开legacy拒/pending后4PASS，type/lint/RF实际通过。voiceBarrier产品字节未变；I10b新完整ci/PW与41 NOT_RUN，后续独立验收不得继承I10结果。

I10b证据工作稿七小门RF write/check、links、emoji、privacy fs、全期间diff、precommit均实际exit0；固定E小门随后任务外单独记录，不自指本E通过。最新I10b完整ci/PW NOT_RUN，I10两门仅历史。

## 测试根登记清单回修

I11 `74792ae4464216866772e9b09203aefb961958f3`，只修测试卫生。原register把读/JSON/shape错误当空集合覆写，真实syntax/shape三步登记→清新→assert会假绿且旧根仍在；独立before源与依赖SHA执行前保存，before16例9PASS/7FAIL，生产函数正常+两反例exit1。lstat确缺失才新建，共用严格解析并拒当前run归属不符；合法legacy数组/无runId对象与正常追加集合保留，bad登记原字节保持。mixed/run为边界控制，不冒额外产品根因；悬空链接是真fs反控，Windows该fixture显式skip，本地darwin已跑。旧assert先fail后清扫/死PID归属门不改，坏清单不能恢复此前未知路径，probe只finally清自己精确sandbox。

focused118两文件20PASS、三函数控制/type/lint/RF和prepare119均0。clean full preflight20:42:52.129315先于首child20:43:30.900369，prepared20:42:52.144985；launch/model entry/active UNKNOWN。ci120 exit1，controlled-runtime daemon health前exit1未给诊断正文，Node3837PASS/1FAIL/21SKIP、PythonNOT_RUN；单例121 1PASS/9SKIP只证该次通过。ci122 exit-9非runner超时、无interrupt，partial Node/PythonNOT_RUN；两失败原因UNKNOWN、不猜环境、不删除日志。ci12320:59:25.792699→21:03:21.292069实际exit0，Node3838PASS/21SKIP/Python160；同I11 PW12020:45:46.363163→20:50:27.087217 exit0，64PASS。无第4次ci，不继承旧E10/I10，完整41 NOT_RUN。[具名证据](fortnight-audit-2026-10-03-exact-roots.json)列每个argv/clock/exit/logbytesSHA。

原helper273/test90，after293/178；preflight临时279/82描述随后wc更正，原条不冒真实行数。仅两source语料摘要、15稳定类fresh全等，四dual_write_gap不变；有限source/census不是产品全语义证明。13旧源/113图/20旧current同SHA，20原bytesUNRECOVERED，旧203→255索引差异及160/46原阅读层级/FAIL/WARN/unverified保持。#30实际首工具20:27:35、native观察30非modelturn/V4；21:05目标未达，21:15停新增/21:25终态不延，旧资源不重置。#31预告未施工，作者未自审/main/push/cleanup/provider/native/付费CLI。

I11证据工作稿125七门RF write/check、links、emoji、privacy fs、全期间diff、precommit均有实际exit0回执。原write124超过准备截止未启动，124b实际执行0，两项分别保留。恢复后实钟21:15:21Z，超过stop-new 21秒；仅作证据冻结/终态收口，固定E七门全部NOT_RUN_stop_new_deadline，不把工作稿0追认为固定E通过。模型entry/active UNKNOWN，旧8RED及20原bytes未恢复仍保持。

## 凭据委派、原生稿归属与主线展示回修

代码初I12/I13 `336f8a1de91cd0b95ba062ee7563a302d054c557`，最终I12/I13/I14 `f8d74a121037b5bc5482f927b62f93771cab059e`。04/10先固定038fbf5供root核对；真实before揭示广泛query S0承诺过宽，db148af仅收窄普通--get，root实际读delta后再改分类。11主线展示另冻结3e62e659并完成root合同一致性核对后实施。HTTP delegation是GSSAPI凭据委派，写/删除/-c/URL子节/引号与拼接沿既有critical S3，none/policy不特判放行；普通--get及postBuffer/version正常控制保留。旧SC/PLAN2原文保留时点纠正，不重开DF其余defer或旧SC预算。

原生稿在await真实发送前由Web owner保留；false/throw拒绝并保稿，成功不抹后续编辑，同文本新version亦保留；并发与最新重复稿不双发。Swift只在明确ownership transfer清稿，bridge loss/submitting保原稿；四XCTest未编译/未运行。独立浏览器fixture经生产MobileApp/bridge八例40断言通过，但Voice/API/Setup端口是合成，不是网络/provider/native认证。原v1 CSS装配失败没有产品运行；v2六例30断言真实反例保持。

主线与具名/已收支线并列只读展示，NULL任务/未归支线义务保主线；作者SSR before十项3FAIL/7PASS，after十项10PASS。本人未跑真实SQLite/网络的I14生产链，不冒root独立三控制为作者亲证。focused138 daemon实际2文件358PASS，第三风险selector未匹配不能计三文件；其余type/lint实际0。135 CI旧delegation S1断言失败保留，旧用例移出普通组并追加独立S3断言，未删用例。

最新I `f8d74a121037b5bc5482f927b62f93771cab059e`：just ci退出0、PW退出0；Node3865PASS/21SKIP、Python160、PW64。原135 CI失败保留；完整41及E工作稿/固定E七门NOT_RUN，不继承旧ref通过。 clean140 preflight22:09:28.173084先于首child，manifest prepared22:09:28.174179；每个argv/clock/exit/logbytesSHA及阶段ref见[本轮证据](fortnight-audit-2026-10-03-gates.json)中的author_I12_I13_I14。launch/model entry/active UNKNOWN。13旧源/113受跟踪图像/20旧覆盖current逐hash保持，20原bytes仍UNRECOVERED，未声称所有ignored/外部路径不变。RF真实源/坐标check139通过，四dual_write_gap/865宽源862六语言边界保持；3kts有限词表非全副作用证明。

21:26:26首工具；普通native观察31非modelturn/formal V4，22:05目标未达，22:15停止新增/22:25硬终态仍不延。原160/46每行阅读范围/FAIL/WARN/unverified、旧203→255、CI120/122原因UNKNOWN、旧迟时及8RED/600/原预算保持。E只更新已有证据与journal，未新增产品路径；E后小门因停止边界未跑，不用原133/139门代填。作者未自审/main/push/cleanup/真实设备/provider/paidCLI。

本轮closing141首个计数regex未匹配pnpm前缀，Node0为空匹配无效值；据五条原始矩阵行更正3865PASS/21SKIP，原receipt及无效counts外部保留，未重跑。停止时钟读回22:15:07迟7秒保留，此后仅既有结果与证据落盘，未新增门禁。#32/#33为original补读非finalfresh；13原snapshot的11/13为main祖先、另两review输入仅归档。root自有I14 after三SQLite/受控fetch/SSR控制另见gates字段，未归作者或native/browser认证。


## 最后两名fresh交叉评审与主持读回

最后两名真正新的零上下文只读reviewer固定E `b51c277f036d87cd2f92be2786365efdb0cb2dba`：代码#34与文档#35均给current I12/I13/I14 `PASS_SCOPED`，whole为RED/INCOMPLETE；两份manifest由root自写library消费者核对，valid/stop_for_owner。报告与原SHA投影见[代码视角](../../research/codex-findings/2026-10-04-fortnight-final-code-review.md)、[文档视角](../../research/codex-findings/2026-10-04-fortnight-final-documents-review.md)。未执行reviewer提供的命令，没有把raw报告改成GREEN。

代码#34逐读的是50文件路径上的74个80行上下文 diff块（663435B），并有10例真实风险分类/策略/语音门及生产VoiceProvider/MobileApp/FocusPage浏览器控制；WS/API是fake，Swift/设备/provider没跑。文档#35本轮4 current全文/27 changed sections/1 selected；128 NOT_READ，46原commit只metadata。这是各fresh自己的extent，不撤销root及早前reader的真实补读，也不继承它们的PASS。原 prepared NOT_READ、JSON规则、source SHA与整条caller语义不同；#34沿用880表述未合并后续补读，不能作为当前统一未读计数。原160/46行继续保持。

作者#31固定E七门仍按原停止窗口NOT_RUN。root另外于22:39:28至22:39:50在固定E做privacy-ref/RF-check/links/emoji/privacy-fs/whole-period-diff/precommit，七个实际exit0，前后HEAD/tree/status/fp相同；terminal6394B/SHA `841ba865a2bba943b12b5a8b5a43dec35d504247a030d2c059a29d80d6c86a96`。本段是新的普通只读收口，不重开作者、PG/SC窗口或代替独立运行；逐log名/bytes/SHA在gates.json host_final_crossreview。

#35发现rc.12注释过时，root独立全文核release-profile/version-matrix和CLI版本后由原作者只改该注释；新ref `ffe40594b8611c9e82c7bf2aa2374690366407b8`。emoji/mobile release contract231/diff实际0，terminal12138B/SHA `b643f33fa3c35f880cf6cf5b038f5f4b003ab03554f20c32c752f3a3da0ab09b`；非版本bump或发布。两个fresh仍只评E；root证实E之后只有这一处注释，没有把新ref冒为它们已评。

#34 terminal-summary23:03:30距23:00目标210秒；最后owned-check23:04:51另有回执。两者不混计；23:05停新增/23:13硬终态不延。#35于22:39:37收口；#36注释作者22:42:57开工、22:47:55终态。native观察36不是modelturn或formal V4额度，model entry/active UNKNOWN，旧PG/SC累计与20原bytes未恢复保持。

原source13份中11份是main祖先，两private输入只完整归档。当前本地main仍53be，GitHub私有main实际回读仍d023，本轮没有push、发布、部署或cleanup。全部源码/证据接受仍受旧8RED、PG/D1有限额度、CTX09/12/16 owner选择、全历史语义和真实runtime证明及20旧原件恢复限制；600/4 dual gaps与未来RF不改。已发出owner选择与备份信息请求，未获答复；不自行续期、扩额或猜造证据。

最终报告落盘后的首次库存check退出1：2544→2550跟踪文件数与files_scanned漂移，日志141B/SHA c650e6c831cd0f8dd71dd652d407dc25a41b83a68d6c84ddb492e6bc045ec2c7。随后已有派生write实际退出0；root过严地把volatile legacy列也要求全等导致比较脚本退出1，原失败保留，未再启动write。独立比较证实15稳定类及865源语料全等，legacy仅新增两个具名fresh worktree，原42条完整不变；派生库存/MD/A同步只校准机械层，不改semantic-claims/旧RED/预算或600题。最新证据卫生复验另有回执，不回填首次失败为通过。

最终证据工作稿复验七门全部exit0，前后ffe HEAD与13 staged工作稿fingerprint相同。原terminal 7991B/SHA ec2a1ea047a65c536b7fd4f20902173cf16d0cdc14c064ed6c9dab1614914360；逐argv/log文件名/bytes/SHA完整投影见gates.json host_final_crossreview.final_working_evidence_gates。本结果索引随后才追加，不把工作稿门冒为新固定提交完整产品验收；固定提交隐私与卫生另核。
