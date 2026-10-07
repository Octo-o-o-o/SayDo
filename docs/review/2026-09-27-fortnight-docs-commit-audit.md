# 2026-09-27 两周文档与提交双向审计

**状态:未提交候选,PG-02 RED,未独立验收,未交付。**

范围: 2026-09-13T00:00:00+08:00 至主线 `d023ffcebfad38563bc988977192e77654d7e2a1`;基线 `49ed96f64c887ede50c815e6eeb82576f898d69c`。34 个主线提交、112 份文本类文档、500 个变更路径。34/34 提交及112/112文档有提交级/本期差异核查结论。这个覆盖口径不是500路径全部逐行阅读,也不证明旧历史文档所有段落或所有平台现役行为均已验收。

原 PG-02 候选保存在 `6404824a21c37670f274e8516681f061e53b542f`;累计旧修复8/复审8,本次新增上限3/3,实际修复1/复审0。原dirty clone、stash和备份保留。

## 未关闭条件

- PG-02 真实 action checker最新检查点19为110失败(56项调用证明缺口、54项源码绑定差异;18新增provider运行期覆盖为119,随后逐条补齐10个漏记写点);capability/support的冻结源码绑定亦未关闭。变异测试与普通CI通过不能覆盖真实RED。
- owner已回复“均同意”,允许在原预算内补实际具名服务/DAO有限证明;当前ACK、HTTP、LiveDialog派发、项目服务及WS结果边界反例通过;错误投影、turn guard、recovery成功路径、预编译DELETE和cheap/dialog具名工厂返回已补定向反例;其余未知链继续保持RED。
- SC-51保留旧两次修复RED,owner已追加一次修复;本地两侧typecheck和31项管道/消费者故障回归通过,未独立验收或Windows真机验收。SC-54与完整shell语法解析沿已记录延期,不写成已修。
- action变异脚本的旧夹具已修正,正例与语义mutation走完,但整条脚本仍因真实源码绑定不一致exit 1;其余9条变异脚本exit 0。
- 最终单零上下文subagent复审、冻结release HEAD完整门禁、两提交法证据、private origin/main推送及清理均未执行。

## 裁决与修复

| 发现 | 对齐方向与实施 | 验证边界 |
|---|---|---|
| 任务耗时与历史完整性 | owner选择全任务累计;新增完整性标记,历史未知不补零 | 本地SQLite/单测,非运行设备账单 |
| 生命周期/依赖/归档/合并半提交 | 对齐canonical事务约束;事件、状态与同库审计失败整组回滚 | SQLite故障注入;临时Git合并 |
| HF终态存留与TTS取消后迟到输出 | 对齐终态与世代合同,释放正文并按会话令牌拒旧输出 | Python与假服务,无真实云音频 |
| 验收条目误报和缺证放行 | 未绑定项unknown;失败任务禁通过;缺解析回执/任何解析失败挡批准;持久status与parked呈现态分离 | 正负向真实daemon浏览器,模型/执行器替身 |
| 人工裁决沿用旧attempt | 绑定task、attempt、决策包、条目快照 | 浏览器新attempt反例 |
| 文档声称超出现役实现 | 校准首次话术、远程关闭、默认执行路线、发布版本、隐私和成本口径 | 源码/历史日志核对,本地站点截图;未部署 |
| 缺最近转写/记忆入口和列表投影 | 补只读入口、保留真实义务/任务与标题;IME确认不误发送 | 定向浏览器与单测 |
| SMTP/Windows边界 | 释放自有SMTP连接;ACE先类型/长度后读SID;安装失败不假成功 | 假socket/native注入与结构测试;真实投递/Windows未验 |
| PG-02漏报未知调用/ops改写 | 无法证明必须RED;保留旧失败,不改业务迎合checker | 反例先失败后通过,真实checker仍RED |

SC-51及后续checker改动之前的未提交候选 `just ci`、64项完整控制台Playwright、`just precommit` 均exit 0;PG-02的三条真实checker检查点19分别为110/8/6项失败。门禁彼此不能替代。

中间门禁与日志字节/hash见 [R204过程记录](../../history/PROCESS-JOURNAL.md)。所有检查仅绑定运行当时的候选,后续改动需对应复验。

## commit → 文档与实施

