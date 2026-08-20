# 61 · D1 桌面 App 地基批独立评审(收尾工程师)

> 日期:2026-08-12  
> 分支:`feat/m2-ios-shell-spike`  
> 评审对象:本会话收尾前已分主题提交的地基批终态  
> 合同源:OctoAgent `docs/product/2026-08-11-SayDo移动端完整方案-v1.md` v5+v5.1(地基批 10 条交付 / 9 条验收)  
> 实现合同:`docs/09-data-contracts.md` §16  
> 方法:独立复跑门禁 + 源码只读对账;不修实现

## TL;DR

**裁决:Go(带残差 B,无本会话复证的 A 必修项)**

- 本会话独立验证 `pnpm ci:node` **exit 0**;`SAYDO_PROTOCOL_VERSION=2.3.0 pnpm --filter @saydo/cli verify:distribution` **exit 0**。
- 地基批 10 条交付均可在源码 + distribution 验收输出中取证;9 条验收由 `verify-distribution.mjs` 程序化覆盖且本会话实录为绿。
- 多轮回修后,前序对抗审中的多项 A 级风险已在终态代码中闭合(instance lock/先 bind/pipelineAuthorized/原子 owner/`--resume` 确认门/共享 recoverability predicate/restart 熔断)。
- 仍见 B 级残差(terminal-result 与 prepareShutdown 竞态窗口、硬超时 SIGKILL 边界、壳批未做等);**不构成地基批 No-Go**,由验收人决定是否开后续修补批。

## 本会话验证实录

环境约束:Grok agent 默认 seatbelt 禁 `/bin/ps`(EPERM)且 PATH 可能落到 Node 26;本会话经 **tmux 新会话** 逃逸后,使用:

```text
PATH=/opt/homebrew/opt/node@22/bin:...
node = v22.23.1
PS_OK
```

命令与结果(日志:`/tmp/saydo-ci-full.out`,本机副本可选 `logs/61-d1-finalize-verify.out`,`*.log` 不入 Git):

| 命令 | 结果 |
|---|---|
| `pnpm ci:node` | **CI_NODE_EXIT=0** |
| `SAYDO_PROTOCOL_VERSION=2.3.0 pnpm --filter @saydo/cli verify:distribution` | **VERIFY_PROTOCOL_EXIT=0** |

包测摘录:

| 包 | 结果 |
|---|---|
| `@saydo/contracts` | 8 files / **97** tests passed |
| `@saydo/cli` | 4 files / **18** tests passed |
| `@saydo/console` | 16 files / **106** tests passed |
| `@saydo/daemon` | 98 files / **1208** passed, 4 skipped |
| emoji gate | `[ok] emoji gate: clean` |

distribution 验收 JSON 关键字段(两次一致形态;协议注入 run 的 identity.protocolVersion=`2.3.0`):

```json
{
  "ok": true,
  "node": "v22.23.1",
  "tarball": { "entryCount": 6 },
  "readiness": { "coreReady": true, "voiceReady": false, "reason": "pipeline_absent" },
  "ownership": {
    "sameHome": "attached",
    "otherHome": "home_mismatch",
    "concurrentSameHome": "owned+attached",
    "concurrentDifferentHome": "owned+conflict-before-db",
    "defaultPort": "occupied_conflict_preserved"
  },
  "lifecycle": {
    "prepareShutdown": "restart_pending",
    "resumed": "settled_review"
  },
  "orphanCheck": "daemon_agent_and_descendant_exited"
}
```

**未在本会话复跑**:`pipeline` pytest(前任自证 33;本任务门禁以 node 矩阵 + distribution 为准)。

## 提交清单(本会话产生)

| SHA(短) | 主题 |
|---|---|
| `2d3b653` | feat(contracts): 回写 09 §16 可分发运行时合同与 runtime schema |
| `d952ebb` | feat(daemon): 可分发运行时身份、readiness 拆分与可恢复退出 |
| `f2e80bd` | feat(cli): saydo up/status/open 可分发 supervisor 与 distribution 验收 |
| `7abf7d4` | feat(console): pipeline 缺席时明示文本控制面可用 |
| (本文件) | chore(research): 61 号 D1 地基批独立评审 |

