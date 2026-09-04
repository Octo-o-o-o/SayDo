# SayDo 本地遗留工作收敛独立替代复审

你是全新、零上下文、只读 reviewer。仓库是当前目录。不得读取此前 reviewer 报告或事件日志；不得修改产品、commit、push、merge、删除目录或启动服务。报告由外层 `codex -o` 保存。

先完整读取仓内 `AGENTS.md` 与 impl-review 技能，再独立核验：

- task=`saydo-local-convergence`;stage=`pending-local-work`;cycle=`initial`;review ordinal=`1`;scope=`workflow-final`
- HEAD=`5cf1cabb2feea2508a4724082a408c7b734e81e2`
- parent=`a4f1a0618fdbb7c4a8eb7178429cd9b08a8b92d8`
- git-diff-v1=`e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`
- frozen acceptance=`<supervisor-control>/frozen/acceptance.frozen.json`
- implementation handoff=`<supervisor-control>/implementation-handoff.md`
- unique P2 ledger=`<supervisor-control>/DEFERRED-P2.md`

前一程序性尝试因 Codex `-s read-only` 禁止 OS `mkdtemp` 而无效，不是产品 RED；不要读取其报告。supervisor 已在同一冻结 candidate、可写 OS 临时目录的普通测试环境运行原七项 focused gate。证据文件：

- `<supervisor-control>/focused-supervisor.log`
- `<supervisor-control>/focused-supervisor.summary.json`
- 预期 log SHA-256=`2d1a561b1740d8da544c7bc32da9b4c6156c7c1c70e6942271f9c452006e2c6a`

你必须独立重算 summary/log SHA、核对 summary exit=0，并读日志逐项确认七项原命令的成功尾行。只读沙箱内不要重跑会 `mkdtemp` 的两条 suite；可运行不写文件的 Git、静态检查和独立内存探针。该 supervisor gate 证据可以作为本会话实际读取并校验的 frozen-candidate 门禁证据。

逐项审查：

1. 提交 exact path、parent/tree/fingerprint、干净工作树。
2. Tailcat 文档与 D13、T2/T3、安全边界一致；未实施 spike 不得伪装现状；不得有本机绝对路径。
3. 安装测试三组 mutation 是否真实改变输入并判红；原 18 项/dynamic no-write 不削弱；installer 不变且 `SAYDO_INSTALL_ALLOW_OUTSIDE_HOME` 保留。
4. 只读比较旧 clone `<legacy-clone>` 的两个 dirty scanner 文件与现役 checker。只有当前 canonical/正式入口/声明 grammar 可达的失败才是 P0/P1；旧 occurrence-selector sibling 不可达则记录 P2/deferred，不得要求整文件覆盖。
5. 固定 anti-bypass：新增 `fromCharCode`、`eslint-disable`、`@ts-ignore`、`.skip`、`.only` 与 no-op mutation。

报告写清逐项证据、门禁日志复核、P0/P1、完整 P2 delta，并在末尾给唯一 `review-manifest`。不要输出可执行命令字段。GREEN 必须 blockers=[]、focused gates exit 0、stop_reason=null。

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```

```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"codex","model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"max"},"supervisor":{"model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"xhigh"}}
```