| 提交 | 主题 | 文档→实施结论 | 实施→文档结论 | 验证 |
|---|---|---|---|---|
| `52d1830` | docs(direction): White Edition 定为产品 UI 新方向,投资人原型入 demo/ | 方向合同、AGENTS demo 边界、tokens.css 注释与资产入口一致；未改产品 token 值。实际 handleAction 为103个case，无 fetch/XMLHttpRequest/WebSocket/getUserMedia，CSP connect-src none；JSON是历史mock QA，不升级为产品验收。本次未重跑其完整交互矩阵。 | 变更均有方向合同/决策单/证据归属；无新增运行时能力声明。 | 最终完整门禁 pending；本条不是发布或独立GREEN。 |
| `d8a35b1` | chore(plan): 插批 JOURNEY-01(参考旅程),deferred 重议触发条件补登,决策单第 13 节 | owner决策第13节、PLAN-2串行链/批卡/deferred触发、HANDOFF投影与schedule-pointer常量同步；其历史未开工状态不覆盖后续JOURNEY收口。本候选当前schedule-pointer revision19检查通过。 | 变更均有方向合同/决策单/证据归属；无新增运行时能力声明。 | 最终完整门禁 pending；本条不是发布或独立GREEN。 |
| `0f7d67a` | chore(evidence): 方向登记批收口,指针 revision 9→10(next=JOURNEY-01);决策单第 13 节;journal R162;week-audit 账本重生成 | 证据与journal明确为方向登记、mock资产、无独立产品验收，未把just ci未跑写成通过；103case数已本次核验。generated publication/bundle仍待最终week-audit gate，历史部署和真人场次结论未冒充本次实测。 | 变更均有方向合同/决策单/证据归属；无新增运行时能力声明。 | 最终完整门禁 pending；本条不是发布或独立GREEN。 |
| `8fb99bd` | feat(quickstart): 安装与首启门槛收敛(CLI help/用法可见、--no-open 下一步、向导空态修复行、安装脚本 Node 镜像与进度、官网使用流程重写) | 18路径逐项核对：CLI help/用法、no-open、SetupWizard空态只用daemon fixHint、Layout未锚定会话不报语音就绪、cliCapability命令与句子hint、bootPromote终端投影及uv缺失降级均与docs11/quickstart证据对应。发现并修复错误参数回显、help依赖home、custom home/port提示及Node镜像校验口径；安装脚本mutation和CLI定向回归已过，当前真实安装未复跑。 | 本提交各路径均有canonical/安装发布说明/当期证据映射；本次发现的差异按当前实施与不可变发布事实修正。 | 定向结果见repair-1-notes与日志；最终完整门禁及独立review pending。 |
| `34143ab` | chore(evidence): 安装部署与首启门槛收敛批证据、官网部署记录与 journal R163 | 逐项对照8fb99bd及journal R163：原始just ci失败与Windows not_run有保留；Node校验来源措辞不实，本候选已追加勘误并校准现役文案。 | 逐项对照8fb99bd及journal R163：原始just ci失败与Windows not_run有保留；Node校验来源措辞不实，本候选已追加勘误并校准现役文案。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `6a9e0aa` | fix(quickstart): Windows 一条命令安装拆成 ASCII 引导 + BOM 核心;修 CI 红(setup-android 包名、reaper 用例进程组) | ASCII引导/BOM核心、headers/active-claims roots、setup-android参数及POSIX进程组diff与README/中英docs吻合。引导失败吞退出状态已修复并mutation验证；reaper用例补退出码、marker、owner移除断言和所属进程清理登记，30passed/1skipped，非Windows真机验收。 | 本提交各路径均有canonical/安装发布说明/当期证据映射；本次发现的差异按当前实施与不可变发布事实修正。 | 定向结果见repair-1-notes与日志；最终完整门禁及独立review pending。 |
| `768ee40` | release: bump 0.1.0-rc.12 -> 0.1.0-rc.13 | 版本升级27路径(库存含rename旧路径计28)逐项核对manifest/workflow/CLI/官网锚/post-release/Windows wrapper/bundle固定tag；rc13远端不可变发布及资产digest和6smoke已只读核实。历史rc12文档被改写与rc13遗漏CLI变化已修复，version-matrix旧标签同步纠正；release四脚本回归通过。 | 本提交各路径均有canonical/安装发布说明/当期证据映射；本次发现的差异按当前实施与不可变发布事实修正。 | 定向结果见repair-1-notes与日志；最终完整门禁及独立review pending。 |
| `7a562fe` | chore(evidence): 随 rc.13 bump 重生成账本 | 逐文件核验该commit publication manifest 2249条及integrity.files，均匹配真实Git blob；只证明物化一致性。 | 逐文件核验该commit publication manifest 2249条及integrity.files，均匹配真实Git blob；只证明物化一致性。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `eed2cf1` | release: version-matrix 记录 CLI 0.1.0-rc.13 候选(test-mobile-release-contract 在 CI 上判红) | 原候选行混用rc12可用性，后2564ea5换为rc13证据；本候选再次修正当前version-matrix标记，未追认候选时可用。 | 原候选行混用rc12可用性，后2564ea5换为rc13证据；本候选再次修正当前version-matrix标记，未追认候选时可用。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `73ffe64` | chore(evidence): 随 version-matrix 修正重生成账本 | 逐文件核验该commit publication manifest 2249条及integrity.files，均匹配真实Git blob；候选版本登记与rc13发布链对应。 | 逐文件核验该commit publication manifest 2249条及integrity.files，均匹配真实Git blob；候选版本登记与rc13发布链对应。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `412338f` | chore(evidence): 固化 rc.13 发布后 --verify 证据并重生成账本 | 逐文件manifest 2250条/完整性摘要通过；GitHub不可变rc13 Release资产摘要、大小、发布时间与verify.json一致，15个required job成功，失败标记job跳过。 | 逐文件manifest 2250条/完整性摘要通过；GitHub不可变rc13 Release资产摘要、大小、发布时间与verify.json一致，15个required job成功，失败标记job跳过。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `2564ea5` | release: rc.13 实体门通过,availability 翻转为 available;安装脚本改钉 rc.13 | availability、四项Mac/Windows实体证据、安装脚本rc13版本与SHA、README/官网/文稿已对照。GH immutable Release资产字节数/摘要、run34929194176及六项smoke与证据一致；历史bundle2255项逐字节核验无差异。 | 发现version-matrix正文仍误标rc12已在本候选修正，其他rc13可用性有对应证据。当前检查器与current candidate不是当时制品。 | release审计4脚本exit0；历史远端run核验通过，不代表本候选已发布/真机验收。 |
| `216e4dd` | docs(quickstart): rc.13 已含 help/doctor,删去官网与 README 里「包无 --help / doctor 未发布」的 rc.12 时代说明 | 逐行核对README与两语docs删改：help/doctor与rc13 CLI source一致；固定发布包身份由GitHub不可变资产核验。publication manifest2255条均通过。 | 逐行核对README与两语docs删改：help/doctor与rc13 CLI source一致；固定发布包身份由GitHub不可变资产核验。publication manifest2255条均通过。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `5bf7301` | chore(evidence): rc.13 发布链与官网 production 证据、journal R164、账本重生成 | 完整阅读发布/部署证据及journal R164；GitHub release与job实查吻合，11个availability锚和实体证据仅绑定旧发布；未重跑历史官网部署/实体安装。manifest2256条匹配。 | 完整阅读发布/部署证据及journal R164；GitHub release与job实查吻合，11个availability锚和实体证据仅绑定旧发布；未重跑历史官网部署/实体安装。manifest2256条匹配。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `a7946f2` | chore(evidence): 证据与 journal 脱敏 Windows 主机地址(公开树隐私门) | 只对历史证据/journal主机地址脱敏；发布身份和测试结论未改，manifest2256条逐文件匹配。 | 只对历史证据/journal主机地址脱敏；发布身份和测试结论未改，manifest2256条逐文件匹配。 | historical-bundles.json; release-audit-tests.json; 2026-09-27 GitHub API rc13 release/job readback |
| `c012c97` | chore(evidence): quickstart 用户视角走查与设计对齐检查(四项缺口登记),journal R165 | rc13走查A/B/C/D与当前入口对照；A已由现行开场白收窄，B补最近记忆只读入口，C发现并修IME Enter，D已补只读最近转写入口、加载/失败/空态，并经定向浏览器核对。 | 证据/PROCESS-JOURNAL与两份生成账本对应；不把当日无阻断说成无缺口，保留原观察，补当前候选处置。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `8086af1` | feat(site): 官网首页对齐 White Edition,新增双语 Quick Start 页 | 15个站点路径与首页/quickstart改版记录对应；当前公开能力声明、安装和隐私文案已按源码校准，支持页旧扫码前提补修。 | 十二页面388内部页面链接无重复id或缺锚；主题脚本和中英文路由对应设计，渲染图片已核；旧线上部署不由当前源码重验替代。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `a06613d` | fix(site): 回修评审发现——首页补 faq 锚点,英文页内部链接走 /en/ 规范路由 | 双语faq锚点和英文内部路径修复与评审major/minor对应。 | 当前静态链接集合核对，未引入新产品执行或远程支持承诺。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `7d40e9d` | fix(site): 首页恢复 rc.13 availability 锚句,满足部署门禁 fail-closed 校验 | rc13 availability原文单句门禁补丁与报告一致，真实release历史证据已独立查验。 | 两首页只补锚句；非切换句的历史YELLOW取舍保留，当前支持级别另校准。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `6c19e1e` | chore(evidence): 官网改版零上下文评审记录(轮0 RED→回修两轮 GREEN/YELLOW) | 评审记录指向8086af1→a06613d→7d40e9d真实提交与对应diff。 | 只提交报告，保留RED/GREEN/YELLOW而非重写成一轮全绿；旧privacy/support欠账本候选已修。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `0880c49` | chore(evidence): site redesign deploy R166 | 部署证据四个提交指向真实对象且范围对应；声明没有走公开快照完整部署门和Cloudflare API复核，不外推为当前full gate GREEN。 | 只证据+journal；本次无部署，当前候选源码修复不声称已上线。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `25d9659` | chore(schedule): DAILY-01-workbench-restore 插队开批,next=JOURNEY-01 | DAILY 插批仅更新 HANDOFF，后续 PLAN2 串行链已吸收同一 ID；当时当前行如今保留为历史，顶部指针为唯一现势。 | 未夹带产品改动；DAILY 代码已并入 62b07c2，后续该批统一核查。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `62b07c2` | feat(phase-JOURNEY-01): 整合真实事项旅程与语音安全续接 | 本期09/10/11与08/modules合同差异对照语音屏障、HF/PTT身份与终态、Focus事务/依赖、续接所有权、确认卡/采访、Demo请求代次、记忆确认、验收原文与状态、成本窗口和远程关闭。文档及实施发现项已落实候选：ASR字段、TTS取消/HF回收、归档/依赖/合并事务、验收unknown及缺证拦截、人工裁决身份绑定、首次话术和最近转写/记忆入口等。 | 主路径变化有canonical合同承接；旧页README和历史映射改为当前入口。真实source与fixture/mock证据分开。示例与截图不作手机/模型真实验收；对未实现的远程/自动立卡/零成本等声明按源码校准，未扩执行路线。 | JOURNEY正向七步与verify失败负向在隔离真实daemon/SQLite上通过，模型/执行器为测试替身；62控制台浏览器及中间ci通过后续有修改。当前逐项提交级影响核查不是500路径全部逐行阅读，最终门与单subagent review pending。 |
| `d05d8ee` | chore(evidence): phase-JOURNEY-01 本地验收与流程例外 | 排产/证据与对应产品提交、journal、日志大小/hash逐项对照；本次修复保留历史结果并追加勘误。 | 无新增产品行为；本期证据与状态变更均有记录，当前PG02与远端/设备未验独立登记。 | 历史证据核验不替代本候选独立复审。 |
| `4f9d6c6` | chore(schedule): 收口 DAILY 与 JOURNEY 本地集成 | 排产/证据与对应产品提交、journal、日志大小/hash逐项对照；本次修复保留历史结果并追加勘误。 | 无新增产品行为；本期证据与状态变更均有记录，当前PG02与远端/设备未验独立登记。 | 历史证据核验不替代本候选独立复审。 |
| `595725b` | chore(evidence): DAILY JOURNEY 本地收口账本 | DAILY/JOURNEY收口与schedule负例修复后自测记录一致。 | 只journal与两物化账本，历史Git blob字节/摘要已核，不把账本机械关联当语义通过。 | 历史范围核查；当前完整门禁与独立review pending。 |
| `b751843` | fix(voice-measure-01): 修复 EOU 与语音计时轮次归属 | 执行卡 EOU 视图、TTS 入队归属与代码逐条匹配；发现 daemon 第501轮清空去重与取消旧句复活，已在审计候选修复。 | 15路径 delta 核查；原测试区分系统句与真实turn、HF L5未验；新79项Python定向回归和句归属测试，不替代真实服务。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `d0b7edc` | chore(evidence): VOICE-MEASURE-01 本地验收与收口 | VOICE 证据代码SHA正确，四个原始门禁日志字节/sha256逐一匹配；历史GREEN不外推到当前候选。 | 排产revision14与执行卡后继一致；L5、设备、远端未验保留。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `cbfdcde` | feat(codex-as-spike-01): 添加隔离的 App Server 受控协议原型 | 原型执行卡对应隔离stdio路径和默认拒绝实验；修复initialized背压、未知method泄漏和CLI未知/重复参数；README纠正codex exec生产身份。 | 25路径对照；源码入口/协议/进程清理/许可/意图/队列逐项检查，111测试通过。39来源schema哈希与304文件数核实，不宣称当前真实模型或生产支持。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `7a90e61` | chore(evidence): 收口 Codex App Server 受控原型 | 五条历史门禁原始日志字节和sha256全匹配，代码SHA cbfdcde与证据拆提交一致。 | 6个证据/排产路径一致；旧5修复4复审和未验面保留，当前111fixture不改写历史108。 | 本期差异核查及已运行验证见两侧结论；最终冻结门禁与独立复审待执行。 |
| `814da93` | chore(research): 入库语音与 Codex 研究包、语音运行时评估,journal R191-R193 记录本地副本清理与归档 tag | 研究包方案/现役第0章与VOICE/AS后续提交对照；探针有替身/历史RED明确限定。 | 12路径含两研究探针与结果JSON、journal归档tag记录，非生产实现/验收；TTS旧句复活已在本候选修复并另记当前测试。 | 历史范围核查；当前完整门禁与独立review pending。 |
| `90e0777` | chore(plan): 插批 SC-RELAND-01(CODEX-AS-SPIKE-01 后、PG-02 前),指针 revision 16→17 | SC插批范围与决策单14、执行卡、PLAN2、HANDOFF一致。 | 5文档不引入产品执行；旧PG02与SC51/54边界保留，本次另有PG02授权。 | 历史范围核查；当前完整门禁与独立review pending。 |
| `f8405cf` | feat(sc-reland-01): consolidation 残余缺陷逐项复现后重落地 | SC逐项勘误/证据与canonical现役边界交叉核对；SC51/54及既有shell地板缺陷仍延期。核对命令分类器完整diff与历史地板、CLI进程清理、Windows卷/ACL与Python native边界、provider origin、logger/latency、回叫跨await冻结、发布清理所有权、官网/配对/模板口径。发现并修复SMTP连接释放、ACE读取长度与类型顺序、脚本安装失败退出、测试自有进程清理及站点现役口径。 | 修改的实施族均回指SC逐项证据及canonical；旧独立GREEN仅绑定当时候选，不沿用为本候选验收。SC51继续受其旧预算约束，未借本审计复活；SC54与完整shell语法解析保持明确延期。 | 本机完整ci与62项Playwright已在中间候选通过，定向SC shell353、callback49、ACL13及安装结构等见repair-1-notes。未重跑Windows/手机真机、真实模型或SMTP投递，不称全平台验收；最终冻结门/独立review pending。 |
| `d023ffc` | chore(evidence): SC-RELAND-01 本地验收与收口,指针 revision 17→18(next=PG-02) | 排产/证据与对应产品提交、journal、日志大小/hash逐项对照；本次修复保留历史结果并追加勘误。 | 无新增产品行为；本期证据与状态变更均有记录，当前PG02与远端/设备未验独立登记。 | 历史证据核验不替代本候选独立复审。 |

