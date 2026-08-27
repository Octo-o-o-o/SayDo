# CTX-02 · 登录事故

- `as_of`: `2026-08-12T10:37:00+08:00`
- `valid_until`: `immutable_event_window`
- `claim_scope`: 事故事实用 `incident-timeline.md`；代表性机器信号用 `log-excerpts.md`；旧流程建议只用 `runbook-excerpt.md`。
- `supported_questions`: `ENG-021, ENG-028, ENG-050, ENG-092, PRJ-020, PRJ-063, WRT-006, WRT-019, WRT-029, WRT-066, RES-008, SAL-034`
- `unsupported_scope`: 只含一次事故，不支持季度 uptime、十次事故模式或精确重算总失败数。
- 合成系统：北辰身份服务。
- 事故窗口：2026-08-12 09:42–10:37，Asia/Shanghai。
- 权威顺序：可校时的 `incident-timeline.md` > `log-excerpts.md` > 旧版 runbook 建议。
- 注意：日志时间为 UTC；时间线已换算为本地时间。
- 冲突：runbook 仍写“先清空所有 session”，事故期间没有执行该步骤，且当前团队认为风险过高。

来源：

- [incident-timeline.md](incident-timeline.md)
- [log-excerpts.md](log-excerpts.md)
- [runbook-excerpt.md](runbook-excerpt.md)

<!-- corpus:required-claims:begin -->
## 逐题 required claims 合同

- `required_claims`: 每个 `supported_questions` ID 必须在下表登记 fixture 可支持的 claim、来源文件和仍需的现场输入。
- `supplemental_input`: `-` 表示本包足以开始该题；`USER`/`LIVE` 表示题目行必须显式带同名上下文，fixture 不替代它。
- `required_claims_digest`: `sha256:028d13bc43ab4fdae55be7496f1b4b017817c014b8b43f78b78ed3ac75ac820a`
- `fixture_sources_digest`: `sha256:e79a901441d3f83612f0e1d43ea659885e108f77fb2da0712363b7fcf5c4c86b`

| ID | required claims | fixture sources | supplemental input |
|---|---|---|---|
| ENG-021 | 冻结日志显示 refresh token 缓存未命中后超时，回滚与滚动重启后成功率恢复；日志不能精算总失败数 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取完整当前日志与运行状态 |
| ENG-028 | 事故从 09:42 成功率下降到 10:37 降级，配置变更、缓存残留、回滚和重启均有时间证据 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取当前代码、监控与行动项状态 |
| ENG-050 | 事故窗口已确认影响、当前恢复动作和旧缓存残留；未解决的新异常不在冻结 fixture 内 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取当班未解决异常、owner 和最新处置 |
| ENG-092 | 缓存 TTL 改动、refresh 超时、回滚后残留节点和旧 runbook 的误导步骤可用于定位缺失检测 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取当前检测、owner 和验证计划 |
| PRJ-020 | 事故时间线区分已确认事实、处置和观察窗口；现场进行中动作与等待对象不在 fixture 内 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取事故板当前动作、等待对象和更新时间 |
| PRJ-063 | 冻结材料可区分事故事实、日志证据、回滚决定和旧 runbook 缺口；当前指挥角色未登记 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取当前指挥角色、渠道和决策状态 |
| RES-008 | 配置发布、缓存未命中超时、回滚和滚动重启均有证据，密钥泄露则没有证据 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取完整日志、代码变更和待排除根因证据 |
| SAL-034 | 事故材料只支持已确认时间线、影响和恢复动作；客户升级背景、商业风险与赔偿权限由用户提供 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | USER 提供客户升级与商业风险材料 |
| WRT-006 | 旧 runbook 会误清全部会话并错误归因为第三方故障，本次事故实际来自内部缓存 TTL 回归 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取当前代码、监控和可执行排障分支 |
| WRT-019 | 09:42 至 10:37 的已确认事故时间线、2,140 次失败影响和无密钥泄露证据 | incident-timeline.md | USER 提供承诺给客户的下次更新时间 |
| WRT-029 | 事故事实、影响范围及旧客服模板不适用于本次内部配置回归 | incident-timeline.md + runbook-excerpt.md | USER 提供已经批准的补救承诺范围 |
| WRT-066 | 事故影响、处置和恢复时间已有单一冻结事实源；当前指挥口径、收件人与批准状态不在 fixture 内 | incident-timeline.md + log-excerpts.md + runbook-excerpt.md | LIVE 读取当前指挥口径、四语收件人、时区和批准状态 |
<!-- corpus:required-claims:end -->
