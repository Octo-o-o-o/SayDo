# 20 · Tier1 执行器批 canonical 回写复核(补 19 撞号欠账)

> 运行:2026-07-26,`gpt-5.6-sol`/max/只读,42 分钟;prompt `prompts/20-executor-writeback.md`,日志 `logs/20-executor-writeback.log`。
> 评审快照:SayDo@`65559c2`(执行器批收口点;**不含**后续 W1 批提交)。
> triage:对账会话(2026-07-26,readback 报告 `research/2026-07-26-saydo-executor-impl-readback.fable.md`)。

**Codex 总判:A 必修,不能通过收口。** triage 后:2A 中 A1 成立(canonical 已改口,代码补偿控制登记 W 批)、A2 成立(本报告落盘即闭合);8B 中 6 成立登记、1 部分、1 已被 W1 清偿一半;3C 中 1 成立、1 已顺手修、1 证伪。**收口判定修正为:canonical 侧本轮已修,代码侧 3 项登记 W 批必修(A1 补偿控制/B2 配置校验/B3 后端拒绝),不阻塞场次①但场次②前应落。**

## triage 明细

| # | 级 | 发现 | 裁决 | 处置 |
|---|---|------|------|------|
| A1 | A | 09:745/05:67 断言 gate.sh 在"agent 不可写目录",实现无此保证:同 UID + cursor-agent 内置 write 工具不经 shell 门,可改写 gate.sh 洗审批(POST 撒谎命令,canary 计数不破) | **成立**(对账会话一手复核:hooks.json 仅挂 beforeShellExecution,adapter.ts:42-53;SENSITIVE_PATH_RE 只作用于 shell 命令分类) | canonical 已改口(09 §11 门完整性诚实口径 + 05 §4 同步);**代码补偿控制登记 W 批必修:daemon 每收 gate 请求重读 gate.sh 重算 digest,不符 cancel 全部活跃 run**;完整解(独立 UID/容器+写工具进门)P1,与 verify-HOME 同族 |
| A2 | A | 证据链声称"Codex 19"但 19 号文件/日志均不存在(被 plan2 评审占用),20 号无成果报告 | **成立**(对账会话此前已独立发现) | evidence 引述已改 20(被 W1 收编 `8f77e0b`);本报告落盘 + journal R47 修正,即闭合 |
| B1 | B | 09 §9 状态表缺 `reserved → cancel_requested → cancel_settled` 边(供给失败/启动前取消,实现既有) | **成立**(finalizeFailure reserved 分支 + requestCancel 含 reserved) | 09 §9 已补录(本轮) |
| B2 | B | [tier1] 校验松:版本断言 `includes()`、无文件存在/可执行/versions 形态校验、validateConfig 未接入启动、缺 §12-9 反例矩阵 | **成立** | 登记 W 批:集中 `validateTier1Config()` + 正反例 |
| B3 | B | 配置 `agent="claude_code"` 时仍起 cursor 二进制、runs.adapter 记错、steerApplied 谎报 live | **成立**(realAgentSpawner 固定 cursor 参数) | 登记 W 批:未实现后端启动即拒(fail-closed),canonical 三后端标 deferred |
| B4 | B | "比 spike 轮询决策文件更直接,语义同"过度声称——spike DECISION 文件无消费语义,不满足律④ | **成立** | 09 §11 已改口:等价性限于律③;律④由 socket 实现的 (runId,seq)+收据消费新增承载 |
| B5 | B | gate.sh 畸形 hook 输入被 `2>/dev/null` 吞,空 command 继续 POST,未达"畸形立即 deny"口径 | **部分成立**(空 command 到 daemon 后走 unknown→S2 人审上浮,非静默放行;但确未达"输入畸形即 deny"的字面口径) | 登记 W 批:`jq -e` 输入对象校验,畸形直接输出 deny + 三反例 |
| B6 | B | canonical 宣布 running⇄step_paused 与恢复钥匙 (adapter,nativeSessionId,cwd),执行器不产生 step_paused、不填 native_session_id | **后半已被 W1 清偿**(`6d1c99e` 恢复钥匙落 tier1_runs.native_session_id 列,快照后提交);**step_paused 前半成立** | 登记 W 批:核对 step_confirm 档的执行器承载(P0 单模式与执行器批 auto 档的落差),或 canonical 标 deferred |
| B7 | B | conformance 提交清单只列到 b9412aa;executor-batch 残留"攒批 17";451/452 计数冲突 | **部分成立**(§4"攒批 17/19"与 451 已由对账会话先修;§3 残留与 conformance 清单属实) | 本轮顺手修:conformance 补全六提交 + §3 残留清除(由 W1 收编提交) |
| C1 | C | blocked occurrence key 截 80 字符,碰撞边界未成文 | **成立** | 09 §6.3 补注(本轮) |
| C2 | C | 路径应写 `$SAYDO_HOME`(缺省 ~/.saydo),实现支持覆盖 | **成立** | 09 §11 已随 A1 改口一并修 |
| C3 | C | executor.ts:831 注释与 §9 矛盾("reserved 有 settled_failed 直边") | **证伪**:注释原文是"reserved **无** -> settled_failed 直边:经取消链落终态",与代码、与本轮 §9 补录一致 | 无动作 |

## 五维度结论(Codex 原判,triage 后修正)

- **a 文实一致**:局部干净(task_messages/认领边/socket 形态/queued_delta 全对上),整体两处 overclaim(A1 不可写、B4 语义同)——本轮 canonical 已改口。
- **b 语义同断言**:不成立(仅律③等价)——已改口。
- **c 合同冲突**:B1 状态表缺边已补;B2 反例矩阵登记。
- **d 诚实分层**:三条 P1 差距在 canonical 无冲突承载;第四条未登记差距 = A1(写工具不经门),本轮已登记。
- **e 措辞**:C2 已修;B7 残留本轮清。

## 遗留(移交 W 批,场次②前落)

1. **A1 补偿控制**:gate 请求处 digest 校验(gateServer handler 内,读 `cfg.gateScriptPath` 比对 `buildGateScript()` 期望值,不符 ⇒ deny + cancel 活跃 runs + 审计)。
2. **B2**:`validateTier1Config()`(绝对路径 + 文件存在可执行 + versions/<ver>/ 形态 + 精确版本相等)+ §12-9 正反例。
3. **B3**:非 cursor 后端启动即拒;steerApplied 与真实能力绑定。
4. **B5**:gate.sh `jq -e` 输入校验。
5. **B6 前半**:step_confirm 档执行器承载核对。
