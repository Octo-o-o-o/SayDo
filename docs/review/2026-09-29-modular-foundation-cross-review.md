# SayDo 模块化底座方案与实施 Prompt 交叉评审

日期:2026-09-29。类型:一次只读方案/执行指令交叉评审,不是产品验收。范围:decision.md v2 与 implementation-prompt-draft.md,定向核对隔离 checkout 的 AGENTS、canonical、PLAN-2、project-profile 及本机现行 workflow。未运行产品测试,未执行被评材料中的命令,未修改仓库或主树,未派发其他 agent。本文是本次唯一原始报告。

> 脱敏投影注(2026-09-29 repair-1):本文是仓外原件的脱敏投影——内容逐字保留,
> 仅把本机 home 前缀按 `scripts/public-text-redaction.mjs` home-macos 规则转为 `~`。
> 原件:`~/.codex/worktrees/saydo-foundation-plan/SayDo/docs/review/2026-09-29-modular-foundation-cross-review.md`
> (只读交接 worktree,不入本仓 Git);原件 SHA-256
> `71568ff98bdf5aade2f3490b0ea9cfbca478da010db72aa934053294827b7999`。

## 结论

存在 1 项阻塞实施 prompt 定稿的流程可执行性问题,未发现需要扩大架构范围的新实质安全缺口。架构、RF 全量覆盖和本地候选/外部发布边界可以保留;先补齐具名任务预算与检查点安排,再作为可连续自主实施的指令交付。这里的“阻塞”针对 prompt 的自洽性,不表示产品已复现 bug,也不表示任何产品门禁通过。

## B1 [P1] 全量分阶段独立评审与唯一 task 默认预算不相容

位置:
- implementation-prompt-draft.md:31–35 要求逐 candidate 独立 reviewer、唯一 task.json、现行 policy 累计预算,且禁止换 RF/候选/task 清零。
- implementation-prompt-draft.md:43 要求必要 PG-02→03→04→05→06 完成前置后推进 RF;:89 希望只有全部路径真正受阻才集中停下。
- ~/.octoworkflow/policy.json:100–105 当前 max_rereview_rounds=3、max_repair_rounds=3、max_procedure_retries=2。
- ~/.octoworkflow/delivery-schema.md:24 首个 review 以外的 review/rereview 全计复审;:35 检查点后续评审仍进入原预算。
- ~/.octoworkflow/check_delivery.py:939–941 实际代码为 rereviews = 显式 rereview + initial_reviews[1:],不是文档含混或只计算失败复审。
- 隔离 checkout AGENTS.md:30–38 要求 candidate 独立评审与冻结;PLAN-2:232、244、256、268 是五个 PG 依次依赖前批 evidence commit 的串行链。

理由:
单一 task 默认最多容纳 4 次独立评审,包括正常完成检查点后对新 candidate 的首评。按 PG 五批分别闭环就已超过该上限,还没有覆盖后续 RF 和总集成;即使零缺陷也会到达预算停点。设计阶段还另有互补双视角要求。当前 prompt 只说“按实际阶段合同安排独立评审”,未给出在限额内满足 required review 的可执行拓扑,也没有具名的本任务预算覆盖。这不是要求无限回修,而是正常成功路径的必要评审席位未配置。若宿主把新阶段首评错误当免费,则会被现行 checker 拒绝;若遵守预算,全量自主范围会过早阻塞。

最小修订:
在最终 prompt 明确授权且预先冻结“本任务”的有限预算与 checkpoint 表,不改全局 policy、不迁移或清零旧任务。选定必须独立收口的 PG/RF 检查点以及最终评审,令 max_rereview_rounds 至少覆盖全部正常评审数减一,再加具名、有限的修复复审余量;修复轮次/程序重试仍分别有界,同因上限保留。依据实际角色和现行 schema 冻结 effective_limits,并说明这一任务级覆盖优先于“所有预算直接取默认 policy”的原句。不得启动后倒填 checkpoint。若不愿采用任务级预算覆盖,则须给出能在 4 次评审内完成且不跳过既有 required 的明确合批依据,不能只写“适度合并评审”。数值由宿主在终稿给出并随用户采纳生效,本报告不替 owner 自动扩额。

## 四维核查结果

### A. 架构、安全、恢复、幂等、事件与语音

未发现新增阻塞。decision.md:79–86 区分服务端身份、效果分类、收据消费与唯一 durable owner;取消/拒绝不误套新派发门。:96–100 具备持久事件发布边界、游标隔离和同键异载荷检测,unknown 不自动重执行。:155–159 对旧制品安全下限、活进程、旧授权及撤销对账的补充能够约束后续合同落地,未将 DB 回滚说成撤销外部副作用。:126 的 P50/P90/样本分母口径与 docs/03-architecture.md:64 一致。上述仍是设计要求,下一会话必须先转 canonical 并评审,不能把文字存在当实现证据。