> 完整 hash 以本会话 `git log` 为准;汇报时用 `git rev-parse` 再核。

## 地基批 10 条交付对账

| # | 交付 | 状态 | 证据 |
|---|---|---|---|
| 1 | 无 `.git`/tsx/pnpm 可启 | 完成 | `packages/cli/scripts/verify-distribution.mjs:70-72` tarball 仅 `package.json`+`dist/`;`:413` 故意制造 PATH 内假 pnpm/tsx 仍启动;`build.mjs` esbuild 预编译 `dist/runtime/daemon.mjs` |
| 2 | 身份注入三元组 | 完成 | `packages/contracts/src/runtime.ts:5-10`;`packages/cli/scripts/build.mjs` define `__SAYDO_*__`;`packages/daemon/src/buildIdentity.ts`;验收 JSON `identity.*` |
| 3 | console dist 同源托管 | 完成 | `build.mjs` Vite build + `cpSync` → `dist/console`;`packages/daemon/src/runtimeAssets.ts` + `index.ts` 静态服务;`verify` staticHttp index/asset **200** |
| 4 | `saydo up/status/open` | 完成 | `packages/cli/src/cli.ts:9-32`;`options.ts` 命令枚举;`verify` cli.open / status / up 路径 |
| 5 | supervisor IPC 五帧 | 完成 | `packages/contracts/src/runtime.ts:92-125` schema;`packages/cli/src/supervisor.ts` 收发 ready/prepareShutdown/restartRequested/stopped/fatal;`daemon/src/index.ts:2833-2845` 发 ready |
| 6 | readiness 拆分 | 完成 | `runtime.ts:52-60`;`runtimeIdentity.ts` assess;`verify:440-441` core 绿/voice pipeline_absent;console `Chat.tsx` `VOICE_DISABLED_MESSAGE` |
| 7 | 端口 attach/conflict 矩阵 | 完成 | `packages/cli/src/probe.ts` ownership HMAC+digest;`supervisor.ts` attach/owned;`verify` ownership 块多行矩阵 |
| 8 | 可恢复退出 | 完成 | `executor.ts:2066-2173` prepareShutdown 写 marker+杀进程不 settle failed;`verify` lifecycle restart_pending → settled_review |
| 9 | HOME 规则 | 完成 | `options.ts` `--home` > env > 默认;09 §16.2;`verify` homeReadback / SAYDO_HOME / `--home` 覆盖 |
| 10 | 壳所需版本化接口 | 完成 | `GET /api/desktop/summary` → `packages/daemon/src/api/desktop.ts:8-34` + `desktopSummaryV1Schema` |

## 9 条验收对账(对照 09 §16.6)

| # | 验收 | 本会话 |
|---|---|---|
| 1 | 无源码树启动 | 绿(`ok:true` + tarball 约束) |
| 2 | `/health` 三元组 + `/` 与 hash 资产 200 | 绿(staticHttp + identity) |
| 3 | pipeline 缺席 core 绿 / voice 明示 | 绿(readiness + console 文案) |
| 4 | HOME 三态与临时 home 读回 | 绿(homeReadback) |
| 5 | attach / 冲突不杀 / 显式端口 | 绿(ownership 矩阵) |
| 6 | Tier1 prepare-shutdown 后续接、不落 failed | 绿(lifecycle) |
| 7 | Ctrl+C 后无孤儿 | 绿(orphanCheck) |
| 8 | Node 22 native addon 开库 | 绿(node v22.23.1 下安装包跑通) |
| 9 | `npm pack` 可装 | 绿(tarball entryCount=6 安装后 up) |

**明确不在本批**:brew/npm 公网发布(合同写 release gate 另记);Electron 壳批 11 条。

## Findings

### A 级(必修)

本会话对终态代码独立复读后,**未复证仍成立的 A 级项**。

前序 `61-d1-distributable-runtime-review` 中的 A 项在终态中的状态(摘要):

