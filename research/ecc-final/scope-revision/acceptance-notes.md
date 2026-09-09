# ECC 范围修订：本轮授权与有限验收

用户明确授权：按 supervisor 上一条建议调整两项目文档和 Prompt。本轮只修订已有文档，不实施未来产品任务。保留唯一 final 文件名、研究证据和历史评审；不另造一套并列方案。

本轮实施在本隔离包中进行，原工作区只在验收后由 supervisor 按文件合并。根下 SayDo 与 ContextView 是 detached clone；ECC 是旧调研 SHA 的只读引用。control/source-manifest.json 列真实来源 HEAD 和唯一允许修改的 9 个文件。除此之外全部只读。不能改 canonical、产品代码、测试、acceptance、排产指针、旧 Fable/Astra 归档、旧评审报告、journal 或任何工作流控制文件；不能 commit/push/install。未来 prompt 的产品写入指令是文档内容，本轮绝不能执行。

先完整阅读 4 份 final/prompt、统一研究维护源、三个索引。相关事实核对本地源码，不需要再次互联网调查或重审 ECC。对既有文档做聚焦改动，保留仍适用的证据、稳定 AS/AC/E ID 和机制解释。

## A1 — SayDo 保留完整保护边界、减少共享建设

本轮未来第一批仍为 AS-01/AS-02，但是收窄为凭据写前拒绝 + 私有生成物 Git 保护。窄规则与 TTS 分离，不按 env 引用、digest、路径、业务 ID 或泛长串拦截；覆盖 ledger.add/supersedes、remember、foundation 首次 raw staging 之前全部实际输入（包括现场读取 .cursor/rules、package scripts、justfile）；不能用 user_stated/requestedTrust 豁免。命中只拒这次写入或这次新 generation，保留旧 generation/status/current.json，不写 partial 新版，不阻止项目登记或其它对话。

新增 knowledgeShare enabled/allowlist、strict projectOverridesSchema 共享字段、共享设置 UI 全部延期，不是本轮验收。不是停掉 Git 防护，也不能通过删除共享开关顺手改成整个 .saydo 全目录一律封禁。先核对 docs/03 的既有共享约定和当时实际代码；把新能力未来分期写清，现有用户文件不覆盖、不自动取消既有人工共享配置。当前不能安全生成到已跟踪/未保护目标时，保留用户数据与配置，只停本次受影响私有投影并给处方；不能把已有共享文件无条件当作安全豁免。本批不新增 DDL/设置页或 projectOverrides 字段来承载延期能力。未来真正存在合法共享消费者时单独设计。

Git 要支持非 Git、worktree .git 文件、等价 ignore、tracked 检查、根外 symlink、写失败；create-only 不覆盖既有文件。转写/token 不因此落工作区。上线回退保留保护与旧有效数据，不回放 rejected 内容、不自动 git rm 或清理历史。

## A2 — SayDo 恢复能力与长期成本成为正反验收

这部分和保护一起交付，不单独建设管理产品：明确区分单条记忆未保存、更新失败仍用旧有效知识、首次构建失败暂无底座。新鲜度不得静默伪装成成功。复用既有错误/通知/项目详情与重试更新入口，不新建通知中心、持久化遥测平台或新 blocked 状态。

现有界面给安全的来源定位、原因分类和具体恢复动作，禁止回显命中原文。审计/日志仍仅保留允许的 kind/digest；定位信息如相对来源和行号必须是脱敏且仅给现有可视界面的安全元数据，不能直接把完整路径送 TTS 或把敏感片段写日志。同一未解决问题避免反复通知，选用现有去重能力；若没有，只做本次流程内最小去重，不建设跨服务状态。

修复源文件或 Git 保护后，走既有 refresh/retry 可以发布新一代；无需重装、无需关闭保护或自动删除用户文件。常见明确占位符可过；格式与真实凭据相同的假 token 不承诺可以准确区分。添加可判定正反例：三类失败区分，旧知识仍可用但明确未更新，首次没有旧知识不假称保留成功，恢复后实际更新，同一问题不重复轰炸，source metadata 脱敏，合法引用不误拦。扫描/Git 查询绑定相关写入/构建边界，不无条件在每轮对话全量扫描。使用定向测量说明开销，不编造毫秒/收益比例或增加持续上报。

## A3 — ContextView 取消独立全量 intake，按消费者并入既有 WP

