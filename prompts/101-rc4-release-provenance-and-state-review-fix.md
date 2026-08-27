# RC4 发布溯源、唯一性与原子状态复审整改实施单

## 1. 目标与边界

在当前工作树继续实施，保留前序运行时修复。本轮修复独立发布复审的全部红灯，使“本机审过的字节、
公开 tag、唯一一次 workflow、immutable Release、availability 文案和两站部署”形成机械可验证的单链。

只改发布脚本、workflow、对应自测与必要 canonical/计划说明；不得 commit、push、创建 tag/Release、修改
GitHub ruleset、执行 Pages 生产部署或改线上状态。所有外部 API 情形用纯函数/fixture 自测。

## 2. 精确资产冻结合同

- 新增 tracked expected asset manifest：`docs/release/v0.1.0-rc.4-assets.json`。至少记录 schema、tag、package、
  version、sourceRevision、buildId、protocolVersion，以及 Release exact-set 三个文件各自的 filename、bytes、sha256；
  tgz 另含 npmIntegrity/entryCount。不得只冻结 tgz 或只信 release-metadata 的自述。
- `scripts/build-release-artifacts.mjs` 明确区分：
  - `--write`：只重建 ignored artifact 目录，不改 tracked manifest；
  - `--freeze`：先按当前源码确定性重建，再以原子写入生成/刷新 tracked manifest，仅供发布候选冻结；
  - `--check`：重建/读取当前 artifact，并把三个资产的实际 bytes/hash、metadata/build identity 与 tracked manifest
    全字段逐字节对账，任一不符非零退出。
- `release.yml` 的发布 job 在 Ubuntu `--write` 后必须 `--check`，从而证明 runner 重建的三个资产与本机冻结清单
  完全相同；发布后/草稿阶段也应在可用的 API 边界核对 exact-set 和精确 bytes，不能只检查“非空”。
- `scripts/verify-release-url.mjs`、`scripts/post-release-gate.mjs` 以及 workflow fixed-URL smoke 都必须把线上下载的
  三个资产逐个对照 tracked manifest，再继续安装/可用性判断。
- tracked manifest 自身不作为 Release asset；Release asset exact-set 仍是 tgz、SHA256SUMS、release-metadata.json。
- 本轮后续还会改变 build input，因此允许本轮生成的 manifest 之后再次 `--freeze`；实现和自测不能假设当前数值永久不变。

## 3. tag 与 workflow 全历史唯一性

- 增加可复用实现，按 GitHub REST 分页读取 `release.yml` 的全部 push runs（每页 100，直到空页/不足页），
  按 `head_branch === tag` 筛选；禁止 `--limit 50` 或只按当前 tag SHA 查找。
- 推 tag 前：历史中该 tag 必须为零次 workflow run；这样即使 tag 曾删除再创建也会 fail-closed。
- workflow 运行中及 post-release gate：该 tag 的全历史 run 必须恰好一个，且 run id 等于当前/选中的 run、
  head_sha 等于当前 tag SHA、`run_attempt === 1`、最终 required jobs 全绿。多次 run、旧 SHA run、rerun 都永久拒绝可用。
- 为分页、零次、恰好一次、同 tag 两个 SHA、同 run attempt=2、跨页重复分别补 fixture 自测。
- workflow 顶层增加按 tag 的 `concurrency`，`cancel-in-progress:false`；所需权限显式包含 `actions:read`，仍遵守最小权限。
- 在 workflow 开始、创建 Release 之前、标记 available 之前分别从远端重新读取 `refs/tags/$GITHUB_REF_NAME`，
  必须仍精确等于 `$GITHUB_SHA`；防止检查与外部 mutation 之间的 TOCTOU。
- `scripts/publish-public-snapshot.sh` 在 atomic push 前必须调用上述“历史零次”预检，并验证公开仓存在 active tag ruleset：
  target=tag、include `refs/tags/v*`（或更窄且覆盖 rc.4）、无 bypass、同时禁止 delete 与 update。
  脚本只验证，不创建/修改 ruleset；缺失即拒绝推 tag。规则判定逻辑要有 fixture 自测。