### B. RF 全量范围与 PG 依赖

除 B1 流程预算外未发现新增阻塞。decision.md:136–147 列出 RF-00 至 RF-11 完整范围;prompt:41–60 明确全量清单分母、PG 前置、全路由/Web 覆盖,不以 RF-02 样板替代后续全量。框架候选允许“不采用+证据”,required 能力不允许改为不适用。PG 现役 RED、未合并候选和活调用需现场对账,此处没有替这些项目解除门禁。

### C. 授权、监督交付、owner-stop 与当前 policy

B1 为唯一阻塞。其余边界基本自洽:prompt:3 要求用户把全文作为当次指令提交才启动;:17 限定隔离 worktree、本地提交与候选,禁止 push/main 合入/发布/常驻部署;:27 明确采纳后通过 schema/validator/PLAN-2/HANDOFF 正式导入新串行链,不凭注释绕过旧 owner-stop;:33 对实际缺失的 v2-policy 给出本任务 v3 具名例外,并保留 required gates 与真人/发布 checkpoint。此次只读检查确认 v2-policy.json 不存在,policy.json 是 workflow=v3;启动时仍须现场复核。prompt:89 的“无普通中途确认”不覆盖安全/权限/设备/预算硬阻塞,这是诚实边界,无需删掉。

### D. 开源、平台、制品与贡献者终态

未发现新增阻塞。decision.md:167–170 保留 snapshot/public-tree/filter-version、exact-set 与来源绑定,要求本地工具合同改造而非删除检查器。prompt:23–25 不缩减既有正式支持、不自动扩张支持、不让治理法律草案对外生效。:78–89 区分托管 CI、provider、OS、模拟器/真机及真人维护者;AI 接手演练不冒充第二真人;required NOT_RUN 不能全量 GREEN。因本轮只允许本地候选,外部发布/第二真人/缺设备项可以保持明确未完成,不能变成“顶级开源已交付”的成功声明。

## 未核验与使用边界

本次未全量读取源码、未重新核验上游 release/依赖版本、未运行 just ci/Playwright/设备/provider/制品安装测试,不为历史 795 文件清单和版本数字重新背书。旧记忆只用于定位 PG-02/设备/真实服务的历史边界,结论以本次文件核对为据。交接包最终绝对路径/hash 需由宿主在定稿时固化;不要让新会话自行猜测哪份 final 是采纳对象。

## 被评输入校验和

- `decision.md`: 31544 bytes; SHA-256 `394e4e390b9c8e9ddd6593f34dd09b6dec67dcc698afab20dd3242f1d06ff205`
- `implementation-prompt-draft.md`: 10888 bytes; SHA-256 `bcd8e4ff75eacc88658f6b789c3d36bc5a24375dd7a7c09d39eea1af07d2b0d8`

## 宿主定稿修订建议的同轮裁决

宿主在本次评审中提出:仅新任务 effective_limits 具名覆盖为 max_rereview_rounds=15(总语义 review 上限 16)、max_repair_rounds=8、max_same_root_cause_repairs=2、max_procedure_retries=2、max_same_procedure_cause_retries=1;预先冻结合同/PG/集成检查点,不为每个 RF 人造 review 门,不修改全局或旧任务预算。合同单一版本由一名 fresh reviewer 同时核“契约/状态安全”和“跨端/可实施性”两个互补清单,不声称两名独立 reviewer。

裁决:这一有限且显式的任务级覆盖能够解除 B1 的正常成功路径预算矛盾。AGENTS.md:33 原文为“设计文档评审保留互补双视角”,没有强制两人;单 reviewer 的两个具名视角与每 candidate 仅一名 reviewer 可以并存。必要 PG 五次正常初评与最终集成评审仍全部累计;16 是上限,不凑满轮数,已有可复用证据只在现场验证适用后复用。设计版本评审仍受原 2 轮对抗/回修要求约束,不能用较大总上限自动开启第 3 轮。

落实时需注意:design-v2-if-repair 可以是预知的阶段标识,但 RED 后工作必须记 repair/rereview,不能凭预登记 checkpoint 伪装成免费 continue;只有真实检查点完成、整项 INCOMPLETE 且无 blocker 的结果才支持 continue。所有检查点须在启动前带 acceptance 冻结。宿主应在最终 prompt 明写这一来源优先级和计数口径。

这是对宿主明确修订方案的同轮条件性确认,没有重新派发 agent,也没有读到或核对尚未交付的最终文件;最终文件确实包含上述修订后,宿主可以据此将 B1 记为已修订,不能把本报告写成产品验收通过。