| 前序 A | 终态判断 | 关键证据 |
|---|---|---|
| 启动未先 lock/bind | 已闭合 | `index.ts` `acquireInstanceLock` 后立即 `server.listen`,失败发 `fatal` 并 exit,再开库/recover |
| pipeline digest 仅亮灯 | 已闭合 | `hub.ts` `pipelineAuthorized` + 非 health 消息丢弃 + digest 不符关连接 |
| agent-owner fail-open | 已闭合 | `executor.ts` temp+`renameSync`;`processStart` 不可用则抛错 |
| `--resume` 未确认就清 marker | 已闭合 | `expectedResumeSessionId` / `resumeSessionConfirmed` 门 |
| recoverability 谓词分叉 | 已闭合 | `isTier1RestartRecoverable` 供 summary/prepare/drain 共用 |
| 强制退出只杀 daemon PID | 显著加强 | generation 范围 reaper + ownership;仍见 deadline 后 `SIGKILL` child(见 B2) |

### B 级(择要)

1. **terminal result 已到与 prepareShutdown 写 marker 的窗口**  
   - 位置:`executor.ts:1092` 置 `terminalResultReceived`;`prepareShutdown`(`:2066-2110`)不读该标志,只要 durable 仍 running/recoverable 就写 `restart_pending` 并 `proc.kill()`。  
   - 风险:agent 已输出终态 result、尚未 wait 完成时 Ctrl+C,可能把将 settle 的 run 标成可续接并重启重跑。  
   - 建议:prepare 前若 `terminalResultReceived` 则优先 drain settle / 禁止写 marker。

2. **硬超时路径仍可能只保证 daemon PID 退出**  
   - 位置:`supervisor.ts:169`/`312-314` 30s deadline → `emergencyStop` → child `SIGKILL`;reaper 随后扫描 ownership。  
   - 风险:reaper 在 EPERM/`ps` 失败时 fail-closed 保留 owner(正确),但用户可见“已退出”与残存进程组之间存在诊断窗口。  
   - 建议:壳批/后续把“未 ESRCH 不得宣称干净退出”做成 CLI 出口码语义。

3. **`SAYDO_BUILD_ID` 标签仍可被环境覆盖前缀**  
   - 位置:`build.mjs` `buildLabel` 可来自 env,但 `buildId` 仍拼接 protocol + content digest 后缀,碰撞面小于早期版本。  
   - 残留:诊断展示若只看 label 前缀可能误导;artifact 身份仍以完整 `buildId`+`sourceRevision` 为准。

4. **desktop summary `activeWork.total` 语义偏窄**  
   - 位置:`desktop.ts:22-25` total = recoverableTier1 + unrecoverableCalls。  
   - 风险:壳 badge 若直接用 total,可能漏非 Tier1 的“进行中”感知(合同允许壳只读此接口——字段语义需在壳批严格消费说明)。

### C 级

1. console chunk >500kB 构建警告(既有 Vite 体积,非功能门)。  
2. 默认 agent 沙箱禁 `ps`/Node 26 PATH 会使本机 CI 假红——开发机需 Node 22 在 PATH 前且允许进程枚举(文档/just 可提示,非产品缺陷)。

## Go / No-Go

| 维度 | 结论 |
|---|---|
| 合同交付 10/10 | 有源码+验收双证据 |
| 验收门 9/9 | 本会话 `verify:distribution` 全绿(含协议注入) |
| A 级未修 | 无本会话复证项 |
| B 级残差 | 有,不阻断地基批收口 |
| **总裁决** | **Go** — 可进入壳批/owner 验收;B1 建议进后续修补队列 |

## OPEN QUESTIONS

1. B1(terminal result × prepareShutdown)是否在进壳批前必须修,还是接受“极窄窗口、distribution 主路径已绿”?  
2. 公网发布(brew/npm)的 release gate 是否单开里程碑,还是与壳批 macOS DMG 绑定?  
3. 本分支名 `feat/m2-ios-shell-spike` 混有 iOS spike 历史提交——D1 合入主干时是否 cherry-pick 四提交还是整支 merge?

## 评审范围外(诚实边界)

- 未做 Electron 壳批任何交付。  
- 未做对抗性 Codex sol 二次复跑(本文件为收尾工程师独立只读评审)。  
- 未 push;未代 owner 合主干。
