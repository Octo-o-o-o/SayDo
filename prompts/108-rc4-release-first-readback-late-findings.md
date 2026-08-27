# RC4 发布首轮 readback 迟到发现补单

## 1. 使用方式

这是 `prompts/107-rc4-release-provenance-first-readback-return.md` 同一次首轮返工的追加发现，继续使用同一发布
实施 session。先保留并核对 107 已落地内容，再只补尚未覆盖的差异；不要重开会话、重做已绿部分或修改外部状态。

## 2. availability 计划与快照的长窗口 TOCTOU

旧流程在四项 Mac/Windows 实体复验前先从 availability 文件 A 计算 replacements，复验可能持续最多 45 分钟，
之后才快照；若期间文件变为 B，成功路径会用基于 A 的旧文本覆盖 B，事务不会报错，且 rollback snapshot 反而把 B
视为正常前态。

修复要求：

- 先完成全部外部实体复验，再立即建立唯一 snapshot；availability exact-anchor/replacement 必须直接从该 snapshot
  的 bytes 派生，不能在 snapshot 前另读一份内容。
- 第一次 mutation 前重新核对 branch、HEAD、index/working tree clean，以及所有目标当前 bytes 与 snapshot 相等；
  任一漂移时 mutation count=0。
- 增加“预检查后目标 A→B”竞态 fixture，证明 B 不会被旧 A 静默覆盖；成功 fixture 证明 replacement 输入就是
  snapshot bytes。

## 3. Pages deployment 必须绑定本次 Cloudflare 现实

旧 `parseWranglerDeploymentUrl` 接受任意项目的 `pages.dev` URL，正式域名也只查可能陈旧的 marker/bytes；两个项目
都返回其他 project 的 URL 时，状态机仍可能 completed。

修复要求：

- Wrangler 输出的 hash URL hostname 必须精确为 `<deployment>.<声明 project>.pages.dev`。
- 每个 preview/production 外部调用后，使用固定 Wrangler 的
  `pages deployment list --project-name <project> --environment <preview|production> --json`，或等价 Cloudflare API
  deployment readback，定位唯一的本次 deployment 并核对：project_name、deployment id/URL、environment、branch、
  `commit_dirty=false`、`deployment_trigger.metadata.commit_hash===publicMain`、`latest_stage.status=success`。
- 将上述 readback 原样按允许字段投影进逐站 evidence；未知/缺字段、多个候选、旧 commit 或错误 environment 都拒绝。
- production 后再读取 project/production deployment 现实，证明当前 production deployment id 就是刚创建的 id，
  且正式域名属于该 project；随后才以 no-store HTTP 验证当前 availability 内容。不能只靠旧页面 marker。
- 所有 Cloudflare/Pages readback 必须可注入做纯 fixture，本轮不得实际部署或改变 Cloudflare。

反例至少覆盖：错误 project URL、错误 project_name、旧 commit、错 branch、错 environment、dirty、failed stage、
多个候选、project.production_deployment 仍指向旧 id、正式域名返回旧 marker。每个反例都断言 completed 不可达。

## 4. 收口

重跑 107 的全部门禁；若本机没有 PowerShell parser，明确标未验证并保留 Windows 真机门，不得写通过。最终说明这两个
迟到发现的代码/测试映射，不 commit、push、tag、release、ruleset 修改或 deploy。
