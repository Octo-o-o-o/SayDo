# RF-06 web-component-consumption —— 纯 fixture 演示计划(独立准备)

> 目的:在不动生产路径、不等 PG 门的前提下,把"console 消费 contracts/SDK
> 投影"的演示验证素材备好。本计划**全部离线**:临时数据根 + mock 响应,
> 与生产配置严格分离。fixture pass 不构成生产验收;RF-06 实施/验收仍以
> 其执行卡与 `e2e/evidence/rf-06.md` 为准(本批不生产该文件)。

## 范围与边界

- 只演示**消费面**:`packages/console` 经 `lib/api.ts`/`lib/setupApi.ts`
  投影的读取与命令触发形态;不写 daemon、不接真实 provider。
- 数据源:`research/rf-00/fixtures/` 语料 + 本文件内嵌的响应样例;
  用 `SAYDO_DATA_ROOT=<tmpdir>` 指向临时数据根,不碰 `~/.saydo` 真实根。
- mock/demo 与生产的分界线写死在启动方式:演示进程必须显式
  `SAYDO_FIXTURE_MODE=1` 且 daemon 不绑定真实凭据目录;缺该 env 一律按
  生产 fail-closed 处理(现役行为不变)。

## 演示用例(输入 → 预期输出)

| 用例 | 类别 | 输入(fixture) | 预期输出 |
|---|---|---|---|
| C1 总览读面 | normal | `GET /api/...` 投影 → fixture 快照 JSON | 列表按 snapshot 渲染;无字段则显式空态 |
| C2 命令触发拒绝 | reject | `POST /api/tasks/:id/review` 缺 verdict | 400 + `decode_failed` 形状;前端按错误码渲染,不静默吞 |
| C3 审批决议 edit | reject | decide `edit` 经非本机终端来源 | 拒绝 + `origin_untrusted`/等价形状;UI 提示受信终端限定 |
| C4 恢复后缺记录 | recover | 幂等查询返回 `lookup:"unknown"`(§17.1 定档形状) | UI 显示 unknown/需对账,不显示"未执行" |
| C5 K 墓碑重放 | recover | 同 K 重放返回 `expired` 墓碑 | UI 如实显示 expired;不得给"重发"快捷按钮 |
| C6 游标过期 resync | unknown | durable 订阅 `cursor_expired` | 走 resync 路径;期间渲染"重新同步中"非错误态 |
| C7 依赖缺失降级 | reject | provider 凭据缺(conformance 语料 `provider-startup-missing-credential`) | 控制台能力位显式 `unavailable`,不出现在默认选择器 |

## 运行方式(草案,RF-06 执行期实装)

```bash
export SAYDO_DATA_ROOT="$(mktemp -d)/saydo-fixture"
export SAYDO_FIXTURE_MODE=1
node scripts/dev.mjs --fixture research/rf-00/fixtures   # 草案参数,实施期定名
```

判定口径(每个用例):

- 请求/响应快照与 fixture `expect` 字段一致(形状级,不比对真实业务数据);
- 拒绝类用例必须出现对应错误码且不产生任何写副作用;
- `unknown`/`recover` 类用例必须出现对账/重同步语义,不得自动重放。

## 验收声明

- 本计划与 fixture 校验器(`scripts/check-offline-fixtures.mjs`)只验证语料
  与形状;**不声称**任何页面已按 RF-06 接线,不替代 Playwright/真机验收。
- 与生产配置分离是硬约束:fixture 模式进程不得读取真实 `~/.saydo` 凭据,
  不得对真实 daemon 发写请求。
