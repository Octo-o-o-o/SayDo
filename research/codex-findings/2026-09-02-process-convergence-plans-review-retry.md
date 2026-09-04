[fail] 两份方案的职责边界总体清晰，但 SayDo 有三处阻断，OctoWorkFlow 有一处控制面纪律冲突；A4/B5/C0。

## SayDo 方案

| id | 级别 | 位置 | 复现命令 | 实际结果 | 修改建议 |
|---|---|---|---|---|---|
| SD-A1 | A | `方案:6,86-88`；`PLAN-2:10,20`；`program:1447-1472` | `rg -n -e '不占 active/next' -e '不适用' -e '不得保留第二个 active/next' -e 'HANDOFF 在 I 中' -e 'HANDOFF 改成' docs/plan/2026-09-02-process-convergence-plan.fable.md docs/plan/IMPLEMENTATION-PLAN-2.md docs/plan/2026-08-28-project-gap-closure-program.md` | `PROC-01` 修改脚本、门禁和 workflow，却在施工期间保持 `active=none,next=PG-01B`，并显式豁免 §20.2 第 4、7 条；这不是 PG-00 那种纯排产导入文档批。现势指针会漏掉一个真实活动代码批。 | 把 `PROC-01` 正式导入唯一串行链并执行标准 I/E 指针转换；若坚持不占指针，则范围必须收缩为纯文档，不能修改可执行工具和门禁。 |
| SD-A2 | A | `方案:92,103`；`program:1473,1509-1513` | `rg -n -e 'next_parent' -e 'E 不写自身 SHA' -e 'P = PROC-01 的 E' docs/plan/2026-09-02-process-convergence-plan.fable.md docs/plan/2026-08-28-project-gap-closure-program.md` | 方案要求在 PLAN-2 的 E 内容中写入该 E 的完整 OID；但 E 的 OID取决于包含该字段的 tree，构成不可实现的自引用，并直接违反“E 不写自身 SHA”。 | 删除 `next_parent` 的自 OID；PG-01B 开批时再从已存在的 PROC-01 E 读取完整 OID，写入 PG-01B 的 prompt/evidence。 |
| SD-A3 | A | `方案:92,97,104` | `ls -l scripts/check-schedule-state.mjs`；`ls -l scripts/test-gate-list-parity.mjs`；`rg -n -e 'check-schedule-state' -e 'check-gate-list-parity' -e 'test-gate-list-parity' docs/plan/2026-09-02-process-convergence-plan.fable.md` | 两次 `ls` 都 exit 1。P1 计划新增的是 `schedule-pointer.mjs`，E 门却调用只出现一次且未规划实现的 `check-schedule-state.mjs`；PG-02 又准备退役错误名称 `test-gate-list-parity.mjs`。 | E 门统一写成 `node scripts/schedule-pointer.mjs --check`；退役对象改为 `scripts/check-gate-list-parity.mjs`。 |
| SD-B1 | B | `方案:88,92-96` | `rg -n -e '临时副本' -e 'YAML 解析器' -e '一致性 subagent' -e 'focused gate' docs/plan/2026-09-02-process-convergence-plan.fable.md` | P1 四个反例没有具体 argv；P3 未指定 YAML 解析命令；P4 的核心一致性断言只有人工评审，现有 focused gate 不能单独判定该断言。 | 给每个验收项绑定确切命令、输入 fixture、预期 exit；明确 YAML parser 命令，并为 P1 四个反例提供一个可重复调用的测试入口。 |

## OctoWorkFlow 方案

