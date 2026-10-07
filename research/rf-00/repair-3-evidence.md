# RF-00 repair-3 逐项语义处置证据(repair-3)

> 范围:对 `inventory.json` 全 15 类 725 个机械项做逐项语义处置,
> 结果落在 `semantic-claims.json` `item_dispositions`(键=`class:id`)。
> 本文记录**处置方法与证据等级**,逐项明细以 semantic-claims.json 为正本。
> 本轮只改 `research/rf-00/` 证据面;不改 canonical、生产代码、扫描器、幂等合同。
> **全部处置是源码/配置/本机只读观测级,不构成产品运行时验收,不构成合同评审结论。**

> 2026-10-03 历史计数勘误：本稿的 725 项限定于 repair-3 对应提交 `bbd6bea3`，该提交 `item_dispositions` 实际分布为 verified_semantics=636、excluded_nonproductive=14、migration_only=15、dual_write_gap=4、declared_only=55、observed_fact=1，合计 725。旧表 658 不属于该历史分母，现修正为 636。整合输入 `4e80100b` 的同字段已为 1352 项（verified_semantics=1263，其他五类计数相同），不能继续用旧 725 作本轮分母；本轮真实生成值与校验边界见 [库存更新说明](source-refresh-2026-10-03.md) 和 [验收矩阵 A 节](acceptance-matrix.md)。下文各类计数、NOT_RUN 与四项缺口仍为当时证据。

## 处置标签口径

| disposition | 含义 | 计数 |
|---|---|---|
| `verified_semantics` | 读到真实实现并完成语义归类(角色/写面/边界/权限) | 636 |
| `declared_only` | 仅声明面核对(依赖清单;未下载/未安装审计/未锁字节) | 55 |
| `excluded_nonproductive` | dev/fixture 注入面,具名排除理由,不计生产唯一 owner | 14 |
| `migration_only` | 仅迁移回填/代际归档写面,非生产业务写 | 15 |
| `dual_write_gap` | 多写面/唯一 owner 缺口,具名登记 finding,不修 | 4 |
| `observed_fact` | 本机实测事实(非声明面) | 1 |

## 分类处置方法

- `http_routes`(86):按真实处理器分五面——`index.ts` 业务 API 面(读实现行号)、
  `recoveryOnlyServer.ts` 崩溃恢复面、`s3Routes.ts` 强鉴权面(四断言:本机 socket/
  Origin/绑定/端口)、`mobileLan.ts` 只读 LAN allowlist 面、console `api.ts`/`setupApi.ts`
  消费投影面。每项 note 给处理器行号与权限断言;`approve-merge` 标
  `write.irreversible` 等 effectClass。
- `ws_messages`(35):逐词对 `contracts/src/types/pipeline.ts` schema 与
  daemon `voice/hub.ts` 分发、pipeline 生产/消费、console `useVoiceChannel` 消费面。
- `ipc_frames`(5):`cli/src/supervisor.ts` `{v:1,t}` 帧源,与 WS 词表分面。
- `brain_tools`(32):`brain/liveTools.ts` 注册项逐→`operations.ts`/DAO 效果,
  区分提案型/效果型、presentation anchor、S3 trusted-terminal 拒口语、
  会话悬挂显式 end-intent。
- `console_api_members`(42):`lib/api.ts`/`setupApi.ts` 消费面→对应路由,
  标模板插值为消费面非端点定义。
- `tables`(57):`storage/ddl.ts` 声明面+代际表(`_vN`)/`memory_fts`/
  `schema_migrations` 标注。
- `table_writers`(116):逐项读真实 callsite;fixture 注入面 14 项标
  `excluded_nonproductive`;迁移/归档写面 15 项标 `migration_only`;
  **双写缺口 4 项**标 `dual_write_gap`(见下)。
- `file_writers`(225):逐调用点读上下文,归原子写(tmp+rename+fsync)/SQLite/
  移动三端凭据与 profile 写面/备份 staging/运行时 ownership 文件/日志审计/
  知识生成/provider 隔离 home/门禁脚本等;移动凭据写面均源码核实(AES-GCM/
  HUKS wrap/Keychain),设备实测=RF-09 NOT_RUN。
- `module_dependencies`(5)/`external_dependencies`(55):package.json/pyproject
  声明面;外部依赖一律 `declared_only`(未下载、未审计、未核 lockfile 字节)。
- `artifacts`(9):CI/release 声明、release-asset-manifest 输出期望、
  rc.13 tracked manifest 存在性(仓内可核);生成/签名/远端下载均 NOT_RUN。
- `support_facts`(30):声明面(CI 矩阵/engines/platform_guard/requires-python/
  app_tree)逐项读源;仅 `ci_runner:macos-15` 标 `observed_fact`(本机实测);
  win/ubuntu 声明在但本机不可验,如实记 NOT_RUN。
- `legacy_candidates`(18):`git branch/tag/stash/worktree` 只读枚举+provenance;
  处置=只读历史候选,不恢复/不覆盖/不合并;分支含审计/基础旧线,WIP tag 与
  stash 记录冻结位。

## 具名登记 finding(不属修复)

`dual_write_gap` 4 项(table_writers 维度):

| 项 | 双写面 |
|---|---|
| `confirmation_ledger <- index.ts` | withdraw 直写(1963-1966 清卡同事务)与确认域并列 |
| `focus_events <- live/confirm.ts` | 确认域内直写事件序,与 writeTx 并列 |
| `focuses <- live/confirm.ts` | 确认域内锚定/状态直写 |
| `pending_confirmations <- index.ts` | withdraw/清卡 DELETE,与 live/confirm 双写 |

以上作为 RF-04/RF-05 唯一 owner 归口的已知输入,本轮只登记不改代码。

## 证据等级声明

- 源码级:`verified_semantics`/`excluded_nonproductive`/`migration_only`/
  `dual_write_gap`——结论来自读真实实现行,非路径名模板。
- 声明级:`declared_only`(依赖 55)与 artifacts/support 声明面——只证明
  声明存在,不证明安装/生成/签名。
- 实测级:`observed_fact`(macos-15 runner 面对应本机工具链)+
  `acceptance-matrix.md` D 节本机枚举——只读观测,不外推其他平台。
- 运行时验收:`just ci`/Playwright/provider/真机/发布全部 NOT_RUN,精确原因
  见 `acceptance-matrix.md` C 节与 repair-3 REPORT。
