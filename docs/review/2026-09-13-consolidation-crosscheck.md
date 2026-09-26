> 2026-09-25 入库注:历史记录,当前处置见 e2e/evidence/sc-reland-01.md。

# 2026-09-13 本地整合与近30天双向对账

[warn] 进行中。清点、机械映射和局部复现不等于全量语义验收；本报告尚无最终独立结论。

## 范围与验收

owner 授权整合全部本地分支、worktree 与 clone，逐项核对近30天文档与提交，修复可判定问题，最终由两名 fresh subagent 交叉评审，门禁通过后提交到 GitHub 并清理冗余副本。真人场次、常驻部署、版本发布与真实邮件投递不由源码整合推定为已验。

冻结时间窗为 2026-08-14 12:58:41 至 2026-09-13 12:58:41（UTC+08:00）。起点 main 为 `49ed96f64c887ede50c815e6eeb82576f898d69c`。从全部 refs 得到396条提交记录，其中公开快照37、stash2、merge14；另外从旧 clone reflog 找回8个 PG-01B 历史提交变体。396条涉及1185个 Markdown/文本路径，1039个现存、146个已删除或迁移。分母包含历史材料，不把历史提案自动变成当前施工合同。

## 整合事实

- 起点主仓4条非 main 本地分支均无 main 之外的提交；已经通过 `git branch -d` 删除，未使用强制删分支。
- 清点到47个相关 Git 仓库目录。44个历史副本经内容核对后清理，当前施工与待核候选暂留。
- 历史未提交内容与独有过程日志去重为一份本地恢复包，1601个内容摘要逐项校验；8个 reflog 提交另存 Git pack 并实测导入。包不进公开树，最终清理前再核对剩余独有内容。
- PG-02 候选以三方补丁进入独立整合工作区；唯一初始冲突是 owner 决策单的追加记录，双方原文均保留，未覆盖后来的 GAP-02/EMAIL-A 授权。
- 语音候选仍沿用前次任务、旧 RED 与累计预算。owner 于本次明确追加3次修复、每候选2名 fresh subagent、最多3轮；未重置历史。

## 已确认问题与对齐方向

| ID | 事实或复现 | 判断与处置 | 当前状态 |
|---|---|---|---|
| SC-01 | 私有归档 run 34307184467、公开快照 run 34307238648 为 failure；公开日志报告 `history/PROCESS-JOURNAL.md` 与审计快照不一致 | 更新生成证据并验证 `week-audit --check-bundle`；不以本地源码测试绿覆盖远端失败 | 待最终生成与重验 |
| SC-02 | PG-02 最近独立报告存在 `EVIDENCE-BINDING-VARIANT` 与 `ACTION-SCOPE-GLOBAL-FALLBACK` 两项 P1 | 对齐合同：证据必须绑定具体动作与可解析调用域，不能借其他变体或同名 handler 过门 | 追加修复后两个新赋值反例仍错误通过，待owner追加额度 |
| SC-03 | PG-02 旧 ledger 在当前 main 上产生大量 excerpt drift 与未登记写点 | 对齐当前有效实现更新坐标和动作分母；不得扩大例外或禁用探测器压绿 | 91条已刷新，语义绑定仍有阻断 |
| SC-04 | `remoteSurface.ts` 返回 `remote_business_forbidden`，Console `apiErrorFromResponse` 将其落入通用403认证失效分支 | 对齐现役远程关闭合同：显示业务面关闭及本机替代入口，不让用户反复换 token | 已实施，待独立复核 |
| SC-05 | `sendEmailSmtp` 在 `await dialer.connect` 之后才建立超时；注入永不 resolve 的 connect、timeoutMs=10，101ms后仍 pending | 对齐20秒有界投递约定：连接与TLS握手同样受总截止时间约束，迟到 socket 需回收 | 已实施，待独立复核 |
| SC-06 | 前次语音 review-10 的9项产品P1及完整CI失败仍未关闭 | 按原合同修复轮次/owner/epoch/草稿版本与消息来源门，补生产边界反例 | repair-13/14已实施，待最终双评审 |

## 追加源码反例

- SC-07：真实子进程在父进程关闭 stderr 读端后调用默认 logger，`uncaughtExceptionMonitor` 捕获 `EPIPE`，进程 exit 1。`logger.ts` 的同步 try/catch 没有隔离异步 stream error，不能兑现日志失败不影响业务的约定。
- SC-08：20个合法 PTT 样本加1个 NaN 样本时，`decompose` 返回 `invalid=1,status=pass`，与现役“非法时间戳 undeterminable”不一致；容量为1时同一被拒轮的start与stage使overflow累计2，释放槽位后又进入pending，拒绝轮计数不准确。
- SC-09：现役远程业务全部403，但本机配对信息仍传真实LAN开关；打开LAN后前端能生成不可用的业务二维码，`t2-pair`仍打印含token的业务URL。对齐远程关闭合同，保留本机移动布局能力。
- SC-10：`FocusBudgetView` 支持USD，`focusBudgetCopy`仍固定输出人民币符号；应按currency呈现，unknown继续保持未知。

- SC-11：真实临时 Git 仓库中 `git commit -S --no-verify -m x` 跳过 pre-commit 并进入签名程序；分类器却返回 `write_worktree`。`-S` 的可选参数语义被误作必选取值，需补参数语法反例并按原合同提升到 S2。
- SC-12：真实临时 SQLite 中，M0 确认在 `memory.m0_confirmed` 审计注入失败后抛错，但账本已有1条 add；上层仍说“这条先没记”，与实际持久化结果不符。需区分未保存和结果待核实，不能承诺未调度的自动重试。

- SC-13：03/08 的 Hopper 现役所有权与设计 ADR-005 冲突；03 的 Pipecat/Silero 和“对话恒API”速览未吸收07实施状态，04仍称 ContextCompiler 合同缺失。已对齐现役 Tier1、自写 Python WS 管线、CLI文本单发边界及既有编译器；历史框图明确标为设计档案，不增改合同形状。

- SC-14：doctor 在 `voiceReady=false`、原因未知时仍给出 `all_ok`、exitCode=0；临时 HTTP 服务调用生产 collectDoctor 已复现，需保留未知/降级状态。
- SC-15：CLI 在 daemon 退出后重新读取该 PID 的存活 birth，导致 HOME 归属检查恒 false、紧急 reaper 不执行。真实临时 daemon+agent 复现退出前可清理、退出后跳过、agent 仍存活；需提前捕获身份，并保留 foreign HOME 与 PID 复用校验。

- SC-16：归档接口的 `focus.archived` 审计仍写理由原文，而同族 abandon 已改为摘要。真实 SQLite 调用确认原文入审计、refDigest为空；对齐E3，仅保留摘要关联。

- SC-17：完整现役 install.sh 在隔离 PATH 模拟下载/安装时，合法 HOME 目录名 `home-$(touch injected)` 导致生成启动器执行非预期命令，安装仍 exit0；shell 配置行同样未转义。临时目录已清理，无网络或真实 HOME 写入。旧安装任务额度已耗尽；owner本次追加1次已实施，原命令注入探针不再执行，待最终双评审。

- SC-18：中英文官网与使用文档仍把 LAN 手机业务列为可用，并给出已关闭入口的二维码配置步骤；首页将预设脚本演示称为真实对话。按现役远程关闭与逐步确认合同修正文案，区分当前源码与不可变 rc.12 历史包；仓内 HTML 修改不代表官网已部署。