## 文档 → commit

| 文档 | 本期提交 | 核对结论 |
|---|---|---|
| `AGENTS.md` | `52d1830` | 对应52d1830/d8a35b1/0f7d67a；方向与历史证据边界一致。 |
| `docs/11-ui-spec.md` | `52d1830`, `8fb99bd`, `62b07c2`, `f8405cf` | 本期方向/DAILY与JOURNEY界面合同、证据正文、首启修复行、语音屏障与PG02登记条款逐段对照实现；候选恢复PG02表尾，补IME/最近记忆/最近转写与真实数据边界。 |
| `HANDOFF.md` | `d8a35b1`, `25d9659`, `d05d8ee`, `4f9d6c6`, `b751843`, `d0b7edc`, `cbfdcde`, `7a90e61`, `90e0777`, `d023ffc` | 串行链、历史各批收口与当前PG02状态分别核验；候选revision19 active PG02，未沿用旧next未开工。 |
| `docs/plan/2026-08-28-project-gap-owner-decisions.md` | `d8a35b1`, `90e0777`, `f8405cf` | 本期§10.1/13/14逐条对照提交及历史证据，保留未授权范围与SC51/54延期，不把旧授权覆盖当前预算。 |
| `docs/plan/IMPLEMENTATION-PLAN-2.md` | `d8a35b1`, `62b07c2`, `4f9d6c6`, `b751843`, `d0b7edc`, `cbfdcde`, `7a90e61`, `90e0777`, `f8405cf`, `d023ffc` | 两周串行链/批卡/延期触发逐段比对提交，schedule-pointer候选revision19检查通过；真实设备/远端未验保留。 |
| `docs/plan/README.md` | `d8a35b1`, `4f9d6c6`, `b751843`, `d0b7edc`, `cbfdcde`, `7a90e61` | 历史排产投影已转PLAN2唯一指针，AppServer未装配生产。 |
| `e2e/evidence/direction-2026-09-15.md` | `0f7d67a` | 对应52d1830/d8a35b1/0f7d67a；方向与历史证据边界一致。 |
| `history/PROCESS-JOURNAL.md` | `0f7d67a`, `34143ab`, `5bf7301`, `a7946f2`, `c012c97`, `0880c49`, `d05d8ee`, `4f9d6c6`, `595725b`, `b751843`, `d0b7edc`, `cbfdcde`, `7a90e61`, `814da93`, `d023ffc` | 本期R162–R203逐批对照产品/证据提交和历史日志；保留历轮RED及后来更正，不把历史收口当当前验收。 |
| `README.md` | `8fb99bd`, `6a9e0aa`, `768ee40`, `2564ea5`, `216e4dd` | rc13坐标对照Release与CLI；候选补help/custom home与PG02真实RED边界，未发布。 |
| `e2e/evidence/quickstart-2026-09-15.md` | `34143ab` | 逐项对照8fb99bd及journal R163：原始just ci失败与Windows not_run有保留；Node校验来源措辞不实，本候选已追加勘误并校准现役文案。 |
| `docs/release/README.md` | `768ee40` | 期间rc12→13索引与rename规则符合Git；发现当前support-matrix夸大描述并修正为bounded checker，required产品checker尚RED。 |
| `docs/release/v0.1.0-rc.12.md` | `768ee40` | 期间作为rename旧路径删除，release/README明确非cross-linked历史版随bump改名；不是遗漏待恢复文档。 |
| `docs/release/v0.1.0-rc.13.md` | `768ee40` | 对照CLI实际diff与rc13不可变Release，本候选修复取代rc11/CLI不变误述及rc8–13五个的错误历史范围；当前资产合同和脚本相符。 |
| `docs/release/v0.1.0-rc.2.md` | `768ee40` | 唯一期间改动为当前可用链接rc13；实际rc13Release与文件链接已核，原历史不可用说明保留。 |
| `docs/release/v0.1.0-rc.3.md` | `768ee40` | 唯一期间改动为当前可用链接rc13；实际rc13Release与文件链接已核，原历史不可用说明保留。 |
| `docs/release/v0.1.0-rc.4.md` | `768ee40` | 唯一期间改动为当前可用链接rc13；实际rc13Release与文件链接已核，原历史不可用说明保留。 |
| `docs/site/2026-08-20-docs-page-content.fable.md` | `768ee40`, `2564ea5`, `f8405cf` | 本期diff逐段核验；残余B7/B8/B9远程/隐私承诺、M0热词确认、DND邮件口径修正文稿和对应中英页面。历史结构/评审不升级为现役证据；未部署。 |
| `docs/site/2026-08-20-homepage-structure-copy.fable.md` | `768ee40`, `2564ea5`, `f8405cf` | 本期diff逐段核验；残余B7/B8/B9远程/隐私承诺、M0热词确认、DND邮件口径修正文稿和对应中英页面。历史结构/评审不升级为现役证据；未部署。 |
| `packages/cli/README.md` | `768ee40` | 两处rc13下载坐标对照真实制品；候选help/custom home行为与源码一致，未当作rc13已发布修复。 |
| `docs/release/version-matrix.md` | `eed2cf1`, `2564ea5`, `f8405cf` | rc13实体证据与物化hash已核；修正available仍指rc12，不改历史真机结论。 |
| `e2e/evidence/2026-09-15-rc13-release-and-site-deploy.md` | `5bf7301`, `a7946f2` | 完整阅读发布/部署证据及journal R164；GitHub release与job实查吻合，11个availability锚和实体证据仅绑定旧发布；未重跑历史官网部署/实体安装。manifest2256条匹配。 |
| `e2e/evidence/2026-09-15-quickstart-walkthrough.md` | `c012c97` | A发现firstRun固定话术仍错误承诺，09/10与源码共同纠正；B最近记忆入口；C独立IME反例；D桌面只读最近转写入口。6项浏览器回归通过，不代表真人/已发布rc13修复。 |
| `research/codex-findings/2026-09-17-site-redesign-review.md` | `6c19e1e` | 三冻结提交及修复diff逐项对应；保留旧RED/GREEN/YELLOW。支持/privacy遗留已在候选处理；本次不冒称复现当时reviewer身份。 |
| `e2e/evidence/2026-09-17-site-redesign-deploy.md` | `0880c49` | 实际Git提交链与15站点文件对应；公开快照门未执行、Cloudflare API未验边界原文保留；本次源码修复未部署，不能借历史部署判当前通过。 |
| `docs/08-module-design.md` | `62b07c2` | 本期Tier1/语音实现边界、DAILY IA与JOURNEY真实读口对照当前源码；候选修正旧IA投影说明。 |
| `docs/09-data-contracts.md` | `62b07c2`, `f8405cf` | 本期全部diff含§10.1/15.2逐段核对；修正ASR五支遗漏、TaskView累计时钟、首启话术、HF历史源码映射；修复任务/依赖/审计事务、HF终态正文释放。真实语音与PG02产品检查仍未通过。 |
| `docs/10-voice-ux-spec.md` | `62b07c2` | 话术编号重号、demo送达/展示、M0结果不确定、语音屏障/轮次终态对照源码；补首启与TTS取消边界，不承诺真人验收。 |
| `docs/modules/a-dialogue.md` | `62b07c2`, `f8405cf` | 本期A1/A2/A3/A4/A6差异对照pipeline/hub/barrier/dialog/确认环/包工厂；保留内存旧稿与真实语音未验界限。 |
| `docs/modules/c-control-bridge.md` | `62b07c2`, `f8405cf` | 逐hunk对照Tier1 ROOT/liveTools step_confirm闸、callback投递与成本全账本/300窗；更新D8 Codex隔离原型边界与路由数量旧注。07另校准同源checksums、SMTP连接清理。未声称真实云/设备验收。 |
| `docs/modules/d-presentation.md` | `62b07c2`, `f8405cf` | 逐hunk对照Tier1 ROOT/liveTools step_confirm闸、callback投递与成本全账本/300窗；更新D8 Codex隔离原型边界与路由数量旧注。07另校准同源checksums、SMTP连接清理。未声称真实云/设备验收。 |
| `packages/console/src/pages/redesign/README.md` | `62b07c2` | 逐项对照JOURNEY源码，修正fork/rail/tasks/live interview已建与常驻右栏的过时描述。 |
| `docs/review/2026-09-20-journey01-integration-handoff.md` | `d05d8ee`, `4f9d6c6` | 逐行核历史阶段、真实/替身边界、流程例外与三门日志hash；原延期3P2已在本候选修复待统一验收，保留旧数字。JOURNEY产品范围继续逐路径核对。 |
| `docs/review/2026-09-23-journey01-local-acceptance.md` | `d05d8ee`, `4f9d6c6` | 逐行核历史阶段、真实/替身边界、流程例外与三门日志hash；原延期3P2已在本候选修复待统一验收，保留旧数字。JOURNEY产品范围继续逐路径核对。 |
| `e2e/evidence/journey-01-reference-wiring.md` | `d05d8ee`, `4f9d6c6` | 逐行核历史阶段、真实/替身边界、流程例外与三门日志hash；原延期3P2已在本候选修复待统一验收，保留旧数字。JOURNEY产品范围继续逐路径核对。 |
| `e2e/evidence/journey-01.md` | `4f9d6c6` | 逐行核历史阶段、真实/替身边界、流程例外与三门日志hash；原延期3P2已在本候选修复待统一验收，保留旧数字。JOURNEY产品范围继续逐路径核对。 |
| `.octoworkflow/project-profile.md` | `b751843`, `cbfdcde` | 通用/历史具名例外与本次授权分层核对；旧8/8不清零，当前宿主+单subagent，未验状态保留。 |
| `docs/plan/2026-09-23-voice-measure-app-server.md` | `b751843`, `d0b7edc`, `cbfdcde`, `7a90e61` | 逐项对应EOU视图、句ID归属、HF L5延期及隔离原型；既有本地收口只作时点记录，当前按PLAN2指针；审计补充去重边界。 |
| `docs/plan/OWNER-DECISIONS.md` | `b751843`, `cbfdcde` | 有限重议与原型实现、ADR-005核对；修正codex exec被误称生产执行的句子，不改签署栏或PG-07延期。 |
| `e2e/evidence/voice-measure-01.md` | `d0b7edc` | b751843身份与四门原始日志字节/哈希核验；EOU/TTS代码对应，发现并另修去重与取消竞态，历史证据不改写成当前GREEN。 |
| `packages/daemon/src/experimental/codex-app-server/README.md` | `cbfdcde` | 逐条对应CLI/protocol/session；生产路径文案改为Tier1唯一、codex exec仅BYOA；当前背压与隐私修复111项fixture通过，真实握手与真实模型仍未重跑。 |
| `e2e/evidence/codex-as-spike-01.md` | `7a90e61` | 历史cbfdcde代码SHA与五门原始日志字节/哈希一致；304schema及39引用哈希一致；旧计数与not_run保留。 |
| `docs/plan/2026-09-23-qwen-audio-agent-borrowing-assessment.md` | `814da93` | VR01–14范围/取舍未把研究组件当生产；实际复跑§8反例当前仍RED并修复TTS代际，79项定向通过；增入库与候选状态注，不推行R1–R5架构变更/真实服务实验。 |
| `research/saydo-interaction-20260922/2026-09-23-实施复核与推进.md` | `814da93` | 历史245路径/238产品+7证据与Git提交集合可对应；旧三P2已在本次候选修复并定向UI/API验证，旧notmerged/旧测量缺陷不作为现势。原duplicate review例外及真实模型/设备未验保留。 |
| `research/saydo-interaction-20260922/K0-续接核查.md` | `814da93` | 历史K0/旧4+4预算与后继实施回执分层；当前JOURNEY已有62b07c2/d05d8ee/收口，HF/PTT相关生产测试本轮通过。原RED/基线保留，不照旧候选重新施工。 |
| `research/saydo-interaction-20260922/方案-IMPL-PROMPT.md` | `814da93` | 原型目标A1–A8与隔离源码/入口相对应，旧K0和禁止提交是历史范围，未当当前授权；真模型实验仍显式关闭，本次修复initialized实际写入顺序。 |
| `research/saydo-interaction-20260922/方案.md` | `814da93` | 按第0章逐版及末尾PG02回执核对代码提交/证据来源；发现“第0章当前唯一行动”及未实施PG02旧态会误导，追加历史边界/PLAN2唯一排产说明。旧probe依赖已退役内部字段，明确仅绑定09-22基线；外部研究结论保留当日范围，未声称本次上游实测。 |
| `research/saydo-interaction-20260922/集成候选续接-IMPL-PROMPT.md` | `814da93` | 历史授权/执行prompt已置过时横幅；旧8+8追加不外溢当前PG02，不重新执行或重置预算；源码/P2处理以当前审计和后继验收证据为准。 |
| `research/voice-runtime-20260923/README.md` | `814da93` | 历史2场景JSON与探针源码对应；本次再次复现exit1再修至exit0，仅新句下发；旧JSON/日志事实不覆盖，追加79项回归及未验界限。 |
| `docs/plan/IMPL-PROMPT-SC-RELAND-01.md` | `90e0777` | 105行执行卡对照SC批卡与证据；逐项rel landed/absorbed/deferred范围，原生/真实服务未验边界一致。 |
| `apps/android/README.md` | `f8405cf` | f8405cf 唯一变更为远程入口边界注;与 remoteSurface.ts/VoiceHub.handleHello/ROOT HTTP 守卫及 mobile-lan-process 反例一致。壳构建/真机未重跑,不升级历史证据。 |
| `apps/harmonyos/README.md` | `f8405cf` | f8405cf 唯一变更为远程入口边界注;与 remoteSurface.ts/VoiceHub.handleHello/ROOT HTTP 守卫及 mobile-lan-process 反例一致。壳构建/真机未重跑,不升级历史证据。 |
| `apps/ios/README.md` | `f8405cf` | f8405cf 唯一变更为远程入口边界注;与 remoteSurface.ts/VoiceHub.handleHello/ROOT HTTP 守卫及 mobile-lan-process 反例一致。壳构建/真机未重跑,不升级历史证据。 |
| `docs/01-vision-and-problem.md` | `f8405cf` | 文档→实施: 近两周新增现役/目标边界与 Tier1 构造、remoteSurface HTTP/WS 拒绝、CLI backend 选择核对一致；愿景未作为可用性证据。 实施→文档: f8405cf 的本文件修改与对应源码/既有合同可相互追溯；不是独立验收或真实服务通过。 |
| `docs/02-product-definition.md` | `f8405cf` | 文档→实施: 新增现役边界与本机 T1、逐步确认、远程 API/WS 关闭守卫一致；移动回叫为本机处理提示，不是移动业务开放。 实施→文档: f8405cf 的本文件修改与对应源码/既有合同可相互追溯；不是独立验收或真实服务通过。 |
| `docs/03-architecture.md` | `f8405cf` | 文档→实施: 全部变更逐项核验：Tier1 实际 ROOT 构造、memory compiler/contextpack 合同、RMS/hangover VAD、dialog CLI oneshot、remoteSurface 与 ntfy 本机入口对应；旧 Hopper 图明确 deferred，未知恢复未宣称无缝。 实施→文档: f8405cf 的本文件修改与对应源码/既有合同可相互追溯；不是独立验收或真实服务通过。 |
| `docs/04-key-mechanisms.md` | `f8405cf` | 文档→实施: 全部变更对照 compiler 来源/预算/摘要/稳定前缀代码，callback 邮件与并发重检，executor gateIntegritySurfaces/driftGuard 及 Tier1 状态。每请求按内容重读入口与绑定文件，digest 为审计投影；本次另修 spawn 身份核验缓存旧注释。真实 SMTP 仍未验。 实施→文档: f8405cf 的本文件修改与对应源码/既有合同可相互追溯；不是独立验收或真实服务通过。 |
| `docs/05-roadmap.md` | `f8405cf` | 文档→实施: 新增阅读时点与实际 PLAN2/ADR005 一致；gateIntegritySurfaces+gateScriptDriftGuard 已实施并保持 canary，不把历史首发双路径或工程日估算当现役交付。 实施→文档: f8405cf 的本文件修改与对应源码/既有合同可相互追溯；不是独立验收或真实服务通过。 |
| `docs/06-references.md` | `f8405cf` | 本期七态与四态、scope/action/gate/support术语对照truthPlane与09；候选恢复§8尾部与准确PG02引用，保持true gate RED。 |
| `docs/07-tech-stack-decisions.md` | `f8405cf` | 逐hunk对照Tier1 ROOT/liveTools step_confirm闸、callback投递与成本全账本/300窗；更新D8 Codex隔离原型边界与路由数量旧注。07另校准同源checksums、SMTP连接清理。未声称真实云/设备验收。 |
| `docs/README.md` | `f8405cf` | canonical索引权威边界一致；修正09-13整合报告仍进行中的过时状态。 |
| `docs/adr/ADR-003-os-adapters.md` | `f8405cf` | 期间ACL每ACE有效权限/protected/无继承收紧与platform回读实现一致；新增修复类型/尺寸检查前读取SID风险，13定向tests通过，native Windows未验。CI确为三平台distribution、Ubuntu Node/browser，未混称Windows全量。 |
| `docs/adr/design/ADR-004-windows-platform.md` | `f8405cf` | 期间POSIX realpath+ino硬锚/dev重挂载允许与workspace.revalidate实现及09合同一致；Win32 dev仍严格。FAQ历史授权回指§2，不代表本轮部署。 |
| `docs/modules/e-crosscutting.md` | `f8405cf` | 期间CLI对话槽文本单发与现役provider resolve一致，不等于实时语音；L1回叫只指本机受信入口与remoteSurface关闭业务面的合同一致。 |
| `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md` | `f8405cf` | 文档→实施: 新增历史边界与默认Runner决策及PLAN2一致；不把外部研究转为native_api/DSH实施授权。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-15-default-runner-decision.md` | `f8405cf` | 文档→实施: 三处勘误分别限定DSH rc漂移、max_tokens成本上限与后续有限在线spike。openaiCompat实际16000下限按官方origin且length空结果拒绝，未将历史样本当当前模型/价格验证。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-17-dsh-plugin-line-assessment.fable.md` | `f8405cf` | 文档→实施: 新增注记明确样本100/1211不能全局否定、6与3+4不闭合、失败调用及上下文继承证据限制；仓外插件不占SayDo批次。未重跑生态研究。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` | `f8405cf` | 文档→实施: 新注记及四处v2勘误对齐v3.1。实际claude backend argv default，身份两路径forceRehash；历史17次spike非当前live conformance，未以旧政策摘录作当前许可。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-20-repo-public-readiness.fable.md` | `f8405cf` | 文档→实施: 新增边界与当前origin私有归档/public快照分离一致；撤销历史依赖兼容/一行换license无证据泛化，本次不再执行旧可见性变更。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-20-seven-steps-gap-closure.fable.md` | `f8405cf` | 文档→实施: 当前liveTools明确demoPresented=false、demoHintDelivered独立，与新增历史限定一致；旧七步表不作为现役全链通过。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` | `f8405cf` | 文档→实施: 新增注记只限定历史6/11 initialize样本的证据范围，不撤销已签方向，也不冒称TCK/认证/取消/成本验收；AppServer实验独立且生产Tier1未改。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-08-24-ai-supply-owner-decisions.md` | `f8405cf` | 文档→实施: 逐项核实际签署1/2/6/7及其余6未签；第3项family降级仍草案，未将未签条款施加本次门禁；ACP样本边界与历史评估相符。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/2026-09-03-tailcat-borrowing-assessment.fable.md` | `f8405cf` | 文档→实施: 实际30行表重计A0/B8/C22；新增注记纠正总括并明确旧远程/配对指南已退役，与remoteSurface拒绝一致，不引入Tailcat。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/IMPL-PROMPT-12-S1-DEMO-WIRING.md` | `f8405cf` | 文档→实施: 新增历史注记与liveTools demoPresented/demoHintDelivered分账一致，旧screenText不能证明DemoFrame展示。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/IMPL-PROMPT-13-S2-CALLBACK-CHANNELS.md` | `f8405cf` | 文档→实施: 新增历史边界对应当前sweep跨await冻结/ACK重检与attemptNotify状态检查；真实投递未验，旧spawn不等于送达。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/plan/IMPL-PROMPT-9-CMDEFFECT-HARDENING.md` | `f8405cf` | f8405cf 唯一增补历史入口限定;Git e79d1d8 是对应cmdEffect实施提交。当前SC38/39实现另在f8405cf逐项审计,本项不代替该验收。 |
| `docs/plan/IMPL-PROMPT-PG-01A-FG1.md` | `f8405cf` | f8405cf 同批历史边界;真实Git核验2a786ed/f4d8de9,不是新开批或来源连接器验收授权。 |
| `docs/plan/IMPL-PROMPT-PG-01A.md` | `f8405cf` | f8405cf 增补历史执行边界;真实Git核验2a786ed/f4d8de9代码与证据提交存在。旧额度不自动恢复,符合现役纪律。 |
| `docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md` | `f8405cf` | f8405cf 增补历史边界;真实Git核验7ab7ab3/21ed284代码与证据提交,不宣称本次候选已验。 |
| `docs/plan/LINUX-ALIGNMENT.md` | `f8405cf` | 文档→实施: 新增历史边界对齐PG01B远程关闭、PLAN2和release各OS分别验收，不把T3/systemd当已交付。 实施→文档: f8405cf 为历史材料的勘误/范围限定，未新增现役产品能力；仅审核其本期差异与所指本仓实施。 |
| `docs/release/2026-08-13-app-materials.md` | `f8405cf` | 文档→实施: 本期差异逐项对照iOS NativeSpeechController opt-in与ConnectionStore.delete/Keychain调用，以及PG01B remoteSurface关闭。发现官网隐私中英文仍将手机转写/令牌配对写成现役且称只由电脑外发，已按披露矩阵修正本地页面；两页headless渲染人工查看无截断、pageErrors为空，未部署/未提审。 实施→文档: f8405cf 本期修正有源码/官方引用支持，历史原文保留时点边界。新增页面同步不代表官网已部署。 |
| `docs/release/2026-08-13-store-submission-status.md` | `f8405cf` | 文档→实施: 两处豁免判断更正合理：本次实际读取Google官方14151465，个人账号创建日期门槛2023-11-13之后、适用者12人连续14天，另有应用发布/无横幅不能推出豁免。未登录当前Console，不确认本账号适用性。 实施→文档: f8405cf 本期修正有源码/官方引用支持，历史原文保留时点边界。新增页面同步不代表官网已部署。 |
| `docs/release/data-disclosure-matrix.md` | `f8405cf` | 文档→实施: 当前源码差异四项与iOS识别请求requiresOnDeviceRecognition、显式opt-in、删除Keychain及远程关闭一致；Apple DTS历史说明支持不保证卸载清钥匙串，不能当当前设备清除实测。已同步隐私页缺口。 实施→文档: f8405cf 本期修正有源码/官方引用支持，历史原文保留时点边界。新增页面同步不代表官网已部署。 |
| `docs/review/2026-08-13-mobile-gap-audit.fable.md` | `f8405cf` | f8405cf 增补历史边界,与现役 remoteSurface HTTP/WS 拒绝一致;历史建议不构成重开授权,无需照旧恢复入口。 |
| `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md` | `f8405cf` | f8405cf 远程关闭边界与实际守卫一致;5+5+4+3+2+0=19,不凭声称20补造材料;历史外部政策未升级现行结论。 |
| `docs/review/2026-08-14-saydo-phase-gap-analysis.md` | `f8405cf` | 文档→实施: 新增证据限定纠正not_run不能推数据库/所有使用数据为零；旧移动与排程不覆盖现役remoteSurface/PLAN2，未制造价值统计。 实施→文档: f8405cf 对该历史文档的本期增量已逐项对照；历史测试/诊断不自动升级本候选验收。 |
| `docs/review/2026-08-16-now-vs-later.md` | `f8405cf` | f8405cf 唯一增补历史边界,现役守卫确实拒绝远程业务;保留旧Chromium证据但不作为本候选真机通过。 |
| `docs/review/2026-08-16-remote-mobile-w0-impl-readback.fable.md` | `f8405cf` | f8405cf 唯一增补历史边界,现役守卫确实拒绝远程业务;保留旧Chromium证据但不作为本候选真机通过。 |
| `docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md` | `f8405cf` | 文档→实施: 新增注记区分未复核finding与路线判断，实际owner签署1/2/6/7四项已核；不以轮数/规模推方法必不收敛。 实施→文档: f8405cf 对该历史文档的本期增量已逐项对照；历史测试/诊断不自动升级本候选验收。 |
| `docs/review/2026-08-24-decision-2-impact-analysis.md` | `f8405cf` | 文档→实施: 本期两处注记将接口预留、成本估计、initialize样本与生产Gate/逐工具审批/TCK分开；对齐已签ACP方向与当前隔离AppServer研究，不将实验接入主执行平面。 实施→文档: f8405cf 对该历史文档的本期增量已逐项对照；历史测试/诊断不自动升级本候选验收。 |
| `docs/review/2026-08-25-agent-cli-acp-capability-survey.md` | `f8405cf` | 文档→实施: 新增历史限定对应原方法仅initialize，不能作为11品牌全链能力证明；不更新厂商现势能力，不据共用JSON-RPC断言同成本/通用driver。 实施→文档: f8405cf 对该历史文档的本期增量已逐项对照；历史测试/诊断不自动升级本候选验收。 |
| `docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md` | `f8405cf` | 文档→实施: 逐项核新增勘误：Node rm线性退避累计46500ms算术正确；单独重跑不能证明无并发缺陷；wait signaled后259按真实退出码，源码对应。发现SC51仍写在途已追加延期时点说明，同时修正runtimeChildRegistry旧live注释；Windows native SC51两次RED另已提owner问题，未施工。 实施→文档: f8405cf 对该历史文档的本期增量已逐项对照；历史测试/诊断不自动升级本候选验收。 |
| `docs/review/2026-09-01-pg-01a-night-readback-3-ordinal4.fable.md` | `f8405cf` | 文档→实施: 本期数量勘误31 roots减中英文两个roots=29，五条残留不等于五个roots；保留旧report/日志摘要，不增添当前验收覆盖。 实施→文档: f8405cf 对该历史文档的本期增量已逐项对照；历史测试/诊断不自动升级本候选验收。 |
| `docs/review/2026-09-02-monthly-docs-commit-crosscheck.md` | `f8405cf` | 本期仅新增统计勘误；696+198=894，与1071差177，保留未知，不伪造历史全量排除。 |
| `docs/review/2026-09-12-handoff-attachment-absorption.md` | `f8405cf` | 73行历史入口与后续JOURNEY/SC归属核对；入库头限定历史，旧HF只ok与占位能力不覆盖当前合同。 |
| `docs/review/2026-09-13-consolidation-crosscheck-IMPL-PROMPT.md` | `f8405cf` | 121行历史接续全文核对；不执行旧prompt、不继承两reviewer/旧目录/额度；当前处置指向SC证据，旧RED保留。 |
| `docs/review/2026-09-13-consolidation-crosscheck.md` | `f8405cf` | 367行历史报告全文核对；SC01-59归属/原反例与后续SC证据对照；SC51/54/shell延期不改绿，旧388/396不是本期审计覆盖。 |
| `docs/site/README.md` | `f8405cf` | 本期增加事实面更新不等于验收/上线的说明，与源稿和静态HTML改动一致；本轮修改未部署。 |
| `history/DEV-VERSION-LEDGER.md` | `f8405cf` | f8405cf 唯一新增公开边界;publish-public-snapshot.sh真实排除artifacts/release/copyright并执行privacy门,不是全部过程资料私有的承诺。旧rc12通过不迁移为当前验收。 |
| `prompts/2026-09-05-pg-01b-owner-recovery-review.md` | `f8405cf` | 期间新增历史更正已与归档报告§6/6.1逐项核对：包装入口实际执行全量38项并checkout tracked截图；原prompt禁止与要求冲突被如实保留，不把包装命令称未运行或纯只读。 |
| `research/codex-findings/2026-08-25-rc4-windows-tier1-selfkill-rootcause.md` | `f8405cf` | 本期注记的wait signaled+259实际退出码与runtimeChildRegistry实现一致；发现“独立回修中”过时，本候选追加DF-SC51延期/旧两次RED说明，未重写历史Windows实机记录。 |
| `research/codex-findings/2026-09-05-pg-01b-owner-recovery-review.md` | `f8405cf` | 期间新增历史更正与§6/6.1的38 passed及tracked截图恢复吻合，旧GREEN不替代当前独立验收。 |
| `research/codex-findings/82-w54a-claude-cli-review.md` | `f8405cf` | f8405cf 唯一新增join/resolve勘误;本次Node实际重算join=/example/home/foo、resolve=/foo吻合,不撤销其它独立finding。 |
| `research/codex-findings/84-w54a-claude-cli-review-2.md` | `f8405cf` | f8405cf 唯一新增join/resolve勘误;本次Node实际重算吻合,历史评审与当前验收区分正确。 |
| `research/codex-findings/85-w54a-claude-cli-review-3.md` | `f8405cf` | f8405cf 唯一新增join/resolve勘误;本次Node实际重算吻合,不以旧错误理由推导新bug。 |
| `research/codex-findings/87-status-alignment-post-implementation-triage.md` | `f8405cf` | 本期B4→B5勘误已对原87-codex报告B-1至B-5标题核实；旧阶段性云端/隐私说明另在当前website/canonical审计修正。 |
| `research/monthly-audit-2026-08/README.md` | `f8405cf` | 逐份核对9线计数:2/2/5,1/7/5,2/3/4,1/2/7,1/5/6,2/2/3,2/5/3,5/2/4,1/3/5;加总17/31/42吻合新增勘误,未去重不能算独有发现。 |
| `research/monthly-audit-2026-08/audit-line2-daemon.md` | `f8405cf` | 本期更正rc12发布物为Desktop CLI，与发布workflow资产形状、版本矩阵及后续rc13下载实测吻合；历史daemon门不提升为当前全量通过。 |
| `research/monthly-audit-2026-08/audit-line4-mobile.md` | `f8405cf` | 本期更正删除tracked脚本造成manifest exact-set漂移，并非无害；已核scripts/week-audit.mjs capturePublicationManifest真实tracked集合及audit-line6原始失败记录。 |
| `research/monthly-audit-2026-08/audit-line6-evidence.md` | `f8405cf` | 期间更正最后重生成c383bc0/随后9a3e180漂移已核Git文件集：前者改manifest+bundle，后者删除tracked安装器并改justfile/package，未重生成。6316f7d确含交叉复审修正；历史RED保留。 |
| `research/monthly-audit-2026-08/audit-line8-corpus.md` | `f8405cf` | 期间authority历史值更正与现有两份dry-run投影e62d2115一致；validate.mjs明确986条unresolved非connector readiness且核全源摘要。未将validator绿升级真实连接器验收；authority重算将随完整门验证。 |
| `research/monthly-audit-2026-08/audit-line9-misc.md` | `f8405cf` | 本期11→10 merge勘误逐hash git rev-list --parents核实：列举10个均双亲，f28489d单亲，历史批次归属结论未扩大。 |
| `e2e/evidence/sc-reland-01.md` | `d023ffc` | 处置表/历轮回修/反例表/最终历史门逐项核验；26原日志大小/hash已逐一复算，四项P2已追加勘误。保留SC51/54/shell延期和native未验。 |

## 检查点18新增范围裁决

当前已授权具名服务/DAO补证沿 `drafter.chat` 触及模型运行期,不能把返回provider时的工厂构造当作chat执行。已绑定两个真实工厂并保留 fallback dialog;真实动作出现此前漏记的 `provider.observed_model_exemption`、`byoa.invocation`、`byoa.subscription_accounting_failed` 写点。

剩余27种调用证明缺口中含 provider/runner 回调、AbortSignal/流/子进程原生边界、`OwnedWindowsProcess.waitForExit/readExitCode/disposeStdio`。后一组越过当前两棵产品树,进入 `packages/platform/src`;既有 source_binding 恰好固定daemon/console两树,仅凭OwnedWindowsProcess类型豁免会漏掉平台实现变化,不可采用。

建议有限延伸:只补上述现役API/BYOA运行期回调和已点名的原生接口来源;平台实际读取文件增加cited_blobs逐blob绑定,不增加通用调用图、不改生产执行路线、不调用模型或真机、不增加原3/3修复复审预算。新增平台边界尚未实施,待owner裁决。若不扩此范围,PG-02保持RED且不能随main合入;其余审计修复可独立完成,不得伪称全部交付。依据AGENTS.md“战略与范围:上浮 owner”。