| id | 级别 | 位置 | 复现命令 | 实际结果 | 修改建议 |
|---|---|---|---|---|---|
| OW-A1 | A | `方案:6,67`；`cycle-state.md:12,55`；`project-profile-template.md:7` | `rg -n -e 'repo 相对路径' -e '拷到另一路径' -e '不得只按 basename' -e '不新增 policy revision' -e '升级共享规则' docs/2026-09-02-workflow-v2-outcome-lifecycle-plan.fable.md workflow/cycle-state.md workflow/project-profile-template.md` | 现行纪律要求绑定原 control 根目录并拒绝复制；方案仅记录 repo 相对路径时，把 control 复制到另一 clone/worktree 的相同相对位置即可满足该字段。方案也未安排更新 `cycle-state.md` 或升 revision，同一 2.4.2 因工具版本不同会出现两种绑定语义。 | 保留相对路径时再绑定不可回显的 canonical-root digest，并增加跨 clone 复制必败用例；同步修改 canonical。若要改变“不可复制”不变量，应升 policy revision，旧冻结周期继续走旧语义。 |
| OW-B1 | B | `方案:83,105`；`install.sh:3,9,16-22` | `rg -n -e '用法' -e 'TARGET=' -e '--doctor' -e '--prune-backups' -e '收据不变' scripts/install.sh docs/2026-09-02-workflow-v2-outcome-lifecycle-plan.fable.md` | 当前 CLI 只有一个 host 位置参数。方案未定义新 flag 与 host 的组合顺序，也未定义 doctor 各状态的 exit code；因此发布门中的“`--doctor` 输出干净”不是可直接判定的门。 | 冻结完整 CLI grammar、receipt schema/version、digest 算法及 doctor exit 合同；明确幂等安装保留原时间字段，并加入中途失败后 doctor 必须非零的验收。 |
| OW-B2 | B | `方案:6,95`；`v2-policy.json:81-99`；`supervised-delivery.md:61,84`；`project-profile-template.md:7,52-54`；`README.md:68` | `rg -n -e 'roles' -e 'pinned_policy_revision' -e '冻结 policy' -e '~/.octoworkflow/v2-policy.json' workflow/v2-policy.json workflow/supervised-delivery.md workflow/project-profile-template.md README.md docs/2026-09-02-workflow-v2-outcome-lifecycle-plan.fable.md` | 阶段 D 让入口始终指向 live `~/.octoworkflow/v2-policy.json#roles`，而当前 roles 属于 policy 字节，活动 cycle 又要求使用冻结 policy。安装新版后，旧 cycle 的角色来源没有被明确钉住。 | 明确活动 cycle 从其 `policy.frozen.json#roles` 取值；仅新 cycle 使用 live/local profile。增加“live policy 改角色但旧 cycle 仍取冻结角色”的反例。 |
| OW-B3 | B | `方案:61,67-105` | `rg -n -e '阶段 [A-E]' -e 'test_.*\\.py' -e 'bash -n' -e 'YAML 由 CI' -e '全部 .*workflow/tests' -e '阶段 E' docs/2026-09-02-workflow-v2-outcome-lifecycle-plan.fable.md` | 多个 focused gate 是裸文件名、无目标的 `bash -n`/`shellcheck` 或“YAML 由 CI 验证”；阶段 E 完全没有验收与 gate，与“五个阶段、每阶段独立验收”冲突。 | 每阶段列出可复制执行的完整 argv 和预期 exit；阶段 E 即使在 SayDo 施工，也应写明消费方命令、前置版本和判定结果。 |

## 分工与同质化

- [pass] `方案:140-150` 与 OctoWorkFlow `方案:108-116` 的主体分工一致：OctoWorkFlow 维护通用 policy、状态机、validator、fingerprint 和 telemetry；SayDo 只消费，并自管排产、产品门禁、发布坐标和隐私探针。未发现把 SayDo 扩成跨仓流程平台或把 OctoWorkFlow扩成常驻产品的条目。

- X-B1，B，SayDo `方案:93,145`；OctoWorkFlow `方案:69,87-99,113`。复现：`rg -n 'report_conventions' workflow/supervised-delivery.md workflow/project-profile-template.md README.md`，实际 exit 1；当前没有消费者。OctoWorkFlow 阶段 A 只增加字段，直到阶段 D 才让 skills 消费，而 SayDo P2 可先删除 AGENTS 中的现行约定，形成落地顺序窗口。建议让 SayDo P2 显式依赖阶段 D 已安装，或在此前保留 AGENTS 的项目覆盖规则。

## 未核验项

- 按要求未重新核验两份方案 §1 的事实与数字。
- 未运行任何测试、`just ci`、`check.sh` 或写操作；脚本和测试只以 `ls`、`rg` 核验存在性。
- 未展开产品代码、journal 或历史评审。
- D17 §4.2 不在允许参照文件中，因此“语义不变”未独立核验。
- 两仓 HEAD 已用 `git log -1` 核对为 SayDo `b32e878adc7b...`、OctoWorkFlow `0b93139c7ce9...`。