- SC-19：provider 按 baseUrl 子串识别 DeepSeek/OpenRouter，路径或相似域名也能误触发官方专用 max_tokens/reasoning 参数。请求 body 注入探针复现，已对齐解析后的准确 origin 边界，26项定向测试与daemon typecheck通过，独立复核待执行。

- SC-20：合入语音候选新增3种WS消息后，remote-surface-inventory未同步，现役检查器exit1。已按真实hub分派补齐voice.anchor_prepare、voice.quiesced、voice.quiesced_transcript_ack，保留远程业务拒绝分类；检查器及8项自测exit0。

- SC-21：四份现役 truth-plane JSON 逐一通过生产 Zod schema 解析时，action-ledger 出现8处合同错误：7个裸状态值不属于 TaskCard 状态，顶层 known_limits 未在严格 schema 中登记。其他三份通过。应修正 ledger 为既有命名空间状态形状并保留说明内容，不放宽 schema 压绿。

- SC-22：回叫组合根仍向ntfy与邮件提供优先tailnet的任务深链，而PG-01B已拒绝远程任务API。生产函数探针确认配置tailnet时仍生成远程URL、对应业务守卫allow=false。应对齐本机受信入口并明确回到运行SayDo的电脑处理，不重开远程面。

- SC-23：中英文隐私页将卸载应用写成删除手机端全部配对数据的保证，但iOS实现使用独立Keychain项、应用内删除才调用SecItemDelete。[Apple DTS说明](https://developer.apple.com/forums/thread/36442)并未给出卸载自动清除的合同保证；[官方删除文档](https://developer.apple.com/documentation/security/updating-and-deleting-keychain-items)要求显式删除项。已收窄为应用内删除配对、卸载不保证清除系统安全存储与备份；同时为隐私页和条款补齐当前远程关闭边界。六张本机Chrome截图已逐张查看，无横向溢出；仅源码文案，未部署或宣称设备清除实测。

- SC-24：80个汉字主题经生产buildEmailData生成单个332字符encoded-word，Subject物理行341bytes。[RFC2047 §2](https://www.rfc-editor.org/rfc/rfc2047.html#section-2)要求encoded-word至多75字符、包含它的物理行至多76字符；应按完整UTF-8字符拆分折行并验证往返，长线程References亦需保持合法物理行。未进行真实邮件投递。

- SC-25：capability-ledger 将 DF-AI-DRAFT-FULL 错写成“全文起草类 AI 写作主路径”；工程关闭计划与PG-02实际指AI供给合同草案全量下沉。应修正登记描述并保留deferred，不借修文案开启45k行草案实施。

- SC-26：真实页面会话探针复现看板旧定向重试覆盖更新的全页视图（initial→new-full→old-retry）；Review卸载时任务详情请求没有AbortSignal，另两条请求已中止。对齐VIEW-01晚到丢弃与卸载中止约定；Focus翻页的同ID换代与错误晚到保护亦需在组件接线中核验。

- SC-27：隔离HOME和launchctl桩运行真实launchd CLI，start在kickstart失败后仍exit0；uninstall在daemon bootout失败后仍删除plist并exit0，与pipeline失败分支不一致。应保留可恢复配置并传播非零退出；未操作真实常驻服务。

- SC-28：真实setup secret写入口接受含换行的SMTP_PASSWORD，随后.env.pending解析出额外非白名单键。临时目录探针已复现，应在写入前拒绝不可安全承载的值；无真实凭据或配置被修改。

- SC-29：Windows ACL 回读只验证Owner字段、任意allow ACE和宽组黑名单，未验证每个ACE的受托SID。直接执行生产回读代码片段时，Owner正确而DACL仅授另一个普通用户、以及同时授Owner和另一个普通用户两例均被接受。[Microsoft SDDL格式](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-descriptor-string-format)与[ACE定义](https://learn.microsoft.com/en-us/windows/win32/secauthz/ace-strings)明确Owner与ACE trustee独立；不能将这些条件声称等价于owner-only。需按现有仅授当前SID合同修回读，不回退最初的全SDDL字符串包含判断。本次为真实源码片段执行，未进行Windows native ACL实测。

- SC-30：W5.4遗留L-8仍未修复。真实Claude backend对assistant工具参数中的嵌套`type=result`判为终态，而同一行parser给出tool_started；executor随即按终态启动退出计时器。已复现，应仅按完整JSON顶层类型判定，补backend与退出策略的实际接线回归；不将普通含转义文字的情况误称已复现。

- SC-31：PG-02六项checker/self-test已接入justfile和GitHub workflow，却未接入仍被使用的pnpm ci:node入口。已补齐同组六条命令，并逐入口核验各命令恰好出现一次；shell语法检查通过。实际完整执行仍待冻结候选门禁，不把命令存在当测试通过。

## 修复复核进度

authorized-repair终态exit0（2393.649秒），实施模型与CLI成功事件已核对。原赋值/声明式解构两例已转红，完整安装器注入探针unexpected_command_executed=false；但新增解构赋值与属性替换两例仍错误通过完整91条ledger。SC-02仍RED，已向owner申请最多再1次同根因修复。

repair14 实施了 SC-04/05/07/08/09/10 等已知缺口；audit-repair1 实施 SC-11/12/14/15/16 与 PG-02 绑定修复。主控随后复现 PG-02 在 receiver 赋值/解构遮蔽时仍错误通过，已达到旧同根因2次上限；owner本次追加的1次已实施，新增两个绑定变体仍RED。不得将现役55项自测通过称为该语义缺口关闭。

全仓 `pnpm typecheck` 本次exit0，覆盖contracts/platform/console/cli/daemon；此时仍有检查器施工，不构成冻结候选完整门禁。

SC-12 首次修复仍有重复确认“未保存”误报及外层写锁 SQLITE_BUSY。audit-repair2 已移除第二连接并明确事务外持久化边界；主控重跑18项memory-m0-confirm测试exit0，真实SQLite触发器反例证明重复确认审计失败返回unknown且保留原记录，外层事务拒写在回滚后持久化拒写审计。此前86项定向测试及daemon typecheck为实施者证据，独立复核仍待执行。SC-12不在repair14实施清单内，audit-repair1/2分别是第1/2次。

page-session-repair终态exit0，368.348秒；模型与成功事件已核对。主控分页探针现为50→null→null；跨段转写按sessionRef独立取消，翻页失败保留现有视图并显示局部重试。26项定向测试为实施者证据，浏览器交互与独立验收待执行。Records转写卸载晚到尚无显式取消，不提升为已验证闭环。

SC-21/22/24/25第一轮已实施；四份真实Zod解析通过。SC-21完整91条ledger在伪写outbox:resolved→acked后仍错误通过，第二次有限回修与SC-27/28已由同一受管调用返回。主控重跑launchd隔离进程探针：start/uninstall皆exit1、plist保留；outbox伪迁移现为wrong_durable_transition。74项daemon与68项action检查器测试是实施者定向证据，完整门禁待执行。SC-02的追加请求仍待owner回复。

SC-29/30受管修复exit0、1051.278秒，CLI模型与success终态已核验。SC-30改为生产parser同源判定，主控原probe现为terminal=false、tool_started；作者20项backend与1项假子进程生命周期定向测试通过。SC-29改用原生DACL/ACE逐项回读，作者81项platform测试通过、14跳过；本机未跑Windows原生API，koffi传参、系统ACE mask/flags回读仍待Windows验收，不标native GREEN。

SC-29接口复核：Koffi官方[output buffers文档](https://koffi.dev/output)允许同步native调用接收Buffer/typed array指向其内容，因此本次Buffer传参形态有文档依据；[Microsoft GetAce原型](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-getace)与绑定的双指针输出一致。文档核对不能替代Windows native执行，系统权限掩码展开与实际readback仍未验。

## SC-32 确认卡未知 kind 回落未隔离原型属性

提交`dc3b18c3b5c2`要求所有表外kind回落“确认”。当前`ConfirmCard.tsx`直接索引普通对象，`__proto__`得到object、`constructor`与`toString`得到function，违反返回string与表外回落合同。主控`probe-confirm-kind.mjs`转译并运行实际源码片段验证了三例；尚非浏览器验收。生产Chat的另一公共copy函数已用contracts成员检查，未见同一缺口。首次定向修复已返回：Object.hasOwn隔离表外键，主控原探针的三个原型名均返回字符串“确认”；作者真实组件静态HTML回归6项通过。未改变已登记kind文案或授权语义，浏览器与最终独立验收仍待执行。

SC-14追加反例：`probe-doctor-inconsistent.mts`在真实临时HTTP响应中令voiceReady=true但asr/tts=unknown，生产collectDoctor仍输出all_ok、exit0。第一次修复只覆盖voiceReady=false+原因未知；第二次有限回修已返回；主控原临时HTTP探针现为voice_unknown、exitCode=1，不再all_ok。作者19项doctor测试与6项darwin launchd进程fixture通过；Windows平台边界已显式skip，但未在Windows执行。

## SC-33 发布校验失败回显原始stdout

358c451引入的原文头尾诊断曾由dd8a12a撤回，但c0df247的Windows引号修复又带回该变化。现役parseVerifierOutput在非JSON时把stdout前后200字符嵌入Error，沿调用链直接抛出。主控用实际函数片段和合成非秘密标记复现rawMarkerLeaked=true；不是真实凭据泄漏事件，也未运行发布动作。按既有发布错误脱敏边界，应保留固定错误码/字节数/摘要，移除原始片段；首次有限修复待执行。

## 其他核对

- PG-01B最后一份旧clone在复核104个独有文件(63个未提交文件、41个过程文件)、全refs提交对象及零cwd占用后已删除；其余13,424个ignored文件均位于依赖或构建缓存路径。


- 清理后的Git连通性检查发现 `origin/HEAD` 指向早已不存在的旧合并分支。已按远端默认分支重新设置为main，主仓及三个保留候选的连通性检查均exit0。dangling历史对象不是损坏，不做prune。
- 文本文档之外补登记29个网页/SVG/PDF，另有2个版权材料HTML源。源码PDF的61页由前30页、1页分隔页、后30页组成，非额外溢出页。操作说明书为2026年8月V1.0历史稿，其中手机业务说明不能作为PG-01B关闭远程面之后的当前能力证明。已抽看封面、分隔页和相关手机说明页，未宣称全页视觉验收。

- stash 共6个文件：4个文档改动已被 main 吸收或由新状态索引、journal 重编号替代；AGENTS 的 V3 迁移差量已三方合入整合候选，project-profile 已吸收V3差量并保留6项PG-02门禁。文件迁移不更改本任务冻结角色、旧预算和独立评审要求。
- AS-01/02、GAP-02、残项证据已加时点补注；三端壳 README 与版本矩阵已标明 PG-01B 后远程业务关闭，保留历史测试和制品坐标。
- 对109条摘要引用逐项核对并人工纠正14条路径绑定：42条与当前字节一致，29条找回历史 Git 字节，1条找回保留候选字节，2条描述整个受保护目录而非单文件；另有29条历史文档摘要及6条日志摘要尚不能找回原始字节。未找回不等于伪造，也不能标为已验证；不以当前摘要覆盖历史声明。

- 37个公开快照逐个按发布排除集比对内部引用提交，全部公开文件树一致；早期5个短SHA已解析为真实完整commit。14个merge中3个树与某父提交一致，其余进一步检查combined diff，当前识别到的合并新增生产接线集中于W5.4与Windows适配汇合。

- 146个已删除/迁移路径全部找回历史Git正文：137个在当前其他路径逐字节相同；7个RC说明符合release/README的随bump改名规则；另2个语料报告仅更新权威输入摘要，按2a786ed的48个Git输入重新计算与声明完全一致。没有将历史报告改写为当前产品验收。

- 在文本清单之外补登记232个文档目录路径：107个JSON、50个MJS、41张PNG、14个HTML、10份TS草案、3个TSV、2个MTS、2个SH、1个Python、1个YAML、1个SVG。此表与先前可渲染资产表有重叠，不相加冒充独有总数。107份JSON的当前或历史正文均可解析，语义对账另记。
- AI供给合同草案保留未收敛状态：10份文件当前合计45,734行，README的45,696行指原内嵌代码块正文，新增来源标头等使物理行数不同。现役生产/脚本/工作流中未检索到该目录或关键类型引用；这不是完整模块加载图证明。不将旧20轮RED草案整包导入生产。

文本、文档目录附件、可渲染资产与版权HTML去重后共1435个文档路径，清单保存在仓外combined-document-universe.json；路径登记不等于内容已逐项验收。另对本地全部可用Git对象中7186个不超过10MB的blob计算SHA-256，共309770373字节，未找回剩余33个独有历史摘要对应字节；不据此改写原始摘要。随后对唯一保全包内1601个按SHA-256命名的blob核对，剩余33个摘要仍无命中。

设计ADR-004的workspace表仍写POSIX硬锚(dev,ino)，与09 §1及生产实现的(realpath,ino)平台规则不一致，已按09修正；同文已批准FAQ翻转与末尾“本批不动”冲突亦已收敛。历史Windows门禁数字保留为对应批次事实，不代表当前候选实测。

## 证据边界

初始机械扫描读取1039份现存文档中的1343个十六进制候选，819个可解析为 commit；未解析项包含内容摘要等，不能一律判作错 SHA。44条提交未被正文直接写 SHA，其中大量为快照与证据生成提交，也不能据此判缺文档。

已有2026-08-22语义账本明确区分机械关联与人工裁决，本次不将它整体继承为逐项正确性证明。全量语义对账与两名最终 reviewer 尚未结束。

## 当前未完成

PG-02与语音候选修复、全量双向语义对账、最终两路交叉评审、稳定候选完整门禁、提交推送及最后副本清理。

09 §3.3签名计数器注释改为按实际值判断，不再断言Apple平台认证器恒为0。生产signCountVerdict已区分双方0/递增/回退，与[W3C WebAuthn §6.1.1](https://www.w3.org/TR/webauthn-3/#sctn-sign-counter)相容；本次只纠正文档泛化，保留原有回退拒绝策略，未改变WebAuthn认证路径。

九条release bump已逐文件做版本替换差量核对：rc.6至rc.12各18个文件仅版本号变化，额外资产manifest按当时构建算法逐个重算全部670个Git输入；rc.5至rc.12八条sourceRevision全部相等。早期e37只改名/删旧manifest、正文仍rc.4，是后续提交修正的中间态，不能当成独立可发布候选。该核对未重建历史tgz，也未将旧制品当作本次源码交付。

SC-33首次修复终态exit0，模型与success已核验。主控完整差量核验发现生产函数为无依赖源码切片增加回落/重复解析，已要求第二次有限回修删掉测试专用分支。作者物理证据/provenance夹具自测通过不等于实体门；本轮mjs被eslint忽略，不能记录为有效lint。

SC-30横向补查：Cursor backend仍以全文正则认终态。主控真实导入cursorBackend，tool_call嵌套type=result与assistant.metadata.type=result皆terminal=true，而生产parser分别tool_started/ignore；AgentSpawner随后kill_on_result走立即结束分支。已准备同根因第二次有限回修，待当前发布解析调用结束后执行。此处未启动第二个并行实施调用。

SC-33第二次回修exit0、240.8秒；完整差量与模型/success已核验。生产只保留正常导入的单一解析；主控实际导入原合成marker再验为拒绝且rawMarkerLeaked=false，长度与摘要保留，正常JSON不变。作者物理证据/provenance自测为局部证据，未跑实体发布。Cursor SC-30第二次同根因回修已接续启动。

## SC-34 回叫等待期间取消后仍继续其他渠道

主控临时SQLite调用真实CallbackEngine/runCallbackSweep：desktop.notify等待期间freezeForTask把条目置resolved，恢复后仍调用ntfy.post一次，再以旧pending快照attemptNotify，抛illegal outbox transition resolved -> notified。现有09 §6.3要求取消/返工冻结后不再外呼；应在异步等待之后、新渠道开始之前复核durable状态，不重写已ack/已冻结条目。已经开始的通知不伪称可撤回。准备首次有限修复，无真实通知发送。

SC-30 Cursor第二次同根因回修exit0、227.758秒，模型/success及全部差量核验。顶层错误result仍终止为非零；嵌套result不再误杀。作者Cursor6、Claude20、executor定向4通过/153跳过，为假子进程定向证据；未跑真实Cursor CLI产品验收。SC-34首次受管实施已接续启动。

SC-13继续对账：EMAIL-A 的排产与关批证据已记录2026-09-09授权合入，但04/07/09/C4和env模板仍称未合入“候选”。已改为已入源码，并保留真实SMTP、收件端线程展示、生产库迁移未验边界；历史收口报告不改写为本次验收。

## SC-35 未确认音频拒绝消息的schema可绕过专用分支

09 §10.1要求voice_audio_unknown必带非空、唯一升序unknownEpochs且retryable=true。主控实际导入生产voiceAnchorStatusSchema与pipelineMsgSchema，missing、wrong_retry、unsorted、duplicate四例都被接受；empty被拒，合法升序正例被接受。原因是通用rejected分支仍接受该专有码，且专用数组只验正整数/非空。此处是合同校验反例，未证明真实daemon发出了畸形消息。已有生产unknownEpochs生成器与所有实际拒绝调用还需完整复核；拟纳入尚未使用的语音repair15，不新增或清零旧预算。探针probe-voice-status-shape.mts位于本任务仓外证据目录。

## SC-36 侧栏读取失败被呈现为零项

实际生产函数片段探针将 attention/outbox/focuses/spaces 四个读取全部置为失败，原本各有一项的数据均被覆盖为 []。失败分支返回空数组使外层 catch 无法保留旧数据，橙色待处理和未读徽章随之消失，违反11 §0的诚实呈现。应区分成功空响应与读取失败，保留最近成功数据并显示读取不可用；这与SC-26翻页及迟到响应属于不同根因，不借此追加旧轮次。当前只复现状态更新，未进行浏览器验收，修复尚未启动。

SC-34首次修复已核验模型、终态和完整差量，原冻结后继续外呼反例消失；新发现成功L0发送遇冻结时遗漏发送审计，以及新测试临时DB未释放，已进入同根因第二次回修。四文件定向结果56通过/1失败，失败为SC-22本机处理提示后的旧精确断言；不作为完整门禁通过。

## SC-37 捕获登记schema拒绝所有合法状态

实际导入captureRegistryEntrySchema验证三种合法consumed/discarded组合全部被拒：strict对象相交时互斥对方字段。应保留完整对象严格校验与三种合法组合，拒绝未消费却已放弃等非法状态。packages内未检索到该schema运行时消费者，不能宣称现役音频被它拒绝。与SC-35一并计入原语音repair15/15，SC-36作为新根因首次修复同行实施。

SC-34第二次回修exit0、486.547秒，日志1528461字节、SHA-256为21594bbe293383d8dc2089581b048d811beb4d51ecad917e019687ba4ce94ff3。模型/success、完整四文件差量与定向日志已核验。主控原两个探针独立重跑均exit0：冻结后新外呼0、状态resolved、语音发送审计保留。作者五文件64测试通过，typecheck/生产源lint/emoji通过；不是完整门禁或真实通知验收。

SC-13补查根目录《测试机部署清单》：仍引导开启LAN、输出带token的二维码，声称任一已登录CLI即可零key与订阅内零成本，还保留按端口/进程名批量关停和删除整个数据目录的重置步骤。已按PG-01B及现役CLI参数改为本机源码部署说明、实际自检与费用边界、前台实例定点停止；不执行这些部署操作。中文路径清单中的51处Git C转义已解码，并在对应commit/父commit逐个验证对象存在。

31条仅重生成week-audit两文件的提交逐个读取历史Git树，核对51,166条manifest记录的字节、摘要、文件模式及公开路径集合，并核对integrity文件摘要和dirty snapshot。26条全部匹配；2条只有三份文档的本机0600权限与Git检出0644差异，正文一致；3条存在中间态字节漂移(发布脚本、截图、win32.ts)，声明的字节均在其他历史提交找回。该检查不重认历史人工评审或外部发布。当前整合树已追踪文件权限全部与标准Git检出模式相同；最终仍须重新生成当前bundle并跑完整门禁。

SC-35/37原累计repair15/15已退出0(454.43秒),日志1781045字节、SHA-256 d549aecdb7deeba1e10633679e0ebecf9e794eb37f1fda3939326a4a0cf7e07d。主控核对完整六文件差量与定向日志,原始schema反例均消失,正例保留。SC-36首次修复的真实Layout/合成API浏览器序列通过,已查看首次失败、保留旧数据和成功空三张截图。完整门禁与独立评审仍未执行。复核发现SC-36的空态改用未筛选focuses长度,仅有归档焦点时不再显示“暂无”;测试用loadSidebarPair未被Layout调用,须有限回修并测试实际消费函数。

## SC-38 Git多个推送目标和复合命令丢失风险

实际commandToEffect→decideCommand探针中,`git push origin feature/x main`、第二ref为`+main`或`:old`、`git push origin feature/x && git push origin main`、`git push --repo=origin main`、`git push origin --all`以及第二ref为配置保护分支release,均按S2调用一次确认后allow。单独推main正确S3拒绝,单独feature/x正确S2。分类器只取首ref;组合只按kind排序且同kind保留首项,丢失后续目标。此为04/09既有S3不放行合同的实现缺口,与SC-11签名选项吞no-verify根因不同。探针未执行任何真实Git推送。

## SC-39 Git本地执行配置写入被当成普通文件修改

`git config core.hooksPath /dev/null`经实际分类与审批函数自动S1 allow,未调用确认;同文件isGitExecConfig已对git -c形式识别core.hooksPath等执行配置,但持久config写入未复用。须核对查询与普通本地配置正例,按现有执行配置合同修复,不修改用户Git配置。

## SC-40 小样切换版本后迟到响应覆盖当前预览

2260033 的历史修复会在demoRef变化时清空HTML,但没有使旧请求失效。主控加载实际PackageDemoPreview源码,经TypeScript转译并以合成React hooks执行：版本1点击读取、切到版本2、版本1请求再成功,最终版本2组件仍收到OLD_VERSION_1。属于11诚实呈现与既有B5修复未覆盖的异步身份问题;未做浏览器验收,待首次有限修复。与SC-26列表分页不是同一组件或状态持有者。

S1/S2九条历史实现、证据及评审提交完成逐项有限对照,两证据文件完整SHA均验证Git对象存在；历史门禁数字不作为当前实测。其中S1原始证据“净增+11”与自身列举3+5+3+3=14不符,在本次对账更正为14,不重写当时的测试输出。冻结396条现159条已记录不同程度核验,237条仍pending;非159条全部通过。

SC-13补查工程ADR-003与9f0e735：全局禁止setup真实ACL的旧措辞会重新引入Windows隔离根owner未修正、整套测试无法加载的问题。现按真实setup的隔离根范围改文档,继续禁止触碰宿主TEMP根/用户既有目录；明确Windows distribution不等于Windows全量单测,不再沿用billing/pnpm历史原因。此为对齐后来实施,未修改平台安全代码。

回叫旧夹具缺单文件清理的疑点已复核公共setup：closeTrackedDatabases及重定向TMPDIR的afterAll/exit/SIGTERM清理覆盖该类资源,因此不登记为已证实泄漏、不追加无必要修复。又9条public-readiness/平台测试历史提交完成有限核对,396条中168条非pending,均保留原生Windows/Linux/历史门禁未复验边界。

SC-13完整阅读官网Docs稿955行和首页稿205行,发现它们仍被索引标为现行事实稿,但LAN扫码、计费免费、同轮自动展示小样和批量关停指引与当前实现冲突。现已同步本机业务入口关闭远程、CLI计费provenance/自检、提示与实际预览分离、隔离新数据根、回叫30秒窗加15秒sweep边界和SMTP源码接线;保留历史结构及评审记录,不部署网站。当前候选/历史rc.12制品/已部署站点验收边界已写明。文档内容全读不等于全量运行合同验收。

## 现行站点文案与历史门禁对账续记

两份2026-08-20现行事实稿正文已按当前关闭远程业务、CLI provenance、自检与计费、小样点击预览及回叫规则修正；Windows历史验收不代表当前候选,审批运输区分POSIX Unix socket与Windows环回+HMAC。pipeline/vad.py仍明确能量RMS实现,未把Silero计划误称已实现。历史C/D段保留原有日期。

主控复跑mobile release contract为225通过/2失败：断言仍强制“移动浏览器 LAN dogfood”,与当前合同相反；full-entry-redact为该错误连带。日志mobile-contract-root-recheck.log为12341字节,SHA-256 `aa4e9daa8b13ae2c887c48e97c63934d7eb3f69fa1be6101c595df492a66a188`,命令真实退出码1。下一项SC40修复将同步这条文案门禁,不恢复误导正文换绿。

冻结396项索引当前179项已有逐项核对记录(含有限范围/历史证据/已确认缺陷,不等于179项PASS)；其余217项仍待逐项审阅。新增核验涵盖站点原始更新、L1时间戳夹具修复、mobile动态版本修复、历史mode整改、GAP/EMAIL证据与stash两个对象。原始候选证据、当前源码、远端/真实平台证据继续分别记录。

对Goose两种transport的疑点未直接判错：当前[官方CLI指南](https://github.com/aaif-goose/goose/blob/main/documentation/docs/guides/goose-cli-commands.md)确实分别将`goose acp`标为stdio、`goose serve`标为ACP HTTP/WebSocket。保留方案的分kind思路；该证据不证明历史六家所有版本、实际握手与执行TCK均通过,也不授权实施整套AI供给草案。

SC38/39首次回修的原十条gate探针已过,但新增反例仍RED：隐式push未证明目标却按S2,与显式push组合时未知目标被抹掉；-vf强推未被识别；rename-section只检查源节,harmless→core可生成core.hooksPath。临时真实Git证实-vf/--force-with-l dry-run以及rename-section有效。--for和--name-only写入实际exit129,不认定为可执行漏洞。第二次同根因回修已启动,并保留第一次测试通过的证据范围。SC36第二次截图“暂无”与失败保留旧焦点/徽章已由主控目视核验。

## SC-41 POSIX工作区身份的保证表述过强

对照d406387及其两份证据回写,现役09和源码注释都称“目录被真正替换必然换inode”。POSIX标准只保证dev+ino组合、Linux说明也明确不同filesystem可有相同inode；旧APFS重挂载取证不能外推为跨卷替换不可发生。09已澄清现役兼容策略的真实边界,不回退已采纳的POSIX重挂载行为、不伪造现场攻击或迁移验收。源码注释已同步同一边界说明,只改注释,无可执行语句变化。

## SC-42 测试清理等待窗的计算说明不实

261c32的历史回写及现行global-tmp-cleanup注释将maxRetries30/retryDelay100误算为3秒。[Node官方fs.rmSync说明](https://nodejs.org/api/fs.html#fsrmsyncpath-options)定义线性退避,累计等待为100×(1+…+30)=46500ms,还不含文件系统操作。现行注释已更正：15秒是迟到worker容忍窗,不是最长清理保证。保留既有超窗报错与先记录泄漏再清扫行为；未复现原生Windows超窗误报,不据此宣称功能缺陷已修复或任意放宽门禁。

SC-05原生传输补查发现首次修复只约束返回值：主控使用127.0.0.1临时TCP服务器接受连接但不响应TLS,真实nodeSmtpDialer经sendEmailSmtp(timeoutMs50)返回false,152ms时服务器端仍有1个未关闭连接。当前connect Promise仅在TLS握手成功后交出socket,总期限到期时调用方尚未持有它,无法销毁。探针最终主动关闭自身全部连接和临时服务器；没有SMTP命令、凭据或邮件投递。需第二次同根因修复把取消传入原生dial/upgrade阶段,而非仅等待迟到resolve；待当前SC40调用结束后串行实施。

SC-13补核Tailcat历史评估128行及5cf1cabb安装自测补丁：原文固定旧基线,但未醒目标明远程关闭后不可按配对说明使用。已加现势边界与表格计数更正(逐行A0/B8/C22,表外A1不是第31项能力)；保留不采纳Tailcat/不替换D13决策,未重新采纳第三方能力。安装文字mutation的局限仍由SC17实际隔离安装探针补足,不把旧21条字符串mutation认作真实Windows验收。

## SC-43 历史转写读取失败被呈现为空且无法重试

主控加载实际SessionSegmentCard经TypeScript转译/合成hooks执行onExpand返回null(Records/Focus读取catch的现役返回值)：卡片显示“这一段没有留下转写内容。”；收起再展开仍只调用过一次读取。组件把失败null缓存为[]，混淆失败与确认无内容。属于11会话段卡“未存转写不伪造”和诚实呈现合同缺口,首次有限修复须区分null/throw与真实空数组,提供重试并防重复在途；该探针不是浏览器验收。Records切focus/session时清空view会卸载段卡,此前仅因fetch未abort怀疑跨页串版未复现,不另记已证实漏洞。

SC-13补核rc.7历史复盘：原“容器绿则CI必绿、tag风险本地清零”超出实验证据，已加日期更正，限定为固定源码/工具/环境的载荷一致，仍须当次远端required gate；不抹去历史原句。另按历史算法重算rc.4的670个源码输入，与9477c70f清单sourceRevision一致，未重建或发布制品。

SC38/39第二次与SC40首次已复核：原Git gate反例S3/零确认、小样旧响应不串版；源码及全部新增测试差量已读，20项产物摘要核对，查看两张关键浏览器截图。mobile文案门231通过；作者保留的中英文HTML §1.4两处LAN可用句由主控同步关闭并单独DOM/截图核验。完整CI及fresh双评审仍待执行。SC05第二次/SC43首次在途，不提前改判。

## SC-44 旧月度报告的标识统计不闭合

d1cd29c引入的09-02报告及journal R127写1071个hex、696已解析、198未解析；两类合计894，余177项无分类清单。现已在旧报告结论前加日期更正，保留原数字并撤回其全量排除效力，不虚构177项去向，也不把批次可追溯当作实施正确。此为文档算术与证据边界修正；原历史门禁并未重跑。

清理历史另核f5ca882全部170个删除文件，与同提交保留的customer-question-corpus路径逐字节相同，无该次删除导致的内容丢失；babd864全部13文件恰为290处本机前缀脱敏，其余字节不变。两项证明内容保存与脱敏正确，不代表语料的现实有效性或旧评审结论已重新验收。

## SC-45 小样提示送达被当作预览已展示

全读历史 `81e6b9a7d519` 后追到现役 `brain/liveTools.ts`、`brain/instructions.ts`、`propose-start-demo.test.ts` 与 `useVoiceChannel.ts` 的 screen_text 分支：文字“决策包小样已放到屏幕”成功送达即返回 demoPresented=true，并给原轮屏幕信用；消费者仅加入 spoken 文本，11 的 DemoFrame 实际由“看小样”点击打开。文字送达不能证明产物预览已展示。按现役点击流程对齐提示与证据，不扩自动展示协议；SC45 首次修正在途，未宣称通过。

SMTP 第二次修复终态 exit0，主控复放真实临时 TCP/TLS 挂握手探针：elapsed153ms、openAfterDeadline0；24 email 定向、6 console 定向通过，24 项日志/截图摘要核对、3 张关键图已查看。只证明本地隔离连接和合成转写行为，非真实邮件投递/真实会话。SC43 另发现生产代码为缺 hook 的旧模拟探针添加 no-op useEffect 回落，第二次仅去除此兼容分支并复核真实 React 行为。最终完整门禁与双评审未执行。

## SC-46 Windows wrapper 输出未排空却成功退出

历史 `4545769134f1` 给 `flushStdioThenExit` 增加十秒停滞截止，当前同路径仍在 pending bytes 非零时调用保留 code=0 的 finish。主控提取实际生成函数，以单调时钟和待发送流注入复现：退出码0、待发16384字节。此为函数级反例，未冒充原生Windows。截止避免永久挂住合理，但不能把丢失尾部输出算成功；应保留截止并明确失败/诊断，成功只在真正排空时成立。SC46首次修复已进入有界实施调用，原生平台验收仍待具备环境。

SC45首次/SC43第二次已取得实施者定向结果：proposeStart对文字成功仅返回demoHintDelivered，不再给原轮screen credit，demoPresented现役恒false；06/08/09/10/11与Brain同步点击查看证据边界。主控已读完整相关修改，核对20份日志/截图/JSON摘要并查看失败、重试及Records/Focus三张图。定向5+8+3测试、两包typecheck、生产lint、doclinks、emoji通过；真实React加模拟API验证，不是实际daemon/语音验收。最终完整门禁和独立双评审仍未执行。

SC44补核DSH插件历史评估：头部6路与分项3+4路不闭合，且两路失败；已加日期边界，不臆定成功数。抽查100/1211不能证明全生态不存在同类，父子ID不能单独证明上下文继承；在原文前限定证据要求。仓外插件不随本任务实施。IMPL-PROMPT-9的准备稿状态补链到已审e79d1d8及后续回修，避免重开已收口批。

SC46 首次回修复核：原探针未改，主控复跑为退出码124、待发16384字节；生成函数在停滞、空写报错和回调缺失时保留非零失败，正常排空保留原码。消费层非零即抛错，不返回截断输出。20项命令日志摘要核对一致；flush/syntax 15过1跳过、registry 98过1跳过，typecheck 首次测试类型错误已回修后通过。仅函数注入与定向本机证据，原生Windows、完整门禁及独立验收仍未完成。

历史决策影响分析补充：c620a39 的接口适配成本不能仅以文件行数或 adapter 枚举推出；已给原分析加限定，要求审批、恢复与 proof 的逐项合同核验。未签决策3的“同family必然同权重且等于自我确认”理由已更正为待签的互补性策略，未代签或更改产品准入。

690fc640 的ACP探测只到initialize，不能证明完整互操作、成本相同或生态迁移触发条件；四处引用已补同源限定。保留已签方向，不把历史协议声明升级为当前运行验收，也未重新执行旧CLI或认证探测。

### 历史报告与 W5.4 方案续查（R185）

RC4 初稿已在历史后续更正 daemon exit，但仍以“单独重跑全绿”推断不是生产缺陷；本次去掉该推断，保留并发根因未充分证明的边界。其 `rmSync(maxRetries:30,retryDelay:100)` 的重试等待累计为 46.5 s，不是 3 s，15 s 清理窗不能据此称为覆盖最坏等待（同 SC-42）。W5.4 v3.1 正文已改 `default`，摘要、测试快照清单与 D3 末尾却仍写 v2 `acceptEdits`；本次按 09 和当前 argv 对齐这些遗漏。历史版本与政策摘录仍不等于当前 vendor 行为或分发许可；W5.4-c live conformance 保留未验。

### 历史评审反证（R186）

82/84/85 三份 W5.4-a 报告重复把 path.join 的绝对第二段当成 path.resolve：本次实际 Node 探针分别返回 `/example/home/foo` 与 `/foo`。已给三份原报告加勘误，不再沿用这一误报作为家目录展开缺陷；symlink/dotdot 的其他独立发现与修复不受影响。PROC-01 与旧本地收敛的 I 父/tree/pathset 及决策摘要核对一致，原控制副本 pending-rebind/exit5 如实保留，历史门禁不替代当前候选验收。

### 8月16日走查证据边界更正

26d32e 全部29文件已核对，包括633行原脚本、52条步骤记录与20张截图。F1 的固定问句在当时 dialog.ts 选择 provider 前直接发送并 return，截图不能证明模型调用；C6 的独立自检不能补证该轮。C2/C5/D6/C6另有缺少断言，报告生成器硬编码历史 CI/Playwright 结果，失败不设置汇总非零退出。保留脚本与步骤原件，在四份说明及测试板加更正，撤回模型闭环推论。当前完整 Playwright 仍必须实际执行，不能以历史 live 页面可见豁免。

### RC4 返工证据的冻结缺口

033bdc8 的20份改动已逐项核对。其1369条 publication 清单有4个发布脚本摘要滞后，workingTreeSnapshot 同4项不符，并漏掉同次入库16份 prompts；integrity 的9项文件摘要本身一致。代码已经在8b123acc入库，旧证据§9仍写未提交，已补日期更正。033是后续410eb845的祖先，后者1600条冻结另行核对无不符；历史缺口不回填成通过。本次最终候选仍须重新生成和执行bundle门禁。

### SC-47 Windows pipeline 独立入口缺少状态根身份检查

148251/be82 的 platform.py 将 NTFS/固定卷/subst/SID 校验委托给 daemon，但当前 pipeline 独立入口没有验证 daemon 已做检查：先从该根读取 token/供应商凭据并发起 ASR/TTS 探活，之后才连 Hub。09 状态根及工程 ADR-003 Python 对等语义要求不能由未发生的校验承载。本次按独立 Windows 根身份首次修复派发，范围不涉及已耗尽的旧语音屏障预算；原生 Windows 尚未实测。

### SC-48 自测提前退出绕过临时目录清理

148251/be82 的 Node 门禁自测替换 Bash EXIT trap 后，色值和 emoji 自测在 try 内 process.exit，finally 不执行。主控给三个真实脚本各设独立 TMPDIR：色值21/0、emoji11/0均exit0但各留下一个临时目录；迁移正常成功路径清理，失败及Windows提前退出仍共享同一结构缺陷。探针目录已仅按本次归属清掉，原始结果保存在gate-cleanup-probe.json。排入一次同根因修复，要求在返回退出码前完成清理，不能把异常退出误算成功。

### SC-49 dev 启动取消后仍创建新进程

主控执行当前dev.mjs源码并只注入child/health边界：health等待中触发SIGTERM，首个daemon child被kill，随后health成功仍新建pipeline与console，二者未kill；shuttingDown使后续shutdown直接返回，exit监听晚注册导致早退遗失。探针记录3个创建、1个被kill、completion未settle，无真实服务启动。应在取消后禁止启动后续子进程、及时登记终态并有界清理本次子进程，health请求也须可取消。排入独立首次开发脚本修复，不借此重开生产语音预算。

## SC-50 官网收起菜单仍可键盘聚焦

完整读取 0e33260c044809f415c3b981ec22a7d0c2d4bbae 的中英文首页、共享样式与菜单脚本后，主控用当前工作树真实 Chromium 在 390px 视口连续 Tab：aria-expanded=false、opacity=0 时 7 条隐藏导航链接仍获得焦点。site-hidden-nav-probe.json 保存原始观察；该路径需让收起状态退出键盘导航并保持展开、Escape 和桌面行为。首次定向修复已排队，不涉及生产语音或 PG02。官网历史四图标已逐图查看并验证与当前字节相同；这不等于官网部署验收。

SC-13补核官网中英文Docs实际HTML：§0与FAQ仍把历史Windows P0和rc.12安装smoke写成当前源码/全量CI验收，已限定到历史制品与各自证据层；不改变支持平台范围。

SC-50首次修复已由主控独立浏览器探针复现原场景：中英文390px各18次Tab均无隐藏导航焦点，Escape回按钮，1280px导航不再inert且visible。作者本机两语种全导航/断点探针通过，主控查看展开与桌面截图；尚未部署、未最终独立review。日志site-nav-repair.log为1132731字节，SHA-256 26ece9739bba5752a585e4809c6d1cf133a5632ecdd8e08b024c93e5be18a78d。

SC-49第二次回修由主控再次注入生产createDevController：忽略全部信号时73ms返回1且settled=false，意外SIGKILL仅创建daemon一个child并返回1。作者48条定向断言通过，主控完整读321行实现与387行测试并绑定4份日志；未起真实服务或运行Windows信号链。dev-shutdown-repair.log为705126字节，SHA-256 fe56a502a4146d92ca2348ce1210c53487ae8141b5f913e091cf6ccacad4d1b3。第二次同根因额度已用，非独立GREEN。

SC-13官网HTML补齐文稿已有改正：小样提示不等于自动展示；30秒应答窗在下次15秒sweep升级；SMTP已入源码但真实投递另验；停止仅针对所属实例，排障使用新的隔离数据根。与历史1679078页面逐项对照，不执行历史关停/重置命令。


### SC-51 Windows stdio 失败被当正常结束

主控抽取实际生产函数,仅注入 native 边界:ReadFile 回调返回 false 时 resolve(0),未知回调错误强制标 EOF;CloseHandle 失败被 closeHandleQuiet 吞掉。下游把 EOF/EPIPE 当正常终结,因此存在丢失失败证据和未释放资源却标 closed 的路径。探针及源码 SHA 记录于 native-pipe-errors-before.json,并非 Windows 真机。首次定向修复已派发,不借此重开 SC-47 或语音额度。Microsoft [ReadFile](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile) 与 [GetLastError](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror) 要求区分返回状态并在调用线程取得错误;不能在 Koffi async 的主线程回调读取别的线程错误。

SC-23/SC-13 材料投影补查:上架材料仍保证卸载清除所有凭据,披露矩阵把 08-13 表叫“今日事实”,商店草稿仍描述现役远程连接。先补矩阵的当前源码差异,再改材料删除/语音外发边界,给三店 JSON 和审核方案加禁止直接送审说明;冻结备案提交原文不改。iOS 原生识别确有显式联网 opt-in,不误改成静默联网。

### SC-52 Google Play 测试豁免缺少依据

release-profile.closed_testing_gate=false 仅由“账号已有千手、当时未见横幅”推导。[Google 官方规则](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)要求按账号创建日期及本应用生产访问状态核实。已将该字段改为 null,状态文档撤回无依据的豁免;未替 owner 选发布策略、未登录或上传商店。

### SC-51 首次回修的关闭反例

首次实现已将未知读写失败与正常 EOF 区分,11 份自检日志 bytes/SHA 一致,但没有满足有界关闭。主控抽取生产 stream 函数后注入不完成的 I/O:读写两侧 destroy 均不触发 close,源码没有取消/截止;空闲 destroy(error) 因空值合并短路,CloseHandle 调用数为 0 却触发 close。第一轮不是通过,第二次同根因修复在途。取消请求不等于 I/O 完成,不得在仍在途时释放 buffer/handle。依据 [Microsoft overlapped pipe I/O](https://learn.microsoft.com/en-us/windows/win32/ipc/synchronous-and-overlapped-input-and-output),异步管道需要对应句柄模式及有效 OVERLAPPED;Windows 真机尚未核验。

### SC-53 home-lock 测试未清理自有目录与失败路径子进程

现行 `packages/platform/test/home-lock.test.ts` 的 afterEach 只执行 void home 再清空数组,实际没有删除本轮 mkdtemp 目录;两份独立进程测试的前置断言失败路径也没有 finally 收口 holder/waiter。历史 848cf38642db 的进程测试标题当时只有单进程 CAS 断言,不能当跨进程证据;后续增加了真实子进程用例,但清理遗漏仍在。修复范围限测试自有临时目录/子进程/计时器,不得清理用户 home 或其它任务进程。待定向修复。

SC-13 深链落地页补核:3197fd8a 原始25路径(含8张图标)已逐项阅读/查看。link 站仍写“已安装设备上打开”,已改为当前手机/远程关闭、本机浏览器使用;390px真实Chrome文本与无横向溢出断言通过并查看截图,未部署。33c5cf1的旧S1展示锚、S2通知锚与七步状态已加历史边界,不把旧prompt当当前验收。

### SC51 第二次回修核验补充

第二次作者26条platform与2条consumer注入测试通过,15份报告日志逐一匹配;不等于Windows真机或独立验收。主控从生产函数直接抽取并注入三类native边界:WAIT_FAILED时未查询完成且未取消即释放event/pipe;GetOverlappedResult返回IO_INCOMPLETE仍释放;event CloseHandle失败被吞后报告stream.closed/owner.released。原始记录见仓外native-pipe-completion-after.json,源码SHA-256 ff1012f43fdd15853cea4c99dbae8606fe9425f9984ca6b8d114480402d7d9f7。SC51保持RED,追加一次同根因修复已询问owner,尚未授权第三次。

### SC-54 历史 CLI spike 判定缺少执行证据

完整读取ed8b0f的12路径并对现行脚本离线抽取:empty_summary_exit=0;invoke退出127且空流时B-14d/B-10prime仍[ok];S3只有assistant文字提及S3_RAN仍[ok]。未调用真实CLI,临时目录已清理。另见固定/tmp删除、全局pkill匹配和输出复用,需要本次所有权隔离。首次修复排队,历史RESULT补日期限定。

### SC-55 提示文件扫描缺少完整读取与关闭失败检查

核对c56全部24路径时,抽取现行生产函数注入CloseSync错误,withBoundDirCwd仍成功返回;stat大小12但readSync提前EOF时readBoundRegularFile返回空串。上层隐私扫描可能把未完整读取当0命中。probe-prompt-scan-completion.cjs与prompt-scan-completion-before.json记录原场景,只注入本地函数未读取用户文件。首次有限修复排队;不影响既有SC48临时目录清理结论,两者根因不同。

SC48补查:09f7920公开树隐私门自测也在try里process.exit。主控真实运行26pass/exit0仍遗留自有saydo-privacy-gate目录,私有TMPDIR探针已清。属于此前SC48同根因第二次,排队与SC55首次同一调用修复;不影响已复核的emoji/color/migration三个入口。

### SC-56 三端配对字符不一致

36a445全部23路径核对完毕,三份生成fixture由完整历史generator重放逐字相符。主控用现行Swift完整源码实际执行:原始token a后U+0301被接受并变为a,组合符被丢掉；按Character取首scalar违反原始query只允许ASCII unreserved的既有语义。共享generator对美元token输出Kotlin模板插值,也未保留字面内容。仓外pairing-swift-scalar-before.json/pairing-dollar-before.json记录,SC56首次修复排队。

### SC-57 测试清理缺少本轮归属

29c273全部25路径及现行global/setup/exactroots逐项核对。现行global启动扫系统tmp的saydo-*和HOME部分前缀,仅凭mtime删除；清单也没有run隔离。主控抽取生产setup,仅将home/tmp映射到自有沙盒:未登记旧前缀目录被删除。test-cleanup-ownership-before.json记录,没有扫描或删除真实用户home。首次修复排队,要求只清理本run已登记且验证归属的根,损坏/越界不能变pass。

SC53主控补验:真实定向9例通过,私有TMPDIR中自有锁目录0/相关进程0,临时根已清理。sc53-root-test.log 590bytes,SHA-256 6ec17e57c0dff7141221a312e46ea491c7619fccbf2c1bb4f0c2d0c52a17d66d；不是Windows或独立验收。

### SC58 — 实体发布校验的远端清理归属

当前 `runWindowsPhysical` 在本地闭包准备失败、或远端目录已存在而拒绝创建时,仍无条件发送远端 `rmdir`。主控抽取当前生产函数并替换SSH/文件系统边界,两例都观察到删除命令;没有连接真实远端。修复必须确认本次远端目录归属,失败/未知创建结果不能靠同名删除;本地与远端清理错误须保留原错误。首次有限修复排队,不记实体平台通过。证据 `release-remote-ownership-before.json` 保存在本任务仓外目录。

SC54 主控回读:首次全部代码差异与新增离线测试已读。原空汇总/B14d空流/B10prime空流/S3 assistant自述四例均正确失败;但报错tool_result含marker仍被paired_contains接受。实际私有父退子活继承pipe场景中,spawn.py写threads_drained=false/mapped_rc1后仍被非daemon线程拖住,7秒时未退出。探针自有组已杀并回收wrapper,第二次同根因有限修复排队;没有真实Claude/Windows验收。

### 174ab 历史候选补核

69 路径已逐项读完；22 张 PNG 从该 commit 提取并以 SHA-256 绑定后查看。旧 dark/dashboard、dark/notify 实际是亮色，light/psettings 显示项目不存在；这些截图不能证明完整亮暗/项目设置验收。当前 E2E 已在截图前断言 html data-theme，最终候选仍待实际重跑与内容核验。102 为 No-Go，108/112 缺 final/超时记录保留，不改写为通过。事务、writing blob、审批撤销与身份回修证据只支持对应历史源码范围。

### SC56 首修后真实 Swift 反例

当前完整生产文件编译成功；token 为 `%A`、`%a`、`abc%A` 时进程 exit -5，字符串索引越界。`%` 正常拒绝、`a%CC%81` 保留两个 scalar。`limitedBy: endIndex` 可返回 endIndex，随后下标访问不能成立。第二次定向修复已准备，SC56 保持未通过；首修日志通过不能覆盖此输入。仓外 sc56-root-truncated-percent.json 绑定生产源码 SHA。

### SC59 — managed stdoutTail 测试没有观察生产返回值

c3f8 全部32路径差异读取完成。当前同名用例的 captured 由 fake 自己赋值，等待条件允许 blocked/failed 或 captured 命中任一成立；最终只断言 captured 不含错误类名，因此空串也满足。它不能证明生产 runManagedCommand 保留 stdoutTail；未据此认定产品丢数据。首次修复限定测试，以真实生产返回值和资源终态作为断言，与 SC57 同批执行。启动失败的当前 closeGate 已纳入独立deadline，sendFatal 生产调用点有500ms上限；旧 mock 信号测试不能升级为Windows实体证明。

### SC54 第二轮收尾与暂停

受管调用822.438秒exit0，真实模型/成功终态及15个文件日志绑定已核对。主控完整读spawn.py及配对/汇总/清理关键路径，原拒绝marker返回1/no；真实父退子活继承pipe在0.348秒exit1，group_reaped与threads_drained为true；4000字节输出控制全量一致。作者离线50pass是自检，不是独立GREEN。

仍有归属反例：prove_owned 对旧record的leader==pgid，在当前getpgid(leader)==pgid时直接返回true，没有本轮birth/会话身份连续性证明；reap_owned_file 从数字记录重造active=true。主控仅mock当前同号新leader，accepted=true，无真实外来信号。SC54保持RED，第二次已用，第三次需owner追加（本轮按暂停要求不再派修、不新增提问）。仓外sc54-second-root-verification.json保留原始结果。

owner要求收完当前一轮后暂停并换会话。当前无活受管CLI；接续入口为[完整接续Prompt](2026-09-13-consolidation-crosscheck-IMPL-PROMPT.md)。SC56第二次、SC57/59首次、SC58首次均未启动。SC02/51追加已问待答，SC54新增追加未问；冻结388/396记录，8条待核。
