# CONTRIBUTING(草案 —— RF-11 准备稿,未对外生效)

> 状态:**draft**。本文件为开源治理(RF-11 `open-source-second-maintainer`)
> 的预备稿;完整开发历史保存在私有 `SayDo-archive`，公开 `SayDo` 仓为发布快照。
> 公开贡献主线尚未切换，第二维护者交接演练**未发生**。本稿不引入
> DCO/CLA 要求;是否启用由 owner 另行决定。正式生效以 owner 验收与公开发布
> 为准。

## 仓库布局速览

见 `AGENTS.md` 仓库结构节与 `research/rf-00/module-cards.md` 模块维护卡。
canonical 唯一源在 `docs/01–11`、`docs/modules/` 与 `docs/adr/`;
`docs/09-data-contracts.md` 是合同形状权威;
`docs/plan/IMPLEMENTATION-PLAN-2.md` 是唯一排产源。

## 本地开发

```bash
pnpm install          # Node 22 + pnpm(package.json engines 为准)
just dev              # 起 daemon + pipeline + console
just ci               # 本地 Node/Python 基线(不是托管 CI 等效)
uv --directory pipeline sync   # Python 侧
```

变更前先读 `AGENTS.md` 硬规则:零 emoji、状态词纪律、Gate 0 无 bypass、
S3 语音绝不放行、契约不分叉(`@saydo/contracts` 单源)、审计与日志分流。

## 提交流程(草案)

1. 修改 canonical 文档与实现须同批可审(先合同后代码;冲突以 docs/09 为准)。
2. 提交走两提交法:`feat(...)` 实现提交 + `chore(evidence)` 证据提交,
   证据记录实现 SHA。
3. 评审纪律:`scripts/check-emoji.sh` 必过;评审产物落盘后才能收口。
4. 不提交 secret/私钥/真实隐私路径;`scripts/check-public-tree-privacy.mjs`
   为硬门。

## 贡献面(草案)

- **provider adapter**:见 `research/rf-00/module-cards.md` 扩展样例;
  新 provider 须先落 contract 类型与 conformance 语料。
- **页面/组件**:console 消费面,投影走 `lib/api.ts`;不得直连 daemon 存储。
- **设备端**:apps/* 当前 inventory_only/designed;新增能力先更新
  `fixtures/device-capability-matrix.json` 的 evidence_required。

## 联系

安全问题走 `SECURITY.md` 通道(私下邮件,不公开 issue);其余按 issue
模板(待 RF-11 补 `.github/ISSUE_TEMPLATE/`)提交。
