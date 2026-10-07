# SayDo 项目协作约定

2026-10-07 项目本地规则。普通任务直接处理；本文件不要求初始化外部控制账本，不改宿主或全局配置。历史十字段配置、角色、授权窗口、RED 与累计额度原文见 [精简前快照](../history/2026-10-07-project-profile-before-simplification.md)。归档不清零旧账，已启动任务继续遵守其冻结合同。

## 安全与授权

保留 Gate 0 无 bypass、S3 语音不放行、TTS 脱敏、candidate→trusted/M0 拒第三方、不可变审计和敏感 payload 仅记 digest。公开快照写入端脱敏、stage 前 fail-closed；发布身份、版本、安装入口和 availability 不得假绿。生产 DDL 迁移先有可恢复点，不做未验证逆向 DDL。

commit、push、公开快照、版本发布、npm publish、官网或常驻 runtime 部署、真人场次和付费 provider 调用须有对应授权；已有授权内连续推进，不重复请示。缺授权仅暂停受影响动作。

## 入口与验证

验收按当前用户任务、canonical 与实际改动确定；唯一排产源仍是 `docs/plan/IMPLEMENTATION-PLAN-2.md`。用户要求监督交付或独立验收时采用对应流程，作者不自验，reviewer 只读冻结候选；数量与范围遵守用户明确要求。重大合同语义变化先核对合同再改生产代码。

- 产品与共享依赖：受影响语言的 lint/typecheck/单测/契约测试；`just ci` 是 Node/Python 本地基线。
- 工具变更：`pnpm test:tools`；发布安装变更：`pnpm test:release`。
- UI 行为或接线变化：`pnpm exec playwright test`；平台专项按实际环境单独验证。
- 文档及收口：适用链接检查、`scripts/check-emoji.sh`、公开隐私扫描与 `git diff --check`。

仅文档改动不默认重跑全部产品和浏览器；已通过且输入未变的证据可明确沿用，不冒充重跑。不新增自动计算受影响范围的控制框架。适用 required gate 失败或未验仍不得称完整交付。

本地验证不等于托管 CI；私有与公开仓各按当前实际 SHA 和 job 结果报告。账户额度等造成的不可运行如实标未验，不以历史停摆推断当前状态，不用本地绿掩盖远端 RED。

## 报告与证据

状态标记用 `[ok]` / `[warn]` / `[fail]` / `[divergent]`，执行、验收、合并、发布分开报告。对抗评审可落 `research/codex-findings/`，readback 可落 `docs/review/`，命名 `YYYY-MM-DD-<slug>[-review|-repair|-retry].md`。保留重要决定、失败和未验结果；不要求每次小修复制报告和 journal。`*.log` 不入 Git，报告记录引用日志的文件名、字节数和 SHA-256。

默认提交可审查的变更与验证摘要；证据需引用代码 SHA 或用户指定时采用代码/证据两提交，不自指。本轮继续既定双 reviewer、代码/证据两提交，以及先精简提交、再产品补足提交的阶段边界；未开展真实 release、平台、设备或 provider 验收不称通过。