AC-01 正式资产源登记、AC-02 新增完整字段线索队列、AC-04 ECC 专门事件差异样例均延期。保留统一研究已有静态线索、来源 SHA 与裁决，不另维护一份重复台账，也不承诺定期追踪所有 ECC release。AC-06 仓库级 Unicode gate 移出本 ECC 批，随既有输入规范校验另评；不删除已有任何产品检测器。AC-03 安装/发现/生效诚实边界作为已有 collect/resolve 功能验收；AC-07 原生 file ID+volume 无损约束并入既有文件系统工作，已有覆盖则不重复改；AC-05 只补当前检测器能够消费、实际未覆盖且可达的少量合成正反例，遵守 Apache-2.0/digest/live_tested=false 和既有 8+12 规则族。不能为保留所有 AC 而重建独立完整批。

每个实际实施项要给出当前消费代码/入口、真实缺口、用户可见变化、已有覆盖情况和后续维护归属；没有消费者就保持 research-only/未触发，允许有证据的 no-change 收口，不能为了填表新建消费者、登记源、冻结 revision 或扩大整个 WP。

未来 ContextView prompt 应成为“在既有已授权工作包内吸收最小必要改进”的入口。启动先读取当时 HEAD、WP 合同与实际消费代码，形成有限 eligibility 清单（AC-03/05/07 逐条适用/已覆盖/未触发）。仅实施符合条件且在已有授权范围内的部分；不让用户重新进行开放式比较，不把未触发当失败。没有合格项就交付证据和触发条件，不启动语义施工。已有活动 cycle 不得静默修改冻结 acceptance/预算；选择正常下一候选/尚未冻结阶段且实际合同允许的范围；无权开启新的产品工作包。复用对应 WP 的合同、candidate 与评审，不加一套全量 ECC contract+implementation 双阶段。新的字段/合同变更确有需要时仍遵守项目 canonical-first 与既有设计/实现分离，不以减少流程为由略过必要 review。未完成并行工作不假称已验收，不回滚他人工作。

不能只是增加一段免责声明，后文却继续自动登记 ECC、生成全量队列、加 Unicode gate、开 AC-01..07 双阶段，或预定义 ecc-docs-intake 专用 stage/ledger。保留实际修改时生成器优先/重生成/重冻结/当前九门+相关 parity 的要求，但这些必须是条件性的，不能让无修改路径也改 freeze。

## A4 — 两份 Prompt 可执行且无旧范围残留

同步标题、入口、前置、红线、阶段表、写集、coverage 正反例、交付物、停止条件、工作方式、P2 位置。SayDo 保留必要的统一设计后统一实现两阶段，恢复纳入两阶段同一范围，不新增第三阶段；共享设置/schema 不再强制。ContextView 改用对应已授权 WP 的范围/控制目录/唯一 ledger，避免旧独立 intake 自动串联。保持原工作流机械 API 的正确性，唯一 workflow-v2 与 roles 和 control/CONTRACT.md 相同；新 cycle live、活动 cycle frozen，Grok grok-4.6/xhigh 实施、fresh Codex gpt-5.6-sol/max review，同一时刻一个语义子会话，3/3 预算不降。不新增流程框架或改全局脚本。未授权 commit/push/install/live 不做；这次只改文档。

## A5 — 研究、索引、历史证据一致

统一研究只调整当前建议/范围章节及状态归属，ECC 本体机制事实与 E-01..E-110 登记、118 条旧证据 ID、12 条历史测试原记录保留。研究源和镜像逐字节一致。三个索引的当前入口描述与修订后范围一致，旧来源明确历史，不改归档原文。四主文件与两研究的顶部/尾部不能让上一版 R3/R4 GREEN 和十二门被误认成新范围已评审；保留历史结果并限定为“上一版历史证据”。本轮不预填新的 GREEN/PASS；写“范围修订，独立评审结果见本仓交付记录”即可，supervisor 在独立 review 与 gates 后追加实际证据。

## A6 — 最小变更、便携与可核验交付

仅 9 个允许文件发生改变；索引非 ECC 行原样，canonical/产品/排产/旧研究证据不变。Markdown 链接可解析、不含私人家目录/secret/emoji，两个未来 prompt 均通过真实 validate_handoff。保留稳定 ID，在 ContextView 映射附录中显式说明技术裁决不是本次排产；涉及延期项的当前状态不能仍暗示马上登记/生成。每个项目补紧凑的实际回报/持续维护与用户成本/触发条件，不能编造量化收益。

可做 focused 自检：9 文件 diff、镜像一致、范围相关文本检索、两个 validate_handoff。全量冻结门禁由 supervisor 在独立 review 后执行。本轮不运行未来 prompt、不建新测试、不再次深入调研其它项目。
