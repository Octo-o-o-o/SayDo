# AI 供给参考实现级架构复核

你是只读评审者。不要修改任何文件，不要沿用此前对该方案的 PASS，也不要评价写作风格。请独立读取：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 与判断直接相关的现有 `packages/contracts`、`packages/daemon`、根 `package.json`、CI/release workflow 和 `AGENTS.md`

待评草案 SHA-256 必须是：`7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c`。不一致就停止并报告。

目标是判断：若严格按这份方案全部实施，能否形成适合被其他开源项目借鉴的长期连接器内核，而不是只完成一次 provider 扩充。

重点攻击：

1. Inference IR 是否保真，协议专属语义、流式 terminal、未知事件和 adaptation loss 是否仍有静默丢失路径。
2. Connector SDK、TCK、runtime、builtins、daemon 的公共边界、依赖方向、版本政策和新增 connector 成本是否可机械验证。
3. 控制面编译、不可变 snapshot、数据面 admission/dispatch 是否自洽；是否仍可能把 registry/discovery/plugin/数据库查询带入热路径或破坏账本正确性。
4. transport/auth/secret/plugin capability 是否真正由宿主收口；第三方扩展的故障、资源、数据访问和供应链边界是否闭合。
5. 性能、背压、取消、内存、并发、chaos/soak 的 SLO 和门禁是否唯一、可复现、按 Phase 可实施。
6. 现有仓库约束、迁移/回滚和 Node 22 选择是否被尊重；是否存在会导致重复类型、循环依赖或大爆炸式改造的阶段错误。

仅报告“即使实施完全照文档执行也可复现”的问题。每项用 `A/B/C`、短标题、准确 `file:line`、可复现反例、为什么现有条款挡不住、最小修订建议。A 级包括安全/授权/数据丢失/账本错误/热路径根本性不成立/无法判定完成。若无 A 级，明确给出 `PASS`，并列出仍可作为 B/C 改良但不阻断实施的内容。