## 4. availability 写入事务

- `--write-availability` 在第一次本地文件 mutation 前，精确快照：全部 availability 文案目标、`--evidence` 目标、
  physical evidence 目标目录及 `week-audit --write` 会改动的所有生成文件；同时记录原先存在/不存在和原始 bytes。
- 文案先在内存完成 exact-anchor 验证，使用同目录临时文件 + rename 原子替换。任一写入、证据持久化、
  physical evidence 持久化或 audit refresh/check 失败时，必须恢复所有已存在文件的精确原始 bytes，删除原先不存在的
  新产物，最后验证工作树与事务前逐字节一致，再把原始错误抛出。
- 成功时所有文案必须统一为 available，证据与 audit bundle 同步；不能留下半数页面已切换。
- 把事务核心抽为可注入文件操作/失败点的 helper，覆盖第 1 次、中间、最后一次 rename、证据写、audit write/check
  失败；每个反例逐文件校验 exact rollback，不能只测状态字符串。

## 5. Pages 部署状态机与可恢复证据

- `--deploy` 在第一次 Wrangler 外部调用之前，必须把 evidence 原子持久化为 `status:"started"`，包含 release、
  public main/CI readback 与两个站点的 planned 状态。
- 先以非 production branch 为两个项目分别部署 preview，并逐站持久化返回 URL、HTTP readback 和状态；只有两站 preview
  都验证通过后才能开始任何 production(main) deploy。
- production 逐站执行；每次外部调用前写 `deploying`，成功 readback 后写 `deployed`。任意异常都捕获并持久化
  `status:"partial_failed"`、失败 stage、已完成站点和脱敏有界错误，再非零退出。不能只在函数最终 return 后才留证据。
- 两站 production 与正式域名检查全部成功后写 `status:"completed"`；随后 audit refresh 若失败，必须将证据更新为
  `status:"audit_failed"` 并保留真实部署结果，再非零退出。
- evidence 每次使用同目录临时文件 + rename，禁止半截 JSON；重试必须从 readback 的外部现实和既有 evidence
  fail-closed，不得盲目覆盖一次部分部署事实。
- 用注入 Wrangler/fetch/persist/audit 的状态机自测覆盖：首个 preview 失败、第二 preview 失败（确认零 production）、
  第一 production 失败、第二 production 失败、正式域名失败、evidence 持久化失败、audit 失败和全成功路径；
  对每步外部调用顺序与落盘状态逐项断言。

## 6. 文档与一致性

- 在现有 `docs/plan/2026-08-22-week-audit-faststart-release.fable.md` 最小增补上述 tracked asset、全历史唯一性、
  active tag ruleset、availability 事务与 preview-first 部署合同；不要新建重复计划。
- `docs/release/v0.1.0-rc.4.md` 只在现有候选语义下补精确溯源说明；此时仍不得写“已发布/可用”。
- 若 `package.json` / `Justfile` / CI 需要接线新的纯自测，保持本仓现有命名与质量门风格。

## 7. 验收门禁

必须真实运行并报告退出码；任何失败如实保留：

1. 新增 release state/provenance 自测（独立脚本），覆盖本单列出的全部反例。
2. `node scripts/build-release-artifacts.mjs --freeze`
3. `node scripts/build-release-artifacts.mjs --check`
4. `node scripts/test-release-physical-evidence.mjs`
5. `node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4`
6. workflow YAML 可解析，并程序化断言 concurrency、actions:read、三处 tag SHA readback、分页唯一性与 exact manifest
   门均真实接线。
7. `bash -n scripts/publish-public-snapshot.sh`
8. 对新增/改动 JS/TS 运行项目既有 lint/typecheck 中对应最小门；不得为门禁联网或触发外部 mutation。

## 8. 交付

直接实施，不提交、不推送、不发布、不部署。最终列出真实改动文件、命令退出码和未解决项；不得把 fixture 通过描述为
GitHub/Cloudflare 线上已验证。
