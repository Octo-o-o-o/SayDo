# GOVERNANCE(草案 —— RF-11 准备稿,未对外生效)

> 状态:**draft**。描述目标治理形状;完整开发历史保存在私有 `SayDo-archive`，
> 公开 `SayDo` 仓为发布快照，当前仍由单一 owner 决策，公开贡献主线尚未切换。
> 2026-10-03 核验：公开仓 `release tags immutable` tag ruleset
> (`21510845`) 已 active，`refs/tags/v*` 的更新和删除已有保护，且无 bypass；
> 私有归档仓 rulesets 为空。
> RF-11 贡献主线的分支保护尚未启用，本稿本身仍未对外生效。

## 决策模型(现状 → 目标)

- **现状**:单一 owner 是最终决策人;评审制度见 `AGENTS.md`(/supervised-delivery
  流程、每版本最多 2 轮对抗 + 1 轮回修,第 3 轮需 owner 当前消息明示)。
- **目标(RF-11)**:owner + 第二维护者的双钥匙模型——owner 保留战略与商业
  取舍拍板;第二维护者可独立走"修改 adapter/页面 → 恢复数据 → 验证候选发布"
  的交接演练链路(演练未发生,标 `NOT_RUN`)。
- 治理变更本身需要 owner 明示批准,不随代码 PR 自动生效。

## 角色

| 角色 | 权限 | 当前人选 |
|---|---|---|
| owner | 最终决策、发布签署、战略取舍 | 仓主(不实名记录) |
| maintainer | 代码合并建议、模块维护、评审参与 | 待定(不编造用户名) |
| contributor | issue/PR | 公开贡献主线待 RF-11 切换 |

CODEOWNERS 草案见 `research/rf-00/governance/CODEOWNERS.draft`
(角色占位,不具名;启用前由 owner 指派)。

## 决策与评审规则

1. canonical 变更(`docs/01–11`、`docs/modules/`、`docs/adr/`)必须经评审链路;
   `docs/09` 合同冲突以 09 为准。
2. 发布签名/来源证明与代码评审分离验(§17.8);发布资产 exact-set 变更必须
   同步升级清单合同与检查器。
3. 无人可独立完成"自己写+自己验+自己发"——reviewer 零上下文纪律在开源后
   保留,具体形式 RF-11 执行卡定档。
4. 未支持面(mobile/native/远端业务)明确标记;不得把壳存在当功能支持
   (§17.7 maturity ladder)。

## 行为准则与报告

见 `CODE_OF_CONDUCT.md`(草案);安全相关走 `SECURITY.md` 私下通道。
