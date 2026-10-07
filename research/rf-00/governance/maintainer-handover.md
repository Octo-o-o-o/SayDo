# 第二维护者交接包(草案 —— RF-11;演练未发生)

> 目标:让一名**非原作者**能在不读代码前的情况下完成:① 环境起栈;② 改一个
> adapter/页面并通过验收;③ 数据备份/恢复;④ 验证一个候选发布字节。本清单
> 是操作手册草案;**演练本身标 NOT_RUN**(需真实第二人执行,当前不可伪造)。

## 1. 起栈与自检(本机可跑)

```bash
pnpm install && just dev            # 起栈
node scripts/schedule-pointer.mjs --check   # 排产坐标一致性
node scripts/rf00-inventory-scan.mjs --check  # RF-00 机械+语义门禁
node scripts/check-offline-fixtures.mjs       # 离线语料校验
just ci                             # 本地基线(node+python 双矩阵)
```

## 2. 改一个 adapter(验收链)

- 选择面:pipeline 新 ASR provider 适配(`pipeline/src/saydo_pipeline/`)。
- 步骤:读 `module-cards.md` pipeline 卡 → 先落 contracts 类型(如有新帧)
  → 实现 → `fixtures/provider-executor-conformance.json` 补案例 →
  `check-offline-fixtures.mjs` 校验 → `just ci`。
- 验收锚:conformance 案例数增长 + `just ci` 绿 + 语义层 disposition 更新。

## 3. 数据备份/恢复

- `just backup` 快照 SQLite/JSONL/knowledge;恢复按 `docs/09 §17.5` 恢复隔离
  序列(8 步 + 三谓词重开)。
- 练习点:故意制造崩溃现场 → 观察 `reconcile_required`/`unknown` 语义,
  不自动重放。

## 4. 验证候选发布

- `docs/release/*-assets.json` exact-set;发布验证按 §17.8 绑定实际下载字节
  digest → {repo, commit, workflow, signer}。
- 演练目标:第二维护者能独立跑 `build-release-artifacts` + 校验 SHA256SUMS
  + 说出 exact-set 与 SBOM/provenance 的增量关系。

## 5. 不自动获得的权限

- 发布签署、远端 ruleset、组织级密钥、真实 maintainer 账号指派 —— 全部
  owner 手动,本清单不预授权。
- 远端业务开放、移动端 `supported` 升级 —— 需独立证据,不随交接发生。

## 缺口与诚实标记

- 演练未执行:`NOT_RUN`(缺第二人/凭据);
- issue/PR 模板未落:`.github/ISSUE_TEMPLATE/`、`PULL_REQUEST_TEMPLATE.md`
  为 RF-11 待办;
- CODEOWNERS 为角色占位草案,启用前需 owner 指派。
